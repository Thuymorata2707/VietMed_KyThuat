import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MachineStatus,
  MaintenanceStatus,
  MaintenanceType,
  Prisma,
  WorkReviewStatus,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-actions';
import { isAdmin, isEngineer, maintenanceAccessWhere } from '../auth/access-scope';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { ReviewWorkTaskDto } from '../common/dto/review-work-task.dto';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import { validateMachineState } from '../machines/machine-state.rules';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssignMaintenanceDto } from './dto/assign-maintenance.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { ListMaintenanceQueryDto } from './dto/list-maintenance-query.dto';
import { UpdateMaintenanceStatusDto } from './dto/update-maintenance-status.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';

type MachineExpertiseSource = {
  businessLine?: {
    expertiseGroup?: string | null;
    productIndustry?: {
      expertiseGroup?: string | null;
    } | null;
  } | null;
  machineModel?: {
    businessLine?: {
      expertiseGroup?: string | null;
      productIndustry?: {
        expertiseGroup?: string | null;
      } | null;
    } | null;
  } | null;
} | null;

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateMaintenanceDto, actor: RequestUser) {
    assertPermission(actor, PERMISSIONS.MAINTENANCE_CREATE);
    this.validateCreateMaintenance(dto);
    const machine = dto.machineId
      ? await this.ensureMachineExists(dto.machineId)
      : null;
    if (machine) {
      await this.assertEngineerCanUseMachine(actor, machine);
    }

    const createdByEngineer = isEngineer(actor);
    const engineerId = createdByEngineer ? actor.id : dto.engineerId;

    if (engineerId) {
      await this.ensureEngineerExists(engineerId);
    }
    const customerId = await this.resolveTicketCustomerId(
      machine,
      dto.customerId,
    );

    return this.prisma.$transaction(async (tx) => {
      const maintenance = await tx.maintenance.create({
        data: {
          code: await this.generateMaintenanceCode(tx, machine, engineerId),
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          type: dto.type ?? MaintenanceType.PERIODIC,
          status: createdByEngineer
            ? MaintenanceStatus.SCHEDULED
            : engineerId
              ? MaintenanceStatus.ASSIGNED
              : MaintenanceStatus.SCHEDULED,
          machineId: machine?.id ?? null,
          customerId,
          engineerId: engineerId || null,
          scheduledDate: this.parseRequiredDate(
            dto.scheduledDate,
            'scheduledDate',
          ),
          assignedAt: createdByEngineer ? null : engineerId ? new Date() : null,
          checklist: this.normalizeChecklist(dto.checklist),
          nextDueDate: this.parseOptionalDate(dto.nextDueDate, 'nextDueDate'),
          usingDepartment: this.cleanOptionalString(dto.usingDepartment),
          representative: this.cleanOptionalString(dto.representative),
          address: this.cleanOptionalString(dto.address),
          contactPhone: this.cleanOptionalString(dto.contactPhone),
          deviceName: this.cleanOptionalString(dto.deviceName),
          modelName: this.cleanOptionalString(dto.modelName),
          serialNumber: this.cleanOptionalString(dto.serialNumber),
        },
        include: this.defaultInclude(),
      });

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.CREATE,
          entityType: 'Maintenance',
          entityId: maintenance.id,
          actor,
          metadata: {
            code: maintenance.code,
            machineId: maintenance.machineId,
            customerId: maintenance.customerId,
            engineerId: maintenance.engineerId,
            status: maintenance.status,
          },
        },
        tx,
      );

      if (maintenance.engineerId && maintenance.engineerId !== actor.id) {
        await this.notificationsService.create(
          {
            userId: maintenance.engineerId,
            title: 'Bạn có phiếu bảo trì mới',
            message: `${actor.email} đã phân công phiếu ${maintenance.code}: ${maintenance.title}`,
            href: '/my-tasks',
            entityType: 'Maintenance',
            entityId: maintenance.id,
            createdById: actor.id,
          },
          tx,
        );
      }

      if (isEngineer(actor)) {
        await this.notificationsService.createForAdmins(
          {
            title: 'Kỹ sư tạo phiếu bảo trì mới',
            message: `${actor.email} đã tạo phiếu ${maintenance.code}: ${maintenance.title}. Vui lòng kiểm tra và duyệt dữ liệu liên quan.`,
            href: '/service-tickets',
            entityType: 'Maintenance',
            entityId: maintenance.id,
            createdById: actor.id,
          },
          tx,
        );
      }

      return maintenance;
    });
  }

  async findAll(
    query: ListMaintenanceQueryDto,
    user?: RequestUser,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.withAccessScope(this.buildFindAllWhere(query), user);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.maintenance.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [
          { scheduledDate: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.maintenance.count({ where }),
    ]);

    return this.toPaginatedResult(data, page, limit, total);
  }

  async findOne(id: string, user?: RequestUser) {
    const maintenance = await this.prisma.maintenance.findFirst({
      where: this.withAccessScope({ id }, user),
      include: this.defaultInclude(),
    });

    if (!maintenance) {
      throw new NotFoundException('Maintenance not found');
    }

    return maintenance;
  }

  async update(id: string, dto: UpdateMaintenanceDto, actor: RequestUser) {
    assertPermission(actor, PERMISSIONS.MAINTENANCE_UPDATE);
    const maintenance = await this.findOne(id, actor);
    const nextEngineerId =
      dto.engineerId === undefined
        ? maintenance.engineerId
        : dto.engineerId || null;
    const nextStatus = dto.status ?? maintenance.status;
    const nextMachine =
      dto.machineId === undefined
        ? maintenance.machine
        : dto.machineId
          ? await this.ensureMachineExists(dto.machineId)
          : null;
    const nextCustomerId = await this.resolveTicketCustomerId(
      nextMachine,
      dto.customerId === undefined
        ? dto.machineId === undefined
          ? maintenance.customerId
          : nextMachine?.customerId ?? null
        : dto.customerId,
    );

    if (nextMachine) {
      await this.assertEngineerCanUseMachine(
        actor,
        nextMachine as MachineExpertiseSource,
      );
    }

    if (nextEngineerId) {
      await this.ensureEngineerExists(nextEngineerId);
    }

    this.ensureStatusTransitionIsAllowed(maintenance.status, nextStatus);

    if (this.statusRequiresEngineer(nextStatus) && !nextEngineerId) {
      throw new BadRequestException(
        'Maintenance must be assigned to an engineer first',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.maintenance.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          description:
            dto.description === undefined
              ? undefined
              : dto.description?.trim() || null,
          type: dto.type,
          engineerId:
            dto.engineerId === undefined ? undefined : nextEngineerId,
          machineId:
            dto.machineId === undefined ? undefined : nextMachine?.id ?? null,
          customerId:
            dto.customerId === undefined && dto.machineId === undefined
              ? undefined
              : nextCustomerId,
          status: dto.status,
          assignedAt:
            dto.engineerId !== undefined &&
            nextEngineerId &&
            !maintenance.assignedAt
              ? new Date()
              : undefined,
          startedAt:
            dto.status === MaintenanceStatus.IN_PROGRESS &&
            !maintenance.startedAt
              ? new Date()
              : undefined,
          completedAt:
            dto.status === MaintenanceStatus.COMPLETED ? new Date() : undefined,
          reviewStatus: dto.status
            ? this.resolveReviewStatus(dto.status, actor)
            : undefined,
          reviewedAt:
            dto.status === MaintenanceStatus.COMPLETED && isAdmin(actor)
              ? new Date()
              : dto.status
                ? null
                : undefined,
          reviewerId:
            dto.status === MaintenanceStatus.COMPLETED && isAdmin(actor)
              ? actor.id
              : dto.status
                ? null
                : undefined,
          reviewNote: dto.status ? null : undefined,
          scheduledDate: dto.scheduledDate
            ? this.parseRequiredDate(dto.scheduledDate, 'scheduledDate')
            : undefined,
          checklist:
            dto.checklist === undefined
              ? undefined
              : this.normalizeChecklist(dto.checklist),
          resultNote:
            dto.resultNote === undefined
              ? undefined
              : dto.resultNote?.trim() || null,
          nextDueDate:
            dto.nextDueDate === undefined
              ? undefined
              : this.parseOptionalDate(dto.nextDueDate, 'nextDueDate'),
          usingDepartment: this.cleanOptionalUpdateString(
            dto.usingDepartment,
          ),
          representative: this.cleanOptionalUpdateString(dto.representative),
          address: this.cleanOptionalUpdateString(dto.address),
          contactPhone: this.cleanOptionalUpdateString(dto.contactPhone),
          deviceName: this.cleanOptionalUpdateString(dto.deviceName),
          modelName: this.cleanOptionalUpdateString(dto.modelName),
          serialNumber: this.cleanOptionalUpdateString(dto.serialNumber),
        },
        include: this.defaultInclude(),
      });

      const machineStatus =
        this.getMachineStatusForMaintenanceStatus(nextStatus);

      if (machineStatus && nextMachine) {
        validateMachineState(
          machineStatus,
          nextMachine.inventoryStatus,
          nextMachine.customerId,
        );
        await tx.machine.update({
          where: { id: nextMachine.id },
          data: {
            status: machineStatus,
          },
        });
      }

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.UPDATE,
          entityType: 'Maintenance',
          entityId: id,
          actor,
          changes: this.pickChangedFields(maintenance, updated, [
            'title',
            'description',
            'type',
            'customerId',
            'engineerId',
            'status',
            'scheduledDate',
            'checklist',
            'resultNote',
            'nextDueDate',
            'usingDepartment',
            'representative',
            'address',
            'contactPhone',
            'deviceName',
            'modelName',
            'serialNumber',
          ]),
        },
        tx,
      );

      if (updated.engineerId && updated.engineerId !== maintenance.engineerId) {
        await this.notificationsService.create(
          {
            userId: updated.engineerId,
            title: 'Bạn có phiếu bảo trì mới',
            message: `${actor.email} đã phân công phiếu ${updated.code}: ${updated.title}`,
            href: '/my-tasks',
            entityType: 'Maintenance',
            entityId: updated.id,
            createdById: actor.id,
          },
          tx,
        );
      }

      return updated;
    });
  }

  async remove(id: string, actor: RequestUser) {
    assertPermission(actor, PERMISSIONS.MAINTENANCE_DELETE);
    const maintenance = await this.findOne(id, actor);

    await this.prisma.$transaction(async (tx) => {
      await tx.maintenance.delete({
        where: { id },
      });

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.DELETE,
          entityType: 'Maintenance',
          entityId: id,
          actor,
          metadata: {
            code: maintenance.code,
            machineId: maintenance.machineId,
            engineerId: maintenance.engineerId,
            status: maintenance.status,
          },
        },
        tx,
      );
    });

    return { deleted: true };
  }

  async assign(id: string, dto: AssignMaintenanceDto, actor: RequestUser) {
    assertPermission(actor, PERMISSIONS.MAINTENANCE_ASSIGN);
    if (!dto.engineerId) {
      throw new BadRequestException('engineerId is required');
    }

    const maintenance = await this.findOne(id, actor);
    await this.ensureEngineerExists(dto.engineerId);

    if (this.isTerminalStatus(maintenance.status)) {
      throw new BadRequestException('Cannot assign a closed maintenance job');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.maintenance.update({
        where: { id },
        data: {
          engineerId: dto.engineerId,
          status:
            maintenance.status === MaintenanceStatus.SCHEDULED ||
            maintenance.status === MaintenanceStatus.OVERDUE
              ? MaintenanceStatus.ASSIGNED
              : maintenance.status,
          assignedAt: maintenance.assignedAt ?? new Date(),
        },
        include: this.defaultInclude(),
      });

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.ASSIGN,
          entityType: 'Maintenance',
          entityId: id,
          actor,
          changes: {
            engineerId: {
              from: maintenance.engineerId,
              to: updated.engineerId,
            },
            status: {
              from: maintenance.status,
              to: updated.status,
            },
          },
        },
        tx,
      );

      if (updated.engineerId && updated.engineerId !== maintenance.engineerId) {
        await this.notificationsService.create(
          {
            userId: updated.engineerId,
            title: 'Bạn có phiếu bảo trì mới',
            message: `${actor.email} đã phân công phiếu ${updated.code}: ${updated.title}`,
            href: '/my-tasks',
            entityType: 'Maintenance',
            entityId: updated.id,
            createdById: actor.id,
          },
          tx,
        );
      }

      return updated;
    });
  }

  async updateStatus(
    id: string,
    dto: UpdateMaintenanceStatusDto,
    actor: RequestUser,
  ) {
    if (!dto.status) {
      throw new BadRequestException('status is required');
    }

    assertPermission(actor, PERMISSIONS.MAINTENANCE_STATUS_UPDATE);
    const maintenance = await this.findOne(id, actor);
    const now = new Date();

    this.ensureStatusTransitionIsAllowed(maintenance.status, dto.status);

    if (this.statusRequiresEngineer(dto.status) && !maintenance.engineerId) {
      throw new BadRequestException(
        'Maintenance must be assigned to an engineer first',
      );
    }

    const updatedMaintenance = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.maintenance.update({
        where: { id },
        data: {
          status: dto.status,
          startedAt:
            dto.status === MaintenanceStatus.IN_PROGRESS &&
            !maintenance.startedAt
              ? now
              : undefined,
          completedAt:
            dto.status === MaintenanceStatus.COMPLETED ? now : undefined,
          reviewStatus: this.resolveReviewStatus(dto.status, actor),
          reviewedAt:
            dto.status === MaintenanceStatus.COMPLETED && isAdmin(actor)
              ? now
              : null,
          reviewerId:
            dto.status === MaintenanceStatus.COMPLETED && isAdmin(actor)
              ? actor.id
              : null,
          reviewNote: null,
          resultNote: dto.resultNote?.trim(),
          nextDueDate: this.parseOptionalDate(dto.nextDueDate, 'nextDueDate'),
        },
        include: this.defaultInclude(),
      });

      const machineStatus = this.getMachineStatusForMaintenanceStatus(
        dto.status,
      );

      if (machineStatus && maintenance.machine) {
        validateMachineState(
          machineStatus,
          maintenance.machine.inventoryStatus,
          maintenance.machine.customerId,
        );
        await tx.machine.update({
          where: { id: maintenance.machine.id },
          data: {
            status: machineStatus,
          },
        });
      }

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.STATUS_CHANGE,
          entityType: 'Maintenance',
          entityId: id,
          actor,
          changes: {
            status: {
              from: maintenance.status,
              to: updated.status,
            },
            resultNote: {
              from: maintenance.resultNote,
              to: updated.resultNote,
            },
            nextDueDate: {
              from: maintenance.nextDueDate,
              to: updated.nextDueDate,
            },
          },
          metadata: {
            machineStatus,
          },
        },
        tx,
      );

      return updated;
    });

    if (
      updatedMaintenance.status === MaintenanceStatus.COMPLETED &&
      isEngineer(actor)
    ) {
      await this.notificationsService
        .createForAdmins({
          title: 'Phiếu bảo trì chờ xác nhận',
          message: `${actor.email} đã hoàn tất phiếu ${updatedMaintenance.code}: ${updatedMaintenance.title}. Vui lòng kiểm tra kết quả.`,
          href: '/service-tickets',
          entityType: 'Maintenance',
          entityId: updatedMaintenance.id,
          createdById: actor.id,
        })
        .catch(() => null);
    }

    return updatedMaintenance;
  }

  async review(id: string, dto: ReviewWorkTaskDto, actor: RequestUser) {
    if (!isAdmin(actor)) {
      throw new ForbiddenException('Only admins can review maintenance tasks');
    }

    if (
      dto.status !== WorkReviewStatus.APPROVED &&
      dto.status !== WorkReviewStatus.NEEDS_REVISION
    ) {
      throw new BadRequestException(
        'Review status must be APPROVED or NEEDS_REVISION',
      );
    }

    const maintenance = await this.findOne(id, actor);
    if (maintenance.reviewStatus !== WorkReviewStatus.PENDING) {
      throw new BadRequestException(
        'Only pending review maintenances can be reviewed',
      );
    }

    const reviewNote = this.cleanOptionalString(dto.reviewNote);
    if (dto.status === WorkReviewStatus.NEEDS_REVISION && !reviewNote) {
      throw new BadRequestException(
        'reviewNote is required when returning a maintenance',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextStatus =
        dto.status === WorkReviewStatus.NEEDS_REVISION
          ? MaintenanceStatus.IN_PROGRESS
          : maintenance.status;
      const nextMachineStatus =
        dto.status === WorkReviewStatus.NEEDS_REVISION
          ? MachineStatus.MAINTENANCE
          : null;

      const reviewed = await tx.maintenance.update({
        where: { id },
        data: {
          status: nextStatus,
          completedAt:
            dto.status === WorkReviewStatus.NEEDS_REVISION
              ? null
              : maintenance.completedAt,
          reviewStatus: dto.status,
          reviewNote,
          reviewedAt: new Date(),
          reviewerId: actor.id,
        },
        include: this.defaultInclude(),
      });

      if (nextMachineStatus && maintenance.machine) {
        validateMachineState(
          nextMachineStatus,
          maintenance.machine.inventoryStatus,
          maintenance.machine.customerId,
        );
        await tx.machine.update({
          where: { id: maintenance.machine.id },
          data: { status: nextMachineStatus },
        });
      }

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.STATUS_CHANGE,
          entityType: 'Maintenance',
          entityId: id,
          actor,
          changes: {
            reviewStatus: {
              from: maintenance.reviewStatus,
              to: reviewed.reviewStatus,
            },
            reviewNote: {
              from: maintenance.reviewNote,
              to: reviewed.reviewNote,
            },
            status: {
              from: maintenance.status,
              to: reviewed.status,
            },
          },
        },
        tx,
      );

      return reviewed;
    });

    if (updated.engineerId) {
      await this.notificationsService
        .create({
          userId: updated.engineerId,
          title:
            dto.status === WorkReviewStatus.APPROVED
              ? 'Phiếu bảo trì đã được xác nhận'
              : 'Phiếu bảo trì cần bổ sung',
          message:
            dto.status === WorkReviewStatus.APPROVED
              ? `Admin đã xác nhận phiếu ${updated.code}.`
              : `Admin yêu cầu bổ sung phiếu ${updated.code}: ${reviewNote}`,
          href: '/my-tasks',
          entityType: 'Maintenance',
          entityId: updated.id,
          createdById: actor.id,
        })
        .catch(() => null);
    }

    return updated;
  }

  getStatuses() {
    return Object.values(MaintenanceStatus);
  }

  getTypes() {
    return Object.values(MaintenanceType);
  }

  private validateCreateMaintenance(dto: CreateMaintenanceDto) {
    if (!dto.title?.trim() || !dto.scheduledDate) {
      throw new BadRequestException(
        'title and scheduledDate are required',
      );
    }
  }

  private cleanOptionalString(value?: string | null) {
    return value?.trim() || null;
  }

  private cleanOptionalUpdateString(value?: string | null) {
    return value === undefined ? undefined : this.cleanOptionalString(value);
  }

  private async ensureMachineExists(machineId: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        businessLine: {
          include: {
            productIndustry: true,
          },
        },
        machineModel: {
          include: {
            businessLine: {
              include: {
                productIndustry: true,
              },
            },
          },
        },
      },
    });

    if (!machine) {
      throw new BadRequestException('Machine does not exist');
    }

    return machine;
  }

  private async resolveTicketCustomerId(
    machine: ({ customerId?: string | null } & MachineExpertiseSource) | null,
    customerId?: string | null,
  ) {
    const cleanedCustomerId = customerId?.trim() || null;

    if (machine?.customerId) {
      if (cleanedCustomerId && cleanedCustomerId !== machine.customerId) {
        throw new BadRequestException(
          'Customer does not match selected machine',
        );
      }

      return machine.customerId;
    }

    if (!cleanedCustomerId) {
      return null;
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: cleanedCustomerId },
      select: { id: true },
    });

    if (!customer) {
      throw new BadRequestException('Customer does not exist');
    }

    return customer.id;
  }

  private async assertEngineerCanUseMachine(
    actor: RequestUser,
    machine: MachineExpertiseSource,
  ) {
    if (!isEngineer(actor)) {
      return;
    }

    const engineer = await this.prisma.user.findUnique({
      where: { id: actor.id },
      include: { engineerProfile: true },
    });
    const expertiseGroup = engineer?.engineerProfile?.expertiseGroup;

    if (!expertiseGroup) {
      return;
    }

    const machineGroup =
      machine.businessLine?.productIndustry?.expertiseGroup ??
      machine.businessLine?.expertiseGroup ??
      machine.machineModel?.businessLine?.productIndustry?.expertiseGroup ??
      machine.machineModel?.businessLine?.expertiseGroup;

    if (machineGroup && machineGroup !== expertiseGroup) {
      throw new ForbiddenException(
        'Engineer can only create tickets for assigned product group',
      );
    }
  }

  private async ensureEngineerExists(engineerId: string) {
    const engineer = await this.prisma.user.findUnique({
      where: { id: engineerId },
      include: {
        role: true,
      },
    });

    if (!engineer || engineer.status !== 'ACTIVE') {
      throw new BadRequestException('Engineer does not exist or is inactive');
    }

    if (engineer.role.name !== 'engineer' && engineer.role.name !== 'admin') {
      throw new BadRequestException('Assigned user must be an engineer');
    }
  }

  private async generateMaintenanceCode(
    tx: Prisma.TransactionClient,
    machine: MachineExpertiseSource,
    engineerId?: string | null,
  ): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const engineerCode =
      (await this.getEngineerCode(tx, engineerId)) ??
      this.getExpertiseGroupCode(machine);
    const prefix = `BT-${engineerCode}-${year}`;

    const latest = await tx.maintenance.findFirst({
      where: {
        code: {
          startsWith: `${prefix}-`,
        },
      },
      orderBy: {
        code: 'desc',
      },
      select: {
        code: true,
      },
    });
    const latestNumber = latest?.code
      ? Number(latest.code.slice(prefix.length + 1))
      : 0;
    const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 1;

    return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
  }

  private async getEngineerCode(
    tx: Prisma.TransactionClient,
    engineerId?: string | null,
  ) {
    if (!engineerId) {
      return null;
    }

    const engineer = await tx.user.findUnique({
      where: { id: engineerId },
      select: {
        engineerProfile: {
          select: {
            employeeCode: true,
          },
        },
        fullName: true,
        email: true,
      },
    });

    return this.normalizeCodeSegment(
      engineer?.engineerProfile?.employeeCode ||
        engineer?.fullName ||
        engineer?.email ||
        '',
    );
  }

  private normalizeCodeSegment(value: string) {
    const normalized = value
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/Đ/g, 'D')
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');

    return normalized || null;
  }

  private getExpertiseGroupCode(
    machine: MachineExpertiseSource,
  ) {
    const group =
      machine?.businessLine?.productIndustry?.expertiseGroup ??
      machine?.businessLine?.expertiseGroup ??
      machine?.machineModel?.businessLine?.productIndustry?.expertiseGroup ??
      machine?.machineModel?.businessLine?.expertiseGroup;

    if (group === 'LAB_TESTING') return 'XN';
    if (group === 'IMAGING') return 'SA';
    return 'KT';
  }

  private parseRequiredDate(value: string, fieldName: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }

    return date;
  }

  private parseOptionalDate(
    value: string | null | undefined,
    fieldName: string,
  ): Date | null {
    if (!value) {
      return null;
    }

    return this.parseRequiredDate(value, fieldName);
  }

  private normalizeChecklist(checklist?: string[]): string[] {
    if (!checklist?.length) {
      return [];
    }

    return checklist
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private buildFindAllWhere(
    query: ListMaintenanceQueryDto,
  ): Prisma.MaintenanceWhereInput {
    const search = query.search?.trim();
    const machineWhere: Prisma.MachineWhereInput = {
      businessLine: query.productIndustryId
        ? {
            productIndustryId: query.productIndustryId,
          }
        : undefined,
    };
    const and: Prisma.MaintenanceWhereInput[] = [];

    if (query.customerId) {
      and.push({
        OR: [
          { customerId: query.customerId },
          { machine: { customerId: query.customerId } },
        ],
      });
    }

    if (query.productIndustryId) {
      and.push({ machine: machineWhere });
    }

    return {
      status: query.status,
      type: query.type,
      machineId: query.machineId,
      engineerId: query.engineerId,
      AND: and.length ? and : undefined,
      scheduledDate:
        query.scheduledFrom || query.scheduledTo
          ? {
              gte: query.scheduledFrom
                ? this.parseRequiredDate(query.scheduledFrom, 'scheduledFrom')
                : undefined,
              lte: query.scheduledTo
                ? this.parseRequiredDate(query.scheduledTo, 'scheduledTo')
                : undefined,
            }
          : undefined,
      OR: search
        ? [
            { code: { contains: search,  } },
            { title: { contains: search,  } },
            { description: { contains: search,  } },
            { deviceName: { contains: search,  } },
            { modelName: { contains: search,  } },
            { serialNumber: { contains: search,  } },
            { usingDepartment: { contains: search,  } },
            { representative: { contains: search,  } },
            {
              machine: {
                serialNumber: { contains: search,  },
              },
            },
            {
              machine: {
                machineCode: { contains: search,  },
              },
            },
            {
              machine: {
                customer: {
                  name: { contains: search,  },
                },
              },
            },
          ]
        : undefined,
    };
  }

  private withAccessScope(
    where: Prisma.MaintenanceWhereInput,
    user?: RequestUser,
  ): Prisma.MaintenanceWhereInput {
    return {
      AND: [where, maintenanceAccessWhere(user)],
    };
  }

  private toPaginatedResult<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
  ): PaginatedResult<T> {
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private statusRequiresEngineer(status: MaintenanceStatus): boolean {
    return (
      status === MaintenanceStatus.ASSIGNED ||
      status === MaintenanceStatus.IN_PROGRESS
    );
  }

  private resolveReviewStatus(
    status: MaintenanceStatus,
    actor: RequestUser,
  ): WorkReviewStatus {
    if (status !== MaintenanceStatus.COMPLETED) {
      return WorkReviewStatus.NOT_REQUIRED;
    }

    return isAdmin(actor)
      ? WorkReviewStatus.APPROVED
      : WorkReviewStatus.PENDING;
  }

  private getMachineStatusForMaintenanceStatus(
    status: MaintenanceStatus,
  ): MachineStatus | null {
    if (status === MaintenanceStatus.IN_PROGRESS) {
      return MachineStatus.MAINTENANCE;
    }

    if (
      status === MaintenanceStatus.COMPLETED ||
      status === MaintenanceStatus.CANCELLED
    ) {
      return MachineStatus.ACTIVE;
    }

    return null;
  }

  private ensureStatusTransitionIsAllowed(
    currentStatus: MaintenanceStatus,
    nextStatus: MaintenanceStatus,
  ) {
    if (currentStatus === nextStatus) {
      return;
    }

    const allowedTransitions: Record<MaintenanceStatus, MaintenanceStatus[]> = {
      [MaintenanceStatus.SCHEDULED]: [
        MaintenanceStatus.ASSIGNED,
        MaintenanceStatus.OVERDUE,
        MaintenanceStatus.CANCELLED,
      ],
      [MaintenanceStatus.ASSIGNED]: [
        MaintenanceStatus.IN_PROGRESS,
        MaintenanceStatus.COMPLETED,
        MaintenanceStatus.OVERDUE,
        MaintenanceStatus.CANCELLED,
      ],
      [MaintenanceStatus.IN_PROGRESS]: [
        MaintenanceStatus.COMPLETED,
        MaintenanceStatus.CANCELLED,
      ],
      [MaintenanceStatus.OVERDUE]: [
        MaintenanceStatus.ASSIGNED,
        MaintenanceStatus.IN_PROGRESS,
        MaintenanceStatus.COMPLETED,
        MaintenanceStatus.CANCELLED,
      ],
      [MaintenanceStatus.COMPLETED]: [],
      [MaintenanceStatus.CANCELLED]: [],
    };

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid maintenance status transition: ${currentStatus} -> ${nextStatus}`,
      );
    }
  }

  private isTerminalStatus(status: MaintenanceStatus): boolean {
    return (
      status === MaintenanceStatus.COMPLETED ||
      status === MaintenanceStatus.CANCELLED
    );
  }

  private pickChangedFields<T extends Record<string, unknown>>(
    before: T,
    after: T,
    fields: string[],
  ) {
    return fields.reduce<Record<string, { from: unknown; to: unknown }>>(
      (changes, field) => {
        if (before[field] !== after[field]) {
          changes[field] = {
            from: before[field],
            to: after[field],
          };
        }

        return changes;
      },
      {},
    );
  }

  private defaultInclude() {
    return {
      machine: {
        include: {
          businessLine: {
            include: {
              productIndustry: true,
            },
          },
          customer: {
            include: {
              region: true,
            },
          },
        },
      },
      customer: {
        include: {
          region: true,
        },
      },
      engineer: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          status: true,
          role: true,
          region: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    };
  }
}

import { sequenceCode } from '../common/sequence-code';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MachineInventoryStatus,
  MachineStatus,
  MaintenanceStatus,
  MaintenanceType,
  Prisma,
  WorkReviewStatus,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-actions';
import {
  isAdmin,
  isEngineer,
  maintenanceAccessWhere,
} from '../auth/access-scope';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { DeleteWorkTaskDto } from '../common/dto/delete-work-task.dto';
import { ReviewWorkTaskDto } from '../common/dto/review-work-task.dto';
import {
  buildDeleteRequestNote,
  deleteRequestDisplayNote,
  isApprovedDeleteReview,
  isDeleteRequest,
} from '../common/work-delete-request';
import { assertNoPendingDeleteRequest, assertTicketCanBeDeleted } from '../common/pending-delete-request';
import { reconcileMachineStatusFromOpenWork } from '../common/machine-work-status';
import { replaceWorkUsedParts } from '../common/work-used-parts';
import { shortDateCode } from '../common/code-format';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import {
  getMachineStatusAfterWork,
  validateMachineState,
} from '../machines/machine-state.rules';
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
    const selfSubmission = isEngineer(actor);
    if (!isAdmin(actor) && !selfSubmission)
      throw new ForbiddenException(
        'Only administrators or engineers can create maintenance tickets',
      );
    this.validateCreateMaintenance(dto);
    const machine = dto.machineId
      ? await this.ensureMachineExists(dto.machineId)
      : null;
    if (machine) {
      await this.assertEngineerCanUseMachine(actor, machine);
    }

    const engineerIds = selfSubmission ? [actor.id] : [
      ...new Set(
        dto.engineerIds?.length
          ? dto.engineerIds
          : dto.engineerId
            ? [dto.engineerId]
            : [],
      ),
    ];
    if (!engineerIds.length)
      throw new BadRequestException('At least one engineer must be assigned');
    await Promise.all(
      engineerIds.map((engineerId) => this.ensureEngineerExists(engineerId)),
    );
    const engineerId = engineerIds[0];
    const scheduledDate =
      this.parseOptionalDate(dto.scheduledDate, 'scheduledDate') ?? new Date();
    const customerId = await this.resolveTicketCustomerId(
      machine,
      dto.customerId,
    );
    if (
      selfSubmission &&
      (!machine || !customerId || !dto.checklist?.length ||
        !dto.resultNote?.trim())
    ) {
      throw new BadRequestException(
        'Engineer-submitted maintenance reports require a customer, machine, checklist, and result',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const maintenance = await tx.maintenance.create({
          data: {
            code: await this.generateMaintenanceCode(tx, scheduledDate),
            title: dto.title?.trim() || 'Phiếu bảo trì',
            description: dto.description?.trim() || null,
            type: dto.type ?? MaintenanceType.PERIODIC,
            status: selfSubmission ? MaintenanceStatus.COMPLETED : MaintenanceStatus.ASSIGNED,
            machineId: machine?.id ?? null,
            customerId,
            engineerId: engineerId || null,
            scheduledDate,
            assignedAt: new Date(),
            completedAt: selfSubmission ? new Date() : null,
            reviewStatus: selfSubmission ? WorkReviewStatus.PENDING : WorkReviewStatus.NOT_REQUIRED,
            checklist: this.normalizeChecklist(dto.checklist),
            receivedAccessories: this.cleanOptionalString(dto.receivedAccessories),
            resultNote: this.cleanOptionalString(dto.resultNote),
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

        if (dto.usedParts !== undefined) {
          await replaceWorkUsedParts({
            actor,
            customerId: maintenance.customerId,
            machineId: maintenance.machineId,
            owner: { field: 'maintenanceId', id: maintenance.id, kind: 'MAINTENANCE' },
            parts: dto.usedParts,
            prisma: this.prisma,
            tx,
          });
        }

        await tx.maintenanceAssignment.createMany({
          data: engineerIds.map((assignedEngineerId, index) => ({
            maintenanceId: maintenance.id,
            engineerId: assignedEngineerId,
            isLead: index === 0,
          })),
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

        if (selfSubmission) {
          await this.notificationsService.createForAdmins({
            title: 'Phiếu bảo trì chờ phê duyệt',
            message: `Phiếu bảo trì ${maintenance.code} đã được trình phê duyệt.`,
            href: '/service-tickets',
            entityType: 'Maintenance',
            entityId: maintenance.id,
            createdById: actor.id,
          }, tx);
        } else await Promise.all(
          engineerIds.map((assignedEngineerId) =>
            this.notificationsService.create(
              {
                userId: assignedEngineerId,
                title: 'Phiếu bảo trì mới được phân công',
            message: `Phiếu ${maintenance.code} đã được phân công: ${maintenance.title}`,
                href: '/my-tasks',
                entityType: 'Maintenance',
                entityId: maintenance.id,
                createdById: actor.id,
              },
              tx,
            ),
          ),
        );

        return tx.maintenance.findUnique({
          where: { id: maintenance.id },
          include: this.defaultInclude(),
        });
      },
      { timeout: 20_000 },
    );
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
          { createdAt: 'desc' },
          { updatedAt: 'desc' },
          { scheduledDate: 'desc' },
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
    assertNoPendingDeleteRequest(maintenance);
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
          : (nextMachine?.customerId ?? null)
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

    return this.prisma.$transaction(
      async (tx) => {
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
              dto.machineId === undefined
                ? undefined
                : (nextMachine?.id ?? null),
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
              dto.status === MaintenanceStatus.COMPLETED
                ? new Date()
                : undefined,
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
            receivedAccessories: this.cleanOptionalUpdateString(dto.receivedAccessories),
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

        let machineStatus = this.getMachineStatusForMaintenanceStatus(
          nextStatus,
          nextMachine?.inventoryStatus,
        );

        if (machineStatus && nextMachine) {
          if (
            nextStatus === MaintenanceStatus.COMPLETED ||
            nextStatus === MaintenanceStatus.CANCELLED
          ) {
            machineStatus = await reconcileMachineStatusFromOpenWork(
              tx,
              nextMachine.id,
              nextMachine.inventoryStatus,
            );
          } else {
            validateMachineState(
              machineStatus,
              nextMachine.inventoryStatus,
              nextMachine.customerId,
            );
            await tx.machine.update({
              where: { id: nextMachine.id },
              data: { status: machineStatus },
            });
          }
        }

        if (maintenance.machine && maintenance.machine.id !== nextMachine?.id) {
          await reconcileMachineStatusFromOpenWork(
            tx,
            maintenance.machine.id,
            maintenance.machine.inventoryStatus,
          );
        }

        if (dto.usedParts !== undefined) {
          await replaceWorkUsedParts({
            actor,
            customerId: updated.customerId,
            machineId: updated.machineId,
            owner: {
              field: 'maintenanceId',
              id: updated.id,
              kind: 'MAINTENANCE',
            },
            parts: dto.usedParts,
            prisma: this.prisma,
            tx,
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
              'receivedAccessories',
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

        if (
          updated.engineerId &&
          updated.engineerId !== maintenance.engineerId
        ) {
          await this.notificationsService.create(
            {
              userId: updated.engineerId,
              title: 'Phiếu bảo trì mới được phân công',
              message: `Phiếu ${updated.code} đã được phân công: ${updated.title}`,
              href: '/my-tasks',
              entityType: 'Maintenance',
              entityId: updated.id,
              createdById: actor.id,
            },
            tx,
          );
        }

        return updated;
      },
      { timeout: 20_000 },
    );
  }

  async remove(id: string, actor: RequestUser, dto?: DeleteWorkTaskDto) {
    void dto;
    const maintenance = await this.findOne(id, actor);
    if (!isAdmin(actor))
      throw new ForbiddenException(
        'Only administrators can delete maintenance tickets',
      );

    assertPermission(actor, PERMISSIONS.MAINTENANCE_DELETE);
    return this.deleteMaintenance(id, maintenance, actor);
  }

  private async requestDelete(
    id: string,
    maintenance: Awaited<ReturnType<MaintenanceService['findOne']>>,
    actor: RequestUser,
    reason?: string | null,
  ) {
    assertTicketCanBeDeleted(maintenance.status);
    if (
      maintenance.reviewStatus === WorkReviewStatus.PENDING &&
      isDeleteRequest(maintenance.reviewNote)
    ) {
      throw new BadRequestException('Delete request is already pending review');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.maintenance.update({
        where: { id },
        data: {
          reviewStatus: WorkReviewStatus.PENDING,
          reviewNote: buildDeleteRequestNote(reason),
          reviewedAt: null,
          reviewerId: null,
        },
        include: this.defaultInclude(),
      });

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.STATUS_CHANGE,
          entityType: 'Maintenance',
          entityId: id,
          actor,
          metadata: {
            action: 'REQUEST_DELETE',
            code: maintenance.code,
            reason: reason?.trim() || null,
          },
        },
        tx,
      );

      return next;
    });

    await this.notificationsService
      .createForAdmins({
        title: 'Yêu cầu xóa phiếu bảo trì chờ phê duyệt',
        message: `Lý do yêu cầu xóa phiếu ${maintenance.code}: ${deleteRequestDisplayNote(updated.reviewNote)}`,
        href: '/service-tickets',
        entityType: 'Maintenance',
        entityId: maintenance.id,
        createdById: actor.id,
      })
      .catch(() => null);

    return { deleteRequested: true, item: updated };
  }

  private async deleteMaintenance(
    id: string,
    maintenance: Awaited<ReturnType<MaintenanceService['findOne']>>,
    actor: RequestUser,
  ) {
    assertTicketCanBeDeleted(maintenance.status);
    await this.prisma.$transaction(async (tx) => {
      await tx.maintenance.delete({
        where: { id },
      });

      if (maintenance.machine) {
        await reconcileMachineStatusFromOpenWork(
          tx,
          maintenance.machine.id,
          maintenance.machine.inventoryStatus,
        );
      }

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

    return this.prisma.$transaction(
      async (tx) => {
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

        if (
          updated.engineerId &&
          updated.engineerId !== maintenance.engineerId
        ) {
          await this.notificationsService.create(
            {
              userId: updated.engineerId,
              title: 'Phiếu bảo trì mới được phân công',
              message: `Phiếu ${updated.code} đã được phân công: ${updated.title}`,
              href: '/my-tasks',
              entityType: 'Maintenance',
              entityId: updated.id,
              createdById: actor.id,
            },
            tx,
          );
        }

        return updated;
      },
      { timeout: 20_000 },
    );
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
    assertNoPendingDeleteRequest(maintenance);
    const now = new Date();

    this.ensureStatusTransitionIsAllowed(maintenance.status, dto.status);

    if (this.statusRequiresEngineer(dto.status) && !maintenance.engineerId) {
      throw new BadRequestException(
        'Maintenance must be assigned to an engineer first',
      );
    }

    const updatedMaintenance = await this.prisma.$transaction(
      async (tx) => {
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
            resultNote: dto.resultNote?.trim(),
            nextDueDate:
              dto.nextDueDate === undefined
                ? undefined
                : this.parseOptionalDate(dto.nextDueDate, 'nextDueDate'),
          },
          include: this.defaultInclude(),
        });

        let machineStatus = this.getMachineStatusForMaintenanceStatus(
          dto.status,
          maintenance.machine?.inventoryStatus,
        );

        if (machineStatus && maintenance.machine) {
          if (
            dto.status === MaintenanceStatus.COMPLETED ||
            dto.status === MaintenanceStatus.CANCELLED
          ) {
            machineStatus = await reconcileMachineStatusFromOpenWork(
              tx,
              maintenance.machine.id,
              maintenance.machine.inventoryStatus,
            );
          } else {
            validateMachineState(
              machineStatus,
              maintenance.machine.inventoryStatus,
              maintenance.machine.customerId,
            );
            await tx.machine.update({
              where: { id: maintenance.machine.id },
              data: { status: machineStatus },
            });
          }
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
      },
      { timeout: 20_000 },
    );

    if (
      updatedMaintenance.status === MaintenanceStatus.COMPLETED &&
      isEngineer(actor)
    ) {
      await this.notificationsService
        .createForAdmins({
          title: 'Phiếu bảo trì chờ phê duyệt',
          message: `Phiếu ${updatedMaintenance.code} đã hoàn tất.`,
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
    if (isDeleteRequest(maintenance.reviewNote)) {
      if (isApprovedDeleteReview(dto.status)) {
        return this.deleteMaintenance(id, maintenance, actor);
      }

      const rejected = await this.prisma.maintenance.update({
        where: { id },
        data: {
          reviewStatus: WorkReviewStatus.NEEDS_REVISION,
          reviewNote,
          reviewedAt: new Date(),
          reviewerId: actor.id,
        },
        include: this.defaultInclude(),
      });

      if (rejected.engineerId) {
        await this.notificationsService
          .create({
            userId: rejected.engineerId,
            title: 'Yêu cầu xóa phiếu bảo trì chưa được duyệt',
            message: `Quản trị viên từ chối yêu cầu xóa phiếu ${rejected.code}: ${reviewNote}`,
            href: '/my-tasks',
            entityType: 'Maintenance',
            entityId: rejected.id,
            createdById: actor.id,
          })
          .catch(() => null);
      }

      return rejected;
    }

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

      if (
        dto.status === WorkReviewStatus.APPROVED &&
        maintenance.status === MaintenanceStatus.COMPLETED &&
        maintenance.machine
      ) {
        await reconcileMachineStatusFromOpenWork(
          tx,
          maintenance.machine.id,
          maintenance.machine.inventoryStatus,
        );
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
              ? 'Phiếu bảo trì đã được phê duyệt'
              : 'Phiếu bảo trì cần bổ sung',
          message:
            dto.status === WorkReviewStatus.APPROVED
              ? `Quản trị viên đã phê duyệt phiếu ${updated.code}.`
              : `Quản trị viên yêu cầu bổ sung hồ sơ phiếu ${updated.code}: ${reviewNote}`,
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

  previewCode(date?: string) {
    return this.generateMaintenanceCode(
      this.prisma,
      this.parseOptionalDate(date, 'date') ?? new Date(),
    );
  }

  private validateCreateMaintenance(dto: CreateMaintenanceDto) {
    if (!dto.customerId && !dto.machineId) {
      throw new BadRequestException('customerId or machineId is required');
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
    date: Date,
  ): Promise<string> {
    const prefix = `BT-${shortDateCode(date)}`;

    return sequenceCode(tx, 'maintenance', prefix, 3, tx === this.prisma);
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

  private getExpertiseGroupCode(machine: MachineExpertiseSource) {
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
      engineerId: undefined,
      AND: query.engineerId
        ? [
            ...and,
            {
              OR: [
                { engineerId: query.engineerId },
                { assignments: { some: { engineerId: query.engineerId } } },
              ],
            },
          ]
        : and.length
          ? and
          : undefined,
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
            { code: { contains: search } },
            { title: { contains: search } },
            { description: { contains: search } },
            { deviceName: { contains: search } },
            { modelName: { contains: search } },
            { serialNumber: { contains: search } },
            { usingDepartment: { contains: search } },
            { representative: { contains: search } },
            {
              machine: {
                serialNumber: { contains: search },
              },
            },
            {
              machine: {
                machineCode: { contains: search },
              },
            },
            {
              machine: {
                customer: {
                  name: { contains: search },
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
    inventoryStatus?: MachineInventoryStatus | null,
  ): MachineStatus | null {
    if (status === MaintenanceStatus.IN_PROGRESS) {
      return MachineStatus.MAINTENANCE;
    }

    if (
      (status === MaintenanceStatus.COMPLETED ||
        status === MaintenanceStatus.CANCELLED) &&
      inventoryStatus
    ) {
      return getMachineStatusAfterWork(inventoryStatus);
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
        MaintenanceStatus.IN_PROGRESS,
        MaintenanceStatus.COMPLETED,
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
          machineModel: {
            include: {
              businessLine: {
                include: {
                  productIndustry: true,
                },
              },
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
      usedParts: true,
      reviewer: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
      assignments: {
        include: {
          engineer: {
            select: {
              id: true,
              email: true,
              fullName: true,
              engineerProfile: true,
            },
          },
        },
        orderBy: [{ isLead: 'desc' as const }, { assignedAt: 'asc' as const }],
      },
    };
  }
}

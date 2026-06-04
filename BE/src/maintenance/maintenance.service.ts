import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MachineStatus,
  MaintenanceStatus,
  MaintenanceType,
  Prisma,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-actions';
import { maintenanceAccessWhere } from '../auth/access-scope';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import { validateMachineState } from '../machines/machine-state.rules';
import { PrismaService } from '../prisma/prisma.service';
import { AssignMaintenanceDto } from './dto/assign-maintenance.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { ListMaintenanceQueryDto } from './dto/list-maintenance-query.dto';
import { UpdateMaintenanceStatusDto } from './dto/update-maintenance-status.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateMaintenanceDto, actor: RequestUser) {
    assertPermission(actor, PERMISSIONS.MAINTENANCE_CREATE);
    this.validateCreateMaintenance(dto);
    await this.ensureMachineExists(dto.machineId);

    if (dto.engineerId) {
      await this.ensureEngineerExists(dto.engineerId);
    }

    return this.prisma.$transaction(async (tx) => {
      const maintenance = await tx.maintenance.create({
        data: {
          code: await this.generateMaintenanceCode(),
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          type: dto.type ?? MaintenanceType.PERIODIC,
          status: dto.engineerId
            ? MaintenanceStatus.ASSIGNED
            : MaintenanceStatus.SCHEDULED,
          machineId: dto.machineId,
          engineerId: dto.engineerId || null,
          scheduledDate: this.parseRequiredDate(
            dto.scheduledDate,
            'scheduledDate',
          ),
          assignedAt: dto.engineerId ? new Date() : null,
          checklist: this.normalizeChecklist(dto.checklist),
          nextDueDate: this.parseOptionalDate(dto.nextDueDate, 'nextDueDate'),
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
            engineerId: maintenance.engineerId,
            status: maintenance.status,
          },
        },
        tx,
      );

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
        orderBy: {
          scheduledDate: 'asc',
        },
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
        },
        include: this.defaultInclude(),
      });

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
            'scheduledDate',
            'checklist',
            'resultNote',
            'nextDueDate',
          ]),
        },
        tx,
      );

      return updated;
    });
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

    return this.prisma.$transaction(async (tx) => {
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
          resultNote: dto.resultNote?.trim(),
          nextDueDate: this.parseOptionalDate(dto.nextDueDate, 'nextDueDate'),
        },
        include: this.defaultInclude(),
      });

      const machineStatus = this.getMachineStatusForMaintenanceStatus(
        dto.status,
      );

      if (machineStatus) {
        validateMachineState(
          machineStatus,
          maintenance.machine.inventoryStatus,
          maintenance.machine.customerId,
        );
        await tx.machine.update({
          where: { id: maintenance.machineId },
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
  }

  getStatuses() {
    return Object.values(MaintenanceStatus);
  }

  getTypes() {
    return Object.values(MaintenanceType);
  }

  private validateCreateMaintenance(dto: CreateMaintenanceDto) {
    if (!dto.title?.trim() || !dto.machineId || !dto.scheduledDate) {
      throw new BadRequestException(
        'title, machineId and scheduledDate are required',
      );
    }
  }

  private async ensureMachineExists(machineId: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
    });

    if (!machine) {
      throw new BadRequestException('Machine does not exist');
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

  private async generateMaintenanceCode(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const prefix = `MT-${year}${month}${day}`;

    const count = await this.prisma.maintenance.count({
      where: {
        code: {
          startsWith: prefix,
        },
      },
    });

    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
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

    return {
      status: query.status,
      type: query.type,
      machineId: query.machineId,
      engineerId: query.engineerId,
      machine: query.customerId
        ? {
            customerId: query.customerId,
          }
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
            { code: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            {
              machine: {
                serialNumber: { contains: search, mode: 'insensitive' },
              },
            },
            {
              machine: {
                machineCode: { contains: search, mode: 'insensitive' },
              },
            },
            {
              machine: {
                customer: {
                  name: { contains: search, mode: 'insensitive' },
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
          customer: {
            include: {
              region: true,
            },
          },
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
    };
  }
}

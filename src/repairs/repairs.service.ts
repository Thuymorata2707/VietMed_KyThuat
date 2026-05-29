import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MachineStatus, RepairPriority, RepairStatus } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { AssignRepairDto } from './dto/assign-repair.dto';
import { CreateRepairDto } from './dto/create-repair.dto';
import { UpdateRepairStatusDto } from './dto/update-repair-status.dto';
import { UpdateRepairDto } from './dto/update-repair.dto';

@Injectable()
export class RepairsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateRepairDto, actor: RequestUser) {
    this.validateCreateRepair(dto);

    await this.ensureMachineExists(dto.machineId);

    if (dto.engineerId) {
      await this.ensureEngineerExists(dto.engineerId);
    }

    return this.prisma.$transaction(async (tx) => {
      const repair = await tx.repair.create({
        data: {
          code: await this.generateRepairCode(),
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          machineId: dto.machineId,
          engineerId: dto.engineerId || null,
          priority: dto.priority ?? RepairPriority.NORMAL,
          status: dto.engineerId
            ? RepairStatus.ASSIGNED
            : RepairStatus.PENDING,
          reportedAt: this.parseOptionalDate(dto.reportedAt) ?? new Date(),
          assignedAt: dto.engineerId ? new Date() : null,
        },
        include: this.defaultInclude(),
      });

      await this.auditLogsService.create(
        {
          action: 'CREATE',
          entityType: 'Repair',
          entityId: repair.id,
          actor,
          metadata: {
            code: repair.code,
            machineId: repair.machineId,
            engineerId: repair.engineerId,
            status: repair.status,
          },
        },
        tx,
      );

      return repair;
    });
  }

  findAll() {
    return this.prisma.repair.findMany({
      include: this.defaultInclude(),
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const repair = await this.prisma.repair.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });

    if (!repair) {
      throw new NotFoundException('Repair not found');
    }

    return repair;
  }

  async update(id: string, dto: UpdateRepairDto, actor: RequestUser) {
    const repair = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.repair.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          description:
            dto.description === undefined
              ? undefined
              : dto.description?.trim() || null,
          priority: dto.priority,
          resultNote:
            dto.resultNote === undefined
              ? undefined
              : dto.resultNote?.trim() || null,
          customerFeedback:
            dto.customerFeedback === undefined
              ? undefined
              : dto.customerFeedback?.trim() || null,
        },
        include: this.defaultInclude(),
      });

      await this.auditLogsService.create(
        {
          action: 'UPDATE',
          entityType: 'Repair',
          entityId: id,
          actor,
          changes: this.pickChangedFields(repair, updated, [
            'title',
            'description',
            'priority',
            'resultNote',
            'customerFeedback',
          ]),
        },
        tx,
      );

      return updated;
    });
  }

  async assign(id: string, dto: AssignRepairDto, actor: RequestUser) {
    if (!dto.engineerId) {
      throw new BadRequestException('engineerId is required');
    }

    const repair = await this.findOne(id);
    await this.ensureEngineerExists(dto.engineerId);

    if (this.isTerminalStatus(repair.status)) {
      throw new BadRequestException('Cannot assign a closed repair');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.repair.update({
        where: { id },
        data: {
          engineerId: dto.engineerId,
          status:
            repair.status === RepairStatus.PENDING
              ? RepairStatus.ASSIGNED
              : repair.status,
          assignedAt: repair.assignedAt ?? new Date(),
        },
        include: this.defaultInclude(),
      });

      await this.auditLogsService.create(
        {
          action: 'ASSIGN',
          entityType: 'Repair',
          entityId: id,
          actor,
          changes: {
            engineerId: {
              from: repair.engineerId,
              to: updated.engineerId,
            },
            status: {
              from: repair.status,
              to: updated.status,
            },
          },
        },
        tx,
      );

      return updated;
    });
  }

  async updateStatus(id: string, dto: UpdateRepairStatusDto, actor: RequestUser) {
    if (!dto.status) {
      throw new BadRequestException('status is required');
    }

    const repair = await this.findOne(id);
    const now = new Date();

    this.ensureStatusTransitionIsAllowed(repair.status, dto.status);

    if (this.statusRequiresEngineer(dto.status) && !repair.engineerId) {
      throw new BadRequestException(
        'Repair must be assigned to an engineer first',
      );
    }

    const updatedRepair = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.repair.update({
        where: { id },
        data: {
          status: dto.status,
          startedAt:
            dto.status === RepairStatus.IN_PROGRESS && !repair.startedAt
              ? now
              : undefined,
          completedAt: dto.status === RepairStatus.COMPLETED ? now : undefined,
          resultNote: dto.resultNote?.trim(),
          customerFeedback: dto.customerFeedback?.trim(),
        },
        include: this.defaultInclude(),
      });

      const machineStatus = this.getMachineStatusForRepairStatus(dto.status);

      if (machineStatus) {
        await tx.machine.update({
          where: { id: repair.machineId },
          data: {
            status: machineStatus,
          },
        });
      }

      await this.auditLogsService.create(
        {
          action: 'STATUS_CHANGE',
          entityType: 'Repair',
          entityId: id,
          actor,
          changes: {
            status: {
              from: repair.status,
              to: updated.status,
            },
            resultNote: {
              from: repair.resultNote,
              to: updated.resultNote,
            },
            customerFeedback: {
              from: repair.customerFeedback,
              to: updated.customerFeedback,
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

    return updatedRepair;
  }

  getStatuses() {
    return Object.values(RepairStatus);
  }

  getPriorities() {
    return Object.values(RepairPriority);
  }

  private validateCreateRepair(dto: CreateRepairDto) {
    if (!dto.title?.trim() || !dto.machineId) {
      throw new BadRequestException('title and machineId are required');
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

  private async generateRepairCode(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const prefix = `RP-${year}${month}${day}`;

    const count = await this.prisma.repair.count({
      where: {
        code: {
          startsWith: prefix,
        },
      },
    });

    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private parseOptionalDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid reportedAt');
    }

    return date;
  }

  private getMachineStatusForRepairStatus(
    status: RepairStatus,
  ): MachineStatus | null {
    if (
      status === RepairStatus.IN_PROGRESS ||
      status === RepairStatus.WAITING_PARTS
    ) {
      return MachineStatus.REPAIRING;
    }

    if (
      status === RepairStatus.COMPLETED ||
      status === RepairStatus.CANCELLED
    ) {
      return MachineStatus.ACTIVE;
    }

    return null;
  }

  private statusRequiresEngineer(status: RepairStatus): boolean {
    return (
      status === RepairStatus.ASSIGNED ||
      status === RepairStatus.IN_PROGRESS ||
      status === RepairStatus.WAITING_PARTS
    );
  }

  private ensureStatusTransitionIsAllowed(
    currentStatus: RepairStatus,
    nextStatus: RepairStatus,
  ) {
    if (currentStatus === nextStatus) {
      return;
    }

    const allowedTransitions: Record<RepairStatus, RepairStatus[]> = {
      [RepairStatus.PENDING]: [RepairStatus.ASSIGNED, RepairStatus.CANCELLED],
      [RepairStatus.ASSIGNED]: [
        RepairStatus.IN_PROGRESS,
        RepairStatus.CANCELLED,
      ],
      [RepairStatus.IN_PROGRESS]: [
        RepairStatus.WAITING_PARTS,
        RepairStatus.COMPLETED,
        RepairStatus.CANCELLED,
      ],
      [RepairStatus.WAITING_PARTS]: [
        RepairStatus.IN_PROGRESS,
        RepairStatus.CANCELLED,
      ],
      [RepairStatus.COMPLETED]: [],
      [RepairStatus.CANCELLED]: [],
    };

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid repair status transition: ${currentStatus} -> ${nextStatus}`,
      );
    }
  }

  private isTerminalStatus(status: RepairStatus): boolean {
    return status === RepairStatus.COMPLETED || status === RepairStatus.CANCELLED;
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

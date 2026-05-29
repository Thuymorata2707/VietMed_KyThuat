import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MachineStatus, RepairPriority, RepairStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssignRepairDto } from './dto/assign-repair.dto';
import { CreateRepairDto } from './dto/create-repair.dto';
import { UpdateRepairStatusDto } from './dto/update-repair-status.dto';
import { UpdateRepairDto } from './dto/update-repair.dto';

@Injectable()
export class RepairsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRepairDto) {
    this.validateCreateRepair(dto);

    await this.ensureMachineExists(dto.machineId);

    if (dto.engineerId) {
      await this.ensureEngineerExists(dto.engineerId);
    }

    return this.prisma.repair.create({
      data: {
        code: await this.generateRepairCode(),
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        machineId: dto.machineId,
        engineerId: dto.engineerId || null,
        priority: dto.priority ?? RepairPriority.NORMAL,
        status: dto.engineerId ? RepairStatus.ASSIGNED : RepairStatus.PENDING,
        reportedAt: this.parseOptionalDate(dto.reportedAt) ?? new Date(),
        assignedAt: dto.engineerId ? new Date() : null,
      },
      include: this.defaultInclude(),
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

  async update(id: string, dto: UpdateRepairDto) {
    await this.findOne(id);

    return this.prisma.repair.update({
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
  }

  async assign(id: string, dto: AssignRepairDto) {
    if (!dto.engineerId) {
      throw new BadRequestException('engineerId is required');
    }

    await this.findOne(id);
    await this.ensureEngineerExists(dto.engineerId);

    return this.prisma.repair.update({
      where: { id },
      data: {
        engineerId: dto.engineerId,
        status: RepairStatus.ASSIGNED,
        assignedAt: new Date(),
      },
      include: this.defaultInclude(),
    });
  }

  async updateStatus(id: string, dto: UpdateRepairStatusDto) {
    if (!dto.status) {
      throw new BadRequestException('status is required');
    }

    const repair = await this.findOne(id);
    const now = new Date();

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

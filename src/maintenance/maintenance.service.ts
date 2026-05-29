import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MachineStatus,
  MaintenanceStatus,
  MaintenanceType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssignMaintenanceDto } from './dto/assign-maintenance.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceStatusDto } from './dto/update-maintenance-status.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMaintenanceDto) {
    this.validateCreateMaintenance(dto);
    await this.ensureMachineExists(dto.machineId);

    if (dto.engineerId) {
      await this.ensureEngineerExists(dto.engineerId);
    }

    return this.prisma.maintenance.create({
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
  }

  findAll() {
    return this.prisma.maintenance.findMany({
      include: this.defaultInclude(),
      orderBy: {
        scheduledDate: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const maintenance = await this.prisma.maintenance.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });

    if (!maintenance) {
      throw new NotFoundException('Maintenance not found');
    }

    return maintenance;
  }

  async update(id: string, dto: UpdateMaintenanceDto) {
    await this.findOne(id);

    return this.prisma.maintenance.update({
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
  }

  async assign(id: string, dto: AssignMaintenanceDto) {
    if (!dto.engineerId) {
      throw new BadRequestException('engineerId is required');
    }

    await this.findOne(id);
    await this.ensureEngineerExists(dto.engineerId);

    return this.prisma.maintenance.update({
      where: { id },
      data: {
        engineerId: dto.engineerId,
        status: MaintenanceStatus.ASSIGNED,
        assignedAt: new Date(),
      },
      include: this.defaultInclude(),
    });
  }

  async updateStatus(id: string, dto: UpdateMaintenanceStatusDto) {
    if (!dto.status) {
      throw new BadRequestException('status is required');
    }

    const maintenance = await this.findOne(id);
    const now = new Date();

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
        await tx.machine.update({
          where: { id: maintenance.machineId },
          data: {
            status: machineStatus,
          },
        });
      }

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

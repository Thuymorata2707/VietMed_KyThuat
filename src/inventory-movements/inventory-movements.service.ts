import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  MachineInventoryStatus,
  MachineStatus,
} from '@prisma/client';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';

@Injectable()
export class InventoryMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInventoryMovementDto, currentUser?: RequestUser) {
    this.validateCreate(dto);

    const machine = await this.prisma.machine.findUnique({
      where: { id: dto.machineId },
    });

    if (!machine) {
      throw new NotFoundException('Machine not found');
    }

    if (dto.customerId) {
      await this.ensureCustomerExists(dto.customerId);
    }

    this.validateMovementBusinessRule(dto);

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.machineInventoryMovement.create({
        data: {
          code: await this.generateMovementCode(),
          type: dto.type,
          machineId: dto.machineId,
          fromStatus: machine.inventoryStatus,
          toStatus: dto.toStatus,
          occurredAt: this.parseOptionalDate(dto.occurredAt) ?? new Date(),
          note: dto.note?.trim() || null,
          customerId: dto.customerId || null,
          createdById: currentUser?.id || null,
        },
        include: this.defaultInclude(),
      });

      await tx.machine.update({
        where: { id: dto.machineId },
        data: {
          inventoryStatus: dto.toStatus,
          customerId:
            dto.toStatus === MachineInventoryStatus.INSTALLED
              ? dto.customerId || machine.customerId
              : machine.customerId,
          installDate:
            dto.toStatus === MachineInventoryStatus.INSTALLED
              ? movement.occurredAt
              : undefined,
          status:
            dto.toStatus === MachineInventoryStatus.INSTALLED
              ? MachineStatus.ACTIVE
              : undefined,
        },
      });

      return movement;
    });
  }

  findAll() {
    return this.prisma.machineInventoryMovement.findMany({
      include: this.defaultInclude(),
      orderBy: {
        occurredAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const movement = await this.prisma.machineInventoryMovement.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });

    if (!movement) {
      throw new NotFoundException('Inventory movement not found');
    }

    return movement;
  }

  getTypes() {
    return Object.values(InventoryMovementType);
  }

  private validateCreate(dto: CreateInventoryMovementDto) {
    if (!dto.machineId || !dto.type || !dto.toStatus) {
      throw new BadRequestException(
        'machineId, type and toStatus are required',
      );
    }
  }

  private validateMovementBusinessRule(dto: CreateInventoryMovementDto) {
    if (dto.type === InventoryMovementType.IMPORT) {
      this.requireToStatus(dto.toStatus, MachineInventoryStatus.IN_STOCK);
    }

    if (dto.type === InventoryMovementType.SPLIT_ACCESSORY) {
      this.requireToStatus(
        dto.toStatus,
        MachineInventoryStatus.ACCESSORY_SPLIT,
      );
    }

    if (dto.type === InventoryMovementType.RESERVE) {
      this.requireToStatus(dto.toStatus, MachineInventoryStatus.RESERVED);
    }

    if (dto.type === InventoryMovementType.RETURN) {
      this.requireToStatus(dto.toStatus, MachineInventoryStatus.RETURNED);
    }

    if (dto.type === InventoryMovementType.SELL) {
      this.requireToStatus(dto.toStatus, MachineInventoryStatus.SOLD);
    }

    if (
      dto.type === InventoryMovementType.INSTALL &&
      dto.toStatus !== MachineInventoryStatus.INSTALLED
    ) {
      throw new BadRequestException(
        'INSTALL movement must set status to INSTALLED',
      );
    }

    if (dto.toStatus === MachineInventoryStatus.INSTALLED && !dto.customerId) {
      throw new BadRequestException(
        'customerId is required when inventory status is INSTALLED',
      );
    }
  }

  private requireToStatus(
    actual: MachineInventoryStatus,
    expected: MachineInventoryStatus,
  ) {
    if (actual !== expected) {
      throw new BadRequestException(`Movement must set status to ${expected}`);
    }
  }

  private async ensureCustomerExists(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new BadRequestException('Customer does not exist');
    }
  }

  private async generateMovementCode(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const prefix = `INV-${year}${month}${day}`;

    const count = await this.prisma.machineInventoryMovement.count({
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
      throw new BadRequestException('Invalid occurredAt');
    }

    return date;
  }

  private defaultInclude() {
    return {
      machine: {
        include: {
          businessLine: true,
          customer: true,
        },
      },
      customer: true,
      createdBy: {
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
        },
      },
    };
  }
}

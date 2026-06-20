import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryMovementType,
  MachineInventoryStatus,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-actions';
import { inventoryMovementAccessWhere } from '../auth/access-scope';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { RequestUser } from '../common/request-user.type';
import {
  getMachineStatusForInventoryStatus,
  validateInventoryMovement,
} from '../machines/machine-state.rules';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';

@Injectable()
export class InventoryMovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateInventoryMovementDto, currentUser?: RequestUser) {
    assertPermission(currentUser, PERMISSIONS.INVENTORY_CREATE);
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

    validateInventoryMovement(
      dto.type,
      machine.inventoryStatus,
      dto.toStatus,
      dto.customerId || machine.customerId,
    );

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
          customerId: this.getNextMachineCustomerId(
            dto.toStatus,
            dto.customerId,
            machine.customerId,
          ),
          installDate:
            dto.toStatus === MachineInventoryStatus.INSTALLED
              ? movement.occurredAt
              : this.shouldClearInstallationFields(dto.toStatus)
                ? null
                : undefined,
          warrantyStartDate: this.shouldClearInstallationFields(dto.toStatus)
            ? null
            : undefined,
          warrantyEndDate: this.shouldClearInstallationFields(dto.toStatus)
            ? null
            : undefined,
          status: getMachineStatusForInventoryStatus(dto.toStatus),
        },
      });

      await this.auditLogsService.create(
        {
          action: AUDIT_ACTIONS.CREATE,
          entityType: 'MachineInventoryMovement',
          entityId: movement.id,
          actor: currentUser,
          metadata: {
            code: movement.code,
            machineId: movement.machineId,
            type: movement.type,
            fromStatus: movement.fromStatus,
            toStatus: movement.toStatus,
            customerId: movement.customerId,
          },
        },
        tx,
      );

      return movement;
    });
  }

  findAll(user?: RequestUser) {
    return this.prisma.machineInventoryMovement.findMany({
      where: inventoryMovementAccessWhere(user),
      include: this.defaultInclude(),
      orderBy: {
        occurredAt: 'desc',
      },
    });
  }

  async findOne(id: string, user?: RequestUser) {
    const movement = await this.prisma.machineInventoryMovement.findFirst({
      where: {
        AND: [{ id }, inventoryMovementAccessWhere(user)],
      },
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

  private getNextMachineCustomerId(
    toStatus: MachineInventoryStatus,
    movementCustomerId?: string | null,
    currentCustomerId?: string | null,
  ) {
    if (
      toStatus === MachineInventoryStatus.INSTALLED ||
      toStatus === MachineInventoryStatus.RESERVED ||
      toStatus === MachineInventoryStatus.SOLD
    ) {
      return movementCustomerId || currentCustomerId || null;
    }

    if (
      toStatus === MachineInventoryStatus.RETURNED ||
      toStatus === MachineInventoryStatus.IN_STOCK ||
      toStatus === MachineInventoryStatus.ACCESSORY_SPLIT
    ) {
      return null;
    }

    return currentCustomerId ?? null;
  }

  private shouldClearInstallationFields(toStatus: MachineInventoryStatus) {
    return (
      toStatus === MachineInventoryStatus.RETURNED ||
      toStatus === MachineInventoryStatus.IN_STOCK ||
      toStatus === MachineInventoryStatus.ACCESSORY_SPLIT ||
      toStatus === MachineInventoryStatus.SOLD
    );
  }

  private validateCreate(dto: CreateInventoryMovementDto) {
    if (!dto.machineId || !dto.type || !dto.toStatus) {
      throw new BadRequestException(
        'machineId, type and toStatus are required',
      );
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
          machineModel: true,
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

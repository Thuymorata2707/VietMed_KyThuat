import { sequenceCode } from '../common/sequence-code';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryMovementType, MachineInventoryStatus, Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-actions';
import { inventoryMovementAccessWhere } from '../auth/access-scope';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { RequestUser } from '../common/request-user.type';
import { PaginatedResult } from '../common/paginated-result.type';
import {
  getMachineStatusForInventoryStatus,
  validateInventoryMovement,
} from '../machines/machine-state.rules';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { ListInventoryMovementsQueryDto } from './dto/list-inventory-movements-query.dto';

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

    await this.ensureMachineCanMove(dto.machineId, dto.type);

    if (dto.customerId) {
      await this.ensureCustomerExists(dto.customerId);
    }

    validateInventoryMovement(
      dto.type,
      machine.inventoryStatus,
      dto.toStatus,
      dto.customerId || machine.customerId,
    );

    return this.prisma.$transaction(
      async (tx) => {
        const movement = await tx.machineInventoryMovement.create({
          data: {
            code: await this.generateMovementCode(tx),
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
      },
      { timeout: 20_000 },
    );
  }

  async findAll(
    query: ListInventoryMovementsQueryDto,
    user?: RequestUser,
  ): Promise<PaginatedResult<unknown>> {
    assertPermission(user, PERMISSIONS.INVENTORY_READ);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.MachineInventoryMovementWhereInput = {
      AND: [
        inventoryMovementAccessWhere(user),
        query.type ? { type: query.type } : {},
        query.search
          ? {
              OR: [
                { code: { contains: query.search } },
                { note: { contains: query.search } },
                { machine: { machineCode: { contains: query.search } } },
                { machine: { serialNumber: { contains: query.search } } },
                { machine: { modelName: { contains: query.search } } },
                { customer: { name: { contains: query.search } } },
                { createdBy: { fullName: { contains: query.search } } },
                { createdBy: { email: { contains: query.search } } },
              ],
            }
          : {},
      ],
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.machineInventoryMovement.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.machineInventoryMovement.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.INVENTORY_READ);
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
      toStatus === MachineInventoryStatus.SOLD ||
      toStatus === MachineInventoryStatus.RETURNED
    ) {
      return movementCustomerId || currentCustomerId || null;
    }

    if (
      toStatus === MachineInventoryStatus.IN_STOCK ||
      toStatus === MachineInventoryStatus.ACCESSORY_SPLIT
    ) {
      return null;
    }

    return currentCustomerId ?? null;
  }

  private shouldClearInstallationFields(toStatus: MachineInventoryStatus) {
    return (
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

    if (dto.type === InventoryMovementType.SELL) {
      throw new BadRequestException(
        'Bán máy cho khách phải tạo phiếu lắp đặt.',
      );
    }
  }

  private async ensureMachineCanMove(
    machineId: string,
    type: InventoryMovementType,
  ) {
    if (type !== InventoryMovementType.SELL) return;

    const splitCount = await this.prisma.machineInventoryMovement.count({
      where: {
        machineId,
        type: InventoryMovementType.SPLIT_ACCESSORY,
      },
    });

    if (splitCount > 0) {
      throw new BadRequestException(
        'Cannot sell a machine after accessories have been split',
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

  private async generateMovementCode(tx: Prisma.TransactionClient): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const prefix = `INV-${year}${month}${day}`;

    return sequenceCode(tx, 'inventory', prefix, 4, false);
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

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessoryStockMovementType, Prisma } from '@prisma/client';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import { generateAccessoryStockMovementCode } from '../common/accessory-stock';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccessoryStockMovementDto } from './dto/create-accessory-stock-movement.dto';
import { ListAccessoryInventoryQueryDto } from './dto/list-accessory-inventory-query.dto';
import { ListAccessoryStockMovementsQueryDto } from './dto/list-accessory-stock-movements-query.dto';

@Injectable()
export class AccessoryInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findStock(
    query: ListAccessoryInventoryQueryDto,
    user?: RequestUser,
  ): Promise<PaginatedResult<unknown>> {
    assertPermission(user, PERMISSIONS.INVENTORY_READ);
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const search = query.search?.trim();
    const where: Prisma.ComponentAccessoryWhereInput = {
      machineModelId: query.machineModelId || undefined,
      componentId: query.componentId || undefined,
      OR: search
        ? [
            { code: { contains: search } },
            { name: { contains: search } },
            { machineModel: { code: { contains: search } } },
            { machineModel: { name: { contains: search } } },
            { machineModel: { displayName: { contains: search } } },
            { component: { name: { contains: search } } },
          ]
        : undefined,
    };

    const [accessories, total] = await this.prisma.$transaction([
      this.prisma.componentAccessory.findMany({
        where,
        include: {
          machineModel: { include: { businessLine: true } },
          component: true,
          stockMovements: {
            select: {
              quantityDelta: true,
              totalCost: true,
              totalPrice: true,
            },
          },
        },
        orderBy: [
          { machineModel: { name: 'asc' } },
          { component: { name: 'asc' } },
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.componentAccessory.count({ where }),
    ]);

    return {
      data: accessories.map((accessory) => {
        const currentStock = accessory.stockMovements.reduce(
          (sum, movement) => sum + Number(movement.quantityDelta),
          0,
        );
        const stockValue = currentStock * Number(accessory.unitCost || 0);
        return {
          ...accessory,
          currentStock,
          stockValue,
          stockMovements: undefined,
        };
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findMovements(
    query: ListAccessoryStockMovementsQueryDto,
    user?: RequestUser,
  ): Promise<PaginatedResult<unknown>> {
    assertPermission(user, PERMISSIONS.INVENTORY_READ);
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const search = query.search?.trim();
    const where: Prisma.AccessoryStockMovementWhereInput = {
      componentAccessoryId: query.componentAccessoryId || undefined,
      machineId: query.machineId || undefined,
      type: query.type,
      OR: search
        ? [
            { code: { contains: search } },
            { serialNumber: { contains: search } },
            { reason: { contains: search } },
            { note: { contains: search } },
            { componentAccessory: { name: { contains: search } } },
            { componentAccessory: { code: { contains: search } } },
            { machine: { serialNumber: { contains: search } } },
            { machine: { machineCode: { contains: search } } },
            { customer: { name: { contains: search } } },
          ]
        : undefined,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.accessoryStockMovement.findMany({
        where,
        include: this.movementInclude(),
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.accessoryStockMovement.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createMovement(
    dto: CreateAccessoryStockMovementDto,
    user?: RequestUser,
  ) {
    assertPermission(user, PERMISSIONS.INVENTORY_CREATE);
    const accessory = await this.prisma.componentAccessory.findUnique({
      where: { id: dto.componentAccessoryId },
    });
    if (!accessory) throw new NotFoundException('Accessory not found');
    if (accessory.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Cannot create movement for an inactive accessory',
      );
    }

    const occurredAt = this.parseDate(dto.occurredAt) ?? new Date();
    const quantityDelta = this.resolveQuantityDelta(dto);
    const quantityAbs = Math.abs(quantityDelta);
    if (accessory.requiresSerial && !dto.serialNumber?.trim()) {
      throw new BadRequestException(
        'Serial number is required for this accessory',
      );
    }
    if (accessory.requiresSerial && quantityAbs !== 1) {
      throw new BadRequestException(
        'Serialized accessories must be moved one at a time',
      );
    }

    const machine = dto.machineId
      ? await this.prisma.machine.findUnique({
          where: { id: dto.machineId },
          select: { id: true, machineModelId: true, customerId: true },
        })
      : null;
    if (dto.machineId && !machine) {
      throw new BadRequestException('Machine does not exist');
    }
    if (machine && machine.machineModelId !== accessory.machineModelId) {
      throw new BadRequestException(
        'Accessory does not belong to the selected machine model',
      );
    }
    if (machine && dto.customerId && machine.customerId !== dto.customerId) {
      throw new BadRequestException(
        'Customer does not belong to the selected machine',
      );
    }

    const movements = await this.prisma.accessoryStockMovement.findMany({
      where: { componentAccessoryId: accessory.id },
      select: { quantityDelta: true, serialNumber: true },
    });
    const currentStock = movements.reduce(
      (sum, movement) => sum + Number(movement.quantityDelta),
      0,
    );
    if (quantityDelta < 0 && currentStock < quantityAbs) {
      throw new BadRequestException(
        `Insufficient stock. Current stock: ${currentStock}`,
      );
    }
    if (
      accessory.requiresSerial &&
      dto.type === AccessoryStockMovementType.EXPORT
    ) {
      const serial = dto.serialNumber!.trim();
      const serialStock = movements
        .filter((movement) => movement.serialNumber === serial)
        .reduce((sum, movement) => sum + Number(movement.quantityDelta), 0);
      if (serialStock < 1) {
        throw new BadRequestException(
          'This serial number is not available in stock',
        );
      }
    }
    const unitCost = dto.unitCost ?? Number(accessory.unitCost || 0);
    const unitPrice = dto.unitPrice ?? Number(accessory.salePrice || 0);

    return this.prisma.accessoryStockMovement.create({
      data: {
        code: await generateAccessoryStockMovementCode(this.prisma, occurredAt),
        type: dto.type,
        componentAccessoryId: dto.componentAccessoryId,
        quantityDelta,
        unit: dto.unit?.trim() || accessory.unit || 'cái',
        serialNumber: dto.serialNumber?.trim() || null,
        unitCost,
        unitPrice,
        totalCost: quantityAbs * unitCost,
        totalPrice: quantityAbs * unitPrice,
        reason: dto.reason?.trim() || this.defaultReason(dto.type),
        note: dto.note?.trim() || null,
        occurredAt,
        machineId: dto.machineId || null,
        customerId: dto.customerId || machine?.customerId || null,
        createdById: user?.id || null,
      },
      include: this.movementInclude(),
    });
  }

  getMovementTypes() {
    return Object.values(AccessoryStockMovementType);
  }

  private movementInclude() {
    return {
      componentAccessory: {
        include: {
          machineModel: { include: { businessLine: true } },
          component: true,
        },
      },
      machine: { include: { customer: true, machineModel: true } },
      customer: true,
      repair: { select: { id: true, code: true, title: true } },
      maintenance: { select: { id: true, code: true, title: true } },
      deviceServiceTicket: {
        select: {
          id: true,
          receiveCode: true,
          returnCode: true,
          deviceName: true,
          modelName: true,
        },
      },
      createdBy: { select: { id: true, fullName: true, email: true } },
    };
  }

  private resolveQuantityDelta(dto: CreateAccessoryStockMovementDto) {
    if (dto.type === AccessoryStockMovementType.IMPORT) {
      return Number(dto.quantity || 0);
    }
    if (dto.type === AccessoryStockMovementType.EXPORT) {
      return -Number(dto.quantity || 0);
    }
    const delta = Number(dto.quantityDelta || 0);
    if (!delta)
      throw new BadRequestException(
        'Adjustment delta must be different from 0',
      );
    return delta;
  }

  private defaultReason(type: AccessoryStockMovementType) {
    if (type === AccessoryStockMovementType.IMPORT) return 'Nhập kho phụ kiện';
    if (type === AccessoryStockMovementType.EXPORT) return 'Xuất kho phụ kiện';
    return 'Điều chỉnh tồn kho phụ kiện';
  }

  private parseDate(value?: string) {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException('Invalid date');
    return date;
  }
}

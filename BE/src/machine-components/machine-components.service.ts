import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessLineStatus, Prisma } from '@prisma/client';
import { PaginatedResult } from '../common/paginated-result.type';
import { normalizeCodeSegment } from '../common/code-format';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComponentAccessoryDto } from './dto/create-component-accessory.dto';
import { CreateMachineComponentDto } from './dto/create-machine-component.dto';
import { ListComponentAccessoriesQueryDto } from './dto/list-component-accessories-query.dto';
import { ListMachineComponentsQueryDto } from './dto/list-machine-components-query.dto';
import { UpdateComponentAccessoryDto } from './dto/update-component-accessory.dto';
import { UpdateMachineComponentDto } from './dto/update-machine-component.dto';

@Injectable()
export class MachineComponentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createComponent(dto: CreateMachineComponentDto) {
    await this.ensureMachineModelExists(dto.machineModelId);
    await this.ensureComponentCodeAvailable(dto.machineModelId, dto.code);

    return this.prisma.machineComponent.create({
      data: {
        machineModelId: dto.machineModelId,
        code: this.normalizeCode(dto.code),
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? BusinessLineStatus.ACTIVE,
      },
      include: this.componentInclude(),
    });
  }

  async findComponents(
    query: ListMachineComponentsQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const search = query.search?.trim();
    const where: Prisma.MachineComponentWhereInput = {
      machineModelId: query.machineModelId,
      status: query.status,
      OR: search
        ? [
            { code: { contains: search } },
            { name: { contains: search } },
            { machineModel: { name: { contains: search } } },
          ]
        : undefined,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.machineComponent.findMany({
        where,
        include: this.componentInclude(),
        orderBy: [
          { machineModel: { name: 'asc' } },
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.machineComponent.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findComponent(id: string) {
    const component = await this.prisma.machineComponent.findUnique({
      where: { id },
      include: this.componentInclude(),
    });

    if (!component) throw new NotFoundException('Machine component not found');
    return component;
  }

  async updateComponent(id: string, dto: UpdateMachineComponentDto) {
    const current = await this.findComponent(id);
    const machineModelId = dto.machineModelId ?? current.machineModelId;
    if (dto.machineModelId)
      await this.ensureMachineModelExists(dto.machineModelId);
    if (dto.code || dto.machineModelId)
      await this.ensureComponentCodeAvailable(
        machineModelId,
        dto.code ?? current.code,
        id,
      );

    return this.prisma.machineComponent.update({
      where: { id },
      data: {
        machineModelId: dto.machineModelId,
        code: dto.code ? this.normalizeCode(dto.code) : undefined,
        name: dto.name?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        sortOrder: dto.sortOrder,
        status: dto.status,
      },
      include: this.componentInclude(),
    });
  }

  async removeComponent(id: string) {
    const component = await this.prisma.machineComponent.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            ComponentAccessory: true,
          },
        },
      },
    });

    if (!component) throw new NotFoundException('Machine component not found');
    if (component._count.ComponentAccessory > 0) {
      throw new BadRequestException('Cannot delete component with accessories');
    }

    await this.prisma.machineComponent.delete({ where: { id } });
    return { deleted: true };
  }

  async createAccessory(dto: CreateComponentAccessoryDto) {
    const componentId = this.normalizeOptionalId(dto.componentId);
    const code =
      dto.code?.trim() ||
      (await this.generateAccessoryCode(dto.machineModelId));

    await this.ensureMachineModelExists(dto.machineModelId);
    await this.ensureComponentBelongsToModel(dto.machineModelId, componentId);
    await this.ensureAccessoryCodeAvailable(dto.machineModelId, code);

    return this.prisma.componentAccessory.create({
      data: {
        machineModelId: dto.machineModelId,
        componentId,
        code: this.normalizeCode(code),
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        quantity: dto.quantity ?? 1,
        requiresSerial: dto.requiresSerial ?? true,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? BusinessLineStatus.ACTIVE,
      },
      include: this.accessoryInclude(),
    });
  }

  previewAccessoryCode(machineModelId: string) {
    return this.generateAccessoryCode(machineModelId);
  }

  async findAccessories(
    query: ListComponentAccessoriesQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const search = query.search?.trim();
    const where: Prisma.ComponentAccessoryWhereInput = {
      machineModelId:
        this.normalizeOptionalId(query.machineModelId) ?? undefined,
      componentId: this.normalizeOptionalId(query.componentId) ?? undefined,
      status: query.status,
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

    const [data, total] = await this.prisma.$transaction([
      this.prisma.componentAccessory.findMany({
        where,
        include: this.accessoryInclude(),
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
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAccessory(id: string) {
    const accessory = await this.prisma.componentAccessory.findUnique({
      where: { id },
      include: this.accessoryInclude(),
    });

    if (!accessory)
      throw new NotFoundException('Component accessory not found');
    return accessory;
  }

  async updateAccessory(id: string, dto: UpdateComponentAccessoryDto) {
    const current = await this.findAccessory(id);
    const machineModelId = dto.machineModelId ?? current.machineModelId;
    const componentId =
      dto.componentId === undefined
        ? undefined
        : this.normalizeOptionalId(dto.componentId);
    const nextCode =
      dto.machineModelId && dto.machineModelId !== current.machineModelId
        ? await this.generateAccessoryCode(dto.machineModelId)
        : undefined;

    if (dto.machineModelId) {
      await this.ensureMachineModelExists(dto.machineModelId);
      await this.ensureComponentBelongsToModel(
        machineModelId,
        componentId === undefined ? (current.componentId ?? null) : componentId,
      );
    } else if (dto.componentId !== undefined) {
      await this.ensureComponentBelongsToModel(machineModelId, componentId);
    }
    if (nextCode)
      await this.ensureAccessoryCodeAvailable(machineModelId, nextCode, id);

    return this.prisma.componentAccessory.update({
      where: { id },
      data: {
        machineModelId: dto.machineModelId,
        componentId,
        code: nextCode ? this.normalizeCode(nextCode) : undefined,
        name: dto.name?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        quantity: dto.quantity,
        requiresSerial: dto.requiresSerial,
        sortOrder: dto.sortOrder,
        status: dto.status,
      },
      include: this.accessoryInclude(),
    });
  }

  async removeAccessory(id: string) {
    const accessory = await this.prisma.componentAccessory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            machineAccessories: true,
          },
        },
      },
    });

    if (!accessory)
      throw new NotFoundException('Component accessory not found');
    if (accessory._count.machineAccessories > 0) {
      throw new BadRequestException('Cannot delete accessory used by machines');
    }

    await this.prisma.componentAccessory.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureMachineModelExists(id: string) {
    const machineModel = await this.prisma.machineModel.findUnique({
      where: { id },
    });
    if (!machineModel)
      throw new BadRequestException('Machine model does not exist');
  }

  private async ensureComponentBelongsToModel(
    machineModelId: string,
    componentId?: string | null,
  ) {
    if (!componentId) return;
    const component = await this.prisma.machineComponent.findUnique({
      where: { id: componentId },
    });
    if (!component)
      throw new BadRequestException('Machine component does not exist');
    if (component.machineModelId !== machineModelId) {
      throw new BadRequestException(
        'Component does not belong to the selected machine model',
      );
    }
  }

  private async ensureComponentCodeAvailable(
    machineModelId: string,
    code: string,
    currentId?: string,
  ) {
    const component = await this.prisma.machineComponent.findUnique({
      where: {
        machineModelId_code: { machineModelId, code: this.normalizeCode(code) },
      },
    });
    if (component && component.id !== currentId)
      throw new ConflictException('Machine component code already exists');
  }

  private async ensureAccessoryCodeAvailable(
    machineModelId: string,
    code: string,
    currentId?: string,
  ) {
    const accessory = await this.prisma.componentAccessory.findUnique({
      where: {
        machineModelId_code: {
          machineModelId,
          code: this.normalizeCode(code),
        },
      },
    });
    if (accessory && accessory.id !== currentId)
      throw new ConflictException('Component accessory code already exists');
  }

  private normalizeCode(code: string) {
    return code.toUpperCase().trim();
  }

  private async generateAccessoryCode(machineModelId: string) {
    const machineModel = await this.prisma.machineModel.findUnique({
      where: { id: machineModelId },
      select: { code: true, name: true },
    });
    const prefix = `${normalizeCodeSegment(machineModel?.code || machineModel?.name, 'PK')}-PK`;
    const latest = await this.prisma.componentAccessory.findFirst({
      where: {
        machineModelId,
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

  private normalizeOptionalId(id?: string | null) {
    const normalized = id?.trim();
    return normalized || null;
  }

  private componentInclude() {
    return {
      machineModel: { include: { businessLine: true } },
      ComponentAccessory: {
        orderBy: [{ sortOrder: 'asc' as const }, { name: 'asc' as const }],
      },
      _count: {
        select: {
          ComponentAccessory: true,
        },
      },
    };
  }

  private accessoryInclude() {
    return {
      machineModel: { include: { businessLine: true } },
      component: true,
      _count: {
        select: {
          machineAccessories: true,
        },
      },
    };
  }
}

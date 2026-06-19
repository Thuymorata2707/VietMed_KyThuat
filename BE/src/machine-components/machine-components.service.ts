import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessLineStatus, Prisma } from '@prisma/client';
import { PaginatedResult } from '../common/paginated-result.type';
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
    await this.findComponent(id);
    await this.prisma.machineComponent.delete({ where: { id } });
    return { deleted: true };
  }

  async createAccessory(dto: CreateComponentAccessoryDto) {
    await this.ensureComponentExists(dto.componentId);
    await this.ensureAccessoryCodeAvailable(dto.componentId, dto.code);

    return this.prisma.componentAccessory.create({
      data: {
        componentId: dto.componentId,
        code: this.normalizeCode(dto.code),
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        requiresSerial: dto.requiresSerial ?? true,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? BusinessLineStatus.ACTIVE,
      },
      include: this.accessoryInclude(),
    });
  }

  async findAccessories(
    query: ListComponentAccessoriesQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const search = query.search?.trim();
    const where: Prisma.ComponentAccessoryWhereInput = {
      componentId: query.componentId,
      status: query.status,
      OR: search
        ? [
            { code: { contains: search } },
            { name: { contains: search } },
            { component: { name: { contains: search } } },
          ]
        : undefined,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.componentAccessory.findMany({
        where,
        include: this.accessoryInclude(),
        orderBy: [
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
    const componentId = dto.componentId ?? current.componentId;
    if (dto.componentId) await this.ensureComponentExists(dto.componentId);
    if (dto.code || dto.componentId)
      await this.ensureAccessoryCodeAvailable(
        componentId,
        dto.code ?? current.code,
        id,
      );

    return this.prisma.componentAccessory.update({
      where: { id },
      data: {
        componentId: dto.componentId,
        code: dto.code ? this.normalizeCode(dto.code) : undefined,
        name: dto.name?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        requiresSerial: dto.requiresSerial,
        sortOrder: dto.sortOrder,
        status: dto.status,
      },
      include: this.accessoryInclude(),
    });
  }

  async removeAccessory(id: string) {
    await this.findAccessory(id);
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

  private async ensureComponentExists(id: string) {
    const component = await this.prisma.machineComponent.findUnique({
      where: { id },
    });
    if (!component)
      throw new BadRequestException('Machine component does not exist');
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
    componentId: string,
    code: string,
    currentId?: string,
  ) {
    const accessory = await this.prisma.componentAccessory.findUnique({
      where: {
        componentId_code: { componentId, code: this.normalizeCode(code) },
      },
    });
    if (accessory && accessory.id !== currentId)
      throw new ConflictException('Component accessory code already exists');
  }

  private normalizeCode(code: string) {
    return code.toUpperCase().trim();
  }

  private componentInclude() {
    return {
      machineModel: { include: { businessLine: true } },
      accessories: {
        orderBy: [{ sortOrder: 'asc' as const }, { name: 'asc' as const }],
      },
    };
  }

  private accessoryInclude() {
    return {
      component: {
        include: {
          machineModel: { include: { businessLine: true } },
        },
      },
    };
  }
}

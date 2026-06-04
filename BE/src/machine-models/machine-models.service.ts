import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessLineStatus,
  MachineProductCategory,
  Prisma,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { pickChangedFields } from '../common/audit-changes';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMachineModelDto } from './dto/create-machine-model.dto';
import { ListMachineModelsQueryDto } from './dto/list-machine-models-query.dto';
import { UpdateMachineModelDto } from './dto/update-machine-model.dto';

@Injectable()
export class MachineModelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateMachineModelDto, actor?: RequestUser) {
    this.validateCreate(dto);
    const businessLine = await this.ensureBusinessLineExists(
      dto.businessLineId,
    );
    await this.ensureCodeIsAvailable(dto.businessLineId, dto.code);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.machineModel.create({
        data: {
          businessLineId: dto.businessLineId,
          code: this.normalizeCode(dto.code),
          name: dto.name.trim(),
          displayName: dto.displayName?.trim() || null,
          status: dto.status ?? BusinessLineStatus.ACTIVE,
          manufacturer:
            dto.manufacturer?.trim() || businessLine.manufacturer || null,
          productCategory: dto.productCategory ?? businessLine.productCategory,
          productLine: dto.productLine?.trim() || null,
          description: dto.description?.trim() || null,
          note: dto.note?.trim() || null,
        },
        include: this.defaultInclude(),
      });

      await this.auditLogsService.create(
        {
          action: 'CREATE',
          entityType: 'MachineModel',
          entityId: created.id,
          actor,
          metadata: {
            code: created.code,
            name: created.name,
            businessLineId: created.businessLineId,
          },
        },
        tx,
      );

      return created;
    });
  }

  async findAll(
    query: ListMachineModelsQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const where = this.buildFindAllWhere(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.machineModel.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [{ businessLine: { name: 'asc' } }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.machineModel.count({ where }),
    ]);

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

  async findOne(id: string) {
    const machineModel = await this.prisma.machineModel.findUnique({
      where: { id },
      include: {
        ...this.defaultInclude(),
        machines: {
          include: {
            customer: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!machineModel) {
      throw new NotFoundException('Machine model not found');
    }

    return machineModel;
  }

  async update(id: string, dto: UpdateMachineModelDto, actor?: RequestUser) {
    const current = await this.findOne(id);
    const businessLineId = dto.businessLineId ?? current.businessLineId;
    const businessLine = dto.businessLineId
      ? await this.ensureBusinessLineExists(dto.businessLineId)
      : current.businessLine;

    if (dto.code || dto.businessLineId) {
      await this.ensureCodeIsAvailable(
        businessLineId,
        dto.code ?? current.code,
        id,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.machineModel.update({
        where: { id },
        data: {
          businessLineId: dto.businessLineId,
          code: dto.code ? this.normalizeCode(dto.code) : undefined,
          name: dto.name?.trim(),
          displayName:
            dto.displayName === undefined
              ? undefined
              : dto.displayName?.trim() || null,
          status: dto.status,
          manufacturer:
            dto.manufacturer === undefined
              ? undefined
              : dto.manufacturer?.trim() || businessLine.manufacturer || null,
          productCategory: dto.productCategory,
          productLine:
            dto.productLine === undefined
              ? undefined
              : dto.productLine?.trim() || null,
          description:
            dto.description === undefined
              ? undefined
              : dto.description?.trim() || null,
          note: dto.note === undefined ? undefined : dto.note?.trim() || null,
        },
        include: this.defaultInclude(),
      });

      await this.auditLogsService.create(
        {
          action: 'UPDATE',
          entityType: 'MachineModel',
          entityId: id,
          actor,
          changes: pickChangedFields(current, updated, [
            'businessLineId',
            'code',
            'name',
            'displayName',
            'status',
            'manufacturer',
            'productCategory',
            'productLine',
            'description',
            'note',
          ]),
        },
        tx,
      );

      return updated;
    });
  }

  async remove(id: string, actor?: RequestUser) {
    const machineModel = await this.prisma.machineModel.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            machines: true,
          },
        },
      },
    });

    if (!machineModel) {
      throw new NotFoundException('Machine model not found');
    }

    if (machineModel._count.machines > 0) {
      throw new BadRequestException(
        'Cannot delete machine model with machines',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.machineModel.delete({ where: { id } });

      await this.auditLogsService.create(
        {
          action: 'DELETE',
          entityType: 'MachineModel',
          entityId: id,
          actor,
          metadata: {
            code: machineModel.code,
            name: machineModel.name,
            businessLineId: machineModel.businessLineId,
          },
        },
        tx,
      );
    });

    return { deleted: true };
  }

  private validateCreate(dto: CreateMachineModelDto) {
    if (!dto.businessLineId || !dto.code?.trim() || !dto.name?.trim()) {
      throw new BadRequestException(
        'businessLineId, code and name are required',
      );
    }
  }

  private async ensureBusinessLineExists(id: string) {
    const businessLine = await this.prisma.businessLine.findUnique({
      where: { id },
    });

    if (!businessLine) {
      throw new BadRequestException('Business line does not exist');
    }

    return businessLine;
  }

  private async ensureCodeIsAvailable(
    businessLineId: string,
    code: string,
    currentId?: string,
  ) {
    const machineModel = await this.prisma.machineModel.findUnique({
      where: {
        businessLineId_code: {
          businessLineId,
          code: this.normalizeCode(code),
        },
      },
    });

    if (machineModel && machineModel.id !== currentId) {
      throw new ConflictException('Machine model code already exists');
    }
  }

  private buildFindAllWhere(
    query: ListMachineModelsQueryDto,
  ): Prisma.MachineModelWhereInput {
    const search = query.search?.trim();

    return {
      businessLineId: query.businessLineId,
      status: query.status,
      productCategory: query.productCategory,
      OR: search
        ? [
            { code: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
            { manufacturer: { contains: search, mode: 'insensitive' } },
            {
              businessLine: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
          ]
        : undefined,
    };
  }

  private normalizeCode(code: string): string {
    return code.toUpperCase().trim();
  }

  private defaultInclude() {
    return {
      businessLine: true,
      _count: {
        select: {
          machines: true,
        },
      },
    };
  }
}

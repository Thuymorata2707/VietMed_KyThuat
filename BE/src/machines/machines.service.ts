import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MachineInventoryStatus,
  MachineProductCategory,
  MachineStatus,
  Prisma,
} from '@prisma/client';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { machineAccessWhere } from '../auth/access-scope';
import { pickChangedFields } from '../common/audit-changes';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMachineDto } from './dto/create-machine.dto';
import { ListMachinesQueryDto } from './dto/list-machines-query.dto';
import { UpdateMachineDto } from './dto/update-machine.dto';
import { validateMachineState } from './machine-state.rules';

@Injectable()
export class MachinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateMachineDto, actor?: RequestUser) {
    this.validateCreateMachine(dto);
    const machineModel = await this.ensureMachineModelExists(
      dto.machineModelId,
    );
    await this.ensureCustomerExists(dto.customerId);
    await this.ensureSerialNumberIsAvailable(dto.serialNumber);
    await this.ensureMachineCodeIsAvailable(dto.machineCode);
    await this.ensureEngineerExists(dto.installedById);
    await this.ensureEngineerExists(dto.primaryEngineerId);
    await this.ensureBusinessLineExists(
      machineModel?.businessLineId ?? dto.businessLineId,
    );

    const status = dto.status ?? MachineStatus.ACTIVE;
    const inventoryStatus =
      dto.inventoryStatus ?? MachineInventoryStatus.IN_STOCK;
    const customerId = dto.customerId || null;

    validateMachineState(status, inventoryStatus, customerId);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.machine.create({
        data: {
          machineCode: dto.machineCode?.trim() || null,
          serialNumber: this.normalizeSerialNumber(dto.serialNumber),
          name: dto.name?.trim() || null,
          imageUrl: dto.imageUrl?.trim() || null,
          modelName: machineModel?.name ?? dto.modelName.trim(),
          version: dto.version?.trim() || null,
          manufacturer:
            machineModel?.manufacturer ?? dto.manufacturer?.trim() ?? '',
          productCategory:
            machineModel?.productCategory ??
            dto.productCategory ??
            MachineProductCategory.OTHER,
          productLine:
            machineModel?.productLine ?? dto.productLine?.trim() ?? null,
          status,
          inventoryStatus,
          manufacturingDate: this.parseOptionalDate(dto.manufacturingDate),
          warehouseImportDate: this.parseOptionalDate(dto.warehouseImportDate),
          installDate: this.parseOptionalDate(dto.installDate),
          warrantyStartDate: this.parseOptionalDate(dto.warrantyStartDate),
          warrantyEndDate: this.parseOptionalDate(dto.warrantyEndDate),
          businessLineId:
            machineModel?.businessLineId ?? dto.businessLineId ?? null,
          machineModelId: machineModel?.id ?? null,
          customerId,
          installedById: dto.installedById || null,
          primaryEngineerId: dto.primaryEngineerId || null,
        },
        include: this.defaultInclude(),
      });

      await this.auditLogsService.create(
        {
          action: 'CREATE',
          entityType: 'Machine',
          entityId: created.id,
          actor,
          metadata: {
            machineCode: created.machineCode,
            serialNumber: created.serialNumber,
            customerId: created.customerId,
            status: created.status,
            inventoryStatus: created.inventoryStatus,
          },
        },
        tx,
      );

      return created;
    });
  }

  async findAll(
    query: ListMachinesQueryDto,
    user?: RequestUser,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.withAccessScope(this.buildFindAllWhere(query), user);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.machine.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.machine.count({ where }),
    ]);

    return this.toPaginatedResult(data, page, limit, total);
  }

  async findOne(id: string, user?: RequestUser) {
    const machine = await this.prisma.machine.findFirst({
      where: this.withAccessScope({ id }, user),
      include: {
        ...this.defaultInclude(),
        repairs: {
          include: {
            engineer: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        inventoryMovements: {
          include: {
            customer: true,
            createdBy: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
          },
          orderBy: {
            occurredAt: 'desc',
          },
        },
        installations: {
          include: {
            customer: true,
            businessLine: true,
            installedBy: {
              select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
              },
            },
            warrantyCard: true,
          },
          orderBy: {
            installedAt: 'desc',
          },
        },
        warrantyCards: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!machine) {
      throw new NotFoundException('Machine not found');
    }

    return machine;
  }

  async findBySerialNumber(serialNumber: string, user?: RequestUser) {
    const machine = await this.prisma.machine.findFirst({
      where: this.withAccessScope(
        {
          serialNumber: this.normalizeSerialNumber(serialNumber),
        },
        user,
      ),
      include: {
        ...this.defaultInclude(),
        repairs: {
          include: {
            engineer: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        maintenances: {
          include: {
            engineer: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
          orderBy: {
            scheduledDate: 'desc',
          },
        },
        inventoryMovements: {
          include: {
            customer: true,
            createdBy: {
              select: {
                id: true,
                email: true,
                fullName: true,
              },
            },
          },
          orderBy: {
            occurredAt: 'desc',
          },
        },
        installations: {
          include: {
            customer: true,
            businessLine: true,
            installedBy: {
              select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
              },
            },
            warrantyCard: true,
          },
          orderBy: {
            installedAt: 'desc',
          },
        },
        warrantyCards: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!machine) {
      throw new NotFoundException('Machine not found');
    }

    return machine;
  }

  async update(id: string, dto: UpdateMachineDto, actor?: RequestUser) {
    const currentMachine = await this.findOne(id);
    const machineModel =
      dto.machineModelId === undefined
        ? undefined
        : await this.ensureMachineModelExists(dto.machineModelId);

    if (dto.customerId) {
      await this.ensureCustomerExists(dto.customerId);
    }

    if (dto.serialNumber) {
      await this.ensureSerialNumberIsAvailable(dto.serialNumber, id);
    }

    if (dto.machineCode) {
      await this.ensureMachineCodeIsAvailable(dto.machineCode, id);
    }

    if (dto.installedById) {
      await this.ensureEngineerExists(dto.installedById);
    }

    if (dto.primaryEngineerId) {
      await this.ensureEngineerExists(dto.primaryEngineerId);
    }

    const nextBusinessLineId =
      machineModel?.businessLineId ??
      (dto.machineModelId === null ? dto.businessLineId : undefined) ??
      dto.businessLineId;

    if (nextBusinessLineId) {
      await this.ensureBusinessLineExists(nextBusinessLineId);
    }

    validateMachineState(
      dto.status ?? currentMachine.status,
      dto.inventoryStatus ?? currentMachine.inventoryStatus,
      dto.customerId === undefined ? currentMachine.customerId : dto.customerId,
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.machine.update({
        where: { id },
        data: {
        machineCode:
          dto.machineCode === undefined
            ? undefined
            : dto.machineCode?.trim() || null,
        serialNumber: dto.serialNumber
          ? this.normalizeSerialNumber(dto.serialNumber)
          : undefined,
        name: dto.name === undefined ? undefined : dto.name?.trim() || null,
        imageUrl:
          dto.imageUrl === undefined ? undefined : dto.imageUrl?.trim() || null,
        modelName: machineModel?.name ?? dto.modelName?.trim(),
        version:
          dto.version === undefined ? undefined : dto.version?.trim() || null,
        manufacturer: machineModel?.manufacturer ?? dto.manufacturer?.trim(),
        productCategory: machineModel?.productCategory ?? dto.productCategory,
        productLine: machineModel
          ? machineModel.productLine
          : dto.productLine === undefined
            ? undefined
            : dto.productLine?.trim() || null,
        status: dto.status,
        inventoryStatus: dto.inventoryStatus,
        manufacturingDate:
          dto.manufacturingDate === undefined
            ? undefined
            : this.parseOptionalDate(dto.manufacturingDate),
        warehouseImportDate:
          dto.warehouseImportDate === undefined
            ? undefined
            : this.parseOptionalDate(dto.warehouseImportDate),
        installDate:
          dto.installDate === undefined
            ? undefined
            : this.parseOptionalDate(dto.installDate),
        warrantyStartDate:
          dto.warrantyStartDate === undefined
            ? undefined
            : this.parseOptionalDate(dto.warrantyStartDate),
        warrantyEndDate:
          dto.warrantyEndDate === undefined
            ? undefined
            : this.parseOptionalDate(dto.warrantyEndDate),
        businessLineId: machineModel
          ? machineModel.businessLineId
          : dto.businessLineId === undefined
            ? undefined
            : dto.businessLineId || null,
        machineModelId:
          dto.machineModelId === undefined
            ? undefined
            : (machineModel?.id ?? null),
        customerId: dto.customerId,
        installedById:
          dto.installedById === undefined
            ? undefined
            : dto.installedById || null,
        primaryEngineerId:
          dto.primaryEngineerId === undefined
            ? undefined
            : dto.primaryEngineerId || null,
        },
        include: this.defaultInclude(),
      });

      await this.auditLogsService.create(
        {
          action: 'UPDATE',
          entityType: 'Machine',
          entityId: id,
          actor,
          changes: pickChangedFields(currentMachine, updated, [
            'machineCode',
            'serialNumber',
            'name',
            'imageUrl',
            'modelName',
            'version',
            'manufacturer',
            'productCategory',
            'productLine',
            'status',
            'inventoryStatus',
            'customerId',
            'businessLineId',
            'machineModelId',
            'installedById',
            'primaryEngineerId',
            'installDate',
            'warrantyStartDate',
            'warrantyEndDate',
          ]),
        },
        tx,
      );

      return updated;
    });
  }

  async setStatus(id: string, status: MachineStatus, actor?: RequestUser) {
    const machine = await this.findOne(id);
    validateMachineState(status, machine.inventoryStatus, machine.customerId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.machine.update({
        where: { id },
        data: { status },
        include: this.defaultInclude(),
      });

      await this.auditLogsService.create(
        {
          action: 'STATUS_CHANGE',
          entityType: 'Machine',
          entityId: id,
          actor,
          changes: {
            status: {
              from: machine.status,
              to: updated.status,
            },
          },
        },
        tx,
      );

      return updated;
    });
  }

  async remove(id: string, actor?: RequestUser) {
    const machine = await this.prisma.machine.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            repairs: true,
          },
        },
      },
    });

    if (!machine) {
      throw new NotFoundException('Machine not found');
    }

    if (machine._count.repairs > 0) {
      throw new BadRequestException('Cannot delete machine with repairs');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.machine.delete({
        where: { id },
      });

      await this.auditLogsService.create(
        {
          action: 'DELETE',
          entityType: 'Machine',
          entityId: id,
          actor,
          metadata: {
            machineCode: machine.machineCode,
            serialNumber: machine.serialNumber,
          },
        },
        tx,
      );
    });

    return { deleted: true };
  }

  getStatuses() {
    return Object.values(MachineStatus);
  }

  getProductCategories() {
    return Object.values(MachineProductCategory);
  }

  getInventoryStatuses() {
    return Object.values(MachineInventoryStatus);
  }

  private validateCreateMachine(dto: CreateMachineDto) {
    if (
      !dto.serialNumber?.trim() ||
      (!dto.machineModelId && !dto.modelName?.trim()) ||
      (!dto.machineModelId && !dto.manufacturer?.trim())
    ) {
      throw new BadRequestException(
        'serialNumber, modelName and manufacturer are required unless machineModelId is provided',
      );
    }

  }

  private async ensureCustomerExists(customerId?: string | null) {
    if (!customerId) {
      return;
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new BadRequestException('Customer does not exist');
    }
  }

  private async ensureSerialNumberIsAvailable(
    serialNumber: string,
    currentMachineId?: string,
  ) {
    const machine = await this.prisma.machine.findUnique({
      where: {
        serialNumber: this.normalizeSerialNumber(serialNumber),
      },
    });

    if (machine && machine.id !== currentMachineId) {
      throw new ConflictException('Serial number already exists');
    }
  }

  private async ensureMachineCodeIsAvailable(
    machineCode?: string | null,
    currentMachineId?: string,
  ) {
    if (!machineCode?.trim()) {
      return;
    }

    const machine = await this.prisma.machine.findUnique({
      where: {
        machineCode: machineCode.trim(),
      },
    });

    if (machine && machine.id !== currentMachineId) {
      throw new ConflictException('Machine code already exists');
    }
  }

  private async ensureEngineerExists(engineerId?: string | null) {
    if (!engineerId) {
      return;
    }

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

  private async ensureBusinessLineExists(businessLineId?: string | null) {
    if (!businessLineId) {
      return;
    }

    const businessLine = await this.prisma.businessLine.findUnique({
      where: { id: businessLineId },
    });

    if (!businessLine) {
      throw new BadRequestException('Business line does not exist');
    }
  }

  private async ensureMachineModelExists(machineModelId?: string | null) {
    if (!machineModelId) {
      return null;
    }

    const machineModel = await this.prisma.machineModel.findUnique({
      where: { id: machineModelId },
      include: {
        businessLine: true,
      },
    });

    if (!machineModel) {
      throw new BadRequestException('Machine model does not exist');
    }

    if (machineModel.status !== 'ACTIVE') {
      throw new BadRequestException('Machine model is inactive');
    }

    return machineModel;
  }

  private normalizeSerialNumber(serialNumber: string): string {
    return serialNumber.toUpperCase().trim();
  }

  private buildFindAllWhere(
    query: ListMachinesQueryDto,
  ): Prisma.MachineWhereInput {
    const search = query.search?.trim();

    const filters: Prisma.MachineWhereInput[] = [];

    if (search) {
      filters.push({
        OR: [
          { machineCode: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { imageUrl: { contains: search, mode: 'insensitive' } },
          { modelName: { contains: search, mode: 'insensitive' } },
          { manufacturer: { contains: search, mode: 'insensitive' } },
          {
            customer: {
              name: { contains: search, mode: 'insensitive' },
            },
          },
        ],
      });
    }

    if (query.engineerId) {
      filters.push({
        OR: [
          { installedById: query.engineerId },
          { primaryEngineerId: query.engineerId },
        ],
      });
    }

    return {
      status: query.status,
      inventoryStatus: query.inventoryStatus,
      productCategory: query.productCategory,
      customerId: query.customerId,
      businessLineId: query.businessLineId,
      machineModelId: query.machineModelId,
      AND: filters.length ? filters : undefined,
    };
  }

  private withAccessScope(
    where: Prisma.MachineWhereInput,
    user?: RequestUser,
  ): Prisma.MachineWhereInput {
    return {
      AND: [where, machineAccessWhere(user)],
    };
  }

  private toPaginatedResult<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
  ): PaginatedResult<T> {
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

  private parseOptionalDate(value?: string | null): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid installDate');
    }

    return date;
  }

  private defaultInclude() {
    return {
      customer: {
        include: {
          region: true,
        },
      },
      businessLine: true,
      machineModel: true,
      installedBy: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          status: true,
          role: true,
          region: true,
          engineerProfile: true,
        },
      },
      primaryEngineer: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          status: true,
          role: true,
          region: true,
          engineerProfile: true,
        },
      },
    };
  }
}

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
  OperationalCreatedSource,
  OperationalDataStatus,
  Prisma,
} from '@prisma/client';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { isEngineer, machineAccessWhere } from '../auth/access-scope';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { pickChangedFields } from '../common/audit-changes';
import { normalizeCodeSegment } from '../common/code-format';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMachineDto } from './dto/create-machine.dto';
import { ListMachinesQueryDto } from './dto/list-machines-query.dto';
import {
  CreateMachineAccessoryDto,
  UpdateMachineAccessoryDto,
} from './dto/machine-accessory.dto';
import {
  UpdateMachineAccessoryItemDto,
  UpdateMachineDto,
} from './dto/update-machine.dto';
import { validateMachineState } from './machine-state.rules';

@Injectable()
export class MachinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateMachineDto, actor?: RequestUser) {
    assertPermission(actor, PERMISSIONS.MACHINE_CREATE);
    const input = this.applyCreateDefaults(dto, actor);
    this.validateCreateMachine(input);
    const machineModel = await this.ensureMachineModelExists(
      input.machineModelId,
    );
    input.machineCode =
      input.machineCode?.trim() ||
      (await this.generateMachineCode(
        machineModel?.code ??
          machineModel?.name ??
          input.modelName ??
          input.name ??
          'MAY',
      ));
    await this.ensureCustomerExists(input.customerId);
    await this.ensureSerialNumberIsAvailable(input.serialNumber);
    await this.ensureMachineCodeIsAvailable(input.machineCode);
    await this.ensureEngineerExists(input.installedById);
    await this.ensureEngineerExists(input.primaryEngineerId);
    await this.ensureBusinessLineExists(
      machineModel?.businessLineId ?? input.businessLineId,
    );
    const accessoryInputs = await this.prepareAccessoryInputs(
      input.accessories ?? [],
      machineModel?.id ?? null,
    );

    const status = input.status ?? MachineStatus.ACTIVE;
    const inventoryStatus =
      input.inventoryStatus ?? MachineInventoryStatus.IN_STOCK;
    const reviewFields = this.resolveCreateReviewFields(input, actor);
    const customerId = input.customerId || null;

    validateMachineState(status, inventoryStatus, customerId);

    return this.prisma.$transaction(
      async (tx) => {
        const created = await tx.machine.create({
          data: {
            machineCode: input.machineCode?.trim() || null,
            serialNumber: this.normalizeSerialNumber(input.serialNumber),
            name: input.name?.trim() || null,
            imageUrl: input.imageUrl?.trim() || null,
            modelName:
              machineModel?.name ??
              input.modelName?.trim() ??
              input.name?.trim() ??
              'Chưa xác định',
            version: input.version?.trim() || null,
            manufacturer:
              machineModel?.manufacturer ?? input.manufacturer?.trim() ?? '',
            productCategory:
              machineModel?.productCategory ??
              input.productCategory ??
              MachineProductCategory.OTHER,
            productLine:
              machineModel?.productLine ?? input.productLine?.trim() ?? null,
            status,
            inventoryStatus,
            dataStatus: reviewFields.dataStatus,
            createdSource: reviewFields.createdSource,
            manufacturingDate: this.parseOptionalDate(input.manufacturingDate),
            warehouseImportDate: this.parseOptionalDate(
              input.warehouseImportDate,
            ),
            installDate: this.parseOptionalDate(input.installDate),
            warrantyStartDate: this.parseOptionalDate(input.warrantyStartDate),
            warrantyEndDate: this.parseOptionalDate(input.warrantyEndDate),
            businessLineId:
              machineModel?.businessLineId ?? input.businessLineId ?? null,
            machineModelId: machineModel?.id ?? null,
            customerId,
            installedById: input.installedById || null,
            primaryEngineerId: input.primaryEngineerId || null,
          },
          include: this.defaultInclude(),
        });

        if (accessoryInputs.length) {
          await tx.machineAccessory.createMany({
            data: accessoryInputs.map((accessory) => ({
              ...accessory,
              machineId: created.id,
            })),
          });
        }
        await this.refreshMachineAccessoriesSnapshot(tx, created.id);

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
              dataStatus: created.dataStatus,
              createdSource: created.createdSource,
            },
          },
          tx,
        );

        return tx.machine.findUnique({
          where: { id: created.id },
          include: {
            ...this.defaultInclude(),
            accessories: this.machineAccessoriesRelationInclude(),
          },
        });
      },
      { timeout: 20_000 },
    );
  }

  async findAll(
    query: ListMachinesQueryDto,
    user?: RequestUser,
  ): Promise<PaginatedResult<unknown>> {
    assertPermission(user, PERMISSIONS.MACHINE_READ);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.withAccessScope(this.buildFindAllWhere(query), user);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.machine.findMany({
        where,
        include: {
          ...this.defaultInclude(),
          accessories: this.machineAccessoriesRelationInclude(),
        },
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
    assertPermission(user, PERMISSIONS.MACHINE_READ);
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
        accessories: this.machineAccessoriesRelationInclude(),
      },
    });

    if (!machine) {
      throw new NotFoundException('Machine not found');
    }

    return machine;
  }

  async findBySerialNumber(serialNumber: string, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.MACHINE_READ);
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
        accessories: this.machineAccessoriesRelationInclude(),
      },
    });

    if (!machine) {
      throw new NotFoundException('Machine not found');
    }

    return machine;
  }

  async findAccessories(machineId: string, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.MACHINE_READ);
    await this.ensureMachineCanBeRead(machineId, user);

    return this.prisma.machineAccessory.findMany({
      where: { machineId },
      include: this.machineAccessoriesInclude(),
      orderBy: [{ name: 'asc' }, { serialNumber: 'asc' }],
    });
  }

  async createAccessory(
    machineId: string,
    dto: CreateMachineAccessoryDto,
    actor?: RequestUser,
  ) {
    assertPermission(actor, PERMISSIONS.MACHINE_UPDATE);
    const machine = await this.ensureMachineCanBeRead(machineId, actor);
    const [accessoryInput] = await this.prepareAccessoryInputs(
      [dto],
      machine.machineModelId,
    );

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.machineAccessory.create({
        data: {
          ...accessoryInput,
          machineId,
        },
        include: this.machineAccessoriesInclude(),
      });
      await this.refreshMachineAccessoriesSnapshot(tx, machineId);

      await this.auditLogsService.create(
        {
          action: 'ADD_ACCESSORY',
          entityType: 'Machine',
          entityId: machineId,
          actor,
          metadata: {
            accessoryId: created.id,
            name: created.name,
            serialNumber: created.serialNumber,
          },
        },
        tx,
      );

      return created;
    });
  }

  async updateAccessory(
    machineId: string,
    accessoryId: string,
    dto: UpdateMachineAccessoryDto,
    actor?: RequestUser,
  ) {
    assertPermission(actor, PERMISSIONS.MACHINE_UPDATE);
    const machine = await this.ensureMachineCanBeRead(machineId, actor);
    const current = await this.prisma.machineAccessory.findFirst({
      where: { id: accessoryId, machineId },
      include: this.machineAccessoriesInclude(),
    });

    if (!current) {
      throw new NotFoundException('Machine accessory not found');
    }

    const componentAccessory =
      dto.componentAccessoryId === undefined
        ? undefined
        : await this.ensureComponentAccessoryBelongsToModel(
            dto.componentAccessoryId,
            machine.machineModelId,
          );

    const nextSerialNumber =
      dto.serialNumber === undefined
        ? undefined
        : this.normalizeOptionalSerialNumber(dto.serialNumber);

    if (nextSerialNumber) {
      await this.ensureAccessorySerialNumberIsAvailable(
        nextSerialNumber,
        accessoryId,
      );
    }

    const nextName =
      dto.name?.trim() ||
      componentAccessory?.name ||
      (dto.componentAccessoryId === null ? current.name : undefined);

    if (dto.componentAccessoryId === null && !nextName?.trim()) {
      throw new BadRequestException('Accessory name is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.machineAccessory.update({
        where: { id: accessoryId },
        data: {
          componentAccessoryId:
            dto.componentAccessoryId === undefined
              ? undefined
              : (componentAccessory?.id ?? null),
          code:
            dto.code === undefined
              ? componentAccessory?.code
              : dto.code?.trim() || null,
          name: nextName,
          serialNumber: nextSerialNumber,
          description:
            dto.description === undefined
              ? undefined
              : dto.description?.trim() || null,
          note: dto.note === undefined ? undefined : dto.note?.trim() || null,
        },
        include: this.machineAccessoriesInclude(),
      });
      await this.refreshMachineAccessoriesSnapshot(tx, machineId);

      await this.auditLogsService.create(
        {
          action: 'UPDATE_ACCESSORY',
          entityType: 'Machine',
          entityId: machineId,
          actor,
          changes: pickChangedFields(current, updated, [
            'componentAccessoryId',
            'code',
            'name',
            'serialNumber',
            'description',
            'note',
          ]),
        },
        tx,
      );

      return updated;
    });
  }

  async removeAccessory(
    machineId: string,
    accessoryId: string,
    actor?: RequestUser,
  ) {
    assertPermission(actor, PERMISSIONS.MACHINE_UPDATE);
    await this.ensureMachineCanBeRead(machineId, actor);
    const accessory = await this.prisma.machineAccessory.findFirst({
      where: { id: accessoryId, machineId },
    });

    if (!accessory) {
      throw new NotFoundException('Machine accessory not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.machineAccessory.delete({ where: { id: accessoryId } });
      await this.refreshMachineAccessoriesSnapshot(tx, machineId);

      await this.auditLogsService.create(
        {
          action: 'REMOVE_ACCESSORY',
          entityType: 'Machine',
          entityId: machineId,
          actor,
          metadata: {
            accessoryId,
            name: accessory.name,
            serialNumber: accessory.serialNumber,
          },
        },
        tx,
      );
    });

    return { deleted: true };
  }

  async update(id: string, dto: UpdateMachineDto, actor?: RequestUser) {
    assertPermission(actor, PERMISSIONS.MACHINE_UPDATE);
    const currentMachine = await this.findOne(id, actor);
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

    const nextInstallDate =
      dto.installDate === undefined
        ? undefined
        : this.parseOptionalDate(dto.installDate);
    const nextWarrantyStartDate =
      dto.warrantyStartDate === undefined
        ? undefined
        : this.parseOptionalDate(dto.warrantyStartDate);
    const nextWarrantyEndDate =
      dto.warrantyEndDate === undefined
        ? undefined
        : this.parseOptionalDate(dto.warrantyEndDate);
    const effectiveWarrantyStartDate =
      nextWarrantyStartDate === undefined
        ? currentMachine.warrantyStartDate
        : nextWarrantyStartDate;
    const effectiveWarrantyEndDate =
      nextWarrantyEndDate === undefined
        ? currentMachine.warrantyEndDate
        : nextWarrantyEndDate;

    if (
      effectiveWarrantyStartDate &&
      effectiveWarrantyEndDate &&
      effectiveWarrantyEndDate < effectiveWarrantyStartDate
    ) {
      throw new BadRequestException(
        'warrantyEndDate must be after warrantyStartDate',
      );
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
          machineCode: undefined,
          serialNumber: dto.serialNumber
            ? this.normalizeSerialNumber(dto.serialNumber)
            : undefined,
          name: dto.name === undefined ? undefined : dto.name?.trim() || null,
          imageUrl:
            dto.imageUrl === undefined
              ? undefined
              : dto.imageUrl?.trim() || null,
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
          dataStatus: dto.dataStatus,
          createdSource: dto.createdSource,
          manufacturingDate:
            dto.manufacturingDate === undefined
              ? undefined
              : this.parseOptionalDate(dto.manufacturingDate),
          warehouseImportDate:
            dto.warehouseImportDate === undefined
              ? undefined
              : this.parseOptionalDate(dto.warehouseImportDate),
          installDate: nextInstallDate,
          warrantyStartDate: nextWarrantyStartDate,
          warrantyEndDate: nextWarrantyEndDate,
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

      if (dto.accessories !== undefined) {
        await this.syncMachineAccessories(
          tx,
          id,
          updated.machineModelId,
          dto.accessories,
        );
        await this.refreshMachineAccessoriesSnapshot(tx, id);
      }

      if (
        dto.warrantyStartDate !== undefined ||
        dto.warrantyEndDate !== undefined
      ) {
        await this.syncLatestInstallationWarrantyCard(tx, id, updated, actor);
      }

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
            'dataStatus',
            'createdSource',
            'customerId',
            'businessLineId',
            'machineModelId',
            'installedById',
            'primaryEngineerId',
            'installDate',
            'warrantyStartDate',
            'warrantyEndDate',
          ]),
          metadata:
            dto.accessories === undefined
              ? undefined
              : {
                  accessoriesCount: dto.accessories.length,
                },
        },
        tx,
      );

      return tx.machine.findUnique({
        where: { id },
        include: {
          ...this.defaultInclude(),
          accessories: this.machineAccessoriesRelationInclude(),
        },
      });
    });
  }

  async setStatus(id: string, status: MachineStatus, actor?: RequestUser) {
    assertPermission(actor, PERMISSIONS.MACHINE_STATUS_UPDATE);
    const machine = await this.findOne(id, actor);
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
    assertPermission(actor, PERMISSIONS.MACHINE_DELETE);
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
      (!dto.machineModelId && !dto.modelName?.trim() && !dto.name?.trim())
    ) {
      throw new BadRequestException(
        'serialNumber and modelName are required unless machineModelId is provided',
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

  private async generateMachineCode(source: string) {
    const prefix = this.normalizeMachineCodePrefix(source);
    const latest = await this.prisma.machine.findFirst({
      where: {
        machineCode: {
          startsWith: `${prefix}-`,
        },
      },
      orderBy: {
        machineCode: 'desc',
      },
      select: {
        machineCode: true,
      },
    });
    const latestNumber = latest?.machineCode
      ? Number(latest.machineCode.slice(prefix.length + 1))
      : 0;
    const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 1;

    return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
  }

  private normalizeMachineCodePrefix(value: string) {
    return normalizeCodeSegment(value, 'MAY');
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

  private async ensureMachineCanBeRead(id: string, user?: RequestUser) {
    const machine = await this.prisma.machine.findFirst({
      where: this.withAccessScope({ id }, user),
      select: {
        id: true,
        machineModelId: true,
      },
    });

    if (!machine) {
      throw new NotFoundException('Machine not found');
    }

    return machine;
  }

  private async prepareAccessoryInputs(
    accessories: CreateMachineAccessoryDto[],
    machineModelId: string | null,
  ): Promise<Array<Omit<Prisma.MachineAccessoryCreateManyInput, 'machineId'>>> {
    const prepared: Array<
      Omit<Prisma.MachineAccessoryCreateManyInput, 'machineId'>
    > = [];

    for (const accessory of accessories) {
      const componentAccessory =
        await this.ensureComponentAccessoryBelongsToModel(
          accessory.componentAccessoryId,
          machineModelId,
        );
      const serialNumber = this.normalizeOptionalSerialNumber(
        accessory.serialNumber,
      );

      if (serialNumber) {
        await this.ensureAccessorySerialNumberIsAvailable(serialNumber);
      }

      const name = accessory.name?.trim() || componentAccessory?.name;

      if (!name) {
        throw new BadRequestException('Accessory name is required');
      }

      prepared.push({
        componentAccessoryId: componentAccessory?.id ?? null,
        code: accessory.code?.trim() || componentAccessory?.code || null,
        name,
        serialNumber,
        description: accessory.description?.trim() || null,
        note: accessory.note?.trim() || null,
      });
    }

    return prepared;
  }

  private async syncMachineAccessories(
    tx: Prisma.TransactionClient,
    machineId: string,
    machineModelId: string | null,
    accessories: UpdateMachineAccessoryItemDto[],
  ) {
    const currentAccessories = await tx.machineAccessory.findMany({
      where: { machineId },
    });
    const currentById = new Map(
      currentAccessories.map((accessory) => [accessory.id, accessory]),
    );
    const nextIds = new Set(
      accessories
        .map((accessory) => ('id' in accessory ? accessory.id : undefined))
        .filter((id): id is string => Boolean(id)),
    );

    const accessoriesToDelete = currentAccessories.filter(
      (accessory) => !nextIds.has(accessory.id),
    );

    if (accessoriesToDelete.length) {
      await tx.machineAccessory.deleteMany({
        where: {
          machineId,
          id: {
            in: accessoriesToDelete.map((accessory) => accessory.id),
          },
        },
      });
    }

    for (const accessory of accessories) {
      const accessoryId = 'id' in accessory ? accessory.id : undefined;

      if (!accessoryId) {
        const [preparedAccessory] = await this.prepareAccessoryInputs(
          [accessory],
          machineModelId,
        );

        await tx.machineAccessory.create({
          data: {
            ...preparedAccessory,
            machineId,
          },
        });
        continue;
      }

      const current = currentById.get(accessoryId);
      if (!current) {
        throw new BadRequestException(
          'Machine accessory does not belong to this machine',
        );
      }

      const componentAccessory =
        accessory.componentAccessoryId === undefined
          ? undefined
          : await this.ensureComponentAccessoryBelongsToModel(
              accessory.componentAccessoryId,
              machineModelId,
            );

      const nextSerialNumber =
        accessory.serialNumber === undefined
          ? undefined
          : this.normalizeOptionalSerialNumber(accessory.serialNumber);

      if (nextSerialNumber) {
        await this.ensureAccessorySerialNumberIsAvailable(
          nextSerialNumber,
          accessoryId,
        );
      }

      const nextName =
        accessory.name?.trim() ||
        componentAccessory?.name ||
        (accessory.componentAccessoryId === undefined
          ? current.name
          : undefined);

      if (!nextName?.trim()) {
        throw new BadRequestException('Accessory name is required');
      }

      await tx.machineAccessory.update({
        where: { id: accessoryId },
        data: {
          componentAccessoryId:
            accessory.componentAccessoryId === undefined
              ? undefined
              : (componentAccessory?.id ?? null),
          code:
            accessory.code === undefined
              ? componentAccessory?.code
              : accessory.code?.trim() || null,
          name: nextName,
          serialNumber: nextSerialNumber,
          description:
            accessory.description === undefined
              ? undefined
              : accessory.description?.trim() || null,
          note:
            accessory.note === undefined
              ? undefined
              : accessory.note?.trim() || null,
        },
      });
    }
  }

  private async refreshMachineAccessoriesSnapshot(
    tx: Prisma.TransactionClient,
    machineId: string,
  ) {
    const accessories = await tx.machineAccessory.findMany({
      where: { machineId },
      orderBy: [{ name: 'asc' }, { serialNumber: 'asc' }],
      select: {
        id: true,
        componentAccessoryId: true,
        code: true,
        name: true,
        serialNumber: true,
        description: true,
        note: true,
      },
    });

    await tx.machine.update({
      where: { id: machineId },
      data: {
        accessoriesSnapshot: accessories.map((accessory) => ({
          id: accessory.id,
          componentAccessoryId: accessory.componentAccessoryId,
          code: accessory.code,
          name: accessory.name,
          serialNumber: accessory.serialNumber,
          description: accessory.description,
          note: accessory.note,
        })) as Prisma.InputJsonValue,
      },
    });
  }

  private async syncLatestInstallationWarrantyCard(
    tx: Prisma.TransactionClient,
    machineId: string,
    machine: {
      customerId?: string | null;
      installDate?: Date | null;
      warrantyStartDate?: Date | null;
      warrantyEndDate?: Date | null;
    },
    actor?: RequestUser,
  ) {
    const latestInstallation = await tx.machineInstallation.findFirst({
      where: { machineId },
      include: { warrantyCard: true },
      orderBy: { installedAt: 'desc' },
    });

    if (!latestInstallation) return;

    if (!machine.warrantyEndDate) {
      if (latestInstallation.warrantyCard) {
        await tx.warrantyCard.delete({
          where: { installationId: latestInstallation.id },
        });
      }
      return;
    }

    const startDate =
      machine.warrantyStartDate ??
      latestInstallation.warrantyCard?.startDate ??
      machine.installDate ??
      latestInstallation.installedAt;

    if (machine.warrantyEndDate < startDate) {
      throw new BadRequestException(
        'warrantyEndDate must be after warrantyStartDate',
      );
    }

    if (latestInstallation.warrantyCard) {
      await tx.warrantyCard.update({
        where: { installationId: latestInstallation.id },
        data: {
          machineId,
          customerId: machine.customerId ?? latestInstallation.customerId,
          startDate,
          endDate: machine.warrantyEndDate,
        },
      });
      return;
    }

    await tx.warrantyCard.create({
      data: {
        code: await this.generateWarrantyCode(tx),
        installationId: latestInstallation.id,
        machineId,
        customerId: machine.customerId ?? latestInstallation.customerId,
        issuedAt: new Date(),
        startDate,
        endDate: machine.warrantyEndDate,
        issuedById: actor?.id || null,
        issuedByEmail: actor?.email || null,
      },
    });
  }

  private async generateWarrantyCode(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const prefix = this.getDailyCodePrefix('WAR');
    const latest = await tx.warrantyCard.findFirst({
      where: {
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

    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
  }

  private getDailyCodePrefix(prefix: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${prefix}-${year}${month}${day}`;
  }

  private async ensureComponentAccessoryBelongsToModel(
    componentAccessoryId?: string | null,
    machineModelId?: string | null,
  ) {
    if (!componentAccessoryId) {
      return null;
    }

    const componentAccessory = await this.prisma.componentAccessory.findUnique({
      where: { id: componentAccessoryId },
    });

    if (!componentAccessory) {
      throw new BadRequestException('Component accessory does not exist');
    }

    if (
      machineModelId &&
      componentAccessory.machineModelId !== machineModelId
    ) {
      throw new BadRequestException(
        'Component accessory does not belong to this machine model',
      );
    }

    return componentAccessory;
  }

  private async ensureAccessorySerialNumberIsAvailable(
    serialNumber: string,
    currentAccessoryId?: string,
  ) {
    const accessory = await this.prisma.machineAccessory.findUnique({
      where: { serialNumber },
    });

    if (accessory && accessory.id !== currentAccessoryId) {
      throw new ConflictException('Accessory serial number already exists');
    }
  }

  private normalizeSerialNumber(serialNumber: string): string {
    return serialNumber.toUpperCase().trim();
  }

  private applyCreateDefaults(
    dto: CreateMachineDto,
    actor?: RequestUser,
  ): CreateMachineDto {
    if (!isEngineer(actor)) {
      return dto;
    }

    return {
      ...dto,
      primaryEngineerId: dto.primaryEngineerId || actor.id,
      installedById: dto.installedById || undefined,
    };
  }

  private resolveCreateReviewFields(
    dto: CreateMachineDto,
    actor?: RequestUser,
  ) {
    if (isEngineer(actor)) {
      return {
        dataStatus: OperationalDataStatus.PENDING_REVIEW,
        createdSource: OperationalCreatedSource.ENGINEER,
      };
    }

    if (dto.dataStatus || dto.createdSource) {
      return {
        dataStatus: dto.dataStatus ?? OperationalDataStatus.VERIFIED,
        createdSource: dto.createdSource ?? OperationalCreatedSource.ADMIN,
      };
    }

    return {
      dataStatus: OperationalDataStatus.VERIFIED,
      createdSource: OperationalCreatedSource.ADMIN,
    };
  }

  private normalizeOptionalSerialNumber(serialNumber?: string | null) {
    return serialNumber?.trim()
      ? this.normalizeSerialNumber(serialNumber)
      : null;
  }

  private buildFindAllWhere(
    query: ListMachinesQueryDto,
  ): Prisma.MachineWhereInput {
    const search = query.search?.trim();

    const filters: Prisma.MachineWhereInput[] = [];

    if (search) {
      filters.push({
        OR: [
          { machineCode: { contains: search } },
          { serialNumber: { contains: search } },
          { name: { contains: search } },
          { imageUrl: { contains: search } },
          { modelName: { contains: search } },
          { manufacturer: { contains: search } },
          {
            customer: {
              name: { contains: search },
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
      dataStatus: query.dataStatus,
      createdSource: query.createdSource,
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
    if (where.inventoryStatus === 'IN_STOCK') {
      return where;
    }
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
      businessLine: {
        include: {
          productIndustry: true,
        },
      },
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
      _count: {
        select: {
          accessories: true,
        },
      },
    };
  }

  private machineAccessoriesInclude() {
    return {
      componentAccessory: {
        include: {
          component: {
            include: {
              machineModel: true,
            },
          },
        },
      },
    };
  }

  private machineAccessoriesRelationInclude() {
    return {
      include: this.machineAccessoriesInclude(),
      orderBy: [{ name: 'asc' as const }, { serialNumber: 'asc' as const }],
    };
  }
}

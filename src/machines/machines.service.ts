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
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMachineDto } from './dto/create-machine.dto';
import { UpdateMachineDto } from './dto/update-machine.dto';

@Injectable()
export class MachinesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMachineDto) {
    this.validateCreateMachine(dto);
    await this.ensureCustomerExists(dto.customerId);
    await this.ensureSerialNumberIsAvailable(dto.serialNumber);
    await this.ensureMachineCodeIsAvailable(dto.machineCode);
    await this.ensureEngineerExists(dto.installedById);
    await this.ensureEngineerExists(dto.primaryEngineerId);
    await this.ensureBusinessLineExists(dto.businessLineId);

    return this.prisma.machine.create({
      data: {
        machineCode: dto.machineCode?.trim() || null,
        serialNumber: this.normalizeSerialNumber(dto.serialNumber),
        name: dto.name?.trim() || null,
        modelName: dto.modelName.trim(),
        version: dto.version?.trim() || null,
        manufacturer: dto.manufacturer.trim(),
        productCategory: dto.productCategory ?? MachineProductCategory.OTHER,
        productLine: dto.productLine?.trim() || null,
        status: dto.status ?? MachineStatus.ACTIVE,
        inventoryStatus: dto.inventoryStatus ?? MachineInventoryStatus.IN_STOCK,
        manufacturingDate: this.parseOptionalDate(dto.manufacturingDate),
        warehouseImportDate: this.parseOptionalDate(dto.warehouseImportDate),
        installDate: this.parseOptionalDate(dto.installDate),
        warrantyStartDate: this.parseOptionalDate(dto.warrantyStartDate),
        warrantyEndDate: this.parseOptionalDate(dto.warrantyEndDate),
        businessLineId: dto.businessLineId || null,
        customerId: dto.customerId || null,
        installedById: dto.installedById || null,
        primaryEngineerId: dto.primaryEngineerId || null,
      },
      include: this.defaultInclude(),
    });
  }

  findAll() {
    return this.prisma.machine.findMany({
      include: this.defaultInclude(),
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id },
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
      },
    });

    if (!machine) {
      throw new NotFoundException('Machine not found');
    }

    return machine;
  }

  async update(id: string, dto: UpdateMachineDto) {
    const currentMachine = await this.findOne(id);

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

    if (dto.businessLineId) {
      await this.ensureBusinessLineExists(dto.businessLineId);
    }

    if (
      dto.inventoryStatus === MachineInventoryStatus.INSTALLED &&
      !dto.customerId &&
      !currentMachine.customerId
    ) {
      throw new BadRequestException(
        'customerId is required when inventoryStatus is INSTALLED',
      );
    }

    return this.prisma.machine.update({
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
        modelName: dto.modelName?.trim(),
        version:
          dto.version === undefined ? undefined : dto.version?.trim() || null,
        manufacturer: dto.manufacturer?.trim(),
        productCategory: dto.productCategory,
        productLine:
          dto.productLine === undefined
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
        businessLineId:
          dto.businessLineId === undefined
            ? undefined
            : dto.businessLineId || null,
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
  }

  async setStatus(id: string, status: MachineStatus) {
    await this.findOne(id);

    return this.prisma.machine.update({
      where: { id },
      data: { status },
      include: this.defaultInclude(),
    });
  }

  async remove(id: string) {
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

    await this.prisma.machine.delete({
      where: { id },
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
      !dto.modelName?.trim() ||
      !dto.manufacturer?.trim()
    ) {
      throw new BadRequestException(
        'serialNumber, modelName and manufacturer are required',
      );
    }

    if (
      dto.inventoryStatus === MachineInventoryStatus.INSTALLED &&
      !dto.customerId
    ) {
      throw new BadRequestException(
        'customerId is required when inventoryStatus is INSTALLED',
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

  private normalizeSerialNumber(serialNumber: string): string {
    return serialNumber.toUpperCase().trim();
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

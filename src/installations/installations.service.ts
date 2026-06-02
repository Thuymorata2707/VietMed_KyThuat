import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InstallationStatus,
  InventoryMovementType,
  MachineInventoryStatus,
  MachineStatus,
  Prisma,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { installationAccessWhere } from '../auth/access-scope';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import { validateInventoryMovement } from '../machines/machine-state.rules';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInstallationDto } from './dto/create-installation.dto';
import { ListInstallationsQueryDto } from './dto/list-installations-query.dto';

@Injectable()
export class InstallationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateInstallationDto, actor: RequestUser) {
    this.validateCreate(dto);

    const [machine, customer, engineer, businessLine] = await Promise.all([
      this.findMachine(dto.machineId),
      this.findCustomer(dto.customerId),
      this.findEngineer(dto.installedById),
      this.findBusinessLine(dto.businessLineId),
    ]);

    if (machine.inventoryStatus === MachineInventoryStatus.INSTALLED) {
      throw new BadRequestException('Machine is already installed');
    }

    validateInventoryMovement(
      InventoryMovementType.INSTALL,
      machine.inventoryStatus,
      MachineInventoryStatus.INSTALLED,
      customer.id,
    );

    const installedAt = this.parseRequiredDate(dto.installedAt, 'installedAt');
    const warrantyStartDate =
      this.parseOptionalDate(dto.warrantyStartDate, 'warrantyStartDate') ??
      installedAt;
    const warrantyEndDate = this.parseRequiredDate(
      dto.warrantyEndDate,
      'warrantyEndDate',
    );

    if (warrantyEndDate < warrantyStartDate) {
      throw new BadRequestException(
        'warrantyEndDate must be after warrantyStartDate',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const installationCode = await this.generateInstallationCode(tx);
      const warrantyCode = await this.generateWarrantyCode(tx);

      const installation = await tx.machineInstallation.create({
        data: {
          code: installationCode,
          status: InstallationStatus.INSTALLED,
          machineId: machine.id,
          customerId: customer.id,
          businessLineId: businessLine?.id ?? machine.businessLineId ?? null,
          installedById: engineer.id,
          installedAt,
          accessories: this.normalizeAccessories(dto.accessories),
          note: dto.note?.trim() || null,
        },
      });

      await tx.warrantyCard.create({
        data: {
          code: warrantyCode,
          installationId: installation.id,
          machineId: machine.id,
          customerId: customer.id,
          issuedAt: new Date(),
          startDate: warrantyStartDate,
          endDate: warrantyEndDate,
          note: dto.warrantyNote?.trim() || null,
          issuedById: actor?.id || null,
          issuedByEmail: actor?.email || null,
        },
      });

      await tx.machineInventoryMovement.create({
        data: {
          code: await this.generateMovementCode(tx),
          type: InventoryMovementType.INSTALL,
          machineId: machine.id,
          fromStatus: machine.inventoryStatus,
          toStatus: MachineInventoryStatus.INSTALLED,
          occurredAt: installedAt,
          note: `Installed by ${engineer.fullName}`,
          customerId: customer.id,
          createdById: actor?.id || null,
        },
      });

      await tx.machine.update({
        where: { id: machine.id },
        data: {
          customerId: customer.id,
          businessLineId: businessLine?.id ?? machine.businessLineId,
          installedById: engineer.id,
          primaryEngineerId: machine.primaryEngineerId ?? engineer.id,
          installDate: installedAt,
          warrantyStartDate,
          warrantyEndDate,
          inventoryStatus: MachineInventoryStatus.INSTALLED,
          status: MachineStatus.ACTIVE,
        },
      });

      await this.auditLogsService.create(
        {
          action: 'CREATE_INSTALLATION',
          entityType: 'MachineInstallation',
          entityId: installation.id,
          actor,
          metadata: {
            code: installationCode,
            machineId: machine.id,
            serialNumber: machine.serialNumber,
            customerId: customer.id,
            installedById: engineer.id,
            warrantyCode,
          },
        },
        tx,
      );

      const created = await tx.machineInstallation.findUnique({
        where: { id: installation.id },
        include: this.defaultInclude(),
      });

      return created;
    });
  }

  async findAll(
    query: ListInstallationsQueryDto,
    user?: RequestUser,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.withAccessScope(this.buildFindAllWhere(query), user);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.machineInstallation.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: {
          installedAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.machineInstallation.count({ where }),
    ]);

    return this.toPaginatedResult(data, page, limit, total);
  }

  async findOne(id: string, user?: RequestUser) {
    const installation = await this.prisma.machineInstallation.findFirst({
      where: this.withAccessScope({ id }, user),
      include: this.defaultInclude(),
    });

    if (!installation) {
      throw new NotFoundException('Installation not found');
    }

    return installation;
  }

  getStatuses() {
    return Object.values(InstallationStatus);
  }

  private validateCreate(dto: CreateInstallationDto) {
    if (
      !dto.machineId ||
      !dto.customerId ||
      !dto.installedAt ||
      !dto.installedById ||
      !dto.warrantyEndDate
    ) {
      throw new BadRequestException(
        'machineId, customerId, installedAt, installedById and warrantyEndDate are required',
      );
    }
  }

  private async findMachine(machineId: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        businessLine: true,
      },
    });

    if (!machine) {
      throw new BadRequestException('Machine does not exist');
    }

    return machine;
  }

  private async findCustomer(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new BadRequestException('Customer does not exist');
    }

    return customer;
  }

  private async findEngineer(engineerId: string) {
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
      throw new BadRequestException('Installed by user must be an engineer');
    }

    return engineer;
  }

  private async findBusinessLine(businessLineId?: string | null) {
    if (!businessLineId) {
      return null;
    }

    const businessLine = await this.prisma.businessLine.findUnique({
      where: { id: businessLineId },
    });

    if (!businessLine) {
      throw new BadRequestException('Business line does not exist');
    }

    return businessLine;
  }

  private normalizeAccessories(accessories?: string[]): string[] {
    if (!accessories?.length) {
      return [];
    }

    return accessories
      .map((accessory) => accessory.trim())
      .filter((accessory) => accessory.length > 0);
  }

  private parseRequiredDate(value: string, fieldName: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }

    return date;
  }

  private parseOptionalDate(
    value: string | null | undefined,
    fieldName: string,
  ): Date | null {
    if (!value) {
      return null;
    }

    return this.parseRequiredDate(value, fieldName);
  }

  private buildFindAllWhere(
    query: ListInstallationsQueryDto,
  ): Prisma.MachineInstallationWhereInput {
    const search = query.search?.trim();

    return {
      status: query.status,
      customerId: query.customerId,
      machineId: query.machineId,
      businessLineId: query.businessLineId,
      installedById: query.installedById,
      installedAt:
        query.installedFrom || query.installedTo
          ? {
              gte: query.installedFrom
                ? this.parseRequiredDate(query.installedFrom, 'installedFrom')
                : undefined,
              lte: query.installedTo
                ? this.parseRequiredDate(query.installedTo, 'installedTo')
                : undefined,
            }
          : undefined,
      OR: search
        ? [
            { code: { contains: search, mode: 'insensitive' } },
            { note: { contains: search, mode: 'insensitive' } },
            {
              machine: {
                serialNumber: { contains: search, mode: 'insensitive' },
              },
            },
            {
              machine: {
                modelName: { contains: search, mode: 'insensitive' },
              },
            },
            {
              customer: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
            {
              businessLine: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
            {
              businessLine: {
                manufacturer: { contains: search, mode: 'insensitive' },
              },
            },
          ]
        : undefined,
    };
  }

  private withAccessScope(
    where: Prisma.MachineInstallationWhereInput,
    user?: RequestUser,
  ): Prisma.MachineInstallationWhereInput {
    return {
      AND: [where, installationAccessWhere(user)],
    };
  }

  private async generateInstallationCode(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const prefix = this.getDailyCodePrefix('INS');
    const count = await tx.machineInstallation.count({
      where: {
        code: {
          startsWith: prefix,
        },
      },
    });

    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateWarrantyCode(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const prefix = this.getDailyCodePrefix('WAR');
    const count = await tx.warrantyCard.count({
      where: {
        code: {
          startsWith: prefix,
        },
      },
    });

    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateMovementCode(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const prefix = this.getDailyCodePrefix('INV');
    const count = await tx.machineInventoryMovement.count({
      where: {
        code: {
          startsWith: prefix,
        },
      },
    });

    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private getDailyCodePrefix(prefix: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${prefix}-${year}${month}${day}`;
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

  private defaultInclude() {
    return {
      machine: {
        select: {
          id: true,
          machineCode: true,
          serialNumber: true,
          modelName: true,
          name: true,
          manufacturer: true,
          inventoryStatus: true,
          status: true,
          warrantyStartDate: true,
          warrantyEndDate: true,
        },
      },
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
          role: true,
          region: true,
          engineerProfile: true,
        },
      },
      warrantyCard: true,
    };
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerStatus, CustomerType, Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { customerAccessWhere } from '../auth/access-scope';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { pickChangedFields } from '../common/audit-changes';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateCustomerDto, actor?: RequestUser) {
    assertPermission(actor, PERMISSIONS.CUSTOMER_CREATE);
    this.validateCreateCustomer(dto);
    await this.ensureRegionExists(dto.regionId);
    await this.ensureCustomerCodeIsAvailable(dto.customerCode);
    await this.ensureEngineerExists(dto.primaryEngineerId);

    return this.prisma.$transaction(async (tx) => {
      const customerCode =
        dto.customerCode?.trim() || (await this.generateCustomerCode(tx, dto));
      const created = await tx.customer.create({
        data: {
          customerCode,
          name: dto.name.trim(),
          shortName: dto.shortName?.trim() || null,
          hospitalName: dto.hospitalName?.trim() || null,
          customerType: dto.customerType ?? CustomerType.HOSPITAL,
          status: dto.status ?? CustomerStatus.ACTIVE,
          taxCode: dto.taxCode?.trim() || null,
          email: this.normalizeOptionalEmail(dto.email),
          website: dto.website?.trim() || null,
          phone: dto.phone?.trim() || null,
          contactPerson: dto.contactPerson?.trim() || null,
          contactPosition: dto.contactPosition?.trim() || null,
          contactPhone: dto.contactPhone?.trim() || null,
          contactEmail: this.normalizeOptionalEmail(dto.contactEmail),
          province: dto.province?.trim() || null,
          district: dto.district?.trim() || null,
          ward: dto.ward?.trim() || null,
          address: dto.address?.trim() || null,
          fullAddress: this.buildFullAddress(dto),
          note: dto.note?.trim() || null,
          regionId: dto.regionId,
          primaryEngineerId: dto.primaryEngineerId?.trim() || null,
        },
        include: this.customerListInclude(),
      });

      await this.auditLogsService.create(
        {
          action: 'CREATE',
          entityType: 'Customer',
          entityId: created.id,
          actor,
          metadata: {
            customerCode: created.customerCode,
            name: created.name,
            regionId: created.regionId,
            status: created.status,
            primaryEngineerId: created.primaryEngineerId,
          },
        },
        tx,
      );

      return created;
    });
  }

  async findAll(
    query: ListCustomersQueryDto,
    user?: RequestUser,
  ): Promise<PaginatedResult<unknown>> {
    assertPermission(user, PERMISSIONS.CUSTOMER_READ);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.withAccessScope(this.buildFindAllWhere(query), user);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: this.customerListInclude(),
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return this.toPaginatedResult(data, page, limit, total);
  }

  async findOne(id: string, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.CUSTOMER_READ);
    const customer = await this.prisma.customer.findFirst({
      where: this.withAccessScope({ id }, user),
      include: {
        ...this.customerListInclude(),
        machines: {
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            primaryEngineer: { select: this.userSummarySelect() },
            installedBy: { select: this.userSummarySelect() },
            repairs: {
              orderBy: { reportedAt: 'desc' },
              take: 30,
              include: {
                engineer: { select: this.userSummarySelect() },
                workLogs: {
                  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                },
                usedParts: {
                  orderBy: [{ usedAt: 'asc' }, { createdAt: 'asc' }],
                },
                checklistItems: {
                  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                },
              },
            },
            maintenances: {
              orderBy: { scheduledDate: 'desc' },
              take: 30,
              include: {
                engineer: { select: this.userSummarySelect() },
                workLogs: {
                  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                },
                usedParts: {
                  orderBy: [{ usedAt: 'asc' }, { createdAt: 'asc' }],
                },
                checklistItems: {
                  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                },
              },
            },
            installations: {
              orderBy: { installedAt: 'desc' },
              take: 20,
              include: {
                installedBy: { select: this.userSummarySelect() },
                warrantyCard: true,
                workLogs: {
                  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                },
                usedParts: {
                  orderBy: [{ usedAt: 'asc' }, { createdAt: 'asc' }],
                },
                checklistItems: {
                  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                },
              },
            },
            inventoryMovements: {
              orderBy: { occurredAt: 'desc' },
              take: 30,
              include: {
                createdBy: { select: this.userSummarySelect() },
                customer: {
                  select: {
                    id: true,
                    name: true,
                    hospitalName: true,
                  },
                },
              },
            },
            accessories: {
              orderBy: { createdAt: 'desc' },
              include: {
                componentAccessory: {
                  include: {
                    component: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        repairs: {
          orderBy: { reportedAt: 'desc' },
          take: 50,
          include: {
            engineer: { select: this.userSummarySelect() },
            workLogs: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
            usedParts: {
              orderBy: [{ usedAt: 'asc' }, { createdAt: 'asc' }],
            },
            checklistItems: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
            machine: {
              select: {
                id: true,
                machineCode: true,
                serialNumber: true,
                modelName: true,
              },
            },
          },
        },
        maintenances: {
          orderBy: { scheduledDate: 'desc' },
          take: 50,
          include: {
            engineer: { select: this.userSummarySelect() },
            workLogs: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
            usedParts: {
              orderBy: [{ usedAt: 'asc' }, { createdAt: 'asc' }],
            },
            checklistItems: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
            machine: {
              select: {
                id: true,
                machineCode: true,
                serialNumber: true,
                modelName: true,
              },
            },
          },
        },
        machineInstallations: {
          orderBy: { installedAt: 'desc' },
          take: 50,
          include: {
            installedBy: { select: this.userSummarySelect() },
            warrantyCard: true,
            workLogs: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
            usedParts: {
              orderBy: [{ usedAt: 'asc' }, { createdAt: 'asc' }],
            },
            checklistItems: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
            machine: {
              select: {
                id: true,
                machineCode: true,
                serialNumber: true,
                modelName: true,
              },
            },
            plannedMachineModel: {
              select: {
                id: true,
                code: true,
                name: true,
                displayName: true,
              },
            },
            businessLine: {
              include: {
                productIndustry: true,
              },
            },
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      ...customer,
      directInstallations: customer.machineInstallations,
      directRepairs: customer.repairs,
      directMaintenances: customer.maintenances,
    };
  }

  async update(id: string, dto: UpdateCustomerDto, actor?: RequestUser) {
    assertPermission(actor, PERMISSIONS.CUSTOMER_UPDATE);
    const current = await this.findOne(id, actor);

    if (dto.regionId) {
      await this.ensureRegionExists(dto.regionId);
    }

    if (dto.customerCode) {
      await this.ensureCustomerCodeIsAvailable(dto.customerCode, id);
    }

    if (dto.primaryEngineerId !== undefined) {
      await this.ensureEngineerExists(dto.primaryEngineerId);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: {
          customerCode:
            dto.customerCode === undefined
              ? undefined
              : dto.customerCode?.trim() || null,
          name: dto.name?.trim(),
          shortName:
            dto.shortName === undefined
              ? undefined
              : dto.shortName?.trim() || null,
          hospitalName:
            dto.hospitalName === undefined
              ? undefined
              : dto.hospitalName?.trim() || null,
          customerType: dto.customerType,
          status: dto.status,
          taxCode:
            dto.taxCode === undefined ? undefined : dto.taxCode?.trim() || null,
          email:
            dto.email === undefined
              ? undefined
              : this.normalizeOptionalEmail(dto.email),
          website:
            dto.website === undefined ? undefined : dto.website?.trim() || null,
          phone:
            dto.phone === undefined ? undefined : dto.phone?.trim() || null,
          contactPerson:
            dto.contactPerson === undefined
              ? undefined
              : dto.contactPerson?.trim() || null,
          contactPosition:
            dto.contactPosition === undefined
              ? undefined
              : dto.contactPosition?.trim() || null,
          contactPhone:
            dto.contactPhone === undefined
              ? undefined
              : dto.contactPhone?.trim() || null,
          contactEmail:
            dto.contactEmail === undefined
              ? undefined
              : this.normalizeOptionalEmail(dto.contactEmail),
          province:
            dto.province === undefined
              ? undefined
              : dto.province?.trim() || null,
          district:
            dto.district === undefined
              ? undefined
              : dto.district?.trim() || null,
          ward: dto.ward === undefined ? undefined : dto.ward?.trim() || null,
          address:
            dto.address === undefined ? undefined : dto.address?.trim() || null,
          fullAddress:
            dto.fullAddress === undefined
              ? undefined
              : dto.fullAddress?.trim() || null,
          note: dto.note === undefined ? undefined : dto.note?.trim() || null,
          regionId: dto.regionId,
          primaryEngineerId:
            dto.primaryEngineerId === undefined
              ? undefined
              : dto.primaryEngineerId?.trim() || null,
        },
        include: this.customerListInclude(),
      });

      await this.auditLogsService.create(
        {
          action: 'UPDATE',
          entityType: 'Customer',
          entityId: id,
          actor,
          changes: pickChangedFields(current, updated, [
            'customerCode',
            'name',
            'shortName',
            'hospitalName',
            'customerType',
            'status',
            'taxCode',
            'email',
            'website',
            'phone',
            'contactPerson',
            'contactPosition',
            'contactPhone',
            'contactEmail',
            'province',
            'district',
            'ward',
            'address',
            'fullAddress',
            'note',
            'regionId',
            'primaryEngineerId',
          ]),
        },
        tx,
      );

      return updated;
    });
  }

  async remove(id: string, actor?: RequestUser) {
    assertPermission(actor, PERMISSIONS.CUSTOMER_DELETE);
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            machines: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer._count.machines > 0) {
      throw new BadRequestException('Cannot delete customer with machines');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.customer.delete({
        where: { id },
      });

      await this.auditLogsService.create(
        {
          action: 'DELETE',
          entityType: 'Customer',
          entityId: id,
          actor,
          metadata: {
            customerCode: customer.customerCode,
            name: customer.name,
            regionId: customer.regionId,
          },
        },
        tx,
      );
    });

    return { deleted: true };
  }

  getTypes() {
    return Object.values(CustomerType);
  }

  getStatuses() {
    return Object.values(CustomerStatus);
  }

  private validateCreateCustomer(dto: CreateCustomerDto) {
    if (!dto.name?.trim() || !dto.regionId) {
      throw new BadRequestException('name and regionId are required');
    }
  }

  private withAccessScope(
    where: Prisma.CustomerWhereInput,
    user?: RequestUser,
  ): Prisma.CustomerWhereInput {
    return {
      AND: [where, customerAccessWhere(user)],
    };
  }

  private async ensureRegionExists(regionId: string) {
    const region = await this.prisma.region.findUnique({
      where: { id: regionId },
    });

    if (!region) {
      throw new BadRequestException('Region does not exist');
    }
  }

  private async ensureEngineerExists(userId?: string | null) {
    if (!userId?.trim()) {
      return;
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId.trim(),
        status: 'ACTIVE',
        OR: [
          {
            role: {
              name: {
                equals: 'engineer',
              },
            },
          },
          {
            engineerProfile: {
              isNot: null,
            },
          },
        ],
      },
    });

    if (!user) {
      throw new BadRequestException('Engineer does not exist');
    }
  }

  private async ensureCustomerCodeIsAvailable(
    customerCode?: string | null,
    currentCustomerId?: string,
  ) {
    if (!customerCode?.trim()) {
      return;
    }

    const customer = await this.prisma.customer.findUnique({
      where: {
        customerCode: customerCode.trim(),
      },
    });

    if (customer && customer.id !== currentCustomerId) {
      throw new ConflictException('Customer code already exists');
    }
  }

  private async generateCustomerCode(
    tx: Prisma.TransactionClient,
    dto: CreateCustomerDto,
  ) {
    const region = await tx.region.findUnique({
      where: { id: dto.regionId },
      select: { code: true },
    });
    const prefix = [
      this.customerTypePrefix(dto.customerType),
      this.normalizeCodeSegment(region?.code || dto.province || 'KH'),
    ].join('-');
    const latest = await tx.customer.findFirst({
      where: {
        customerCode: {
          startsWith: `${prefix}-`,
        },
      },
      orderBy: {
        customerCode: 'desc',
      },
      select: {
        customerCode: true,
      },
    });
    const latestNumber = latest?.customerCode
      ? Number(
          latest.customerCode.slice(latest.customerCode.lastIndexOf('-') + 1),
        )
      : 0;
    const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 1;

    return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
  }

  private customerTypePrefix(type?: CustomerType) {
    if (type === CustomerType.HOSPITAL) return 'BV';
    if (type === CustomerType.CLINIC) return 'PK';
    if (type === CustomerType.LAB) return 'XN';
    if (type === CustomerType.DISTRIBUTOR) return 'NPP';
    if (type === CustomerType.UNIVERSITY) return 'DH';
    if (type === CustomerType.COMPANY) return 'CTY';
    return 'KH';
  }

  private normalizeCodeSegment(value: string) {
    const normalized = value
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/Đ/g, 'D')
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');

    return normalized || 'KH';
  }

  private normalizeOptionalEmail(email?: string | null): string | null {
    return email?.trim().toLowerCase() || null;
  }

  private buildFindAllWhere(
    query: ListCustomersQueryDto,
  ): Prisma.CustomerWhereInput {
    const search = query.search?.trim();

    return {
      status: query.status,
      customerType: query.customerType,
      regionId: query.regionId,
      primaryEngineerId: query.primaryEngineerId,
      OR: search
        ? [
            { customerCode: { contains: search } },
            { name: { contains: search } },
            { shortName: { contains: search } },
            { hospitalName: { contains: search } },
            { phone: { contains: search } },
            { taxCode: { contains: search } },
            { contactPerson: { contains: search } },
            { fullAddress: { contains: search } },
          ]
        : undefined,
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

  private buildFullAddress(dto: CreateCustomerDto): string | null {
    if (dto.fullAddress?.trim()) {
      return dto.fullAddress.trim();
    }

    const addressParts = [dto.address, dto.ward, dto.district, dto.province]
      .map((part) => part?.trim())
      .filter(Boolean);

    return addressParts.length ? addressParts.join(', ') : null;
  }

  private userSummarySelect() {
    return {
      id: true,
      email: true,
      fullName: true,
      phone: true,
    } satisfies Prisma.UserSelect;
  }

  private customerListInclude() {
    return {
      region: true,
      primaryEngineer: {
        select: this.userSummarySelect(),
      },
      _count: {
        select: {
          machines: true,
          machineInstallations: true,
        },
      },
    } satisfies Prisma.CustomerInclude;
  }
}

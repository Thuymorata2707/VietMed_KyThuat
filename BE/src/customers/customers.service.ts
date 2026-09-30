import { sequenceCode } from '../common/sequence-code';
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
    if (dto.regionId) await this.ensureRegionExists(dto.regionId);
    await this.ensureCustomerCodeIsAvailable(dto.customerCode);
    const province = await this.ensureProvinceExists(dto.provinceId);
    const engineerIds = this.normalizeEngineerIds([
      ...(dto.engineerIds ?? []),
      ...(dto.primaryEngineerId ? [dto.primaryEngineerId] : []),
    ]);
    await this.ensureEngineersExist(engineerIds);

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
          province: province?.name || dto.province?.trim() || null,
          provinceId: province?.id || null,
          district: dto.district?.trim() || null,
          locality: dto.locality?.trim() || null,
          ward: dto.ward?.trim() || null,
          address: dto.address?.trim() || null,
          fullAddress: this.buildFullAddress(dto, province?.name),
          note: dto.note?.trim() || null,
          // Keep quick-created customers visible to the creating branch's
          // scoped admin/manager even when the quick form omits regionId.
          regionId: dto.regionId || actor?.regionId || null,
          primaryEngineerId: engineerIds[0] || null,
          engineers: engineerIds.length
            ? { connect: engineerIds.map((id) => ({ id })) }
            : undefined,
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
            engineerIds: engineerIds,
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

    const province = dto.provinceId === undefined
      ? undefined
      : await this.ensureProvinceExists(dto.provinceId);

    const shouldReplaceEngineers =
      dto.engineerIds !== undefined || dto.primaryEngineerId !== undefined;
    const engineerIds = shouldReplaceEngineers
      ? this.normalizeEngineerIds([
          ...(dto.engineerIds ?? []),
          ...(dto.primaryEngineerId ? [dto.primaryEngineerId] : []),
        ])
      : undefined;
    if (engineerIds) await this.ensureEngineersExist(engineerIds);

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
            province === undefined
              ? dto.province === undefined ? undefined : dto.province?.trim() || null
              : province?.name || null,
          provinceId:
            province === undefined ? undefined : province?.id || null,
          district:
            dto.district === undefined
              ? undefined
              : dto.district?.trim() || null,
          locality:
            dto.locality === undefined
              ? undefined
              : dto.locality?.trim() || null,
          ward: dto.ward === undefined ? undefined : dto.ward?.trim() || null,
          address:
            dto.address === undefined ? undefined : dto.address?.trim() || null,
          fullAddress:
            dto.fullAddress === undefined
              ? undefined
              : dto.fullAddress?.trim() || null,
          note: dto.note === undefined ? undefined : dto.note?.trim() || null,
          regionId: dto.regionId === undefined ? undefined : dto.regionId || null,
          primaryEngineerId:
            engineerIds === undefined
              ? undefined
              : engineerIds[0] || null,
          engineers:
            engineerIds === undefined
              ? undefined
              : { set: engineerIds.map((engineerId) => ({ id: engineerId })) },
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
            'locality',
            'ward',
            'address',
            'fullAddress',
            'note',
            'regionId',
            'primaryEngineerId',
            'engineers',
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
            inventoryMovements: true,
            machineInstallations: true,
            demoLoans: true,
            warrantyCards: true,
            repairs: true,
            maintenances: true,
            deviceServiceTickets: true,
            applicationSupportCases: true,
            accessoryStockMovements: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (Object.values(customer._count).some((count) => count > 0)) {
      throw new BadRequestException(
        'Cannot delete customer with linked machines or operational history',
      );
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
    if (!dto.name?.trim()) {
      throw new BadRequestException('name is required');
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

  private normalizeEngineerIds(values: Array<string | null | undefined>) {
    return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
  }

  private async ensureEngineersExist(userIds: string[]) {
    await Promise.all(userIds.map((userId) => this.ensureEngineerExists(userId)));
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
    const region = dto.regionId
      ? await tx.region.findUnique({
          where: { id: dto.regionId },
          select: { code: true },
        })
      : null;
    const prefix = [
      this.customerTypePrefix(dto.customerType),
      this.normalizeCodeSegment(region?.code || dto.province || 'KH'),
    ].join('-');
    return sequenceCode(tx, 'customer', prefix, 3, false);
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
    const filters: Prisma.CustomerWhereInput[] = [];

    if (query.primaryEngineerId) {
      filters.push({
        OR: [
          { primaryEngineerId: query.primaryEngineerId },
          { engineers: { some: { id: query.primaryEngineerId } } },
        ],
      });
    }

    if (query.branchId) {
      filters.push({ provinceRef: { is: { branchId: query.branchId } } });
    }

    if (query.provinceId || query.province?.trim()) {
      filters.push({
        OR: [
          query.provinceId ? { provinceId: query.provinceId } : undefined,
          query.province?.trim() ? { province: query.province.trim() } : undefined,
        ].filter(Boolean) as Prisma.CustomerWhereInput[],
      });
    }

    if (search) {
      filters.push({
        OR: [
          { customerCode: { contains: search } },
          { name: { contains: search } },
          { shortName: { contains: search } },
          { hospitalName: { contains: search } },
          { phone: { contains: search } },
          { taxCode: { contains: search } },
          { contactPerson: { contains: search } },
          { fullAddress: { contains: search } },
        ],
      });
    }

    return {
      status: query.status,
      customerType: query.customerType,
      regionId: query.regionId,
      provinceId: query.provinceId,
      AND: filters.length ? filters : undefined,
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

  private buildFullAddress(dto: CreateCustomerDto, provinceName?: string): string | null {
    if (dto.fullAddress?.trim()) {
      return dto.fullAddress.trim();
    }

    const addressParts = [dto.address, dto.locality, dto.ward, dto.district, provinceName || dto.province]
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
      provinceRef: { include: { branch: true } },
      primaryEngineer: {
        select: this.userSummarySelect(),
      },
      engineers: {
        select: this.userSummarySelect(),
        orderBy: { fullName: 'asc' },
      },
      _count: {
        select: {
          machines: true,
          machineInstallations: true,
        },
      },
    } satisfies Prisma.CustomerInclude;
  }

  private async ensureProvinceExists(provinceId?: string | null) {
    if (!provinceId?.trim()) return null;
    const province = await this.prisma.province.findUnique({
      where: { id: provinceId.trim() },
      select: { id: true, name: true },
    });
    if (!province) throw new BadRequestException('Province does not exist');
    return province;
  }
}

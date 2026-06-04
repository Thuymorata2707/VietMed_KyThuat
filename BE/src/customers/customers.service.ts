import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerStatus, CustomerType, Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { customerAccessWhere } from '../auth/access-scope';
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
    this.validateCreateCustomer(dto);
    await this.ensureRegionExists(dto.regionId);
    await this.ensureCustomerCodeIsAvailable(dto.customerCode);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          customerCode: dto.customerCode?.trim() || null,
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
        },
        include: {
          region: true,
          _count: {
            select: {
              machines: true,
            },
          },
        },
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
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.withAccessScope(this.buildFindAllWhere(query), user);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: {
          region: true,
          _count: {
            select: {
              machines: true,
            },
          },
        },
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
    const customer = await this.prisma.customer.findFirst({
      where: this.withAccessScope({ id }, user),
      include: {
        region: true,
        machines: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, actor?: RequestUser) {
    const current = await this.findOne(id);

    if (dto.regionId) {
      await this.ensureRegionExists(dto.regionId);
    }

    if (dto.customerCode) {
      await this.ensureCustomerCodeIsAvailable(dto.customerCode, id);
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
        },
        include: {
          region: true,
          _count: {
            select: {
              machines: true,
            },
          },
        },
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
          ]),
        },
        tx,
      );

      return updated;
    });
  }

  async remove(id: string, actor?: RequestUser) {
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
      OR: search
        ? [
            { customerCode: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { shortName: { contains: search, mode: 'insensitive' } },
            { hospitalName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { taxCode: { contains: search, mode: 'insensitive' } },
            { contactPerson: { contains: search, mode: 'insensitive' } },
            { fullAddress: { contains: search, mode: 'insensitive' } },
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
}

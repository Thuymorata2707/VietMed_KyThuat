import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerStatus, CustomerType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomerDto) {
    this.validateCreateCustomer(dto);
    await this.ensureRegionExists(dto.regionId);
    await this.ensureCustomerCodeIsAvailable(dto.customerCode);

    return this.prisma.customer.create({
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
  }

  findAll() {
    return this.prisma.customer.findMany({
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
    });
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
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

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);

    if (dto.regionId) {
      await this.ensureRegionExists(dto.regionId);
    }

    if (dto.customerCode) {
      await this.ensureCustomerCodeIsAvailable(dto.customerCode, id);
    }

    return this.prisma.customer.update({
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
        phone: dto.phone === undefined ? undefined : dto.phone?.trim() || null,
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
          dto.province === undefined ? undefined : dto.province?.trim() || null,
        district:
          dto.district === undefined ? undefined : dto.district?.trim() || null,
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
  }

  async remove(id: string) {
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

    await this.prisma.customer.delete({
      where: { id },
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

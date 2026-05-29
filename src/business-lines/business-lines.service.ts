import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessLineStatus, MachineProductCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessLineDto } from './dto/create-business-line.dto';
import { UpdateBusinessLineDto } from './dto/update-business-line.dto';

@Injectable()
export class BusinessLinesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBusinessLineDto) {
    this.validateCreate(dto);
    await this.ensureCodeIsAvailable(dto.code);
    await this.ensureManagerExists(dto.managerId);

    return this.prisma.businessLine.create({
      data: {
        code: this.normalizeCode(dto.code),
        name: dto.name.trim(),
        status: dto.status ?? BusinessLineStatus.ACTIVE,
        manufacturer: dto.manufacturer?.trim() || null,
        productCategory: dto.productCategory ?? MachineProductCategory.OTHER,
        countryOfOrigin: dto.countryOfOrigin?.trim() || null,
        website: dto.website?.trim() || null,
        contactPerson: dto.contactPerson?.trim() || null,
        contactPhone: dto.contactPhone?.trim() || null,
        contactEmail: this.normalizeOptionalEmail(dto.contactEmail),
        description: dto.description?.trim() || null,
        note: dto.note?.trim() || null,
        managerId: dto.managerId || null,
      },
      include: this.defaultInclude(),
    });
  }

  findAll() {
    return this.prisma.businessLine.findMany({
      include: this.defaultInclude(),
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const businessLine = await this.prisma.businessLine.findUnique({
      where: { id },
      include: {
        manager: this.managerSelect(),
        machines: {
          include: {
            customer: true,
            installedBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
            primaryEngineer: {
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
      },
    });

    if (!businessLine) {
      throw new NotFoundException('Business line not found');
    }

    return businessLine;
  }

  async update(id: string, dto: UpdateBusinessLineDto) {
    await this.findOne(id);

    if (dto.code) {
      await this.ensureCodeIsAvailable(dto.code, id);
    }

    if (dto.managerId) {
      await this.ensureManagerExists(dto.managerId);
    }

    return this.prisma.businessLine.update({
      where: { id },
      data: {
        code: dto.code ? this.normalizeCode(dto.code) : undefined,
        name: dto.name?.trim(),
        status: dto.status,
        manufacturer:
          dto.manufacturer === undefined
            ? undefined
            : dto.manufacturer?.trim() || null,
        productCategory: dto.productCategory,
        countryOfOrigin:
          dto.countryOfOrigin === undefined
            ? undefined
            : dto.countryOfOrigin?.trim() || null,
        website:
          dto.website === undefined ? undefined : dto.website?.trim() || null,
        contactPerson:
          dto.contactPerson === undefined
            ? undefined
            : dto.contactPerson?.trim() || null,
        contactPhone:
          dto.contactPhone === undefined
            ? undefined
            : dto.contactPhone?.trim() || null,
        contactEmail:
          dto.contactEmail === undefined
            ? undefined
            : this.normalizeOptionalEmail(dto.contactEmail),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        note: dto.note === undefined ? undefined : dto.note?.trim() || null,
        managerId:
          dto.managerId === undefined ? undefined : dto.managerId || null,
      },
      include: this.defaultInclude(),
    });
  }

  async remove(id: string) {
    const businessLine = await this.prisma.businessLine.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            machines: true,
          },
        },
      },
    });

    if (!businessLine) {
      throw new NotFoundException('Business line not found');
    }

    if (businessLine._count.machines > 0) {
      throw new BadRequestException(
        'Cannot delete business line with machines',
      );
    }

    await this.prisma.businessLine.delete({
      where: { id },
    });

    return { deleted: true };
  }

  getStatuses() {
    return Object.values(BusinessLineStatus);
  }

  private validateCreate(dto: CreateBusinessLineDto) {
    if (!dto.code?.trim() || !dto.name?.trim()) {
      throw new BadRequestException('code and name are required');
    }
  }

  private async ensureCodeIsAvailable(code: string, currentId?: string) {
    const businessLine = await this.prisma.businessLine.findUnique({
      where: {
        code: this.normalizeCode(code),
      },
    });

    if (businessLine && businessLine.id !== currentId) {
      throw new ConflictException('Business line code already exists');
    }
  }

  private async ensureManagerExists(managerId?: string | null) {
    if (!managerId) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: managerId },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new BadRequestException('Manager does not exist or is inactive');
    }
  }

  private normalizeCode(code: string): string {
    return code.toUpperCase().trim();
  }

  private normalizeOptionalEmail(email?: string | null): string | null {
    return email?.trim().toLowerCase() || null;
  }

  private defaultInclude() {
    return {
      manager: this.managerSelect(),
      _count: {
        select: {
          machines: true,
        },
      },
    };
  }

  private managerSelect() {
    return {
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        status: true,
        role: true,
        region: true,
      },
    };
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessLineStatus, MachineProductCategory } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { pickChangedFields } from '../common/audit-changes';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessLineDto } from './dto/create-business-line.dto';
import { UpdateBusinessLineDto } from './dto/update-business-line.dto';

@Injectable()
export class BusinessLinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(dto: CreateBusinessLineDto, actor?: RequestUser) {
    this.validateCreate(dto);
    await this.ensureCodeIsAvailable(dto.code);
    await this.ensureManagerExists(dto.managerId);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.businessLine.create({
        data: {
          code: this.normalizeCode(dto.code),
          name: dto.name.trim(),
          status: dto.status ?? BusinessLineStatus.ACTIVE,
          manufacturer: dto.manufacturer?.trim() || null,
          imageUrl: dto.imageUrl?.trim() || null,
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

      await this.auditLogsService.create(
        {
          action: 'CREATE',
          entityType: 'BusinessLine',
          entityId: created.id,
          actor,
          metadata: {
            code: created.code,
            name: created.name,
            managerId: created.managerId,
          },
        },
        tx,
      );

      return created;
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
            machineModel: true,
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
        machineModels: {
          orderBy: {
            name: 'asc',
          },
        },
      },
    });

    if (!businessLine) {
      throw new NotFoundException('Business line not found');
    }

    return businessLine;
  }

  async findModels(id: string) {
    await this.findOne(id);

    return this.prisma.machineModel.findMany({
      where: {
        businessLineId: id,
        status: BusinessLineStatus.ACTIVE,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async update(id: string, dto: UpdateBusinessLineDto, actor?: RequestUser) {
    const current = await this.findOne(id);

    if (dto.code) {
      await this.ensureCodeIsAvailable(dto.code, id);
    }

    if (dto.managerId) {
      await this.ensureManagerExists(dto.managerId);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.businessLine.update({
        where: { id },
        data: {
          code: dto.code ? this.normalizeCode(dto.code) : undefined,
          name: dto.name?.trim(),
          status: dto.status,
          manufacturer:
            dto.manufacturer === undefined
              ? undefined
              : dto.manufacturer?.trim() || null,
          imageUrl:
            dto.imageUrl === undefined
              ? undefined
              : dto.imageUrl?.trim() || null,
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

      await this.auditLogsService.create(
        {
          action: 'UPDATE',
          entityType: 'BusinessLine',
          entityId: id,
          actor,
          changes: pickChangedFields(current, updated, [
            'code',
            'name',
            'status',
            'manufacturer',
            'imageUrl',
            'productCategory',
            'countryOfOrigin',
            'website',
            'contactPerson',
            'contactPhone',
            'contactEmail',
            'description',
            'note',
            'managerId',
          ]),
        },
        tx,
      );

      return updated;
    });
  }

  async remove(id: string, actor?: RequestUser) {
    const businessLine = await this.prisma.businessLine.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            machines: true,
            machineModels: true,
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

    if (businessLine._count.machineModels > 0) {
      throw new BadRequestException(
        'Cannot delete business line with machine models',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.businessLine.delete({
        where: { id },
      });

      await this.auditLogsService.create(
        {
          action: 'DELETE',
          entityType: 'BusinessLine',
          entityId: id,
          actor,
          metadata: {
            code: businessLine.code,
            name: businessLine.name,
          },
        },
        tx,
      );
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
          machineModels: true,
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

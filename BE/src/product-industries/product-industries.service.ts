import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessLineStatus,
  MachineProductCategory,
  Prisma,
} from '@prisma/client';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
import { PaginatedResult } from '../common/paginated-result.type';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductIndustryDto } from './dto/create-product-industry.dto';
import { UpdateProductIndustryDto } from './dto/update-product-industry.dto';

@Injectable()
export class ProductIndustriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductIndustryDto, actor?: RequestUser) {
    assertPermission(actor, PERMISSIONS.MASTER_DATA_WRITE);
    this.validate(dto.code, dto.name);
    await this.ensureCodeAvailable(dto.code);
    await this.ensureBusinessLineCodesAvailable(dto.businessLines ?? []);

    return this.prisma.$transaction(async (tx) => {
      const industry = await tx.productIndustry.create({
        data: {
          code: this.normalizeCode(dto.code),
          name: dto.name.trim(),
          expertiseGroup: dto.expertiseGroup,
          description: dto.description?.trim() || null,
          status: dto.status ?? BusinessLineStatus.ACTIVE,
          sortOrder: dto.sortOrder ?? 0,
          businessLines: {
            create: (dto.businessLines ?? []).map((line) => ({
              code: this.normalizeCode(line.code),
              name: line.name.trim(),
              status: BusinessLineStatus.ACTIVE,
              expertiseGroup: dto.expertiseGroup,
              productCategory: this.normalizeProductCategory(
                line.productCategory,
              ),
              manufacturer: line.manufacturer?.trim() || null,
              countryOfOrigin: line.countryOfOrigin?.trim() || null,
            })),
          },
        },
        include: this.defaultInclude(),
      });

      return industry;
    });
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const search = query.search?.trim();
    const where: Prisma.ProductIndustryWhereInput = search
      ? {
          OR: [{ code: { contains: search } }, { name: { contains: search } }],
        }
      : {};

    const [data, total] = await this.prisma.$transaction([
      this.prisma.productIndustry.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.productIndustry.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const industry = await this.prisma.productIndustry.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });
    if (!industry) throw new NotFoundException('Product industry not found');
    return industry;
  }

  async update(id: string, dto: UpdateProductIndustryDto, actor?: RequestUser) {
    assertPermission(actor, PERMISSIONS.MASTER_DATA_WRITE);
    await this.findOne(id);
    if (dto.code) await this.ensureCodeAvailable(dto.code, id);

    return this.prisma.productIndustry.update({
      where: { id },
      data: {
        code: dto.code ? this.normalizeCode(dto.code) : undefined,
        name: dto.name?.trim(),
        expertiseGroup: dto.expertiseGroup,
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        status: dto.status,
        sortOrder: dto.sortOrder,
      },
      include: this.defaultInclude(),
    });
  }

  async remove(id: string, actor?: RequestUser) {
    assertPermission(actor, PERMISSIONS.MASTER_DATA_WRITE);
    const industry = await this.findOne(id);
    if (industry.businessLines.length > 0) {
      throw new BadRequestException(
        'Cannot delete product industry with products',
      );
    }
    await this.prisma.productIndustry.delete({ where: { id } });
    return { deleted: true };
  }

  private validate(code: string, name: string) {
    if (!code?.trim() || !name?.trim()) {
      throw new BadRequestException('code and name are required');
    }
  }

  private async ensureCodeAvailable(code: string, currentId?: string) {
    const existing = await this.prisma.productIndustry.findUnique({
      where: { code: this.normalizeCode(code) },
    });
    if (existing && existing.id !== currentId)
      throw new ConflictException('Product industry code already exists');
  }

  private async ensureBusinessLineCodesAvailable(
    lines: Array<{ code: string }>,
  ) {
    const codes = lines
      .map((line) => this.normalizeCode(line.code))
      .filter(Boolean);
    const duplicatedCode = codes.find(
      (code, index) => codes.indexOf(code) !== index,
    );
    if (duplicatedCode) {
      throw new ConflictException(
        `Business line code ${duplicatedCode} is duplicated`,
      );
    }
    if (!codes.length) return;

    const existing = await this.prisma.businessLine.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });
    if (existing.length) {
      throw new ConflictException(
        `Business line code ${existing[0].code} already exists`,
      );
    }
  }

  private normalizeCode(code: string) {
    return code.toUpperCase().trim();
  }

  private normalizeProductCategory(value?: string | null) {
    const normalized = value?.trim().toUpperCase();
    if (!normalized) return MachineProductCategory.OTHER;
    if (
      Object.values(MachineProductCategory).includes(
        normalized as MachineProductCategory,
      )
    ) {
      return normalized as MachineProductCategory;
    }
    return MachineProductCategory.OTHER;
  }

  private defaultInclude() {
    return {
      businessLines: {
        orderBy: { name: 'asc' as const },
      },
    };
  }
}

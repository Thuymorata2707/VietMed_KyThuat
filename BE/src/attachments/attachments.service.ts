import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttachmentType, Prisma } from '@prisma/client';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PaginatedResult } from '../common/paginated-result.type';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { ListAttachmentsQueryDto } from './dto/list-attachments-query.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';

const ALLOWED_ENTITY_TYPES = [
  'Machine',
  'MachineModel',
  'Repair',
  'Maintenance',
  'Customer',
  'EngineerProfile',
  'MachineInventoryMovement',
  'MachineInstallation',
  'WarrantyCard',
  'BusinessLine',
  'User',
] as const;

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

@Injectable()
export class AttachmentsService {
  private readonly uploadRoot = join(process.cwd(), 'uploads');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  getUploadRoot() {
    return this.uploadRoot;
  }

  validateUploadFile(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as never)) {
      throw new BadRequestException(
        'Only JPEG, PNG, WEBP and PDF files are allowed',
      );
    }
  }

  async create(
    dto: UploadAttachmentDto,
    file: Express.Multer.File,
    actor: RequestUser,
  ) {
    this.validateUploadFile(file);
    await this.ensureEntityExists(dto.entityType, dto.entityId);

    const attachment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: {
          entityType: dto.entityType,
          entityId: dto.entityId,
          type: dto.type ?? AttachmentType.OTHER,
          originalName: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          path: file.path,
          url: `/attachments/${file.filename}/file`,
          title: dto.title?.trim() || null,
          description: dto.description?.trim() || null,
          uploadedById: actor.id,
          uploadedByEmail: actor.email,
        },
        include: this.defaultInclude(),
      });

      await this.auditLogsService.create(
        {
          action: 'UPLOAD_ATTACHMENT',
          entityType: dto.entityType,
          entityId: dto.entityId,
          actor,
          metadata: {
            attachmentId: created.id,
            attachmentType: created.type,
            originalName: created.originalName,
            mimeType: created.mimeType,
            size: created.size,
          },
        },
        tx,
      );

      return created;
    });

    return attachment;
  }

  async findAll(
    query: ListAttachmentsQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildFindAllWhere(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.attachment.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.attachment.count({ where }),
    ]);

    return this.toPaginatedResult(data, page, limit, total);
  }

  async findOne(id: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: this.defaultInclude(),
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    return attachment;
  }

  async findFileByStoredName(storedName: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        storedName,
        deletedAt: null,
      },
    });

    if (!attachment || !existsSync(attachment.path)) {
      throw new NotFoundException('Attachment file not found');
    }

    return attachment;
  }

  async remove(id: string, actor: RequestUser) {
    const attachment = await this.findOne(id);

    const deleted = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.attachment.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });

      await this.auditLogsService.create(
        {
          action: 'DELETE_ATTACHMENT',
          entityType: attachment.entityType,
          entityId: attachment.entityId,
          actor,
          metadata: {
            attachmentId: attachment.id,
            originalName: attachment.originalName,
          },
        },
        tx,
      );

      return updated;
    });

    if (existsSync(attachment.path)) {
      unlinkSync(attachment.path);
    }

    return {
      deleted: true,
      id: deleted.id,
    };
  }

  getTypes() {
    return Object.values(AttachmentType);
  }

  private buildFindAllWhere(
    query: ListAttachmentsQueryDto,
  ): Prisma.AttachmentWhereInput {
    const search = query.search?.trim();

    return {
      deletedAt: null,
      entityType: query.entityType,
      entityId: query.entityId,
      type: query.type,
      OR: search
        ? [
            { originalName: { contains: search } },
            { title: { contains: search } },
            { description: { contains: search } },
          ]
        : undefined,
    };
  }

  private async ensureEntityExists(entityType: string, entityId: string) {
    if (!ALLOWED_ENTITY_TYPES.includes(entityType as never)) {
      throw new BadRequestException(`Unsupported entityType: ${entityType}`);
    }

    const exists = await this.findEntity(entityType, entityId);

    if (!exists) {
      throw new BadRequestException(`${entityType} does not exist`);
    }
  }

  private findEntity(entityType: string, entityId: string) {
    switch (entityType) {
      case 'Machine':
        return this.prisma.machine.findUnique({ where: { id: entityId } });
      case 'MachineModel':
        return this.prisma.machineModel.findUnique({ where: { id: entityId } });
      case 'Repair':
        return this.prisma.repair.findUnique({ where: { id: entityId } });
      case 'Maintenance':
        return this.prisma.maintenance.findUnique({ where: { id: entityId } });
      case 'Customer':
        return this.prisma.customer.findUnique({ where: { id: entityId } });
      case 'EngineerProfile':
        return this.prisma.engineerProfile.findUnique({
          where: { id: entityId },
        });
      case 'MachineInventoryMovement':
        return this.prisma.machineInventoryMovement.findUnique({
          where: { id: entityId },
        });
      case 'MachineInstallation':
        return this.prisma.machineInstallation.findUnique({
          where: { id: entityId },
        });
      case 'WarrantyCard':
        return this.prisma.warrantyCard.findUnique({
          where: { id: entityId },
        });
      case 'BusinessLine':
        return this.prisma.businessLine.findUnique({
          where: { id: entityId },
        });
      case 'User':
        return this.prisma.user.findUnique({ where: { id: entityId } });
      default:
        return null;
    }
  }

  private defaultInclude() {
    return {
      uploadedBy: {
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
        },
      },
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
}

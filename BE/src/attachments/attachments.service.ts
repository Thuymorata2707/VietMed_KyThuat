import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttachmentType, Prisma } from '@prisma/client';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  customerAccessWhere,
  installationAccessWhere,
  inventoryMovementAccessWhere,
  isAdmin,
  machineAccessWhere,
  maintenanceAccessWhere,
  repairAccessWhere,
  userAccessWhere,
} from '../auth/access-scope';
import { assertPermission, PERMISSIONS } from '../auth/permissions';
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
    assertPermission(actor, PERMISSIONS.ATTACHMENT_CREATE);
    this.validateUploadFile(file);
    await this.ensureEntityExists(dto.entityType, dto.entityId, actor);

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
          path: file.path ?? '',
          url: `/attachments/${file.filename}/file`,
          fileData: new Uint8Array(file.buffer),
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

    return this.withoutFileData(attachment);
  }

  async findAll(
    query: ListAttachmentsQueryDto,
    user?: RequestUser,
  ): Promise<PaginatedResult<unknown>> {
    assertPermission(user, PERMISSIONS.ATTACHMENT_READ);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildFindAllWhere(query, user);

    if (query.entityType && query.entityId) {
      await this.ensureEntityExists(query.entityType, query.entityId, user);
    }

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

    return this.toPaginatedResult(
      data.map((attachment) => this.withoutFileData(attachment)),
      page,
      limit,
      total,
    );
  }

  async findOne(id: string, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.ATTACHMENT_READ);
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
    await this.ensureEntityExists(
      attachment.entityType,
      attachment.entityId,
      user,
    );

    return this.withoutFileData(attachment);
  }

  async findFileByStoredName(storedName: string, user?: RequestUser) {
    assertPermission(user, PERMISSIONS.ATTACHMENT_READ);
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        storedName,
        deletedAt: null,
      },
    });

    if (!attachment || (!attachment.fileData && !existsSync(attachment.path))) {
      throw new NotFoundException('Attachment file not found');
    }
    await this.ensureEntityExists(
      attachment.entityType,
      attachment.entityId,
      user,
    );

    return attachment;
  }

  async remove(id: string, actor: RequestUser) {
    assertPermission(actor, PERMISSIONS.ATTACHMENT_DELETE);
    const attachment = await this.findOne(id, actor);

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

    if (attachment.path && existsSync(attachment.path)) {
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
    user?: RequestUser,
  ): Prisma.AttachmentWhereInput {
    const search = query.search?.trim();

    return {
      deletedAt: null,
      entityType: query.entityType,
      entityId: query.entityId,
      type: query.type,
      uploadedById:
        (!query.entityType || !query.entityId) && user && !isAdmin(user)
          ? user.id
          : undefined,
      OR: search
        ? [
            { originalName: { contains: search } },
            { title: { contains: search } },
            { description: { contains: search } },
          ]
        : undefined,
    };
  }

  private async ensureEntityExists(
    entityType: string,
    entityId: string,
    user?: RequestUser,
  ) {
    if (!ALLOWED_ENTITY_TYPES.includes(entityType as never)) {
      throw new BadRequestException(`Unsupported entityType: ${entityType}`);
    }

    const exists = await this.findEntity(entityType, entityId, user);

    if (!exists) {
      throw new BadRequestException(`${entityType} does not exist`);
    }
  }

  private findEntity(entityType: string, entityId: string, user?: RequestUser) {
    switch (entityType) {
      case 'Machine':
        return this.prisma.machine.findFirst({
          where: { AND: [{ id: entityId }, machineAccessWhere(user)] },
        });
      case 'MachineModel':
        return this.prisma.machineModel.findUnique({ where: { id: entityId } });
      case 'Repair':
        return this.prisma.repair.findFirst({
          where: { AND: [{ id: entityId }, repairAccessWhere(user)] },
        });
      case 'Maintenance':
        return this.prisma.maintenance.findFirst({
          where: { AND: [{ id: entityId }, maintenanceAccessWhere(user)] },
        });
      case 'Customer':
        return this.prisma.customer.findFirst({
          where: { AND: [{ id: entityId }, customerAccessWhere(user)] },
        });
      case 'EngineerProfile':
        return this.prisma.engineerProfile.findFirst({
          where: { id: entityId, user: userAccessWhere(user) },
        });
      case 'MachineInventoryMovement':
        return this.prisma.machineInventoryMovement.findFirst({
          where: {
            AND: [{ id: entityId }, inventoryMovementAccessWhere(user)],
          },
        });
      case 'MachineInstallation':
        return this.prisma.machineInstallation.findFirst({
          where: { AND: [{ id: entityId }, installationAccessWhere(user)] },
        });
      case 'WarrantyCard':
        return this.prisma.warrantyCard.findFirst({
          where: { id: entityId, machine: machineAccessWhere(user) },
        });
      case 'BusinessLine':
        return this.prisma.businessLine.findUnique({
          where: { id: entityId },
        });
      case 'User':
        return this.prisma.user.findFirst({
          where: { AND: [{ id: entityId }, userAccessWhere(user)] },
        });
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

  private withoutFileData<T extends { fileData?: unknown }>(attachment: T) {
    const rest = { ...attachment };
    delete rest.fileData;
    return rest;
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

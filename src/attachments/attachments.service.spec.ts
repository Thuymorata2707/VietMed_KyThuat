import { BadRequestException } from '@nestjs/common';
import { AttachmentType } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from './attachments.service';

describe('AttachmentsService', () => {
  const actor: RequestUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    roleId: 'role-admin',
    roleName: 'admin',
    regionId: 'region-1',
  };

  let prisma: any;
  let auditLogsService: jest.Mocked<AuditLogsService>;
  let service: AttachmentsService;

  beforeEach(() => {
    prisma = {
      machine: {
        findUnique: jest.fn(),
      },
      attachment: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    } as never;

    auditLogsService = {
      create: jest.fn(),
    } as never;

    service = new AttachmentsService(prisma, auditLogsService);
  });

  it('requires an uploaded file', () => {
    expect(() => service.validateUploadFile()).toThrow('file is required');
  });

  it('rejects unsupported file types', () => {
    expect(() =>
      service.validateUploadFile({
        mimetype: 'application/x-msdownload',
      } as Express.Multer.File),
    ).toThrow('Only JPEG, PNG, WEBP and PDF files are allowed');
  });

  it('creates an attachment and writes an audit log', async () => {
    const file = {
      originalname: 'machine.png',
      filename: 'stored-machine.png',
      mimetype: 'image/png',
      size: 12345,
      path: '/tmp/stored-machine.png',
    } as Express.Multer.File;
    const created = {
      id: 'attachment-1',
      entityType: 'Machine',
      entityId: 'machine-1',
      type: AttachmentType.MACHINE_PHOTO,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
    const tx = {
      attachment: {
        create: jest.fn().mockResolvedValue(created),
      },
    };

    prisma.machine.findUnique.mockResolvedValue({ id: 'machine-1' } as never);
    prisma.$transaction.mockImplementation((callback: any) =>
      callback(tx),
    );

    await expect(
      service.create(
        {
          entityType: 'Machine',
          entityId: 'machine-1',
          type: AttachmentType.MACHINE_PHOTO,
          title: ' Ảnh máy ',
        },
        file,
        actor,
      ),
    ).resolves.toEqual(created);

    expect(tx.attachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'Machine',
          entityId: 'machine-1',
          type: AttachmentType.MACHINE_PHOTO,
          originalName: 'machine.png',
          storedName: 'stored-machine.png',
          mimeType: 'image/png',
          url: '/attachments/stored-machine.png/file',
          title: 'Ảnh máy',
          uploadedById: actor.id,
          uploadedByEmail: actor.email,
        }),
      }),
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPLOAD_ATTACHMENT',
        entityType: 'Machine',
        entityId: 'machine-1',
        actor,
      }),
      tx,
    );
  });

  it('rejects attachments for unsupported entity types', async () => {
    await expect(
      service.create(
        {
          entityType: 'Unknown',
          entityId: 'unknown-1',
        },
        {
          mimetype: 'image/png',
        } as Express.Multer.File,
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

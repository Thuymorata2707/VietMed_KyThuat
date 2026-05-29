import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';

type AuditTx = Prisma.TransactionClient | PrismaService;

type CreateAuditLogInput = {
  action: string;
  entityType: string;
  entityId: string;
  actor?: RequestUser;
  changes?: unknown;
  metadata?: unknown;
};

type FindAllAuditLogsQuery = {
  entityType?: string;
  entityId?: string;
  actorId?: string;
};

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateAuditLogInput, tx: AuditTx = this.prisma) {
    return tx.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        actorId: input.actor?.id,
        actorEmail: input.actor?.email,
        changes: this.toJson(input.changes),
        metadata: this.toJson(input.metadata),
      },
    });
  }

  findAll(query: FindAllAuditLogsQuery) {
    return this.prisma.auditLog.findMany({
      where: {
        entityType: query.entityType,
        entityId: query.entityId,
        actorId: query.actorId,
      },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 200,
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (value === undefined || value === null) {
      return Prisma.JsonNull;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}

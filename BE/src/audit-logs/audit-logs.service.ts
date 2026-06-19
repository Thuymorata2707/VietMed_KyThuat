import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser } from '../common/request-user.type';
import { PaginatedResult } from '../common/paginated-result.type';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from './audit-actions';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

type AuditTx = Prisma.TransactionClient | PrismaService;

type CreateAuditLogInput = {
  action: AuditAction | string;
  entityType: string;
  entityId: string;
  actor?: RequestUser;
  changes?: unknown;
  metadata?: unknown;
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

  async findAll(
    query: ListAuditLogsQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = this.buildFindAllWhere(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
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
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

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

  private buildFindAllWhere(
    query: ListAuditLogsQueryDto,
  ): Prisma.AuditLogWhereInput {
    return {
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      actorId: query.actorId,
      actorEmail: query.actorEmail
        ? {
            contains: query.actorEmail.trim(),
            
          }
        : undefined,
      createdAt:
        query.from || query.to
          ? {
              gte: query.from ? this.parseDate(query.from, 'from') : undefined,
              lte: query.to ? this.parseDate(query.to, 'to') : undefined,
            }
          : undefined,
    };
  }

  private parseDate(value: string, fieldName: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }

    return date;
  }

  private toJson(
    value: unknown,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (value === undefined || value === null) {
      return Prisma.JsonNull;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}

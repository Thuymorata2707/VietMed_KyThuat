import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  createdById?: string | null;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  findForUser(userId: string, limit = 10) {
    const take = Math.min(Math.max(limit, 1), 50);

    return this.prisma.notification.findMany({
      where: { userId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take,
    });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        readAt: notification.readAt ?? new Date(),
      },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { updated: true };
  }

  create(input: CreateNotificationInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;

    return client.notification.create({
      data: {
        userId: input.userId,
        title: input.title.trim(),
        message: input.message.trim(),
        href: input.href?.trim() || null,
        entityType: input.entityType?.trim() || null,
        entityId: input.entityId?.trim() || null,
        createdById: input.createdById || null,
      },
    });
  }
}

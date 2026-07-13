import { Injectable, MessageEvent, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, Subject } from 'rxjs';
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
  private readonly streams = new Map<string, Set<Subject<MessageEvent>>>();

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

  async create(input: CreateNotificationInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;

    const notification = await client.notification.create({
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
    this.emitToUser(input.userId, {
      type: 'notification',
      notification,
      entityType: notification.entityType,
      entityId: notification.entityId,
    });
    return notification;
  }

  async createForAdmins(
    input: Omit<CreateNotificationInput, 'userId'>,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const admins = await client.user.findMany({
      where: {
        role: {
          name: {
            in: ['admin', 'quản trị viên', 'quan tri vien'],
          },
        },
        status: 'ACTIVE',
      },
      select: {
        id: true,
      },
    });

    if (!admins.length) {
      return [];
    }

    return Promise.all(
      admins.map((admin) =>
        this.create(
          {
            ...input,
            userId: admin.id,
          },
          tx,
        ),
      ),
    );
  }

  streamForUser(userId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const subject = new Subject<MessageEvent>();
      const streams = this.streams.get(userId) ?? new Set<Subject<MessageEvent>>();
      streams.add(subject);
      this.streams.set(userId, streams);

      const subscription = subject.subscribe(subscriber);
      subject.next({ type: 'connected', data: { ok: true } });
      const heartbeat = setInterval(() => {
        subject.next({ type: 'heartbeat', data: { at: new Date().toISOString() } });
      }, 25_000);

      return () => {
        clearInterval(heartbeat);
        subscription.unsubscribe();
        streams.delete(subject);
        if (!streams.size) this.streams.delete(userId);
      };
    });
  }

  private emitToUser(userId: string, data: Record<string, unknown>) {
    const streams = this.streams.get(userId);
    if (!streams?.size) return;
    streams.forEach((stream) => stream.next({ type: 'notification', data }));
  }
}

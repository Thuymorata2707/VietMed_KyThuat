import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DailyWorkStatus, DailyWorkType, Prisma } from '@prisma/client';
import { isAdmin, isEngineer, userAccessWhere } from '../auth/access-scope';
import { RequestUser } from '../common/request-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDailyWorkNoteDto } from './dto/create-daily-work-note.dto';
import { ListDailyWorkNotesQueryDto } from './dto/list-daily-work-notes-query.dto';
import { ReviewDailyWorkNoteDto } from './dto/review-daily-work-note.dto';
import { UpdateDailyWorkNoteDto } from './dto/update-daily-work-note.dto';

@Injectable()
export class DailyWorkNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(query: ListDailyWorkNotesQueryDto, user: RequestUser) {
    const userId = await this.resolveReadableUserId(query.userId, user);
    const where: Prisma.DailyWorkNoteWhereInput = {
      userId,
      workDate:
        query.from || query.to
          ? {
              gte: query.from ? this.parseDate(query.from, 'from') : undefined,
              lte: query.to ? this.parseDate(query.to, 'to') : undefined,
            }
          : undefined,
      type: query.type,
      status: query.status,
    };

    return this.prisma.dailyWorkNote.findMany({
      where,
      include: this.defaultInclude(),
      orderBy: [
        { workDate: 'asc' },
        { startTime: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async create(dto: CreateDailyWorkNoteDto, user: RequestUser) {
    if (!isEngineer(user) && !isAdmin(user)) {
      throw new ForbiddenException(
        'You do not have permission for this action',
      );
    }

    const targetUserId = isAdmin(user) && dto.userId ? dto.userId : user.id;
    await this.ensureUserExists(targetUserId, user);
    const type = dto.type || DailyWorkType.WORK;
    const status = this.resolveCreateStatus(dto.status, type, user);
    const workDate = this.parseDate(dto.workDate, 'workDate');
    await this.ensureNoLeaveScheduleConflict(targetUserId, workDate, type);
    const reviewedByAdmin =
      isAdmin(user) && status === DailyWorkStatus.APPROVED;

    const note = await this.prisma.dailyWorkNote.create({
      data: {
        userId: targetUserId,
        title: this.cleanRequired(dto.title, 'title'),
        note: this.cleanOptional(dto.note),
        workDate,
        startTime: this.cleanOptional(dto.startTime),
        endTime: this.cleanOptional(dto.endTime),
        color: this.cleanOptional(dto.color),
        type,
        status,
        reviewedAt: reviewedByAdmin ? new Date() : null,
        reviewerId: reviewedByAdmin ? user.id : null,
      },
      include: this.defaultInclude(),
    });

    if (isAdmin(user) && targetUserId !== user.id) {
      await this.notificationsService
        .create({
          userId: targetUserId,
          title: 'Lịch công việc mới',
          message: `Đã bổ sung lịch công việc ${note.title} vào ngày ${this.formatDate(note.workDate)}.`,
          href: '/daily-work',
          entityType: 'DailyWorkNote',
          entityId: note.id,
          createdById: user.id,
        })
        .catch(() => null);
    }

    return note;
  }

  async update(id: string, dto: UpdateDailyWorkNoteDto, user: RequestUser) {
    const current = await this.findEditableNote(id, user);
    const type = dto.type || current.type;
    const statusPatch = this.resolveUpdateStatus(dto, current, type, user);
    const workDate =
      dto.workDate === undefined
        ? current.workDate
        : this.parseDate(dto.workDate, 'workDate');
    if (!this.isInactiveStatus(dto.status)) {
      await this.ensureNoLeaveScheduleConflict(
        current.userId,
        workDate,
        type,
        current.id,
      );
    }

    return this.prisma.dailyWorkNote.update({
      where: { id: current.id },
      data: {
        title:
          dto.title === undefined
            ? undefined
            : this.cleanRequired(dto.title, 'title'),
        note: dto.note === undefined ? undefined : this.cleanOptional(dto.note),
        workDate: dto.workDate === undefined ? undefined : workDate,
        startTime:
          dto.startTime === undefined
            ? undefined
            : this.cleanOptional(dto.startTime),
        endTime:
          dto.endTime === undefined
            ? undefined
            : this.cleanOptional(dto.endTime),
        color:
          dto.color === undefined ? undefined : this.cleanOptional(dto.color),
        type: dto.type,
        ...statusPatch,
      },
      include: this.defaultInclude(),
    });
  }

  async review(id: string, dto: ReviewDailyWorkNoteDto, user: RequestUser) {
    if (!isAdmin(user)) {
      throw new ForbiddenException('Only admins can review daily work notes');
    }

    if (
      dto.status !== DailyWorkStatus.APPROVED &&
      dto.status !== DailyWorkStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Review status must be APPROVED or REJECTED',
      );
    }

    const current = await this.findNote(id);
    await this.ensureUserExists(current.userId, user);
    const note = await this.prisma.dailyWorkNote.update({
      where: { id: current.id },
      data: {
        status: dto.status,
        reviewedAt: new Date(),
        reviewerId: user.id,
        rejectReason:
          dto.status === DailyWorkStatus.REJECTED
            ? this.cleanOptional(dto.rejectReason) || 'Quản trị viên từ chối lịch công việc.'
            : null,
      },
      include: this.defaultInclude(),
    });

    await this.notificationsService
      .create({
        userId: note.userId,
        title:
          dto.status === DailyWorkStatus.APPROVED
            ? 'Lịch công việc đã được duyệt'
            : 'Lịch công việc cần chỉnh lại',
        message:
          dto.status === DailyWorkStatus.APPROVED
            ? `${note.title} ngày ${this.formatDate(note.workDate)} đã được duyệt.`
            : `${note.title} ngày ${this.formatDate(note.workDate)} chưa được duyệt.`,
        href: '/daily-work',
        entityType: 'DailyWorkNote',
        entityId: note.id,
        createdById: user.id,
      })
      .catch(() => null);

    return note;
  }

  async remove(id: string, user: RequestUser) {
    const current = await this.findEditableNote(id, user);
    await this.prisma.dailyWorkNote.delete({ where: { id: current.id } });
    return { deleted: true };
  }

  private resolveReadableUserId(
    queryUserId: string | undefined,
    user: RequestUser,
  ) {
    if (isAdmin(user)) {
      const targetUserId = queryUserId || user.id;
      return this.ensureUserExists(targetUserId, user).then(() => targetUserId);
    }

    return Promise.resolve(user.id);
  }

  private async findNote(id: string) {
    const note = await this.prisma.dailyWorkNote.findUnique({ where: { id } });

    if (!note) {
      throw new NotFoundException('Daily work note not found');
    }

    return note;
  }

  private async findEditableNote(id: string, user: RequestUser) {
    const note = await this.findNote(id);

    if (!isAdmin(user) && note.userId !== user.id) {
      throw new ForbiddenException('You can only edit your own notes');
    }
    if (isAdmin(user)) {
      await this.ensureUserExists(note.userId, user);
    }

    return note;
  }

  private resolveCreateStatus(
    requestedStatus: DailyWorkStatus | undefined,
    type: DailyWorkType,
    user: RequestUser,
  ) {
    if (isAdmin(user)) {
      return requestedStatus || DailyWorkStatus.APPROVED;
    }

    return this.needsApproval(type)
      ? DailyWorkStatus.PENDING
      : DailyWorkStatus.APPROVED;
  }

  private resolveUpdateStatus(
    dto: UpdateDailyWorkNoteDto,
    current: { status: DailyWorkStatus; type: DailyWorkType },
    type: DailyWorkType,
    user: RequestUser,
  ): Prisma.DailyWorkNoteUpdateInput {
    if (isAdmin(user) && dto.status) {
      const reviewed =
        dto.status === DailyWorkStatus.APPROVED ||
        dto.status === DailyWorkStatus.REJECTED;
      return {
        status: dto.status,
        reviewedAt: reviewed ? new Date() : null,
        reviewer: reviewed
          ? { connect: { id: user.id } }
          : { disconnect: true },
        rejectReason:
          dto.status === DailyWorkStatus.REJECTED
            ? this.cleanOptional(dto.rejectReason)
            : null,
      };
    }

    if (dto.status === DailyWorkStatus.CANCELLED) {
      return {
        status: DailyWorkStatus.CANCELLED,
        reviewedAt: null,
        reviewer: { disconnect: true },
        rejectReason: null,
      };
    }

    if (!this.hasReviewableChange(dto)) {
      return {};
    }

    const nextStatus = this.needsApproval(type)
      ? DailyWorkStatus.PENDING
      : DailyWorkStatus.APPROVED;

    if (current.status === nextStatus && current.type === type) {
      return {};
    }

    return {
      status: nextStatus,
      reviewedAt: null,
      reviewer: { disconnect: true },
      rejectReason: null,
    };
  }

  private needsApproval(type: DailyWorkType) {
    return (
      type === DailyWorkType.LEAVE ||
      type === DailyWorkType.UNPAID_LEAVE ||
      type === DailyWorkType.BUSINESS_TRIP
    );
  }

  private async ensureNoLeaveScheduleConflict(
    userId: string,
    workDate: Date,
    nextType: DailyWorkType,
    excludeId?: string,
  ) {
    const activeNotes = await this.prisma.dailyWorkNote.findMany({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        userId,
        workDate: {
          gte: this.startOfDay(workDate),
          lt: this.startOfNextDay(workDate),
        },
        status: {
          notIn: [DailyWorkStatus.REJECTED, DailyWorkStatus.CANCELLED],
        },
      },
      select: {
        id: true,
        type: true,
      },
    });

    if (!activeNotes.length) return;

    const hasLeave = activeNotes.some((note) => this.isLeaveType(note.type));

    if (this.isLeaveType(nextType) || hasLeave) {
      throw new BadRequestException(
        'Ngày đã đăng ký nghỉ thì không thêm lịch khác.',
      );
    }
  }

  private isLeaveType(type: DailyWorkType) {
    return type === DailyWorkType.LEAVE || type === DailyWorkType.UNPAID_LEAVE;
  }

  private isInactiveStatus(status?: DailyWorkStatus) {
    return (
      status === DailyWorkStatus.REJECTED ||
      status === DailyWorkStatus.CANCELLED
    );
  }

  private startOfDay(value: Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  private startOfNextDay(value: Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate() + 1);
  }

  private hasReviewableChange(dto: UpdateDailyWorkNoteDto) {
    return Boolean(
      dto.title !== undefined ||
      dto.note !== undefined ||
      dto.workDate !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined ||
      dto.color !== undefined ||
      dto.type !== undefined,
    );
  }

  private async ensureUserExists(id: string, actor?: RequestUser) {
    const user = await this.prisma.user.findFirst({
      where: { AND: [{ id }, userAccessWhere(actor)] },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private cleanRequired(value: string, fieldName: string) {
    const cleaned = value.trim();
    if (!cleaned) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return cleaned;
  }

  private cleanOptional(value?: string | null) {
    return value?.trim() || null;
  }

  private parseDate(value: string, fieldName: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }
    return date;
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(value);
  }

  private defaultInclude() {
    return {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          region: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    };
  }
}

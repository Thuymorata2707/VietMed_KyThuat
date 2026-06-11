import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isAdmin, isEngineer } from '../auth/access-scope';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDailyWorkNoteDto } from './dto/create-daily-work-note.dto';
import { ListDailyWorkNotesQueryDto } from './dto/list-daily-work-notes-query.dto';
import { UpdateDailyWorkNoteDto } from './dto/update-daily-work-note.dto';

@Injectable()
export class DailyWorkNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListDailyWorkNotesQueryDto, user: RequestUser) {
    const userId = this.resolveReadableUserId(query.userId, user);
    const where: Prisma.DailyWorkNoteWhereInput = {
      userId,
      workDate:
        query.from || query.to
          ? {
              gte: query.from ? this.parseDate(query.from, 'from') : undefined,
              lte: query.to ? this.parseDate(query.to, 'to') : undefined,
            }
          : undefined,
    };

    return this.prisma.dailyWorkNote.findMany({
      where,
      include: this.defaultInclude(),
      orderBy: [{ workDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(dto: CreateDailyWorkNoteDto, user: RequestUser) {
    if (!isEngineer(user) && !isAdmin(user)) {
      throw new ForbiddenException('You do not have permission for this action');
    }

    return this.prisma.dailyWorkNote.create({
      data: {
        userId: user.id,
        title: this.cleanRequired(dto.title, 'title'),
        note: this.cleanOptional(dto.note),
        workDate: this.parseDate(dto.workDate, 'workDate'),
        startTime: this.cleanOptional(dto.startTime),
        endTime: this.cleanOptional(dto.endTime),
        color: this.cleanOptional(dto.color),
      },
      include: this.defaultInclude(),
    });
  }

  async update(id: string, dto: UpdateDailyWorkNoteDto, user: RequestUser) {
    const current = await this.findOwnedNote(id, user);

    return this.prisma.dailyWorkNote.update({
      where: { id: current.id },
      data: {
        title:
          dto.title === undefined
            ? undefined
            : this.cleanRequired(dto.title, 'title'),
        note: dto.note === undefined ? undefined : this.cleanOptional(dto.note),
        workDate:
          dto.workDate === undefined
            ? undefined
            : this.parseDate(dto.workDate, 'workDate'),
        startTime:
          dto.startTime === undefined
            ? undefined
            : this.cleanOptional(dto.startTime),
        endTime:
          dto.endTime === undefined ? undefined : this.cleanOptional(dto.endTime),
        color: dto.color === undefined ? undefined : this.cleanOptional(dto.color),
      },
      include: this.defaultInclude(),
    });
  }

  async remove(id: string, user: RequestUser) {
    const current = await this.findOwnedNote(id, user);
    await this.prisma.dailyWorkNote.delete({ where: { id: current.id } });
    return { deleted: true };
  }

  private resolveReadableUserId(queryUserId: string | undefined, user: RequestUser) {
    if (isAdmin(user)) {
      return queryUserId || user.id;
    }

    return user.id;
  }

  private async findOwnedNote(id: string, user: RequestUser) {
    const note = await this.prisma.dailyWorkNote.findUnique({ where: { id } });

    if (!note) {
      throw new NotFoundException('Daily work note not found');
    }

    if (note.userId !== user.id) {
      throw new ForbiddenException('You can only edit your own notes');
    }

    return note;
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
    };
  }
}

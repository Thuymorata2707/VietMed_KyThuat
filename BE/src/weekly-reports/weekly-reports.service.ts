import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WeeklyReportStatus } from '@prisma/client';
import { isAdmin, isEngineer } from '../auth/access-scope';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { SaveWeeklyReportDto } from './dto/save-weekly-report.dto';
import { WeeklyReportRowDto } from './dto/weekly-report-row.dto';

@Injectable()
export class WeeklyReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByWeek({
    user,
    weekStart,
    userId,
  }: {
    user: RequestUser;
    weekStart?: string;
    userId?: string;
  }) {
    this.assertCanUseWeeklyReports(user);
    const targetUserId = this.resolveTargetUserId(user, userId);
    const parsedWeekStart = this.parseDate(weekStart || this.currentWeekStart(), 'weekStart');

    return this.prisma.weeklyReport.findUnique({
      where: {
        userId_weekStart: {
          userId: targetUserId,
          weekStart: parsedWeekStart,
        },
      },
      include: this.defaultInclude(),
    });
  }

  async save(dto: SaveWeeklyReportDto, user: RequestUser) {
    this.assertCanUseWeeklyReports(user);
    const targetUserId = this.resolveTargetUserId(user, dto.userId);
    await this.ensureUserExists(targetUserId);
    const weekStart = this.parseDate(dto.weekStart, 'weekStart');
    const rows = this.normalizeRows(dto.rows || []);

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.weeklyReport.upsert({
        where: {
          userId_weekStart: {
            userId: targetUserId,
            weekStart,
          },
        },
        create: {
          userId: targetUserId,
          weekStart,
          note: this.cleanOptional(dto.note),
          status: WeeklyReportStatus.DRAFT,
        },
        update: {
          note: this.cleanOptional(dto.note),
          status: WeeklyReportStatus.DRAFT,
          submittedAt: null,
          reviewedAt: null,
          reviewerId: null,
        },
      });

      await tx.weeklyReportRow.deleteMany({ where: { reportId: report.id } });

      if (rows.length) {
        await tx.weeklyReportRow.createMany({
          data: rows.map((row, index) => ({
            reportId: report.id,
            workDate: this.parseDate(row.workDate, `rows.${index}.workDate`),
            customer: this.cleanOptional(row.customer),
            machine: this.cleanOptional(row.machine),
            content: this.cleanOptional(row.content),
            result: this.cleanOptional(row.result),
            pending: this.cleanOptional(row.pending),
            proposal: this.cleanOptional(row.proposal),
            sortOrder: row.sortOrder ?? index,
          })),
        });
      }

      return tx.weeklyReport.findUniqueOrThrow({
        where: { id: report.id },
        include: this.defaultInclude(),
      });
    });
  }

  async update(id: string, dto: SaveWeeklyReportDto, user: RequestUser) {
    const report = await this.findAccessibleReport(id, user);
    const nextDto = {
      ...dto,
      userId: report.userId,
      weekStart: dto.weekStart || report.weekStart.toISOString(),
    };

    return this.save(nextDto, user);
  }

  async submit(id: string, user: RequestUser) {
    const report = await this.findAccessibleReport(id, user);

    if (report.rows.length === 0) {
      throw new BadRequestException('Weekly report must have at least one row');
    }

    return this.prisma.weeklyReport.update({
      where: { id },
      data: {
        status: WeeklyReportStatus.SUBMITTED,
        submittedAt: new Date(),
      },
      include: this.defaultInclude(),
    });
  }

  private async findAccessibleReport(id: string, user: RequestUser) {
    this.assertCanUseWeeklyReports(user);
    const report = await this.prisma.weeklyReport.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });

    if (!report) {
      throw new NotFoundException('Weekly report not found');
    }

    if (!isAdmin(user) && report.userId !== user.id) {
      throw new ForbiddenException('You can only access your own weekly report');
    }

    return report;
  }

  private assertCanUseWeeklyReports(user: RequestUser) {
    if (!isAdmin(user) && !isEngineer(user)) {
      throw new ForbiddenException('You do not have permission for this action');
    }
  }

  private resolveTargetUserId(user: RequestUser, userId?: string) {
    if (isAdmin(user)) {
      return userId || user.id;
    }

    return user.id;
  }

  private async ensureUserExists(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private normalizeRows(rows: WeeklyReportRowDto[]) {
    return rows.filter((row) =>
      [
        row.customer,
        row.machine,
        row.content,
        row.result,
        row.pending,
        row.proposal,
      ].some((value) => value?.trim()),
    );
  }

  private parseDate(value: string, fieldName: string) {
    const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }
    return date;
  }

  private currentWeekStart() {
    const now = new Date();
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    return monday.toISOString().slice(0, 10);
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

  private defaultInclude() {
    return {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
      rows: {
        orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
      },
    };
  }
}

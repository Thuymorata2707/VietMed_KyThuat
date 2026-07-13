import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DailyReportStatus, DailyWorkStatus } from '@prisma/client';
import { isAdmin, isEngineer } from '../auth/access-scope';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewDailyReportDto } from './dto/review-daily-report.dto';
import { SaveDailyReportDto } from './dto/save-daily-report.dto';

@Injectable()
export class DailyReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByDate({ user, reportDate, userId }: { user: RequestUser; reportDate?: string; userId?: string }) {
    this.assertCanUseDailyReports(user);
    const targetUserId = this.resolveTargetUserId(user, userId);
    const date = this.startOfDay(this.parseDate(reportDate || new Date().toISOString(), 'reportDate'));
    const report = await this.prisma.dailyReport.findUnique({
      where: { userId_reportDate: { userId: targetUserId, reportDate: date } },
      include: this.defaultInclude(),
    });
    const suggested = await this.buildSuggestedReport(targetUserId, date);
    return { report, suggested };
  }

  async save(dto: SaveDailyReportDto, user: RequestUser) {
    this.assertCanUseDailyReports(user);
    const targetUserId = this.resolveTargetUserId(user, dto.userId);
    await this.ensureUserExists(targetUserId);
    const reportDate = this.startOfDay(this.parseDate(dto.reportDate, 'reportDate'));

    return this.prisma.dailyReport.upsert({
      where: { userId_reportDate: { userId: targetUserId, reportDate } },
      create: {
        userId: targetUserId,
        reportDate,
        status: DailyReportStatus.DRAFT,
        summary: this.cleanOptional(dto.summary),
        pending: this.cleanOptional(dto.pending),
        proposal: this.cleanOptional(dto.proposal),
      },
      update: {
        status: DailyReportStatus.DRAFT,
        summary: this.cleanOptional(dto.summary),
        pending: this.cleanOptional(dto.pending),
        proposal: this.cleanOptional(dto.proposal),
        submittedAt: null,
        reviewedAt: null,
        reviewerId: null,
        reviewNote: null,
      },
      include: this.defaultInclude(),
    });
  }

  async submit(id: string, user: RequestUser) {
    const report = await this.findAccessibleReport(id, user);
    if (!report.summary?.trim() && !report.pending?.trim() && !report.proposal?.trim()) {
      throw new BadRequestException('Daily report must have content before submit');
    }

    return this.prisma.dailyReport.update({
      where: { id },
      data: {
        status: DailyReportStatus.SUBMITTED,
        submittedAt: new Date(),
        reviewedAt: null,
        reviewerId: null,
        reviewNote: null,
      },
      include: this.defaultInclude(),
    });
  }

  async review(id: string, dto: ReviewDailyReportDto, user: RequestUser) {
    if (!isAdmin(user)) throw new ForbiddenException('Only admin can review daily reports');
    if (dto.status !== DailyReportStatus.APPROVED && dto.status !== DailyReportStatus.NEEDS_REVISION) {
      throw new BadRequestException('Invalid review status');
    }
    if (dto.status === DailyReportStatus.NEEDS_REVISION && !dto.reviewNote?.trim()) {
      throw new BadRequestException('reviewNote is required when requesting revision');
    }

    await this.findAccessibleReport(id, user);
    return this.prisma.dailyReport.update({
      where: { id },
      data: {
        status: dto.status,
        reviewNote: this.cleanOptional(dto.reviewNote),
        reviewedAt: new Date(),
        reviewerId: user.id,
      },
      include: this.defaultInclude(),
    });
  }

  private async buildSuggestedReport(userId: string, reportDate: Date) {
    const start = this.startOfDay(reportDate);
    const end = this.endOfDay(reportDate);
    const [dailyNotes, repairs, maintenances, installations] = await Promise.all([
      this.prisma.dailyWorkNote.findMany({
        where: {
          userId,
          workDate: { gte: start, lte: end },
          status: { notIn: [DailyWorkStatus.REJECTED, DailyWorkStatus.CANCELLED] },
        },
        orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.repair.findMany({
        where: { engineerId: userId, OR: [{ completedAt: { gte: start, lte: end } }, { reportedAt: { gte: start, lte: end } }] },
        include: { customer: true, machine: { include: { customer: true } } },
        orderBy: [{ completedAt: 'asc' }, { reportedAt: 'asc' }],
      }),
      this.prisma.maintenance.findMany({
        where: { engineerId: userId, OR: [{ completedAt: { gte: start, lte: end } }, { scheduledDate: { gte: start, lte: end } }] },
        include: { customer: true, machine: { include: { customer: true } } },
        orderBy: [{ completedAt: 'asc' }, { scheduledDate: 'asc' }],
      }),
      this.prisma.machineInstallation.findMany({
        where: { installedById: userId, installedAt: { gte: start, lte: end } },
        include: { customer: true, machine: true, plannedMachineModel: true },
        orderBy: { installedAt: 'asc' },
      }),
    ]);

    const lines = [
      ...dailyNotes.map((note) => `- Lịch: ${note.title}${note.note ? ` - ${note.note}` : ''}`),
      ...repairs.map((item) => `- Sửa chữa ${item.code}: ${item.title}${item.resultNote ? ` - ${item.resultNote}` : ''}`),
      ...maintenances.map((item) => `- Bảo trì ${item.code}: ${item.title}${item.resultNote ? ` - ${item.resultNote}` : ''}`),
      ...installations.map((item) => `- Lắp đặt ${item.code}: ${item.customer?.name || item.machine?.modelName || item.plannedMachineModel?.name || 'thiết bị'}${item.note ? ` - ${item.note}` : ''}`),
    ];
    const pending = [
      ...repairs.filter((item) => item.status !== 'COMPLETED' && item.status !== 'CANCELLED').map((item) => `- ${item.code}: ${item.title}`),
      ...maintenances.filter((item) => item.status !== 'COMPLETED' && item.status !== 'CANCELLED').map((item) => `- ${item.code}: ${item.title}`),
      ...installations.filter((item) => item.status !== 'INSTALLED' && item.status !== 'CANCELLED').map((item) => `- ${item.code}: ${item.customer?.name || 'lắp đặt'}`),
    ];

    return {
      reportDate: start,
      summary: lines.join('\n'),
      pending: pending.join('\n'),
      proposal: '',
      counts: {
        dailyNotes: dailyNotes.length,
        repairs: repairs.length,
        maintenances: maintenances.length,
        installations: installations.length,
      },
    };
  }

  private async findAccessibleReport(id: string, user: RequestUser) {
    const report = await this.prisma.dailyReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Daily report not found');
    if (!isAdmin(user) && report.userId !== user.id) throw new NotFoundException('Daily report not found');
    return report;
  }

  private resolveTargetUserId(user: RequestUser, userId?: string) {
    if (isAdmin(user)) return userId || user.id;
    return user.id;
  }

  private assertCanUseDailyReports(user: RequestUser) {
    if (!isAdmin(user) && !isEngineer(user)) throw new ForbiddenException('You cannot use daily reports');
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
  }

  private defaultInclude() {
    return {
      user: { select: { id: true, fullName: true, email: true } },
      reviewer: { select: { id: true, fullName: true, email: true } },
    };
  }

  private cleanOptional(value?: string | null) {
    return value?.trim() || null;
  }

  private parseDate(value: string, field: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} must be a valid date`);
    return date;
  }

  private startOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }
}

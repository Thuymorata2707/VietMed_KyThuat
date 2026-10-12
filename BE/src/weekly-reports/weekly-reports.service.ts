import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DailyWorkStatus,
  DailyWorkType,
  ApplicationSupportWorkType,
  WeeklyReportStatus,
} from '@prisma/client';
import { isAdmin, isEngineer, userAccessWhere } from '../auth/access-scope';
import { RequestUser } from '../common/request-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { ReviewWeeklyReportDto } from './dto/review-weekly-report.dto';
import { SaveWeeklyReportDto } from './dto/save-weekly-report.dto';
import { WeeklyReportRowDto } from './dto/weekly-report-row.dto';

const dailyWorkTypeLabels: Record<DailyWorkType, string> = {
  WORK: 'Công việc',
  BUSINESS_TRIP: 'Công tác',
  LEAVE: 'Nghỉ phép',
  UNPAID_LEAVE: 'Nghỉ không phép',
  REPAIR: 'Sửa chữa',
  INSTALLATION: 'Lắp đặt',
  MAINTENANCE: 'Bảo trì/Bảo dưỡng',
  OTHER: 'Khác',
};

const applicationSupportWorkTypeLabels: Record<
  ApplicationSupportWorkType,
  string
> = {
  APP_SUPPORT: 'Ứng dụng xét nghiệm',
  REAGENT_SETUP: 'Cài hóa chất',
  QC_CALIBRATION: 'QC/Calib',
  LIS_HIS: 'LIS/HIS',
  TRAINING: 'Đào tạo',
  FOLLOW_UP: 'Theo dõi ứng dụng',
  OTHER: 'Hỗ trợ khác',
};

@Injectable()
export class WeeklyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getEngineerSummary({
    user,
    from,
    to,
    userId,
  }: {
    user: RequestUser;
    from?: string;
    to?: string;
    userId?: string;
  }) {
    this.assertCanUseWeeklyReports(user);
    const targetUserId = this.resolveTargetUserId(user, userId);
    await this.ensureUserExists(targetUserId, user);
    const startDate = this.parseDate(from || this.currentWeekStart(), 'from');
    const endDate = this.endOfDay(
      this.parseDate(to || from || this.currentWeekStart(), 'to'),
    );

    if (endDate < startDate) {
      throw new BadRequestException('to must be after from');
    }

    const [
      engineer,
      installations,
      repairs,
      maintenances,
      applicationSupportCases,
      weeklyReports,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          email: true,
          fullName: true,
          engineerProfile: {
            select: {
              employeeCode: true,
              position: true,
              department: true,
              expertiseGroup: true,
            },
          },
        },
      }),
      this.prisma.machineInstallation.findMany({
        where: {
          OR: [
            { installedById: targetUserId },
            { assignments: { some: { engineerId: targetUserId } } },
          ],
          status: 'INSTALLED',
          installedAt: { gte: startDate, lte: endDate },
        },
        include: {
          customer: true,
          machine: true,
          businessLine: true,
          plannedMachineModel: true,
        },
        orderBy: { installedAt: 'asc' },
      }),
      this.prisma.repair.findMany({
        where: {
          OR: [
            { engineerId: targetUserId },
            { assignments: { some: { engineerId: targetUserId } } },
          ],
          completedAt: { gte: startDate, lte: endDate },
        },
        include: {
          customer: true,
          machine: {
            include: {
              customer: true,
              businessLine: true,
            },
          },
        },
        orderBy: { completedAt: 'asc' },
      }),
      this.prisma.maintenance.findMany({
        where: {
          OR: [
            { engineerId: targetUserId },
            { assignments: { some: { engineerId: targetUserId } } },
          ],
          completedAt: { gte: startDate, lte: endDate },
        },
        include: {
          machine: {
            include: {
              customer: true,
              businessLine: true,
            },
          },
        },
        orderBy: { completedAt: 'asc' },
      }),
      this.prisma.applicationSupportCase.findMany({
        where: {
          engineerId: targetUserId,
          supportedAt: { gte: startDate, lte: endDate },
        },
        include: {
          customer: true,
          machine: { include: { customer: true, businessLine: true } },
        },
        orderBy: { supportedAt: 'asc' },
      }),
      this.prisma.weeklyReport.findMany({
        where: {
          userId: targetUserId,
          rows: {
            some: {
              workDate: { gte: startDate, lte: endDate },
            },
          },
        },
        select: {
          id: true,
          weekStart: true,
          status: true,
          note: true,
          submittedAt: true,
          rows: {
            where: {
              workDate: { gte: startDate, lte: endDate },
            },
            orderBy: [{ workDate: 'asc' }, { sortOrder: 'asc' }],
            select: {
              id: true,
              workDate: true,
              customer: true,
              machine: true,
              content: true,
              result: true,
              pending: true,
              proposal: true,
              sortOrder: true,
            },
          },
        },
        orderBy: { weekStart: 'asc' },
      }),
    ]);

    const activities = [
      ...installations.map((item) => ({
        id: item.id,
        kind: 'installation' as const,
        code: item.id,
        date: item.installedAt,
        status: item.status,
        customer: this.customerSummary(item.customer),
        machine: this.machineSummary(item.machine, {
          modelName:
            item.machine?.modelName ??
            item.plannedMachineModel?.name ??
            item.plannedModelName,
          serialNumber: item.machine?.serialNumber,
          productCategory:
            item.machine?.productCategory ??
            item.businessLine?.productCategory ??
            item.plannedMachineModel?.productCategory,
        }),
        title: 'Lắp đặt máy',
        result: item.note,
      })),
      ...repairs.map((item) => ({
        id: item.id,
        kind: 'repair' as const,
        code: item.code,
        date: item.completedAt ?? item.reportedAt,
        status: item.status,
        customer: this.customerSummary(item.customer ?? item.machine?.customer, {
          name: item.representative || item.usingDepartment,
          phone: item.contactPhone,
          address: item.address,
        }),
        machine: this.machineSummary(item.machine, {
          modelName: item.modelName,
          serialNumber: item.serialNumber,
          name: item.deviceName,
        }),
        title: item.title,
        result: item.resultNote || item.repairMethod,
      })),
      ...maintenances.map((item) => ({
        id: item.id,
        kind: 'maintenance' as const,
        code: item.code,
        date: item.completedAt ?? item.scheduledDate,
        status: item.status,
        customer: this.customerSummary(item.machine?.customer, {
          name: item.representative || item.usingDepartment,
          phone: item.contactPhone,
          address: item.address,
        }),
        machine: this.machineSummary(item.machine, {
          modelName: item.modelName,
          serialNumber: item.serialNumber,
          name: item.deviceName,
        }),
        title: item.title,
        result: item.resultNote,
      })),
      ...applicationSupportCases.map((item) => ({
        id: item.id,
        kind: 'applicationSupport' as const,
        code: `APP-${item.id.slice(-8).toUpperCase()}`,
        date: item.supportedAt,
        status: item.status,
        customer: this.customerSummary(item.customer, {
          name: item.customerName,
        }),
        machine: this.machineSummary(item.machine, {
          modelName: item.machine?.modelName ?? item.machineText,
          serialNumber: item.machine?.serialNumber,
        }),
        title: `${applicationSupportWorkTypeLabel(item.workType)}: ${item.title}`,
        result: item.resolution,
      })),
    ].sort((left, right) => left.date.getTime() - right.date.getTime());

    const customerMap = new Map<
      string,
      {
        id: string;
        code?: string | null;
        name: string;
        status?: string | null;
        province?: string | null;
        phone?: string | null;
        installationCount: number;
        repairCount: number;
        maintenanceCount: number;
        applicationSupportCount: number;
        machineIds: Set<string>;
      }
    >();

    for (const activity of activities) {
      const key = activity.customer.id || activity.customer.name || 'unknown';
      const current = customerMap.get(key) ?? {
        id: activity.customer.id,
        code: activity.customer.code,
        name: activity.customer.name || 'Chưa rõ khách hàng',
        status: activity.customer.status,
        province: activity.customer.province,
        phone: activity.customer.phone,
        installationCount: 0,
        repairCount: 0,
        maintenanceCount: 0,
        applicationSupportCount: 0,
        machineIds: new Set<string>(),
      };

      if (activity.kind === 'installation') current.installationCount += 1;
      if (activity.kind === 'repair') current.repairCount += 1;
      if (activity.kind === 'maintenance') current.maintenanceCount += 1;
      if (activity.kind === 'applicationSupport')
        current.applicationSupportCount += 1;
      if (activity.machine.id) current.machineIds.add(activity.machine.id);
      customerMap.set(key, current);
    }

    const customerSummaries = Array.from(customerMap.values()).map((item) => ({
      ...item,
      machineCount: item.machineIds.size,
      machineIds: undefined,
    }));

    const uniqueMachineIds = new Set(
      activities.map((item) => item.machine.id).filter(Boolean),
    );

    return {
      engineer,
      range: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
      totals: {
        installations: installations.length,
        repairs: repairs.length,
        maintenances: maintenances.length,
        applicationSupport: applicationSupportCases.length,
        activities: activities.length,
        customers: customerSummaries.length,
        machines: uniqueMachineIds.size,
      },
      customers: customerSummaries.sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
      activities,
      weeklyReports: weeklyReports.map((report) => ({
        id: report.id,
        weekStart: report.weekStart,
        status: report.status,
        note: report.note,
        submittedAt: report.submittedAt,
        rows: report.rows,
      })),
    };
  }

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
    await this.ensureUserExists(targetUserId, user);
    const parsedWeekStart = this.parseDate(
      weekStart || this.currentWeekStart(),
      'weekStart',
    );

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

  async getDailyWorkRows({
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
    await this.ensureUserExists(targetUserId, user);
    const parsedWeekStart = this.parseDate(
      weekStart || this.currentWeekStart(),
      'weekStart',
    );
    const weekEnd = this.endOfDay(this.addDays(parsedWeekStart, 5));

    const notes = await this.prisma.dailyWorkNote.findMany({
      where: {
        userId: targetUserId,
        workDate: { gte: parsedWeekStart, lte: weekEnd },
        status: {
          notIn: [DailyWorkStatus.REJECTED, DailyWorkStatus.CANCELLED],
        },
      },
      orderBy: [
        { workDate: 'asc' },
        { startTime: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const counts = notes.reduce(
      (acc, note) => {
        acc.total += 1;
        acc.byType[note.type] = (acc.byType[note.type] || 0) + 1;
        acc.byStatus[note.status] = (acc.byStatus[note.status] || 0) + 1;
        return acc;
      },
      {
        total: 0,
        byType: {} as Partial<Record<DailyWorkType, number>>,
        byStatus: {} as Partial<Record<DailyWorkStatus, number>>,
      },
    );

    return {
      weekStart: parsedWeekStart,
      weekEnd,
      counts,
      rows: notes.map((note, index) => ({
        sourceId: note.id,
        sourceType: 'DailyWorkNote',
        workDate: note.workDate,
        customer: '',
        machine: '',
        content: this.buildDailyWorkContent(note),
        result:
          note.status === DailyWorkStatus.PENDING
            ? 'Đang chờ quản trị viên phê duyệt lịch.'
            : note.note || '',
        pending: '',
        proposal: '',
        sortOrder: index,
      })),
      notes,
    };
  }

  async getTicketRows({
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
    await this.ensureUserExists(targetUserId, user);
    const parsedWeekStart = this.parseDate(
      weekStart || this.currentWeekStart(),
      'weekStart',
    );
    const weekEnd = this.endOfDay(this.addDays(parsedWeekStart, 5));

    const [installations, repairs, maintenances] = await Promise.all([
      this.prisma.machineInstallation.findMany({
        where: {
          OR: [
            { installedById: targetUserId },
            { assignments: { some: { engineerId: targetUserId } } },
          ],
          status: 'INSTALLED',
          installedAt: { gte: parsedWeekStart, lte: weekEnd },
        },
        include: {
          customer: true,
          machine: true,
          businessLine: true,
          plannedMachineModel: true,
        },
        orderBy: { installedAt: 'asc' },
      }),
      this.prisma.repair.findMany({
        where: {
          OR: [
            { engineerId: targetUserId },
            { assignments: { some: { engineerId: targetUserId } } },
          ],
          status: 'COMPLETED',
          completedAt: { gte: parsedWeekStart, lte: weekEnd },
        },
        include: {
          customer: true,
          machine: {
            include: {
              customer: true,
              businessLine: true,
            },
          },
        },
        orderBy: { completedAt: 'asc' },
      }),
      this.prisma.maintenance.findMany({
        where: {
          OR: [
            { engineerId: targetUserId },
            { assignments: { some: { engineerId: targetUserId } } },
          ],
          status: 'COMPLETED',
          completedAt: { gte: parsedWeekStart, lte: weekEnd },
        },
        include: {
          customer: true,
          machine: {
            include: {
              customer: true,
              businessLine: true,
            },
          },
        },
        orderBy: { completedAt: 'asc' },
      }),
    ]);

    const rows = [
      ...installations.map((item, index) => {
        const customer = this.customerSummary(item.customer);
        const machine = this.machineSummary(item.machine, {
          modelName:
            item.machine?.modelName ??
            item.plannedMachineModel?.displayName ??
            item.plannedMachineModel?.name ??
            item.plannedModelName,
          serialNumber: item.machine?.serialNumber,
          productCategory:
            item.machine?.productCategory ??
            item.businessLine?.productCategory ??
            item.plannedMachineModel?.productCategory,
        });

        return {
          sourceId: item.id,
          sourceType: 'MachineInstallation' as const,
          workDate: item.installedAt,
          customer: customer.name,
          machine: this.formatMachineForReport(machine),
          content: `Lắp đặt ${machine.modelName || machine.name || 'thiết bị'} (${item.code})`,
          result: item.note || 'Đã lắp đặt và bàn giao.',
          pending:
            item.reviewStatus === 'NEEDS_REVISION'
              ? item.reviewNote || 'Cần bổ sung hồ sơ lắp đặt.'
              : '',
          proposal: item.warrantyEndDate
            ? `Theo dõi bảo hành đến ${this.formatDate(item.warrantyEndDate)}.`
            : '',
          sortOrder: index,
        };
      }),
      ...repairs.map((item, index) => {
        const customer = this.customerSummary(
          item.customer ?? item.machine?.customer,
          {
            name: item.representative || item.usingDepartment,
            phone: item.contactPhone,
            address: item.address,
          },
        );
        const machine = this.machineSummary(item.machine, {
          modelName: item.modelName,
          serialNumber: item.serialNumber,
          name: item.deviceName,
        });

        return {
          sourceId: item.id,
          sourceType: 'Repair' as const,
          workDate: item.completedAt ?? item.reportedAt,
          customer: customer.name,
          machine: this.formatMachineForReport(machine),
          content: `Sửa chữa ${item.title} (${item.code})`,
          result:
            item.resultNote ||
            item.repairMethod ||
            item.customerFeedback ||
            'Đã hoàn thành sửa chữa.',
          pending:
            item.reviewStatus === 'NEEDS_REVISION'
              ? item.reviewNote || 'Cần bổ sung hồ sơ sửa chữa.'
              : '',
          proposal: item.customerFeedback || '',
          sortOrder: installations.length + index,
        };
      }),
      ...maintenances.map((item, index) => {
        const customer = this.customerSummary(
          item.customer ?? item.machine?.customer,
          {
            name: item.representative || item.usingDepartment,
            phone: item.contactPhone,
            address: item.address,
          },
        );
        const machine = this.machineSummary(item.machine, {
          modelName: item.modelName,
          serialNumber: item.serialNumber,
          name: item.deviceName,
        });

        return {
          sourceId: item.id,
          sourceType: 'Maintenance' as const,
          workDate: item.completedAt ?? item.scheduledDate,
          customer: customer.name,
          machine: this.formatMachineForReport(machine),
          content: `Bảo trì ${item.title} (${item.code})`,
          result: item.resultNote || 'Đã hoàn thành bảo trì.',
          pending:
            item.reviewStatus === 'NEEDS_REVISION'
              ? item.reviewNote || 'Cần bổ sung hồ sơ bảo trì.'
              : '',
          proposal: item.nextDueDate
            ? `Lịch bảo trì tiếp theo: ${this.formatDate(item.nextDueDate)}.`
            : '',
          sortOrder: installations.length + repairs.length + index,
        };
      }),
    ].sort((left, right) => left.workDate.getTime() - right.workDate.getTime());

    return {
      weekStart: parsedWeekStart,
      weekEnd,
      counts: {
        total: rows.length,
        installations: installations.length,
        repairs: repairs.length,
        maintenances: maintenances.length,
      },
      rows: rows.map((row, index) => ({
        ...row,
        sortOrder: index,
      })),
    };
  }

  async save(dto: SaveWeeklyReportDto, user: RequestUser) {
    this.assertCanUseWeeklyReports(user);
    const targetUserId = this.resolveTargetUserId(user, dto.userId);
    await this.ensureUserExists(targetUserId, user);
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
          learnings: this.cleanOptional(dto.learnings),
          accomplishments: this.cleanOptional(dto.accomplishments),
          timeSummary: this.cleanOptional(dto.timeSummary),
          blockers: this.cleanOptional(dto.blockers),
          nextWeekPlan: this.cleanOptional(dto.nextWeekPlan),
          status: WeeklyReportStatus.DRAFT,
        },
        update: {
          note: this.cleanOptional(dto.note),
          learnings: this.cleanOptional(dto.learnings),
          accomplishments: this.cleanOptional(dto.accomplishments),
          timeSummary: this.cleanOptional(dto.timeSummary),
          blockers: this.cleanOptional(dto.blockers),
          nextWeekPlan: this.cleanOptional(dto.nextWeekPlan),
          status: WeeklyReportStatus.DRAFT,
          submittedAt: null,
          reviewedAt: null,
          reviewerId: null,
          reviewNote: null,
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

    if (
      report.rows.length === 0 &&
      !report.learnings?.trim() &&
      !report.accomplishments?.trim() &&
      !report.timeSummary?.trim() &&
      !report.blockers?.trim() &&
      !report.nextWeekPlan?.trim() &&
      !report.note?.trim()
    ) {
      throw new BadRequestException('Weekly report must contain a summary or work row');
    }

    const updated = await this.prisma.weeklyReport.update({
      where: { id },
      data: {
        status: WeeklyReportStatus.SUBMITTED,
        submittedAt: new Date(),
        reviewedAt: null,
        reviewerId: null,
        reviewNote: null,
      },
      include: this.defaultInclude(),
    });

    await this.notificationsService
      .createForAdmins({
        title: 'Có báo cáo tuần mới',
        message: `${updated.user.fullName || updated.user.email} đã gửi báo cáo tuần ${this.formatDate(updated.weekStart)}.`,
        href: `/weekly-reports?weekStart=${updated.weekStart.toISOString().slice(0, 10)}&engineerId=${updated.userId}`,
        entityType: 'WeeklyReport',
        entityId: updated.id,
        createdById: user.id,
      })
      .catch(() => null);

    return updated;
  }

  async generateDocx(id: string, user: RequestUser) {
    const report = await this.findAccessibleReport(id, user);
    const weekStart = this.formatDate(report.weekStart);
    const weekEnd = this.formatDate(new Date(report.weekStart.getTime() + 5 * 86400000));
    const section = (title: string, body?: string | null) => [
      new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 120 } }),
      ...(body?.trim()
        ? body.split(/\r?\n/).map((line) => new Paragraph({ text: line || ' ', spacing: { after: 100 } }))
        : [new Paragraph({ children: [new TextRun({ text: 'Chưa cập nhật', italics: true, color: '888888' })] })]),
    ];
    const document = new Document({
      creator: 'VietMed Kỹ Thuật',
      title: `Báo cáo tuần ${weekStart} - ${weekEnd}`,
      sections: [{
        properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
        children: [
          new Paragraph({ text: 'BÁO CÁO CÔNG VIỆC TUẦN', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 160 } }),
          new Paragraph({ text: `Thời gian: ${weekStart} - ${weekEnd}`, alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
          new Paragraph({ text: `Kỹ sư: ${report.user.fullName || report.user.email}`, alignment: AlignmentType.CENTER, spacing: { after: 240 } }),
          ...section('1. Tóm tắt tuần', report.note),
          ...section('2. Công việc đã thực hiện và kết quả', report.accomplishments),
          ...section('3. Tiến độ và thời gian hoàn thành', report.timeSummary),
          ...section('4. Kiến thức và kinh nghiệm đã học', report.learnings),
          ...section('5. Khó khăn và nội dung cần hỗ trợ', report.blockers),
          ...section('6. Kế hoạch tuần tiếp theo', report.nextWeekPlan),
          new Paragraph({ text: '7. Nhật ký công việc', heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 120 } }),
          ...(report.rows.some((row) => [row.customer, row.machine, row.content, row.result, row.pending, row.proposal].some((value) => value?.trim()))
            ? report.rows.filter((row) => [row.customer, row.machine, row.content, row.result, row.pending, row.proposal].some((value) => value?.trim())).flatMap((row, index) => [
                new Paragraph({ text: `${index + 1}. ${this.formatDate(row.workDate)}${row.customer ? ` · ${row.customer}` : ''}${row.machine ? ` · ${row.machine}` : ''}`, heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 80 } }),
                ...[
                  ['Nội dung', row.content], ['Kết quả', row.result], ['Tồn đọng', row.pending], ['Đề xuất', row.proposal],
                ].filter(([, value]) => Boolean(value?.trim())).map(([label, value]) => new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value || '')], spacing: { after: 80 } })),
              ])
            : [new Paragraph({ children: [new TextRun({ text: 'Chưa có nhật ký công việc.', italics: true, color: '888888' })] })]),
        ],
      }],
    });
    return {
      filename: `bao-cao-tuan-${report.weekStart.toISOString().slice(0, 10)}.docx`,
      buffer: await Packer.toBuffer(document),
    };
  }

  async review(id: string, dto: ReviewWeeklyReportDto, user: RequestUser) {
    if (!isAdmin(user)) {
      throw new ForbiddenException('Only admins can review weekly reports');
    }

    if (
      dto.status !== WeeklyReportStatus.APPROVED &&
      dto.status !== WeeklyReportStatus.NEEDS_REVISION
    ) {
      throw new BadRequestException(
        'Review status must be APPROVED or NEEDS_REVISION',
      );
    }

    const report = await this.findAccessibleReport(id, user);
    if (report.status !== WeeklyReportStatus.SUBMITTED) {
      throw new BadRequestException(
        'Only submitted weekly reports can be reviewed',
      );
    }

    const updated = await this.prisma.weeklyReport.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedAt: new Date(),
        reviewerId: user.id,
        reviewNote:
          dto.status === WeeklyReportStatus.NEEDS_REVISION
            ? this.cleanOptional(dto.reviewNote) || 'Quản trị viên yêu cầu bổ sung báo cáo.'
            : this.cleanOptional(dto.reviewNote),
      },
      include: this.defaultInclude(),
    });

    await this.notificationsService
      .create({
        userId: updated.userId,
        title:
          dto.status === WeeklyReportStatus.APPROVED
            ? 'Báo cáo tuần đã được duyệt'
            : 'Báo cáo tuần cần sửa',
        message:
          dto.status === WeeklyReportStatus.APPROVED
            ? `Báo cáo tuần ${this.formatDate(updated.weekStart)} đã được duyệt.`
            : `Báo cáo tuần ${this.formatDate(updated.weekStart)} cần chỉnh lại.`,
        href: `/weekly-reports?weekStart=${updated.weekStart.toISOString().slice(0, 10)}`,
        entityType: 'WeeklyReport',
        entityId: updated.id,
        createdById: user.id,
      })
      .catch(() => null);

    return updated;
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
      throw new ForbiddenException(
        'You can only access your own weekly report',
      );
    }
    if (isAdmin(user)) {
      await this.ensureUserExists(report.userId, user);
    }

    return report;
  }

  private assertCanUseWeeklyReports(user: RequestUser) {
    if (!isAdmin(user) && !isEngineer(user)) {
      throw new ForbiddenException(
        'You do not have permission for this action',
      );
    }
  }

  private resolveTargetUserId(user: RequestUser, userId?: string) {
    if (isAdmin(user)) {
      return userId || user.id;
    }

    return user.id;
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
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }
    return date;
  }

  private endOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(23, 59, 59, 999);
    return next;
  }

  private addDays(value: Date, days: number) {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
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

  private buildDailyWorkContent(note: {
    title: string;
    note?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    type: DailyWorkType;
    status: DailyWorkStatus;
  }) {
    const timeRange = [note.startTime, note.endTime]
      .filter(Boolean)
      .join(' - ');
    const prefix = dailyWorkTypeLabels[note.type] || 'Công việc';
    const statusSuffix =
      note.status === DailyWorkStatus.PENDING ? ' (chờ phê duyệt)' : '';
    return [timeRange, `${prefix}: ${note.title}${statusSuffix}`]
      .filter(Boolean)
      .join(' · ');
  }

  private customerSummary(
    customer?: {
      id?: string | null;
      customerCode?: string | null;
      name?: string | null;
      hospitalName?: string | null;
      status?: string | null;
      province?: string | null;
      phone?: string | null;
      contactPhone?: string | null;
      fullAddress?: string | null;
      address?: string | null;
    } | null,
    fallback: {
      name?: string | null;
      phone?: string | null;
      address?: string | null;
    } = {},
  ) {
    return {
      id: customer?.id ?? '',
      code: customer?.customerCode ?? null,
      name:
        customer?.hospitalName ??
        customer?.name ??
        fallback.name ??
        'Chưa rõ khách hàng',
      status: customer?.status ?? null,
      province: customer?.province ?? null,
      phone:
        customer?.contactPhone ?? customer?.phone ?? fallback.phone ?? null,
      address:
        customer?.fullAddress ?? customer?.address ?? fallback.address ?? null,
    };
  }

  private machineSummary(
    machine?: {
      id?: string | null;
      machineCode?: string | null;
      serialNumber?: string | null;
      modelName?: string | null;
      name?: string | null;
      productCategory?: string | null;
      businessLine?: { name?: string | null } | null;
    } | null,
    fallback: {
      modelName?: string | null;
      serialNumber?: string | null;
      name?: string | null;
      productCategory?: string | null;
    } = {},
  ) {
    return {
      id: machine?.id ?? '',
      code: machine?.machineCode ?? null,
      serialNumber: machine?.serialNumber ?? fallback.serialNumber ?? null,
      modelName: machine?.modelName ?? fallback.modelName ?? null,
      name: machine?.name ?? fallback.name ?? null,
      productCategory:
        machine?.productCategory ?? fallback.productCategory ?? null,
      businessLine: machine?.businessLine?.name ?? null,
    };
  }

  private formatMachineForReport(machine: {
    code?: string | null;
    serialNumber?: string | null;
    modelName?: string | null;
    name?: string | null;
  }) {
    return [
      machine.code,
      machine.modelName || machine.name,
      machine.serialNumber ? `S/N ${machine.serialNumber}` : '',
    ]
      .filter(Boolean)
      .join(' - ');
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

function applicationSupportWorkTypeLabel(value: ApplicationSupportWorkType) {
  return applicationSupportWorkTypeLabels[value] ?? value;
}

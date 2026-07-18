import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApplicationSupportChannel,
  ApplicationSupportIssueCategory,
  ApplicationSupportStatus,
  Prisma,
} from '@prisma/client';
import { isAdmin, isEngineer, isManager } from '../auth/access-scope';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationSupportQueryDto } from './dto/application-support-query.dto';
import { SaveApplicationSupportCaseDto } from './dto/save-application-support-case.dto';

@Injectable()
export class ApplicationSupportService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: ApplicationSupportQueryDto, user: RequestUser) {
    this.assertCanUse(user);
    if (isEngineer(user)) {
      await this.ensureApplicationSpecialist(user.id);
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ApplicationSupportCaseWhereInput = {
      AND: [
        this.accessWhere(user),
        this.filterWhere(query, user),
      ],
    };

    const [data, total] = await Promise.all([
      this.prisma.applicationSupportCase.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [{ supportedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.applicationSupportCase.count({ where }),
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

  async create(dto: SaveApplicationSupportCaseDto, user: RequestUser) {
    this.assertCanUse(user);
    this.assertCanManageCase(user);
    const engineerId = this.resolveEngineerId(dto.engineerId, user);
    await this.ensureEngineer(engineerId, user);
    await this.ensureApplicationSpecialist(engineerId);
    await this.ensureLinkedEntities(dto, user);

    return this.prisma.applicationSupportCase.create({
      data: this.buildData(dto, engineerId),
      include: this.defaultInclude(),
    });
  }

  async update(id: string, dto: SaveApplicationSupportCaseDto, user: RequestUser) {
    const current = await this.findAccessible(id, user);
    this.assertCanManageCase(user);
    const engineerId = this.resolveEngineerId(dto.engineerId ?? current.engineerId, user);
    await this.ensureEngineer(engineerId, user);
    await this.ensureApplicationSpecialist(engineerId);
    await this.ensureLinkedEntities(dto, user);

    return this.prisma.applicationSupportCase.update({
      where: { id },
      data: this.buildData(dto, engineerId),
      include: this.defaultInclude(),
    });
  }

  async remove(id: string, user: RequestUser) {
    await this.findAccessible(id, user);
    this.assertCanManageCase(user);
    await this.prisma.applicationSupportCase.delete({ where: { id } });
    return { ok: true };
  }

  async getWeeklyRows({ user, weekStart, userId }: { user: RequestUser; weekStart?: string; userId?: string }) {
    this.assertCanUse(user);
    const targetUserId = this.resolveEngineerId(userId, user);
    await this.ensureEngineer(targetUserId, user);
    const parsedWeekStart = this.parseDate(weekStart || this.currentWeekStart(), 'weekStart');
    const weekEnd = this.endOfDay(this.addDays(parsedWeekStart, 5));

    const cases = await this.prisma.applicationSupportCase.findMany({
      where: {
        engineerId: targetUserId,
        supportedAt: { gte: parsedWeekStart, lte: weekEnd },
      },
      include: this.defaultInclude(),
      orderBy: [{ supportedAt: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      weekStart: parsedWeekStart,
      weekEnd,
      counts: {
        total: cases.length,
        resolved: cases.filter((item) => item.status === ApplicationSupportStatus.RESOLVED).length,
        followUp: cases.filter((item) => item.followUpNeeded || item.status === ApplicationSupportStatus.FOLLOW_UP).length,
        knowledgeCandidate: cases.filter((item) => item.knowledgeCandidate).length,
      },
      rows: cases.map((item, index) => ({
        sourceId: item.id,
        sourceType: 'ApplicationSupportCase' as const,
        workDate: item.supportedAt,
        customer: item.customer?.name || item.customerName || '',
        machine: this.machineLabel(item),
        content: `Hỗ trợ app: ${item.title} (${issueCategoryLabel(item.issueCategory)}, ${channelLabel(item.channel)})`,
        result: item.resolution || statusLabel(item.status),
        pending: item.pending || (item.followUpNeeded ? `Cần follow-up${item.followUpDate ? ` ngày ${this.formatDate(item.followUpDate)}` : ''}.` : ''),
        proposal: item.nextAction || (item.knowledgeCandidate ? 'Nên đưa vào tri thức nội bộ.' : ''),
        sortOrder: index,
      })),
    };
  }

  private assertCanUse(user: RequestUser) {
    if (!isAdmin(user) && !isManager(user) && !isEngineer(user)) {
      throw new ForbiddenException('Forbidden');
    }
  }

  private assertCanManageCase(user: RequestUser) {
    if (!isEngineer(user)) {
      throw new ForbiddenException('Only lab application engineers can manage application support cases');
    }
  }

  private accessWhere(user: RequestUser): Prisma.ApplicationSupportCaseWhereInput {
    if (isAdmin(user) || isManager(user)) {
      return {
        OR: [
          { engineer: { regionId: user.regionId } },
          { customer: { regionId: user.regionId } },
          { customerId: null },
        ],
      };
    }

    if (isEngineer(user)) {
      return { engineerId: user.id };
    }

    return { id: '__no_access__' };
  }

  private filterWhere(query: ApplicationSupportQueryDto, user: RequestUser): Prisma.ApplicationSupportCaseWhereInput {
    const where: Prisma.ApplicationSupportCaseWhereInput = {};
    if (query.engineerId && (isAdmin(user) || isManager(user))) where.engineerId = query.engineerId;
    if (query.customerId) where.customerId = query.customerId;
    if (query.status) where.status = query.status;
    if (query.issueCategory) where.issueCategory = query.issueCategory;
    if (query.from || query.to) {
      where.supportedAt = {
        gte: query.from ? this.parseDate(query.from, 'from') : undefined,
        lte: query.to ? this.endOfDay(this.parseDate(query.to, 'to')) : undefined,
      };
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { title: { contains: search } },
        { customerName: { contains: search } },
        { contactName: { contains: search } },
        { contactPhone: { contains: search } },
        { appModule: { contains: search } },
        { issueDescription: { contains: search } },
        { resolution: { contains: search } },
        { customer: { name: { contains: search } } },
        { machine: { serialNumber: { contains: search } } },
        { machine: { machineCode: { contains: search } } },
      ];
    }
    return where;
  }

  private async findAccessible(id: string, user: RequestUser) {
    const item = await this.prisma.applicationSupportCase.findFirst({
      where: { id, AND: [this.accessWhere(user)] },
    });
    if (!item) throw new NotFoundException('Application support case not found');
    return item;
  }

  private resolveEngineerId(engineerId: string | undefined, user: RequestUser) {
    if (isAdmin(user) || isManager(user)) {
      return engineerId || user.id;
    }
    return user.id;
  }

  private async ensureEngineer(engineerId: string, user: RequestUser) {
    const engineer = await this.prisma.user.findUnique({
      where: { id: engineerId },
      include: { role: true },
    });
    if (!engineer || engineer.status !== 'ACTIVE') {
      throw new BadRequestException('Engineer does not exist');
    }
    if ((isAdmin(user) || isManager(user)) && engineer.regionId !== user.regionId) {
      throw new ForbiddenException('Engineer is outside your region');
    }
  }

  private async ensureApplicationSpecialist(engineerId: string) {
    const engineer = await this.prisma.user.findUnique({
      where: { id: engineerId },
      include: { engineerProfile: true, role: true },
    });
    if (!engineer || engineer.engineerProfile?.expertiseGroup !== 'LAB_TESTING') {
      throw new ForbiddenException('Only lab application engineers can use application support');
    }
  }

  private async ensureLinkedEntities(dto: SaveApplicationSupportCaseDto, user: RequestUser) {
    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
      if (!customer) throw new BadRequestException('Customer does not exist');
      if ((isAdmin(user) || isManager(user)) && customer.regionId !== user.regionId) {
        throw new ForbiddenException('Customer is outside your region');
      }
    }
    if (dto.machineId) {
      const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
      if (!machine) throw new BadRequestException('Machine does not exist');
    }
    if (dto.machineModelId) {
      const model = await this.prisma.machineModel.findUnique({ where: { id: dto.machineModelId } });
      if (!model) throw new BadRequestException('Machine model does not exist');
    }
  }

  private buildData(dto: SaveApplicationSupportCaseDto, engineerId: string): Prisma.ApplicationSupportCaseUncheckedCreateInput {
    return {
      engineerId,
      customerId: this.cleanId(dto.customerId),
      machineId: this.cleanId(dto.machineId),
      machineModelId: this.cleanId(dto.machineModelId),
      supportedAt: this.parseDate(dto.supportedAt, 'supportedAt'),
      channel: dto.channel ?? ApplicationSupportChannel.PHONE,
      issueCategory: dto.issueCategory ?? ApplicationSupportIssueCategory.APP_ERROR,
      status: dto.status ?? ApplicationSupportStatus.RESOLVED,
      customerName: this.cleanOptional(dto.customerName),
      contactName: this.cleanOptional(dto.contactName),
      contactPhone: this.cleanOptional(dto.contactPhone),
      appModule: this.cleanOptional(dto.appModule),
      machineText: this.cleanOptional(dto.machineText),
      impactLevel: this.cleanOptional(dto.impactLevel),
      title: this.required(dto.title, 'title'),
      issueDescription: this.required(dto.issueDescription, 'issueDescription'),
      resolution: this.required(dto.resolution, 'resolution'),
      durationMinutes: dto.durationMinutes ?? null,
      pending: this.cleanOptional(dto.pending),
      nextAction: this.cleanOptional(dto.nextAction),
      followUpNeeded: dto.followUpNeeded ?? false,
      followUpDate: dto.followUpDate ? this.parseDate(dto.followUpDate, 'followUpDate') : null,
      knowledgeCandidate: dto.knowledgeCandidate ?? false,
      note: this.cleanOptional(dto.note),
    };
  }

  private defaultInclude() {
    return {
      engineer: { select: { id: true, fullName: true, email: true } },
      customer: { select: { id: true, name: true, phone: true, contactPerson: true, contactPhone: true, province: true } },
      machine: { select: { id: true, machineCode: true, serialNumber: true, modelName: true, name: true } },
      machineModel: { select: { id: true, code: true, name: true, displayName: true } },
    } satisfies Prisma.ApplicationSupportCaseInclude;
  }

  private machineLabel(item: { machine?: { machineCode?: string | null; serialNumber?: string | null; modelName?: string | null; name?: string | null } | null; machineModel?: { code?: string | null; name?: string | null; displayName?: string | null } | null; machineText?: string | null }) {
    return [
      item.machine?.machineCode,
      item.machine?.serialNumber,
      item.machine?.modelName || item.machine?.name,
      item.machineModel?.displayName || item.machineModel?.name || item.machineModel?.code,
      item.machineText,
    ].filter(Boolean).join(' - ');
  }

  private cleanId(value?: string | null) {
    return value?.trim() || null;
  }

  private cleanOptional(value?: string | null) {
    return value?.trim() || null;
  }

  private required(value: string | undefined, field: string) {
    const next = value?.trim();
    if (!next) throw new BadRequestException(`${field} is required`);
    return next;
  }

  private parseDate(value: string | Date, field: string) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return date;
  }

  private endOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private addDays(value: Date, days: number) {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
    return date;
  }

  private currentWeekStart() {
    const date = new Date();
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat('vi-VN').format(value);
  }
}

function issueCategoryLabel(value: ApplicationSupportIssueCategory) {
  const labels: Record<ApplicationSupportIssueCategory, string> = {
    APP_ERROR: 'lỗi app',
    USER_GUIDANCE: 'hướng dẫn thao tác',
    CONFIGURATION: 'cấu hình',
    HIS_RIS_PACS: 'HIS/RIS/PACS',
    DICOM: 'DICOM',
    WORKLIST: 'worklist',
    PRINTING: 'in ấn',
    LICENSE: 'license',
    DATA_EXPORT: 'xuất dữ liệu',
    TRAINING: 'đào tạo',
    OTHER: 'khác',
  };
  return labels[value] ?? value;
}

function channelLabel(value: ApplicationSupportChannel) {
  const labels: Record<ApplicationSupportChannel, string> = {
    PHONE: 'điện thoại',
    ZALO: 'Zalo',
    REMOTE: 'remote',
    ONSITE: 'onsite',
    EMAIL: 'email',
    OTHER: 'khác',
  };
  return labels[value] ?? value;
}

function statusLabel(value: ApplicationSupportStatus) {
  const labels: Record<ApplicationSupportStatus, string> = {
    RESOLVED: 'Đã xử lý',
    WAITING_CUSTOMER: 'Chờ khách hàng',
    WAITING_HOSPITAL_IT: 'Chờ IT bệnh viện',
    WAITING_VENDOR: 'Chờ hãng',
    NEEDS_ONSITE: 'Cần onsite',
    FOLLOW_UP: 'Cần follow-up',
  };
  return labels[value] ?? value;
}

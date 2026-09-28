import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TaskChecklistStatus,
  UsedPartStatus,
  WorkTaskKind,
} from '@prisma/client';
import {
  isAdmin,
  installationAccessWhere,
  maintenanceAccessWhere,
  repairAccessWhere,
} from '../auth/access-scope';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import {
  SyncUsedPartDto,
  SyncWorkOperationsDto,
} from './dto/sync-work-operations.dto';

type TaskKindParam = 'repair' | 'maintenance' | 'installation';

@Injectable()
export class WorkOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findForTask(
    kindParam: TaskKindParam,
    taskId: string,
    user: RequestUser,
  ) {
    const kind = this.parseKind(kindParam);
    await this.assertCanAccessTask(kind, taskId, user);
    const where = this.taskWhere(kind, taskId);

    const [workLogs, usedParts, checklistItems] = await Promise.all([
      this.prisma.workLog.findMany({
        where,
        include: {
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: [
          { sortOrder: 'asc' },
          { stepTime: 'asc' },
          { createdAt: 'asc' },
        ],
      }),
      this.prisma.usedPart.findMany({
        where,
        include: {
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: [{ usedAt: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.taskChecklistItem.findMany({
        where,
        include: {
          updatedBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    return { kind, taskId, workLogs, usedParts, checklistItems };
  }

  async syncForTask(
    kindParam: TaskKindParam,
    taskId: string,
    dto: SyncWorkOperationsDto,
    user: RequestUser,
  ) {
    const kind = this.parseKind(kindParam);
    await this.assertCanAccessTask(kind, taskId, user);
    const where = this.taskWhere(kind, taskId);
    const relation = this.taskRelation(kind, taskId);

    await this.prisma.$transaction(async (tx) => {
      if (dto.workLogs) {
        await tx.workLog.deleteMany({ where });
        if (dto.workLogs.length) {
          await tx.workLog.createMany({
            data: dto.workLogs.map((item, index) => ({
              kind,
              ...relation,
              stepTime: this.parseOptionalDate(
                item.stepTime,
                `workLogs.${index}.stepTime`,
              ),
              title: this.cleanRequired(item.title, `workLogs.${index}.title`),
              note: this.cleanOptional(item.note),
              sortOrder: item.sortOrder ?? index,
              createdById: user.id,
            })),
          });
        }
      }

      if (dto.usedParts) {
        await tx.usedPart.deleteMany({ where });
        if (dto.usedParts.length) {
          await tx.usedPart.createMany({
            data: dto.usedParts.map((item, index) =>
              this.usedPartData(kind, relation, item, index, user.id),
            ),
          });
        }
      }

      if (dto.checklistItems) {
        await tx.taskChecklistItem.deleteMany({ where });
        if (dto.checklistItems.length) {
          await tx.taskChecklistItem.createMany({
            data: dto.checklistItems.map((item, index) => ({
              kind,
              ...relation,
              label: this.cleanRequired(
                item.label,
                `checklistItems.${index}.label`,
              ),
              status: item.status ?? TaskChecklistStatus.PENDING,
              note: this.cleanOptional(item.note),
              sortOrder: item.sortOrder ?? index,
              checkedAt:
                item.status === TaskChecklistStatus.DONE ? new Date() : null,
              updatedById: user.id,
            })),
          });
        }
      }
    });

    return this.findForTask(kindParam, taskId, user);
  }

  async usedPartsSummary({
    user,
    engineerId,
    from,
    to,
    weekStart,
  }: {
    user: RequestUser;
    engineerId?: string;
    from?: string;
    to?: string;
    weekStart?: string;
  }) {
    if (!isAdmin(user))
      throw new ForbiddenException('Only admin can view used parts summary');
    const start = this.parseDate(
      from || weekStart || this.currentWeekStart(),
      from ? 'from' : 'weekStart',
    );
    const end = this.endOfDay(
      to ? this.parseDate(to, 'to') : this.addDays(start, 6),
    );

    const parts = await this.prisma.usedPart.findMany({
      where: {
        usedAt: { gte: start, lte: end },
        OR: engineerId
          ? [
              { repair: { engineerId } },
              { maintenance: { engineerId } },
              { installation: { installedById: engineerId } },
              { deviceServiceTicket: { engineerId } },
              {
                repairId: null,
                maintenanceId: null,
                installationId: null,
                deviceServiceTicketId: null,
                createdById: engineerId,
              },
            ]
          : undefined,
      },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
        repair: {
          select: {
            id: true,
            code: true,
            title: true,
            engineerId: true,
            engineer: { select: { id: true, fullName: true, email: true } },
          },
        },
        maintenance: {
          select: {
            id: true,
            code: true,
            title: true,
            engineerId: true,
            engineer: { select: { id: true, fullName: true, email: true } },
          },
        },
        installation: {
          select: {
            id: true,
            code: true,
            installedById: true,
            installedBy: { select: { id: true, fullName: true, email: true } },
            customer: { select: { name: true } },
          },
        },
        deviceServiceTicket: {
          select: {
            id: true,
            receiveCode: true,
            returnCode: true,
            deviceName: true,
            engineerId: true,
            engineer: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
      orderBy: [{ usedAt: 'asc' }, { createdAt: 'asc' }],
    });

    const byEngineer = new Map<
      string,
      {
        engineerId: string;
        engineerName: string;
        quantity: number;
        totalCost: number;
        totalRevenue: number;
        grossProfit: number;
        waiting: number;
        used: number;
      }
    >();
    let totalCost = 0;
    let totalRevenue = 0;
    let waiting = 0;
    let used = 0;

    for (const part of parts) {
      const responsibleEngineer = this.partResponsibleEngineer(part);
      const engineerKey = responsibleEngineer.id;
      const current = byEngineer.get(engineerKey) ?? {
        engineerId: engineerKey,
        engineerName: responsibleEngineer.name,
        quantity: 0,
        totalCost: 0,
        totalRevenue: 0,
        grossProfit: 0,
        waiting: 0,
        used: 0,
      };
      const quantity = Number(part.quantity);
      const cost = Number(part.totalCost ?? 0);
      const revenue = Number(part.totalPrice ?? 0);
      current.quantity += quantity;
      current.totalCost += cost;
      current.totalRevenue += revenue;
      current.grossProfit += revenue - cost;
      if (part.status === UsedPartStatus.WAITING) current.waiting += 1;
      if (part.status === UsedPartStatus.USED) current.used += 1;
      totalCost += cost;
      totalRevenue += revenue;
      if (part.status === UsedPartStatus.WAITING) waiting += 1;
      if (part.status === UsedPartStatus.USED) used += 1;
      byEngineer.set(engineerKey, current);
    }

    return {
      weekStart: start,
      weekEnd: end,
      from: start,
      to: end,
      totals: {
        parts: parts.length,
        totalCost,
        totalRevenue,
        grossProfit: totalRevenue - totalCost,
        waiting,
        used,
      },
      byEngineer: Array.from(byEngineer.values()).sort(
        (left, right) => right.totalCost - left.totalCost,
      ),
      parts: parts.map((part) => ({
        ...part,
        quantity: Number(part.quantity),
        unitCost: part.unitCost === null ? null : Number(part.unitCost),
        totalCost: part.totalCost === null ? null : Number(part.totalCost),
        unitPrice: part.unitPrice === null ? null : Number(part.unitPrice),
        totalPrice: part.totalPrice === null ? null : Number(part.totalPrice),
        task: this.partTaskSummary(part),
      })),
    };
  }

  private async assertCanAccessTask(
    kind: WorkTaskKind,
    taskId: string,
    user: RequestUser,
  ) {
    const task = await this.findAccessibleTask(kind, taskId, user);
    if (!task) throw new NotFoundException('Work task not found');
  }

  private findAccessibleTask(
    kind: WorkTaskKind,
    taskId: string,
    user: RequestUser,
  ) {
    if (kind === WorkTaskKind.REPAIR) {
      return this.prisma.repair.findFirst({
        where: { AND: [{ id: taskId }, repairAccessWhere(user)] },
        select: { id: true },
      });
    }
    if (kind === WorkTaskKind.MAINTENANCE) {
      return this.prisma.maintenance.findFirst({
        where: { AND: [{ id: taskId }, maintenanceAccessWhere(user)] },
        select: { id: true },
      });
    }
    return this.prisma.machineInstallation.findFirst({
      where: { AND: [{ id: taskId }, installationAccessWhere(user)] },
      select: { id: true },
    });
  }

  private parseKind(value: string): WorkTaskKind {
    if (value === 'repair') return WorkTaskKind.REPAIR;
    if (value === 'maintenance') return WorkTaskKind.MAINTENANCE;
    if (value === 'installation') return WorkTaskKind.INSTALLATION;
    throw new BadRequestException('Invalid work task kind');
  }

  private taskWhere(kind: WorkTaskKind, taskId: string) {
    if (kind === WorkTaskKind.REPAIR) return { repairId: taskId };
    if (kind === WorkTaskKind.MAINTENANCE) return { maintenanceId: taskId };
    return { installationId: taskId };
  }

  private taskRelation(kind: WorkTaskKind, taskId: string) {
    if (kind === WorkTaskKind.REPAIR) return { repairId: taskId };
    if (kind === WorkTaskKind.MAINTENANCE) return { maintenanceId: taskId };
    return { installationId: taskId };
  }

  private usedPartData(
    kind: WorkTaskKind,
    relation: Pick<
      Prisma.UsedPartCreateManyInput,
      'repairId' | 'maintenanceId' | 'installationId'
    >,
    item: SyncUsedPartDto,
    index: number,
    createdById: string,
  ): Prisma.UsedPartCreateManyInput {
    const quantity = item.quantity ?? 1;
    const unitCost = item.unitCost ?? null;
    const unitPrice = item.unitPrice ?? null;
    return {
      kind,
      ...relation,
      name: this.cleanRequired(item.name, `usedParts.${index}.name`),
      quantity,
      unit: this.cleanOptional(item.unit),
      serialNumber: this.cleanOptional(item.serialNumber),
      unitCost,
      totalCost: unitCost === null ? null : quantity * unitCost,
      unitPrice,
      totalPrice: unitPrice === null ? null : quantity * unitPrice,
      status: item.status ?? UsedPartStatus.USED,
      inventoryItemId: this.cleanOptional(item.inventoryItemId),
      note: this.cleanOptional(item.note),
      usedAt:
        this.parseOptionalDate(item.usedAt, `usedParts.${index}.usedAt`) ??
        new Date(),
      createdById,
    };
  }

  private partTaskSummary(part: {
    kind: WorkTaskKind;
    repair?: { id: string; code: string; title: string } | null;
    maintenance?: { id: string; code: string; title: string } | null;
    installation?: {
      id: string;
      code: string;
      customer?: { name: string } | null;
    } | null;
    deviceServiceTicket?: {
      id: string;
      receiveCode: string;
      returnCode?: string | null;
      deviceName?: string | null;
    } | null;
  }) {
    if (part.kind === WorkTaskKind.REPAIR && part.repair)
      return {
        kind: 'repair',
        id: part.repair.id,
        code: part.repair.code,
        title: part.repair.title,
      };
    if (part.kind === WorkTaskKind.MAINTENANCE && part.maintenance)
      return {
        kind: 'maintenance',
        id: part.maintenance.id,
        code: part.maintenance.code,
        title: part.maintenance.title,
      };
    if (part.kind === WorkTaskKind.INSTALLATION && part.installation)
      return {
        kind: 'installation',
        id: part.installation.id,
        code: part.installation.code,
        title: part.installation.customer?.name || 'Lắp đặt',
      };
    if (part.kind === WorkTaskKind.DEVICE_SERVICE && part.deviceServiceTicket)
      return {
        kind: 'device-service',
        id: part.deviceServiceTicket.id,
        code:
          part.deviceServiceTicket.returnCode ||
          part.deviceServiceTicket.receiveCode,
        title: part.deviceServiceTicket.deviceName || 'Nhận/trả thiết bị',
      };
    return null;
  }

  private partResponsibleEngineer(part: {
    createdBy?: {
      id: string;
      fullName?: string | null;
      email?: string | null;
    } | null;
    repair?: {
      engineer?: {
        id: string;
        fullName?: string | null;
        email?: string | null;
      } | null;
    } | null;
    maintenance?: {
      engineer?: {
        id: string;
        fullName?: string | null;
        email?: string | null;
      } | null;
    } | null;
    installation?: {
      installedBy?: {
        id: string;
        fullName?: string | null;
        email?: string | null;
      } | null;
    } | null;
    deviceServiceTicket?: {
      engineer?: {
        id: string;
        fullName?: string | null;
        email?: string | null;
      } | null;
    } | null;
  }) {
    const engineer =
      part.repair?.engineer ??
      part.maintenance?.engineer ??
      part.installation?.installedBy ??
      part.deviceServiceTicket?.engineer ??
      part.createdBy;
    return {
      id: engineer?.id || 'unknown',
      name: engineer?.fullName || engineer?.email || 'Không rõ kỹ sư',
    };
  }

  private cleanRequired(value: string, field: string) {
    const cleaned = value?.trim();
    if (!cleaned) throw new BadRequestException(`${field} is required`);
    return cleaned;
  }

  private cleanOptional(value?: string | null) {
    return value?.trim() || null;
  }

  private parseOptionalDate(value: string | null | undefined, field: string) {
    if (!value) return null;
    return this.parseDate(value, field);
  }

  private parseDate(value: string, field: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException(`${field} must be a valid date`);
    return date;
  }

  private currentWeekStart() {
    const date = new Date();
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }

  private addDays(value: Date, days: number) {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
    return date;
  }

  private endOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }
}

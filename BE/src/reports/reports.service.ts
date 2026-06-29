import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { installationAccessWhere } from '../auth/access-scope';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';

type InstallationGroupRow = {
  id: string;
  label: string;
  count: number;
  customers: number;
  machines: number;
  engineers: number;
  provinces: number;
  lastInstalledAt: Date | null;
};

type InstallationDetailRow = {
  id: string;
  code: string;
  status: string;
  reviewStatus: string;
  installedAt: Date;
  engineer: string;
  customer: string;
  province: string;
  region: string;
  model: string;
  machineCode: string;
  serialNumber: string;
};

type MutableGroup = {
  id: string;
  label: string;
  count: number;
  customers: Set<string>;
  machines: Set<string>;
  engineers: Set<string>;
  provinces: Set<string>;
  lastInstalledAt: Date | null;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getInstallationReport(
    user: RequestUser,
    query: Record<string, string | undefined> = {},
  ) {
    const period = this.resolvePeriod(query);
    const engineerId = query.engineerId?.trim();
    const customerId = query.customerId?.trim();
    const machineModelId = query.machineModelId?.trim();
    const province = query.province?.trim();

    const where: Prisma.MachineInstallationWhereInput = {
      AND: [
        installationAccessWhere(user),
        { installedAt: { gte: period.start, lt: period.end } },
        engineerId ? { installedById: engineerId } : {},
        customerId ? { customerId } : {},
        province
          ? {
              customer: {
                province: {
                  contains: province,
                },
              },
            }
          : {},
        machineModelId
          ? {
              OR: [
                { plannedMachineModelId: machineModelId },
                { machine: { machineModelId } },
              ],
            }
          : {},
      ],
    };

    const installations = await this.prisma.machineInstallation.findMany({
      where,
      orderBy: { installedAt: 'desc' },
      select: {
        id: true,
        code: true,
        status: true,
        reviewStatus: true,
        installedAt: true,
        installedById: true,
        installedBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        customerId: true,
        customer: {
          select: {
            id: true,
            name: true,
            shortName: true,
            province: true,
            region: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        plannedMachineModelId: true,
        plannedModelName: true,
        plannedMachineModel: {
          select: {
            id: true,
            name: true,
            displayName: true,
            code: true,
          },
        },
        machineId: true,
        machine: {
          select: {
            id: true,
            machineCode: true,
            serialNumber: true,
            modelName: true,
            machineModelId: true,
            machineModel: {
              select: {
                id: true,
                name: true,
                displayName: true,
                code: true,
              },
            },
          },
        },
      },
    });

    const rows: InstallationDetailRow[] = installations.map((item) => ({
      id: item.id,
      code: item.code,
      status: item.status,
      reviewStatus: item.reviewStatus,
      installedAt: item.installedAt,
      engineer: this.personName(item.installedBy?.fullName, item.installedBy?.email),
      customer: item.customer?.shortName || item.customer?.name || 'Chưa có khách hàng',
      province: item.customer?.province || 'Chưa có tỉnh',
      region: item.customer?.region?.name || 'Chưa có vùng',
      model: this.modelName(item),
      machineCode: item.machine?.machineCode || '-',
      serialNumber: item.machine?.serialNumber || '-',
    }));

    const uniqueCustomers = new Set(installations.map((item) => item.customerId).filter(Boolean));
    const uniqueMachines = new Set(
      installations.map((item) => item.machineId || item.id).filter(Boolean),
    );
    const uniqueEngineers = new Set(
      installations.map((item) => item.installedById || 'unassigned').filter(Boolean),
    );
    const uniqueProvinces = new Set(
      installations.map((item) => item.customer?.province || 'Chưa có tỉnh'),
    );

    return {
      filters: {
        from: this.formatDateInput(period.start),
        to: this.formatDateInput(new Date(period.end.getTime() - 1)),
      },
      summary: {
        totalInstallations: installations.length,
        totalMachines: uniqueMachines.size,
        totalCustomers: uniqueCustomers.size,
        totalEngineers: uniqueEngineers.size,
        totalProvinces: uniqueProvinces.size,
      },
      byEngineer: this.groupInstallations(installations, (item) => ({
        id: item.installedById || 'unassigned',
        label: this.personName(item.installedBy?.fullName, item.installedBy?.email),
      })),
      byCustomer: this.groupInstallations(installations, (item) => ({
        id: item.customerId || 'unknown-customer',
        label: item.customer?.shortName || item.customer?.name || 'Chưa có khách hàng',
      })),
      byModel: this.groupInstallations(installations, (item) => ({
        id: item.plannedMachineModelId || item.machine?.machineModelId || item.plannedModelName || item.machine?.modelName || 'unknown-model',
        label: this.modelName(item),
      })),
      byProvince: this.groupInstallations(installations, (item) => ({
        id: item.customer?.province || 'unknown-province',
        label: item.customer?.province || 'Chưa có tỉnh',
      })),
      rows,
    };
  }

  private groupInstallations<T extends {
    id: string;
    installedAt: Date;
    installedById?: string | null;
    customerId?: string | null;
    machineId?: string | null;
    customer?: { province?: string | null } | null;
  }>(
    installations: T[],
    keyFor: (item: T) => { id: string; label: string },
  ): InstallationGroupRow[] {
    const groups = new Map<string, MutableGroup>();

    for (const item of installations) {
      const key = keyFor(item);
      const current =
        groups.get(key.id) ??
        {
          id: key.id,
          label: key.label,
          count: 0,
          customers: new Set<string>(),
          machines: new Set<string>(),
          engineers: new Set<string>(),
          provinces: new Set<string>(),
          lastInstalledAt: null,
        };

      current.count += 1;
      current.customers.add(item.customerId || 'unknown-customer');
      current.machines.add(item.machineId || item.id);
      current.engineers.add(item.installedById || 'unassigned');
      current.provinces.add(item.customer?.province || 'Chưa có tỉnh');
      current.lastInstalledAt =
        !current.lastInstalledAt || item.installedAt > current.lastInstalledAt
          ? item.installedAt
          : current.lastInstalledAt;
      groups.set(key.id, current);
    }

    return [...groups.values()]
      .map((item) => ({
        id: item.id,
        label: item.label,
        count: item.count,
        customers: item.customers.size,
        machines: item.machines.size,
        engineers: item.engineers.size,
        provinces: item.provinces.size,
        lastInstalledAt: item.lastInstalledAt,
      }))
      .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, 'vi'));
  }

  private resolvePeriod(query: Record<string, string | undefined>) {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const start = query.from ? this.parseDate(query.from, 'from') : defaultStart;
    const end = query.to ? this.addDays(this.parseDate(query.to, 'to'), 1) : defaultEnd;

    if (end <= start) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    return { start, end };
  }

  private parseDate(value: string, field: string) {
    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Ngày ${field} không hợp lệ`);
    }

    return date;
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private formatDateInput(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private personName(fullName?: string | null, email?: string | null) {
    return fullName || email || 'Chưa phân công';
  }

  private modelName(item: {
    plannedModelName?: string | null;
    plannedMachineModel?: { name?: string | null; displayName?: string | null; code?: string | null } | null;
    machine?: {
      modelName?: string | null;
      machineModel?: { name?: string | null; displayName?: string | null; code?: string | null } | null;
    } | null;
  }) {
    return (
      item.plannedMachineModel?.displayName ||
      item.plannedMachineModel?.name ||
      item.plannedModelName ||
      item.machine?.machineModel?.displayName ||
      item.machine?.machineModel?.name ||
      item.machine?.modelName ||
      'Chưa có model'
    );
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  customerAccessWhere,
  demoLoanAccessWhere,
  installationAccessWhere,
  maintenanceAccessWhere,
  repairAccessWhere,
} from '../auth/access-scope';
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
  engineerId: string | null;
  engineer: string;
  customerId: string | null;
  customer: string;
  province: string;
  region: string;
  machineId: string | null;
  machineModelId: string | null;
  model: string;
  machineCode: string;
  serialNumber: string;
};

type EngineerFilterOption = {
  id: string;
  email: string;
  fullName: string | null;
  region: {
    id: string;
    name: string;
  } | null;
  engineerProfile: {
    expertiseGroup: string | null;
  } | null;
};

type WorkReportRow = {
  id: string;
  code: string;
  kind: 'installation' | 'repair' | 'maintenance' | 'demo' | 'applicationSupport';
  title: string;
  status: string;
  date: Date;
  completedAt: Date | null;
  engineerId: string | null;
  engineer: string;
  customerId: string | null;
  customer: string;
  province: string;
  machineId: string | null;
  machineModelId: string | null;
  model: string;
  machineCode: string;
  serialNumber: string;
  note: string | null;
};

type TechnicalReportGroupRow = {
  id: string;
  label: string;
  total: number;
  installation: number;
  repair: number;
  maintenance: number;
  demo: number;
  applicationSupport: number;
  customers: number;
  machines: number;
  lastWorkedAt: Date | null;
};

type TechnicalEngineerCustomerRow = TechnicalReportGroupRow & {
  province: string;
  latestWork: WorkReportRow | null;
};

type TechnicalEngineerDetailRow = TechnicalReportGroupRow & {
  customersList: TechnicalEngineerCustomerRow[];
  recentWorks: WorkReportRow[];
};

type TechnicalMachineGroupRow = {
  id: string;
  machineCode: string;
  serialNumber: string;
  model: string;
  customer: string;
  customerId: string | null;
  province: string;
  total: number;
  installation: number;
  repair: number;
  maintenance: number;
  demo: number;
  applicationSupport: number;
  lastWorkedAt: Date | null;
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

  async getTechnicalReport(
    user: RequestUser,
    query: Record<string, string | undefined> = {},
  ) {
    const period = this.resolvePeriod(query);
    const engineerId = query.engineerId?.trim();
    const customerId = query.customerId?.trim();
    const machineModelId = query.machineModelId?.trim();
    const province = query.province?.trim();

    const [installations, repairs, maintenances, demos, supportCases, engineers] =
      await Promise.all([
        this.prisma.machineInstallation.findMany({
          where: {
            AND: [
              installationAccessWhere(user),
              { installedAt: { gte: period.start, lt: period.end } },
              engineerId ? { installedById: engineerId } : {},
            ],
          },
          orderBy: { installedAt: 'desc' },
          select: this.installationWorkSelect(),
        }),
        this.prisma.repair.findMany({
          where: {
            AND: [
              repairAccessWhere(user),
              { reportedAt: { gte: period.start, lt: period.end } },
              engineerId ? { engineerId } : {},
            ],
          },
          orderBy: { reportedAt: 'desc' },
          select: this.repairWorkSelect(),
        }),
        this.prisma.maintenance.findMany({
          where: {
            AND: [
              maintenanceAccessWhere(user),
              { scheduledDate: { gte: period.start, lt: period.end } },
              engineerId ? { engineerId } : {},
            ],
          },
          orderBy: { scheduledDate: 'desc' },
          select: this.maintenanceWorkSelect(),
        }),
        this.prisma.demoLoan.findMany({
          where: {
            AND: [
              demoLoanAccessWhere(user),
              { plannedHandoverAt: { gte: period.start, lt: period.end } },
              engineerId ? { engineerId } : {},
            ],
          },
          orderBy: { plannedHandoverAt: 'desc' },
          select: this.demoLoanWorkSelect(),
        }),
        this.prisma.applicationSupportCase.findMany({
          where: {
            AND: [
              this.applicationSupportAccessWhere(user),
              { supportedAt: { gte: period.start, lt: period.end } },
              engineerId ? { engineerId } : {},
            ],
          },
          orderBy: { supportedAt: 'desc' },
          select: this.applicationSupportWorkSelect(),
        }),
        this.findEngineerFilterOptions(),
      ]);

    const allRows = [
      ...installations.map((item) => this.installationToWorkRow(item)),
      ...repairs.map((item) => this.repairToWorkRow(item)),
      ...maintenances.map((item) => this.maintenanceToWorkRow(item)),
      ...demos.map((item) => this.demoLoanToWorkRow(item)),
      ...supportCases.map((item) => this.applicationSupportToWorkRow(item)),
    ].sort((first, second) => second.date.getTime() - first.date.getTime());

    const rows = allRows.filter(
      (row) =>
        this.matchesCustomer(row, customerId) &&
        this.matchesModel(row, machineModelId) &&
        this.matchesProvince(row, province),
    );

    const options = {
      customers: this.buildDistinctOptions(allRows, (row) => ({ id: row.customerId || row.customer, label: row.customer })),
      models: this.buildDistinctOptions(allRows, (row) => ({ id: row.machineModelId || row.model, label: row.model })),
      provinces: this.buildDistinctOptions(allRows, (row) => ({ id: row.province, label: row.province })),
    };

    return {
      filters: {
        from: this.formatDateInput(period.start),
        to: this.formatDateInput(new Date(period.end.getTime() - 1)),
        engineers,
        ...options,
      },
      summary: {
        total: rows.length,
        installations: rows.filter((row) => row.kind === 'installation').length,
        repairs: rows.filter((row) => row.kind === 'repair').length,
        maintenances: rows.filter((row) => row.kind === 'maintenance').length,
        demos: rows.filter((row) => row.kind === 'demo').length,
        applicationSupport: rows.filter((row) => row.kind === 'applicationSupport').length,
        customers: new Set(rows.map((row) => row.customerId || row.customer).filter(Boolean)).size,
        machines: new Set(rows.map((row) => this.machineKey(row)).filter(Boolean)).size,
        engineers: new Set(rows.map((row) => row.engineerId || (row.engineer && row.engineer !== 'Chưa phân công' ? row.engineer : null)).filter(Boolean)).size,
        provinces: new Set(rows.map((row) => row.province).filter(Boolean)).size,
      },
      byEngineer: this.groupTechnicalRows(rows, (row) => row.engineerId || row.engineer || 'Chưa phân công', (row) => row.engineer || 'Chưa phân công'),
      engineerDetails: this.buildTechnicalEngineerDetails(rows),
      byCustomer: this.groupTechnicalRows(rows, (row) => row.customerId || row.customer || 'unknown-customer', (row) => row.customer || 'Chưa có khách hàng'),
      byMachine: this.buildTechnicalMachineGroups(rows),
      byModel: this.groupTechnicalRows(rows, (row) => row.machineModelId || row.model || 'unknown-model', (row) => row.model || 'Chưa có model'),
      byProvince: this.groupTechnicalRows(rows, (row) => row.province || 'unknown-province', (row) => row.province || 'Chưa có tỉnh'),
      rows,
    };
  }

  private matchesCustomer(row: WorkReportRow, customerId?: string) {
    if (!customerId) return true;
    return row.customerId === customerId || row.customer === customerId;
  }

  private matchesModel(row: WorkReportRow, modelKey?: string) {
    if (!modelKey) return true;
    const decoded = decodeURIComponent(modelKey);
    return row.machineModelId === decoded || row.model === decoded;
  }

  private matchesProvince(row: WorkReportRow, province?: string) {
    if (!province) return true;
    return row.province === province;
  }

  private buildDistinctOptions(
    rows: WorkReportRow[],
    optionFor: (row: WorkReportRow) => { id: string | null; label: string | null },
  ): Array<{ id: string; label: string }> {
    const map = new Map<string, string>();

    for (const row of rows) {
      const { id, label } = optionFor(row);
      const key = id || label;
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, label || 'Chưa có dữ liệu');
      }
    }

    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((first, second) => first.label.localeCompare(second.label, 'vi'));
  }

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
        machineModelId ? await this.buildInstallationModelFilter(machineModelId) : {},
      ],
    };

    const [installations, engineers] = await Promise.all([
      this.prisma.machineInstallation.findMany({
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
      }),
      this.findEngineerFilterOptions(),
    ]);

    const rows: InstallationDetailRow[] = installations.map((item) => ({
      id: item.id,
      code: item.code,
      status: item.status,
      reviewStatus: item.reviewStatus,
      installedAt: item.installedAt,
      engineerId: item.installedById,
      engineer: this.personName(item.installedBy?.fullName, item.installedBy?.email),
      customerId: item.customerId,
      customer: item.customer?.shortName || item.customer?.name || 'Chưa có khách hàng',
      province: item.customer?.province || 'Chưa có tỉnh',
      region: item.customer?.region?.name || 'Chưa có vùng',
      machineId: item.machineId,
      machineModelId: item.plannedMachineModelId || item.machine?.machineModelId || null,
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
        engineers,
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

  async getEngineerReport(
    user: RequestUser,
    engineerId: string,
    query: Record<string, string | undefined> = {},
  ) {
    const period = this.resolvePeriod(query);
    const [engineer, installations, repairs, maintenances, assignedCustomers] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: engineerId },
          select: {
            id: true,
            email: true,
            fullName: true,
            region: { select: { id: true, name: true } },
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
            AND: [
              installationAccessWhere(user),
              { installedById: engineerId },
              { installedAt: { gte: period.start, lt: period.end } },
            ],
          },
          orderBy: { installedAt: 'desc' },
          select: this.installationWorkSelect(),
        }),
        this.prisma.repair.findMany({
          where: {
            AND: [
              repairAccessWhere(user),
              { engineerId },
              { reportedAt: { gte: period.start, lt: period.end } },
            ],
          },
          orderBy: { reportedAt: 'desc' },
          select: this.repairWorkSelect(),
        }),
        this.prisma.maintenance.findMany({
          where: {
            AND: [
              maintenanceAccessWhere(user),
              { engineerId },
              { scheduledDate: { gte: period.start, lt: period.end } },
            ],
          },
          orderBy: { scheduledDate: 'desc' },
          select: this.maintenanceWorkSelect(),
        }),
        this.prisma.customer.findMany({
          where: {
            AND: [customerAccessWhere(user), { primaryEngineerId: engineerId }],
          },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            shortName: true,
            province: true,
            region: { select: { name: true } },
            _count: { select: { machines: true, repairs: true, maintenances: true, machineInstallations: true } },
          },
        }),
      ]);

    const workRows = [
      ...installations.map((item) => this.installationToWorkRow(item)),
      ...repairs.map((item) => this.repairToWorkRow(item)),
      ...maintenances.map((item) => this.maintenanceToWorkRow(item)),
    ].sort((first, second) => second.date.getTime() - first.date.getTime());
    const customers = this.groupWorkByCustomer(workRows, assignedCustomers);
    const machines = this.groupWorkByMachine(workRows);

    return {
      filters: {
        from: this.formatDateInput(period.start),
        to: this.formatDateInput(new Date(period.end.getTime() - 1)),
      },
      engineer: engineer
        ? {
            id: engineer.id,
            name: this.personName(engineer.fullName, engineer.email),
            email: engineer.email,
            region: engineer.region?.name || null,
            profile: engineer.engineerProfile,
          }
        : {
            id: engineerId,
            name: 'Kỹ sư không còn trong hệ thống',
            email: null,
            region: null,
            profile: null,
          },
      summary: {
        installations: installations.length,
        repairs: repairs.length,
        maintenances: maintenances.length,
        customers: customers.length,
        machines: machines.length,
        assignedCustomers: assignedCustomers.length,
      },
      customers,
      machines,
      workRows,
    };
  }

  private findEngineerFilterOptions(): Promise<EngineerFilterOption[]> {
    return this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          {
            role: {
              name: {
                equals: 'engineer',
              },
            },
          },
          {
            engineerProfile: {
              isNot: null,
            },
          },
        ],
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        region: {
          select: {
            id: true,
            name: true,
          },
        },
        engineerProfile: {
          select: {
            expertiseGroup: true,
          },
        },
      },
      orderBy: {
        fullName: 'asc',
      },
    });
  }

  async getModelReport(
    user: RequestUser,
    modelKey: string,
    query: Record<string, string | undefined> = {},
  ) {
    const period = this.resolvePeriod(query);
    const decodedModelKey = decodeURIComponent(modelKey);
    const model = await this.prisma.machineModel.findFirst({
      where: {
        OR: [
          { id: decodedModelKey },
          { name: decodedModelKey },
          { displayName: decodedModelKey },
          { code: decodedModelKey },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        displayName: true,
        manufacturer: true,
        businessLine: {
          select: {
            name: true,
            productIndustry: { select: { name: true } },
          },
        },
      },
    });
    const modelNames = [model?.id, model?.name, model?.displayName, model?.code, decodedModelKey]
      .filter(Boolean)
      .map((value) => String(value));
    const modelWhere = {
      OR: [
        { plannedMachineModelId: model?.id || decodedModelKey },
        { plannedModelName: { in: modelNames } },
        { machine: { machineModelId: model?.id || decodedModelKey } },
        { machine: { modelName: { in: modelNames } } },
      ],
    };
    const machineModelWhere = {
      OR: [
        { machine: { machineModelId: model?.id || decodedModelKey } },
        { machine: { modelName: { in: modelNames } } },
        { modelName: { in: modelNames } },
      ],
    };
    const [installations, repairs, maintenances] = await Promise.all([
      this.prisma.machineInstallation.findMany({
        where: {
          AND: [
            installationAccessWhere(user),
            modelWhere,
            { installedAt: { gte: period.start, lt: period.end } },
          ],
        },
        orderBy: { installedAt: 'desc' },
        select: this.installationWorkSelect(),
      }),
      this.prisma.repair.findMany({
        where: {
          AND: [
            repairAccessWhere(user),
            machineModelWhere,
            { reportedAt: { gte: period.start, lt: period.end } },
          ],
        },
        orderBy: { reportedAt: 'desc' },
        select: this.repairWorkSelect(),
      }),
      this.prisma.maintenance.findMany({
        where: {
          AND: [
            maintenanceAccessWhere(user),
            machineModelWhere,
            { scheduledDate: { gte: period.start, lt: period.end } },
          ],
        },
        orderBy: { scheduledDate: 'desc' },
        select: this.maintenanceWorkSelect(),
      }),
    ]);

    const workRows = [
      ...installations.map((item) => this.installationToWorkRow(item)),
      ...repairs.map((item) => this.repairToWorkRow(item)),
      ...maintenances.map((item) => this.maintenanceToWorkRow(item)),
    ].sort((first, second) => second.date.getTime() - first.date.getTime());
    const machines = this.groupWorkByMachine(workRows);
    const customers = this.groupWorkByCustomer(workRows, []);

    return {
      filters: {
        from: this.formatDateInput(period.start),
        to: this.formatDateInput(new Date(period.end.getTime() - 1)),
      },
      model: {
        id: model?.id || decodedModelKey,
        name: model?.displayName || model?.name || decodedModelKey,
        code: model?.code || null,
        manufacturer: model?.manufacturer || null,
        businessLine: model?.businessLine?.name || null,
        productIndustry: model?.businessLine?.productIndustry?.name || null,
      },
      summary: {
        installations: installations.length,
        repairs: repairs.length,
        maintenances: maintenances.length,
        customers: customers.length,
        machines: machines.length,
      },
      machines,
      customers,
      workRows,
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

  private async buildInstallationModelFilter(modelKey: string): Promise<Prisma.MachineInstallationWhereInput> {
    const decodedModelKey = decodeURIComponent(modelKey);
    const model = await this.prisma.machineModel.findFirst({
      where: {
        OR: [
          { id: decodedModelKey },
          { name: decodedModelKey },
          { displayName: decodedModelKey },
          { code: decodedModelKey },
        ],
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        code: true,
      },
    });
    const modelNames = [model?.name, model?.displayName, model?.code, decodedModelKey]
      .filter(Boolean)
      .map((value) => String(value));
    const resolvedId = model?.id || decodedModelKey;

    return {
      OR: [
        { plannedMachineModelId: resolvedId },
        { plannedModelName: { in: modelNames } },
        { machine: { machineModelId: resolvedId } },
        { machine: { modelName: { in: modelNames } } },
        { machine: { machineModel: { name: { in: modelNames } } } },
        { machine: { machineModel: { displayName: { in: modelNames } } } },
        { machine: { machineModel: { code: { in: modelNames } } } },
      ],
    };
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

  private installationWorkSelect() {
    return {
      id: true,
      code: true,
      status: true,
      reviewStatus: true,
      installedAt: true,
      installedById: true,
      installedBy: { select: { id: true, email: true, fullName: true } },
      customerId: true,
      customer: {
        select: {
          id: true,
          name: true,
          shortName: true,
          province: true,
          region: { select: { name: true } },
        },
      },
      plannedMachineModelId: true,
      plannedModelName: true,
      plannedMachineModel: { select: { id: true, name: true, displayName: true, code: true } },
      machineId: true,
      machine: {
        select: {
          id: true,
          machineCode: true,
          serialNumber: true,
          modelName: true,
          machineModelId: true,
          machineModel: { select: { id: true, name: true, displayName: true, code: true } },
        },
      },
      note: true,
    } satisfies Prisma.MachineInstallationSelect;
  }

  private repairWorkSelect() {
    return {
      id: true,
      code: true,
      title: true,
      status: true,
      reportedAt: true,
      completedAt: true,
      engineerId: true,
      engineer: { select: { id: true, email: true, fullName: true } },
      customerId: true,
      customer: {
        select: {
          id: true,
          name: true,
          shortName: true,
          province: true,
          region: { select: { name: true } },
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
          machineModel: { select: { id: true, name: true, displayName: true, code: true } },
          customer: { select: { id: true, name: true, shortName: true, province: true } },
        },
      },
      modelName: true,
      serialNumber: true,
      resultNote: true,
      repairMethod: true,
      description: true,
    } satisfies Prisma.RepairSelect;
  }

  private maintenanceWorkSelect() {
    return {
      id: true,
      code: true,
      title: true,
      status: true,
      scheduledDate: true,
      completedAt: true,
      engineerId: true,
      engineer: { select: { id: true, email: true, fullName: true } },
      customerId: true,
      customer: {
        select: {
          id: true,
          name: true,
          shortName: true,
          province: true,
          region: { select: { name: true } },
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
          machineModel: { select: { id: true, name: true, displayName: true, code: true } },
          customer: { select: { id: true, name: true, shortName: true, province: true } },
        },
      },
      modelName: true,
      serialNumber: true,
      resultNote: true,
      description: true,
    } satisfies Prisma.MaintenanceSelect;
  }

  private demoLoanWorkSelect() {
    return {
      id: true,
      code: true,
      status: true,
      plannedHandoverAt: true,
      returnedAt: true,
      purpose: true,
      returnNote: true,
      engineerId: true,
      engineer: { select: { id: true, email: true, fullName: true } },
      customerId: true,
      customer: {
        select: {
          id: true,
          name: true,
          shortName: true,
          province: true,
          region: { select: { name: true } },
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
          machineModel: { select: { id: true, name: true, displayName: true, code: true } },
        },
      },
    } satisfies Prisma.DemoLoanSelect;
  }

  private applicationSupportWorkSelect() {
    return {
      id: true,
      title: true,
      status: true,
      supportedAt: true,
      resolution: true,
      issueDescription: true,
      engineerId: true,
      engineer: { select: { id: true, email: true, fullName: true } },
      customerId: true,
      customerName: true,
      machineText: true,
      customer: {
        select: {
          id: true,
          name: true,
          shortName: true,
          province: true,
          region: { select: { name: true } },
        },
      },
      machineId: true,
      machineModelId: true,
      machineModel: { select: { id: true, name: true, displayName: true, code: true } },
      machine: {
        select: {
          id: true,
          machineCode: true,
          serialNumber: true,
          modelName: true,
          machineModelId: true,
          machineModel: { select: { id: true, name: true, displayName: true, code: true } },
        },
      },
    } satisfies Prisma.ApplicationSupportCaseSelect;
  }

  private installationToWorkRow(item: Prisma.MachineInstallationGetPayload<{ select: ReturnType<ReportsService['installationWorkSelect']> }>): WorkReportRow {
    return {
      id: item.id,
      code: item.code,
      kind: 'installation',
      title: 'Lắp đặt máy',
      status: item.status,
      date: item.installedAt,
      completedAt: item.installedAt,
      engineerId: item.installedById,
      engineer: this.personName(item.installedBy?.fullName, item.installedBy?.email),
      customerId: item.customerId,
      customer: item.customer?.shortName || item.customer?.name || 'Chưa có khách hàng',
      province: item.customer?.province || 'Chưa có tỉnh',
      machineId: item.machineId,
      machineModelId: item.plannedMachineModelId || item.machine?.machineModelId || null,
      model: this.modelName(item),
      machineCode: item.machine?.machineCode || '-',
      serialNumber: item.machine?.serialNumber || '-',
      note: item.note,
    };
  }

  private repairToWorkRow(item: Prisma.RepairGetPayload<{ select: ReturnType<ReportsService['repairWorkSelect']> }>): WorkReportRow {
    return {
      id: item.id,
      code: item.code,
      kind: 'repair',
      title: item.title || 'Sửa chữa',
      status: item.status,
      date: item.reportedAt,
      completedAt: item.completedAt,
      engineerId: item.engineerId,
      engineer: this.personName(item.engineer?.fullName, item.engineer?.email),
      customerId: item.customerId || item.machine?.customer?.id || null,
      customer: item.customer?.shortName || item.customer?.name || item.machine?.customer?.shortName || item.machine?.customer?.name || 'Chưa có khách hàng',
      province: item.customer?.province || item.machine?.customer?.province || 'Chưa có tỉnh',
      machineId: item.machineId,
      machineModelId: item.machine?.machineModelId || null,
      model: item.machine?.machineModel?.displayName || item.machine?.machineModel?.name || item.machine?.modelName || item.modelName || 'Chưa có model',
      machineCode: item.machine?.machineCode || '-',
      serialNumber: item.machine?.serialNumber || item.serialNumber || '-',
      note: item.repairMethod || item.resultNote || item.description,
    };
  }

  private maintenanceToWorkRow(item: Prisma.MaintenanceGetPayload<{ select: ReturnType<ReportsService['maintenanceWorkSelect']> }>): WorkReportRow {
    return {
      id: item.id,
      code: item.code,
      kind: 'maintenance',
      title: item.title || 'Bảo trì',
      status: item.status,
      date: item.scheduledDate,
      completedAt: item.completedAt,
      engineerId: item.engineerId,
      engineer: this.personName(item.engineer?.fullName, item.engineer?.email),
      customerId: item.customerId || item.machine?.customer?.id || null,
      customer: item.customer?.shortName || item.customer?.name || item.machine?.customer?.shortName || item.machine?.customer?.name || 'Chưa có khách hàng',
      province: item.customer?.province || item.machine?.customer?.province || 'Chưa có tỉnh',
      machineId: item.machineId,
      machineModelId: item.machine?.machineModelId || null,
      model: item.machine?.machineModel?.displayName || item.machine?.machineModel?.name || item.machine?.modelName || item.modelName || 'Chưa có model',
      machineCode: item.machine?.machineCode || '-',
      serialNumber: item.machine?.serialNumber || item.serialNumber || '-',
      note: item.resultNote || item.description,
    };
  }

  private demoLoanToWorkRow(item: Prisma.DemoLoanGetPayload<{ select: ReturnType<ReportsService['demoLoanWorkSelect']> }>): WorkReportRow {
    return {
      id: item.id,
      code: item.code,
      kind: 'demo',
      title: 'Demo / dùng thử',
      status: item.status,
      date: item.plannedHandoverAt,
      completedAt: item.returnedAt,
      engineerId: item.engineerId,
      engineer: this.personName(item.engineer?.fullName, item.engineer?.email),
      customerId: item.customerId,
      customer: item.customer?.shortName || item.customer?.name || 'Chưa có khách hàng',
      province: item.customer?.province || 'Chưa có tỉnh',
      machineId: item.machineId,
      machineModelId: item.machine?.machineModelId || null,
      model: item.machine?.machineModel?.displayName || item.machine?.machineModel?.name || item.machine?.modelName || 'Chưa có model',
      machineCode: item.machine?.machineCode || '-',
      serialNumber: item.machine?.serialNumber || '-',
      note: item.returnNote || item.purpose,
    };
  }

  private applicationSupportToWorkRow(item: Prisma.ApplicationSupportCaseGetPayload<{ select: ReturnType<ReportsService['applicationSupportWorkSelect']> }>): WorkReportRow {
    return {
      id: item.id,
      code: `APP-${item.id.slice(-6).toUpperCase()}`,
      kind: 'applicationSupport',
      title: item.title || 'Hỗ trợ app',
      status: item.status,
      date: item.supportedAt,
      completedAt: item.supportedAt,
      engineerId: item.engineerId,
      engineer: this.personName(item.engineer?.fullName, item.engineer?.email),
      customerId: item.customerId,
      customer: item.customer?.shortName || item.customer?.name || item.customerName || 'Chưa có khách hàng',
      province: item.customer?.province || 'Chưa có tỉnh',
      machineId: item.machineId,
      machineModelId: item.machineModelId || item.machine?.machineModelId || null,
      model:
        item.machineModel?.displayName ||
        item.machineModel?.name ||
        item.machine?.machineModel?.displayName ||
        item.machine?.machineModel?.name ||
        item.machine?.modelName ||
        item.machineText ||
        'App xét nghiệm',
      machineCode: item.machine?.machineCode || '-',
      serialNumber: item.machine?.serialNumber || '-',
      note: item.resolution || item.issueDescription,
    };
  }

  private groupTechnicalRows(
    rows: WorkReportRow[],
    idFor: (row: WorkReportRow) => string,
    labelFor: (row: WorkReportRow) => string,
  ): TechnicalReportGroupRow[] {
    const groups = new Map<string, {
      id: string;
      label: string;
      total: number;
      installation: number;
      repair: number;
      maintenance: number;
      demo: number;
      applicationSupport: number;
      customers: Set<string>;
      machines: Set<string>;
      lastWorkedAt: Date | null;
    }>();

    for (const row of rows) {
      const id = idFor(row) || '__missing__';
      const current =
        groups.get(id) ??
        {
          id,
          label: labelFor(row) || 'Chưa có dữ liệu',
          total: 0,
          installation: 0,
          repair: 0,
          maintenance: 0,
          demo: 0,
          applicationSupport: 0,
          customers: new Set<string>(),
          machines: new Set<string>(),
          lastWorkedAt: null,
        };
      current.total += 1;
      if (row.kind === 'installation') current.installation += 1;
      if (row.kind === 'repair') current.repair += 1;
      if (row.kind === 'maintenance') current.maintenance += 1;
      if (row.kind === 'demo') current.demo += 1;
      if (row.kind === 'applicationSupport') current.applicationSupport += 1;
      current.customers.add(row.customerId || row.customer);
      current.machines.add(row.machineId || row.serialNumber || row.machineCode || row.code);
      current.lastWorkedAt = !current.lastWorkedAt || row.date > current.lastWorkedAt ? row.date : current.lastWorkedAt;
      groups.set(id, current);
    }

    return [...groups.values()]
      .map((item) => ({
        id: item.id,
        label: item.label,
        total: item.total,
        installation: item.installation,
        repair: item.repair,
        maintenance: item.maintenance,
        demo: item.demo,
        applicationSupport: item.applicationSupport,
        customers: item.customers.size,
        machines: item.machines.size,
        lastWorkedAt: item.lastWorkedAt,
      }))
      .sort((first, second) => second.total - first.total || first.label.localeCompare(second.label, 'vi'));
  }

  private buildTechnicalMachineGroups(rows: WorkReportRow[]): TechnicalMachineGroupRow[] {
    const groups = new Map<string, {
      id: string;
      machineCode: string;
      serialNumber: string;
      model: string;
      customer: string;
      customerId: string | null;
      province: string;
      total: number;
      installation: number;
      repair: number;
      maintenance: number;
      demo: number;
      applicationSupport: number;
      lastWorkedAt: Date | null;
    }>();

    for (const row of rows) {
      const id = row.machineId || row.serialNumber || row.machineCode || row.code;
      const current =
        groups.get(id) ??
        {
          id,
          machineCode: this.machineGroupLabel(row),
          serialNumber: row.serialNumber,
          model: row.model,
          customer: row.customer,
          customerId: row.customerId,
          province: row.province,
          total: 0,
          installation: 0,
          repair: 0,
          maintenance: 0,
          demo: 0,
          applicationSupport: 0,
          lastWorkedAt: null,
        };
      current.total += 1;
      if (row.kind === 'installation') current.installation += 1;
      if (row.kind === 'repair') current.repair += 1;
      if (row.kind === 'maintenance') current.maintenance += 1;
      if (row.kind === 'demo') current.demo += 1;
      if (row.kind === 'applicationSupport') current.applicationSupport += 1;
      current.lastWorkedAt =
        !current.lastWorkedAt || row.date > current.lastWorkedAt ? row.date : current.lastWorkedAt;
      groups.set(id, current);
    }

    return [...groups.values()]
      .sort(
        (first, second) =>
          second.total - first.total ||
          (second.lastWorkedAt?.getTime() ?? 0) - (first.lastWorkedAt?.getTime() ?? 0),
      );
  }

  private machineGroupLabel(row: WorkReportRow) {
    if (row.machineCode && row.machineCode !== '-') return row.machineCode;
    if (row.serialNumber && row.serialNumber !== '-') return row.serialNumber;
    return 'Chưa có máy';
  }

  private machineKey(row: WorkReportRow) {
    if (row.machineId) return `m:${row.machineId}`;
    if (row.serialNumber && row.serialNumber !== '-') return `s:${row.serialNumber}`;
    if (row.machineCode && row.machineCode !== '-') return `c:${row.machineCode}`;
    return null;
  }

  private buildTechnicalEngineerDetails(rows: WorkReportRow[]): TechnicalEngineerDetailRow[] {
    const engineerGroups = new Map<string, {
      id: string;
      label: string;
      total: number;
      installation: number;
      repair: number;
      maintenance: number;
      demo: number;
      applicationSupport: number;
      customers: Set<string>;
      machines: Set<string>;
      lastWorkedAt: Date | null;
      allRows: WorkReportRow[];
    }>();
    const customerGroupsByEngineer = new Map<string, Map<string, {
      id: string;
      label: string;
      province: string;
      total: number;
      installation: number;
      repair: number;
      maintenance: number;
      demo: number;
      applicationSupport: number;
      customers: Set<string>;
      machines: Set<string>;
      lastWorkedAt: Date | null;
      latestWork: WorkReportRow | null;
    }>>();

    for (const row of rows) {
      const engineerKey = row.engineerId || row.engineer || 'unassigned';
      const engineer =
        engineerGroups.get(engineerKey) ??
        {
          id: engineerKey,
          label: row.engineer || 'Chưa phân công',
          total: 0,
          installation: 0,
          repair: 0,
          maintenance: 0,
          demo: 0,
          applicationSupport: 0,
          customers: new Set<string>(),
          machines: new Set<string>(),
          lastWorkedAt: null,
          allRows: [],
        };

      this.addTechnicalRowToAggregate(engineer, row);
      engineer.allRows.push(row);
      engineerGroups.set(engineerKey, engineer);

      const customerKey = row.customerId || row.customer || 'unknown-customer';
      const customersForEngineer = customerGroupsByEngineer.get(engineerKey) ?? new Map<string, {
        id: string;
        label: string;
        province: string;
        total: number;
        installation: number;
        repair: number;
        maintenance: number;
        demo: number;
        applicationSupport: number;
        customers: Set<string>;
        machines: Set<string>;
        lastWorkedAt: Date | null;
        latestWork: WorkReportRow | null;
      }>();
      const customer =
        customersForEngineer.get(customerKey) ??
        {
          id: customerKey,
          label: row.customer || 'Chưa có khách hàng',
          province: row.province || 'Chưa có tỉnh',
          total: 0,
          installation: 0,
          repair: 0,
          maintenance: 0,
          demo: 0,
          applicationSupport: 0,
          customers: new Set<string>(),
          machines: new Set<string>(),
          lastWorkedAt: null,
          latestWork: null,
        };

      this.addTechnicalRowToAggregate(customer, row);
      customer.latestWork = !customer.latestWork || row.date > customer.latestWork.date ? row : customer.latestWork;
      customersForEngineer.set(customerKey, customer);
      customerGroupsByEngineer.set(engineerKey, customersForEngineer);
    }

    return [...engineerGroups.values()]
      .map((engineer) => ({
        id: engineer.id,
        label: engineer.label,
        total: engineer.total,
        installation: engineer.installation,
        repair: engineer.repair,
        maintenance: engineer.maintenance,
        demo: engineer.demo,
        applicationSupport: engineer.applicationSupport,
        customers: engineer.customers.size,
        machines: engineer.machines.size,
        lastWorkedAt: engineer.lastWorkedAt,
        customersList: [...(customerGroupsByEngineer.get(engineer.id)?.values() ?? [])]
          .map((customer) => ({
            id: customer.id,
            label: customer.label,
            province: customer.province,
            total: customer.total,
            installation: customer.installation,
            repair: customer.repair,
            maintenance: customer.maintenance,
            demo: customer.demo,
            applicationSupport: customer.applicationSupport,
            customers: customer.customers.size,
            machines: customer.machines.size,
            lastWorkedAt: customer.lastWorkedAt,
            latestWork: customer.latestWork,
          }))
          .sort((first, second) => second.total - first.total || first.label.localeCompare(second.label, 'vi')),
        recentWorks: engineer.allRows
          .sort((first, second) => second.date.getTime() - first.date.getTime())
          .slice(0, 8),
      }))
      .sort((first, second) => second.total - first.total || first.label.localeCompare(second.label, 'vi'));
  }

  private addTechnicalRowToAggregate(
    aggregate: {
      total: number;
      installation: number;
      repair: number;
      maintenance: number;
      demo: number;
      applicationSupport: number;
      customers: Set<string>;
      machines: Set<string>;
      lastWorkedAt: Date | null;
    },
    row: WorkReportRow,
  ) {
    aggregate.total += 1;
    if (row.kind === 'installation') aggregate.installation += 1;
    if (row.kind === 'repair') aggregate.repair += 1;
    if (row.kind === 'maintenance') aggregate.maintenance += 1;
    if (row.kind === 'demo') aggregate.demo += 1;
    if (row.kind === 'applicationSupport') aggregate.applicationSupport += 1;
    aggregate.customers.add(row.customerId || row.customer);
    aggregate.machines.add(row.machineId || row.serialNumber || row.machineCode || row.code);
    aggregate.lastWorkedAt = !aggregate.lastWorkedAt || row.date > aggregate.lastWorkedAt ? row.date : aggregate.lastWorkedAt;
  }

  private applicationSupportAccessWhere(user: RequestUser): Prisma.ApplicationSupportCaseWhereInput {
    if (user.roleName === 'admin' || user.roleName === 'manager') {
      return {
        OR: [
          { engineer: { regionId: user.regionId } },
          { customer: { regionId: user.regionId } },
          { customerId: null },
        ],
      };
    }

    return { engineerId: user.id };
  }

  private groupWorkByCustomer(
    workRows: WorkReportRow[],
    assignedCustomers: Array<{
      id: string;
      name: string;
      shortName?: string | null;
      province?: string | null;
      region?: { name: string } | null;
      _count?: {
        machines: number;
        repairs: number;
        maintenances: number;
        machineInstallations: number;
      };
    }>,
  ) {
    const groups = new Map<string, {
      id: string;
      label: string;
      province: string;
      installations: number;
      repairs: number;
      maintenances: number;
      machines: Set<string>;
      lastWorkedAt: Date | null;
      assigned: boolean;
    }>();

    for (const customer of assignedCustomers) {
      groups.set(customer.id, {
        id: customer.id,
        label: customer.shortName || customer.name,
        province: customer.province || customer.region?.name || 'Chưa có tỉnh',
        installations: 0,
        repairs: 0,
        maintenances: 0,
        machines: new Set<string>(),
        lastWorkedAt: null,
        assigned: true,
      });
    }

    for (const row of workRows) {
      const id = row.customerId || row.customer;
      const current =
        groups.get(id) ??
        {
          id,
          label: row.customer,
          province: row.province,
          installations: 0,
          repairs: 0,
          maintenances: 0,
          machines: new Set<string>(),
          lastWorkedAt: null,
          assigned: false,
        };
      if (row.kind === 'installation') current.installations += 1;
      if (row.kind === 'repair') current.repairs += 1;
      if (row.kind === 'maintenance') current.maintenances += 1;
      current.machines.add(row.machineId || row.serialNumber || row.code);
      current.lastWorkedAt =
        !current.lastWorkedAt || row.date > current.lastWorkedAt ? row.date : current.lastWorkedAt;
      groups.set(id, current);
    }

    return [...groups.values()]
      .map((item) => ({
        id: item.id,
        label: item.label,
        province: item.province,
        installations: item.installations,
        repairs: item.repairs,
        maintenances: item.maintenances,
        machines: item.machines.size,
        lastWorkedAt: item.lastWorkedAt,
        assigned: item.assigned,
      }))
      .sort((first, second) => {
        const firstTotal = first.installations + first.repairs + first.maintenances;
        const secondTotal = second.installations + second.repairs + second.maintenances;
        return secondTotal - firstTotal || first.label.localeCompare(second.label, 'vi');
      });
  }

  private groupWorkByMachine(workRows: WorkReportRow[]) {
    const groups = new Map<string, {
      id: string;
      label: string;
      serialNumber: string;
      model: string;
      customerId: string | null;
      customer: string;
      province: string;
      installations: number;
      repairs: number;
      maintenances: number;
      lastWorkedAt: Date | null;
      notes: string[];
    }>();

    for (const row of workRows) {
      const id = row.machineId || row.serialNumber || row.code;
      const current =
        groups.get(id) ??
        {
          id,
          label: row.machineCode !== '-' ? row.machineCode : row.serialNumber,
          serialNumber: row.serialNumber,
          model: row.model,
          customerId: row.customerId,
          customer: row.customer,
          province: row.province,
          installations: 0,
          repairs: 0,
          maintenances: 0,
          lastWorkedAt: null,
          notes: [],
        };
      if (row.kind === 'installation') current.installations += 1;
      if (row.kind === 'repair') current.repairs += 1;
      if (row.kind === 'maintenance') current.maintenances += 1;
      if (row.note) current.notes.push(row.note);
      current.lastWorkedAt =
        !current.lastWorkedAt || row.date > current.lastWorkedAt ? row.date : current.lastWorkedAt;
      groups.set(id, current);
    }

    return [...groups.values()]
      .map((item) => ({
        ...item,
        notes: item.notes.slice(0, 3),
      }))
      .sort((first, second) => (second.lastWorkedAt?.getTime() ?? 0) - (first.lastWorkedAt?.getTime() ?? 0));
  }
}

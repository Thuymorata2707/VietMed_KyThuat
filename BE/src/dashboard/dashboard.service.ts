import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  customerAccessWhere,
  demoLoanAccessWhere,
  deviceServiceTicketAccessWhere,
  inventoryMovementAccessWhere,
  installationAccessWhere,
  machineAccessWhere,
  maintenanceAccessWhere,
  repairAccessWhere,
  userAccessWhere,
} from '../auth/access-scope';
import { RequestUser } from '../common/request-user.type';
import { addDateOnlyDays, startOfVietnamDay } from '../common/date-only';
import { isMaintenanceOverdue } from '../common/maintenance-overdue';
import { buildBusinessLineIndustryScope } from './industry-scope';
import { PrismaService } from '../prisma/prisma.service';

type MachineStatusValue = 'ACTIVE' | 'MAINTENANCE' | 'REPAIRING' | 'INACTIVE';
type MachineInventoryStatusValue =
  | 'IN_STOCK'
  | 'ACCESSORY_SPLIT'
  | 'INSTALLED'
  | 'RESERVED'
  | 'RETURNED'
  | 'SOLD';
type CustomerStatusValue = 'ACTIVE' | 'INACTIVE' | 'POTENTIAL' | 'BLACKLISTED';
type CustomerTypeValue =
  | 'HOSPITAL'
  | 'CLINIC'
  | 'LAB'
  | 'DISTRIBUTOR'
  | 'UNIVERSITY'
  | 'COMPANY'
  | 'OTHER';
type MachineProductCategoryValue =
  | 'ULTRASOUND'
  | 'LAB_TESTING'
  | 'BIOCHEMISTRY'
  | 'IMMUNOLOGY'
  | 'HEMATOLOGY'
  | 'X_RAY'
  | 'ENDOSCOPY'
  | 'OTHER';
type RepairStatusValue =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_PARTS'
  | 'COMPLETED'
  | 'CANCELLED';
type MaintenanceStatusValue =
  | 'SCHEDULED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'CANCELLED';
type TechnicalTaskKind = 'repair' | 'maintenance' | 'installation';
type TechnicalTask = {
  id: string;
  kind: TechnicalTaskKind;
  status: string;
  reviewStatus: string;
  date: Date;
  dueDate?: Date;
  completedAt?: Date | null;
  engineerId?: string | null;
  engineerName?: string | null;
  customerId?: string | null;
  machineId?: string | null;
  productIndustryId?: string | null;
  productIndustryName: string;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getTechnicalStatistics(
    user: RequestUser,
    query: Record<string, string | undefined> = {},
  ) {
    const period = this.resolveStatisticsPeriod(query);
    const engineerId = query.engineerId?.trim();
    const requestedProductIndustryId = query.productIndustryId?.trim();
    const workType = query.workType?.trim();
    const includeRepairs = !workType || workType === 'repair';
    const includeMaintenances = !workType || workType === 'maintenance';
    const includeInstallations = !workType || workType === 'installation';
    const selectedEngineer = engineerId
      ? await this.prisma.user.findUnique({
          where: { id: engineerId },
          select: {
            engineerProfile: {
              select: {
                expertiseGroup: true,
                expertiseImaging: true,
                expertiseLabTesting: true,
              },
            },
          },
        })
      : null;
    const engineerExpertiseGroups = selectedEngineer?.engineerProfile
      ? [selectedEngineer.engineerProfile.expertiseImaging ? 'IMAGING' : null, selectedEngineer.engineerProfile.expertiseLabTesting ? 'LAB_TESTING' : null]
          .filter((group): group is 'IMAGING' | 'LAB_TESTING' => Boolean(group))
      : selectedEngineer?.engineerProfile?.expertiseGroup ? [selectedEngineer.engineerProfile.expertiseGroup] : [];
    const businessLineIndustryScope = buildBusinessLineIndustryScope(
      requestedProductIndustryId,
      engineerExpertiseGroups,
    );
    const hasIndustryScope = Boolean(
      requestedProductIndustryId || engineerExpertiseGroups.length,
    );

    const repairWhere: Prisma.RepairWhereInput = {
      AND: [
        repairAccessWhere(user),
        { reportedAt: { gte: period.start, lt: period.end } },
        engineerId ? { engineerId } : {},
        hasIndustryScope
          ? {
              machine: {
                businessLine: businessLineIndustryScope,
              },
            }
          : {},
      ],
    };
    const maintenanceWhere: Prisma.MaintenanceWhereInput = {
      AND: [
        maintenanceAccessWhere(user),
        { scheduledDate: { gte: period.start, lt: period.end } },
        engineerId ? { engineerId } : {},
        hasIndustryScope
          ? {
              machine: {
                businessLine: businessLineIndustryScope,
              },
            }
          : {},
      ],
    };
    const installationWhere: Prisma.MachineInstallationWhereInput = {
      AND: [
        installationAccessWhere(user),
        { installedAt: { gte: period.start, lt: period.end } },
        engineerId ? { installedById: engineerId } : {},
        hasIndustryScope
          ? {
              OR: [
                {
                  businessLine: businessLineIndustryScope,
                },
                {
                  machine: {
                    businessLine: businessLineIndustryScope,
                  },
                },
                {
                  plannedMachineModel: {
                    businessLine: businessLineIndustryScope,
                  },
                },
              ],
            }
          : {},
      ],
    };

    const [repairs, maintenances, installations, engineers, industries] =
      await Promise.all([
        includeRepairs
          ? this.prisma.repair.findMany({
              where: repairWhere,
              select: {
                id: true,
                status: true,
                reviewStatus: true,
                reportedAt: true,
                completedAt: true,
                engineer: { select: this.userSummarySelect() },
                engineerId: true,
                customerId: true,
                customer: { select: this.customerSummarySelect() },
                machineId: true,
                machine: {
                  select: {
                    id: true,
                    customerId: true,
                    customer: { select: this.customerSummarySelect() },
                    businessLine: {
                      select: {
                        productIndustry: {
                          select: {
                            id: true,
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            })
          : [],
        includeMaintenances
          ? this.prisma.maintenance.findMany({
              where: maintenanceWhere,
              select: {
                id: true,
                status: true,
                reviewStatus: true,
                scheduledDate: true,
                completedAt: true,
                engineer: { select: this.userSummarySelect() },
                engineerId: true,
                customerId: true,
                customer: { select: this.customerSummarySelect() },
                machineId: true,
                machine: {
                  select: {
                    id: true,
                    customerId: true,
                    customer: { select: this.customerSummarySelect() },
                    businessLine: {
                      select: {
                        productIndustry: {
                          select: {
                            id: true,
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            })
          : [],
        includeInstallations
          ? this.prisma.machineInstallation.findMany({
              where: installationWhere,
              select: {
                id: true,
                status: true,
                reviewStatus: true,
                installedAt: true,
                installedBy: { select: this.userSummarySelect() },
                installedById: true,
                customerId: true,
                customer: { select: this.customerSummarySelect() },
                machineId: true,
                machine: {
                  select: {
                    id: true,
                    businessLine: {
                      select: {
                        productIndustry: {
                          select: {
                            id: true,
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
                businessLine: {
                  select: {
                    productIndustry: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
                plannedMachineModel: {
                  select: {
                    businessLine: {
                      select: {
                        productIndustry: {
                          select: {
                            id: true,
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            })
          : [],
        this.prisma.user.findMany({
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
        }),
        this.prisma.productIndustry.findMany({
          where: {
            status: 'ACTIVE',
          },
          select: {
            id: true,
            name: true,
            code: true,
            expertiseGroup: true,
            sortOrder: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }),
      ]);

    const tasks = [
      ...repairs.map((item) => ({
        id: item.id,
        kind: 'repair' as const,
        status: item.status,
        reviewStatus: item.reviewStatus,
        date: item.reportedAt,
        completedAt: item.completedAt,
        engineerId: item.engineerId,
        engineerName: item.engineer?.fullName || item.engineer?.email || null,
        customerId: item.customerId || item.machine?.customerId || null,
        machineId: item.machineId,
        productIndustryId:
          item.machine?.businessLine?.productIndustry?.id || null,
        productIndustryName:
          item.machine?.businessLine?.productIndustry?.name ||
          'Chưa phân ngành',
      })),
      ...maintenances.map((item) => ({
        id: item.id,
        kind: 'maintenance' as const,
        status: item.status,
        reviewStatus: item.reviewStatus,
        date: item.scheduledDate,
        dueDate: item.scheduledDate,
        completedAt: item.completedAt,
        engineerId: item.engineerId,
        engineerName: item.engineer?.fullName || item.engineer?.email || null,
        customerId: item.customerId || item.machine?.customerId || null,
        machineId: item.machineId,
        productIndustryId:
          item.machine?.businessLine?.productIndustry?.id || null,
        productIndustryName:
          item.machine?.businessLine?.productIndustry?.name ||
          'Chưa phân ngành',
      })),
      ...installations.map((item) => {
        const productIndustry =
          item.businessLine?.productIndustry ||
          item.machine?.businessLine?.productIndustry ||
          item.plannedMachineModel?.businessLine?.productIndustry ||
          null;
        return {
          id: item.id,
          kind: 'installation' as const,
          status: item.status,
          reviewStatus: item.reviewStatus,
          date: item.installedAt,
          completedAt: item.status === 'INSTALLED' ? item.installedAt : null,
          engineerId: item.installedById,
          engineerName:
            item.installedBy?.fullName || item.installedBy?.email || null,
          customerId: item.customerId,
          machineId: item.machineId,
          productIndustryId: productIndustry?.id || null,
          productIndustryName: productIndustry?.name || 'Chưa phân ngành',
        };
      }),
    ];

    const customers = new Set(
      tasks.map((item) => item.customerId).filter(Boolean),
    );
    const machines = new Set(
      tasks.map((item) => item.machineId).filter(Boolean),
    );
    const completed = tasks.filter((item) =>
      this.isCompletedTask(item.kind, item.status),
    ).length;
    const open = tasks.filter(
      (item) => !this.isClosedTask(item.kind, item.status),
    ).length;
    const waitingReview = tasks.filter(
      (item) => item.reviewStatus === 'PENDING',
    ).length;
    const todayStart = startOfVietnamDay();
    const overdue = tasks.filter((item) =>
      this.isOverdueTask(
        item.kind,
        item.status,
        'dueDate' in item ? item.dueDate : undefined,
        todayStart,
      ),
    ).length;
    const completionRate = tasks.length
      ? Math.round((completed / tasks.length) * 100)
      : 0;
    const typeCounts = {
      repair: tasks.filter((item) => item.kind === 'repair').length,
      maintenance: tasks.filter((item) => item.kind === 'maintenance').length,
      installation: tasks.filter((item) => item.kind === 'installation').length,
    };

    return {
      period: {
        month: period.month,
        start: period.start.toISOString(),
        end: period.end.toISOString(),
      },
      filters: {
        engineers,
        productIndustries: industries,
      },
      summary: {
        total: tasks.length,
        completed,
        open,
        waitingReview,
        overdue,
        customers: customers.size,
        machines: machines.size,
        completionRate,
      },
      typeCounts,
      byEngineer: this.buildEngineerStatistics(tasks),
      byIndustry: this.buildIndustryStatistics(tasks),
      trend: this.buildDailyTrend(tasks, period.start, period.end),
    };
  }

  async getTechnicalMachines(
    user?: RequestUser,
    query: Record<string, string | undefined> = {},
  ) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
    const search = query.search?.trim();
    const businessLineId = query.businessLineId?.trim();
    const productIndustryId = query.productIndustryId?.trim();
    const installState = query.installState?.trim();
    const accessScope = machineAccessWhere(user);
    const baseFilters: Prisma.MachineWhereInput[] = [];

    if (search) {
      baseFilters.push({
        OR: [
          { machineCode: { contains: search } },
          { serialNumber: { contains: search } },
          { name: { contains: search } },
          { modelName: { contains: search } },
          { manufacturer: { contains: search } },
          {
            customer: {
              OR: [
                { name: { contains: search } },
                { hospitalName: { contains: search } },
                { customerCode: { contains: search } },
              ],
            },
          },
          {
            installations: {
              some: {
                customer: {
                  OR: [
                    { name: { contains: search } },
                    {
                      hospitalName: {
                        contains: search,
                      },
                    },
                    {
                      customerCode: {
                        contains: search,
                      },
                    },
                  ],
                },
              },
            },
          },
          {
            accessories: {
              some: {
                OR: [
                  { name: { contains: search } },
                  { code: { contains: search } },
                  { serialNumber: { contains: search } },
                ],
              },
            },
          },
        ],
      });
    }

    if (installState === 'INSTALLED') {
      baseFilters.push({
        OR: [
          { inventoryStatus: 'INSTALLED' },
          { installations: { some: {} } },
          { customerId: { not: null } },
        ],
      });
    } else if (installState === 'UNINSTALLED') {
      baseFilters.push({
        AND: [
          { inventoryStatus: { not: 'INSTALLED' } },
          { installations: { none: {} } },
          { customerId: null },
        ],
      });
    }

    if (productIndustryId) {
      baseFilters.push({
        businessLine: {
          productIndustryId,
        },
      });
    }

    const filterWhere: Prisma.MachineWhereInput = {
      AND: [accessScope, ...baseFilters],
    };
    const selectedBusinessLineWhere: Prisma.MachineWhereInput =
      businessLineId === '__unassigned__'
        ? { businessLineId: null }
        : businessLineId
          ? { businessLineId }
          : {};
    const where: Prisma.MachineWhereInput = {
      AND: [filterWhere, selectedBusinessLineWhere],
    };

    const [total, filteredTotal, businessLineCounts, machines] =
      await Promise.all([
        this.prisma.machine.count({ where: accessScope }),
        this.prisma.machine.count({ where }),
        this.prisma.machine.groupBy({
          by: ['businessLineId'],
          where: filterWhere,
          _count: {
            _all: true,
          },
        }),
        this.prisma.machine.findMany({
          where,
          select: {
            id: true,
            machineCode: true,
            serialNumber: true,
            machineModelId: true,
            modelName: true,
            name: true,
            manufacturer: true,
            productCategory: true,
            status: true,
            inventoryStatus: true,
            dataStatus: true,
            createdSource: true,
            installDate: true,
            warrantyStartDate: true,
            warrantyEndDate: true,
            businessLine: {
              select: {
                id: true,
                code: true,
                name: true,
                productCategory: true,
                productIndustry: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    expertiseGroup: true,
                  },
                },
              },
            },
            customer: {
              select: {
                id: true,
                customerCode: true,
                name: true,
                hospitalName: true,
                phone: true,
                contactPerson: true,
                contactPhone: true,
                province: true,
                district: true,
                address: true,
                fullAddress: true,
              },
            },
            installedBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
            primaryEngineer: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
            installations: {
              select: {
                id: true,
                code: true,
                status: true,
                installedAt: true,
                receiverInstallAddress: true,
                receiverRepresentative: true,
                receiverPhone: true,
                customer: {
                  select: {
                    id: true,
                    customerCode: true,
                    name: true,
                    hospitalName: true,
                    phone: true,
                    contactPerson: true,
                    contactPhone: true,
                    province: true,
                    district: true,
                    address: true,
                    fullAddress: true,
                  },
                },
                installedBy: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    phone: true,
                  },
                },
                warrantyCard: {
                  select: {
                    id: true,
                    code: true,
                    status: true,
                    startDate: true,
                    endDate: true,
                  },
                },
              },
              orderBy: {
                installedAt: 'desc',
              },
              take: 1,
            },
            accessories: {
              select: {
                id: true,
                code: true,
                name: true,
                quantity: true,
                serialNumber: true,
                description: true,
                note: true,
                componentAccessory: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    component: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                      },
                    },
                  },
                },
              },
              orderBy: [{ name: 'asc' }, { serialNumber: 'asc' }],
            },
          },
          orderBy: [{ businessLine: { name: 'asc' } }, { serialNumber: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

    const businessLineIds = businessLineCounts
      .map((item) => item.businessLineId)
      .filter((id): id is string => Boolean(id));
    const businessLines = businessLineIds.length
      ? await this.prisma.businessLine.findMany({
          where: {
            id: {
              in: businessLineIds,
            },
          },
          select: {
            id: true,
            code: true,
            name: true,
            productCategory: true,
            productIndustry: {
              select: {
                id: true,
                code: true,
                name: true,
                expertiseGroup: true,
              },
            },
          },
        })
      : [];

    const businessLineLookup = new Map(
      businessLines.map((businessLine) => [businessLine.id, businessLine]),
    );
    const businessLineGroups = businessLineCounts
      .map((item) => {
        const businessLine = item.businessLineId
          ? businessLineLookup.get(item.businessLineId)
          : null;
        return {
          id: businessLine?.id ?? null,
          code: businessLine?.code ?? null,
          name: businessLine?.name ?? 'Chưa phân ngành',
          productCategory: businessLine?.productCategory ?? 'OTHER',
          productIndustry: businessLine?.productIndustry ?? null,
          count: item._count._all,
        };
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
    const productIndustryGroups = Array.from(
      businessLineGroups.reduce((map, businessLine) => {
        const productIndustry = businessLine.productIndustry;
        const key = productIndustry?.id ?? '__unassigned__';
        const current = map.get(key) ?? {
          id: productIndustry?.id ?? null,
          code: productIndustry?.code ?? null,
          name: productIndustry?.name ?? 'Chưa phân ngành',
          expertiseGroup: productIndustry?.expertiseGroup ?? null,
          count: 0,
          businessLines: 0,
        };

        current.count += businessLine.count;
        current.businessLines += 1;
        map.set(key, current);
        return map;
      }, new Map<string, { id: string | null; code: string | null; name: string; expertiseGroup: string | null; count: number; businessLines: number }>()),
    )
      .map(([, group]) => group)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });

    return {
      total,
      filteredTotal,
      page,
      limit,
      totalPages: Math.ceil(filteredTotal / limit),
      businessLines: businessLineGroups,
      productIndustries: productIndustryGroups,
      machines: machines.map((machine) => {
        const latestInstallation = machine.installations[0] ?? null;
        const currentInstallation =
          machine.inventoryStatus === 'INSTALLED' ? latestInstallation : null;
        const installedCustomer =
          currentInstallation?.customer ??
          (machine.inventoryStatus === 'INSTALLED' ? machine.customer : null);
        const installedAt =
          currentInstallation?.installedAt ?? machine.installDate;

        return {
          id: machine.id,
          machineCode: machine.machineCode,
          serialNumber: machine.serialNumber,
          machineModelId: machine.machineModelId,
          modelName: machine.modelName,
          name: machine.name,
          manufacturer: machine.manufacturer,
          productCategory: machine.productCategory,
          status: machine.status,
          inventoryStatus: machine.inventoryStatus,
          dataStatus: machine.dataStatus,
          createdSource: machine.createdSource,
          installDate: installedAt,
          warrantyStartDate:
            currentInstallation?.warrantyCard?.startDate ??
            machine.warrantyStartDate,
          warrantyEndDate:
            currentInstallation?.warrantyCard?.endDate ??
            machine.warrantyEndDate,
          businessLine: machine.businessLine,
          installedBy: currentInstallation?.installedBy ?? machine.installedBy,
          primaryEngineer: machine.primaryEngineer,
          installation: currentInstallation
            ? {
                id: currentInstallation.id,
                code: currentInstallation.code,
                status: currentInstallation.status,
                installedAt: currentInstallation.installedAt,
                receiverInstallAddress:
                  currentInstallation.receiverInstallAddress,
                receiverRepresentative:
                  currentInstallation.receiverRepresentative,
                receiverPhone: currentInstallation.receiverPhone,
                warrantyCard: currentInstallation.warrantyCard,
              }
            : null,
          customer: installedCustomer,
          accessories: machine.accessories,
        };
      }),
    };
  }

  async getTechnicalMachinesLegacy(user?: RequestUser) {
    const machines = await this.prisma.machine.findMany({
      where: machineAccessWhere(user),
      select: {
        id: true,
        machineCode: true,
        serialNumber: true,
        modelName: true,
        name: true,
        manufacturer: true,
        productCategory: true,
        status: true,
        inventoryStatus: true,
        installDate: true,
        warrantyStartDate: true,
        warrantyEndDate: true,
        businessLine: {
          select: {
            id: true,
            code: true,
            name: true,
            productCategory: true,
          },
        },
        customer: {
          select: {
            id: true,
            customerCode: true,
            name: true,
            hospitalName: true,
            phone: true,
            contactPerson: true,
            contactPhone: true,
            province: true,
            district: true,
            address: true,
            fullAddress: true,
          },
        },
        installedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        primaryEngineer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        installations: {
          select: {
            id: true,
            code: true,
            status: true,
            installedAt: true,
            receiverInstallAddress: true,
            receiverRepresentative: true,
            receiverPhone: true,
            customer: {
              select: {
                id: true,
                customerCode: true,
                name: true,
                hospitalName: true,
                phone: true,
                contactPerson: true,
                contactPhone: true,
                province: true,
                district: true,
                address: true,
                fullAddress: true,
              },
            },
            installedBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
            warrantyCard: {
              select: {
                id: true,
                code: true,
                status: true,
                startDate: true,
                endDate: true,
              },
            },
          },
          orderBy: {
            installedAt: 'desc',
          },
          take: 1,
        },
        accessories: {
          select: {
            id: true,
            code: true,
            name: true,
            quantity: true,
            serialNumber: true,
            description: true,
            note: true,
            componentAccessory: {
              select: {
                id: true,
                code: true,
                name: true,
                component: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: [{ name: 'asc' }, { serialNumber: 'asc' }],
        },
      },
      orderBy: [{ businessLine: { name: 'asc' } }, { serialNumber: 'asc' }],
    });

    const groups = new Map<
      string,
      {
        id: string | null;
        code: string | null;
        name: string;
        productCategory: MachineProductCategoryValue;
        count: number;
        machines: unknown[];
      }
    >();

    for (const machine of machines) {
      const businessLine = machine.businessLine;
      const groupKey = businessLine?.id ?? '__unassigned__';
      const latestInstallation = machine.installations[0] ?? null;
      const currentInstallation =
        machine.inventoryStatus === 'INSTALLED' ? latestInstallation : null;
      const installedCustomer =
        currentInstallation?.customer ??
        (machine.inventoryStatus === 'INSTALLED' ? machine.customer : null);
      const installedAt =
        currentInstallation?.installedAt ?? machine.installDate;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: businessLine?.id ?? null,
          code: businessLine?.code ?? null,
          name: businessLine?.name ?? 'Chưa phân ngành',
          productCategory:
            businessLine?.productCategory ?? machine.productCategory ?? 'OTHER',
          count: 0,
          machines: [],
        });
      }

      const group = groups.get(groupKey);
      if (!group) continue;

      group.count += 1;
      group.machines.push({
        id: machine.id,
        machineCode: machine.machineCode,
        serialNumber: machine.serialNumber,
        modelName: machine.modelName,
        name: machine.name,
        manufacturer: machine.manufacturer,
        productCategory: machine.productCategory,
        status: machine.status,
        inventoryStatus: machine.inventoryStatus,
        installDate: installedAt,
        warrantyStartDate:
          currentInstallation?.warrantyCard?.startDate ??
          machine.warrantyStartDate,
        warrantyEndDate:
          currentInstallation?.warrantyCard?.endDate ?? machine.warrantyEndDate,
        businessLine: machine.businessLine,
        installedBy: currentInstallation?.installedBy ?? machine.installedBy,
        primaryEngineer: machine.primaryEngineer,
        installation: currentInstallation
          ? {
              id: currentInstallation.id,
              code: currentInstallation.code,
              status: currentInstallation.status,
              installedAt: currentInstallation.installedAt,
              receiverInstallAddress:
                currentInstallation.receiverInstallAddress,
              receiverRepresentative:
                currentInstallation.receiverRepresentative,
              receiverPhone: currentInstallation.receiverPhone,
              warrantyCard: currentInstallation.warrantyCard,
            }
          : null,
        customer: installedCustomer,
        accessories: machine.accessories,
      });
    }

    return {
      total: machines.length,
      businessLines: Array.from(groups.values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      }),
    };
  }

  async getSummary(user?: RequestUser) {
    const todayStart = startOfVietnamDay();
    const customerScope = customerAccessWhere(user);
    const businessLineScope = this.businessLineAccessWhere(user);
    const inventoryMovementScope = inventoryMovementAccessWhere(user);
    const machineScope = machineAccessWhere(user);
    const userScope = this.userAccessWhere(user);
    const repairScope = repairAccessWhere(user);
    const maintenanceScope = maintenanceAccessWhere(user);
    const installationScope = installationAccessWhere(user);
    const demoLoanScope = demoLoanAccessWhere(user);
    const deviceServiceTicketScope = deviceServiceTicketAccessWhere(user);

    const [
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      potentialCustomers,
      blacklistedCustomers,
      hospitalCustomers,
      clinicCustomers,
      labCustomers,
      distributorCustomers,
      universityCustomers,
      companyCustomers,
      otherCustomers,
      totalBusinessLines,
      activeBusinessLines,
      inactiveBusinessLines,
      totalInventoryMovements,
      totalMachines,
      verifiedMachines,
      unverifiedMachines,
      pendingReviewMachines,
      engineerCreatedMachines,
      totalUsers,
      totalRepairs,
      activeMachines,
      machinesInMaintenance,
      machinesRepairing,
      inactiveMachines,
      machinesInStock,
      machinesAccessorySplit,
      machinesInstalledInventory,
      machinesReserved,
      machinesReturned,
      machinesSold,
      ultrasoundMachines,
      labTestingMachines,
      biochemistryMachines,
      immunologyMachines,
      hematologyMachines,
      xRayMachines,
      endoscopyMachines,
      otherMachines,
      pendingRepairs,
      assignedRepairs,
      inProgressRepairs,
      waitingPartsRepairs,
      completedRepairs,
      cancelledRepairs,
      totalMaintenances,
      scheduledMaintenances,
      assignedMaintenances,
      inProgressMaintenances,
      completedMaintenances,
      overdueMaintenances,
      cancelledMaintenances,
      upcomingMaintenances,
      repairsWithoutMachine,
      openRepairsWithoutMachine,
      maintenancesWithoutMachine,
      openMaintenancesWithoutMachine,
      openMaintenances,
      openInstallations,
      openDemoLoans,
      openDeviceServiceTickets,
      returnedRepairingMachines,
    ] = await Promise.all([
      this.prisma.customer.count({
        where: this.customerWhere(customerScope),
      }),
      this.prisma.customer.count({
        where: this.customerWhere(customerScope, { status: 'ACTIVE' }),
      }),
      this.prisma.customer.count({
        where: this.customerWhere(customerScope, { status: 'INACTIVE' }),
      }),
      this.prisma.customer.count({
        where: this.customerWhere(customerScope, { status: 'POTENTIAL' }),
      }),
      this.prisma.customer.count({
        where: this.customerWhere(customerScope, { status: 'BLACKLISTED' }),
      }),
      this.prisma.customer.count({
        where: this.customerWhere(customerScope, { customerType: 'HOSPITAL' }),
      }),
      this.prisma.customer.count({
        where: this.customerWhere(customerScope, { customerType: 'CLINIC' }),
      }),
      this.prisma.customer.count({
        where: this.customerWhere(customerScope, { customerType: 'LAB' }),
      }),
      this.prisma.customer.count({
        where: this.customerWhere(customerScope, {
          customerType: 'DISTRIBUTOR',
        }),
      }),
      this.prisma.customer.count({
        where: this.customerWhere(customerScope, {
          customerType: 'UNIVERSITY',
        }),
      }),
      this.prisma.customer.count({
        where: this.customerWhere(customerScope, { customerType: 'COMPANY' }),
      }),
      this.prisma.customer.count({
        where: this.customerWhere(customerScope, { customerType: 'OTHER' }),
      }),
      this.prisma.businessLine.count({
        where: this.businessLineWhere(businessLineScope),
      }),
      this.prisma.businessLine.count({
        where: this.businessLineWhere(businessLineScope, { status: 'ACTIVE' }),
      }),
      this.prisma.businessLine.count({
        where: this.businessLineWhere(businessLineScope, {
          status: 'INACTIVE',
        }),
      }),
      this.prisma.machineInventoryMovement.count({
        where: this.inventoryMovementWhere(inventoryMovementScope),
      }),
      this.prisma.machine.count({ where: this.machineWhere(machineScope) }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, { dataStatus: 'VERIFIED' }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, {
          dataStatus: { not: 'VERIFIED' },
        }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, {
          dataStatus: 'PENDING_REVIEW',
        }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, { createdSource: 'ENGINEER' }),
      }),
      this.prisma.user.count({ where: this.userWhere(userScope) }),
      this.prisma.repair.count({ where: this.repairWhere(repairScope) }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, { status: 'ACTIVE' }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, { status: 'MAINTENANCE' }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, { status: 'REPAIRING' }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, { status: 'INACTIVE' }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, { inventoryStatus: 'IN_STOCK' }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, {
          inventoryStatus: 'ACCESSORY_SPLIT',
        }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, {
          inventoryStatus: 'INSTALLED',
        }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, { inventoryStatus: 'RESERVED' }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, { inventoryStatus: 'RETURNED' }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, { inventoryStatus: 'SOLD' }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, {
          productCategory: 'ULTRASOUND',
        }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, {
          productCategory: 'LAB_TESTING',
        }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, {
          productCategory: 'BIOCHEMISTRY',
        }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, {
          productCategory: 'IMMUNOLOGY',
        }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, {
          productCategory: 'HEMATOLOGY',
        }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, { productCategory: 'X_RAY' }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, {
          productCategory: 'ENDOSCOPY',
        }),
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, { productCategory: 'OTHER' }),
      }),
      this.prisma.repair.count({
        where: this.repairWhere(repairScope, { status: 'PENDING' }),
      }),
      this.prisma.repair.count({
        where: this.repairWhere(repairScope, { status: 'ASSIGNED' }),
      }),
      this.prisma.repair.count({
        where: this.repairWhere(repairScope, { status: 'IN_PROGRESS' }),
      }),
      this.prisma.repair.count({
        where: this.repairWhere(repairScope, { status: 'WAITING_PARTS' }),
      }),
      this.prisma.repair.count({
        where: this.repairWhere(repairScope, { status: 'COMPLETED' }),
      }),
      this.prisma.repair.count({
        where: this.repairWhere(repairScope, { status: 'CANCELLED' }),
      }),
      this.prisma.maintenance.count({
        where: this.maintenanceWhere(maintenanceScope),
      }),
      this.prisma.maintenance.count({
        where: this.maintenanceWhere(maintenanceScope, { status: 'SCHEDULED' }),
      }),
      this.prisma.maintenance.count({
        where: this.maintenanceWhere(maintenanceScope, { status: 'ASSIGNED' }),
      }),
      this.prisma.maintenance.count({
        where: this.maintenanceWhere(maintenanceScope, {
          status: 'IN_PROGRESS',
        }),
      }),
      this.prisma.maintenance.count({
        where: this.maintenanceWhere(maintenanceScope, { status: 'COMPLETED' }),
      }),
      this.prisma.maintenance.count({
        where: this.maintenanceWhere(maintenanceScope, {
          OR: [
            { status: 'OVERDUE' },
            {
              status: { in: ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS'] },
              scheduledDate: { lt: todayStart },
            },
          ],
        }),
      }),
      this.prisma.maintenance.count({
        where: this.maintenanceWhere(maintenanceScope, { status: 'CANCELLED' }),
      }),
      this.prisma.maintenance.count({
        where: this.maintenanceWhere(maintenanceScope, {
          status: {
            in: ['SCHEDULED', 'ASSIGNED'],
          },
          scheduledDate: {
            gte: todayStart,
            lte: addDateOnlyDays(todayStart, 30),
          },
        }),
      }),
      this.prisma.repair.count({
        where: this.repairWhere(repairScope, { machineId: null }),
      }),
      this.prisma.repair.count({
        where: this.repairWhere(repairScope, {
          machineId: null,
          status: {
            in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS'],
          },
        }),
      }),
      this.prisma.maintenance.count({
        where: this.maintenanceWhere(maintenanceScope, { machineId: null }),
      }),
      this.prisma.maintenance.count({
        where: this.maintenanceWhere(maintenanceScope, {
          machineId: null,
          status: {
            in: ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'OVERDUE'],
          },
        }),
      }),
      this.prisma.maintenance.count({
        where: this.maintenanceWhere(maintenanceScope, {
          status: { in: ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'OVERDUE'] },
        }),
      }),
      this.prisma.machineInstallation.count({
        where: { AND: [installationScope, { status: 'PENDING' }] },
      }),
      this.prisma.demoLoan.count({
        where: {
          AND: [demoLoanScope, { status: { in: ['PLANNED', 'HANDED_OVER', 'OVERDUE'] } }],
        },
      }),
      this.prisma.deviceServiceTicket.count({
        where: { AND: [deviceServiceTicketScope, { status: 'RECEIVED' }] },
      }),
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, {
          inventoryStatus: 'RETURNED',
          status: 'REPAIRING',
        }),
      }),
    ]);

    const machineStatusCounts: Record<MachineStatusValue, number> = {
      ACTIVE: activeMachines,
      MAINTENANCE: machinesInMaintenance,
      REPAIRING: machinesRepairing,
      INACTIVE: inactiveMachines,
    };
    const machineInventoryStatusCounts: Record<
      MachineInventoryStatusValue,
      number
    > = {
      IN_STOCK: machinesInStock,
      ACCESSORY_SPLIT: machinesAccessorySplit,
      INSTALLED: machinesInstalledInventory,
      RESERVED: machinesReserved,
      RETURNED: machinesReturned,
      SOLD: machinesSold,
    };
    const customerStatusCounts: Record<CustomerStatusValue, number> = {
      ACTIVE: activeCustomers,
      INACTIVE: inactiveCustomers,
      POTENTIAL: potentialCustomers,
      BLACKLISTED: blacklistedCustomers,
    };
    const customerTypeCounts: Record<CustomerTypeValue, number> = {
      HOSPITAL: hospitalCustomers,
      CLINIC: clinicCustomers,
      LAB: labCustomers,
      DISTRIBUTOR: distributorCustomers,
      UNIVERSITY: universityCustomers,
      COMPANY: companyCustomers,
      OTHER: otherCustomers,
    };
    const repairStatusCounts: Record<RepairStatusValue, number> = {
      PENDING: pendingRepairs,
      ASSIGNED: assignedRepairs,
      IN_PROGRESS: inProgressRepairs,
      WAITING_PARTS: waitingPartsRepairs,
      COMPLETED: completedRepairs,
      CANCELLED: cancelledRepairs,
    };
    const maintenanceStatusCounts: Record<MaintenanceStatusValue, number> = {
      SCHEDULED: scheduledMaintenances,
      ASSIGNED: assignedMaintenances,
      IN_PROGRESS: inProgressMaintenances,
      COMPLETED: completedMaintenances,
      OVERDUE: overdueMaintenances,
      CANCELLED: cancelledMaintenances,
    };
    const machineProductCategoryCounts: Record<
      MachineProductCategoryValue,
      number
    > = {
      ULTRASOUND: ultrasoundMachines,
      LAB_TESTING: labTestingMachines,
      BIOCHEMISTRY: biochemistryMachines,
      IMMUNOLOGY: immunologyMachines,
      HEMATOLOGY: hematologyMachines,
      X_RAY: xRayMachines,
      ENDOSCOPY: endoscopyMachines,
      OTHER: otherMachines,
    };

    return {
      totalCustomers,
      customerStatusCounts,
      customerTypeCounts,
      totalBusinessLines,
      activeBusinessLines,
      inactiveBusinessLines,
      totalInventoryMovements,
      totalMachines,
      verifiedMachines,
      unverifiedMachines,
      pendingReviewMachines,
      engineerCreatedMachines,
      totalUsers,
      totalRepairs,
      totalMaintenances,
      machineStatusCounts,
      machineInventoryStatusCounts,
      machineProductCategoryCounts,
      repairStatusCounts,
      maintenanceStatusCounts,
      machinesInMaintenance,
      machinesRepairing,
      returnedMachines: machinesReturned,
      returnedRepairingMachines,
      pendingRepairs,
      activeRepairs: assignedRepairs + inProgressRepairs + waitingPartsRepairs,
      activeMaintenances: assignedMaintenances + inProgressMaintenances,
      overdueMaintenances,
      upcomingMaintenances,
      repairsWithoutMachine,
      openRepairsWithoutMachine,
      maintenancesWithoutMachine,
      openMaintenancesWithoutMachine,
      openMaintenances,
      openInstallations,
      openDemoLoans,
      openDeviceServiceTickets,
      openTicketsWithoutMachine:
        openRepairsWithoutMachine + openMaintenancesWithoutMachine,
    };
  }

  private customerWhere(
    scope: Prisma.CustomerWhereInput,
    where: Prisma.CustomerWhereInput = {},
  ): Prisma.CustomerWhereInput {
    return { AND: [scope, where] };
  }

  private businessLineWhere(
    scope: Prisma.BusinessLineWhereInput,
    where: Prisma.BusinessLineWhereInput = {},
  ): Prisma.BusinessLineWhereInput {
    return { AND: [scope, where] };
  }

  private inventoryMovementWhere(
    scope: Prisma.MachineInventoryMovementWhereInput,
    where: Prisma.MachineInventoryMovementWhereInput = {},
  ): Prisma.MachineInventoryMovementWhereInput {
    return { AND: [scope, where] };
  }

  private machineWhere(
    scope: Prisma.MachineWhereInput,
    where: Prisma.MachineWhereInput = {},
  ): Prisma.MachineWhereInput {
    return { AND: [scope, where] };
  }

  private userWhere(
    scope: Prisma.UserWhereInput,
    where: Prisma.UserWhereInput = {},
  ): Prisma.UserWhereInput {
    return { AND: [scope, where] };
  }

  private repairWhere(
    scope: Prisma.RepairWhereInput,
    where: Prisma.RepairWhereInput = {},
  ): Prisma.RepairWhereInput {
    return { AND: [scope, where] };
  }

  private maintenanceWhere(
    scope: Prisma.MaintenanceWhereInput,
    where: Prisma.MaintenanceWhereInput = {},
  ): Prisma.MaintenanceWhereInput {
    return { AND: [scope, where] };
  }

  private businessLineAccessWhere(
    user?: RequestUser,
  ): Prisma.BusinessLineWhereInput {
    if (!user) {
      return {};
    }

    return {
      machines: {
        some: machineAccessWhere(user),
      },
    };
  }

  private userAccessWhere(user?: RequestUser): Prisma.UserWhereInput {
    return userAccessWhere(user);
  }

  private resolveStatisticsPeriod(query: Record<string, string | undefined>) {
    const now = new Date();
    const today = startOfVietnamDay(now);
    const currentMonthStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );
    const currentMonth = currentMonthStart.toISOString().slice(0, 7);
    const from = query.from?.trim();
    const to = query.to?.trim();

    if (from || to) {
      const start = this.parseDateInput(
        from || this.firstDayOfCurrentMonth(now),
        'from',
      );
      const endDate = this.parseDateInput(
        to || from || this.firstDayOfCurrentMonth(now),
        'to',
      );
      const end = addDateOnlyDays(endDate, 1);

      if (end <= start) {
        throw new BadRequestException('to must be after from');
      }

      return {
        month: start.toISOString().slice(0, 7),
        start,
        end,
      };
    }

    const month = /^\d{4}-\d{2}$/.test(query.month || '')
      ? query.month!
      : currentMonth;
    const [year, monthIndex] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, monthIndex - 1, 1));
    const end = new Date(Date.UTC(year, monthIndex, 1));

    return { month, start, end };
  }

  private firstDayOfCurrentMonth(date: Date) {
    const today = startOfVietnamDay(date);
    return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-01`;
  }

  private parseDateInput(value: string, fieldName: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${fieldName} must be YYYY-MM-DD`);
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${fieldName}`);
    }

    return date;
  }

  private buildEngineerStatistics(tasks: TechnicalTask[]) {
    const map = new Map<
      string,
      {
        engineerId: string;
        engineerName: string;
        total: number;
        repair: number;
        maintenance: number;
        installation: number;
        completed: number;
        open: number;
        waitingReview: number;
        overdue: number;
        customers: Set<string>;
        machines: Set<string>;
      }
    >();

    tasks.forEach((task) => {
      const engineerId = task.engineerId || '__unassigned__';
      const current = map.get(engineerId) ?? {
        engineerId,
        engineerName: task.engineerName || 'Chưa phân kỹ sư',
        total: 0,
        repair: 0,
        maintenance: 0,
        installation: 0,
        completed: 0,
        open: 0,
        waitingReview: 0,
        overdue: 0,
        customers: new Set<string>(),
        machines: new Set<string>(),
      };

      current.total += 1;
      current[task.kind] += 1;
      if (this.isCompletedTask(task.kind, task.status)) current.completed += 1;
      if (!this.isClosedTask(task.kind, task.status)) current.open += 1;
      if (task.reviewStatus === 'PENDING') current.waitingReview += 1;
      if (this.isOverdueTask(task.kind, task.status)) current.overdue += 1;
      if (task.customerId) current.customers.add(task.customerId);
      if (task.machineId) current.machines.add(task.machineId);
      map.set(engineerId, current);
    });

    return Array.from(map.values())
      .map((item) => ({
        engineerId: item.engineerId,
        engineerName: item.engineerName,
        total: item.total,
        repair: item.repair,
        maintenance: item.maintenance,
        installation: item.installation,
        completed: item.completed,
        open: item.open,
        waitingReview: item.waitingReview,
        overdue: item.overdue,
        customers: item.customers.size,
        machines: item.machines.size,
        completionRate: item.total
          ? Math.round((item.completed / item.total) * 100)
          : 0,
      }))
      .sort((left, right) => right.total - left.total);
  }

  private buildIndustryStatistics(tasks: TechnicalTask[]) {
    const map = new Map<
      string,
      {
        productIndustryId: string;
        productIndustryName: string;
        total: number;
        repair: number;
        maintenance: number;
        installation: number;
        completed: number;
        open: number;
      }
    >();

    tasks.forEach((task) => {
      const productIndustryId = task.productIndustryId || '__unassigned__';
      const current = map.get(productIndustryId) ?? {
        productIndustryId,
        productIndustryName: task.productIndustryName || 'Chưa phân ngành',
        total: 0,
        repair: 0,
        maintenance: 0,
        installation: 0,
        completed: 0,
        open: 0,
      };

      current.total += 1;
      current[task.kind] += 1;
      if (this.isCompletedTask(task.kind, task.status)) current.completed += 1;
      if (!this.isClosedTask(task.kind, task.status)) current.open += 1;
      map.set(productIndustryId, current);
    });

    return Array.from(map.values()).sort(
      (left, right) => right.total - left.total,
    );
  }

  private buildDailyTrend(tasks: TechnicalTask[], start: Date, end: Date) {
    const days: Array<{
      date: string;
      repair: number;
      maintenance: number;
      installation: number;
      total: number;
    }> = [];
    const cursor = new Date(start);

    while (cursor < end) {
      days.push({
        date: cursor.toISOString().slice(0, 10),
        repair: 0,
        maintenance: 0,
        installation: 0,
        total: 0,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const map = new Map(days.map((item) => [item.date, item]));
    tasks.forEach((task) => {
      const key = task.date.toISOString().slice(0, 10);
      const item = map.get(key);
      if (!item) return;
      item[task.kind] += 1;
      item.total += 1;
    });

    return days;
  }

  private isCompletedTask(kind: TechnicalTaskKind, status: string) {
    if (kind === 'installation') return status === 'INSTALLED';
    return status === 'COMPLETED';
  }

  private isClosedTask(kind: TechnicalTaskKind, status: string) {
    if (kind === 'installation')
      return ['INSTALLED', 'CANCELLED'].includes(status);
    return ['COMPLETED', 'CANCELLED'].includes(status);
  }

  private isOverdueTask(
    kind: TechnicalTaskKind,
    status: string,
    dueDate?: Date,
    todayStart = startOfVietnamDay(),
  ) {
    if (kind === 'maintenance' && dueDate) {
      return isMaintenanceOverdue(status, dueDate, todayStart);
    }
    return false;
  }

  private userSummarySelect() {
    return {
      id: true,
      email: true,
      fullName: true,
    } satisfies Prisma.UserSelect;
  }

  private customerSummarySelect() {
    return {
      id: true,
      name: true,
      hospitalName: true,
      customerCode: true,
      province: true,
    } satisfies Prisma.CustomerSelect;
  }
}

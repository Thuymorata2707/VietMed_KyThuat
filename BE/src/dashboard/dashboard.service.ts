import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  customerAccessWhere,
  inventoryMovementAccessWhere,
  isAdmin,
  isEngineer,
  isManager,
  machineAccessWhere,
  maintenanceAccessWhere,
  repairAccessWhere,
} from '../auth/access-scope';
import { RequestUser } from '../common/request-user.type';
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

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getTechnicalMachines(
    user?: RequestUser,
    query: Record<string, string | undefined> = {},
  ) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
    const search = query.search?.trim();
    const businessLineId = query.businessLineId?.trim();
    const installState = query.installState?.trim();
    const accessScope = machineAccessWhere(user);
    const baseFilters: Prisma.MachineWhereInput[] = [];

    if (search) {
      baseFilters.push({
        OR: [
          { machineCode: { contains: search,  } },
          { serialNumber: { contains: search,  } },
          { name: { contains: search,  } },
          { modelName: { contains: search,  } },
          { manufacturer: { contains: search,  } },
          {
            customer: {
              OR: [
                { name: { contains: search,  } },
                { hospitalName: { contains: search,  } },
                { customerCode: { contains: search,  } },
              ],
            },
          },
          {
            installations: {
              some: {
                customer: {
                  OR: [
                    { name: { contains: search,  } },
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
                  { name: { contains: search,  } },
                  { code: { contains: search,  } },
                  { serialNumber: { contains: search,  } },
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
          count: item._count._all,
        };
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });

    return {
      total,
      filteredTotal,
      page,
      limit,
      totalPages: Math.max(Math.ceil(filteredTotal / limit), 1),
      businessLines: businessLineGroups,
      machines: machines.map((machine) => {
        const latestInstallation = machine.installations[0] ?? null;
        const installedCustomer =
          latestInstallation?.customer ??
          (machine.inventoryStatus === 'INSTALLED' ? machine.customer : null);
        const installedAt =
          latestInstallation?.installedAt ?? machine.installDate;

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
            latestInstallation?.warrantyCard?.startDate ??
            machine.warrantyStartDate,
          warrantyEndDate:
            latestInstallation?.warrantyCard?.endDate ??
            machine.warrantyEndDate,
          businessLine: machine.businessLine,
          installedBy: latestInstallation?.installedBy ?? machine.installedBy,
          primaryEngineer: machine.primaryEngineer,
          installation: latestInstallation
            ? {
                id: latestInstallation.id,
                code: latestInstallation.code,
                status: latestInstallation.status,
                installedAt: latestInstallation.installedAt,
                receiverInstallAddress:
                  latestInstallation.receiverInstallAddress,
                receiverRepresentative:
                  latestInstallation.receiverRepresentative,
                receiverPhone: latestInstallation.receiverPhone,
                warrantyCard: latestInstallation.warrantyCard,
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
      const installedCustomer =
        latestInstallation?.customer ??
        (machine.inventoryStatus === 'INSTALLED' ? machine.customer : null);
      const installedAt = latestInstallation?.installedAt ?? machine.installDate;

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
          latestInstallation?.warrantyCard?.startDate ??
          machine.warrantyStartDate,
        warrantyEndDate:
          latestInstallation?.warrantyCard?.endDate ?? machine.warrantyEndDate,
        businessLine: machine.businessLine,
        installedBy: latestInstallation?.installedBy ?? machine.installedBy,
        primaryEngineer: machine.primaryEngineer,
        installation: latestInstallation
          ? {
              id: latestInstallation.id,
              code: latestInstallation.code,
              status: latestInstallation.status,
              installedAt: latestInstallation.installedAt,
              receiverInstallAddress: latestInstallation.receiverInstallAddress,
              receiverRepresentative: latestInstallation.receiverRepresentative,
              receiverPhone: latestInstallation.receiverPhone,
              warrantyCard: latestInstallation.warrantyCard,
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
    const customerScope = customerAccessWhere(user);
    const businessLineScope = this.businessLineAccessWhere(user);
    const inventoryMovementScope = inventoryMovementAccessWhere(user);
    const machineScope = machineAccessWhere(user);
    const userScope = this.userAccessWhere(user);
    const repairScope = repairAccessWhere(user);
    const maintenanceScope = maintenanceAccessWhere(user);

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
      returnedMachines,
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
        where: this.maintenanceWhere(maintenanceScope, { status: 'OVERDUE' }),
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
            gte: new Date(),
            lte: this.daysFromNow(30),
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
      this.prisma.machine.count({
        where: this.machineWhere(machineScope, { inventoryStatus: 'RETURNED' }),
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
      returnedMachines,
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
      openTicketsWithoutMachine:
        openRepairsWithoutMachine + openMaintenancesWithoutMachine,
    };
  }

  private daysFromNow(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
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
    if (!user || isAdmin(user)) {
      return {};
    }

    return {
      machines: {
        some: machineAccessWhere(user),
      },
    };
  }

  private userAccessWhere(user?: RequestUser): Prisma.UserWhereInput {
    if (!user || isAdmin(user)) {
      return {};
    }

    if (isManager(user)) {
      return { regionId: user.regionId };
    }

    if (isEngineer(user)) {
      return { id: user.id };
    }

    return { id: '__no_access__' };
  }
}

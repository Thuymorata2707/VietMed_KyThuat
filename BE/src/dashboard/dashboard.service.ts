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
        where: this.machineWhere(machineScope, { dataStatus: 'PENDING_REVIEW' }),
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
        where: this.machineWhere(machineScope, { inventoryStatus: 'INSTALLED' }),
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
      pendingRepairs,
      activeRepairs: assignedRepairs + inProgressRepairs + waitingPartsRepairs,
      activeMaintenances: assignedMaintenances + inProgressMaintenances,
      overdueMaintenances,
      upcomingMaintenances,
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

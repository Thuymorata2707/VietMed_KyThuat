import { Injectable } from '@nestjs/common';
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

  async getSummary() {
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
      this.prisma.customer.count(),
      this.prisma.customer.count({ where: { status: 'ACTIVE' } }),
      this.prisma.customer.count({ where: { status: 'INACTIVE' } }),
      this.prisma.customer.count({ where: { status: 'POTENTIAL' } }),
      this.prisma.customer.count({ where: { status: 'BLACKLISTED' } }),
      this.prisma.customer.count({ where: { customerType: 'HOSPITAL' } }),
      this.prisma.customer.count({ where: { customerType: 'CLINIC' } }),
      this.prisma.customer.count({ where: { customerType: 'LAB' } }),
      this.prisma.customer.count({ where: { customerType: 'DISTRIBUTOR' } }),
      this.prisma.customer.count({ where: { customerType: 'UNIVERSITY' } }),
      this.prisma.customer.count({ where: { customerType: 'COMPANY' } }),
      this.prisma.customer.count({ where: { customerType: 'OTHER' } }),
      this.prisma.businessLine.count(),
      this.prisma.businessLine.count({ where: { status: 'ACTIVE' } }),
      this.prisma.businessLine.count({ where: { status: 'INACTIVE' } }),
      this.prisma.machineInventoryMovement.count(),
      this.prisma.machine.count(),
      this.prisma.user.count(),
      this.prisma.repair.count(),
      this.prisma.machine.count({ where: { status: 'ACTIVE' } }),
      this.prisma.machine.count({ where: { status: 'MAINTENANCE' } }),
      this.prisma.machine.count({ where: { status: 'REPAIRING' } }),
      this.prisma.machine.count({ where: { status: 'INACTIVE' } }),
      this.prisma.machine.count({ where: { inventoryStatus: 'IN_STOCK' } }),
      this.prisma.machine.count({
        where: { inventoryStatus: 'ACCESSORY_SPLIT' },
      }),
      this.prisma.machine.count({ where: { inventoryStatus: 'INSTALLED' } }),
      this.prisma.machine.count({ where: { inventoryStatus: 'RESERVED' } }),
      this.prisma.machine.count({ where: { inventoryStatus: 'RETURNED' } }),
      this.prisma.machine.count({ where: { inventoryStatus: 'SOLD' } }),
      this.prisma.machine.count({ where: { productCategory: 'ULTRASOUND' } }),
      this.prisma.machine.count({ where: { productCategory: 'LAB_TESTING' } }),
      this.prisma.machine.count({ where: { productCategory: 'BIOCHEMISTRY' } }),
      this.prisma.machine.count({ where: { productCategory: 'IMMUNOLOGY' } }),
      this.prisma.machine.count({ where: { productCategory: 'HEMATOLOGY' } }),
      this.prisma.machine.count({ where: { productCategory: 'X_RAY' } }),
      this.prisma.machine.count({ where: { productCategory: 'ENDOSCOPY' } }),
      this.prisma.machine.count({ where: { productCategory: 'OTHER' } }),
      this.prisma.repair.count({ where: { status: 'PENDING' } }),
      this.prisma.repair.count({ where: { status: 'ASSIGNED' } }),
      this.prisma.repair.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.repair.count({ where: { status: 'WAITING_PARTS' } }),
      this.prisma.repair.count({ where: { status: 'COMPLETED' } }),
      this.prisma.repair.count({ where: { status: 'CANCELLED' } }),
      this.prisma.maintenance.count(),
      this.prisma.maintenance.count({ where: { status: 'SCHEDULED' } }),
      this.prisma.maintenance.count({ where: { status: 'ASSIGNED' } }),
      this.prisma.maintenance.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.maintenance.count({ where: { status: 'COMPLETED' } }),
      this.prisma.maintenance.count({ where: { status: 'OVERDUE' } }),
      this.prisma.maintenance.count({ where: { status: 'CANCELLED' } }),
      this.prisma.maintenance.count({
        where: {
          status: {
            in: ['SCHEDULED', 'ASSIGNED'],
          },
          scheduledDate: {
            gte: new Date(),
            lte: this.daysFromNow(30),
          },
        },
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
}

import {
  MachineInventoryStatus,
  MachineStatus,
  MaintenanceStatus,
  DeviceServiceTicketStatus,
  RepairStatus,
  Prisma,
} from '@prisma/client';

export function resolveMachineStatusFromOpenWork(input: {
  inventoryStatus: MachineInventoryStatus;
  hasOpenRepair: boolean;
  hasOpenMaintenance: boolean;
}): MachineStatus {
  if (
    input.inventoryStatus === MachineInventoryStatus.RETURNED ||
    input.hasOpenRepair
  ) {
    return MachineStatus.REPAIRING;
  }
  if (input.hasOpenMaintenance) {
    return MachineStatus.MAINTENANCE;
  }
  return MachineStatus.ACTIVE;
}

export async function reconcileMachineStatusFromOpenWork(
  tx: Prisma.TransactionClient,
  machineId: string,
  inventoryStatus: MachineInventoryStatus,
) {
  const [openRepair, openMaintenance, openDeviceServiceTicket] = await Promise.all([
    tx.repair.findFirst({
      where: {
        machineId,
        status: { in: [RepairStatus.IN_PROGRESS, RepairStatus.WAITING_PARTS] },
      },
      select: { id: true },
    }),
    tx.maintenance.findFirst({
      where: { machineId, status: MaintenanceStatus.IN_PROGRESS },
      select: { id: true },
    }),
    tx.deviceServiceTicket.findFirst({
      where: { machineId, status: DeviceServiceTicketStatus.RECEIVED },
      select: { id: true },
    }),
  ]);
  const status = resolveMachineStatusFromOpenWork({
    inventoryStatus,
    hasOpenRepair: Boolean(openRepair || openDeviceServiceTicket),
    hasOpenMaintenance: Boolean(openMaintenance),
  });

  await tx.machine.update({ where: { id: machineId }, data: { status } });
  return status;
}

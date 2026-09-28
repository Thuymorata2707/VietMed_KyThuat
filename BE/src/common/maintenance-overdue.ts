import { MaintenanceStatus } from '@prisma/client';

export function isMaintenanceOverdue(
  status: MaintenanceStatus | string,
  scheduledDate: Date,
  todayStart: Date,
) {
  if (
    status === MaintenanceStatus.COMPLETED ||
    status === MaintenanceStatus.CANCELLED
  ) {
    return false;
  }
  if (status === MaintenanceStatus.OVERDUE) return true;
  return (
    (status === MaintenanceStatus.SCHEDULED ||
      status === MaintenanceStatus.ASSIGNED ||
      status === MaintenanceStatus.IN_PROGRESS) &&
    scheduledDate < todayStart
  );
}

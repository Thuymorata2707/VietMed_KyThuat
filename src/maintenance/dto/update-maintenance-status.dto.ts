import { MaintenanceStatus } from '@prisma/client';

export class UpdateMaintenanceStatusDto {
  status!: MaintenanceStatus;
  resultNote?: string;
  nextDueDate?: string;
}

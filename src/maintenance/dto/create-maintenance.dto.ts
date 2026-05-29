import { MaintenanceType } from '@prisma/client';

export class CreateMaintenanceDto {
  title!: string;
  description?: string;
  type?: MaintenanceType;
  machineId!: string;
  engineerId?: string;
  scheduledDate!: string;
  checklist?: string[];
  nextDueDate?: string;
}

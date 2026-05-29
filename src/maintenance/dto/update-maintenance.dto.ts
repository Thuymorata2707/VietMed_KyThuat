import { MaintenanceType } from '@prisma/client';

export class UpdateMaintenanceDto {
  title?: string;
  description?: string | null;
  type?: MaintenanceType;
  scheduledDate?: string;
  checklist?: string[];
  resultNote?: string | null;
  nextDueDate?: string | null;
}

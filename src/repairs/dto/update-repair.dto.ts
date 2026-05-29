import { RepairPriority } from '@prisma/client';

export class UpdateRepairDto {
  title?: string;
  description?: string | null;
  priority?: RepairPriority;
  resultNote?: string | null;
  customerFeedback?: string | null;
}

import { RepairPriority } from '@prisma/client';

export class CreateRepairDto {
  title!: string;
  description?: string;
  machineId!: string;
  engineerId?: string;
  priority?: RepairPriority;
  reportedAt?: string;
}

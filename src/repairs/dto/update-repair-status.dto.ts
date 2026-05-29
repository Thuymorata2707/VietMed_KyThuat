import { RepairStatus } from '@prisma/client';

export class UpdateRepairStatusDto {
  status!: RepairStatus;
  resultNote?: string;
  customerFeedback?: string;
}

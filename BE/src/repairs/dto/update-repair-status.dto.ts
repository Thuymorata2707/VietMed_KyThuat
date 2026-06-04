import { RepairStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateRepairStatusDto {
  @IsEnum(RepairStatus)
  status!: RepairStatus;

  @IsOptional()
  @IsString()
  resultNote?: string;

  @IsOptional()
  @IsString()
  customerFeedback?: string;
}

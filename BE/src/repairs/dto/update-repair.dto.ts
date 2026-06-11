import { RepairPriority, RepairStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateRepairDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(RepairPriority)
  priority?: RepairPriority;

  @IsOptional()
  @IsEnum(RepairStatus)
  status?: RepairStatus;

  @IsOptional()
  @IsString()
  engineerId?: string | null;

  @IsOptional()
  @IsString()
  resultNote?: string | null;

  @IsOptional()
  @IsString()
  customerFeedback?: string | null;

  @IsOptional()
  @IsString()
  usingDepartment?: string | null;

  @IsOptional()
  @IsString()
  representative?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  contactPhone?: string | null;

  @IsOptional()
  @IsString()
  deviceName?: string | null;

  @IsOptional()
  @IsString()
  modelName?: string | null;

  @IsOptional()
  @IsString()
  serialNumber?: string | null;

  @IsOptional()
  @IsString()
  warrantyStatus?: string | null;

  @IsOptional()
  @IsString()
  conditionAssessment?: string | null;

  @IsOptional()
  @IsString()
  repairMethod?: string | null;
}

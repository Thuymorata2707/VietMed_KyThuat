import { RepairPriority } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateRepairDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  machineId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  engineerId?: string;

  @IsOptional()
  @IsEnum(RepairPriority)
  priority?: RepairPriority;

  @IsOptional()
  @IsDateString()
  reportedAt?: string;

  @IsOptional()
  @IsString()
  usingDepartment?: string;

  @IsOptional()
  @IsString()
  representative?: string;

  @IsOptional()
  @IsString()
  representativePosition?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  warrantyStatus?: string;

  @IsOptional()
  @IsString()
  warrantyTerm?: string;

  @IsOptional()
  @IsString()
  receivedAccessories?: string;

  @IsOptional()
  @IsString()
  preliminaryCause?: string;

  @IsOptional()
  @IsString()
  conditionAssessment?: string;

  @IsOptional()
  @IsString()
  repairMethod?: string;

  @IsOptional()
  @IsString()
  repairCostItems?: string;

  @IsOptional()
  @IsString()
  totalRepairCost?: string;

  @IsOptional()
  @IsString()
  repairCostInWords?: string;
}

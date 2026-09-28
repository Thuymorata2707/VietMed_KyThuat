import { RepairPriority, RepairStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { UsedPartDto } from '../../common/dto/used-part.dto';

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
  machineId?: string | null;

  @IsOptional()
  @IsString()
  customerId?: string | null;

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
  representativePosition?: string | null;

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
  warrantyTerm?: string | null;

  @IsOptional()
  @IsString()
  receivedAccessories?: string | null;

  @IsOptional()
  @IsString()
  preliminaryCause?: string | null;

  @IsOptional()
  @IsString()
  conditionAssessment?: string | null;

  @IsOptional()
  @IsString()
  repairMethod?: string | null;

  @IsOptional()
  @IsString()
  repairCostItems?: string | null;

  @IsOptional()
  @IsString()
  totalRepairCost?: string | null;

  @IsOptional()
  @IsString()
  repairCostInWords?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UsedPartDto)
  usedParts?: UsedPartDto[];
}

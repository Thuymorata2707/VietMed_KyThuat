import { RepairPriority } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { UsedPartsContainerDto } from '../../common/dto/used-part.dto';

export class CreateRepairDto extends UsedPartsContainerDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  resultNote?: string;

  @IsOptional()
  @IsString()
  customerFeedback?: string;

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
  @IsArray()
  @IsString({ each: true })
  engineerIds?: string[];

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

import {
  MachineInventoryStatus,
  MachineProductCategory,
  MachineStatus,
  OperationalCreatedSource,
  OperationalDataStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { UpdateMachineAccessoryDto } from './machine-accessory.dto';

export class UpdateMachineDto {
  @IsOptional()
  @IsString()
  machineCode?: string | null;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  name?: string | null;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  version?: string | null;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsEnum(MachineProductCategory)
  productCategory?: MachineProductCategory;

  @IsOptional()
  @IsString()
  productLine?: string | null;

  @IsOptional()
  @IsEnum(MachineStatus)
  status?: MachineStatus;

  @IsOptional()
  @IsEnum(MachineInventoryStatus)
  inventoryStatus?: MachineInventoryStatus;

  @IsOptional()
  @IsEnum(OperationalDataStatus)
  dataStatus?: OperationalDataStatus;

  @IsOptional()
  @IsEnum(OperationalCreatedSource)
  createdSource?: OperationalCreatedSource;

  @IsOptional()
  @IsDateString()
  manufacturingDate?: string | null;

  @IsOptional()
  @IsDateString()
  warehouseImportDate?: string | null;

  @IsOptional()
  @IsDateString()
  installDate?: string | null;

  @IsOptional()
  @IsDateString()
  warrantyStartDate?: string | null;

  @IsOptional()
  @IsDateString()
  warrantyEndDate?: string | null;

  @IsOptional()
  @IsString()
  businessLineId?: string | null;

  @IsOptional()
  @IsString()
  machineModelId?: string | null;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  installedById?: string | null;

  @IsOptional()
  @IsString()
  primaryEngineerId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateMachineAccessoryItemDto)
  accessories?: UpdateMachineAccessoryItemDto[];
}

export class UpdateMachineAccessoryItemDto extends UpdateMachineAccessoryDto {
  @IsOptional()
  @IsString()
  id?: string;
}

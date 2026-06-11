import {
  MachineInventoryStatus,
  MachineProductCategory,
  MachineStatus,
  OperationalCreatedSource,
  OperationalDataStatus,
} from '@prisma/client';
import {
  IsDateString,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMachineAccessoryDto } from './machine-accessory.dto';

export class CreateMachineDto {
  @IsOptional()
  @IsString()
  machineCode?: string;

  @IsString()
  @IsNotEmpty()
  serialNumber!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsEnum(MachineProductCategory)
  productCategory?: MachineProductCategory;

  @IsOptional()
  @IsString()
  productLine?: string;

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
  manufacturingDate?: string;

  @IsOptional()
  @IsDateString()
  warehouseImportDate?: string;

  @IsOptional()
  @IsDateString()
  installDate?: string;

  @IsOptional()
  @IsDateString()
  warrantyStartDate?: string;

  @IsOptional()
  @IsDateString()
  warrantyEndDate?: string;

  @IsOptional()
  @IsString()
  businessLineId?: string;

  @IsOptional()
  @IsString()
  machineModelId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  installedById?: string;

  @IsOptional()
  @IsString()
  primaryEngineerId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMachineAccessoryDto)
  accessories?: CreateMachineAccessoryDto[];
}

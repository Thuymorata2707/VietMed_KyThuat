import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MachineProductCategory } from '@prisma/client';
import { UpdateMachineAccessoryItemDto } from '../../machines/dto/update-machine.dto';

export class InstallationDeviceItemDto {
  @IsOptional()
  @IsString()
  sourceMachineId?: string;

  @IsString()
  @IsNotEmpty()
  itemName!: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsDateString()
  manufactureDate?: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  warrantyPeriod?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsEnum(MachineProductCategory)
  productCategory?: MachineProductCategory;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  engineerIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateMachineAccessoryItemDto)
  accessories?: UpdateMachineAccessoryItemDto[];
}

export class CreateInstallationDto {
  @IsString()
  @IsOptional()
  machineId?: string;

  @IsOptional()
  @IsString()
  machineSerialNumber?: string;

  @IsOptional()
  @IsString()
  machineCode?: string;

  @IsOptional()
  @IsString()
  machineName?: string;

  @IsOptional()
  @IsString()
  machineModelId?: string;

  @IsOptional()
  @IsString()
  plannedModelName?: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsOptional()
  @IsDateString()
  installedAt?: string;

  @IsString()
  @IsOptional()
  installedById?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  engineerIds?: string[];

  @IsOptional()
  @IsString()
  businessLineId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accessories?: string[];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsDateString()
  warrantyStartDate?: string;

  @IsOptional()
  @IsDateString()
  warrantyEndDate?: string;

  @IsOptional()
  @IsString()
  warrantyNote?: string;

  @IsOptional()
  @IsString()
  handoverInstallerName?: string;

  @IsOptional()
  @IsString()
  handoverInstallerPosition?: string;

  @IsOptional()
  @IsString()
  handoverVehicle?: string;

  @IsOptional()
  @IsDateString()
  handoverDepartureDate?: string;

  @IsOptional()
  @IsString()
  receiverInstallAddress?: string;

  @IsOptional()
  @IsString()
  receiverRepresentative?: string;

  @IsOptional()
  @IsString()
  receiverPosition?: string;

  @IsOptional()
  @IsString()
  receiverPhone?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstallationDeviceItemDto)
  installedDeviceItems?: InstallationDeviceItemDto[];

  @IsOptional()
  @IsIn(['NEW_100', 'OTHER'])
  deviceCondition?: string;

  @IsOptional()
  @IsString()
  deviceConditionNote?: string;
}

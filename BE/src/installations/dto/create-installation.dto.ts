import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InstallationDeviceItemDto {
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
}

export class CreateInstallationDto {
  @IsString()
  @IsNotEmpty()
  machineId!: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsDateString()
  installedAt!: string;

  @IsString()
  @IsNotEmpty()
  installedById!: string;

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

  @IsDateString()
  warrantyEndDate!: string;

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

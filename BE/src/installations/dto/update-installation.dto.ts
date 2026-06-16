import { InstallationStatus } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { CreateInstallationDto } from './create-installation.dto';
import { CreateMachineAccessoryDto } from '../../machines/dto/machine-accessory.dto';

export class UpdateInstallationDto {
  @IsOptional()
  @IsEnum(InstallationStatus)
  status?: InstallationStatus;

  @IsOptional()
  @IsDateString()
  installedAt?: string;

  @IsOptional()
  @IsString()
  installedById?: string;

  @IsOptional()
  @IsString()
  machineId?: string;

  @IsOptional()
  @IsString()
  machineModelId?: string;

  @IsOptional()
  @IsString()
  machineSerialNumber?: string;

  @IsOptional()
  @IsString()
  machineCode?: string | null;

  @IsOptional()
  @IsString()
  machineName?: string | null;

  @IsOptional()
  @IsString()
  businessLineId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accessories?: string[];

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsDateString()
  warrantyStartDate?: string;

  @IsOptional()
  @IsDateString()
  warrantyEndDate?: string;

  @IsOptional()
  @IsString()
  warrantyNote?: string | null;

  @IsOptional()
  @IsString()
  handoverInstallerName?: string | null;

  @IsOptional()
  @IsString()
  handoverInstallerPosition?: string | null;

  @IsOptional()
  @IsString()
  handoverVehicle?: string | null;

  @IsOptional()
  @IsDateString()
  handoverDepartureDate?: string;

  @IsOptional()
  @IsString()
  receiverInstallAddress?: string | null;

  @IsOptional()
  @IsString()
  receiverRepresentative?: string | null;

  @IsOptional()
  @IsString()
  receiverPosition?: string | null;

  @IsOptional()
  @IsString()
  receiverPhone?: string | null;

  @IsOptional()
  installedDeviceItems?: CreateInstallationDto['installedDeviceItems'];

  @IsOptional()
  machineAccessories?: CreateMachineAccessoryDto[];

  @IsOptional()
  @IsString()
  deviceCondition?: string | null;

  @IsOptional()
  @IsString()
  deviceConditionNote?: string | null;
}

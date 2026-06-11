import { InstallationStatus } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

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
}

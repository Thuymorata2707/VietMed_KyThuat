import { InstallationStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateInstallationStatusDto {
  @IsEnum(InstallationStatus)
  status!: InstallationStatus;

  @IsOptional()
  @IsDateString()
  installedAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

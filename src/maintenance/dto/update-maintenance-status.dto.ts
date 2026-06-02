import { MaintenanceStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateMaintenanceStatusDto {
  @IsEnum(MaintenanceStatus)
  status!: MaintenanceStatus;

  @IsOptional()
  @IsString()
  resultNote?: string;

  @IsOptional()
  @IsDateString()
  nextDueDate?: string;
}

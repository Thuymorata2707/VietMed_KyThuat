import { InstallationStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListInstallationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(InstallationStatus)
  status?: InstallationStatus;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  machineId?: string;

  @IsOptional()
  @IsString()
  businessLineId?: string;

  @IsOptional()
  @IsString()
  installedById?: string;

  @IsOptional()
  @IsDateString()
  installedFrom?: string;

  @IsOptional()
  @IsDateString()
  installedTo?: string;
}

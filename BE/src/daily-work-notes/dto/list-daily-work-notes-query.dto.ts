import { DailyWorkStatus, DailyWorkType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class ListDailyWorkNotesQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(DailyWorkType)
  type?: DailyWorkType;

  @IsOptional()
  @IsEnum(DailyWorkStatus)
  status?: DailyWorkStatus;
}

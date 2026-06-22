import { DailyWorkStatus, DailyWorkType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateDailyWorkNoteDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsDateString()
  workDate?: string;

  @IsOptional()
  @IsString()
  startTime?: string | null;

  @IsOptional()
  @IsString()
  endTime?: string | null;

  @IsOptional()
  @IsString()
  color?: string | null;

  @IsOptional()
  @IsEnum(DailyWorkType)
  type?: DailyWorkType;

  @IsOptional()
  @IsEnum(DailyWorkStatus)
  status?: DailyWorkStatus;

  @IsOptional()
  @IsString()
  rejectReason?: string | null;
}

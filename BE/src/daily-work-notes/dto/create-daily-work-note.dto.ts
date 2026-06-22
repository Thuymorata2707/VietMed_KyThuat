import { DailyWorkStatus, DailyWorkType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateDailyWorkNoteDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsDateString()
  workDate!: string;

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
}

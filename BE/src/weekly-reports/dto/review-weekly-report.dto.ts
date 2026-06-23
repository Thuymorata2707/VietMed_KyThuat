import { WeeklyReportStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ReviewWeeklyReportDto {
  @IsEnum(WeeklyReportStatus)
  status!: WeeklyReportStatus;

  @IsOptional()
  @IsString()
  reviewNote?: string | null;
}

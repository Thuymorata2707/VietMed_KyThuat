import { DailyReportStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ReviewDailyReportDto {
  @IsEnum(DailyReportStatus)
  status!: DailyReportStatus;

  @IsOptional()
  @IsString()
  reviewNote?: string | null;
}

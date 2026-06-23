import { WorkReviewStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ReviewWorkTaskDto {
  @IsEnum(WorkReviewStatus)
  status!: WorkReviewStatus;

  @IsOptional()
  @IsString()
  reviewNote?: string | null;
}

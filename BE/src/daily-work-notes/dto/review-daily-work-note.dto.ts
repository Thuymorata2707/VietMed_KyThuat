import { DailyWorkStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ReviewDailyWorkNoteDto {
  @IsEnum(DailyWorkStatus)
  status!: DailyWorkStatus;

  @IsOptional()
  @IsString()
  rejectReason?: string | null;
}

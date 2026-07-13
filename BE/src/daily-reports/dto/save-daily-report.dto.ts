import { IsDateString, IsOptional, IsString } from 'class-validator';

export class SaveDailyReportDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsDateString()
  reportDate!: string;

  @IsOptional()
  @IsString()
  summary?: string | null;

  @IsOptional()
  @IsString()
  pending?: string | null;

  @IsOptional()
  @IsString()
  proposal?: string | null;
}

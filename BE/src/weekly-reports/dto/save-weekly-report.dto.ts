import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { WeeklyReportRowDto } from './weekly-report-row.dto';

export class SaveWeeklyReportDto {
  @IsDateString()
  weekStart!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsString()
  learnings?: string | null;

  @IsOptional()
  @IsString()
  accomplishments?: string | null;

  @IsOptional()
  @IsString()
  timeSummary?: string | null;

  @IsOptional()
  @IsString()
  blockers?: string | null;

  @IsOptional()
  @IsString()
  nextWeekPlan?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklyReportRowDto)
  rows!: WeeklyReportRowDto[];
}

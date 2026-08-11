import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class WeeklyReportRowDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsDateString()
  workDate!: string;

  @IsOptional()
  @IsString()
  customer?: string | null;

  @IsOptional()
  @IsString()
  machine?: string | null;

  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsString()
  result?: string | null;

  @IsOptional()
  @IsString()
  pending?: string | null;

  @IsOptional()
  @IsString()
  proposal?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

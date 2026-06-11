import { IsDateString, IsOptional, IsString } from 'class-validator';

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
}

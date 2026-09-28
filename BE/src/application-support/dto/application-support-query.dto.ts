import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  ApplicationSupportIssueCategory,
  ApplicationSupportStatus,
  ApplicationSupportWorkType,
} from '@prisma/client';

export class ApplicationSupportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  engineerId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsEnum(ApplicationSupportStatus)
  status?: ApplicationSupportStatus;

  @IsOptional()
  @IsEnum(ApplicationSupportWorkType)
  workType?: ApplicationSupportWorkType;

  @IsOptional()
  @IsEnum(ApplicationSupportIssueCategory)
  issueCategory?: ApplicationSupportIssueCategory;
}

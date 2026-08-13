import { BusinessLineStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateComponentAccessoryDto {
  @IsOptional()
  @IsString()
  machineModelId?: string;

  @IsOptional()
  @IsString()
  componentId?: string | null;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  requiresSerial?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(BusinessLineStatus)
  status?: BusinessLineStatus;
}

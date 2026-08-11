import { BusinessLineStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateComponentAccessoryDto {
  @IsString()
  @IsNotEmpty()
  machineModelId!: string;

  @IsOptional()
  @IsString()
  componentId?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

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

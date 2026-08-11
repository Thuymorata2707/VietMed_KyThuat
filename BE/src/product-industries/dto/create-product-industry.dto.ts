import { BusinessLineStatus, ExpertiseGroup } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateProductIndustryBusinessLineDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  productCategory?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  countryOfOrigin?: string;
}

export class CreateProductIndustryDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(ExpertiseGroup)
  expertiseGroup!: ExpertiseGroup;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(BusinessLineStatus)
  status?: BusinessLineStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductIndustryBusinessLineDto)
  businessLines?: CreateProductIndustryBusinessLineDto[];
}

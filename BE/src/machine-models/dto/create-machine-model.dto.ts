import { BusinessLineStatus, MachineProductCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateMachineModelAccessoryDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsBoolean()
  requiresSerial?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateMachineModelComponentDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMachineModelAccessoryDto)
  accessories?: CreateMachineModelAccessoryDto[];
}

export class CreateMachineModelDto {
  @IsString()
  @IsNotEmpty()
  businessLineId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsEnum(BusinessLineStatus)
  status?: BusinessLineStatus;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  countryOfOrigin?: string;

  @IsOptional()
  @IsEnum(MachineProductCategory)
  productCategory?: MachineProductCategory;

  @IsOptional()
  @IsString()
  productLine?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMachineModelComponentDto)
  components?: CreateMachineModelComponentDto[];
}

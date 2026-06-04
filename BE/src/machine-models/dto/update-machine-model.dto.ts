import { BusinessLineStatus, MachineProductCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateMachineModelDto {
  @IsOptional()
  @IsString()
  businessLineId?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  displayName?: string | null;

  @IsOptional()
  @IsEnum(BusinessLineStatus)
  status?: BusinessLineStatus;

  @IsOptional()
  @IsString()
  manufacturer?: string | null;

  @IsOptional()
  @IsEnum(MachineProductCategory)
  productCategory?: MachineProductCategory;

  @IsOptional()
  @IsString()
  productLine?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}

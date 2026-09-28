import { AccessoryStockMovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateAccessoryStockMovementDto {
  @IsString()
  componentAccessoryId!: string;

  @IsEnum(AccessoryStockMovementType)
  type!: AccessoryStockMovementType;

  @Type(() => Number)
  @IsNumber()
  @ValidateIf(
    (dto: CreateAccessoryStockMovementDto) =>
      dto.type === AccessoryStockMovementType.ADJUSTMENT,
  )
  quantityDelta?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @ValidateIf(
    (dto: CreateAccessoryStockMovementDto) =>
      dto.type !== AccessoryStockMovementType.ADJUSTMENT,
  )
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  machineId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;
}

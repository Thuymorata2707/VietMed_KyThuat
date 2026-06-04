import { InventoryMovementType, MachineInventoryStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateInventoryMovementDto {
  @IsString()
  @IsNotEmpty()
  machineId!: string;

  @IsEnum(InventoryMovementType)
  type!: InventoryMovementType;

  @IsEnum(MachineInventoryStatus)
  toStatus!: MachineInventoryStatus;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  customerId?: string;
}

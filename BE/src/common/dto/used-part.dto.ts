import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UsedPartDto {
  @IsOptional()
  @IsString()
  componentAccessoryId?: string | null;

  @IsOptional()
  @IsString()
  name?: string | null;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsOptional()
  @IsString()
  unit?: string | null;

  @IsOptional()
  @IsString()
  serialNumber?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}

export class UsedPartsContainerDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UsedPartDto)
  usedParts?: UsedPartDto[];
}

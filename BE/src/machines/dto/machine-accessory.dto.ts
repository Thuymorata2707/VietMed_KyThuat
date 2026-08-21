import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateMachineAccessoryDto {
  @IsOptional()
  @IsString()
  componentAccessoryId?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateMachineAccessoryDto {
  @IsOptional()
  @IsString()
  componentAccessoryId?: string | null;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number | null;

  @IsOptional()
  @IsString()
  serialNumber?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}

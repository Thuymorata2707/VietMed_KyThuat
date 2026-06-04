import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateInstallationDto {
  @IsString()
  @IsNotEmpty()
  machineId!: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsDateString()
  installedAt!: string;

  @IsString()
  @IsNotEmpty()
  installedById!: string;

  @IsOptional()
  @IsString()
  businessLineId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accessories?: string[];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsDateString()
  warrantyStartDate?: string;

  @IsDateString()
  warrantyEndDate!: string;

  @IsOptional()
  @IsString()
  warrantyNote?: string;
}

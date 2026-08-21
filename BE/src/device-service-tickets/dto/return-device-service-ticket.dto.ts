import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ReturnDeviceServiceTicketDto {
  @IsOptional()
  @IsDateString()
  returnedAt?: string;

  @IsOptional()
  @IsString()
  repairMethod?: string;

  @IsOptional()
  @IsString()
  repairCostItems?: string;

  @IsOptional()
  @IsString()
  resultNote?: string;

  @IsOptional()
  @IsString()
  returnCondition?: string;

  @IsOptional()
  @IsString()
  totalRepairCost?: string;

  @IsOptional()
  @IsString()
  repairCostInWords?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

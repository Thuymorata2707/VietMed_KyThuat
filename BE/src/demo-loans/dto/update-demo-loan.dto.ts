import { IsArray, IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateDemoLoanDto {
  @IsOptional()
  @IsString()
  machineId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  engineerId?: string;

  @IsOptional()
  @IsDateString()
  plannedHandoverAt?: string;

  @IsOptional()
  @IsDateString()
  expectedReturnAt?: string;

  @IsOptional()
  @IsDateString()
  handedOverAt?: string;

  @IsOptional()
  @IsDateString()
  returnedAt?: string;

  @IsOptional()
  @IsString()
  handoverAddress?: string;

  @IsOptional()
  @IsString()
  receiverName?: string;

  @IsOptional()
  @IsString()
  receiverPosition?: string;

  @IsOptional()
  @IsString()
  receiverPhone?: string;

  @IsOptional()
  @IsString()
  handoverCondition?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  handoverAccessories?: string[];

  @IsOptional()
  @IsString()
  handoverNote?: string;

  @IsOptional()
  @IsString()
  returnCondition?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  returnAccessories?: string[];

  @IsOptional()
  @IsString()
  returnNote?: string;

  @IsOptional()
  @IsString()
  purpose?: string;
}

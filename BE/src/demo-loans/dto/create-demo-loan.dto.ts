import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateDemoLoanDto {
  @IsString()
  @IsNotEmpty()
  machineId!: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsString()
  @IsNotEmpty()
  engineerId!: string;

  @IsDateString()
  plannedHandoverAt!: string;

  @IsDateString()
  expectedReturnAt!: string;

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
  purpose?: string;
}

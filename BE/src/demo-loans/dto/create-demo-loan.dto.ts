import { DemoLoanMachineUse } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDemoLoanBatchMachineDto {
  @IsString() @IsNotEmpty() machineId!: string;
  @IsEnum(DemoLoanMachineUse) machineUse!: DemoLoanMachineUse;
}

export class CreateDemoLoanDto {
  @IsEnum(DemoLoanMachineUse)
  machineUse!: DemoLoanMachineUse;

  @IsString()
  @IsNotEmpty()
  machineId!: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsString()
  @IsNotEmpty()
  engineerId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantEngineerIds?: string[];

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

export class CreateDemoLoanBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateDemoLoanBatchMachineDto)
  machines!: CreateDemoLoanBatchMachineDto[];

  @IsString() @IsNotEmpty() customerId!: string;
  @IsString() @IsNotEmpty() engineerId!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) participantEngineerIds?: string[];
  @IsDateString() plannedHandoverAt!: string;
  @IsDateString() expectedReturnAt!: string;
  @IsOptional() @IsString() handoverAddress?: string;
  @IsOptional() @IsString() receiverName?: string;
  @IsOptional() @IsString() receiverPosition?: string;
  @IsOptional() @IsString() receiverPhone?: string;
  @IsOptional() @IsString() handoverCondition?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) handoverAccessories?: string[];
  @IsOptional() @IsString() handoverNote?: string;
  @IsOptional() @IsString() purpose?: string;
}

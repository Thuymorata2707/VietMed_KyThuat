import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateDeviceServiceTicketDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  engineerId?: string;

  @IsOptional()
  @IsString()
  machineId?: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @IsOptional()
  @IsString()
  usingDepartment?: string;

  @IsOptional()
  @IsString()
  representative?: string;

  @IsOptional()
  @IsString()
  representativePosition?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  warrantyStatus?: string;

  @IsOptional()
  @IsString()
  warrantyTerm?: string;

  @IsOptional()
  @IsString()
  receivedCondition?: string;

  @IsOptional()
  @IsString()
  receivedAccessories?: string;

  @IsOptional()
  @IsString()
  preliminaryCause?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

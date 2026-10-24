import { CustomerSalesChannel, CustomerStatus, CustomerType } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerContactDto } from './customer-contact.dto';

export class UpdateCustomerDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerContactDto)
  contacts?: CustomerContactDto[];

  @IsOptional()
  @IsString()
  customerCode?: string | null;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  shortName?: string | null;

  @IsOptional()
  @IsString()
  hospitalName?: string | null;

  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  @IsString()
  dealerId?: string | null;

  @IsOptional()
  @IsEnum(CustomerSalesChannel)
  salesChannel?: CustomerSalesChannel | null;

  @IsOptional()
  @IsString()
  taxCode?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: false })
  website?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  contactPerson?: string | null;

  @IsOptional()
  @IsString()
  contactPosition?: string | null;

  @IsOptional()
  @IsString()
  contactPhone?: string | null;

  @IsOptional()
  @IsEmail()
  contactEmail?: string | null;

  @IsOptional()
  @IsString()
  province?: string | null;

  @IsOptional()
  @IsString()
  provinceId?: string | null;

  @IsOptional()
  @IsString()
  district?: string | null;

  @IsOptional()
  @IsString()
  locality?: string | null;

  @IsOptional()
  @IsString()
  ward?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  fullAddress?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsString()
  regionId?: string | null;

  @IsOptional()
  @IsString()
  primaryEngineerId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  engineerIds?: string[];
}

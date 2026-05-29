import { CustomerStatus, CustomerType } from '@prisma/client';

export class CreateCustomerDto {
  customerCode?: string;
  name!: string;
  shortName?: string;
  hospitalName?: string;
  customerType?: CustomerType;
  status?: CustomerStatus;
  taxCode?: string;
  email?: string;
  website?: string;
  phone?: string;
  contactPerson?: string;
  contactPosition?: string;
  contactPhone?: string;
  contactEmail?: string;
  province?: string;
  district?: string;
  ward?: string;
  address?: string;
  fullAddress?: string;
  note?: string;
  regionId!: string;
}

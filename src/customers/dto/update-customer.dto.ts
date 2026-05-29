import { CustomerStatus, CustomerType } from '@prisma/client';

export class UpdateCustomerDto {
  customerCode?: string | null;
  name?: string;
  shortName?: string | null;
  hospitalName?: string | null;
  customerType?: CustomerType;
  status?: CustomerStatus;
  taxCode?: string | null;
  email?: string | null;
  website?: string | null;
  phone?: string | null;
  contactPerson?: string | null;
  contactPosition?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  province?: string | null;
  district?: string | null;
  ward?: string | null;
  address?: string | null;
  fullAddress?: string | null;
  note?: string | null;
  regionId?: string;
}

import { BusinessLineStatus, MachineProductCategory } from '@prisma/client';

export class UpdateBusinessLineDto {
  code?: string;
  name?: string;
  status?: BusinessLineStatus;
  manufacturer?: string | null;
  productCategory?: MachineProductCategory;
  countryOfOrigin?: string | null;
  website?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  description?: string | null;
  note?: string | null;
  managerId?: string | null;
}

import { BusinessLineStatus, MachineProductCategory } from '@prisma/client';

export class CreateBusinessLineDto {
  code!: string;
  name!: string;
  status?: BusinessLineStatus;
  manufacturer?: string;
  productCategory?: MachineProductCategory;
  countryOfOrigin?: string;
  website?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  description?: string;
  note?: string;
  managerId?: string;
}

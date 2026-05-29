import {
  MachineInventoryStatus,
  MachineProductCategory,
  MachineStatus,
} from '@prisma/client';

export class UpdateMachineDto {
  machineCode?: string | null;
  serialNumber?: string;
  name?: string | null;
  modelName?: string;
  version?: string | null;
  manufacturer?: string;
  productCategory?: MachineProductCategory;
  productLine?: string | null;
  status?: MachineStatus;
  inventoryStatus?: MachineInventoryStatus;
  manufacturingDate?: string | null;
  warehouseImportDate?: string | null;
  installDate?: string | null;
  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;
  businessLineId?: string | null;
  customerId?: string;
  installedById?: string | null;
  primaryEngineerId?: string | null;
}

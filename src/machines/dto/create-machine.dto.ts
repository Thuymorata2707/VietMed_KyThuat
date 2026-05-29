import {
  MachineInventoryStatus,
  MachineProductCategory,
  MachineStatus,
} from '@prisma/client';

export class CreateMachineDto {
  machineCode?: string;
  serialNumber!: string;
  name?: string;
  modelName!: string;
  version?: string;
  manufacturer!: string;
  productCategory?: MachineProductCategory;
  productLine?: string;
  status?: MachineStatus;
  inventoryStatus?: MachineInventoryStatus;
  manufacturingDate?: string;
  warehouseImportDate?: string;
  installDate?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  businessLineId?: string;
  customerId?: string;
  installedById?: string;
  primaryEngineerId?: string;
}

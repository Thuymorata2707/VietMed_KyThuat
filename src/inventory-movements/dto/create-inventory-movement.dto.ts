import { InventoryMovementType, MachineInventoryStatus } from '@prisma/client';

export class CreateInventoryMovementDto {
  machineId!: string;
  type!: InventoryMovementType;
  toStatus!: MachineInventoryStatus;
  occurredAt?: string;
  note?: string;
  customerId?: string;
}

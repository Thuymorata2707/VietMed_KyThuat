import { BadRequestException } from '@nestjs/common';
import {
  InventoryMovementType,
  MachineInventoryStatus,
  MachineStatus,
} from '@prisma/client';

const allowedInventoryTransitions: Record<
  InventoryMovementType,
  Partial<Record<MachineInventoryStatus, MachineInventoryStatus[]>>
> = {
  [InventoryMovementType.IMPORT]: {
    [MachineInventoryStatus.RETURNED]: [MachineInventoryStatus.IN_STOCK],
    [MachineInventoryStatus.ACCESSORY_SPLIT]: [MachineInventoryStatus.IN_STOCK],
  },
  [InventoryMovementType.SPLIT_ACCESSORY]: {
    [MachineInventoryStatus.IN_STOCK]: [MachineInventoryStatus.ACCESSORY_SPLIT],
    [MachineInventoryStatus.RETURNED]: [MachineInventoryStatus.ACCESSORY_SPLIT],
  },
  [InventoryMovementType.RESERVE]: {
    [MachineInventoryStatus.IN_STOCK]: [MachineInventoryStatus.RESERVED],
    [MachineInventoryStatus.RETURNED]: [MachineInventoryStatus.RESERVED],
  },
  [InventoryMovementType.INSTALL]: {
    [MachineInventoryStatus.IN_STOCK]: [MachineInventoryStatus.INSTALLED],
    [MachineInventoryStatus.RESERVED]: [MachineInventoryStatus.INSTALLED],
    [MachineInventoryStatus.RETURNED]: [MachineInventoryStatus.INSTALLED],
  },
  [InventoryMovementType.RETURN]: {
    [MachineInventoryStatus.RESERVED]: [MachineInventoryStatus.RETURNED],
    [MachineInventoryStatus.INSTALLED]: [MachineInventoryStatus.RETURNED],
  },
  [InventoryMovementType.SELL]: {
    [MachineInventoryStatus.IN_STOCK]: [MachineInventoryStatus.SOLD],
    [MachineInventoryStatus.RESERVED]: [MachineInventoryStatus.SOLD],
  },
  [InventoryMovementType.ADJUST_STATUS]: {},
};

export function getExpectedInventoryStatus(
  type: InventoryMovementType,
): MachineInventoryStatus | null {
  const expected: Partial<
    Record<InventoryMovementType, MachineInventoryStatus>
  > = {
    [InventoryMovementType.IMPORT]: MachineInventoryStatus.IN_STOCK,
    [InventoryMovementType.SPLIT_ACCESSORY]:
      MachineInventoryStatus.ACCESSORY_SPLIT,
    [InventoryMovementType.RESERVE]: MachineInventoryStatus.RESERVED,
    [InventoryMovementType.INSTALL]: MachineInventoryStatus.INSTALLED,
    [InventoryMovementType.RETURN]: MachineInventoryStatus.RETURNED,
    [InventoryMovementType.SELL]: MachineInventoryStatus.SOLD,
  };

  return expected[type] ?? null;
}

export function getMachineStatusForInventoryStatus(
  inventoryStatus: MachineInventoryStatus,
): MachineStatus {
  if (inventoryStatus === MachineInventoryStatus.SOLD) {
    return MachineStatus.INACTIVE;
  }

  if (inventoryStatus === MachineInventoryStatus.RETURNED) {
    return MachineStatus.REPAIRING;
  }

  return MachineStatus.ACTIVE;
}

export function getMachineStatusAfterWork(
  inventoryStatus: MachineInventoryStatus,
): MachineStatus {
  return inventoryStatus === MachineInventoryStatus.RETURNED
    ? MachineStatus.REPAIRING
    : MachineStatus.ACTIVE;
}

export function validateInventoryMovement(
  type: InventoryMovementType,
  currentStatus: MachineInventoryStatus,
  nextStatus: MachineInventoryStatus,
  customerId?: string | null,
) {
  const expectedStatus = getExpectedInventoryStatus(type);

  if (expectedStatus && nextStatus !== expectedStatus) {
    throw new BadRequestException(
      `${type} movement must set inventory status to ${expectedStatus}`,
    );
  }

  if (currentStatus === nextStatus) {
    throw new BadRequestException(`Inventory status is already ${nextStatus}`);
  }

  if (type !== InventoryMovementType.ADJUST_STATUS) {
    const allowedNextStatuses =
      allowedInventoryTransitions[type][currentStatus] ?? [];

    if (!allowedNextStatuses.includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid inventory transition for ${type}: ${currentStatus} -> ${nextStatus}`,
      );
    }
  }

  validateMachineInventoryRequirements(nextStatus, customerId);

  if (type === InventoryMovementType.RESERVE && !customerId) {
    throw new BadRequestException(
      'customerId is required when reserving a machine',
    );
  }

  if (type === InventoryMovementType.SELL && !customerId) {
    throw new BadRequestException(
      'customerId is required when selling a machine',
    );
  }
}

export function validateMachineState(
  status: MachineStatus,
  inventoryStatus: MachineInventoryStatus,
  customerId?: string | null,
) {
  validateMachineInventoryRequirements(inventoryStatus, customerId);

  if (
    status === MachineStatus.MAINTENANCE &&
    inventoryStatus !== MachineInventoryStatus.INSTALLED
  ) {
    throw new BadRequestException(
      `${status} machines must have inventoryStatus INSTALLED`,
    );
  }

  if (
    status === MachineStatus.REPAIRING &&
    !(
      inventoryStatus === MachineInventoryStatus.INSTALLED ||
      inventoryStatus === MachineInventoryStatus.RETURNED
    )
  ) {
    throw new BadRequestException(
      `${status} machines must have inventoryStatus INSTALLED or RETURNED`,
    );
  }

  if (
    inventoryStatus === MachineInventoryStatus.RETURNED &&
    status !== MachineStatus.REPAIRING
  ) {
    throw new BadRequestException(
      'RETURNED machines must have status REPAIRING',
    );
  }

  if (
    inventoryStatus === MachineInventoryStatus.SOLD &&
    status !== MachineStatus.INACTIVE
  ) {
    throw new BadRequestException('SOLD machines must have status INACTIVE');
  }
}

function validateMachineInventoryRequirements(
  inventoryStatus: MachineInventoryStatus,
  customerId?: string | null,
) {
  if (inventoryStatus === MachineInventoryStatus.INSTALLED && !customerId) {
    throw new BadRequestException(
      'customerId is required when inventoryStatus is INSTALLED',
    );
  }

  if (inventoryStatus === MachineInventoryStatus.RESERVED && !customerId) {
    throw new BadRequestException(
      'customerId is required when inventoryStatus is RESERVED',
    );
  }

  if (inventoryStatus === MachineInventoryStatus.SOLD && !customerId) {
    throw new BadRequestException(
      'customerId is required when inventoryStatus is SOLD',
    );
  }
}

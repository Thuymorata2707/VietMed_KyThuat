import {
  MachineInventoryStatus,
  MachineStatus,
} from '@prisma/client';
import { resolveMachineStatusFromOpenWork } from './machine-work-status';

describe('resolveMachineStatusFromOpenWork', () => {
  it('keeps returned devices in repair state', () => {
    expect(
      resolveMachineStatusFromOpenWork({
        inventoryStatus: MachineInventoryStatus.RETURNED,
        hasOpenRepair: false,
        hasOpenMaintenance: false,
      }),
    ).toBe(MachineStatus.REPAIRING);
  });

  it('does not reactivate a machine while another repair remains open', () => {
    expect(
      resolveMachineStatusFromOpenWork({
        inventoryStatus: MachineInventoryStatus.INSTALLED,
        hasOpenRepair: true,
        hasOpenMaintenance: false,
      }),
    ).toBe(MachineStatus.REPAIRING);
  });

  it('keeps a machine under maintenance until its last open maintenance closes', () => {
    expect(
      resolveMachineStatusFromOpenWork({
        inventoryStatus: MachineInventoryStatus.INSTALLED,
        hasOpenRepair: false,
        hasOpenMaintenance: true,
      }),
    ).toBe(MachineStatus.MAINTENANCE);
  });
});

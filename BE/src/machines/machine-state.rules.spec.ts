import {
  MachineInventoryStatus,
  MachineStatus,
} from '@prisma/client';
import {
  getMachineStatusAfterWork,
  validateMachineState,
} from './machine-state.rules';

describe('machine state rules', () => {
  it('keeps a returned device in repair state after work is closed', () => {
    const status = getMachineStatusAfterWork(MachineInventoryStatus.RETURNED);

    expect(status).toBe(MachineStatus.REPAIRING);
    expect(() =>
      validateMachineState(
        status,
        MachineInventoryStatus.RETURNED,
        'customer-1',
      ),
    ).not.toThrow();
  });

  it('returns installed devices to active after work is closed', () => {
    expect(
      getMachineStatusAfterWork(MachineInventoryStatus.INSTALLED),
    ).toBe(MachineStatus.ACTIVE);
  });
});

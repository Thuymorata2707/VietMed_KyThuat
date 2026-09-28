import { MaintenanceStatus } from '@prisma/client';
import { isMaintenanceOverdue } from './maintenance-overdue';

describe('isMaintenanceOverdue', () => {
  const today = new Date('2026-09-24T00:00:00.000Z');

  it('counts due-today active work as not overdue', () => {
    expect(
      isMaintenanceOverdue(
        MaintenanceStatus.SCHEDULED,
        new Date('2026-09-24T00:00:00.000Z'),
        today,
      ),
    ).toBe(false);
  });

  it('counts past-due active maintenance', () => {
    expect(
      isMaintenanceOverdue(
        MaintenanceStatus.ASSIGNED,
        new Date('2026-09-23T00:00:00.000Z'),
        today,
      ),
    ).toBe(true);
  });

  it('excludes closed maintenance even if its date is old', () => {
    expect(
      isMaintenanceOverdue(
        MaintenanceStatus.COMPLETED,
        new Date('2026-09-01T00:00:00.000Z'),
        today,
      ),
    ).toBe(false);
  });
});

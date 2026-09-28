import { InstallationStatus } from '@prisma/client';
import { ensureInstallationStatusTransitionIsAllowed } from './installation-status.rules';

describe('installation status transitions', () => {
  it('allows pending installations to complete or cancel', () => {
    expect(() =>
      ensureInstallationStatusTransitionIsAllowed(
        InstallationStatus.PENDING,
        InstallationStatus.INSTALLED,
      ),
    ).not.toThrow();
    expect(() =>
      ensureInstallationStatusTransitionIsAllowed(
        InstallationStatus.PENDING,
        InstallationStatus.CANCELLED,
      ),
    ).not.toThrow();
  });

  it('rejects cancelling or reopening terminal installations', () => {
    expect(() =>
      ensureInstallationStatusTransitionIsAllowed(
        InstallationStatus.INSTALLED,
        InstallationStatus.CANCELLED,
      ),
    ).toThrow('Invalid installation status transition');
    expect(() =>
      ensureInstallationStatusTransitionIsAllowed(
        InstallationStatus.CANCELLED,
        InstallationStatus.PENDING,
      ),
    ).toThrow('Invalid installation status transition');
  });
});

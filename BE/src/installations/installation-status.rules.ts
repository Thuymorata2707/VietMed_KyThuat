import { BadRequestException } from '@nestjs/common';
import { InstallationStatus } from '@prisma/client';

const allowedTransitions: Record<InstallationStatus, InstallationStatus[]> = {
  [InstallationStatus.PENDING]: [
    InstallationStatus.INSTALLED,
    InstallationStatus.CANCELLED,
  ],
  [InstallationStatus.INSTALLED]: [],
  [InstallationStatus.CANCELLED]: [],
};

export function ensureInstallationStatusTransitionIsAllowed(
  currentStatus: InstallationStatus,
  nextStatus: InstallationStatus,
) {
  if (
    currentStatus !== nextStatus &&
    !allowedTransitions[currentStatus].includes(nextStatus)
  ) {
    throw new BadRequestException(
      `Invalid installation status transition: ${currentStatus} -> ${nextStatus}`,
    );
  }
}

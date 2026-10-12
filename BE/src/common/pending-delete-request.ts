import { BadRequestException } from '@nestjs/common';
import { WorkReviewStatus } from '@prisma/client';
import { isDeleteRequest } from './work-delete-request';

export function assertNoPendingDeleteRequest(task: {
  reviewStatus: WorkReviewStatus;
  reviewNote?: string | null;
}) {
  if (
    task.reviewStatus === WorkReviewStatus.PENDING &&
    isDeleteRequest(task.reviewNote)
  ) {
    throw new BadRequestException(
      'A pending delete request cannot be changed before review',
    );
  }
}

export function assertTicketCanBeDeleted(status: string) {
  if (status !== 'PENDING') {
    throw new BadRequestException(
      'Only tickets waiting for processing can be deleted',
    );
  }
}

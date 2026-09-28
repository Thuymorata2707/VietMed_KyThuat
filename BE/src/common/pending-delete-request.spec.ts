import { WorkReviewStatus } from '@prisma/client';
import { assertNoPendingDeleteRequest } from './pending-delete-request';
import { buildDeleteRequestNote } from './work-delete-request';

describe('assertNoPendingDeleteRequest', () => {
  it('prevents status or field mutation from consuming a pending delete request', () => {
    expect(() =>
      assertNoPendingDeleteRequest({
        reviewStatus: WorkReviewStatus.PENDING,
        reviewNote: buildDeleteRequestNote('Thiết bị trùng'),
      }),
    ).toThrow('A pending delete request cannot be changed before review');
  });

  it('allows normal edits and requests that have already been reviewed', () => {
    expect(() =>
      assertNoPendingDeleteRequest({
        reviewStatus: WorkReviewStatus.PENDING,
        reviewNote: 'Cần bổ sung biên bản',
      }),
    ).not.toThrow();
    expect(() =>
      assertNoPendingDeleteRequest({
        reviewStatus: WorkReviewStatus.NEEDS_REVISION,
        reviewNote: buildDeleteRequestNote(),
      }),
    ).not.toThrow();
  });
});

import { WorkReviewStatus } from '@prisma/client';

export const DELETE_REQUEST_PREFIX = '[DELETE_REQUEST]';

export function buildDeleteRequestNote(reason?: string | null) {
  const cleanedReason = reason?.trim();
  return cleanedReason
    ? `${DELETE_REQUEST_PREFIX} ${cleanedReason}`
    : `${DELETE_REQUEST_PREFIX} Kỹ sư yêu cầu xóa phiếu.`;
}

export function isDeleteRequest(note?: string | null) {
  return note?.startsWith(DELETE_REQUEST_PREFIX) ?? false;
}

export function deleteRequestDisplayNote(note?: string | null) {
  return isDeleteRequest(note)
    ? note!.slice(DELETE_REQUEST_PREFIX.length).trim()
    : note;
}

export function isApprovedDeleteReview(status: WorkReviewStatus) {
  return status === WorkReviewStatus.APPROVED;
}

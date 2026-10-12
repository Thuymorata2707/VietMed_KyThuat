import { apiFetch } from '../api';
import type { QueryClient } from '@tanstack/react-query';

const DELETE_REQUEST_PREFIX = '[DELETE_REQUEST]';

export type WorkDeleteTarget = {
  reviewNote?: string | null;
  reviewStatus?: string | null;
};

export function isDeleteRequest(item?: WorkDeleteTarget | null) {
  return item?.reviewStatus === 'PENDING' && Boolean(item.reviewNote?.startsWith(DELETE_REQUEST_PREFIX));
}

export function hasDeleteRequestNote(item?: WorkDeleteTarget | null) {
  return Boolean(item?.reviewNote?.startsWith(DELETE_REQUEST_PREFIX));
}

export function deleteRequestReason(item?: WorkDeleteTarget | null) {
  return item?.reviewNote?.replace(DELETE_REQUEST_PREFIX, '').trim() || '';
}

export function isDeletedResponse(response: unknown): response is { deleted: boolean } {
  return Boolean(response && typeof response === 'object' && 'deleted' in response && (response as { deleted?: boolean }).deleted);
}

export async function invalidateWorkTicketQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['service-tickets'] }),
    queryClient.invalidateQueries({ queryKey: ['reports'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['technical-statistics'] }),
    queryClient.invalidateQueries({ queryKey: ['engineer-performance'] }),
    queryClient.invalidateQueries({ queryKey: ['weekly-reports'] }),
    queryClient.invalidateQueries({ queryKey: ['work-assignments'] }),
    queryClient.invalidateQueries({ queryKey: ['resources'] }),
  ]);
}

export async function deleteWorkTicket(endpoint: string, reason?: string) {
  return apiFetch<{ deleted?: boolean; deleteRequested?: boolean }>(endpoint, {
    method: 'DELETE',
    body: JSON.stringify({ reason: reason || '' }),
  });
}

export async function reviewDeleteWorkTicket<T>(endpoint: string, approved: boolean, reviewNote?: string) {
  return apiFetch<{ deleted?: boolean } | T>(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      status: approved ? 'APPROVED' : 'NEEDS_REVISION',
      reviewNote: reviewNote || undefined,
    }),
  });
}

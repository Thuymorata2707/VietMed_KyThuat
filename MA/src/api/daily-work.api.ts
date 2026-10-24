import { apiClient } from './client';

export type DailyWorkNote = { id: string; title: string; note?: string | null; workDate: string; startTime?: string | null; endTime?: string | null; type?: string; status?: string; rejectReason?: string | null };
export type DailyWorkPayload = { title: string; note?: string | null; workDate: string; startTime?: string | null; endTime?: string | null; type: string };
export const dailyWorkApi = {
  async list(from: string, to: string) { return (await apiClient.get<DailyWorkNote[]>('/daily-work-notes', { params: { from, to } })).data; },
  async create(payload: DailyWorkPayload) { return (await apiClient.post<DailyWorkNote>('/daily-work-notes', payload)).data; },
  async update(id: string, payload: Partial<DailyWorkPayload>) { return (await apiClient.patch<DailyWorkNote>(`/daily-work-notes/${id}`, payload)).data; },
  async remove(id: string) { return (await apiClient.delete(`/daily-work-notes/${id}`)).data; },
};

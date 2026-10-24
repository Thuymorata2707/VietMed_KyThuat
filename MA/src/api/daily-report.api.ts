import { apiClient } from './client';

export type DailyReport = { id: string; reportDate: string; status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'NEEDS_REVISION'; summary?: string | null; pending?: string | null; proposal?: string | null; reviewNote?: string | null };
export type DailyReportSuggestion = { reportDate: string; summary: string; pending: string; proposal: string; counts: { dailyNotes: number; repairs: number; maintenances: number; installations: number } };
export type DailyReportResponse = { report: DailyReport | null; suggested: DailyReportSuggestion };
export const dailyReportApi = {
  async get(date: string) { return (await apiClient.get<DailyReportResponse>('/daily-reports', { params: { date } })).data; },
  async save(payload: { reportDate: string; summary: string; pending: string; proposal: string }) { return (await apiClient.post<DailyReport>('/daily-reports', payload)).data; },
  async submit(id: string) { return (await apiClient.post<DailyReport>(`/daily-reports/${id}/submit`)).data; },
};

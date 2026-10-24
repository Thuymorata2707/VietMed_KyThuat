import { apiClient } from './client';

export type DemoLoan = {
  id: string;
  code?: string;
  ticketCode?: string | null;
  status: 'PLANNED' | 'HANDED_OVER' | 'OVERDUE' | 'RETURNED' | 'CANCELLED' | string;
  reviewStatus?: string | null;
  dueDate?: string | null;
  handedOverAt?: string | null;
  handoverAccessories?: string[];
  customer?: { id?: string; name?: string | null; hospitalName?: string | null; phone?: string | null; address?: string | null } | null;
  machine?: { id?: string; machineCode?: string | null; name?: string | null; modelName?: string | null; serialNumber?: string | null } | null;
};

export const demoApi = {
  async list() {
    const rows: DemoLoan[] = [];
    for (let page = 1; page <= 30; page += 1) {
      const { data } = await apiClient.get<DemoLoan[] | { data: DemoLoan[]; meta?: { totalPages?: number } }>('/demo-loans', { params: { page, limit: 100 } });
      rows.push(...(Array.isArray(data) ? data : data.data || []));
      if (Array.isArray(data) || !data.meta?.totalPages || page >= data.meta.totalPages) break;
    }
    return rows;
  },
  async create(payload: Record<string, unknown>) { return (await apiClient.post('/demo-loans', payload)).data; },
  async createBatch(payload: Record<string, unknown>) { return (await apiClient.post('/demo-loans/batch', payload)).data; },
  async update(id: string, payload: Record<string, unknown>) { return (await apiClient.patch(`/demo-loans/${id}`, payload)).data; },
  async remove(id: string) { return (await apiClient.delete(`/demo-loans/${id}`)).data; },
  async handover(id: string) { return (await apiClient.post(`/demo-loans/${id}/handover`, { occurredAt: new Date().toISOString() })).data; },
  async returnLoan(id: string, payload: { occurredAt: string; condition: string; accessories: string[]; note: string; requiresRepair: boolean }) {
    return (await apiClient.post(`/demo-loans/${id}/return`, payload)).data;
  },
  async prepare(id: string) { return (await apiClient.post(`/demo-loans/${id}/prepare`, { occurredAt: new Date().toISOString() })).data; },
  async cancel(id: string) { return (await apiClient.post(`/demo-loans/${id}/cancel`)).data; },
};

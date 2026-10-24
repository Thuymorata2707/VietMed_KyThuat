import { apiClient } from './client';

export type ServiceTicket = { id: string; code?: string; ticketCode?: string; title?: string; description?: string; status?: string; reviewStatus?: string | null; receivedAt?: string; returnedAt?: string; deviceName?: string; modelName?: string; serialNumber?: string; warrantyStatus?: string; warrantyTerm?: string; receivedCondition?: string; receivedAccessories?: string; preliminaryCause?: string; note?: string; usingDepartment?: string; representative?: string; representativePosition?: string; contactPhone?: string; address?: string; repairMethod?: string; repairCostItems?: string; resultNote?: string; returnCondition?: string; totalRepairCost?: string; repairCostInWords?: string; usedParts?: { name?: string | null; quantity?: number; unit?: string | null; unitCost?: number | null }[]; customer?: { id?: string; name?: string }; machine?: { id?: string; machineCode?: string; name?: string } };
export const ticketApi = {
  async list() {
    const rows: ServiceTicket[] = [];
    for (let page = 1; page <= 30; page += 1) {
      const { data } = await apiClient.get<ServiceTicket[] | { data: ServiceTicket[]; meta?: { totalPages?: number } }>('/device-service-tickets', { params: { limit: 100, page } });
      rows.push(...(Array.isArray(data) ? data : data.data || []));
      if (Array.isArray(data) || !data.meta?.totalPages || page >= data.meta.totalPages) break;
    }
    return rows;
  },
  async get(id: string) { return (await apiClient.get<ServiceTicket>(`/device-service-tickets/${id}`)).data; },
  async create(payload: Record<string, unknown>) { return (await apiClient.post<ServiceTicket>('/device-service-tickets', payload)).data; },
  async returnDevice(id: string, payload: Record<string, unknown>) { return (await apiClient.post(`/device-service-tickets/${id}/return`, payload)).data; },
  async updateReturn(id: string, payload: Record<string, unknown>) { return (await apiClient.patch(`/device-service-tickets/${id}/return`, payload)).data; },
  async remove(id: string) { return (await apiClient.delete(`/device-service-tickets/${id}`)).data; },
};

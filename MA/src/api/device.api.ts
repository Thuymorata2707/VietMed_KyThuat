import { apiClient } from './client';

export type MachineModel = { id: string; code?: string; name: string; displayName?: string; productCategory?: string; manufacturer?: string; countryOfOrigin?: string; productLine?: string; businessLine?: { productCategory?: string | null } | null; components?: { id: string; name?: string; ComponentAccessory?: { id: string; code?: string; name: string; quantity?: number; requiresSerial?: boolean; description?: string }[]; accessories?: { id: string; code?: string; name: string; quantity?: number; requiresSerial?: boolean; description?: string }[] }[] };
export type MachineAccessory = { id: string; name?: string; code?: string; serialNumber?: string; quantity?: number; description?: string; note?: string; componentAccessory?: { id?: string; code?: string; name?: string } | null };
export type Machine = {
  id: string; machineCode?: string | null; serialNumber?: string; name?: string | null; modelName?: string;
  inventoryStatus?: string; status?: string; dataStatus?: string; createdSource?: string; demoCategory?: string | null; demoPreparationStatus?: string | null; manufacturer?: string; productCategory?: string; productLine?: string;
  version?: string; manufacturingDate?: string | null; warehouseImportDate?: string | null; installDate?: string | null;
  warrantyStartDate?: string | null; warrantyEndDate?: string | null; customerId?: string | null;
  installedById?: string | null; primaryEngineerId?: string | null; installedBy?: { id: string; fullName?: string | null } | null; primaryEngineer?: { id: string; fullName?: string | null } | null;
  customer?: { id: string; name: string } | null; machineModelId?: string | null; machineModel?: MachineModel | null;
  accessories?: MachineAccessory[];
};
export type MachinePayload = Partial<Omit<Machine, 'id' | 'customer' | 'machineModel' | 'accessories'>> & { serialNumber: string; accessories?: (Partial<MachineAccessory> & { componentAccessoryId?: string | null })[] };

function unwrapList<T>(value: T[] | { data?: T[]; items?: T[]; results?: T[] }) {
  if (Array.isArray(value)) return value;
  return value.data || value.items || value.results || [];
}

export const deviceApi = {
  async models() {
    const rows: MachineModel[] = [];
    for (let page = 1; page <= 30; page += 1) {
      const { data } = await apiClient.get<MachineModel[] | { data?: MachineModel[]; items?: MachineModel[]; meta?: { totalPages?: number } }>('/machine-models', { params: { limit: 100, page } });
      rows.push(...unwrapList(data));
      if (Array.isArray(data) || !data.meta?.totalPages || page >= data.meta.totalPages) break;
    }
    return rows;
  },
  async machines(inventoryStatus?: string) {
    const rows: Machine[] = [];
    for (let page = 1; page <= 30; page += 1) {
      const { data } = await apiClient.get<Machine[] | { data?: Machine[]; items?: Machine[]; meta?: { totalPages?: number } }>('/machines', { params: { limit: 100, page, ...(inventoryStatus ? { inventoryStatus } : {}) } });
      rows.push(...unwrapList(data));
      if (Array.isArray(data) || !data.meta?.totalPages || page >= data.meta.totalPages) break;
    }
    return rows;
  },
  async get(id: string) { return (await apiClient.get<Machine>(`/machines/${id}`)).data; },
  async create(payload: MachinePayload) { return (await apiClient.post<Machine>('/machines', payload)).data; },
  async update(id: string, payload: Partial<MachinePayload>) { return (await apiClient.patch<Machine>(`/machines/${id}`, payload)).data; },
  async setStatus(id: string, status: string) { return (await apiClient.patch<Machine>(`/machines/${id}/status`, { status })).data; },
  async remove(id: string) { return (await apiClient.delete(`/machines/${id}`)).data; },
};

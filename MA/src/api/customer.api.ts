import { apiClient } from './client';

export type Customer = { id: string; name: string; shortName?: string | null; hospitalName?: string | null; customerType?: CreateCustomerPayload['customerType']; phone?: string | null; email?: string | null; taxCode?: string | null; address?: string | null; fullAddress?: string | null; province?: string | null; provinceId?: string | null; provinceRef?: { id: string; name: string } | null; district?: string | null; locality?: string | null; ward?: string | null; note?: string | null; contactPerson?: string | null; contactPosition?: string | null; contactEmail?: string | null; contactPhone?: string | null; contacts?: { id: string; name: string; position?: string | null; phone?: string | null; email?: string | null; isPrimary?: boolean }[]; machines?: { id: string; machineCode?: string; serialNumber?: string; name?: string; modelName?: string; machineModel?: { name?: string } }[] };
export const customerApi = {
  async list(search?: string) {
    const rows: Customer[] = [];
    for (let page = 1; page <= 30; page += 1) {
      const { data } = await apiClient.get<Customer[] | { data: Customer[]; meta?: { totalPages?: number } }>('/customers', { params: { limit: 100, page, search } });
      rows.push(...(Array.isArray(data) ? data : data.data || []));
      if (Array.isArray(data) || !data.meta?.totalPages || page >= data.meta.totalPages) break;
    }
    return rows;
  },
  async get(id: string) { return (await apiClient.get<Customer>(`/customers/${id}`)).data; },
  async create(payload: CreateCustomerPayload) { return (await apiClient.post<Customer>('/customers', payload)).data; },
  async update(id: string, payload: Partial<CreateCustomerPayload>) { return (await apiClient.patch<Customer>(`/customers/${id}`, payload)).data; },
  async remove(id: string) { return (await apiClient.delete(`/customers/${id}`)).data; },
};

export type CreateCustomerPayload = {
  name: string; shortName?: string; hospitalName?: string; customerType?: 'HOSPITAL' | 'CLINIC' | 'LAB' | 'DISTRIBUTOR' | 'UNIVERSITY' | 'COMPANY' | 'OTHER';
  phone?: string; email?: string; taxCode?: string; contactPerson?: string; contactPosition?: string; contactPhone?: string; contactEmail?: string;
  contacts?: { name: string; position?: string; phone?: string; email?: string; isPrimary: boolean }[];
  province?: string; provinceId?: string; district?: string; locality?: string; ward?: string; address?: string; fullAddress?: string; note?: string;
};

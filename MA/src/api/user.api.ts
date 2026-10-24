import { apiClient } from './client';

export type EngineerOption = { id: string; fullName?: string | null; email: string; phone?: string | null; role?: { name?: string } };

export const userApi = {
  async engineers() {
    const rows: EngineerOption[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const { data } = await apiClient.get<EngineerOption[] | { data?: EngineerOption[]; meta?: { totalPages?: number } }>('/users', { params: { roleName: 'engineer', status: 'ACTIVE', page, limit: 100 } });
      rows.push(...(Array.isArray(data) ? data : data.data || []));
      if (Array.isArray(data) || !data.meta?.totalPages || page >= data.meta.totalPages) break;
    }
    return rows;
  },
};

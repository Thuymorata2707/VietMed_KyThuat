import { apiClient } from './client';

export type Province = {
  id: string;
  name: string;
  code?: string | null;
  branch?: { id: string; name: string } | null;
};

export const territoriesApi = {
  async provinces() {
    const { data } = await apiClient.get<Province[]>('/provinces');
    return data;
  },
};

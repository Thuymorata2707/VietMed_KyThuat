import { apiClient } from './client';

export type KnowledgeArticle = {
  id: string; title: string; summary?: string | null; content?: string | null; modelHint?: string | null;
  category: string; status: string; tags: string[]; symptoms: string[]; steps: string[]; checklist: string[];
  note?: string | null; createdAt: string; createdBy?: { fullName?: string | null } | null;
};
export const knowledgeApi = {
  async list(search = '') {
    const rows: KnowledgeArticle[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const { data } = await apiClient.get<{ data: KnowledgeArticle[]; meta?: { totalPages?: number } }>('/knowledge-articles', { params: { page, limit: 100, search: search || undefined } });
      rows.push(...(data.data || []));
      if (!data.meta?.totalPages || page >= data.meta.totalPages) break;
    }
    return rows;
  },
};

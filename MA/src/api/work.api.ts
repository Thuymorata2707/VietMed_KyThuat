import { apiClient } from './client';

export type WorkKind = 'repair' | 'maintenance' | 'installation';
export type EngineerWork = {
  id: string; code?: string; title?: string; description?: string | null; status: string; priority?: string;
  resultNote?: string | null; customerFeedback?: string | null; nextDueDate?: string | null; scheduledDate?: string | null; installedAt?: string | null;
  reviewStatus?: string | null; reviewNote?: string | null;
  type?: string; reportedAt?: string; usingDepartment?: string | null; representative?: string | null; representativePosition?: string | null; address?: string | null; contactPhone?: string | null; deviceName?: string | null; modelName?: string | null; serialNumber?: string | null; warrantyStatus?: string | null; warrantyTerm?: string | null; receivedAccessories?: string | null; preliminaryCause?: string | null; conditionAssessment?: string | null; repairMethod?: string | null; repairCostItems?: string | null; totalRepairCost?: string | null; repairCostInWords?: string | null; checklist?: string[];
  customer?: { id?: string; name?: string; fullAddress?: string; address?: string; phone?: string } | null;
  machine?: { id?: string; machineCode?: string; serialNumber?: string; modelName?: string; name?: string; machineModel?: { name?: string } } | null;
};
export type WorkRow = EngineerWork & { kind: WorkKind };
export type WorkOperations = {
  workLogs?: { id?: string; title: string; note?: string | null; stepTime?: string | null }[];
  usedParts?: { id?: string; name: string; quantity?: number; unit?: string; note?: string | null }[];
  checklistItems?: { id?: string; label: string; status?: 'PENDING' | 'DONE' | 'SKIPPED'; note?: string | null }[];
};

async function getAllPages<T>(path: string) {
  const rows: T[] = [];
  let page = 1;
  while (page <= 30) {
    const { data } = await apiClient.get<{ data: T[]; meta?: { totalPages?: number } }>(path, { params: { page, limit: 100 } });
    rows.push(...(Array.isArray(data) ? data : data.data || []));
    const totalPages = Array.isArray(data) ? 1 : data.meta?.totalPages;
    if (!totalPages || page >= totalPages) break;
    page += 1;
  }
  return rows;
}

export const workApi = {
  async listAssigned(engineerId: string, includeAll = false): Promise<WorkRow[]> {
    const repairQuery = includeAll ? '' : `?engineerId=${encodeURIComponent(engineerId)}`;
    const maintenanceQuery = includeAll ? '' : `?engineerId=${encodeURIComponent(engineerId)}`;
    const installationQuery = includeAll ? '' : `?installedById=${encodeURIComponent(engineerId)}`;
    const [repairs, maintenance, installations] = await Promise.all([
      getAllPages<EngineerWork>(`/repairs${repairQuery}`),
      getAllPages<EngineerWork>(`/maintenance${maintenanceQuery}`),
      getAllPages<EngineerWork>(`/installations${installationQuery}`),
    ]);
    return [
      ...repairs.map((item) => ({ ...item, kind: 'repair' as const })),
      ...maintenance.map((item) => ({ ...item, kind: 'maintenance' as const })),
      ...installations.map((item) => ({ ...item, kind: 'installation' as const })),
    ].sort((a, b) => new Date(b.scheduledDate || b.installedAt || '').getTime() - new Date(a.scheduledDate || a.installedAt || '').getTime());
  },
  async get(kind: WorkKind, id: string) { return (await apiClient.get<EngineerWork>(`/${kind === 'repair' ? 'repairs' : kind === 'maintenance' ? 'maintenance' : 'installations'}/${id}`)).data; },
  async updateStatus(kind: WorkKind, id: string, payload: { status: string; resultNote?: string; customerFeedback?: string; nextDueDate?: string }) {
    const route = kind === 'repair' ? 'repairs' : kind === 'maintenance' ? 'maintenance' : 'installations';
    const path = kind === 'installation' ? `/${route}/${id}` : `/${route}/${id}/status`;
    return (await apiClient.patch(path, payload)).data;
  },
  async createRepair(payload: Record<string, unknown>) { return (await apiClient.post('/repairs', payload)).data; },
  async reviewRepair(id: string, status: 'APPROVED' | 'NEEDS_REVISION', reviewNote?: string) { return (await apiClient.post(`/repairs/${id}/review`, { status, reviewNote })).data; },
  async createMaintenance(payload: Record<string, unknown>) { return (await apiClient.post('/maintenance', payload)).data; },
  async reviewMaintenance(id: string, status: 'APPROVED' | 'NEEDS_REVISION', reviewNote?: string) { return (await apiClient.post(`/maintenance/${id}/review`, { status, reviewNote })).data; },
  async reviewInstallation(id: string, status: 'APPROVED' | 'NEEDS_REVISION', reviewNote?: string) { return (await apiClient.post(`/installations/${id}/review`, { status, reviewNote })).data; },
  async update(kind: Exclude<WorkKind, 'installation'>, id: string, payload: Record<string, unknown>) { return (await apiClient.patch(`/${kind === 'repair' ? 'repairs' : 'maintenance'}/${id}`, payload)).data; },
  async remove(kind: WorkKind, id: string) { const path = kind === 'repair' ? 'repairs' : kind === 'maintenance' ? 'maintenance' : 'installations'; return (await apiClient.delete(`/${path}/${id}`, { data: {} })).data; },
  async operations(kind: WorkKind, id: string) { return (await apiClient.get<WorkOperations>(`/work-operations/${kind}/${id}`)).data; },
  async saveOperations(kind: WorkKind, id: string, payload: WorkOperations) { return (await apiClient.put(`/work-operations/${kind}/${id}`, payload)).data; },
};

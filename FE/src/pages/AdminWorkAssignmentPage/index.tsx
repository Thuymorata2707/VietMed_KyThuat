import { AlertTriangle, Archive, CheckCircle2, ClipboardCheck, Clock3, Eye, Loader2, PackageCheck, RefreshCw, Search, UserCheck, Wrench } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages, getApiBaseUrl, getToken } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { InfoHint } from '../../components/InfoHint';
import { checklistForCategory } from '../../config/medicalDeviceChecklists';
import { queryKeys } from '../../lib/queryKeys';
import { isTechnicalUser, technicalUserName } from '../../utils/technicalUsers';
import { hasDeleteRequestNote } from '../../utils/workDeleteRequests';

type WorkKind = 'repair' | 'maintenance' | 'installation';
type WorkFilter = 'action' | 'unassigned' | 'review' | 'active' | 'closed' | 'all';
type SlaFilter = 'overdue' | 'due-soon' | 'waiting-parts';
type KindFilter = WorkKind | 'all';
type WorkReviewStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'NEEDS_REVISION';
type Tone = 'good' | 'warn' | 'danger' | 'neutral';

type WorkMachine = {
  machineCode?: string | null;
  serialNumber?: string | null;
  modelName?: string | null;
  productCategory?: string | null;
  customer?: {
    name?: string | null;
    province?: string | null;
  } | null;
};

type RepairAssignment = {
  id: string;
  code: string;
  title: string;
  status: string;
  reviewStatus?: WorkReviewStatus | null;
  reviewNote?: string | null;
  priority?: string | null;
  reportedAt?: string | null;
  engineer?: ApiUser | null;
  createdBy?: ApiUser | null;
  machine?: WorkMachine | null;
};

type MaintenanceAssignment = {
  id: string;
  code: string;
  title: string;
  status: string;
  reviewStatus?: WorkReviewStatus | null;
  reviewNote?: string | null;
  type?: string | null;
  scheduledDate?: string | null;
  engineer?: ApiUser | null;
  machine?: WorkMachine | null;
};

type InstallationAssignment = {
  id: string;
  code: string;
  status: string;
  reviewStatus?: WorkReviewStatus | null;
  reviewNote?: string | null;
  installedAt?: string | null;
  installedBy?: ApiUser | null;
  plannedModelName?: string | null;
  plannedMachineModel?: {
    name?: string | null;
    displayName?: string | null;
  } | null;
  installedDeviceItems?: Array<{
    itemName?: string | null;
    model?: string | null;
    serialNumber?: string | null;
  }> | null;
  machine?: WorkMachine | null;
  customer?: {
    name?: string | null;
    province?: string | null;
  } | null;
};

type WorkItem = {
  key: string;
  id: string;
  kind: WorkKind;
  code: string;
  title: string;
  status: string;
  date?: string | null;
  engineer?: ApiUser | null;
  createdBy?: ApiUser | null;
  machine?: WorkMachine | null;
  customer?: { name?: string | null; province?: string | null } | null;
  reviewStatus?: WorkReviewStatus | null;
  reviewNote?: string | null;
};

type ReviewAttachment = {
  id: string;
  type: string;
  title?: string | null;
  originalName: string;
  size: number;
  url: string;
  uploadedBy?: {
    fullName?: string | null;
    email?: string | null;
  } | null;
  createdAt?: string | null;
};

type WorkAssignmentsData = {
  engineers: ApiUser[];
  pendingMachines: ReviewMachine[];
  repairs: RepairAssignment[];
  maintenances: MaintenanceAssignment[];
  installations: InstallationAssignment[];
};

type ReviewMachine = {
  id: string;
  machineCode?: string | null;
  serialNumber: string;
  modelName: string;
  manufacturer?: string | null;
  productCategory?: string | null;
  inventoryStatus?: string | null;
  dataStatus?: string | null;
  createdSource?: string | null;
  customer?: {
    name?: string | null;
    hospitalName?: string | null;
    province?: string | null;
  } | null;
  primaryEngineer?: ApiUser | null;
  installedBy?: ApiUser | null;
  createdAt?: string | null;
};

type UsedPartsSummary = {
  totals: {
    parts: number;
    totalCost: number;
    totalRevenue: number;
    grossProfit: number;
    waiting: number;
    used: number;
  };
  byEngineer: Array<{
    engineerId: string;
    engineerName: string;
    quantity: number;
    totalCost: number;
    totalRevenue: number;
    grossProfit: number;
    waiting: number;
    used: number;
  }>;
  parts: Array<{
    id: string;
    name: string;
    quantity: number;
    unitCost?: number | null;
    totalCost?: number | null;
    unitPrice?: number | null;
    totalPrice?: number | null;
    status: 'PLANNED' | 'USED' | 'WAITING' | 'RETURNED';
    task?: { kind: WorkKind; id: string; code: string; title: string } | null;
    createdBy?: { fullName?: string | null; email?: string | null } | null;
  }>;
};

const filterOptions: Array<{ value: WorkFilter; label: string }> = [
  { value: 'action', label: 'Cần xử lý' },
  { value: 'unassigned', label: 'Chưa có kỹ sư' },
  { value: 'review', label: 'Chờ phê duyệt' },
  { value: 'active', label: 'Kỹ sư đang xử lý' },
  { value: 'closed', label: 'Đã hoàn thành' },
  { value: 'all', label: 'Tất cả' },
];

export function AdminWorkAssignmentPage() {
  const queryClient = useQueryClient();
  const [assignmentByKey, setAssignmentByKey] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<WorkFilter>('action');
  const [slaFilter, setSlaFilter] = useState<SlaFilter | null>(null);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [engineerFilter, setEngineerFilter] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [assigningKey, setAssigningKey] = useState('');
  const [reviewingKey, setReviewingKey] = useState('');
  const [reviewNoteByKey, setReviewNoteByKey] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const workAssignmentsQuery = useQuery({
    queryKey: queryKeys.workAssignments.dashboard(debouncedQuery),
    queryFn: async (): Promise<WorkAssignmentsData> => {
      const [userResult, repairResult, maintenanceResult, installationResult, pendingMachineResult] = await Promise.all([
        apiFetchAllPages<ApiUser>('/users?status=ACTIVE'),
        apiFetchAllPages<RepairAssignment>(withQueryParams('/repairs', { search: debouncedQuery })),
        apiFetchAllPages<MaintenanceAssignment>(withQueryParams('/maintenance', { search: debouncedQuery })),
        apiFetchAllPages<InstallationAssignment>(withQueryParams('/installations', { search: debouncedQuery })),
        apiFetch<Paginated<ReviewMachine> | ReviewMachine[]>(withQueryParams('/machines?limit=12&dataStatus=PENDING_REVIEW', { search: debouncedQuery })),
      ]);

      const nextRepairs = unpack(repairResult);
      const nextMaintenances = unpack(maintenanceResult);
      const nextInstallations = unpack(installationResult);

      return {
        engineers: userResult.filter(isTechnicalUser),
        pendingMachines: unpack(pendingMachineResult),
        repairs: nextRepairs,
        maintenances: nextMaintenances,
        installations: nextInstallations,
      };
    },
  });

  const currentMonthRange = useMemo(() => {
    const now = new Date();
    return {
      from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: toDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }, []);
  const usedPartsSummaryQuery = useQuery({
    queryKey: ['work-operations', 'used-parts-summary', currentMonthRange.from, currentMonthRange.to],
    queryFn: () => apiFetch<UsedPartsSummary>(`/work-operations/used-parts/summary?from=${currentMonthRange.from}&to=${currentMonthRange.to}`),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const engineers = workAssignmentsQuery.data?.engineers ?? [];
  const pendingMachines = workAssignmentsQuery.data?.pendingMachines ?? [];
  const repairs = workAssignmentsQuery.data?.repairs ?? [];
  const maintenances = workAssignmentsQuery.data?.maintenances ?? [];
  const installations = workAssignmentsQuery.data?.installations ?? [];
  const loading = workAssignmentsQuery.isLoading || workAssignmentsQuery.isFetching;
  const error = formError || (workAssignmentsQuery.error instanceof Error ? workAssignmentsQuery.error.message : '');

  useEffect(() => {
    setAssignmentByKey(buildAssignmentMap(repairs, maintenances, installations));
  }, [installations, maintenances, repairs]);

  const assignMutation = useMutation({
    mutationFn: async ({ engineerId, item }: { engineerId: string; item: WorkItem }) => {
      const endpoint =
        item.kind === 'repair'
          ? `/repairs/${item.id}/assign`
          : item.kind === 'maintenance'
            ? `/maintenance/${item.id}/assign`
            : `/installations/${item.id}`;

      await apiFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(
          item.kind === 'installation' ? { installedById: engineerId } : { engineerId },
        ),
      });

      return item;
    },
    onSuccess: async (item) => {
      setSuccess(`Đã phân ${kindLabel(item.kind).toLowerCase()} ${item.code} cho kỹ sư.`);
      await queryClient.invalidateQueries({ queryKey: ['work-assignments', 'dashboard'] });
    },
    onSettled: () => setAssigningKey(''),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ item, reviewNote, status }: { item: WorkItem; reviewNote: string; status: Extract<WorkReviewStatus, 'APPROVED' | 'NEEDS_REVISION'> }) => {
      const endpoint =
        item.kind === 'repair'
          ? `/repairs/${item.id}/review`
          : item.kind === 'maintenance'
            ? `/maintenance/${item.id}/review`
            : `/installations/${item.id}/review`;

      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ status, reviewNote: reviewNote || null }),
      });

      return { item, status };
    },
    onSuccess: async ({ item, status }) => {
      const deleteRequest = isDeleteRequest(item);
      setSuccess(
        status === 'APPROVED'
          ? deleteRequest
            ? `Đã phê duyệt yêu cầu xóa phiếu ${item.code}.`
            : `Đã phê duyệt hồ sơ ${item.code}.`
          : deleteRequest
            ? `Đã từ chối yêu cầu xóa ${item.code}.`
            : `Đã trả ${item.code} về kỹ sư bổ sung.`,
      );
      setReviewNoteByKey((current) => ({ ...current, [item.key]: '' }));
      await queryClient.invalidateQueries({ queryKey: ['work-assignments', 'dashboard'] });
    },
    onSettled: () => setReviewingKey(''),
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const allItems = useMemo(() => buildWorkItems(repairs, maintenances, installations), [installations, maintenances, repairs]);

  const items = useMemo(() => {
    return allItems
      .filter((item) => {
        if (slaFilter === 'overdue') return slaStateForItem(item) === 'overdue';
        if (slaFilter === 'due-soon') return slaStateForItem(item) === 'due-soon';
        if (slaFilter === 'waiting-parts') return item.status === 'WAITING_PARTS';
        if (filter === 'action') return !item.engineer?.id || item.reviewStatus === 'PENDING';
        if (filter === 'unassigned') return !item.engineer?.id;
        if (filter === 'review') return item.reviewStatus === 'PENDING';
        if (filter === 'active') return !isClosed(item.status) && Boolean(item.engineer?.id) && item.reviewStatus !== 'PENDING';
        if (filter === 'closed') return isClosed(item.status) && Boolean(item.engineer?.id) && item.reviewStatus !== 'PENDING';
        return true;
      })
      .filter((item) => kindFilter === 'all' || item.kind === kindFilter)
      .filter((item) => {
        if (!engineerFilter) return true;
        if (engineerFilter === '__unassigned') return !item.engineer?.id;
        return item.engineer?.id === engineerFilter;
      })
      .sort((left, right) => actionRank(left) - actionRank(right) || dateRank(right) - dateRank(left) || left.code.localeCompare(right.code));
  }, [allItems, engineerFilter, filter, kindFilter, slaFilter]);

  async function assignWork(item: WorkItem) {
    const engineerId = assignmentByKey[item.key];
    if (!engineerId) {
      setFormError('Vui lòng chọn kỹ sư trước khi phân việc.');
      return;
    }

    setAssigningKey(item.key);
    setFormError('');
    setSuccess('');

    try {
      await assignMutation.mutateAsync({ engineerId, item });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không phân việc được.');
    }
  }

  async function reviewWork(item: WorkItem, status: Extract<WorkReviewStatus, 'APPROVED' | 'NEEDS_REVISION'>) {
    const reviewNote = (reviewNoteByKey[item.key] || '').trim();
    if (status === 'NEEDS_REVISION' && !reviewNote) {
      setFormError('Vui lòng nhập nội dung cần kỹ sư bổ sung.');
      return;
    }

    setReviewingKey(item.key);
    setFormError('');
    setSuccess('');

    try {
      await reviewMutation.mutateAsync({ item, reviewNote, status });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định.';
      setFormError(`Không duyệt được phiếu ${item.code}: ${message}`);
    }
  }

  const assignedActiveCount =
    repairs.filter((item) => !isClosed(item.status) && Boolean(item.engineer?.id) && item.reviewStatus !== 'PENDING').length +
    maintenances.filter((item) => !isClosed(item.status) && Boolean(item.engineer?.id) && item.reviewStatus !== 'PENDING').length +
    installations.filter((item) => !isClosed(item.status) && Boolean(item.installedBy?.id) && item.reviewStatus !== 'PENDING').length;
  const unassignedCount =
    repairs.filter((item) => !item.engineer?.id).length +
    maintenances.filter((item) => !item.engineer?.id).length +
    installations.filter((item) => !item.installedBy?.id).length;
  const pendingReviewCount =
    repairs.filter((item) => item.reviewStatus === 'PENDING').length +
    maintenances.filter((item) => item.reviewStatus === 'PENDING').length +
    installations.filter((item) => item.reviewStatus === 'PENDING').length;
  const closedCount =
    repairs.filter((item) => isClosed(item.status) && Boolean(item.engineer?.id) && item.reviewStatus !== 'PENDING').length +
    maintenances.filter((item) => isClosed(item.status) && Boolean(item.engineer?.id) && item.reviewStatus !== 'PENDING').length +
    installations.filter((item) => isClosed(item.status) && Boolean(item.installedBy?.id) && item.reviewStatus !== 'PENDING').length;
  const actionCount = unassignedCount + pendingReviewCount;
  const filterCounts: Record<WorkFilter, number> = {
    action: actionCount,
    unassigned: unassignedCount,
    review: pendingReviewCount,
    active: assignedActiveCount,
    closed: closedCount,
    all: repairs.length + maintenances.length + installations.length,
  };
  const slaSummary = useMemo(() => buildSlaSummary(allItems), [allItems]);
  const currentFilterLabel = slaFilter
    ? { overdue: 'Đã quá mốc nhắc', 'due-soon': 'Gần mốc nhắc', 'waiting-parts': 'Đang chờ linh kiện' }[slaFilter]
    : filterOptions.find((option) => option.value === filter)?.label ?? 'Công việc';
  const groupedItems = useMemo(() => groupWorkItems(items, filter), [filter, items]);
  const engineerLoads = useMemo(() => buildEngineerLoads(engineers, [
    ...repairs.map((item): WorkItem => ({
      key: `repair:${item.id}`,
      id: item.id,
      kind: 'repair',
      code: item.code,
      title: item.title,
      status: item.status,
      date: item.reportedAt,
      engineer: item.engineer,
      createdBy: item.createdBy,
      machine: item.machine,
      customer: item.machine?.customer,
      reviewStatus: item.reviewStatus,
      reviewNote: item.reviewNote,
    })),
    ...maintenances.map((item): WorkItem => ({
      key: `maintenance:${item.id}`,
      id: item.id,
      kind: 'maintenance',
      code: item.code,
      title: item.title,
      status: item.status,
      date: item.scheduledDate,
      engineer: item.engineer,
      machine: item.machine,
      customer: item.machine?.customer,
      reviewStatus: item.reviewStatus,
      reviewNote: item.reviewNote,
    })),
    ...installations.map((item): WorkItem => ({
      key: `installation:${item.id}`,
      id: item.id,
      kind: 'installation',
      code: item.code,
      title: installationTitle(item),
      status: item.status,
      date: item.installedAt,
      engineer: item.installedBy,
      machine: item.machine,
      customer: item.customer ?? item.machine?.customer,
      reviewStatus: item.reviewStatus,
      reviewNote: item.reviewNote,
    })),
  ]), [engineers, installations, maintenances, repairs]);
  const busiestEngineerCount = Math.max(...engineerLoads.map((engineer) => engineer.active), 1);

  return (
    <PageFrame>
      <section className="relative overflow-hidden rounded-[28px] border border-[#e4e4e7] bg-[#f4f4f5] p-5 shadow-[0_12px_30px_rgba(24,24,27,0.06)] lg:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_7%_12%,rgba(37,99,235,0.11),transparent_30%),radial-gradient(circle_at_92%_18%,rgba(255,255,255,0.94),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.9),rgba(239,246,255,0.78))]" />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <PageTitle
            eyebrow="Điều phối kỹ thuật"
            title="Điều phối & duyệt"
        />
          <button
            className="secondary-button bg-white/90"
            disabled={loading}
            onClick={() => {
              setFormError('');
              setSuccess('');
              void workAssignmentsQuery.refetch();
            }}
            type="button"
          >
            {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
            Làm mới dữ liệu
          </button>
        </div>
        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <button className={summaryCardClass(!slaFilter && filter === 'action')} onClick={() => { setSlaFilter(null); setFilter('action'); }} type="button">
            <span>Cần xử lý</span>
            <strong>{actionCount}</strong>
          </button>
          <button className={summaryCardClass(!slaFilter && filter === 'unassigned')} onClick={() => { setSlaFilter(null); setFilter('unassigned'); }} type="button">
            <span>Chưa có kỹ sư</span>
            <strong>{unassignedCount}</strong>
          </button>
          <button className={summaryCardClass(!slaFilter && filter === 'review')} onClick={() => { setSlaFilter(null); setFilter('review'); }} type="button">
            <span>Chờ phê duyệt</span>
            <strong>{pendingReviewCount}</strong>
          </button>
          <button className={summaryCardClass(!slaFilter && filter === 'active')} onClick={() => { setSlaFilter(null); setFilter('active'); }} type="button">
            <span>Kỹ sư đang xử lý</span>
            <strong>{assignedActiveCount}</strong>
          </button>
          <button className={summaryCardClass(!slaFilter && filter === 'all')} onClick={() => { setSlaFilter(null); setFilter('all'); }} type="button">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              Tất cả
            </span>
            <strong>{filterCounts.all}</strong>
          </button>
        </div>
      </section>

      {error ? <Notice message={error} /> : null}
      {success ? <Notice message={success} /> : null}

      <SlaCommandPanel
        pendingMachinesCount={pendingMachines.length}
        summary={slaSummary}
        onSelect={(selected) => {
          if (selected === 'pending-machines') {
            document.getElementById('pending-machine-review')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
          setFilter('all');
          setSlaFilter(selected);
          window.setTimeout(() => document.getElementById('work-assignment-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
        }}
      />

      <section className="grid min-w-0 gap-5 min-[1420px]:grid-cols-[minmax(0,1fr)_minmax(300px,320px)]" id="work-assignment-list">
        <div className="min-w-0 overflow-hidden rounded-[24px] border border-[#e4e4e7] bg-white shadow-[0_8px_24px_rgba(24,24,27,0.05)]">
          <div className="grid gap-4 border-b border-[#ededf0] bg-[#fafafa] p-4">
            <div className="grid gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-[#1f1f1f]">{currentFilterLabel}</h2>
                {slaFilter ? (
                  <button className="text-xs font-semibold text-[#64748b] underline underline-offset-2" onClick={() => setSlaFilter(null)} type="button">
                    Xóa lọc
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ededf0] bg-white px-3 py-2">
              <span className="text-[13px] font-semibold text-[#666666]">{loading ? 'Đang tải dữ liệu' : `${items.length} việc hiển thị`}</span>
            </div>
            <div className="grid gap-2 min-[861px]:grid-cols-[minmax(260px,1fr)_190px_220px]">
              <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[#d4d4d8] bg-white px-3 text-[#666666] focus-within:border-[#18181b] focus-within:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]">
                <Search size={16} />
                <input
                  className="min-w-0 flex-1 border-0 text-[#1f1f1f] outline-none"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm mã phiếu, S/N, mã máy, khách hàng"
                  value={query}
                />
              </label>
              <select className="form-input h-11" onChange={(event) => setKindFilter(event.target.value as KindFilter)} value={kindFilter}>
                <option value="all">Tất cả loại việc</option>
                <option value="installation">Lắp đặt</option>
                <option value="repair">Sửa chữa</option>
                <option value="maintenance">Bảo trì</option>
              </select>
              <select className="form-input h-11" onChange={(event) => setEngineerFilter(event.target.value)} value={engineerFilter}>
                <option value="">Tất cả kỹ sư</option>
                <option value="__unassigned">Chưa phân kỹ sư</option>
                {engineers.map((engineer) => (
                  <option key={engineer.id} value={engineer.id}>{technicalUserName(engineer)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid">
            {loading ? (
              <div className="flex min-h-40 items-center justify-center gap-2 p-6 text-sm font-semibold text-[#666666]">
                <Loader2 className="spin-icon" size={18} />
                <span>Đang tải danh sách điều phối</span>
              </div>
            ) : null}

            {!loading && items.length === 0 ? (
              <div className="grid min-h-52 place-items-center gap-2 p-8 text-center text-[#666666]">
                <UserCheck size={22} />
                <strong className="text-[#1f1f1f]">Không có công việc phù hợp</strong>
              </div>
            ) : null}

            {!loading ? groupedItems.map((group) => (
              <section className="border-b border-[#ededf0] last:border-b-0" key={group.key}>
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#fafafa] px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1f1f1f]">{group.title}</h3>
                  </div>
                  <span className="rounded-lg border border-[#e4e4e7] bg-white px-2.5 py-1 text-xs font-semibold text-[#18181b]">{group.items.length} việc</span>
                </div>
                {group.items.map((item) => (
                  <WorkDispatchRow
                    assigningKey={assigningKey}
                    assignmentByKey={assignmentByKey}
                    engineers={engineers}
                    item={item}
                    key={item.key}
                    onAssign={assignWork}
                    onReview={reviewWork}
                    onReviewNoteChange={(value) => setReviewNoteByKey((current) => ({ ...current, [item.key]: value }))}
                    onSelectEngineer={(value) => setAssignmentByKey((current) => ({ ...current, [item.key]: value }))}
                    reviewNote={reviewNoteByKey[item.key] ?? ''}
                    reviewingKey={reviewingKey}
                  />
                ))}
              </section>
            )) : null}
          </div>
        </div>

        <aside className="grid min-w-0 content-start gap-4">
          <PendingMachineReviewPanel machines={pendingMachines} />

          <UsedPartsSummaryPanel loading={usedPartsSummaryQuery.isLoading || usedPartsSummaryQuery.isFetching} summary={usedPartsSummaryQuery.data ?? null} />

          <div className="min-w-0 overflow-hidden rounded-[24px] border border-[#e4e4e7] bg-[#f4f4f5] p-4 shadow-[0_18px_48px_rgba(24,24,27,0.08)]">
            <h2 className="text-base font-semibold text-[#1f1f1f]">Số việc theo kỹ sư</h2>
            <div className="mt-4 grid gap-3">
              {engineerLoads.map((engineer) => (
                <button
                  className={`grid gap-2 rounded-2xl border bg-white p-3 text-left transition hover:border-[#e4e4e7] hover:text-[#18181b] ${engineerFilter === engineer.id ? 'border-[#18181b] shadow-[0_10px_24px_rgba(24,24,27,0.10)]' : 'border-[#ededf0]'}`}
                  key={engineer.id}
                  onClick={() => setEngineerFilter(engineer.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate text-sm text-[#1f1f1f]">{engineer.name}</strong>
                    <span className="rounded-full bg-[#fff1f3] px-2 py-1 text-xs font-semibold text-[#b5121b]">{engineer.active} mở</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#f1f2f4]">
                    <div className="h-full rounded-full bg-[#18181b]" style={{ width: `${Math.min(100, (engineer.active / busiestEngineerCount) * 100)}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-[#666666]">
                    <span>{engineer.review} phiếu chờ phê duyệt</span>
                    <span>{engineer.total} tổng</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0 overflow-visible rounded-[20px] border border-[#e4e4e7] bg-white p-4 shadow-[0_10px_26px_rgba(24,24,27,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#c9ead6] bg-[#eefaf3] text-[#177245]">
                  <Archive size={16} />
                </span>
                <div className="min-w-0">
                <h2 className="text-base font-semibold text-[#1f1f1f]">Đã hoàn thành gần đây</h2>
                </div>
              </div>
              <button className="secondary-button px-3 py-2 text-sm" onClick={() => { setSlaFilter(null); setFilter('closed'); }} type="button">
                Mở lọc
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {groupWorkItems(allItems, 'closed').slice(0, 4).map((group) => (
                <div className="rounded-xl border border-[#ededf0] bg-[#fafafa] p-3" key={group.key}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1f1f1f]">{group.title}</p>
                      <p className="mt-1 text-[11px] leading-4 text-[#8a8f99]">{group.items.length} việc trong cụm này</p>
                    </div>
                    <span className="rounded-full bg-[#eefaf3] px-2 py-1 text-[11px] font-semibold text-[#177245]">Xong</span>
                  </div>
                </div>
              ))}
              {closedCount === 0 ? (
                <div className="rounded-xl border border-dashed border-[#e4e4e7] px-3 py-4 text-sm text-[#8a8f99]">
                  Chưa có việc hoàn thành để hiển thị.
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-[20px] border border-[#e4e4e7] bg-white p-4 shadow-[0_10px_26px_rgba(24,24,27,0.05)]">
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-semibold text-[#1f1f1f]">Quy trình duyệt</h2>
              <InfoHint
                content="Phân công kỹ sư → cập nhật hồ sơ → duyệt hoặc trả lại để bổ sung."
                label="Quy trình duyệt"
              />
            </div>
          </div>
        </aside>
      </section>
    </PageFrame>
  );
}

function summaryCardClass(active: boolean) {
  return [
    'grid min-h-[118px] content-between gap-2 rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(24,24,27,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 active:translate-y-0 [&>small]:text-[11px] [&>small]:font-medium [&>small]:leading-4 [&>span]:text-[13px] [&>span]:font-semibold [&>strong]:text-[32px] [&>strong]:font-semibold [&>strong]:leading-none [&>strong]:tabular-nums',
    active
      ? 'border-[#172033] bg-[#172033] shadow-[0_14px_32px_rgba(23,32,51,0.18)] [&>small]:text-white/65 [&>span]:text-white [&>strong]:text-white'
      : 'border-[#e4e4e7] bg-white hover:border-[#94a3b8] [&>small]:text-[#8a8f99] [&>span]:text-[#475569] [&>strong]:text-[#172033]',
  ].join(' ');
}

function SlaCommandPanel({
  pendingMachinesCount,
  summary,
  onSelect,
}: {
  pendingMachinesCount: number;
  summary: ReturnType<typeof buildSlaSummary>;
  onSelect: (filter: SlaFilter | 'pending-machines') => void;
}) {
  const hasRisk = summary.overdue.length || summary.dueSoon.length || summary.waitingParts.length || pendingMachinesCount;
  if (!hasRisk) return null;

  return (
    <section className="grid gap-4 rounded-[24px] border border-[#e4e4e7] bg-white p-4 shadow-[0_8px_24px_rgba(24,24,27,0.05)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff1f3] text-[#b5121b]">
            <AlertTriangle size={18} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-[#1f1f1f]">Việc cần theo dõi sớm</h2>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {summary.overdue.length ? <SlaMetric label="Đã quá mốc nhắc" tone="danger" value={summary.overdue.length} onClick={() => onSelect('overdue')} /> : null}
          {summary.dueSoon.length ? <SlaMetric label="Gần mốc nhắc" tone="warn" value={summary.dueSoon.length} onClick={() => onSelect('due-soon')} /> : null}
          {summary.waitingParts.length ? <SlaMetric label="Đang chờ linh kiện" tone="neutral" value={summary.waitingParts.length} onClick={() => onSelect('waiting-parts')} /> : null}
          {pendingMachinesCount ? <SlaMetric label="Máy chờ xác minh" tone="warn" value={pendingMachinesCount} onClick={() => onSelect('pending-machines')} /> : null}
        </div>
      </div>
    </section>
  );
}

function SlaMetric({ label, tone, value, onClick }: { label: string; tone: Tone; value: number; onClick: () => void }) {
  return (
    <button
      aria-label={`Xem danh sách: ${label} (${value})`}
      className={`w-full cursor-pointer rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 ${slaMetricToneClass(tone)}`}
      onClick={onClick}
      type="button"
    >
      <span className="text-xs font-semibold text-[#666666]">{label}</span>
      <strong className="mt-1 block text-2xl leading-none tabular-nums text-[#1f1f1f]">{value}</strong>
    </button>
  );
}

function UsedPartsSummaryPanel({ loading, summary }: { loading: boolean; summary: UsedPartsSummary | null }) {
  const topParts = summary?.parts.slice(0, 4) ?? [];

  return (
    <div className="min-w-0 overflow-hidden rounded-[24px] border border-[#e4e4e7] bg-white p-4 shadow-[0_18px_48px_rgba(24,24,27,0.08)]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">Vật tư phát sinh</span>
          <h2 className="mt-1 text-base font-semibold text-[#1f1f1f]">Tháng này</h2>
        </div>
        {loading ? <Loader2 className="spin-icon text-[#64748b]" size={17} /> : <PackageCheck className="text-[#177245]" size={18} />}
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-3 gap-2">
        <MiniMetric label="Linh kiện" value={summary?.totals.parts ?? 0} />
        <MiniMetric label="Chờ" value={summary?.totals.waiting ?? 0} />
        <MiniMetric label="Doanh thu" value={formatMoney(summary?.totals.totalRevenue ?? 0)} />
      </div>

      <div className="mt-3 grid gap-2">
        {summary?.byEngineer.slice(0, 3).map((engineer) => (
          <div className="min-w-0 rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-2.5" key={engineer.engineerId}>
            <div className="flex items-center justify-between gap-2 text-sm font-bold text-[#18181b]">
              <span className="min-w-0 truncate">{engineer.engineerName}</span>
              <span className="shrink-0">{formatMoney(engineer.totalRevenue)}</span>
            </div>
            <p className="mt-1 text-xs font-semibold text-[#666666]">{engineer.quantity} SL · lãi {formatMoney(engineer.grossProfit)}</p>
          </div>
        ))}
        {!loading && !summary?.byEngineer.length ? (
          <div className="rounded-xl border border-dashed border-[#d6d6d6] bg-[#fafafa] p-3 text-sm font-semibold text-[#666666]">
            Chưa có vật tư phát sinh trong tuần.
          </div>
        ) : null}
      </div>

      {topParts.length ? (
        <div className="mt-3 grid gap-1.5 border-t border-[#eeeeee] pt-3">
          {topParts.map((part) => (
            <div className="min-w-0 break-words text-xs font-semibold leading-5 text-[#666666]" key={part.id}>
              <span className="text-[#18181b]">{part.name}</span> · {part.task?.code || 'Chưa rõ phiếu'} · {part.status === 'WAITING' ? 'Chờ linh kiện' : 'Đã dùng'}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid min-w-0 gap-1 rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-2 text-center">
      <strong className="min-w-0 break-words text-[15px] text-[#18181b]">{value}</strong>
      <span className="text-[11px] font-bold text-[#64748b]">{label}</span>
    </div>
  );
}

function PendingMachineReviewPanel({ machines }: { machines: ReviewMachine[] }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[24px] border border-[#efd8a8] bg-[#fff8ed] p-4 shadow-[0_12px_30px_rgba(24,24,27,0.06)]" id="pending-machine-review">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-[#9b5a17]">Xác minh dữ liệu</span>
          <h2 className="mt-1 text-base font-semibold text-[#1f1f1f]">Máy do kỹ sư đăng ký, chờ xác minh</h2>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#9b5a17]">{machines.length}</span>
      </div>

      <div className="mt-3 grid gap-2">
        {machines.map((machine) => {
          const gaps = machineReviewGaps(machine);
          const customerName = machine.customer?.name || machine.customer?.hospitalName;
          return (
            <article className="grid gap-3 rounded-2xl border border-[#efd8a8] bg-white p-3" key={machine.id}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[#9b5a17]">
                  <span>{machine.createdSource === 'ENGINEER' ? 'Kỹ sư tạo' : machine.createdSource || 'Chờ xác minh'}</span>
                  {machine.createdAt ? <span>{formatDate(machine.createdAt)}</span> : null}
                </div>
                <h3 className="mt-1 break-words text-sm font-semibold leading-snug text-[#1f1f1f]">{machine.serialNumber}</h3>
                <p className="mt-1 break-words text-xs leading-5 text-[#666666]">
                  {[machine.machineCode, machine.modelName, customerName, machine.customer?.province].filter(Boolean).join(' - ') || 'Chưa có thông tin khách hàng'}
                </p>
              </div>
              {gaps.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {gaps.slice(0, 3).map((gap) => (
                    <span className="rounded-full bg-[#fff8ed] px-2 py-1 text-[11px] font-semibold text-[#9b5a17]" key={gap}>{gap}</span>
                  ))}
                  {gaps.length > 3 ? <span className="rounded-full bg-[#f4f4f5] px-2 py-1 text-[11px] font-semibold text-[#666666]">+{gaps.length - 3}</span> : null}
                </div>
              ) : (
                <span className="rounded-full bg-[#eefaf3] px-2 py-1 text-[11px] font-semibold text-[#177245]">Đủ thông tin chính</span>
              )}
              <div className="flex flex-wrap gap-2">
                <Link className="primary-button compact" to={`/technical-machines/${machine.id}`}>
                  <Eye size={15} />
                  Mở hồ sơ
                </Link>
                <Link className="secondary-button compact" to={`/technical-machines/${machine.id}/edit`}>
                  <ClipboardCheck size={15} />
                  Xác minh
                </Link>
              </div>
            </article>
          );
        })}
        {!machines.length ? (
          <div className="rounded-2xl border border-dashed border-[#efd8a8] bg-white/70 px-3 py-4 text-sm text-[#9b5a17]">
            Không có máy nào đang chờ xác minh.
          </div>
        ) : null}
      </div>
    </section>
  );
}

const metaClass = 'flex flex-wrap items-center gap-[7px] text-[13px] text-[#666666] [&>span]:[overflow-wrap:anywhere]';

function WorkDispatchRow({
  assigningKey,
  assignmentByKey,
  engineers,
  item,
  onAssign,
  onReview,
  onReviewNoteChange,
  onSelectEngineer,
  reviewNote,
  reviewingKey,
}: {
  assigningKey: string;
  assignmentByKey: Record<string, string>;
  engineers: ApiUser[];
  item: WorkItem;
  onAssign: (item: WorkItem) => void;
  onReview: (item: WorkItem, status: Extract<WorkReviewStatus, 'APPROVED' | 'NEEDS_REVISION'>) => void;
  onReviewNoteChange: (value: string) => void;
  onSelectEngineer: (value: string) => void;
  reviewNote: string;
  reviewingKey: string;
}) {
  const closed = isClosed(item.status);
  const pendingReview = item.reviewStatus === 'PENDING';
  const deleteRequest = isDeleteRequest(item);
  const lockedAssignment = closed || pendingReview;
  const workflowTone = workTone(item);
  const workflowLabel = closed ? 'Hoàn tất' : deleteRequest ? 'Chờ phê duyệt yêu cầu xóa' : pendingReview ? 'Chờ phê duyệt' : 'Đang xử lý';

  return (
    <article className={`grid min-w-0 items-start gap-3.5 border-b border-[#ededf0] px-4 py-4 last:border-b-0 ${pendingReview
      ? 'grid-cols-[42px_minmax(0,1fr)]'
      : '[grid-template-columns:42px_minmax(0,1fr)] min-[821px]:[grid-template-columns:42px_minmax(0,1fr)_minmax(220px,300px)] min-[1181px]:[grid-template-columns:42px_minmax(0,1fr)_minmax(130px,190px)_minmax(220px,280px)]'
    } ${workRowClass(workflowTone)}`}>
      <div className={kindIconClass(item.kind)}>{kindIcon(item.kind)}</div>
      <div className="grid min-w-0 gap-[7px]">
        <div className={metaClass}>
          <span>{kindLabel(item.kind)}</span>
          <span>{item.code}</span>
          {item.date ? <span>{formatDate(item.date)}</span> : null}
          {item.createdBy?.fullName ? <span>Người tạo: {item.createdBy.fullName}</span> : null}
        </div>
        <h2 className="[overflow-wrap:anywhere] text-[17px] font-semibold text-[#1f1f1f]">{item.title}</h2>
        <div className={metaClass}>
          <span>{machineText(item)}</span>
          <span>{customerText(item)}</span>
        </div>
      </div>
      <div className={`${pendingReview ? 'col-start-2 flex min-w-0 flex-wrap items-center gap-2' : 'col-span-full grid min-w-0 justify-items-start gap-2 min-[821px]:col-start-2 min-[821px]:col-span-1 min-[1181px]:col-auto'}`}>
        {actionLabel(item) ? (
          <span className={badgeClass(actionTone(item))}>
            <span className={badgeDotClass(actionTone(item))} />
            {actionLabel(item)}
          </span>
        ) : null}
        <span className={badgeClass(statusTone(item.status, item.reviewStatus))}>
          <span className={badgeDotClass(statusTone(item.status, item.reviewStatus))} />
          {statusLabel(item.status)}
        </span>
        {item.reviewStatus && item.reviewStatus !== 'NOT_REQUIRED' ? (
          <span className={badgeClass(reviewStatusTone(item.reviewStatus))}>
            <span className={badgeDotClass(reviewStatusTone(item.reviewStatus))} />
            {reviewStatusLabel(item.reviewStatus)}
          </span>
        ) : null}
        <span className="[overflow-wrap:anywhere] text-[13px] font-semibold text-[#333333]">
          {item.engineer?.fullName || item.engineer?.email || 'Chưa có kỹ sư'}
        </span>
      </div>
      <div className={`${pendingReview ? 'col-span-full grid min-w-0 gap-3' : 'col-span-full grid gap-2.5 min-[821px]:col-start-3 min-[821px]:col-span-1 min-[821px]:row-span-2 min-[821px]:row-start-1 min-[1181px]:col-auto min-[1181px]:row-auto'}`}>
        {pendingReview ? null : lockedAssignment ? (
          <div className={`grid gap-2 rounded-2xl border px-3 py-3 ${closed ? 'border-[#c9ead6] bg-[#eefaf3]' : 'border-[#efd8a8] bg-[#fff8ed]'}`}>
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-white ${closed ? 'text-[#177245]' : 'text-[#9b5a17]'}`}>
                {closed ? <CheckCircle2 size={15} /> : <Archive size={15} />}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${closed ? 'text-[#177245]' : 'text-[#9b5a17]'}`}>{workflowLabel}</p>
                <p className="text-[11px] leading-4 text-[#7b7b7b]">
                  {closed ? 'Đã khóa thao tác' : deleteRequest ? 'Đang chờ quản trị viên phê duyệt yêu cầu xóa' : 'Đang chờ phê duyệt hồ sơ kỹ thuật'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold ${closed ? 'text-[#177245]' : 'text-[#9b5a17]'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${closed ? 'bg-[#12b76a]' : 'bg-[#f79009]'}`} />
                {workflowLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#666666]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8a8a8a]" />
                {closed ? 'Khoá phân công' : 'Tạm khoá'}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid min-w-0 gap-2 max-[560px]:grid-cols-1 min-[561px]:grid-cols-[minmax(0,1fr)_auto] min-[821px]:grid-cols-1 min-[1181px]:grid-cols-[minmax(0,1fr)_auto]">
            <select
              aria-label={`Chọn kỹ sư cho ${item.code}`}
              className="form-input h-10 min-w-0"
              onChange={(event) => onSelectEngineer(event.target.value)}
              value={assignmentByKey[item.key] ?? ''}
            >
              <option value="">Chọn kỹ sư</option>
              {engineers.map((engineer) => (
                <option key={engineer.id} value={engineer.id}>
                  {technicalUserName(engineer)}
                </option>
              ))}
            </select>
            <button
              className="primary-button w-full min-[561px]:w-auto min-[821px]:w-full min-[1181px]:w-auto"
              disabled={!assignmentByKey[item.key] || assigningKey === item.key}
              onClick={() => onAssign(item)}
              type="button"
            >
              {assigningKey === item.key ? <Loader2 className="spin-icon" size={16} /> : <UserCheck size={16} />}
              Phân công
            </button>
          </div>
        )}
        {pendingReview ? (
          <div className="col-span-full grid min-w-0 gap-3 rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-3 min-[900px]:grid-cols-2">
            <ReviewAttachmentsPanel item={item} />
            <QualityReviewChecklist item={item} />
            <textarea
              className="form-input min-h-16 min-[900px]:col-span-2"
              onChange={(event) => onReviewNoteChange(event.target.value)}
              placeholder={deleteRequest ? 'Ghi chú nếu không duyệt xóa' : 'Ghi chú nếu trả kỹ sư bổ sung'}
              value={reviewNote}
            />
            <div className="flex flex-wrap justify-end gap-2 min-[900px]:col-span-2">
              <button className="secondary-button" disabled={reviewingKey === item.key} onClick={() => onReview(item, 'NEEDS_REVISION')} type="button">
                {deleteRequest ? 'Từ chối yêu cầu xóa' : 'Yêu cầu bổ sung'}
              </button>
              <button className="primary-button" disabled={reviewingKey === item.key} onClick={() => onReview(item, 'APPROVED')} type="button">
                {reviewingKey === item.key ? 'Đang lưu' : deleteRequest ? 'Phê duyệt xóa' : 'Phê duyệt hồ sơ'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function QualityReviewChecklist({ item }: { item: WorkItem }) {
  const scope = item.kind === 'installation' ? 'installation' : item.kind === 'maintenance' ? 'maintenance' : 'repair';
  const checks = checklistForCategory(item.machine?.productCategory || item.machine?.modelName || item.title, 'review');

  return (
    <div className="grid gap-2 rounded-lg border border-[#dbe5ef] bg-white p-3">
      <div>
        <strong className="text-sm text-[#1f1f1f]">Điểm cần kiểm tra trước khi xác nhận</strong>
      </div>
      <div className="grid gap-1.5">
        {checks.map((check) => (
          <label className="flex items-start gap-2 rounded-md bg-[#fafafa] px-2.5 py-2 text-xs leading-5 text-[#333333]" key={`${scope}-${check}`}>
            <input className="mt-1" type="checkbox" />
            <span>{check}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ReviewAttachmentsPanel({ item }: { item: WorkItem }) {
  const entityType = attachmentEntityType(item.kind);
  const attachmentsQuery = useQuery({
    enabled: item.reviewStatus === 'PENDING',
    queryKey: ['review-attachments', entityType, item.id],
    queryFn: async () => {
      const result = await apiFetch<Paginated<ReviewAttachment>>(`/attachments?entityType=${entityType}&entityId=${item.id}&limit=100`);
      return result.data ?? [];
    },
  });
  const attachments = attachmentsQuery.data ?? [];

  return (
    <div className="grid gap-2 rounded-lg border border-[#dbe5ef] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <strong className="text-sm text-[#1f1f1f]">Ảnh và tài liệu kỹ sư đã tải lên</strong>
        </div>
        <span className="rounded-full bg-[#f4f4f5] px-2.5 py-1 text-xs font-semibold text-[#18181b]">
          {attachmentsQuery.isLoading ? '...' : attachments.length}
        </span>
      </div>

      {attachmentsQuery.isLoading ? (
        <div className="flex min-h-14 items-center gap-2 rounded-lg border border-dashed border-[#d6d6d6] bg-[#fafafa] p-3 text-sm text-[#666666]">
          <Loader2 className="spin-icon" size={16} />
          Đang tải tài liệu...
        </div>
      ) : null}

      {!attachmentsQuery.isLoading && attachments.length ? (
        <div className="grid gap-2">
          {attachments.map((attachment) => (
            <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-[#eeeeee] bg-[#fafafa] p-2.5" key={attachment.id}>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-[#666666]">{attachment.type}</span>
                <strong className="mt-0.5 block truncate text-sm text-[#1f1f1f]">{attachment.title || attachment.originalName}</strong>
                <small className="block truncate text-xs text-[#666666]">
                  {[attachment.originalName, formatAttachmentSize(attachment.size), attachment.uploadedBy?.fullName || attachment.uploadedBy?.email].filter(Boolean).join(' - ')}
                </small>
              </div>
              <div className="flex gap-2">
                <button className="secondary-button compact" onClick={() => void viewReviewAttachment(attachment)} type="button">
                  Xem
                </button>
                <button className="secondary-button compact" onClick={() => void downloadReviewAttachment(attachment)} type="button">
                  Tải
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {!attachmentsQuery.isLoading && !attachments.length ? (
        <div className="rounded-lg border border-dashed border-[#e4e4e7] bg-[#fafafa] px-3 py-3 text-sm text-[#666666]">
          Chưa có ảnh hoặc tài liệu đính kèm cho phiếu này.
        </div>
      ) : null}
    </div>
  );
}

function groupWorkItems(items: WorkItem[], filter: WorkFilter) {
  const groups = [
    {
      key: 'review',
      title: 'Chờ phê duyệt hồ sơ',
      items: items.filter((item) => item.reviewStatus === 'PENDING').sort(compareWorkItemsByDateDesc),
    },
    {
      key: 'unassigned',
      title: 'Chưa phân kỹ sư',
      items: items.filter((item) => !item.engineer?.id).sort(compareWorkItemsByDateDesc),
    },
    {
      key: 'active',
      title: 'Đang thực hiện',
      items: items.filter((item) => item.engineer?.id && item.reviewStatus !== 'PENDING' && !isClosed(item.status)).sort(compareWorkItemsByDateDesc),
    },
    {
      key: 'closed',
      title: 'Đã đóng',
      items: items.filter((item) => item.engineer?.id && item.reviewStatus !== 'PENDING' && isClosed(item.status)).sort(compareWorkItemsByDateDesc),
    },
  ];

  const visibleGroups =
    filter === 'review'
      ? groups.filter((group) => group.key === 'review' && group.items.length)
      : filter === 'unassigned'
        ? groups.filter((group) => group.key === 'unassigned' && group.items.length)
        : filter === 'active'
          ? groups.filter((group) => group.key === 'active' && group.items.length)
          : filter === 'closed'
            ? groups.filter((group) => group.key === 'closed' && group.items.length)
          : filter === 'action'
            ? groups.filter((group) => ['review', 'unassigned'].includes(group.key) && group.items.length)
            : groups.filter((group) => group.items.length);

  return visibleGroups.flatMap(splitWorkGroupByDate);
}

function splitWorkGroupByDate(group: { key: string; title: string; items: WorkItem[] }) {
  const dateGroups = new Map<string, WorkItem[]>();

  group.items.forEach((item) => {
    const key = workDateGroupKey(item);
    dateGroups.set(key, [...(dateGroups.get(key) ?? []), item]);
  });

  return Array.from(dateGroups.entries())
    .sort(([left], [right]) => compareWorkGroupDateKeys(left, right))
    .map(([dateKey, items]) => ({
      key: `${group.key}:${dateKey}`,
      title: dateKey === '__missing__' ? `${group.title} · Chưa có ngày` : `${group.title} · ${formatDate(dateKey)}`,
      items: items.sort(compareWorkItemsByDateDesc),
    }));
}

function workDateGroupKey(item: WorkItem) {
  if (!item.date) return '__missing__';
  const date = new Date(item.date);
  if (Number.isNaN(date.getTime())) return '__missing__';
  return date.toISOString().slice(0, 10);
}

function compareWorkGroupDateKeys(left: string, right: string) {
  if (left === '__missing__') return 1;
  if (right === '__missing__') return -1;
  return right.localeCompare(left);
}

function compareWorkItemsByDateDesc(left: WorkItem, right: WorkItem) {
  return dateRank(right) - dateRank(left) || left.code.localeCompare(right.code);
}

function buildWorkItems(repairs: RepairAssignment[], maintenances: MaintenanceAssignment[], installations: InstallationAssignment[]) {
  return [
    ...repairs.map((item) => ({
      key: `repair:${item.id}`,
      id: item.id,
      kind: 'repair' as const,
      code: item.code,
      title: item.title,
      status: item.status,
      date: item.reportedAt,
      engineer: item.engineer,
      createdBy: item.createdBy,
      machine: item.machine,
      customer: item.machine?.customer,
      reviewStatus: item.reviewStatus,
      reviewNote: item.reviewNote,
    })),
    ...maintenances.map((item) => ({
      key: `maintenance:${item.id}`,
      id: item.id,
      kind: 'maintenance' as const,
      code: item.code,
      title: item.title,
      status: item.status,
      date: item.scheduledDate,
      engineer: item.engineer,
      machine: item.machine,
      customer: item.machine?.customer,
      reviewStatus: item.reviewStatus,
      reviewNote: item.reviewNote,
    })),
    ...installations.map((item) => ({
      key: `installation:${item.id}`,
      id: item.id,
      kind: 'installation' as const,
      code: item.code,
      title: installationTitle(item),
      status: item.status,
      date: item.installedAt,
      engineer: item.installedBy,
      machine: item.machine,
      customer: item.customer ?? item.machine?.customer,
      reviewStatus: item.reviewStatus,
      reviewNote: item.reviewNote,
    })),
  ] satisfies WorkItem[];
}

function buildEngineerLoads(engineers: ApiUser[], items: WorkItem[]) {
  return engineers
    .map((engineer) => {
      const relatedItems = items.filter((item) => item.engineer?.id === engineer.id);
      return {
        id: engineer.id,
        name: technicalUserName(engineer),
        total: relatedItems.length,
        active: relatedItems.filter((item) => !isClosed(item.status)).length,
        review: relatedItems.filter((item) => item.reviewStatus === 'PENDING').length,
      };
    })
    .sort((left, right) => right.active - left.active || right.review - left.review || left.name.localeCompare(right.name));
}

function actionRank(item: WorkItem) {
  if (item.reviewStatus === 'PENDING') return 0;
  if (!item.engineer?.id) return 1;
  if (!isClosed(item.status)) return 2;
  return 3;
}

function dateRank(item: WorkItem) {
  if (!item.date) return 0;
  const date = new Date(item.date);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function actionLabel(item: WorkItem) {
  const slaState = slaStateForItem(item);
  if (slaState === 'overdue') return 'Đã quá mốc nhắc';
  if (slaState === 'due-soon') return 'Gần mốc nhắc';
  if (isDeleteRequest(item)) return 'Cần duyệt xóa phiếu';
  if (item.reviewStatus === 'PENDING') return 'Cần xác nhận báo cáo';
  if (item.reviewStatus === 'APPROVED' && isClosed(item.status)) return 'Đã hoàn tất';
  if (item.reviewStatus === 'APPROVED') return 'Đã phê duyệt';
  if (!item.engineer?.id) return 'Cần phân công';
  if (!isClosed(item.status)) return 'Đang theo dõi';
  return '';
}

function actionTone(item: WorkItem): Tone {
  const slaState = slaStateForItem(item);
  if (slaState === 'overdue') return 'danger';
  if (slaState === 'due-soon') return 'warn';
  if (isDeleteRequest(item)) return 'danger';
  if (item.reviewStatus === 'PENDING') return 'warn';
  if (item.reviewStatus === 'APPROVED') return 'good';
  if (!item.engineer?.id) return 'danger';
  if (!isClosed(item.status)) return 'neutral';
  return 'good';
}

function kindIconClass(kind: WorkKind) {
  const base = 'flex h-[42px] w-[42px] items-center justify-center rounded-lg border';
  const tones: Record<WorkKind, string> = {
    repair: 'border-[#e4e4e7] bg-[#f4f4f5] text-[#18181b]',
    maintenance: 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]',
    installation: 'border-[#e4e4e7] bg-[#f4f4f5] text-[#18181b]',
  };
  return `${base} ${tones[kind]}`;
}

function badgeClass(tone: Tone) {
  const base = 'inline-flex min-h-7 items-center gap-[7px] whitespace-nowrap rounded-full border px-2.5 py-[7px] text-xs font-medium';
  const tones: Record<Tone, string> = {
    good: 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]',
    warn: 'border-[#efd8a8] bg-[#fff8ed] text-[#9b5a17]',
    danger: 'border-[#fecdd3] bg-[#fff1f3] text-[#b5121b]',
    neutral: 'border-[#e5e5e5] bg-[#f4f7fb] text-[#333333]',
  };
  return `${base} ${tones[tone]}`;
}

function badgeDotClass(tone: Tone) {
  const tones: Record<Tone, string> = {
    good: 'bg-[#12b76a]',
    warn: 'bg-[#f79009]',
    danger: 'bg-[#f04438]',
    neutral: 'bg-[#8a8a8a]',
  };
  return `h-[7px] w-[7px] rounded-full ${tones[tone]}`;
}

function unpack<T>(result: Paginated<T> | T[]) {
  return Array.isArray(result) ? result : result.data ?? [];
}

function withQueryParams(endpoint: string, params: Record<string, string>) {
  const [path, query = ''] = endpoint.split('?');
  const searchParams = new URLSearchParams(query);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function buildAssignmentMap(repairs: RepairAssignment[], maintenances: MaintenanceAssignment[], installations: InstallationAssignment[] = []) {
  const map: Record<string, string> = {};

  repairs.forEach((item) => {
    map[`repair:${item.id}`] = item.engineer?.id ?? '';
  });

  maintenances.forEach((item) => {
    map[`maintenance:${item.id}`] = item.engineer?.id ?? '';
  });

  installations.forEach((item) => {
    map[`installation:${item.id}`] = item.installedBy?.id ?? '';
  });

  return map;
}

function installationTitle(item: InstallationAssignment) {
  const deviceItems = item.installedDeviceItems?.filter((device) => device.itemName || device.model || device.serialNumber) ?? [];
  const firstDevice = deviceItems[0];
  const primaryName =
    firstDevice?.itemName ||
    item.machine?.modelName ||
    item.plannedMachineModel?.displayName ||
    item.plannedMachineModel?.name ||
    item.plannedModelName ||
    item.machine?.machineCode ||
    item.machine?.serialNumber ||
    item.code;
  const extraCount = Math.max(0, deviceItems.length - 1);
  return `Lắp đặt ${primaryName}${extraCount ? ` + ${extraCount} thiết bị` : ''}`;
}

function kindLabel(kind: WorkKind) {
  const labels: Record<WorkKind, string> = {
    repair: 'Sửa chữa',
    maintenance: 'Bảo trì',
    installation: 'Lắp đặt',
  };
  return labels[kind];
}

function kindIcon(kind: WorkKind) {
  if (kind === 'repair') return <Wrench size={19} />;
  if (kind === 'maintenance') return <ClipboardCheck size={19} />;
  return <PackageCheck size={19} />;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    PENDING: 'Chờ xử lý',
    ASSIGNED: 'Đã phân công',
    SCHEDULED: 'Đã lên lịch',
    IN_PROGRESS: 'Đang xử lý',
    WAITING_PARTS: 'Chờ linh kiện',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Hủy',
    INSTALLED: 'Đã lắp đặt',
  };
  return labels[value] ?? value;
}

function statusTone(value: string, reviewStatus?: WorkReviewStatus | null): Tone {
  if (['COMPLETED', 'INSTALLED'].includes(value) || reviewStatus === 'APPROVED') return 'good';
  if (['CANCELLED', 'WAITING_PARTS'].includes(value)) return 'danger';
  if (['PENDING', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS'].includes(value)) return 'warn';
  return 'neutral';
}

function workTone(item: WorkItem): Tone {
  if (slaStateForItem(item) === 'overdue') return 'danger';
  if (item.reviewStatus === 'PENDING') return 'warn';
  if (item.reviewStatus === 'APPROVED' || isClosed(item.status)) return 'good';
  if (!item.engineer?.id) return 'danger';
  return 'neutral';
}

function workRowClass(tone: Tone) {
  const styles: Record<Tone, string> = {
    good: 'border-l-[#b9e8ca] bg-[linear-gradient(180deg,#ffffff,#fbfffd)]',
    warn: 'border-l-[#efd8a8] bg-[linear-gradient(180deg,#fffefc,#fffdf8)]',
    danger: 'border-l-[#fecdd3] bg-[linear-gradient(180deg,#ffffff,#fffdfb)]',
    neutral: 'border-l-transparent bg-white',
  };
  return `border-l-4 shadow-[0_1px_0_rgba(24,24,27,0.02)] ${styles[tone]}`;
}

function reviewStatusLabel(value?: WorkReviewStatus | null) {
  if (value === 'PENDING') return 'Chờ phê duyệt';
  if (value === 'APPROVED') return 'Đã phê duyệt';
  if (value === 'NEEDS_REVISION') return 'Cần kỹ sư bổ sung';
  return '';
}

function isDeleteRequest(item: WorkItem) {
  return hasDeleteRequestNote(item);
}

function reviewStatusTone(value?: WorkReviewStatus | null): Tone {
  if (value === 'APPROVED') return 'good';
  if (value === 'NEEDS_REVISION') return 'danger';
  if (value === 'PENDING') return 'warn';
  return 'neutral';
}

function buildSlaSummary(items: WorkItem[]) {
  const openItems = items.filter((item) => !isClosed(item.status));
  return {
    overdue: openItems.filter((item) => slaStateForItem(item) === 'overdue'),
    dueSoon: openItems.filter((item) => slaStateForItem(item) === 'due-soon'),
    waitingParts: openItems.filter((item) => item.status === 'WAITING_PARTS'),
    pendingReview: items.filter((item) => item.reviewStatus === 'PENDING'),
  };
}

function slaStateForItem(item: WorkItem): 'overdue' | 'due-soon' | 'ok' {
  if (isClosed(item.status)) return 'ok';
  if (item.status === 'WAITING_PARTS') return 'ok';
  if (!item.date) return item.engineer?.id ? 'ok' : 'due-soon';

  const ageDays = Math.max(0, Math.floor((Date.now() - dateRank(item)) / 86_400_000));
  const threshold = slaThresholdDays(item);
  if (ageDays > threshold) return 'overdue';
  if (ageDays >= Math.max(0, threshold - 1)) return 'due-soon';
  return 'ok';
}

function slaThresholdDays(item: WorkItem) {
  if (!item.engineer?.id) return 1;
  if (item.kind === 'repair') return 3;
  if (item.kind === 'maintenance') return 1;
  return 2;
}

function slaMetricToneClass(tone: Tone) {
  const tones: Record<Tone, string> = {
    good: 'border-[#b9e8ca] bg-[#eefaf3]',
    warn: 'border-[#efd8a8] bg-[#fff8ed]',
    danger: 'border-[#fecdd3] bg-[#fff1f3]',
    neutral: 'border-[#e5e5e5] bg-[#fafafa]',
  };
  return tones[tone];
}

function machineReviewGaps(machine: ReviewMachine) {
  return [
    !machine.machineCode ? 'Thiếu mã máy' : '',
    !machine.manufacturer ? 'Thiếu hãng' : '',
    !machine.customer ? 'Chưa gắn khách hàng' : '',
    !machine.primaryEngineer && !machine.installedBy ? 'Chưa có kỹ sư phụ trách' : '',
    !machine.productCategory || machine.productCategory === 'OTHER' ? 'Chưa rõ loại thiết bị' : '',
  ].filter(Boolean);
}

function isClosed(status: string) {
  return ['COMPLETED', 'CANCELLED', 'INSTALLED'].includes(status);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

function toDateInput(value: Date) {
  if (Number.isNaN(value.getTime())) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMoney(value: number) {
  if (!value) return '0';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
}

function machineText(item: WorkItem) {
  const machineCode = item.machine?.machineCode;
  const serialNumber = item.machine?.serialNumber;
  const modelName = item.machine?.modelName;
  return [machineCode, modelName, serialNumber ? `S/N ${serialNumber}` : ''].filter(Boolean).join(' - ') || 'Chưa gắn thiết bị';
}

function customerText(item: WorkItem) {
  const customer = item.customer ?? item.machine?.customer;
  return [customer?.name, customer?.province].filter(Boolean).join(' - ') || 'Chưa có khách hàng';
}

function attachmentEntityType(kind: WorkKind) {
  const entityTypes: Record<WorkKind, string> = {
    installation: 'MachineInstallation',
    maintenance: 'Maintenance',
    repair: 'Repair',
  };
  return entityTypes[kind];
}

function formatAttachmentSize(size: number) {
  if (!Number.isFinite(size)) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

async function downloadReviewAttachment(attachment: ReviewAttachment) {
  const token = getToken();
  const response = await fetch(`${getApiBaseUrl()}${attachment.url}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error('Không tải được tài liệu.');
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = attachment.originalName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}

async function viewReviewAttachment(attachment: ReviewAttachment) {
  const token = getToken();
  const response = await fetch(`${getApiBaseUrl()}${attachment.url}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error('Không mở được tài liệu.');
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

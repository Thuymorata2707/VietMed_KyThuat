import { AlertTriangle, Archive, CheckCircle2, ClipboardCheck, Clock3, Eye, Loader2, PackageCheck, RefreshCw, Search, UserCheck, Wrench } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, getApiBaseUrl, getToken } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { checklistForCategory } from '../../config/medicalDeviceChecklists';
import { queryKeys } from '../../lib/queryKeys';
import { isTechnicalUser, technicalUserName } from '../../utils/technicalUsers';

type WorkKind = 'repair' | 'maintenance' | 'installation';
type WorkFilter = 'action' | 'unassigned' | 'review' | 'active' | 'closed' | 'all';
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

const filterOptions: Array<{ value: WorkFilter; label: string }> = [
  { value: 'action', label: 'Cần xử lý' },
  { value: 'unassigned', label: 'Chưa phân' },
  { value: 'review', label: 'Chờ xác nhận' },
  { value: 'active', label: 'Đang thực hiện' },
  { value: 'closed', label: 'Đã hoàn thành' },
  { value: 'all', label: 'Tất cả' },
];

export function AdminWorkAssignmentPage() {
  const queryClient = useQueryClient();
  const [assignmentByKey, setAssignmentByKey] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<WorkFilter>('action');
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
        apiFetch<Paginated<ApiUser> | ApiUser[]>('/users?limit=100&status=ACTIVE'),
        apiFetch<Paginated<RepairAssignment> | RepairAssignment[]>(withQueryParams('/repairs?limit=100', { search: debouncedQuery })),
        apiFetch<Paginated<MaintenanceAssignment> | MaintenanceAssignment[]>(withQueryParams('/maintenance?limit=100', { search: debouncedQuery })),
        apiFetch<Paginated<InstallationAssignment> | InstallationAssignment[]>(withQueryParams('/installations?limit=100', { search: debouncedQuery })),
        apiFetch<Paginated<ReviewMachine> | ReviewMachine[]>(withQueryParams('/machines?limit=12&dataStatus=PENDING_REVIEW', { search: debouncedQuery })),
      ]);

      const nextRepairs = unpack(repairResult);
      const nextMaintenances = unpack(maintenanceResult);
      const nextInstallations = unpack(installationResult);

      return {
        engineers: unpack(userResult).filter(isTechnicalUser),
        pendingMachines: unpack(pendingMachineResult),
        repairs: nextRepairs,
        maintenances: nextMaintenances,
        installations: nextInstallations,
      };
    },
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
      setSuccess(status === 'APPROVED' ? `Đã xác nhận ${item.code}.` : `Đã trả ${item.code} về kỹ sư bổ sung.`);
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
  }, [allItems, engineerFilter, filter, kindFilter]);

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
      setFormError(err instanceof Error ? err.message : 'Không cập nhật kiểm duyệt được.');
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
  const currentFilterLabel = filterOptions.find((option) => option.value === filter)?.label ?? 'Công việc';
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
            description="Phân công, duyệt và trả lại hồ sơ kỹ sư."
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
            Refresh
          </button>
        </div>
        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <button className={summaryCardClass(filter === 'action')} onClick={() => setFilter('action')} type="button">
            <span>Cần xử lý</span>
            <strong>{actionCount}</strong>
            <small>Ưu tiên</small>
          </button>
          <button className={summaryCardClass(filter === 'unassigned')} onClick={() => setFilter('unassigned')} type="button">
            <span>Chưa phân kỹ sư</span>
            <strong>{unassignedCount}</strong>
            <small>Cần phân</small>
          </button>
          <button className={summaryCardClass(filter === 'review')} onClick={() => setFilter('review')} type="button">
            <span>Chờ xác nhận</span>
            <strong>{pendingReviewCount}</strong>
            <small>Chờ duyệt</small>
          </button>
          <button className={summaryCardClass(filter === 'active')} onClick={() => setFilter('active')} type="button">
            <span>Đang thực hiện</span>
            <strong>{assignedActiveCount}</strong>
            <small>Đang chạy</small>
          </button>
          <button className={summaryCardClass(filter === 'closed')} onClick={() => setFilter('closed')} type="button">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              Đã hoàn thành
            </span>
            <strong>{closedCount}</strong>
            <small>Đã xong</small>
          </button>
        </div>
      </section>

      {error ? <Notice message={error} /> : null}
      {success ? <Notice message={success} /> : null}

      <SlaCommandPanel
        pendingMachinesCount={pendingMachines.length}
        summary={slaSummary}
        onShowAction={() => setFilter('action')}
        onShowReview={() => setFilter('review')}
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-[24px] border border-[#e4e4e7] bg-white shadow-[0_8px_24px_rgba(24,24,27,0.05)]">
          <div className="grid gap-4 border-b border-[#ededf0] bg-[#fafafa] p-4">
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold text-[#1f1f1f]">{currentFilterLabel}</h2>
              <p className="text-xs font-medium leading-5 text-[#8a8f99]">{filterDescription(filter)}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-[#e4e4e7] bg-[#f4f4f5] p-1" aria-label="Lọc công việc">
                {filterOptions.map((option) => (
                  <button
                    className={`inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold ${
                      filter === option.value
                        ? 'bg-white text-[#18181b] shadow-[0_8px_20px_rgba(24,24,27,0.10)]'
                        : 'bg-transparent text-[#444444] hover:bg-white/70 hover:text-[#18181b]'
                    }`}
                    key={option.value}
                    onClick={() => setFilter(option.value)}
                    type="button"
                  >
                    {option.label}
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] ${filter === option.value ? 'bg-[#fff1f3] text-[#b5121b]' : 'bg-white text-[#666666]'}`}>
                      {filterCounts[option.value]}
                    </span>
                  </button>
                ))}
              </div>
              <span className="text-[13px] font-semibold text-[#666666]">{loading ? 'Đang tải dữ liệu' : `${items.length} việc đang hiển thị`}</span>
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
                <span className="text-sm">Thử đổi bộ lọc hoặc làm mới dữ liệu.</span>
              </div>
            ) : null}

            {!loading ? groupedItems.map((group) => (
              <section className="border-b border-[#ededf0] last:border-b-0" key={group.key}>
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#fafafa] px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1f1f1f]">{group.title}</h3>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#9aa2ad]">{group.description}</p>
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

        <aside className="grid content-start gap-4">
          <PendingMachineReviewPanel machines={pendingMachines} />

          <div className="rounded-[24px] border border-[#e4e4e7] bg-[#f4f4f5] p-4 shadow-[0_18px_48px_rgba(24,24,27,0.08)]">
            <h2 className="text-base font-semibold text-[#1f1f1f]">Tải việc theo kỹ sư</h2>
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
                    <span>{engineer.review} chờ duyệt</span>
                    <span>{engineer.total} tổng</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[20px] border border-[#e4e4e7] bg-white p-4 shadow-[0_10px_26px_rgba(24,24,27,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#c9ead6] bg-[#eefaf3] text-[#177245]">
                  <Archive size={16} />
                </span>
                <div className="min-w-0">
                <h2 className="text-base font-semibold text-[#1f1f1f]">Đã hoàn thành gần đây</h2>
                <p className="mt-1 text-xs leading-5 text-[#8a8f99]">Xem nhanh các việc đã xong mà không phải kéo xuống cuối.</p>
                </div>
              </div>
              <button className="secondary-button px-3 py-2 text-sm" onClick={() => setFilter('closed')} type="button">
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

          <div className="rounded-[20px] border border-[#e4e4e7] bg-white p-4 shadow-[0_10px_26px_rgba(24,24,27,0.05)]">
            <h2 className="text-base font-semibold text-[#1f1f1f]">Luồng nhanh</h2>
            <div className="mt-3 grid gap-2 text-xs font-medium leading-5 text-[#6f7784]">
              <p><strong>1.</strong> Chọn kỹ sư.</p>
              <p><strong>2.</strong> Kỹ sư xử lý.</p>
              <p><strong>3.</strong> Admin duyệt.</p>
            </div>
          </div>
        </aside>
      </section>
    </PageFrame>
  );
}

function summaryCardClass(active: boolean) {
  return [
    'grid min-h-[106px] gap-1.5 rounded-2xl border bg-white/90 p-4 text-left transition hover:-translate-y-[1px] hover:border-[#18181b] hover:shadow-[0_14px_32px_rgba(24,24,27,0.10)] [&>small]:text-[11px] [&>small]:font-medium [&>small]:leading-4 [&>small]:text-[#8a8f99] [&>span]:text-[13px] [&>span]:font-semibold [&>span]:text-[#666666] [&>strong]:text-[32px] [&>strong]:font-semibold [&>strong]:leading-none [&>strong]:text-[#1f1f1f]',
    active ? 'border-[#18181b] shadow-[0_14px_32px_rgba(24,24,27,0.12)]' : 'border-white/80',
  ].join(' ');
}

function SlaCommandPanel({
  onShowAction,
  onShowReview,
  pendingMachinesCount,
  summary,
}: {
  onShowAction: () => void;
  onShowReview: () => void;
  pendingMachinesCount: number;
  summary: ReturnType<typeof buildSlaSummary>;
}) {
  const hasRisk = summary.overdue.length || summary.dueSoon.length || summary.waitingParts.length || pendingMachinesCount;

  return (
    <section className="grid gap-4 rounded-[24px] border border-[#e4e4e7] bg-white p-4 shadow-[0_8px_24px_rgba(24,24,27,0.05)] xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${hasRisk ? 'bg-[#fff1f3] text-[#b5121b]' : 'bg-[#eefaf3] text-[#177245]'}`}>
            {hasRisk ? <AlertTriangle size={18} /> : <Clock3 size={18} />}
          </span>
          <div>
            <span className="text-xs font-semibold text-[#666666]">SLA vận hành</span>
            <h2 className="text-lg font-semibold text-[#1f1f1f]">Cảnh báo điều phối trong ngày</h2>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <SlaMetric label="Quá hạn SLA" tone={summary.overdue.length ? 'danger' : 'good'} value={summary.overdue.length} />
          <SlaMetric label="Cần xử lý 24h" tone={summary.dueSoon.length ? 'warn' : 'good'} value={summary.dueSoon.length} />
          <SlaMetric label="Chờ linh kiện" tone={summary.waitingParts.length ? 'danger' : 'neutral'} value={summary.waitingParts.length} />
          <SlaMetric label="Chờ duyệt hồ sơ" tone={summary.pendingReview.length ? 'warn' : 'good'} value={summary.pendingReview.length} />
          <SlaMetric label="Máy chờ xác minh" tone={pendingMachinesCount ? 'warn' : 'good'} value={pendingMachinesCount} />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <button className="primary-button justify-center" onClick={onShowAction} type="button">
          <AlertTriangle size={16} />
          Xem việc cần xử lý
        </button>
        <button className="secondary-button justify-center" onClick={onShowReview} type="button">
          <ClipboardCheck size={16} />
          Xem hồ sơ chờ duyệt
        </button>
      </div>
    </section>
  );
}

function SlaMetric({ label, tone, value }: { label: string; tone: Tone; value: number }) {
  return (
    <div className={`rounded-2xl border p-3 ${slaMetricToneClass(tone)}`}>
      <span className="text-xs font-semibold text-[#666666]">{label}</span>
      <strong className="mt-1 block text-2xl leading-none text-[#1f1f1f]">{value}</strong>
    </div>
  );
}

function PendingMachineReviewPanel({ machines }: { machines: ReviewMachine[] }) {
  return (
    <section className="rounded-[24px] border border-[#efd8a8] bg-[#fff8ed] p-4 shadow-[0_12px_30px_rgba(24,24,27,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold text-[#9b5a17]">Xác minh dữ liệu</span>
          <h2 className="mt-1 text-base font-semibold text-[#1f1f1f]">Máy kỹ sư tạo chờ duyệt</h2>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#9b5a17]">{machines.length}</span>
      </div>

      <div className="mt-3 grid gap-2">
        {machines.map((machine) => {
          const gaps = machineReviewGaps(machine);
          const customerName = machine.customer?.hospitalName || machine.customer?.name;
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
  const lockedAssignment = closed || pendingReview;
  const workflowTone = workTone(item);
  const workflowLabel = closed ? 'Hoàn tất' : pendingReview ? 'Chờ duyệt' : 'Đang mở';

  return (
    <article className={`grid items-start gap-3.5 border-b border-[#ededf0] px-4 py-4 last:border-b-0 [grid-template-columns:42px_minmax(0,1fr)] min-[821px]:[grid-template-columns:42px_minmax(0,1fr)_minmax(240px,330px)] min-[1181px]:items-center min-[1181px]:[grid-template-columns:42px_minmax(0,1fr)_minmax(150px,210px)_minmax(260px,330px)] ${workRowClass(workflowTone)}`}>
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
      <div className="col-span-full grid min-w-0 justify-items-start gap-2 min-[821px]:col-start-2 min-[821px]:col-span-1 min-[1181px]:col-auto">
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
      <div className="col-span-full grid gap-2.5 min-[821px]:col-start-3 min-[821px]:col-span-1 min-[821px]:row-span-2 min-[821px]:row-start-1 min-[1181px]:col-auto min-[1181px]:row-auto">
        {lockedAssignment ? (
          <div className={`grid gap-2 rounded-2xl border px-3 py-3 ${closed ? 'border-[#c9ead6] bg-[#eefaf3]' : 'border-[#efd8a8] bg-[#fff8ed]'}`}>
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-white ${closed ? 'text-[#177245]' : 'text-[#9b5a17]'}`}>
                {closed ? <CheckCircle2 size={15} /> : <Archive size={15} />}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${closed ? 'text-[#177245]' : 'text-[#9b5a17]'}`}>{workflowLabel}</p>
                <p className="text-[11px] leading-4 text-[#7b7b7b]">
                  {closed ? 'Đã khóa thao tác' : 'Đang chờ admin duyệt hồ sơ'}
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
          <div className="grid gap-2 max-[560px]:grid-cols-1 min-[561px]:grid-cols-[minmax(0,1fr)_auto]">
            <select
              aria-label={`Chọn kỹ sư cho ${item.code}`}
              className="form-input h-10"
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
              className="primary-button w-full min-[561px]:w-auto"
              disabled={!assignmentByKey[item.key] || assigningKey === item.key}
              onClick={() => onAssign(item)}
              type="button"
            >
              {assigningKey === item.key ? <Loader2 className="spin-icon" size={16} /> : <UserCheck size={16} />}
              Assign
            </button>
          </div>
        )}
        {pendingReview ? (
          <div className="col-span-full grid gap-2 rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-3">
            <ReviewAttachmentsPanel item={item} />
            <QualityReviewChecklist item={item} />
            <textarea
              className="form-input min-h-16"
              onChange={(event) => onReviewNoteChange(event.target.value)}
              placeholder="Ghi chú nếu trả kỹ sư bổ sung"
              value={reviewNote}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <button className="secondary-button" disabled={reviewingKey === item.key} onClick={() => onReview(item, 'NEEDS_REVISION')} type="button">
                Trả về sửa
              </button>
              <button className="primary-button" disabled={reviewingKey === item.key} onClick={() => onReview(item, 'APPROVED')} type="button">
                {reviewingKey === item.key ? 'Saving' : 'Confirm'}
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
        <p className="mt-1 text-xs leading-5 text-[#666666]">Loại việc: {kindLabel(item.kind)}. Checklist này giúp admin rà đủ hồ sơ trước khi duyệt.</p>
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
          <p className="mt-1 text-xs leading-5 text-[#666666]">Admin xem file tại đây trước khi duyệt hoặc trả về bổ sung.</p>
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

function filterDescription(filter: WorkFilter) {
  const descriptions: Record<WorkFilter, string> = {
    action: 'Việc cần admin xử lý.',
    unassigned: 'Chưa có người phụ trách.',
    review: 'Chờ admin xác nhận.',
    active: 'Đang được kỹ sư xử lý.',
    closed: 'Các việc đã hoàn thành hoặc đã đóng.',
    all: 'Tất cả việc trong bộ lọc.',
  };
  return descriptions[filter];
}

function groupWorkItems(items: WorkItem[], filter: WorkFilter) {
  const groups = [
    {
      key: 'review',
      title: 'Chờ admin xác nhận',
      description: 'Cần duyệt hoặc trả về.',
      items: items.filter((item) => item.reviewStatus === 'PENDING').sort(compareWorkItemsByDateDesc),
    },
    {
      key: 'unassigned',
      title: 'Chưa phân kỹ sư',
      description: 'Cần chọn kỹ sư.',
      items: items.filter((item) => !item.engineer?.id).sort(compareWorkItemsByDateDesc),
    },
    {
      key: 'active',
      title: 'Đang thực hiện',
      description: 'Đang theo dõi.',
      items: items.filter((item) => item.engineer?.id && item.reviewStatus !== 'PENDING' && !isClosed(item.status)).sort(compareWorkItemsByDateDesc),
    },
    {
      key: 'closed',
      title: 'Đã đóng',
      description: 'Đã hoàn tất.',
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

function splitWorkGroupByDate(group: { key: string; title: string; description: string; items: WorkItem[] }) {
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
      description: group.description,
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
  if (slaState === 'overdue') return 'Quá hạn SLA';
  if (slaState === 'due-soon') return 'Sắp đến hạn SLA';
  if (item.reviewStatus === 'PENDING') return 'Cần xác nhận báo cáo';
  if (item.reviewStatus === 'APPROVED' && isClosed(item.status)) return 'Đã hoàn tất';
  if (item.reviewStatus === 'APPROVED') return 'Đã duyệt';
  if (!item.engineer?.id) return 'Cần phân công';
  if (!isClosed(item.status)) return 'Đang theo dõi';
  return '';
}

function actionTone(item: WorkItem): Tone {
  const slaState = slaStateForItem(item);
  if (slaState === 'overdue') return 'danger';
  if (slaState === 'due-soon') return 'warn';
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
  if (value === 'PENDING') return 'Chờ admin xác nhận';
  if (value === 'APPROVED') return 'Admin đã xác nhận';
  if (value === 'NEEDS_REVISION') return 'Cần kỹ sư bổ sung';
  return '';
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
  if (item.status === 'WAITING_PARTS') return 'overdue';
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

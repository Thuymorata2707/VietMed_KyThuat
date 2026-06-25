import { ClipboardCheck, Loader2, PackageCheck, RefreshCw, Search, UserCheck, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { checklistForCategory } from '../../config/medicalDeviceChecklists';

type WorkKind = 'repair' | 'maintenance' | 'installation';
type WorkFilter = 'action' | 'unassigned' | 'review' | 'active' | 'all';
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

const filterOptions: Array<{ value: WorkFilter; label: string }> = [
  { value: 'action', label: 'Cần xử lý' },
  { value: 'unassigned', label: 'Chưa phân' },
  { value: 'review', label: 'Chờ xác nhận' },
  { value: 'active', label: 'Đang thực hiện' },
  { value: 'all', label: 'Tất cả' },
];

export function AdminWorkAssignmentPage() {
  const [engineers, setEngineers] = useState<ApiUser[]>([]);
  const [repairs, setRepairs] = useState<RepairAssignment[]>([]);
  const [maintenances, setMaintenances] = useState<MaintenanceAssignment[]>([]);
  const [installations, setInstallations] = useState<InstallationAssignment[]>([]);
  const [assignmentByKey, setAssignmentByKey] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<WorkFilter>('action');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [engineerFilter, setEngineerFilter] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigningKey, setAssigningKey] = useState('');
  const [reviewingKey, setReviewingKey] = useState('');
  const [reviewNoteByKey, setReviewNoteByKey] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const [userResult, repairResult, maintenanceResult, installationResult] = await Promise.all([
        apiFetch<Paginated<ApiUser> | ApiUser[]>('/users?limit=100&roleName=engineer'),
        apiFetch<Paginated<RepairAssignment> | RepairAssignment[]>(withQueryParams('/repairs?limit=100', { search: debouncedQuery })),
        apiFetch<Paginated<MaintenanceAssignment> | MaintenanceAssignment[]>(withQueryParams('/maintenance?limit=100', { search: debouncedQuery })),
        apiFetch<Paginated<InstallationAssignment> | InstallationAssignment[]>(withQueryParams('/installations?limit=100', { search: debouncedQuery })),
      ]);

      const nextRepairs = unpack(repairResult);
      const nextMaintenances = unpack(maintenanceResult);
      const nextInstallations = unpack(installationResult);

      setEngineers(
        unpack(userResult).filter((user) => {
          const roleName = (user.role?.name ?? user.roleName ?? '').toLowerCase();
          return roleName === 'engineer' && user.status !== 'INACTIVE';
        }),
      );
      setRepairs(nextRepairs);
      setMaintenances(nextMaintenances);
      setInstallations(nextInstallations);
      setAssignmentByKey(buildAssignmentMap(nextRepairs, nextMaintenances, nextInstallations));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu phân việc.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [debouncedQuery]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const items = useMemo(() => {
    const nextItems: WorkItem[] = [
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
        title: `Lắp đặt ${item.machine?.machineCode ?? item.machine?.serialNumber ?? item.machine?.modelName ?? item.plannedMachineModel?.name ?? item.plannedModelName ?? item.code}`,
        status: item.status,
        date: item.installedAt,
        engineer: item.installedBy,
        machine: item.machine,
        customer: item.customer ?? item.machine?.customer,
        reviewStatus: item.reviewStatus,
        reviewNote: item.reviewNote,
      })),
    ];

    return nextItems
      .filter((item) => {
        if (filter === 'action') return !item.engineer?.id || item.reviewStatus === 'PENDING';
        if (filter === 'unassigned') return !item.engineer?.id;
        if (filter === 'review') return item.reviewStatus === 'PENDING';
        if (filter === 'active') return !isClosed(item.status) && Boolean(item.engineer?.id) && item.reviewStatus !== 'PENDING';
        return true;
      })
      .filter((item) => kindFilter === 'all' || item.kind === kindFilter)
      .filter((item) => {
        if (!engineerFilter) return true;
        if (engineerFilter === '__unassigned') return !item.engineer?.id;
        return item.engineer?.id === engineerFilter;
      })
      .sort((left, right) => actionRank(left) - actionRank(right) || dateRank(left) - dateRank(right) || left.code.localeCompare(right.code));
  }, [engineerFilter, filter, installations, kindFilter, maintenances, repairs]);

  async function assignWork(item: WorkItem) {
    const engineerId = assignmentByKey[item.key];
    if (!engineerId) {
      setError('Vui lòng chọn kỹ sư trước khi phân việc.');
      return;
    }

    const endpoint =
      item.kind === 'repair'
        ? `/repairs/${item.id}/assign`
        : item.kind === 'maintenance'
          ? `/maintenance/${item.id}/assign`
          : `/installations/${item.id}`;
    setAssigningKey(item.key);
    setError('');
    setSuccess('');

    try {
      await apiFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(
          item.kind === 'installation' ? { installedById: engineerId } : { engineerId },
        ),
      });
      setSuccess(`Đã phân ${kindLabel(item.kind).toLowerCase()} ${item.code} cho kỹ sư.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không phân việc được.');
    } finally {
      setAssigningKey('');
    }
  }

  async function reviewWork(item: WorkItem, status: Extract<WorkReviewStatus, 'APPROVED' | 'NEEDS_REVISION'>) {
    const reviewNote = (reviewNoteByKey[item.key] || '').trim();
    if (status === 'NEEDS_REVISION' && !reviewNote) {
      setError('Vui lòng nhập nội dung cần kỹ sư bổ sung.');
      return;
    }

    const endpoint =
      item.kind === 'repair'
        ? `/repairs/${item.id}/review`
        : item.kind === 'maintenance'
          ? `/maintenance/${item.id}/review`
          : `/installations/${item.id}/review`;
    setReviewingKey(item.key);
    setError('');
    setSuccess('');

    try {
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ status, reviewNote: reviewNote || null }),
      });
      setSuccess(status === 'APPROVED' ? `Đã xác nhận ${item.code}.` : `Đã trả ${item.code} về kỹ sư bổ sung.`);
      setReviewNoteByKey((current) => ({ ...current, [item.key]: '' }));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật kiểm duyệt được.');
    } finally {
      setReviewingKey('');
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
  const actionCount = unassignedCount + pendingReviewCount;
  const filterCounts: Record<WorkFilter, number> = {
    action: actionCount,
    unassigned: unassignedCount,
    review: pendingReviewCount,
    active: assignedActiveCount,
    all: repairs.length + maintenances.length + installations.length,
  };
  const currentFilterLabel = filterOptions.find((option) => option.value === filter)?.label ?? 'Công việc';
  const groupedItems = useMemo(() => groupWorkItems(items, filter), [filter, items]);

  return (
    <PageFrame>
      <div className="grid gap-4 min-[821px]:flex min-[821px]:items-start min-[821px]:justify-between">
        <PageTitle
          eyebrow="Admin"
          title="Điều phối công việc"
          description="Giao kỹ sư, theo dõi việc đang mở và xác nhận báo cáo sau khi kỹ sư hoàn tất."
        />
        <button
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-4 text-sm font-medium text-[#333333] shadow-sm hover:border-[#d71920] hover:text-[#d71920] disabled:cursor-wait disabled:opacity-70 min-[561px]:w-auto"
          disabled={loading}
          onClick={loadData}
          type="button"
        >
          {loading ? <Loader2 className="animate-spin" size={17} /> : <RefreshCw size={17} />}
          Làm mới
        </button>
      </div>

      <div className="grid gap-3.5 min-[721px]:grid-cols-2 min-[1181px]:grid-cols-4">
        <button className={summaryCardClass(filter === 'action')} onClick={() => setFilter('action')} type="button">
          <span className="text-[13px] font-medium text-[#666666]">Cần admin xử lý</span>
          <strong className="text-[30px] leading-none text-[#1f1f1f]">{actionCount}</strong>
          <span className="text-xs leading-5 text-[#666666]">Chưa phân hoặc chờ xác nhận</span>
        </button>
        <button className={summaryCardClass(filter === 'unassigned')} onClick={() => setFilter('unassigned')} type="button">
          <span className="text-[13px] font-medium text-[#666666]">Chưa phân kỹ sư</span>
          <strong className="text-[30px] leading-none text-[#1f1f1f]">{unassignedCount}</strong>
          <span className="text-xs leading-5 text-[#666666]">Cần chọn người phụ trách</span>
        </button>
        <button className={summaryCardClass(filter === 'review')} onClick={() => setFilter('review')} type="button">
          <span className="text-[13px] font-medium text-[#666666]">Chờ xác nhận</span>
          <strong className="text-[30px] leading-none text-[#1f1f1f]">{pendingReviewCount}</strong>
          <span className="text-xs leading-5 text-[#666666]">Duyệt hoặc trả về bổ sung</span>
        </button>
        <button className={summaryCardClass(filter === 'active')} onClick={() => setFilter('active')} type="button">
          <span className="text-[13px] font-medium text-[#666666]">Đang thực hiện</span>
          <strong className="text-[30px] leading-none text-[#1f1f1f]">{assignedActiveCount}</strong>
          <span className="text-xs leading-5 text-[#666666]">Đã mở, cần theo dõi tiến độ</span>
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <Notice message={success} /> : null}

      <section className="overflow-hidden rounded-lg border border-[#e5e5e5] bg-white">
        <div className="grid gap-3 border-b border-[#eeeeee] p-4">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold text-[#1f1f1f]">{currentFilterLabel}</h2>
            <p className="text-sm leading-6 text-[#666666]">
              {filterDescription(filter)}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex max-w-full gap-[3px] overflow-x-auto rounded-lg border border-[#e5e5e5] bg-[#f4f7fb] p-[3px]" aria-label="Lọc công việc">
              {filterOptions.map((option) => (
                <button
                  className={`inline-flex min-h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium ${
                    filter === option.value
                      ? 'bg-white text-[#d71920] shadow-[0_1px_4px_rgba(20,32,51,0.08)]'
                      : 'bg-transparent text-[#333333] hover:text-[#d71920]'
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
            <span className="text-[13px] font-medium text-[#666666]">{loading ? 'Đang tải dữ liệu' : `${items.length} công việc đang hiển thị`}</span>
          </div>

          <div className="grid gap-2 min-[861px]:grid-cols-[minmax(260px,1fr)_190px_220px]">
            <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-[#d6d6d6] bg-white px-3 text-[#666666] focus-within:border-[#d71920] focus-within:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]">
              <Search size={16} />
              <input
                className="min-w-0 flex-1 border-0 text-[#1f1f1f] outline-none"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm mã phiếu, S/N, mã máy, khách hàng"
                value={query}
              />
            </label>
            <select
              className="h-10 min-w-0 rounded-lg border border-[#d6d6d6] bg-white px-3 text-sm font-medium text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]"
              onChange={(event) => setKindFilter(event.target.value as KindFilter)}
              value={kindFilter}
            >
              <option value="all">Tất cả loại việc</option>
              <option value="installation">Lắp đặt</option>
              <option value="repair">Sửa chữa</option>
              <option value="maintenance">Bảo trì</option>
            </select>
            <select
              className="h-10 min-w-0 rounded-lg border border-[#d6d6d6] bg-white px-3 text-sm font-medium text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]"
              onChange={(event) => setEngineerFilter(event.target.value)}
              value={engineerFilter}
            >
              <option value="">Tất cả kỹ sư</option>
              <option value="__unassigned">Chưa phân kỹ sư</option>
              {engineers.map((engineer) => (
                <option key={engineer.id} value={engineer.id}>
                  {engineer.fullName || engineer.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 p-6 text-sm font-semibold text-[#666666]">
              <Loader2 className="animate-spin" size={18} />
              <span>Đang tải danh sách phân việc</span>
            </div>
          ) : null}

          {!loading && items.length === 0 ? (
            <div className="grid min-h-52 place-items-center gap-2 p-8 text-center text-[#666666]">
              <UserCheck size={22} />
              <strong className="text-[#1f1f1f]">Không có công việc phù hợp</strong>
              <span className="text-sm">Thử đổi bộ lọc hoặc làm mới dữ liệu.</span>
            </div>
          ) : null}

          {!loading
            ? groupedItems.map((group) => (
              <section className="border-b border-[#eeeeee] last:border-b-0" key={group.key}>
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#fafafa] px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1f1f1f]">{group.title}</h3>
                    <p className="mt-0.5 text-xs leading-5 text-[#666666]">{group.description}</p>
                  </div>
                  <span className="rounded-lg border border-[#eeeeee] bg-white px-2.5 py-1 text-xs font-semibold text-[#333333]">{group.items.length} việc</span>
                </div>
                {group.items.map((item) => (
                <article
                  className="grid items-start gap-3.5 border-b border-[#eeeeee] px-4 py-[15px] last:border-b-0 [grid-template-columns:42px_minmax(0,1fr)] min-[821px]:[grid-template-columns:42px_minmax(0,1fr)_minmax(220px,320px)] min-[1181px]:items-center min-[1181px]:[grid-template-columns:42px_minmax(0,1fr)_minmax(140px,190px)_minmax(260px,330px)]"
                  key={item.key}
                >
                  <div className={kindIconClass(item.kind)}>{kindIcon(item.kind)}</div>
                  <div className="grid min-w-0 gap-[7px]">
                    <div className={metaClass}>
                      <span>{kindLabel(item.kind)}</span>
                      <span>{item.code}</span>
                      {item.date ? <span>{formatDate(item.date)}</span> : null}
                      {item.createdBy?.fullName ? <span>Người tạo: {item.createdBy.fullName}</span> : null}
                    </div>
                    <h2 className="[overflow-wrap:anywhere] text-[17px] font-medium text-[#1f1f1f]">{item.title}</h2>
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
                    <span className={badgeClass(statusTone(item.status))}>
                      <span className={badgeDotClass(statusTone(item.status))} />
                      {statusLabel(item.status)}
                    </span>
                    {item.reviewStatus && item.reviewStatus !== 'NOT_REQUIRED' ? (
                      <span className={badgeClass(reviewStatusTone(item.reviewStatus))}>
                        <span className={badgeDotClass(reviewStatusTone(item.reviewStatus))} />
                        {reviewStatusLabel(item.reviewStatus)}
                      </span>
                    ) : null}
                    <span className="[overflow-wrap:anywhere] text-[13px] font-medium text-[#333333]">
                      {item.engineer?.fullName || item.engineer?.email || 'Chưa có kỹ sư'}
                    </span>
                  </div>
                  <div className="col-span-full grid gap-2.5 max-[560px]:grid-cols-1 min-[561px]:grid-cols-[minmax(0,1fr)_auto] min-[821px]:col-start-3 min-[821px]:col-span-1 min-[821px]:row-span-2 min-[821px]:row-start-1 min-[1181px]:col-auto min-[1181px]:row-auto">
                    <select
                      aria-label={`Chọn kỹ sư cho ${item.code}`}
                      className="h-10 min-w-0 rounded-lg border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]"
                      onChange={(event) => setAssignmentByKey((current) => ({ ...current, [item.key]: event.target.value }))}
                      value={assignmentByKey[item.key] ?? ''}
                    >
                      <option value="">Chọn kỹ sư</option>
                      {engineers.map((engineer) => (
                        <option key={engineer.id} value={engineer.id}>
                          {engineer.fullName || engineer.email}
                        </option>
                      ))}
                    </select>
                    <button
                      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border-0 bg-[#d71920] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#b5121b] disabled:cursor-wait disabled:opacity-70 min-[561px]:w-auto"
                      disabled={!assignmentByKey[item.key] || assigningKey === item.key}
                      onClick={() => assignWork(item)}
                      type="button"
                    >
                      {assigningKey === item.key ? <Loader2 className="animate-spin" size={16} /> : <UserCheck size={16} />}
                      Phân việc
                    </button>
                    {item.reviewStatus === 'PENDING' ? (
                      <div className="col-span-full grid gap-2 rounded-lg border border-[#eeeeee] bg-[#fafafa] p-2.5">
                        <QualityReviewChecklist item={item} />
                        <textarea
                          className="min-h-16 rounded-lg border border-[#d6d6d6] bg-white px-3 py-2 text-sm text-[#1f1f1f] outline-none focus:border-[#d71920]"
                          onChange={(event) => setReviewNoteByKey((current) => ({ ...current, [item.key]: event.target.value }))}
                          placeholder="Ghi chú nếu trả kỹ sư bổ sung"
                          value={reviewNoteByKey[item.key] ?? ''}
                        />
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#d6d6d6] bg-white px-3 text-sm font-medium text-[#333333] hover:border-[#d71920] hover:text-[#d71920] disabled:cursor-wait disabled:opacity-70"
                            disabled={reviewingKey === item.key}
                            onClick={() => reviewWork(item, 'NEEDS_REVISION')}
                            type="button"
                          >
                            Trả về sửa
                          </button>
                          <button
                            className="inline-flex min-h-9 items-center justify-center rounded-lg border-0 bg-[#d71920] px-3 text-sm font-medium text-white hover:bg-[#b5121b] disabled:cursor-wait disabled:opacity-70"
                            disabled={reviewingKey === item.key}
                            onClick={() => reviewWork(item, 'APPROVED')}
                            type="button"
                          >
                            {reviewingKey === item.key ? 'Đang lưu' : 'Xác nhận'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
                ))}
              </section>
            ))
            : null}
        </div>
      </section>
    </PageFrame>
  );
}

function summaryCardClass(active: boolean) {
  return [
    'grid min-h-[126px] gap-[7px] rounded-lg border p-4 text-left transition hover:-translate-y-[1px] hover:border-[#d71920] hover:shadow-[0_10px_28px_rgba(20,32,51,0.08)]',
    active ? 'border-[#d71920] bg-[#fff7f7] shadow-[0_10px_28px_rgba(215,25,32,0.08)]' : 'border-[#e5e5e5] bg-white',
  ].join(' ');
}

const metaClass = 'flex flex-wrap items-center gap-[7px] text-[13px] text-[#666666] [&>span]:[overflow-wrap:anywhere]';

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
          <label className="flex items-start gap-2 rounded-md bg-[#fbfdff] px-2.5 py-2 text-xs leading-5 text-[#333333]" key={`${scope}-${check}`}>
            <input className="mt-1" type="checkbox" />
            <span>{check}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function filterDescription(filter: WorkFilter) {
  const descriptions: Record<WorkFilter, string> = {
    action: 'Những việc admin cần làm ngay: phân kỹ sư hoặc xác nhận báo cáo kỹ sư gửi về.',
    unassigned: 'Danh sách phiếu chưa có người phụ trách. Chọn kỹ sư rồi bấm phân việc.',
    review: 'Những báo cáo đã hoàn tất và đang chờ admin xác nhận hoặc trả về bổ sung.',
    active: 'Những việc đã có kỹ sư phụ trách và chưa đóng, dùng để theo dõi tiến độ.',
    all: 'Toàn bộ phiếu sửa chữa, bảo trì và lắp đặt trong phạm vi tìm kiếm hiện tại.',
  };
  return descriptions[filter];
}

function groupWorkItems(items: WorkItem[], filter: WorkFilter) {
  const groups = [
    {
      key: 'review',
      title: 'Chờ admin xác nhận',
      description: 'Kỹ sư đã gửi kết quả, admin cần duyệt hoặc trả về bổ sung.',
      items: items.filter((item) => item.reviewStatus === 'PENDING'),
    },
    {
      key: 'unassigned',
      title: 'Chưa phân kỹ sư',
      description: 'Cần chọn người phụ trách để việc bắt đầu chạy.',
      items: items.filter((item) => !item.engineer?.id),
    },
    {
      key: 'active',
      title: 'Đang thực hiện',
      description: 'Đã có kỹ sư phụ trách, cần theo dõi tiến độ và lịch hẹn.',
      items: items.filter((item) => item.engineer?.id && item.reviewStatus !== 'PENDING' && !isClosed(item.status)),
    },
    {
      key: 'closed',
      title: 'Đã đóng',
      description: 'Các việc đã hoàn tất, đã lắp đặt hoặc đã hủy.',
      items: items.filter((item) => item.engineer?.id && item.reviewStatus !== 'PENDING' && isClosed(item.status)),
    },
  ];

  if (filter === 'review') return groups.filter((group) => group.key === 'review' && group.items.length);
  if (filter === 'unassigned') return groups.filter((group) => group.key === 'unassigned' && group.items.length);
  if (filter === 'active') return groups.filter((group) => group.key === 'active' && group.items.length);
  if (filter === 'action') return groups.filter((group) => ['review', 'unassigned'].includes(group.key) && group.items.length);
  return groups.filter((group) => group.items.length);
}

function actionRank(item: WorkItem) {
  if (item.reviewStatus === 'PENDING') return 0;
  if (!item.engineer?.id) return 1;
  if (!isClosed(item.status)) return 2;
  return 3;
}

function dateRank(item: WorkItem) {
  if (!item.date) return Number.MAX_SAFE_INTEGER;
  const date = new Date(item.date);
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
}

function actionLabel(item: WorkItem) {
  if (item.reviewStatus === 'PENDING') return 'Cần xác nhận báo cáo';
  if (!item.engineer?.id) return 'Cần phân công';
  if (!isClosed(item.status)) return 'Đang theo dõi';
  return '';
}

function actionTone(item: WorkItem): Tone {
  if (item.reviewStatus === 'PENDING') return 'warn';
  if (!item.engineer?.id) return 'danger';
  if (!isClosed(item.status)) return 'neutral';
  return 'good';
}

function kindIconClass(kind: WorkKind) {
  const base = 'flex h-[42px] w-[42px] items-center justify-center rounded-lg border';
  const tones: Record<WorkKind, string> = {
    repair: 'border-[#f5c7cb] bg-[#fff5f5] text-[#d71920]',
    maintenance: 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]',
    installation: 'border-[#f5c7cb] bg-[#fff5f5] text-[#d71920]',
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

function statusTone(value: string): Tone {
  if (['COMPLETED', 'INSTALLED'].includes(value)) return 'good';
  if (['CANCELLED', 'WAITING_PARTS'].includes(value)) return 'danger';
  if (['PENDING', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS'].includes(value)) return 'warn';
  return 'neutral';
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

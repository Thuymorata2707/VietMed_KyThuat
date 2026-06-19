import { ClipboardCheck, Loader2, PackageCheck, RefreshCw, Search, UserCheck, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';

type WorkKind = 'repair' | 'maintenance' | 'installation';
type WorkFilter = 'all' | 'unassigned' | 'active';
type Tone = 'good' | 'warn' | 'danger' | 'neutral';

type WorkMachine = {
  machineCode?: string | null;
  serialNumber?: string | null;
  modelName?: string | null;
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
  type?: string | null;
  scheduledDate?: string | null;
  engineer?: ApiUser | null;
  machine?: WorkMachine | null;
};

type InstallationAssignment = {
  id: string;
  code: string;
  status: string;
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
};

const filterOptions: Array<{ value: WorkFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'unassigned', label: 'Chưa phân' },
  { value: 'active', label: 'Đang mở' },
];

export function AdminWorkAssignmentPage() {
  const [engineers, setEngineers] = useState<ApiUser[]>([]);
  const [repairs, setRepairs] = useState<RepairAssignment[]>([]);
  const [maintenances, setMaintenances] = useState<MaintenanceAssignment[]>([]);
  const [installations, setInstallations] = useState<InstallationAssignment[]>([]);
  const [assignmentByKey, setAssignmentByKey] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<WorkFilter>('unassigned');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigningKey, setAssigningKey] = useState('');
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
      })),
    ];

    return nextItems
      .filter((item) => {
        if (filter === 'unassigned') return !item.engineer?.id;
        if (filter === 'active') return !isClosed(item.status);
        return true;
      })
      .sort((left, right) => Number(!right.engineer?.id) - Number(!left.engineer?.id) || left.code.localeCompare(right.code));
  }, [filter, installations, maintenances, repairs]);

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

  const openCount =
    repairs.filter((item) => !isClosed(item.status)).length +
    maintenances.filter((item) => !isClosed(item.status)).length +
    installations.filter((item) => !isClosed(item.status)).length;
  const unassignedCount = repairs.filter((item) => !item.engineer?.id).length + maintenances.filter((item) => !item.engineer?.id).length;

  return (
    <PageFrame>
      <div className="grid gap-4 min-[821px]:flex min-[821px]:items-start min-[821px]:justify-between">
        <PageTitle
          eyebrow="Admin"
          title="Phân việc kỹ sư"
          description="Quản trị viên chọn kỹ sư xử lý cho phiếu sửa chữa và bảo trì, đồng thời theo dõi phiếu lắp đặt đã có người phụ trách."
        />
        <button
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#dde5ee] bg-white px-4 text-sm font-medium text-[#344054] shadow-sm hover:border-[#d92d20] hover:text-[#d92d20] disabled:cursor-wait disabled:opacity-70 min-[561px]:w-auto"
          disabled={loading}
          onClick={loadData}
          type="button"
        >
          {loading ? <Loader2 className="animate-spin" size={17} /> : <RefreshCw size={17} />}
          Làm mới
        </button>
      </div>

      <div className="grid gap-3.5 min-[821px]:grid-cols-3">
        <div className={summaryCardClass}>
          <span className="text-[13px] text-[#667085]">Chưa phân</span>
          <strong className="text-[28px] leading-none text-[#101828]">{unassignedCount}</strong>
        </div>
        <div className={summaryCardClass}>
          <span className="text-[13px] text-[#667085]">Đang mở</span>
          <strong className="text-[28px] leading-none text-[#101828]">{openCount}</strong>
        </div>
        <div className={summaryCardClass}>
          <span className="text-[13px] text-[#667085]">Kỹ sư hoạt động</span>
          <strong className="text-[28px] leading-none text-[#101828]">{engineers.length}</strong>
        </div>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <Notice message={success} /> : null}

      <section className="overflow-hidden rounded-lg border border-[#dde5ee] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2f7] p-3.5">
          <div className="inline-flex gap-[3px] rounded-lg border border-[#dde5ee] bg-[#f4f7fb] p-[3px]" aria-label="Lọc công việc">
            {filterOptions.map((option) => (
              <button
                className={`min-h-8 whitespace-nowrap rounded-md px-3 text-sm font-medium ${
                  filter === option.value
                    ? 'bg-white text-[#d92d20] shadow-[0_1px_4px_rgba(16,24,40,0.08)]'
                    : 'bg-transparent text-[#344054] hover:text-[#d92d20]'
                }`}
                key={option.value}
                onClick={() => setFilter(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="flex h-10 min-w-60 flex-[1_1_320px] items-center gap-2 rounded-lg border border-[#cfd8e3] bg-white px-3 text-[#667085] focus-within:border-[#d92d20] focus-within:shadow-[0_0_0_3px_rgba(217,45,32,0.12)]">
            <Search size={16} />
            <input
              className="min-w-0 flex-1 border-0 text-[#101828] outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm mã phiếu, S/N, mã máy, khách hàng"
              value={query}
            />
          </label>
          <span className="text-[13px] font-medium text-[#667085]">{loading ? 'Đang tải dữ liệu' : `${items.length} công việc`}</span>
        </div>

        <div className="grid">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 p-6 text-sm font-semibold text-[#667085]">
              <Loader2 className="animate-spin" size={18} />
              <span>Đang tải danh sách phân việc</span>
            </div>
          ) : null}

          {!loading && items.length === 0 ? (
            <div className="grid min-h-52 place-items-center gap-2 p-8 text-center text-[#667085]">
              <UserCheck size={22} />
              <strong className="text-[#101828]">Không có công việc phù hợp</strong>
              <span className="text-sm">Thử đổi bộ lọc hoặc làm mới dữ liệu.</span>
            </div>
          ) : null}

          {!loading
            ? items.map((item) => (
                <article
                  className="grid items-start gap-3.5 border-b border-[#edf2f7] px-4 py-[15px] last:border-b-0 [grid-template-columns:42px_minmax(0,1fr)] min-[821px]:[grid-template-columns:42px_minmax(0,1fr)_minmax(220px,320px)] min-[1181px]:items-center min-[1181px]:[grid-template-columns:42px_minmax(0,1fr)_minmax(140px,190px)_minmax(260px,330px)]"
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
                    <h2 className="[overflow-wrap:anywhere] text-[17px] font-medium text-[#101828]">{item.title}</h2>
                    <div className={metaClass}>
                      <span>{machineText(item)}</span>
                      <span>{customerText(item)}</span>
                    </div>
                  </div>
                  <div className="col-span-full grid min-w-0 justify-items-start gap-2 min-[821px]:col-start-2 min-[821px]:col-span-1 min-[1181px]:col-auto">
                    <span className={badgeClass(statusTone(item.status))}>
                      <span className={badgeDotClass(statusTone(item.status))} />
                      {statusLabel(item.status)}
                    </span>
                    <span className="[overflow-wrap:anywhere] text-[13px] font-medium text-[#344054]">
                      {item.engineer?.fullName || item.engineer?.email || 'Chưa có kỹ sư'}
                    </span>
                  </div>
                  <div className="col-span-full grid gap-2.5 max-[560px]:grid-cols-1 min-[561px]:grid-cols-[minmax(0,1fr)_auto] min-[821px]:col-start-3 min-[821px]:col-span-1 min-[821px]:row-span-2 min-[821px]:row-start-1 min-[1181px]:col-auto min-[1181px]:row-auto">
                    <select
                      aria-label={`Chọn kỹ sư cho ${item.code}`}
                      className="h-10 min-w-0 rounded-lg border border-[#cfd8e3] bg-white px-3 text-[#101828] outline-none focus:border-[#d92d20] focus:shadow-[0_0_0_3px_rgba(217,45,32,0.12)]"
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
                      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border-0 bg-[#d92d20] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#b42318] disabled:cursor-wait disabled:opacity-70 min-[561px]:w-auto"
                      disabled={!assignmentByKey[item.key] || assigningKey === item.key}
                      onClick={() => assignWork(item)}
                      type="button"
                    >
                      {assigningKey === item.key ? <Loader2 className="animate-spin" size={16} /> : <UserCheck size={16} />}
                      Phân việc
                    </button>
                  </div>
                </article>
              ))
            : null}
        </div>
      </section>
    </PageFrame>
  );
}

const summaryCardClass = 'grid gap-[7px] rounded-lg border border-[#dde5ee] bg-white p-4';
const metaClass = 'flex flex-wrap items-center gap-[7px] text-[13px] text-[#667085] [&>span]:[overflow-wrap:anywhere]';

function kindIconClass(kind: WorkKind) {
  const base = 'flex h-[42px] w-[42px] items-center justify-center rounded-lg border';
  const tones: Record<WorkKind, string> = {
    repair: 'border-[#fecdca] bg-[#fff4f2] text-[#d92d20]',
    maintenance: 'border-[#abefc6] bg-[#ecfdf3] text-[#067647]',
    installation: 'border-[#b2ccff] bg-[#eef4ff] text-[#175cd3]',
  };
  return `${base} ${tones[kind]}`;
}

function badgeClass(tone: Tone) {
  const base = 'inline-flex min-h-7 items-center gap-[7px] whitespace-nowrap rounded-full border px-2.5 py-[7px] text-xs font-medium';
  const tones: Record<Tone, string> = {
    good: 'border-[#abefc6] bg-[#ecfdf3] text-[#067647]',
    warn: 'border-[#fedf89] bg-[#fff7ed] text-[#b54708]',
    danger: 'border-[#fecdd3] bg-[#fff1f3] text-[#b42318]',
    neutral: 'border-[#dde5ee] bg-[#f4f7fb] text-[#344054]',
  };
  return `${base} ${tones[tone]}`;
}

function badgeDotClass(tone: Tone) {
  const tones: Record<Tone, string> = {
    good: 'bg-[#12b76a]',
    warn: 'bg-[#f79009]',
    danger: 'bg-[#f04438]',
    neutral: 'bg-[#98a2b3]',
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

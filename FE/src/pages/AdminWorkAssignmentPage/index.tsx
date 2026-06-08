import { ClipboardCheck, Loader2, PackageCheck, RefreshCw, UserCheck, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import './styles.css';

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
        apiFetch<Paginated<ApiUser> | ApiUser[]>('/users?limit=100'),
        apiFetch<Paginated<RepairAssignment> | RepairAssignment[]>('/repairs?limit=100'),
        apiFetch<Paginated<MaintenanceAssignment> | MaintenanceAssignment[]>('/maintenance?limit=100'),
        apiFetch<Paginated<InstallationAssignment> | InstallationAssignment[]>('/installations?limit=100'),
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
      setAssignmentByKey(buildAssignmentMap(nextRepairs, nextMaintenances));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu phân việc.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

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
        title: `Lắp đặt ${item.machine?.machineCode ?? item.machine?.serialNumber ?? item.code}`,
        status: item.status,
        date: item.installedAt,
        engineer: item.installedBy,
        machine: item.machine,
        customer: item.customer ?? item.machine?.customer,
      })),
    ];

    return nextItems
      .filter((item) => {
        if (filter === 'unassigned') return item.kind !== 'installation' && !item.engineer?.id;
        if (filter === 'active') return !isClosed(item.status);
        return true;
      })
      .sort((left, right) => Number(!right.engineer?.id) - Number(!left.engineer?.id) || left.code.localeCompare(right.code));
  }, [filter, installations, maintenances, repairs]);

  async function assignWork(item: WorkItem) {
    if (item.kind === 'installation') return;

    const engineerId = assignmentByKey[item.key];
    if (!engineerId) {
      setError('Vui lòng chọn kỹ sư trước khi phân việc.');
      return;
    }

    const endpoint = item.kind === 'repair' ? `/repairs/${item.id}/assign` : `/maintenance/${item.id}/assign`;
    setAssigningKey(item.key);
    setError('');
    setSuccess('');

    try {
      await apiFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ engineerId }),
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
      <div className="assignment-title-row">
        <PageTitle
          eyebrow="Admin"
          title="Phân việc kỹ sư"
          description="Quản trị viên chọn kỹ sư xử lý cho phiếu sửa chữa và bảo trì, đồng thời theo dõi phiếu lắp đặt đã có người phụ trách."
        />
        <button className="secondary-button" disabled={loading} onClick={loadData} type="button">
          {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
          Làm mới
        </button>
      </div>

      <div className="assignment-summary">
        <div>
          <span>Chưa phân</span>
          <strong>{unassignedCount}</strong>
        </div>
        <div>
          <span>Đang mở</span>
          <strong>{openCount}</strong>
        </div>
        <div>
          <span>Kỹ sư hoạt động</span>
          <strong>{engineers.length}</strong>
        </div>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <Notice message={success} /> : null}

      <section className="assignment-panel">
        <div className="assignment-toolbar">
          <div className="assignment-tabs" aria-label="Lọc công việc">
            {filterOptions.map((option) => (
              <button
                className={filter === option.value ? 'active' : ''}
                key={option.value}
                onClick={() => setFilter(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <span>{loading ? 'Đang tải dữ liệu' : `${items.length} công việc`}</span>
        </div>

        <div className="assignment-list">
          {loading ? (
            <div className="table-state">
              <Loader2 className="spin-icon" size={18} />
              <span>Đang tải danh sách phân việc</span>
            </div>
          ) : null}

          {!loading && items.length === 0 ? (
            <div className="table-state empty-state">
              <UserCheck size={22} />
              <strong>Không có công việc phù hợp</strong>
              <span>Thử đổi bộ lọc hoặc làm mới dữ liệu.</span>
            </div>
          ) : null}

          {!loading
            ? items.map((item) => (
                <article className="assignment-row" key={item.key}>
                  <div className={`assignment-kind-icon ${item.kind}`}>{kindIcon(item.kind)}</div>
                  <div className="assignment-main">
                    <div className="assignment-meta">
                      <span>{kindLabel(item.kind)}</span>
                      <span>{item.code}</span>
                      {item.date ? <span>{formatDate(item.date)}</span> : null}
                      {item.createdBy?.fullName ? <span>Người tạo: {item.createdBy.fullName}</span> : null}
                    </div>
                    <h2>{item.title}</h2>
                    <div className="assignment-lines">
                      <span>{machineText(item)}</span>
                      <span>{customerText(item)}</span>
                    </div>
                  </div>
                  <div className="assignment-status">
                    <span className={`assignment-badge ${statusTone(item.status)}`}>{statusLabel(item.status)}</span>
                    <span>{item.engineer?.fullName || item.engineer?.email || 'Chưa có kỹ sư'}</span>
                  </div>
                  <div className="assignment-controls">
                    {item.kind === 'installation' ? (
                      <span className="assignment-readonly">Theo dõi lắp đặt</span>
                    ) : (
                      <>
                        <select
                          aria-label={`Chọn kỹ sư cho ${item.code}`}
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
                          className="primary-button"
                          disabled={!assignmentByKey[item.key] || assigningKey === item.key}
                          onClick={() => assignWork(item)}
                          type="button"
                        >
                          {assigningKey === item.key ? <Loader2 className="spin-icon" size={16} /> : <UserCheck size={16} />}
                          Phân việc
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))
            : null}
        </div>
      </section>
    </PageFrame>
  );
}

function unpack<T>(result: Paginated<T> | T[]) {
  return Array.isArray(result) ? result : result.data ?? [];
}

function buildAssignmentMap(repairs: RepairAssignment[], maintenances: MaintenanceAssignment[]) {
  const map: Record<string, string> = {};

  repairs.forEach((item) => {
    map[`repair:${item.id}`] = item.engineer?.id ?? '';
  });

  maintenances.forEach((item) => {
    map[`maintenance:${item.id}`] = item.engineer?.id ?? '';
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

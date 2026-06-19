import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  History,
  Loader2,
  MapPinned,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Users,
  Wrench,
} from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';
import { AdminShortcut } from '../../components/AdminShortcut';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';

type Summary = {
  totalCustomers?: number;
  totalBusinessLines?: number;
  totalMachines?: number;
  verifiedMachines?: number;
  unverifiedMachines?: number;
  pendingReviewMachines?: number;
  engineerCreatedMachines?: number;
  totalUsers?: number;
  totalRepairs?: number;
  totalMaintenances?: number;
  activeRepairs?: number;
  activeMaintenances?: number;
  upcomingMaintenances?: number;
  repairsWithoutMachine?: number;
  openRepairsWithoutMachine?: number;
  maintenancesWithoutMachine?: number;
  openMaintenancesWithoutMachine?: number;
  openTicketsWithoutMachine?: number;
  returnedMachines?: number;
  returnedRepairingMachines?: number;
  customerStatusCounts?: Record<string, number>;
  machineStatusCounts?: Record<string, number>;
  machineInventoryStatusCounts?: Record<string, number>;
  repairStatusCounts?: Record<string, number>;
  maintenanceStatusCounts?: Record<string, number>;
};

type TechnicalMachines = {
  total: number;
  businessLines: unknown[];
};

type Tone = 'good' | 'neutral' | 'warn' | 'danger';

export function DashboardPage({ role }: { role: RoleName }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [technicalMachines, setTechnicalMachines] = useState<TechnicalMachines | null>(null);

  useEffect(() => {
    void loadSummary();
  }, []);

  async function loadSummary() {
    setLoading(true);
    setError('');

    try {
      const [nextSummary, nextTechnicalMachines] = await Promise.all([
        apiFetch<Summary>('/dashboard/summary'),
        apiFetch<TechnicalMachines>('/dashboard/technical-machines'),
      ]);
      setSummary(nextSummary);
      setTechnicalMachines(nextTechnicalMachines);
      setLastUpdatedAt(new Date().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dashboard');
    } finally {
      setLoading(false);
    }
  }

  const activeCustomers = count(summary?.customerStatusCounts, 'ACTIVE');
  const activeMachines = count(summary?.machineStatusCounts, 'ACTIVE');
  const maintenanceMachines = count(summary?.machineStatusCounts, 'MAINTENANCE');
  const repairingMachines = count(summary?.machineStatusCounts, 'REPAIRING');
  const inactiveMachines = count(summary?.machineStatusCounts, 'INACTIVE');
  const installedMachines = count(summary?.machineInventoryStatusCounts, 'INSTALLED');
  const inStockMachines = count(summary?.machineInventoryStatusCounts, 'IN_STOCK');
  const pendingRepairs = count(summary?.repairStatusCounts, 'PENDING');
  const assignedRepairs = count(summary?.repairStatusCounts, 'ASSIGNED');
  const inProgressRepairs = count(summary?.repairStatusCounts, 'IN_PROGRESS');
  const waitingPartsRepairs = count(summary?.repairStatusCounts, 'WAITING_PARTS');
  const overdueMaintenances = count(summary?.maintenanceStatusCounts, 'OVERDUE');
  const scheduledMaintenances = count(summary?.maintenanceStatusCounts, 'SCHEDULED');
  const assignedMaintenances = count(summary?.maintenanceStatusCounts, 'ASSIGNED');
  const inProgressMaintenances = count(summary?.maintenanceStatusCounts, 'IN_PROGRESS');
  const openTicketsWithoutMachine = summary?.openTicketsWithoutMachine ?? 0;
  const returnedMachines = summary?.returnedMachines ?? 0;
  const returnedRepairingMachines = summary?.returnedRepairingMachines ?? 0;
  const totalMachines = summary?.totalMachines ?? 0;
  const verifiedMachines = summary?.verifiedMachines ?? Math.max(totalMachines - (summary?.pendingReviewMachines ?? 0), 0);
  const unavailableMachines = maintenanceMachines + repairingMachines + inactiveMachines;
  const openRepairWork = pendingRepairs + assignedRepairs + inProgressRepairs + waitingPartsRepairs;
  const openMaintenanceWork = (summary?.upcomingMaintenances ?? scheduledMaintenances) + assignedMaintenances + inProgressMaintenances + overdueMaintenances;
  const totalOpenWork = openRepairWork + openMaintenanceWork;
  const availabilityRate = totalMachines > 0 ? Math.round((activeMachines / totalMachines) * 100) : 0;
  const isAdmin = role === 'admin';

  const workQueues = [
    { label: 'Sửa chữa chờ nhận', value: pendingRepairs, tone: 'warn' as const },
    { label: 'Đã phân công', value: assignedRepairs, tone: 'neutral' as const },
    { label: 'Đang xử lý', value: inProgressRepairs, tone: 'neutral' as const },
    { label: 'Đợi linh kiện', value: waitingPartsRepairs, tone: 'warn' as const },
    { label: 'Bảo trì sắp tới', value: summary?.upcomingMaintenances ?? scheduledMaintenances, tone: 'good' as const },
    { label: 'Bảo trì quá hạn', value: overdueMaintenances, tone: 'danger' as const },
  ];

  const machineQueues = [
    { label: 'Đang hoạt động', value: activeMachines, tone: 'good' as const },
    { label: 'Đang bảo trì', value: maintenanceMachines, tone: 'neutral' as const },
    { label: 'Đang sửa', value: repairingMachines, tone: 'warn' as const },
    { label: 'Ngưng hoạt động', value: inactiveMachines, tone: 'danger' as const },
  ];

  const commandKpis = [
    {
      label: 'Máy đã xác minh',
      value: verifiedMachines,
      detail: `${totalMachines} hồ sơ tổng, ${summary?.pendingReviewMachines ?? 0} chờ duyệt`,
      tone: 'neutral' as const,
    },
    {
      label: 'Máy cần theo dõi',
      value: unavailableMachines,
      detail: `${repairingMachines} đang sửa, ${maintenanceMachines} bảo trì`,
      tone: unavailableMachines > 0 ? ('warn' as const) : ('good' as const),
    },
    {
      label: 'Tồn đọng kỹ thuật',
      value: totalOpenWork,
      detail: `${openRepairWork} sửa chữa, ${openMaintenanceWork} bảo trì`,
      tone: totalOpenWork > 0 ? ('warn' as const) : ('good' as const),
    },
    {
      label: 'Cần chuẩn hóa',
      value: (summary?.pendingReviewMachines ?? 0) + openTicketsWithoutMachine,
      detail: `${summary?.pendingReviewMachines ?? 0} máy chờ duyệt, ${openTicketsWithoutMachine} phiếu thiếu hồ sơ`,
      tone: (summary?.pendingReviewMachines ?? 0) + openTicketsWithoutMachine > 0 ? ('warn' as const) : ('good' as const),
    },
  ];

  const priorityRows = [
    {
      code: 'MT-OVERDUE',
      name: 'Bảo trì quá hạn',
      owner: 'Điều phối kỹ thuật',
      status: overdueMaintenances > 0 ? 'Cần xử lý' : 'Ổn định',
      value: overdueMaintenances,
      tone: overdueMaintenances > 0 ? ('danger' as const) : ('good' as const),
      to: '/service-tickets',
    },
    {
      code: 'RP-PENDING',
      name: 'Phiếu sửa chữa chờ nhận',
      owner: 'Trưởng nhóm / Admin',
      status: pendingRepairs > 0 ? 'Chờ phân công' : 'Ổn định',
      value: pendingRepairs,
      tone: pendingRepairs > 0 ? ('warn' as const) : ('good' as const),
      to: '/service-tickets',
    },
    {
      code: 'RP-PARTS',
      name: 'Ca sửa chữa đợi linh kiện',
      owner: 'Kho / Phụ trách ca',
      status: waitingPartsRepairs > 0 ? 'Đang nghẽn' : 'Ổn định',
      value: waitingPartsRepairs,
      tone: waitingPartsRepairs > 0 ? ('warn' as const) : ('good' as const),
      to: '/service-tickets',
    },
    {
      code: 'DATA-REVIEW',
      name: 'Máy chờ xác nhận dữ liệu',
      owner: 'Admin hệ thống',
      status: (summary?.pendingReviewMachines ?? 0) > 0 ? 'Cần duyệt' : 'Ổn định',
      value: summary?.pendingReviewMachines ?? 0,
      tone: (summary?.pendingReviewMachines ?? 0) > 0 ? ('warn' as const) : ('good' as const),
      to: '/technical-machines',
    },
    {
      code: 'NO-MACHINE',
      name: 'Phiếu chưa gắn hồ sơ máy',
      owner: 'Admin / Kỹ thuật',
      status: openTicketsWithoutMachine > 0 ? 'Cần chuẩn hóa' : 'Ổn định',
      value: openTicketsWithoutMachine,
      tone: openTicketsWithoutMachine > 0 ? ('warn' as const) : ('good' as const),
      to: '/service-tickets',
    },
    {
      code: 'WH-RETURN',
      name: 'Máy trả về kho cần xử lý',
      owner: 'Kho kỹ thuật',
      status: returnedRepairingMachines > 0 ? 'Đang sửa' : returnedMachines > 0 ? 'Chờ phân loại' : 'Ổn định',
      value: returnedMachines,
      tone: returnedRepairingMachines > 0 || returnedMachines > 0 ? ('warn' as const) : ('good' as const),
      to: '/inventory-movements?tab=stock&q=RETURNED',
    },
  ];

  return (
    <PageFrame>
      <div className="flex items-start justify-between gap-4 max-[860px]:flex-col">
        <PageTitle
          eyebrow={isAdmin ? 'Admin console' : 'Trung tâm kỹ sư'}
          title={isAdmin ? 'Tổng quan vận hành kỹ thuật' : 'Việc cần xử lý hôm nay'}
          description={isAdmin ? 'Theo dõi tồn đọng, quá hạn, phân công và dữ liệu cần xác nhận trong một màn hình.' : 'Ưu tiên ticket, lịch bảo trì và thông tin máy cần cập nhật để kỹ sư thao tác nhanh.'}
        />
        <button className="secondary-button shrink-0 max-[860px]:self-start" disabled={loading} onClick={loadSummary} type="button">
          {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
          {loading ? 'Đang tải' : 'Tải lại'}
        </button>
      </div>

      {error ? <Notice message={error} /> : null}

      <section className="overflow-hidden rounded-lg border border-[#dde5ee] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2f7] bg-[#f8fafc] px-4 py-3">
          <div>
            <span className="text-[12px] font-medium text-[#667085]">Dashboard vận hành</span>
            <h2 className="mt-1 text-lg font-medium text-[#101828]">Bảng điều phối phòng kỹ thuật</h2>
          </div>
          <span className="rounded-lg border border-[#dde5ee] bg-white px-3 py-2 text-right text-xs font-medium text-[#667085]">
            {lastUpdatedAt ?? 'Chưa cập nhật'}
          </span>
        </div>

        <div className="grid grid-cols-4 divide-x divide-[#edf2f7] border-b border-[#edf2f7] max-[1180px]:grid-cols-2 max-sm:grid-cols-1 max-sm:divide-x-0">
          {commandKpis.map((item) => (
            <CommandKpi key={item.label} loading={loading} {...item} />
          ))}
        </div>

        <div className="grid grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] divide-x divide-[#edf2f7] max-[1180px]:grid-cols-1 max-[1180px]:divide-x-0">
          <BoardPanel eyebrow="Sơ đồ tải việc" title="Ticket sửa chữa và bảo trì">
            <LineWorkChart items={workQueues} loading={loading} />
            <div className="grid grid-cols-3 gap-2.5 border-t border-[#edf2f7] pt-3 max-sm:grid-cols-1">
              <ActionLink icon={<Wrench size={17} />} label={isAdmin ? 'Điều phối ticket' : 'Ticket của tôi'} to={isAdmin ? '/service-tickets' : '/my-tasks'} />
              <ActionLink icon={<ClipboardCheck size={17} />} label="Lịch công việc" to="/daily-work" />
              <ActionLink icon={<ArrowUpRight size={17} />} label="Tạo phiếu" to="/service-tickets/create" />
            </div>
          </BoardPanel>

          <BoardPanel eyebrow="Trạng thái đội máy" title="Máy cần theo dõi">
            <DonutMachineChart activeRate={availabilityRate} items={machineQueues} loading={loading} total={totalMachines} />
            <div className="grid grid-cols-3 gap-2.5 border-t border-[#edf2f7] pt-3 max-sm:grid-cols-1">
              <MiniStat label="Khách hàng hoạt động" loading={loading} value={activeCustomers} />
              <MiniStat label="Máy trả về" loading={loading} value={returnedMachines} />
              <MiniStat label="Thiếu hồ sơ máy" loading={loading} value={openTicketsWithoutMachine} />
            </div>
          </BoardPanel>
        </div>

        <PriorityTable loading={loading} rows={priorityRows} />
      </section>

      <Link
        className="grid min-h-[104px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-[#dde5ee] bg-white p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:-translate-y-px hover:border-[#b8c7d8] hover:shadow-[0_12px_30px_rgba(16,24,40,0.08)] max-sm:grid-cols-[auto_minmax(0,1fr)]"
        to="/technical-machines"
      >
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#eef4ff] text-[#175cd3]">
          <PackageSearch size={22} />
        </span>
        <span className="grid min-w-0 gap-1">
          <span className="text-xs font-medium text-[#667085]">Danh mục máy</span>
          <span className="text-lg font-medium text-[#101828]">Model và serial đang quản lý</span>
          <span className="text-sm text-[#667085]">
            {loading ? 'Đang tải danh sách máy' : `${technicalMachines?.total ?? summary?.totalMachines ?? 0} máy, ${technicalMachines?.businessLines.length ?? 0} ngành hàng`}
          </span>
        </span>
        <span className="text-sm font-medium text-[#344054] max-sm:col-span-2">Xem chi tiết</span>
      </Link>

      {role === 'admin' ? (
        <section className="grid gap-3.5">
          <div>
            <span className="text-xs font-medium text-[#667085]">Quản trị hệ thống</span>
            <h2 className="mt-1 text-lg font-medium text-[#101828]">Thao tác nhanh</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 max-[1180px]:grid-cols-2 max-[860px]:grid-cols-1">
            <AdminShortcut to="/users" icon={<Users size={19} />} title="Nhân sự" detail="Tài khoản, vai trò, khu vực và trạng thái." />
            <AdminShortcut to="/technical-machines" icon={<Stethoscope size={19} />} title="Cần xác nhận" detail={`${summary?.pendingReviewMachines ?? 0} thiết bị kỹ sư tạo cần kiểm tra.`} />
            <AdminShortcut to="/roles" icon={<ShieldCheck size={19} />} title="Vai trò" detail="Role dùng cho phân quyền backend." />
            <AdminShortcut to="/regions" icon={<MapPinned size={19} />} title="Khu vực" detail="Scope dữ liệu cho manager và kỹ sư." />
            <AdminShortcut to="/audit-logs" icon={<History size={19} />} title="Audit log" detail="Theo dõi thay đổi quan trọng." />
          </div>
        </section>
      ) : null}
    </PageFrame>
  );
}

function CommandKpi({
  label,
  value,
  detail,
  tone,
  loading,
}: {
  label: string;
  value: number;
  detail: string;
  tone: Tone;
  loading: boolean;
}) {
  const style = toneClass(tone);

  return (
    <div className="grid min-h-[122px] gap-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-medium text-[#344054]">{label}</span>
        {tone === 'good' ? <CheckCircle2 className={style.icon} size={17} /> : tone === 'neutral' ? null : <AlertTriangle className={style.icon} size={17} />}
      </div>
      <strong className={`text-[34px] leading-none ${style.text}`}>{loading ? '-' : value}</strong>
      <span className="text-xs leading-snug text-[#667085]">{detail}</span>
    </div>
  );
}

function BoardPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 p-4">
      <div>
        <span className="text-[12px] font-medium text-[#667085]">{eyebrow}</span>
        <h2 className="mt-1 text-lg font-medium text-[#101828]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function LineWorkChart({ items, loading }: { items: Array<{ label: string; value: number; tone: Tone }>; loading: boolean }) {
  const width = 620;
  const height = 250;
  const paddingX = 34;
  const paddingTop = 22;
  const paddingBottom = 50;
  const maxValue = Math.max(1, ...items.map((item) => item.value));
  const chartHeight = height - paddingTop - paddingBottom;
  const points = items.map((item, index) => {
    const x = paddingX + (index * (width - paddingX * 2)) / Math.max(1, items.length - 1);
    const y = paddingTop + chartHeight - (item.value / maxValue) * chartHeight;

    return { ...item, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <div className="rounded-lg border border-[#edf2f7] bg-[#f8fafc] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[#344054]">Đường tải việc theo trạng thái</span>
        <span className="text-xs font-medium text-[#98a2b3]">Tổng: {loading ? '-' : items.reduce((sum, item) => sum + item.value, 0)}</span>
      </div>
      <svg className="h-[250px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sơ đồ tải việc sửa chữa và bảo trì">
        <line stroke="#dde5ee" strokeWidth="1" x1={paddingX} x2={width - paddingX} y1={height - paddingBottom} y2={height - paddingBottom} />
        <line stroke="#dde5ee" strokeWidth="1" x1={paddingX} x2={paddingX} y1={paddingTop} y2={height - paddingBottom} />
        <polyline fill="none" points={line} stroke="#d92d20" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        {points.map((point) => {
          const style = toneClass(point.tone);

          return (
            <g key={point.label}>
              <circle cx={point.x} cy={point.y} fill="white" r="7" stroke={style.hex} strokeWidth="4" />
              <text fill="#101828" fontSize="18" fontWeight="700" textAnchor="middle" x={point.x} y={Math.max(18, point.y - 14)}>
                {loading ? '-' : point.value}
              </text>
              <text fill="#667085" fontSize="11" fontWeight="700" textAnchor="middle" x={point.x} y={height - 24}>
                {shortLabel(point.label)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DonutMachineChart({
  items,
  activeRate,
  total,
  loading,
}: {
  items: Array<{ label: string; value: number; tone: Tone }>;
  activeRate: number;
  total: number;
  loading: boolean;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dataTotal = Math.max(0, items.reduce((sum, item) => sum + item.value, 0));
  let offset = 0;

  return (
    <div className="grid grid-cols-[178px_minmax(0,1fr)] items-center gap-4 rounded-lg border border-[#edf2f7] bg-[#f8fafc] p-3 max-sm:grid-cols-1">
      <div className="relative h-[178px] w-[178px] justify-self-center">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 160 160" role="img" aria-label="Sơ đồ tròn trạng thái đội máy">
          <circle cx="80" cy="80" fill="none" r={radius} stroke="#e8eef6" strokeWidth="18" />
          {dataTotal > 0
            ? items.map((item) => {
                const segment = (item.value / dataTotal) * circumference;
                const dashOffset = -offset;
                offset += segment;

                return (
                  <circle
                    cx="80"
                    cy="80"
                    fill="none"
                    key={item.label}
                    r={radius}
                    stroke={toneClass(item.tone).hex}
                    strokeDasharray={`${segment} ${circumference - segment}`}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    strokeWidth="18"
                  />
                );
              })
            : null}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <span>
            <strong className="block text-3xl leading-none text-[#101828]">{loading ? '-' : `${activeRate}%`}</strong>
            <small className="mt-1 block text-xs font-medium text-[#667085]">sẵn sàng</small>
          </span>
        </div>
      </div>
      <div className="grid gap-2">
        <div className="mb-1 text-sm font-semibold text-[#344054]">Tổng {loading ? '-' : total} máy</div>
        {items.map((item) => {
          const style = toneClass(item.tone);

          return (
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)]" key={item.label}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: style.hex }} />
              <span className="font-semibold text-[#344054]">{item.label}</span>
              <strong className={style.text}>{loading ? '-' : item.value}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PriorityTable({
  rows,
  loading,
}: {
  rows: Array<{
    code: string;
    name: string;
    owner: string;
    status: string;
    value: number;
    tone: Tone;
    to: string;
  }>;
  loading: boolean;
}) {
  return (
    <div className="border-t border-[#edf2f7] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[12px] font-medium text-[#667085]">Hàng đợi ưu tiên</span>
          <h2 className="mt-1 text-lg font-medium text-[#101828]">Top vấn đề cần xử lý trong ngày</h2>
        </div>
        <Link className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#dde5ee] bg-white px-3 text-sm font-semibold text-[#344054] hover:border-[#fecdca] hover:bg-[#fff4f2] hover:text-[#d92d20]" to="/service-tickets">
          Mở danh sách <ArrowRight size={15} />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-[11px] text-[#667085]">
              <th className="border-b border-[#edf2f7] px-3 py-2 font-medium">Code</th>
              <th className="border-b border-[#edf2f7] px-3 py-2 font-medium">Vấn đề</th>
              <th className="border-b border-[#edf2f7] px-3 py-2 font-medium">Phụ trách</th>
              <th className="border-b border-[#edf2f7] px-3 py-2 font-medium">Số lượng</th>
              <th className="border-b border-[#edf2f7] px-3 py-2 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const style = toneClass(row.tone);

              return (
                <tr className="group" key={row.code}>
                  <td className="border-b border-[#edf2f7] px-3 py-3 font-semibold text-[#475467]">{row.code}</td>
                  <td className="border-b border-[#edf2f7] px-3 py-3">
                    <Link className="font-bold text-[#101828] group-hover:text-[#d92d20]" to={row.to}>
                      {row.name}
                    </Link>
                  </td>
                  <td className="border-b border-[#edf2f7] px-3 py-3 text-[#667085]">{row.owner}</td>
                  <td className={`border-b border-[#edf2f7] px-3 py-3 text-lg font-medium ${style.text}`}>{loading ? '-' : row.value}</td>
                  <td className="border-b border-[#edf2f7] px-3 py-3">
                    <span className={`inline-flex min-h-7 items-center rounded-lg border px-2.5 text-xs font-medium ${style.panel}`}>{loading ? '-' : row.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QueueBars({ items, loading }: { items: Array<{ label: string; value: number; tone: Tone }>; loading: boolean }) {
  const maxValue = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="grid gap-3">
      {items.map((item) => {
        const width = loading ? 0 : Math.max(7, Math.round((item.value / maxValue) * 100));
        const style = toneClass(item.tone);

        return (
          <div className="grid gap-1.5" key={item.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-[#344054]">{item.label}</span>
              <strong className={style.text}>{loading ? '-' : item.value}</strong>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#edf2f7]">
              <span className={`block h-full rounded-full ${style.bar}`} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniStat({ label, value, loading }: { label: string; value?: number; loading: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#edf2f7] bg-[#f8fafc] px-3 py-2.5">
      <span className="text-sm font-semibold text-[#667085]">{label}</span>
      <strong className="text-xl text-[#101828]">{loading ? '-' : value ?? 0}</strong>
    </div>
  );
}

function ActionLink({ icon, label, to }: { icon: ReactNode; label: string; to: string }) {
  return (
    <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#dde5ee] bg-white px-3 text-[14px] font-medium text-[#344054] transition hover:-translate-y-px hover:border-[#fecdca] hover:bg-[#fff4f2] hover:text-[#d92d20]" to={to}>
      {icon}
      {label}
    </Link>
  );
}

function toneClass(tone: Tone) {
  if (tone === 'good') return { panel: 'border-[#abefc6] bg-[#ecfdf3]', text: 'text-[#067647]', icon: 'text-[#067647]', bar: 'bg-[#067647]', hex: '#067647' };
  if (tone === 'warn') return { panel: 'border-[#fedf89] bg-[#fff7ed]', text: 'text-[#b54708]', icon: 'text-[#b54708]', bar: 'bg-[#b54708]', hex: '#b54708' };
  if (tone === 'danger') return { panel: 'border-[#fecdd3] bg-[#fff1f3]', text: 'text-[#b42318]', icon: 'text-[#b42318]', bar: 'bg-[#b42318]', hex: '#b42318' };
  return { panel: 'border-[#b2ccff] bg-[#eff4ff]', text: 'text-[#175cd3]', icon: 'text-[#175cd3]', bar: 'bg-[#175cd3]', hex: '#175cd3' };
}

function count(source: Record<string, number> | undefined, key: string) {
  return source?.[key] ?? 0;
}

function shortLabel(label: string) {
  if (label.includes('chờ nhận')) return 'Chờ nhận';
  if (label.includes('phân công')) return 'Phân công';
  if (label.includes('Đang xử lý')) return 'Đang xử lý';
  if (label.includes('linh kiện')) return 'Linh kiện';
  if (label.includes('sắp tới')) return 'Sắp tới';
  if (label.includes('quá hạn')) return 'Quá hạn';
  return label;
}

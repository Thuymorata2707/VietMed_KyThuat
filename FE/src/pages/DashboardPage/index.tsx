import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, PackageSearch, RefreshCw, Wrench } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ApiUser, apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { queryKeys } from '../../lib/queryKeys';

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

export function DashboardPage({ role, user }: { role: RoleName; user: ApiUser }) {
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard.overview,
    queryFn: async () => {
      const [summary, technicalMachines] = await Promise.all([
        apiFetch<Summary>('/dashboard/summary'),
        apiFetch<TechnicalMachines>('/dashboard/technical-machines'),
      ]);
      return { summary, technicalMachines };
    },
  });
  const summary = dashboardQuery.data?.summary ?? null;
  const technicalMachines = dashboardQuery.data?.technicalMachines ?? null;
  const loading = dashboardQuery.isLoading || dashboardQuery.isFetching;
  const error = dashboardQuery.error instanceof Error ? dashboardQuery.error.message : dashboardQuery.isError ? 'Không tải được dashboard' : '';
  const lastUpdatedAt = dashboardQuery.dataUpdatedAt
    ? new Date(dashboardQuery.dataUpdatedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
    : null;

  const activeMachines = count(summary?.machineStatusCounts, 'ACTIVE');
  const maintenanceMachines = count(summary?.machineStatusCounts, 'MAINTENANCE');
  const repairingMachines = count(summary?.machineStatusCounts, 'REPAIRING');
  const inactiveMachines = count(summary?.machineStatusCounts, 'INACTIVE');
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
  const openRepairWork = pendingRepairs + assignedRepairs + inProgressRepairs + waitingPartsRepairs;
  const openMaintenanceWork = (summary?.upcomingMaintenances ?? scheduledMaintenances) + assignedMaintenances + inProgressMaintenances + overdueMaintenances;
  const totalOpenWork = openRepairWork + openMaintenanceWork;
  const availabilityRate = totalMachines > 0 ? Math.round((activeMachines / totalMachines) * 100) : 0;
  const isAdmin = role === 'admin';
  const canOpenReports = role === 'admin' || role === 'manager';
  const reportsHref = (view: string) => `/reports?view=${view}`;
  const workQueues = [
    { label: 'Cần nhận việc', value: pendingRepairs, tone: pendingRepairs > 0 ? ('warn' as const) : ('good' as const) },
    { label: 'Đang có người phụ trách', value: assignedRepairs + assignedMaintenances, tone: 'neutral' as const },
    { label: 'Đang xử lý tại hiện trường', value: inProgressRepairs + inProgressMaintenances, tone: 'neutral' as const },
    { label: 'Đợi linh kiện', value: waitingPartsRepairs, tone: waitingPartsRepairs > 0 ? ('warn' as const) : ('good' as const) },
    { label: 'Bảo trì sắp tới', value: summary?.upcomingMaintenances ?? scheduledMaintenances, tone: 'good' as const },
    { label: 'Quá hạn', value: overdueMaintenances, tone: overdueMaintenances > 0 ? ('danger' as const) : ('good' as const) },
  ];

  const machineQueues = [
    { label: 'Đang hoạt động', value: activeMachines, tone: 'good' as const },
    { label: 'Đang bảo trì', value: maintenanceMachines, tone: 'neutral' as const },
    { label: 'Đang sửa', value: repairingMachines, tone: 'warn' as const },
    { label: 'Ngưng hoạt động', value: inactiveMachines, tone: 'danger' as const },
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
      name: 'Phiếu chưa gắn máy',
      owner: 'Admin / Kỹ thuật',
      status: openTicketsWithoutMachine > 0 ? 'Cần bổ sung' : 'Ổn định',
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
  const operationalPulse = [
    {
      label: 'Việc chưa xong',
      value: totalOpenWork,
      detail: `${openRepairWork} sửa chữa · ${openMaintenanceWork} bảo trì`,
      tone: totalOpenWork > 0 ? ('warn' as const) : ('good' as const),
      href: canOpenReports ? reportsHref('summary') : undefined,
    },
    {
      label: 'Máy sẵn sàng',
      value: `${availabilityRate}%`,
      detail: `${activeMachines}/${totalMachines} máy hoạt động`,
      tone: availabilityRate >= 80 ? ('good' as const) : ('warn' as const),
      href: canOpenReports ? reportsHref('machines') : undefined,
    },
    {
      label: 'Cần bổ sung',
      value: (summary?.pendingReviewMachines ?? 0) + openTicketsWithoutMachine,
      detail: 'Dữ liệu thiếu hoặc chờ duyệt',
      tone: (summary?.pendingReviewMachines ?? 0) + openTicketsWithoutMachine > 0 ? ('warn' as const) : ('good' as const),
      href: canOpenReports ? reportsHref('details') : undefined,
    },
  ];
  const topPriorityRows = loading ? priorityRows.slice(0, 4) : priorityRows.filter((row) => row.value > 0).slice(0, 4);
  const warningCount = overdueMaintenances + pendingRepairs + waitingPartsRepairs + returnedRepairingMachines;
  const missingDataCount = (summary?.pendingReviewMachines ?? 0) + openTicketsWithoutMachine;
  const visualCards = [
    {
      label: 'Việc mở',
      value: totalOpenWork,
      hint: `${openRepairWork} sửa · ${openMaintenanceWork} bảo trì`,
      tone: totalOpenWork > 0 ? ('warn' as const) : ('good' as const),
      href: '/service-tickets',
      percent: totalOpenWork > 0 ? Math.min(100, Math.max(18, totalOpenWork * 9)) : 0,
    },
    {
      label: 'Máy sẵn sàng',
      value: `${availabilityRate}%`,
      hint: `${activeMachines}/${totalMachines || 0} hoạt động`,
      tone: availabilityRate >= 80 ? ('good' as const) : ('warn' as const),
      href: canOpenReports ? reportsHref('machines') : '/technical-machines',
      percent: availabilityRate,
    },
    {
      label: 'Cảnh báo',
      value: warningCount,
      hint: warningCount > 0 ? 'Cần xem trước' : 'Đang ổn',
      tone: warningCount > 0 ? ('danger' as const) : ('good' as const),
      href: '/service-tickets',
      percent: warningCount > 0 ? Math.min(100, Math.max(16, warningCount * 12)) : 0,
    },
    {
      label: 'Thiếu dữ liệu',
      value: missingDataCount,
      hint: missingDataCount > 0 ? 'Cần bổ sung hồ sơ' : 'Đủ thông tin',
      tone: missingDataCount > 0 ? ('warn' as const) : ('good' as const),
      href: canOpenReports ? reportsHref('details') : '/technical-machines',
      percent: missingDataCount > 0 ? Math.min(100, Math.max(16, missingDataCount * 12)) : 0,
    },
  ];

  return (
    <PageFrame>
      <section className="relative overflow-hidden rounded-[28px] border border-[#e4e4e7] bg-[#f4f4f5] p-5 text-[#1f1f1f] shadow-[0_24px_70px_rgba(24,24,27,0.11)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_6%_12%,rgba(24,24,27,0.15),transparent_30%),radial-gradient(circle_at_86%_6%,rgba(255,255,255,0.96),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.88),rgba(255,247,248,0.78))]" />
        <div className="pointer-events-none absolute -right-16 bottom-[-120px] h-72 w-72 rounded-full border border-[#e4e4e7] bg-white/45" />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div className="grid content-between gap-10 rounded-[24px] border border-white/80 bg-white/70 p-6 shadow-[0_18px_44px_rgba(24,24,27,0.08)] backdrop-blur-md max-sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex rounded-full border border-[#e4e4e7] bg-[#f4f4f5] px-3 py-2 text-[12px] font-semibold text-[#18181b]">
                {isAdmin ? 'Admin console' : 'Trung tâm kỹ sư'}
              </span>
              <button
                className="secondary-button border-[#e4e4e7] bg-white/90 text-[#333333]"
                disabled={loading}
                onClick={() => void dashboardQuery.refetch()}
                type="button"
              >
                {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
                {loading ? 'Đang tải' : 'Làm mới'}
              </button>
            </div>

            <div className="max-w-[780px]">
              <h1 className="max-w-[720px] text-[clamp(34px,5vw,62px)] font-bold leading-[0.98] tracking-[-0.03em] text-[#171717]">
                {loading
                  ? 'Đang tổng hợp số liệu kỹ thuật'
                  : totalOpenWork > 0
                  ? isAdmin
                    ? 'Có việc kỹ thuật cần điều phối'
                    : 'Việc của bạn trong hôm nay'
                  : isAdmin
                    ? 'Vận hành kỹ thuật đang ổn định'
                    : 'Không có việc gấp cần xử lý'}
              </h1>
              <p className="mt-5 max-w-[620px] text-[15px] leading-7 text-[#555555]">
                {loading
                  ? 'Đang gom dữ liệu mới nhất.'
                  : totalOpenWork > 0
                  ? `${totalOpenWork} việc chưa xong. Xem Tổng hợp phiếu để xử lý.`
                  : 'Không có cảnh báo lớn.'}
              </p>
            </div>

            <div className="grid max-w-[720px] grid-cols-3 gap-3 max-sm:grid-cols-1">
              {operationalPulse.map((item) => (
                <PulseTile key={item.label} {...item} loading={loading} />
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-[24px] border border-[#e4e4e7] bg-white/88 p-4 text-[#18212f] shadow-[0_18px_44px_rgba(24,24,27,0.10)]">
            <div className="flex items-start justify-between gap-3 border-b border-[#ededf0] pb-3">
              <div>
                <span className="text-[12px] font-semibold text-[#71717a]">Ưu tiên lúc này</span>
                <h2 className="mt-1 text-lg font-semibold text-[#18212f]">Cần nhìn trước</h2>
              </div>
              <span className="rounded-2xl border border-[#e4e4e7] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#667985]">
                {lastUpdatedAt ?? 'Chưa cập nhật'}
              </span>
            </div>

            <div className="grid gap-2">
              {topPriorityRows.length > 0 ? (
                topPriorityRows.map((row) => (
                  <Link
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[18px] border border-transparent bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(28,39,56,0.05)] transition hover:-translate-y-px hover:border-[#f1c4c9]"
                    key={row.code}
                    to={row.to}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-[#3f3f46]">{row.name}</span>
                      <span className="mt-0.5 block text-[12px] font-medium text-[#71717a]">{row.status}</span>
                    </span>
                    <strong className={row.tone === 'danger' ? 'text-[#09090b]' : row.tone === 'warn' ? 'text-[#996018]' : 'text-[#1b7a4c]'}>
                      {loading ? '-' : row.value}
                    </strong>
                  </Link>
                ))
              ) : (
                <div className="grid min-h-[188px] place-items-center rounded-[20px] border border-[#e4e4e7] bg-white px-4 text-center">
                  <span>
                    <CheckCircle2 className="mx-auto text-[#1b7a4c]" size={28} />
                    <strong className="mt-3 block text-sm text-[#18212f]">Không có cảnh báo ưu tiên</strong>
                    <span className="mt-1 block text-[13px] leading-5 text-[#71717a]">Các nhóm việc chính đang ở trạng thái ổn định.</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {error ? <Notice message={error} /> : null}

      <section className="grid gap-4 rounded-[28px] border border-[#e4e4e7] bg-[linear-gradient(145deg,#ffffff_0%,#f8fbfb_100%)] p-4 shadow-[0_18px_46px_rgba(24,24,27,0.07)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f4e2e4] pb-4">
          <div>
            <span className="text-[12px] font-semibold text-[#18181b]">{isAdmin ? 'Toàn hệ thống' : 'Của bạn'}</span>
            <h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-[#1f1f1f]">Nhìn nhanh vận hành</h2>
          </div>
          <span className="rounded-2xl border border-[#e4e4e7] bg-white/82 px-3 py-2 text-right text-xs font-semibold text-[#667985] shadow-[0_8px_18px_rgba(24,24,27,0.05)]">
            {lastUpdatedAt ?? 'Chưa cập nhật'}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {visualCards.map((item) => (
            <VisualSummaryCard key={item.label} loading={loading} {...item} />
          ))}
        </div>

        <div className="grid grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] gap-4 max-[1180px]:grid-cols-1">
          <BoardPanel eyebrow="Công việc" title="Hàng đợi">
            <QueueBars items={workQueues} loading={loading} />
          </BoardPanel>

          <BoardPanel eyebrow="Thiết bị" title="Sức khỏe đội máy">
            <DonutMachineChart activeRate={availabilityRate} items={machineQueues} loading={loading} total={totalMachines} />
          </BoardPanel>
        </div>

        <div className="grid gap-2 border-t border-[#f4e2e4] pt-4 sm:grid-cols-3">
          <ActionLink icon={<Wrench size={17} />} label="Tổng hợp phiếu" to="/service-tickets" />
          <ActionLink icon={<ClipboardCheck size={17} />} label="Lịch công việc" to="/daily-work" />
          <ActionLink icon={<PackageSearch size={17} />} label={`${technicalMachines?.total ?? summary?.totalMachines ?? 0} máy`} to="/technical-machines" />
        </div>
      </section>
    </PageFrame>
  );
}

function PulseTile({
  label,
  value,
  detail,
  href,
  tone,
  loading,
}: {
  label: string;
  value: number | string;
  detail: string;
  href?: string;
  tone: Tone;
  loading: boolean;
}) {
  const style = toneClass(tone);
  const content = (
    <>
      <span className="block text-[12px] font-semibold text-[#777777]">{label}</span>
      <strong className="mt-2 block text-[30px] leading-none text-[#1f1f1f]">{loading ? '-' : value}</strong>
      <span className="mt-2 block min-h-8 text-[12px] leading-4 text-[#666666]">{loading ? 'Đang tải dữ liệu' : detail}</span>
      <span className={`mt-3 block h-1.5 rounded-full ${style.bar}`} />
    </>
  );

  if (!href) {
    return <div className="rounded-2xl border border-[#e4e4e7] bg-white/82 p-3.5 shadow-[0_10px_24px_rgba(24,24,27,0.08)] backdrop-blur-md">{content}</div>;
  }

  return (
    <Link className="rounded-2xl border border-[#e4e4e7] bg-white/82 p-3.5 shadow-[0_10px_24px_rgba(24,24,27,0.08)] backdrop-blur-md transition hover:-translate-y-px hover:border-[#18181b] hover:bg-white" rel="noreferrer" target="_blank" to={href}>
      {content}
    </Link>
  );
}

function VisualSummaryCard({
  label,
  value,
  hint,
  href,
  percent,
  tone,
  loading,
}: {
  label: string;
  value: number | string;
  hint: string;
  href: string;
  percent: number;
  tone: Tone;
  loading: boolean;
}) {
  const style = toneClass(tone);
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-black uppercase tracking-[0.08em] text-[#7a6367]">{label}</span>
        {tone === 'danger' || tone === 'warn' ? <AlertTriangle className={style.icon} size={18} /> : <CheckCircle2 className={style.icon} size={18} />}
      </div>
      <strong className={`mt-5 block text-[clamp(34px,4vw,52px)] font-black leading-none tracking-[-0.04em] ${style.text}`}>
        {loading ? '-' : value}
      </strong>
      <span className="mt-2 block min-h-5 text-sm font-semibold text-[#667985]">{loading ? 'Đang tải' : hint}</span>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#d7e3e5]">
        <span className={`block h-full rounded-full ${style.bar}`} style={{ width: `${loading ? 0 : Math.min(100, Math.max(0, percent))}%` }} />
      </div>
    </>
  );

  return (
    <Link
      className="group rounded-[24px] border border-[#e4e4e7] bg-white/88 p-4 shadow-[0_14px_34px_rgba(24,24,27,0.07)] transition hover:-translate-y-px hover:border-[#18181b]/35 hover:bg-white hover:shadow-[0_22px_48px_rgba(24,24,27,0.11)]"
      rel={href.startsWith('/reports') ? 'noreferrer' : undefined}
      target={href.startsWith('/reports') ? '_blank' : undefined}
      to={href}
    >
      {content}
    </Link>
  );
}

function BoardPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-[24px] border border-[#e4e4e7] bg-white p-5 shadow-[0_8px_24px_rgba(24,24,27,0.05)]">
      <div>
        <span className="text-[12px] font-medium text-[#666666]">{eyebrow}</span>
        <h2 className="mt-1 text-lg font-semibold text-[#1f1f1f]">{title}</h2>
      </div>
      {children}
    </section>
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
    <div className="grid grid-cols-[178px_minmax(0,1fr)] items-center gap-4 rounded-[24px] border border-[#d7e3e5] bg-[#ffffff] p-3 max-sm:grid-cols-1">
      <div className="relative h-[178px] w-[178px] justify-self-center">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 160 160" role="img" aria-label="Sơ đồ tròn trạng thái đội máy">
          <circle cx="80" cy="80" fill="none" r={radius} stroke="#eeeeee" strokeWidth="18" />
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
            <strong className="block text-3xl leading-none text-[#1f1f1f]">{loading ? '-' : `${activeRate}%`}</strong>
            <small className="mt-1 block text-xs font-medium text-[#666666]">sẵn sàng</small>
          </span>
        </div>
      </div>
      <div className="grid gap-2">
        <div className="mb-1 text-sm font-semibold text-[#333333]">Tổng {loading ? '-' : total} máy</div>
        {items.map((item) => {
          const style = toneClass(item.tone);

          return (
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm shadow-[0_1px_2px_rgba(20,32,51,0.04)]" key={item.label}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: style.hex }} />
              <span className="font-semibold text-[#333333]">{item.label}</span>
              <strong className={style.text}>{loading ? '-' : item.value}</strong>
            </div>
          );
        })}
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
              <span className="font-semibold text-[#333333]">{item.label}</span>
              <strong className={style.text}>{loading ? '-' : item.value}</strong>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#eeeeee]">
              <span className={`block h-full rounded-full ${style.bar}`} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionLink({ icon, label, to }: { icon: ReactNode; label: string; to: string }) {
  return (
    <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] border border-[#e4e4e7] bg-white px-3 text-[14px] font-bold text-[#333333] transition hover:-translate-y-px hover:border-[#18181b]/35 hover:bg-[#f4f4f5] hover:text-[#18181b]" to={to}>
      {icon}
      {label}
    </Link>
  );
}

function toneClass(tone: Tone) {
  if (tone === 'good') return { panel: 'border-[#b9e8ca] bg-[#eefaf3]', text: 'text-[#177245]', icon: 'text-[#177245]', bar: 'bg-[#177245]', hex: '#177245' };
  if (tone === 'warn') return { panel: 'border-[#efd8a8] bg-[#fff8ed]', text: 'text-[#9b5a17]', icon: 'text-[#9b5a17]', bar: 'bg-[#9b5a17]', hex: '#9b5a17' };
  if (tone === 'danger') return { panel: 'border-[#fecdd3] bg-[#fff1f3]', text: 'text-[#b5121b]', icon: 'text-[#b5121b]', bar: 'bg-[#b5121b]', hex: '#b5121b' };
  return { panel: 'border-[#e4e4e7] bg-[#f4f4f5]', text: 'text-[#18181b]', icon: 'text-[#18181b]', bar: 'bg-[#18181b]', hex: '#18181b' };
}

function count(source: Record<string, number> | undefined, key: string) {
  return source?.[key] ?? 0;
}

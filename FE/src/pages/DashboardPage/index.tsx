import {
  Activity,
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
import { useQuery } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ApiUser, apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';
import { AdminShortcut } from '../../components/AdminShortcut';
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
  const canOpenReports = role === 'admin' || role === 'manager';
  const reportsHref = (view: string) => `/reports?view=${view}`;
  const scopeTitle = isAdmin ? 'Toàn hệ thống' : user.fullName || user.email;
  const scopeDescription = isAdmin
    ? 'Tóm tắt những gì cần quan tâm trước: việc mở, máy vướng và dữ liệu còn thiếu.'
    : 'Tóm tắt phần việc, lịch và hồ sơ máy đang gắn với tài khoản của bạn.';
  const machineHealthItems = [
    { label: 'Đang hoạt động', value: activeMachines, tone: 'good' as const, href: canOpenReports ? reportsHref('machines') : undefined },
    { label: 'Đã lắp tại khách', value: installedMachines, tone: 'good' as const, href: canOpenReports ? reportsHref('machines') : undefined },
    { label: 'Trong kho', value: inStockMachines, tone: 'neutral' as const, href: canOpenReports ? reportsHref('machines') : undefined },
    { label: 'Cần kỹ thuật chú ý', value: repairingMachines + maintenanceMachines + returnedMachines, tone: repairingMachines + maintenanceMachines + returnedMachines > 0 ? ('warn' as const) : ('good' as const), href: canOpenReports ? reportsHref('details') : undefined },
  ];

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

  const commandKpis = [
    {
      label: 'Cần xử lý ngay',
      value: overdueMaintenances + pendingRepairs + waitingPartsRepairs,
      detail: `${overdueMaintenances} quá hạn, ${pendingRepairs} chờ nhận, ${waitingPartsRepairs} đợi linh kiện`,
      tone: overdueMaintenances + pendingRepairs + waitingPartsRepairs > 0 ? ('warn' as const) : ('good' as const),
      href: canOpenReports ? reportsHref('details') : undefined,
    },
    {
      label: 'Đang thực hiện',
      value: assignedRepairs + inProgressRepairs + assignedMaintenances + inProgressMaintenances,
      detail: `${inProgressRepairs + inProgressMaintenances} đang xử lý, ${assignedRepairs + assignedMaintenances} đã phân công`,
      tone: 'neutral' as const,
      href: canOpenReports ? reportsHref('engineers') : undefined,
    },
    {
      label: 'Máy cần chú ý',
      value: unavailableMachines + returnedMachines,
      detail: `${repairingMachines} sửa, ${maintenanceMachines} bảo trì, ${returnedMachines} trả kho`,
      tone: unavailableMachines + returnedMachines > 0 ? ('warn' as const) : ('good' as const),
      href: canOpenReports ? reportsHref('machines') : undefined,
    },
    {
      label: 'Dữ liệu cần bổ sung',
      value: (summary?.pendingReviewMachines ?? 0) + openTicketsWithoutMachine,
      detail: `${summary?.pendingReviewMachines ?? 0} máy chờ duyệt, ${openTicketsWithoutMachine} phiếu thiếu hồ sơ`,
      tone: (summary?.pendingReviewMachines ?? 0) + openTicketsWithoutMachine > 0 ? ('warn' as const) : ('good' as const),
      href: canOpenReports ? reportsHref('details') : undefined,
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

  return (
    <PageFrame>
      <section className="relative overflow-hidden rounded-[14px] border border-[#d9e1eb] bg-[#111827] p-5 text-white shadow-[0_28px_80px_rgba(17,24,39,0.18)]">
        <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:34px_34px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-white/18" />
        <div className="absolute inset-y-0 left-0 w-px bg-white/12" />

        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div className="grid content-between gap-10 rounded-[10px] border border-white/10 bg-white/[0.055] p-6 backdrop-blur-md max-sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex rounded-lg border border-white/12 bg-white/8 px-3 py-2 text-[12px] font-semibold text-white/68">
                {isAdmin ? 'Admin console' : 'Trung tâm kỹ sư'}
              </span>
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/14 bg-white/10 px-3.5 text-[14px] font-semibold text-white/86 transition hover:-translate-y-px hover:bg-white/14 disabled:hover:translate-y-0"
                disabled={loading}
                onClick={() => void dashboardQuery.refetch()}
                type="button"
              >
                {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
                {loading ? 'Đang tải' : 'Làm mới'}
              </button>
            </div>

            <div className="max-w-[780px]">
              <h1 className="max-w-[720px] text-[clamp(34px,5vw,62px)] font-bold leading-[0.98] tracking-normal text-white">
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
              <p className="mt-5 max-w-[620px] text-[15px] leading-7 text-white/66">
                {loading
                  ? 'Hệ thống đang gom dữ liệu máy, ticket và lịch bảo trì để tạo bức tranh vận hành mới nhất.'
                  : totalOpenWork > 0
                  ? `Còn ${totalOpenWork} việc chưa xong. Ưu tiên kiểm tra các mục quá hạn, chờ nhận và đợi linh kiện.`
                  : 'Các hàng đợi chính không có cảnh báo lớn. Bạn có thể kiểm tra lịch bảo trì sắp tới hoặc hồ sơ cần bổ sung.'}
              </p>
            </div>

            <div className="grid max-w-[720px] grid-cols-3 gap-3 max-sm:grid-cols-1">
              {operationalPulse.map((item) => (
                <PulseTile key={item.label} {...item} loading={loading} />
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-[10px] border border-white/10 bg-[#f8fafc] p-4 text-[#18212f] shadow-[0_20px_54px_rgba(0,0,0,0.16)]">
            <div className="flex items-start justify-between gap-3 border-b border-[#e9edf2] pb-3">
              <div>
                <span className="text-[12px] font-semibold text-[#647084]">Ưu tiên lúc này</span>
                <h2 className="mt-1 text-lg font-semibold text-[#18212f]">Cần nhìn trước</h2>
              </div>
              <span className="rounded-lg border border-[#dde3ea] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#647084]">
                {lastUpdatedAt ?? 'Chưa cập nhật'}
              </span>
            </div>

            <div className="grid gap-2">
              {topPriorityRows.length > 0 ? (
                topPriorityRows.map((row) => (
                  <Link
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-transparent bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(28,39,56,0.05)] transition hover:-translate-y-px hover:border-[#f1c4c9]"
                    key={row.code}
                    to={row.to}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-[#303a4b]">{row.name}</span>
                      <span className="mt-0.5 block text-[12px] font-medium text-[#647084]">{row.status}</span>
                    </span>
                    <strong className={row.tone === 'danger' ? 'text-[#a81524]' : row.tone === 'warn' ? 'text-[#996018]' : 'text-[#1b7a4c]'}>
                      {loading ? '-' : row.value}
                    </strong>
                  </Link>
                ))
              ) : (
                <div className="grid min-h-[188px] place-items-center rounded-lg border border-[#e9edf2] bg-white px-4 text-center">
                  <span>
                    <CheckCircle2 className="mx-auto text-[#1b7a4c]" size={28} />
                    <strong className="mt-3 block text-sm text-[#18212f]">Không có cảnh báo ưu tiên</strong>
                    <span className="mt-1 block text-[13px] leading-5 text-[#647084]">Các nhóm việc chính đang ở trạng thái ổn định.</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {error ? <Notice message={error} /> : null}

      <section className="grid gap-5 rounded-[10px] border border-[#dde3ea] bg-[linear-gradient(145deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_46px_rgba(28,39,56,0.07)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e9edf2] pb-4">
          <div className="min-w-0">
            <span className="text-[12px] font-semibold text-[#c91f2d]">{scopeTitle}</span>
            <h2 className="mt-1 text-xl font-semibold text-[#18212f]">Thiết bị đang quản lý</h2>
            <p className="mt-1 max-w-[760px] text-sm leading-6 text-[#647084]">{scopeDescription}</p>
          </div>
          <span className="rounded-lg border border-[#dde3ea] bg-white/80 px-3 py-2 text-right text-xs font-medium text-[#647084] shadow-[0_1px_2px_rgba(28,39,56,0.04)]">
            Cập nhật: {lastUpdatedAt ?? 'Chưa có'}
          </span>
        </div>

        <div className="grid gap-4 min-[1120px]:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.4fr)]">
          <MachineTotalCard
            active={activeMachines}
            availabilityRate={availabilityRate}
            installed={installedMachines}
            loading={loading}
            pendingReview={summary?.pendingReviewMachines ?? 0}
            total={totalMachines}
            verified={verifiedMachines}
            href={canOpenReports ? reportsHref('machines') : '/technical-machines'}
            openInNewTab={canOpenReports}
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {machineHealthItems.map((item) => (
              <MachineScopeCard key={item.label} loading={loading} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[10px] border border-[#dde3ea] bg-[#f8fafc] shadow-[0_18px_46px_rgba(28,39,56,0.07)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9edf2] bg-white/86 px-5 py-4">
          <div>
            <span className="text-[12px] font-medium text-[#647084]">Công việc</span>
            <h2 className="mt-1 text-lg font-semibold text-[#18212f]">Phiếu kỹ thuật đang mở</h2>
          </div>
          <span className="rounded-lg border border-[#dde3ea] bg-white px-3 py-2 text-right text-xs font-medium text-[#647084]">
            {isAdmin ? 'Dữ liệu chung' : 'Phần việc cá nhân'}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3 border-b border-[#e9edf2] p-3 max-[1180px]:grid-cols-2 max-sm:grid-cols-1">
          {commandKpis.map((item) => (
            <CommandKpi key={item.label} loading={loading} {...item} />
          ))}
        </div>

        <div className="grid grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] gap-3 p-3 max-[1180px]:grid-cols-1">
          <BoardPanel eyebrow="Hàng đợi công việc" title="Việc đang nằm ở đâu">
            <QueueBars items={workQueues} loading={loading} />
            <div className="grid grid-cols-3 gap-2.5 border-t border-[#eeeeee] pt-3 max-sm:grid-cols-1">
              <ActionLink icon={<Wrench size={17} />} label={isAdmin ? 'Điều phối ticket' : 'Ticket của tôi'} to={isAdmin ? '/service-tickets' : '/my-tasks'} />
              <ActionLink icon={<ClipboardCheck size={17} />} label="Lịch công việc" to="/daily-work" />
              <ActionLink icon={<ArrowUpRight size={17} />} label="Tạo phiếu" to="/service-tickets/create" />
            </div>
          </BoardPanel>

          <BoardPanel eyebrow="Tình trạng máy" title="Máy có sẵn để phục vụ không">
            <DonutMachineChart activeRate={availabilityRate} items={machineQueues} loading={loading} total={totalMachines} />
            <div className="grid grid-cols-3 gap-2.5 border-t border-[#eeeeee] pt-3 max-sm:grid-cols-1">
              <MiniStat href={canOpenReports ? reportsHref('customers') : undefined} label={isAdmin ? 'Khách hàng hoạt động' : 'Khách hàng liên quan'} loading={loading} value={activeCustomers} />
              <MiniStat href={canOpenReports ? reportsHref('machines') : undefined} label="Máy trả về" loading={loading} value={returnedMachines} />
              <MiniStat href={canOpenReports ? reportsHref('details') : undefined} label="Thiếu hồ sơ máy" loading={loading} value={openTicketsWithoutMachine} />
            </div>
          </BoardPanel>
        </div>

        <PriorityTable loading={loading} rows={priorityRows} />
      </section>

      <Link
        className="grid min-h-[104px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-[10px] border border-[#dde3ea] bg-white/90 p-4 text-left shadow-[0_10px_30px_rgba(28,39,56,0.06)] transition hover:-translate-y-px hover:border-[#f1c4c9] hover:bg-white hover:shadow-[0_18px_42px_rgba(28,39,56,0.10)] max-sm:grid-cols-[auto_minmax(0,1fr)]"
        to="/technical-machines"
      >
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#fff3f4] text-[#c91f2d]">
          <PackageSearch size={22} />
        </span>
        <span className="grid min-w-0 gap-1">
          <span className="text-xs font-medium text-[#666666]">Danh mục máy</span>
          <span className="text-lg font-semibold text-[#1f1f1f]">Model và serial đang quản lý</span>
          <span className="text-sm text-[#666666]">
            {loading ? 'Đang tải danh sách máy' : `${technicalMachines?.total ?? summary?.totalMachines ?? 0} máy, ${technicalMachines?.businessLines.length ?? 0} ngành hàng`}
          </span>
        </span>
        <span className="text-sm font-medium text-[#333333] max-sm:col-span-2">Xem chi tiết</span>
      </Link>

      {role === 'admin' ? (
        <section className="grid gap-3.5">
          <div>
          <span className="text-xs font-medium text-[#666666]">Quản trị</span>
            <h2 className="mt-1 text-lg font-medium text-[#1f1f1f]">Mở nhanh</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 max-[1180px]:grid-cols-2 max-[860px]:grid-cols-1">
            <AdminShortcut to="/users" icon={<Users size={19} />} title="Nhân sự" detail="Tài khoản, vai trò và khu vực." />
            <AdminShortcut to="/technical-machines" icon={<Stethoscope size={19} />} title="Máy chờ duyệt" detail={`${summary?.pendingReviewMachines ?? 0} máy cần kiểm tra thông tin.`} />
            <AdminShortcut to="/roles" icon={<ShieldCheck size={19} />} title="Vai trò" detail="Quyền truy cập của từng nhóm." />
            <AdminShortcut to="/regions" icon={<MapPinned size={19} />} title="Khu vực" detail="Phân vùng khách hàng và kỹ sư." />
            <AdminShortcut to="/audit-logs" icon={<History size={19} />} title="Nhật ký" detail="Các thay đổi quan trọng." />
          </div>
        </section>
      ) : null}
    </PageFrame>
  );
}

function MachineTotalCard({
  active,
  availabilityRate,
  href,
  installed,
  loading,
  openInNewTab,
  pendingReview,
  total,
  verified,
}: {
  active: number;
  availabilityRate: number;
  href: string;
  installed: number;
  loading: boolean;
  openInNewTab?: boolean;
  pendingReview: number;
  total: number;
  verified: number;
}) {
  return (
    <Link
      className="grid min-h-[228px] gap-5 rounded-[10px] border border-[#f1c4c9] bg-white/92 p-5 text-left shadow-[0_16px_36px_rgba(28,39,56,0.08)] transition hover:-translate-y-px hover:border-[#cfd7e2] hover:bg-white"
      rel={openInNewTab ? 'noreferrer' : undefined}
      target={openInNewTab ? '_blank' : undefined}
      to={href}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#fff3f4] text-[#c91f2d] shadow-[0_1px_2px_rgba(28,39,56,0.06)]">
          <PackageSearch size={22} />
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#dde3ea] bg-[#ffffff] px-2.5 py-1 text-xs font-semibold text-[#303a4b]">
          Chi tiết <ArrowRight size={13} />
        </span>
      </div>
      <div>
        <span className="text-sm font-semibold text-[#647084]">Tổng số máy</span>
        <strong className="mt-2 block text-[clamp(42px,7vw,68px)] font-semibold leading-none text-[#18212f]">
          {loading ? '-' : total}
        </strong>
      </div>
      <div className="grid gap-2 text-sm text-[#333333] sm:grid-cols-3">
        <span className="rounded-lg border border-[#e9edf2] bg-[#f8fafc] px-3 py-2 font-medium">{loading ? '-' : active} hoạt động</span>
        <span className="rounded-lg border border-[#e9edf2] bg-[#f8fafc] px-3 py-2 font-medium">{loading ? '-' : installed} đã lắp</span>
        <span className="rounded-lg border border-[#e9edf2] bg-[#f8fafc] px-3 py-2 font-medium">{loading ? '-' : verified} xác minh</span>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-[#666666]">
          <span>Tỷ lệ sẵn sàng</span>
          <span>{loading ? '-' : `${availabilityRate}%`}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#eeeeee]">
          <span className="block h-full rounded-full bg-[#177245]" style={{ width: `${loading ? 0 : availabilityRate}%` }} />
        </div>
        {pendingReview > 0 ? (
          <span className="text-xs font-medium text-[#9b5a17]">{pendingReview} máy đang chờ xác nhận dữ liệu</span>
        ) : null}
      </div>
    </Link>
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
      <span className="block text-[12px] font-semibold text-white/56">{label}</span>
      <strong className="mt-2 block text-[30px] leading-none text-white">{loading ? '-' : value}</strong>
      <span className="mt-2 block min-h-8 text-[12px] leading-4 text-white/56">{loading ? 'Đang tải dữ liệu' : detail}</span>
      <span className={`mt-3 block h-1.5 rounded-full ${style.bar}`} />
    </>
  );

  if (!href) {
    return <div className="rounded-lg border border-white/10 bg-white/[0.08] p-3.5 backdrop-blur-md">{content}</div>;
  }

  return (
    <Link className="rounded-lg border border-white/10 bg-white/[0.08] p-3.5 backdrop-blur-md transition hover:-translate-y-px hover:border-white/30 hover:bg-white/[0.12]" rel="noreferrer" target="_blank" to={href}>
      {content}
    </Link>
  );
}

function MachineScopeCard({
  label,
  value,
  href,
  tone,
  loading,
}: {
  label: string;
  value: number;
  href?: string;
  tone: Tone;
  loading: boolean;
}) {
  const style = toneClass(tone);
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[#303a4b]">{label}</span>
        {tone === 'warn' || tone === 'danger' ? <AlertTriangle className={style.icon} size={17} /> : <Activity className={style.icon} size={17} />}
      </div>
      <strong className={`text-3xl leading-none ${style.text}`}>{loading ? '-' : value}</strong>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#eeeeee]">
        <span className={`block h-full rounded-full ${style.bar}`} style={{ width: `${loading ? 0 : Math.min(100, Math.max(8, value * 8))}%` }} />
      </div>
    </>
  );

  if (!href) {
    return <div className="grid min-h-[104px] gap-3 rounded-[10px] border border-[#e9edf2] bg-white/86 p-4 shadow-[0_10px_28px_rgba(28,39,56,0.05)]">{content}</div>;
  }

  return (
    <Link className="grid min-h-[104px] gap-3 rounded-[10px] border border-[#e9edf2] bg-white/86 p-4 shadow-[0_10px_28px_rgba(28,39,56,0.05)] transition hover:-translate-y-px hover:border-[#f1c4c9] hover:bg-white" rel="noreferrer" target="_blank" to={href}>
      {content}
    </Link>
  );
}

function CommandKpi({
  label,
  value,
  detail,
  href,
  tone,
  loading,
}: {
  label: string;
  value: number;
  detail: string;
  href?: string;
  tone: Tone;
  loading: boolean;
}) {
  const style = toneClass(tone);
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-semibold text-[#303a4b]">{label}</span>
        {tone === 'good' ? <CheckCircle2 className={style.icon} size={17} /> : tone === 'neutral' ? null : <AlertTriangle className={style.icon} size={17} />}
      </div>
      <strong className={`text-[34px] leading-none ${style.text}`}>{loading ? '-' : value}</strong>
      <span className="text-xs leading-5 text-[#647084]">{loading ? 'Đang tổng hợp dữ liệu mới nhất.' : detail}</span>
    </>
  );

  if (!href) {
    return <div className="grid min-h-[130px] gap-2 rounded-lg border border-[#e9edf2] bg-white p-4 shadow-[0_8px_24px_rgba(28,39,56,0.04)]">{content}</div>;
  }

  return (
    <Link className="grid min-h-[130px] gap-2 rounded-lg border border-[#e9edf2] bg-white p-4 shadow-[0_8px_24px_rgba(28,39,56,0.04)] transition hover:-translate-y-px hover:border-[#f1c4c9] hover:bg-white" rel="noreferrer" target="_blank" to={href}>
      {content}
    </Link>
  );
}

function BoardPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-lg border border-[#e9edf2] bg-white p-5 shadow-[0_8px_24px_rgba(28,39,56,0.04)]">
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
    <div className="grid grid-cols-[178px_minmax(0,1fr)] items-center gap-4 rounded-[10px] border border-[#eeeeee] bg-[#ffffff] p-3 max-sm:grid-cols-1">
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
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-[0_1px_2px_rgba(20,32,51,0.04)]" key={item.label}>
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
    <div className="border-t border-[#eeeeee] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[12px] font-medium text-[#666666]">Hàng đợi ưu tiên</span>
          <h2 className="mt-1 text-lg font-semibold text-[#1f1f1f]">Những việc nên xử lý trước</h2>
        </div>
        <Link className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 text-sm font-semibold text-[#333333] hover:border-[#f5c7cb] hover:bg-[#fff5f5] hover:text-[#d71920]" to="/service-tickets">
          Mở danh sách <ArrowRight size={15} />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-[11px] text-[#666666]">
              <th className="border-b border-[#eeeeee] px-3 py-2 font-medium">Mã</th>
              <th className="border-b border-[#eeeeee] px-3 py-2 font-medium">Vấn đề</th>
              <th className="border-b border-[#eeeeee] px-3 py-2 font-medium">Ai xử lý</th>
              <th className="border-b border-[#eeeeee] px-3 py-2 font-medium">Còn lại</th>
              <th className="border-b border-[#eeeeee] px-3 py-2 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const style = toneClass(row.tone);

              return (
                <tr className="group" key={row.code}>
                  <td className="border-b border-[#eeeeee] px-3 py-3 font-semibold text-[#555555]">{row.code}</td>
                  <td className="border-b border-[#eeeeee] px-3 py-3">
                    <Link className="font-bold text-[#1f1f1f] group-hover:text-[#d71920]" to={row.to}>
                      {row.name}
                    </Link>
                  </td>
                  <td className="border-b border-[#eeeeee] px-3 py-3 text-[#666666]">{row.owner}</td>
                  <td className={`border-b border-[#eeeeee] px-3 py-3 text-lg font-semibold ${style.text}`}>{loading ? '-' : row.value}</td>
                  <td className="border-b border-[#eeeeee] px-3 py-3">
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

function MiniStat({ label, value, loading, href }: { label: string; value?: number; loading: boolean; href?: string }) {
  const content = (
    <>
      <span className="text-sm font-semibold text-[#666666]">{label}</span>
      <strong className="text-xl text-[#1f1f1f]">{loading ? '-' : value ?? 0}</strong>
    </>
  );

  if (!href) {
    return <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#eeeeee] bg-[#ffffff] px-3 py-2.5">{content}</div>;
  }

  return (
    <Link className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#eeeeee] bg-[#ffffff] px-3 py-2.5 transition hover:-translate-y-px hover:border-[#f1c4c9] hover:bg-[#fffafa]" rel="noreferrer" target="_blank" to={href}>
      {content}
    </Link>
  );
}

function ActionLink({ icon, label, to }: { icon: ReactNode; label: string; to: string }) {
  return (
    <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 text-[14px] font-medium text-[#333333] transition hover:-translate-y-px hover:border-[#f5c7cb] hover:bg-[#fff5f5] hover:text-[#d71920]" to={to}>
      {icon}
      {label}
    </Link>
  );
}

function toneClass(tone: Tone) {
  if (tone === 'good') return { panel: 'border-[#b9e8ca] bg-[#eefaf3]', text: 'text-[#177245]', icon: 'text-[#177245]', bar: 'bg-[#177245]', hex: '#177245' };
  if (tone === 'warn') return { panel: 'border-[#efd8a8] bg-[#fff8ed]', text: 'text-[#9b5a17]', icon: 'text-[#9b5a17]', bar: 'bg-[#9b5a17]', hex: '#9b5a17' };
  if (tone === 'danger') return { panel: 'border-[#f5c7cb] bg-[#fff5f5]', text: 'text-[#b5121b]', icon: 'text-[#b5121b]', bar: 'bg-[#b5121b]', hex: '#b5121b' };
  return { panel: 'border-[#f5c7cb] bg-[#fff5f5]', text: 'text-[#d71920]', icon: 'text-[#d71920]', bar: 'bg-[#d71920]', hex: '#d71920' };
}

function count(source: Record<string, number> | undefined, key: string) {
  return source?.[key] ?? 0;
}

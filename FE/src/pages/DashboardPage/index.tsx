import { Boxes, CheckCircle2, ClipboardCheck, Database, Layers3, Loader2, PackageSearch, RefreshCw, Route, Users, Wrench } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ApiUser, apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { queryKeys } from '../../lib/queryKeys';
import { totalOpenWorkCount } from './metrics';

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
  openMaintenances?: number;
  openInstallations?: number;
  openDemoLoans?: number;
  openDeviceServiceTickets?: number;
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
  filteredTotal?: number;
  businessLines: unknown[];
  productIndustries?: Array<{
    id: string | null;
    code?: string | null;
    name: string;
    expertiseGroup?: string | null;
    count: number;
    businessLines: number;
  }>;
};

type Tone = 'good' | 'neutral' | 'warn' | 'danger';

export function DashboardPage({ role, user }: { role: RoleName; user: ApiUser }) {
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard.overview,
    queryFn: async () => {
      const [summary, technicalMachines] = await Promise.all([
        apiFetch<Summary>('/dashboard/summary'),
        apiFetch<TechnicalMachines>('/dashboard/technical-machines?installState=INSTALLED&limit=8'),
      ]);
      return { summary, technicalMachines };
    },
  });
  const summary = dashboardQuery.data?.summary ?? null;
  const technicalMachines = dashboardQuery.data?.technicalMachines ?? null;
  const installedMachineTotal = technicalMachines?.filteredTotal ?? technicalMachines?.total ?? 0;
  const installedIndustryGroups = technicalMachines?.productIndustries ?? [];
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
  const inStockMachines = count(summary?.machineInventoryStatusCounts, 'IN_STOCK');
  const installedMachines = count(summary?.machineInventoryStatusCounts, 'INSTALLED');
  const reservedMachines = count(summary?.machineInventoryStatusCounts, 'RESERVED');
  const soldMachines = count(summary?.machineInventoryStatusCounts, 'SOLD');
  const accessorySplitMachines = count(summary?.machineInventoryStatusCounts, 'ACCESSORY_SPLIT');
  const activeCustomers = count(summary?.customerStatusCounts, 'ACTIVE');
  const potentialCustomers = count(summary?.customerStatusCounts, 'POTENTIAL');
  const inactiveCustomers = count(summary?.customerStatusCounts, 'INACTIVE');
  const blacklistedCustomers = count(summary?.customerStatusCounts, 'BLACKLISTED');
  const openTicketsWithoutMachine = summary?.openTicketsWithoutMachine ?? 0;
  const returnedMachines = summary?.returnedMachines ?? 0;
  const returnedRepairingMachines = summary?.returnedRepairingMachines ?? 0;
  const totalMachines = summary?.totalMachines ?? 0;
  const openRepairWork = pendingRepairs + assignedRepairs + inProgressRepairs + waitingPartsRepairs;
  const openMaintenanceWork = summary?.openMaintenances ?? (scheduledMaintenances + assignedMaintenances + inProgressMaintenances + overdueMaintenances);
  const openInstallationWork = summary?.openInstallations ?? 0;
  const openDemoWork = summary?.openDemoLoans ?? 0;
  const openDeviceServiceWork = summary?.openDeviceServiceTickets ?? 0;
  const totalOpenWork = totalOpenWorkCount({
    repairs: openRepairWork,
    maintenances: openMaintenanceWork,
    installations: openInstallationWork,
    demoLoans: openDemoWork,
    deviceServiceTickets: openDeviceServiceWork,
  });
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
    { label: 'Phiếu lắp đặt', value: openInstallationWork, tone: openInstallationWork > 0 ? ('warn' as const) : ('good' as const) },
    { label: 'Demo / nhận-trả', value: openDemoWork + openDeviceServiceWork, tone: openDemoWork + openDeviceServiceWork > 0 ? ('warn' as const) : ('good' as const) },
  ];

  const machineQueues = [
    { label: 'Đang hoạt động', value: activeMachines, tone: 'good' as const },
    { label: 'Đang bảo trì', value: maintenanceMachines, tone: 'neutral' as const },
    { label: 'Đang sửa', value: repairingMachines, tone: 'warn' as const },
    { label: 'Ngưng hoạt động', value: inactiveMachines, tone: 'danger' as const },
  ];

  const priorityRows = [
    {
      code: 'INSTALL-PENDING',
      name: 'Phiếu lắp đặt đang mở',
      status: openInstallationWork > 0 ? 'Chưa hoàn tất' : 'Không có phiếu mở',
      value: openInstallationWork,
      tone: openInstallationWork > 0 ? ('warn' as const) : ('good' as const),
      to: '/installations',
    },
    {
      code: 'DEMO-ACTIVE',
      name: 'Phiếu demo chưa thu hồi',
      status: openDemoWork > 0 ? 'Cần theo dõi' : 'Không có phiếu mở',
      value: openDemoWork,
      tone: openDemoWork > 0 ? ('warn' as const) : ('good' as const),
      to: '/demo-loans',
    },
    {
      code: 'MT-OVERDUE',
      name: 'Bảo trì quá hạn',
      status: overdueMaintenances > 0 ? 'Cần xử lý' : 'Ổn định',
      value: overdueMaintenances,
      tone: overdueMaintenances > 0 ? ('danger' as const) : ('good' as const),
      to: '/service-tickets',
    },
    {
      code: 'RP-PENDING',
      name: 'Phiếu sửa chữa chờ nhận',
      status: pendingRepairs > 0 ? 'Chờ phân công' : 'Ổn định',
      value: pendingRepairs,
      tone: pendingRepairs > 0 ? ('warn' as const) : ('good' as const),
      to: '/service-tickets',
    },
    {
      code: 'RP-PARTS',
      name: 'Ca sửa chữa đợi linh kiện',
      status: waitingPartsRepairs > 0 ? 'Đang nghẽn' : 'Ổn định',
      value: waitingPartsRepairs,
      tone: waitingPartsRepairs > 0 ? ('warn' as const) : ('good' as const),
      to: '/service-tickets',
    },
    {
      code: 'DATA-REVIEW',
      name: 'Máy chờ xác minh dữ liệu',
      status: (summary?.pendingReviewMachines ?? 0) > 0 ? 'Cần duyệt' : 'Ổn định',
      value: summary?.pendingReviewMachines ?? 0,
      tone: (summary?.pendingReviewMachines ?? 0) > 0 ? ('warn' as const) : ('good' as const),
      to: '/technical-machines',
    },
    {
      code: 'NO-MACHINE',
      name: 'Phiếu chưa gắn máy',
      status: openTicketsWithoutMachine > 0 ? 'Cần bổ sung' : 'Ổn định',
      value: openTicketsWithoutMachine,
      tone: openTicketsWithoutMachine > 0 ? ('warn' as const) : ('good' as const),
      to: '/service-tickets',
    },
    {
      code: 'WH-RETURN',
      name: 'Máy trả về kho cần xử lý',
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
      detail: 'Sửa chữa, bảo trì, lắp đặt, demo và nhận/trả thiết bị',
      tone: totalOpenWork > 0 ? ('warn' as const) : ('good' as const),
      href: canOpenReports ? reportsHref('summary') : undefined,
    },
    {
      label: 'Máy đang hoạt động',
      value: `${availabilityRate}%`,
      detail: `${activeMachines} trên ${totalMachines} máy`,
      tone: availabilityRate >= 80 ? ('good' as const) : ('warn' as const),
      href: canOpenReports ? reportsHref('machines') : undefined,
    },
    {
      label: 'Máy chưa xác minh',
      value: summary?.unverifiedMachines ?? 0,
      detail: `${summary?.pendingReviewMachines ?? 0} máy chờ xác minh`,
      tone: (summary?.unverifiedMachines ?? 0) > 0 ? ('warn' as const) : ('good' as const),
      href: canOpenReports ? reportsHref('details') : undefined,
    },
  ];
  const topPriorityRows = loading ? priorityRows.slice(0, 4) : priorityRows.filter((row) => row.value > 0).slice(0, 4);
  const departmentMetrics = [
    {
      label: 'Khách hàng',
      value: summary?.totalCustomers ?? 0,
      icon: <Users size={18} />,
      tone: 'neutral' as const,
      to: '/customers',
    },
    {
      label: 'Máy quản lý',
      value: totalMachines,
      icon: <Boxes size={18} />,
      tone: availabilityRate >= 80 ? ('good' as const) : ('warn' as const),
      to: '/technical-machines',
    },
    {
      label: 'Nhân sự',
      value: summary?.totalUsers ?? 0,
      icon: <Users size={18} />,
      tone: 'neutral' as const,
      to: isAdmin ? '/users' : '/daily-work',
    },
    {
      label: 'Ngành hàng',
      value: summary?.totalBusinessLines ?? 0,
      icon: <Layers3 size={18} />,
      tone: 'neutral' as const,
      to: '/product-catalog',
    },
  ];
  const inventoryRows = [
    { label: 'Trong kho', value: inStockMachines, tone: 'good' as const },
    { label: 'Đang ghi nhận đã lắp', value: installedMachines, tone: 'neutral' as const },
    { label: 'Đã giữ', value: reservedMachines, tone: 'warn' as const },
    { label: 'Đã bán', value: soldMachines, tone: 'good' as const },
    { label: 'Tách phụ kiện', value: accessorySplitMachines, tone: 'neutral' as const },
    { label: 'Trả về', value: returnedMachines, tone: returnedMachines > 0 ? ('warn' as const) : ('good' as const) },
  ];
  const customerRows = [
    { label: 'Đang chăm sóc', value: activeCustomers, tone: 'good' as const },
    { label: 'Tiềm năng', value: potentialCustomers, tone: 'neutral' as const },
    { label: 'Tạm ngưng', value: inactiveCustomers, tone: inactiveCustomers > 0 ? ('warn' as const) : ('good' as const) },
    { label: 'Hạn chế', value: blacklistedCustomers, tone: blacklistedCustomers > 0 ? ('danger' as const) : ('good' as const) },
  ];
  const dataRows = [
    { label: 'Máy chưa xác minh', value: summary?.unverifiedMachines ?? 0, tone: (summary?.unverifiedMachines ?? 0) > 0 ? ('warn' as const) : ('good' as const) },
    { label: 'Máy chờ xác minh (trong số trên)', value: summary?.pendingReviewMachines ?? 0, tone: (summary?.pendingReviewMachines ?? 0) > 0 ? ('warn' as const) : ('good' as const) },
    { label: 'Phiếu chưa gắn máy', value: openTicketsWithoutMachine, tone: openTicketsWithoutMachine > 0 ? ('warn' as const) : ('good' as const) },
    { label: 'Máy kỹ sư tạo', value: summary?.engineerCreatedMachines ?? 0, tone: 'neutral' as const },
  ];

  return (
    <PageFrame>
      <section className="rounded-[22px] border border-[#e4e4e7] bg-[#f7f7f6] p-4 text-[#1f1f1f] sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div className="grid content-between gap-6 rounded-[18px] border border-[#e4e4e7] bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex rounded-md border border-[#e4e4e7] bg-[#f4f4f5] px-3 py-2 text-[12px] font-semibold text-[#18181b]">
                Tổng quan hoạt động
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
              <h1 className="max-w-[720px] text-[clamp(30px,4vw,48px)] font-bold leading-[1.05] tracking-[-0.03em] tabular-nums text-[#171717]">
                {loading ? 'Đang tải tổng quan' : totalOpenWork > 0 ? `${totalOpenWork} việc chưa hoàn tất` : 'Không có việc tồn đọng'}
              </h1>
            </div>

            <div className="grid max-w-[720px] grid-cols-3 gap-3 max-sm:grid-cols-1">
              {operationalPulse.map((item) => (
                <PulseTile key={item.label} {...item} loading={loading} />
              ))}
            </div>
          </div>

          <div className="grid content-start gap-3 rounded-[18px] border border-[#e4e4e7] bg-white p-4 text-[#18212f]">
            <div className="flex items-start justify-between gap-3 border-b border-[#ededf0] pb-3">
              <div>
                <h2 className="text-sm font-semibold text-[#3f3f46]">Nên xem trước</h2>
                <p className="mt-1 text-xs leading-5 text-[#71717a]">Các nhóm việc đang cần theo dõi hoặc bổ sung.</p>
              </div>
              <span className="rounded-2xl border border-[#e4e4e7] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#667985]">
                {lastUpdatedAt ?? 'Chưa cập nhật'}
              </span>
            </div>

            <div className="grid gap-2">
              {topPriorityRows.length > 0 ? (
                topPriorityRows.map((row) => (
                  <Link
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[18px] border border-transparent bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(24,24,27,0.05)] transition hover:-translate-y-px hover:border-[#f1c4c9]"
                    key={row.code}
                    to={row.to}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-[#3f3f46]">{row.name}</span>
                      <span className="mt-0.5 block text-[12px] font-medium text-[#71717a]">{row.status} · mở danh sách</span>
                    </span>
                    <strong aria-label={`${row.value} việc`} className={`tabular-nums ${row.tone === 'danger' ? 'text-[#09090b]' : row.tone === 'warn' ? 'text-[#996018]' : 'text-[#1b7a4c]'}`}>
                      {loading ? '-' : row.value}
                    </strong>
                  </Link>
                ))
              ) : (
                <div className="grid min-h-[188px] place-items-center rounded-[20px] border border-[#e4e4e7] bg-white px-4 text-center">
                  <span>
                    <CheckCircle2 className="mx-auto text-[#1b7a4c]" size={28} />
                    <strong className="mt-3 block text-sm text-[#18212f]">Không có việc cần chú ý</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {error ? <Notice message={error} /> : null}

      <section className="grid gap-4 rounded-[28px] border border-[#e4e4e7] bg-white p-5 shadow-[0_14px_34px_rgba(24,24,27,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eeeeee] pb-4">
          <div>
            <span className="text-[12px] font-semibold text-[#18181b]">Danh mục hệ thống</span>
            <h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-[#1f1f1f]">Khách hàng, máy và dữ liệu</h2>
          </div>
          <Link
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[16px] border border-[#e4e4e7] bg-[#fafafa] px-3 text-sm font-bold text-[#333333] transition hover:border-[#18181b]/35 hover:bg-white"
            to="/service-tickets"
          >
            Mở trung tâm phiếu
            <Route size={16} />
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {departmentMetrics.map((item) => (
            <DepartmentMetric key={item.label} loading={loading} {...item} />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.92fr)]">
          <BoardPanel eyebrow="Kho & máy" title="Phân bổ thiết bị">
            <DistributionBars items={inventoryRows} loading={loading} />
          </BoardPanel>
          <BoardPanel eyebrow="Khách hàng" title="Trạng thái chăm sóc">
            <DistributionBars items={customerRows} loading={loading} />
          </BoardPanel>
          <BoardPanel eyebrow="Dữ liệu" title="Xác minh và bổ sung">
            <DistributionBars items={dataRows} loading={loading} />
          </BoardPanel>
        </div>
      </section>

      <section className="grid gap-4 rounded-[22px] border border-[#e4e4e7] bg-[#f7f7f6] p-4">
        <div className="border-b border-[#e4e4e7] pb-4">
          <h2 className="text-xl font-black tracking-[-0.02em] text-[#1f1f1f]">Công việc và tình trạng máy</h2>
        </div>

        <div className="grid grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] gap-4 max-[1180px]:grid-cols-1">
          <BoardPanel eyebrow="Công việc" title="Hàng đợi">
            <QueueBars items={workQueues} loading={loading} />
          </BoardPanel>

          <BoardPanel eyebrow="Thiết bị" title="Tình trạng máy">
            <DonutMachineChart activeRate={availabilityRate} items={machineQueues} loading={loading} total={totalMachines} />
          </BoardPanel>
        </div>

        <div className="grid gap-2 border-t border-[#f4e2e4] pt-4 sm:grid-cols-3">
          <ActionLink icon={<Wrench size={17} />} label="Tổng hợp phiếu" to="/service-tickets" />
          <ActionLink icon={<ClipboardCheck size={17} />} label="Lịch công việc" to="/daily-work" />
          <ActionLink icon={<PackageSearch size={17} />} label={`${loading ? '…' : installedMachineTotal} máy theo lọc lắp đặt`} to="/technical-machines?installState=INSTALLED" />
        </div>
      </section>

      <section className="grid gap-4 rounded-[28px] border border-[#e4e4e7] bg-white p-5 shadow-[0_14px_34px_rgba(24,24,27,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eeeeee] pb-4">
          <div>
            <span className="text-[12px] font-semibold text-[#18181b]">Máy phòng kỹ thuật đang quản lý</span>
            <h2 className="mt-1 text-xl font-black tracking-[-0.02em] text-[#1f1f1f]">Danh sách lắp đặt theo ngành hàng</h2>
            <p className="mt-1 text-sm font-medium text-[#666666]">
              Theo bộ lọc lắp đặt hiện tại trong phạm vi dữ liệu của tài khoản.
            </p>
          </div>
          <Link
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[16px] border border-[#e4e4e7] bg-[#fafafa] px-3 text-sm font-bold text-[#333333] transition hover:border-[#18181b]/35 hover:bg-white"
            to="/technical-machines?installState=INSTALLED"
          >
            Xem danh sách máy
            <PackageSearch size={16} />
          </Link>
        </div>

        <InstalledIndustryPanel
          groups={installedIndustryGroups}
          loading={loading}
          total={installedMachineTotal}
        />
      </section>
    </PageFrame>
  );
}

function InstalledIndustryPanel({
  groups,
  loading,
  total,
}: {
  groups: NonNullable<TechnicalMachines['productIndustries']>;
  loading: boolean;
  total: number;
}) {
  const maxValue = Math.max(1, ...groups.map((group) => group.count));

  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="h-32 animate-pulse rounded-[22px] border border-[#eeeeee] bg-[#fafafa]" key={index} />
        ))}
      </div>
    );
  }

  if (!groups.length) {
    return (
      <div className="grid min-h-36 place-items-center rounded-[22px] border border-dashed border-[#d7d7d7] bg-[#fafafa] px-4 text-center">
        <span>
                  <strong className="block text-sm text-[#1f1f1f]">Chưa có máy trong danh sách lắp đặt</strong>
        </span>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {groups.map((group) => {
        const percent = total > 0 ? Math.round((group.count / total) * 100) : 0;
        const width = Math.max(8, Math.round((group.count / maxValue) * 100));

        return (
          <Link
            className="grid min-h-32 gap-3 rounded-[22px] border border-[#eeeeee] bg-[#fafafa] p-4 transition hover:-translate-y-px hover:border-[#18181b]/30 hover:bg-white hover:shadow-[0_14px_30px_rgba(24,24,27,0.07)]"
            key={group.id ?? group.name}
            to={`/technical-machines?installState=INSTALLED${group.id ? `&productIndustryId=${group.id}` : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <strong className="block [overflow-wrap:anywhere] text-sm font-black text-[#1f1f1f]">{group.name}</strong>
                <span className="mt-1 block text-xs font-semibold text-[#71717a]">
                  {group.businessLines} nhóm sản phẩm
                </span>
              </span>
              <strong className="text-2xl font-black leading-none text-[#18181b]">{group.count}</strong>
            </div>
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-[#e4e4e7]">
                <span className="block h-full rounded-full bg-[#177245]" style={{ width: `${width}%` }} />
              </div>
              <span className="mt-2 block text-xs font-bold text-[#666666]">{percent}% trong danh sách</span>
            </div>
          </Link>
        );
      })}
    </div>
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
      <strong className={`mt-2 block text-[30px] leading-none tabular-nums ${style.text}`}>{loading ? '-' : value}</strong>
      <span className="mt-2 block min-h-8 text-[12px] leading-4 text-[#666666]">{loading ? 'Đang tải dữ liệu' : detail}</span>
    </>
  );

  if (!href) {
    return <div className="rounded-2xl border border-[#e4e4e7] bg-white/82 p-3.5 shadow-[0_10px_24px_rgba(24,24,27,0.08)] backdrop-blur-md">{content}</div>;
  }

  return (
    <Link className="rounded-xl border border-[#e4e4e7] bg-white p-3.5 transition hover:-translate-y-px hover:border-[#18181b] hover:bg-white" to={href}>
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

function DepartmentMetric({
  icon,
  label,
  value,
  to,
  tone,
  loading,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  to: string;
  tone: Tone;
  loading: boolean;
}) {
  const style = toneClass(tone);

  return (
    <Link
      className="grid min-h-[118px] content-between rounded-[22px] border border-[#e4e4e7] bg-[#ffffff] p-3.5 shadow-[0_8px_20px_rgba(24,24,27,0.05)] transition hover:-translate-y-px hover:border-[#18181b]/35 hover:shadow-[0_14px_30px_rgba(24,24,27,0.08)]"
      to={to}
    >
      <span className={`grid h-10 w-10 place-items-center rounded-2xl ${style.panel}`}>{icon}</span>
      <span>
        <strong className="block text-3xl leading-none text-[#18181b]">{loading ? '-' : value}</strong>
        <span className="mt-2 block text-sm font-bold text-[#52525b]">{label}</span>
      </span>
    </Link>
  );
}

function DistributionBars({
  items,
  loading,
}: {
  items: Array<{ label: string; value: number; tone: Tone }>;
  loading: boolean;
}) {
  const maxValue = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="grid gap-2.5">
      {items.map((item) => {
        const style = toneClass(item.tone);
        const width = loading ? 0 : Math.max(item.value > 0 ? 8 : 0, Math.round((item.value / maxValue) * 100));

        return (
          <div className="grid grid-cols-[112px_minmax(0,1fr)_42px] items-center gap-3 text-sm max-sm:grid-cols-[1fr_42px]" key={item.label}>
            <span className="font-semibold text-[#3f3f46] max-sm:col-span-1">{item.label}</span>
            <div className="h-7 overflow-hidden rounded-full bg-[#f0f0f1] max-sm:order-3 max-sm:col-span-2">
              <span className={`block h-full rounded-full ${style.bar}`} style={{ width: `${width}%` }} />
            </div>
            <strong className={`text-right ${style.text}`}>{loading ? '-' : item.value}</strong>
          </div>
        );
      })}
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
    <div className="grid grid-cols-[178px_minmax(0,1fr)] items-center gap-4 rounded-[24px] border border-[#e4e4e7] bg-[#ffffff] p-3 max-sm:grid-cols-1">
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
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm shadow-[0_1px_2px_rgba(24,24,27,0.04)]" key={item.label}>
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

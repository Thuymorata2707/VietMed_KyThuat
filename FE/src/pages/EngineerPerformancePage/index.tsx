import { AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Download, FileText, Loader2, RefreshCw, Wrench } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { DateInput } from '../../components/DateInput';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { queryKeys } from '../../lib/queryKeys';

type EngineerPerformancePageProps = {
  currentRole: RoleName;
  user: ApiUser;
};

type EngineerWorkSummary = {
  engineer?: {
    id: string;
    email?: string | null;
    fullName?: string | null;
    engineerProfile?: {
      employeeCode?: string | null;
      position?: string | null;
      department?: string | null;
      expertiseGroup?: string | null;
    } | null;
  } | null;
  totals: {
    installations: number;
    repairs: number;
    maintenances: number;
    activities: number;
    customers: number;
    machines: number;
  };
  customers: Array<{
    id?: string;
    code?: string | null;
    name: string;
    status?: string | null;
    province?: string | null;
    phone?: string | null;
    installationCount: number;
    repairCount: number;
    maintenanceCount: number;
    machineCount: number;
  }>;
  activities: Array<{
    id: string;
    kind: 'installation' | 'repair' | 'maintenance';
    code: string;
    date: string;
    status: string;
    title: string;
    result?: string | null;
    customer: {
      name: string;
      status?: string | null;
      province?: string | null;
      phone?: string | null;
    };
    machine: {
      code?: string | null;
      serialNumber?: string | null;
      modelName?: string | null;
      name?: string | null;
      businessLine?: string | null;
    };
  }>;
  weeklyReports: Array<{
    id: string;
    weekStart: string;
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'NEEDS_REVISION';
    note?: string | null;
    submittedAt?: string | null;
    rows: Array<{
      id: string;
      workDate: string;
      customer?: string | null;
      machine?: string | null;
      content?: string | null;
      result?: string | null;
      pending?: string | null;
      proposal?: string | null;
      sortOrder?: number;
    }>;
  }>;
};

const today = new Date();
const defaultFrom = toDateInput(addDays(today, -60));
const defaultTo = toDateInput(today);

export function EngineerPerformancePage({ currentRole, user }: EngineerPerformancePageProps) {
  const isAdmin = currentRole === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const [engineerId, setEngineerId] = useState(() => searchParams.get('engineerId') || searchParams.get('userId') || (isAdmin ? '' : user.id));
  const [from, setFrom] = useState(() => searchParams.get('from') || defaultFrom);
  const [to, setTo] = useState(() => searchParams.get('to') || defaultTo);
  const [weekStart, setWeekStart] = useState(() => searchParams.get('weekStart') || toDateInput(startOfWeek(new Date(`${searchParams.get('from') || defaultFrom}T00:00:00`))));

  const engineersQuery = useQuery({
    enabled: isAdmin,
    queryKey: queryKeys.engineerPerformance.engineers,
    queryFn: async () => {
      const result = await apiFetch<Paginated<ApiUser>>('/users?limit=100&status=ACTIVE');
      return (result?.data ?? []).filter((item) => item.role?.name === 'engineer' || item.engineerProfile);
    },
  });

  const engineers = engineersQuery.data ?? [];

  useEffect(() => {
    if (!isAdmin) return;
    setEngineerId((current) => current || engineers[0]?.id || '');
  }, [engineers, isAdmin]);

  const summaryParams = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    if (isAdmin && engineerId) params.set('userId', engineerId);
    return params.toString();
  }, [engineerId, from, isAdmin, to]);

  const summaryQuery = useQuery({
    enabled: !isAdmin || Boolean(engineerId),
    queryKey: queryKeys.engineerPerformance.summary(summaryParams),
    queryFn: async () => {
      const result = await apiFetch<EngineerWorkSummary | null>(`/weekly-reports/summary?${summaryParams}`);
      return result ?? null;
    },
  });

  const summary = summaryQuery.data ?? null;
  const loading = summaryQuery.isLoading || summaryQuery.isFetching || engineersQuery.isFetching;
  const error =
    (engineersQuery.error instanceof Error ? engineersQuery.error.message : '') ||
    (summaryQuery.error instanceof Error ? summaryQuery.error.message : '');

  useEffect(() => {
    if (isAdmin && !engineerId) return;
    syncUrl();
  }, [engineerId, from, to, weekStart, isAdmin]);

  const selectedEngineer = engineers.find((engineer) => engineer.id === engineerId);
  const workMix = [
    { label: 'Lắp đặt', value: summary?.totals.installations ?? 0, tone: 'good' as const },
    { label: 'Sửa chữa', value: summary?.totals.repairs ?? 0, tone: 'warn' as const },
    { label: 'Bảo trì', value: summary?.totals.maintenances ?? 0, tone: 'neutral' as const },
  ];
  const maxWorkValue = Math.max(1, ...workMix.map((item) => item.value));
  const selectedEngineerName = selectedEngineer?.fullName || summary?.engineer?.fullName || summary?.engineer?.email || user.fullName || user.email;
  const weeklyRowCount = summary?.weeklyReports?.reduce((sum, report) => sum + report.rows.length, 0) ?? 0;
  const weeklyNeedsRevision = summary?.weeklyReports?.filter((report) => report.status === 'NEEDS_REVISION').length ?? 0;
  const weeklySubmitted = summary?.weeklyReports?.filter((report) => report.status === 'SUBMITTED').length ?? 0;
  const weeklyApproved = summary?.weeklyReports?.filter((report) => report.status === 'APPROVED').length ?? 0;
  const closedActivities = summary?.activities?.filter((activity) => ['COMPLETED', 'INSTALLED', 'APPROVED'].includes(activity.status)).length ?? 0;
  const unresolvedActivities = Math.max((summary?.activities.length ?? 0) - closedActivities, 0);
  const completionRate = summary?.activities.length ? Math.round((closedActivities / summary.activities.length) * 100) : 0;
  const reportHomePath = isAdmin ? '/engineer-performance' : '/my-reports';
  const currentWeeklyReportHref = buildWeeklyReportHref(weekStart, isAdmin ? engineerId : '');
  const currentTechnicalReportHref = buildTechnicalReportHref(from, to, isAdmin ? engineerId : user.id, isAdmin, reportHomePath);
  const sortedWeeklyReports = useMemo(
    () => [...(summary?.weeklyReports ?? [])].sort((left, right) => right.weekStart.localeCompare(left.weekStart)),
    [summary],
  );
  const currentWeekReport = sortedWeeklyReports.find((report) => toDateInput(startOfWeek(new Date(`${report.weekStart}T00:00:00`))) === weekStart);
  const recentActivities = useMemo(
    () =>
      [...(summary?.activities ?? [])]
        .sort((left, right) => right.date.localeCompare(left.date))
        .slice(0, 10),
    [summary],
  );
  const topCustomers = useMemo(
    () =>
      [...(summary?.customers ?? [])]
        .sort((left, right) => {
          const leftTotal = left.installationCount + left.repairCount + left.maintenanceCount;
          const rightTotal = right.installationCount + right.repairCount + right.maintenanceCount;
          return rightTotal - leftTotal || left.name.localeCompare(right.name);
        })
        .slice(0, 8),
    [summary],
  );

  function syncUrl() {
    const next = new URLSearchParams({ from, to, weekStart });
    if (isAdmin && engineerId) next.set('engineerId', engineerId);
    setSearchParams(next, { replace: true });
  }

  function exportCsv() {
    const lines = [
      ['Ngày', 'Loại việc', 'Mã phiếu', 'Khách hàng', 'Máy', 'Nội dung', 'Kết quả'],
      ...(summary?.activities ?? []).map((activity) => [
        formatDate(activity.date),
        activityKindLabel(activity.kind),
        activity.code,
        activity.customer.name,
        machineSummaryLabel(activity.machine),
        activity.title,
        activity.result || '',
      ]),
    ];
    const csv = `\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hieu-suat-ky-su-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageFrame>
      <PageTitle
        eyebrow={isAdmin ? 'Báo cáo vận hành' : 'Báo cáo cá nhân'}
        title={isAdmin ? 'Hiệu suất kỹ sư' : 'Báo cáo của tôi'}
        description={isAdmin ? 'Theo dõi tải việc, chất lượng báo cáo và khách hàng theo từng kỹ sư.' : 'Một màn hình để xem việc đã làm, báo cáo tuần và các điểm cần xử lý.'}
      />

      {error ? <Notice message={error} /> : null}

      <section className="grid gap-4 rounded-[24px] border border-[#e4e4e7] bg-white/92 p-4 shadow-[0_18px_44px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_150px_150px_150px_auto]">
          {isAdmin ? (
            <label className="grid gap-1.5 text-sm font-medium text-[#333333]">
              Kỹ sư
              <select className={fieldClass} onChange={(event) => setEngineerId(event.target.value)} value={engineerId}>
                {engineers.map((engineer) => (
                  <option key={engineer.id} value={engineer.id}>
                    {engineer.fullName || engineer.email}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="grid content-end gap-1.5">
              <span className="text-xs font-medium text-[#666666]">Kỹ sư</span>
              <strong className="min-h-11 rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2.5 text-[#1f1f1f]">{user.fullName || user.email}</strong>
            </div>
          )}
          <DateInput className="grid gap-1.5 text-sm font-medium text-[#333333]" label="Từ ngày" onChange={setFrom} value={from} />
          <DateInput className="grid gap-1.5 text-sm font-medium text-[#333333]" label="Đến ngày" onChange={setTo} value={to} />
          <DateInput className="grid gap-1.5 text-sm font-medium text-[#333333]" label="Tuần báo cáo" onChange={(value) => setWeekStart(value ? toDateInput(startOfWeek(new Date(`${value}T00:00:00`))) : '')} value={weekStart} />
          <div className="flex flex-wrap items-end justify-start gap-2 self-end lg:justify-end">
            <button className="secondary-button" disabled={loading} onClick={() => void summaryQuery.refetch()} type="button">
              {loading ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
              Cập nhật
            </button>
            {currentWeeklyReportHref ? (
              <Link className="secondary-button" to={currentWeeklyReportHref}>
                <FileText size={16} />
                Báo cáo tuần
              </Link>
            ) : null}
            {currentTechnicalReportHref ? (
              <Link className="secondary-button" to={currentTechnicalReportHref}>
                <FileText size={16} />
                Thống kê kỹ thuật
              </Link>
            ) : null}
            <button className="secondary-button" disabled={!summary?.activities.length} onClick={exportCsv} type="button">
              <Download size={16} />
              CSV
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeeee] pt-3">
          <span className="text-xs font-semibold text-[#71717a]">Khoảng xem nhanh</span>
          <div className="flex flex-wrap gap-2">
            <button className="secondary-button" onClick={() => setDateRange(addDays(today, -60), today)} type="button">60 ngày</button>
            <button className="secondary-button" onClick={() => setDateRange(startOfMonth(today), today)} type="button">Tháng này</button>
            <button className="secondary-button" onClick={() => setDateRange(new Date('2026-05-01T00:00:00'), new Date('2026-05-31T00:00:00'))} type="button">Dữ liệu T05/2026</button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] gap-4 max-[1120px]:grid-cols-1">
        <article className="relative overflow-hidden rounded-[28px] bg-[#18181b] p-5 text-white shadow-[0_22px_54px_rgba(15,23,42,0.2)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(20,184,166,0.22),transparent_32%),radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.12),transparent_26%)]" />
          <div className="relative grid gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="text-[12px] font-semibold text-white/62">Tổng quan kỳ báo cáo</span>
                <h2 className="mt-2 text-[clamp(30px,4vw,46px)] font-extrabold leading-none tracking-[-0.04em]">{summary?.totals.activities ?? 0} việc</h2>
                <p className="mt-2 max-w-[560px] text-sm leading-6 text-white/68">
                  {selectedEngineerName} đã xử lý {summary?.totals.machines ?? 0} máy tại {summary?.totals.customers ?? 0} khách hàng trong khoảng {formatDate(from)} - {formatDate(to)}.
                </p>
              </div>
              <div className="rounded-[18px] border border-white/12 bg-white/10 px-4 py-3 text-right backdrop-blur">
                <span className="block text-xs font-semibold text-white/62">Hoàn tất</span>
                <strong className="mt-1 block text-3xl leading-none">{completionRate}%</strong>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <MiniMetric icon={<CalendarDays size={16} />} label="Lắp đặt" value={summary?.totals.installations ?? 0} />
              <MiniMetric icon={<Wrench size={16} />} label="Sửa chữa" value={summary?.totals.repairs ?? 0} />
              <MiniMetric icon={<BarChart3 size={16} />} label="Bảo trì" value={summary?.totals.maintenances ?? 0} />
            </div>
          </div>
        </article>

        <aside className="grid gap-3">
          <FocusCard
            icon={weeklyNeedsRevision > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            label="Báo cáo cần sửa"
            tone={weeklyNeedsRevision > 0 ? 'danger' : 'good'}
            value={weeklyNeedsRevision}
          />
          <FocusCard icon={<FileText size={18} />} label="Báo cáo chờ duyệt" tone={weeklySubmitted > 0 ? 'warn' : 'good'} value={weeklySubmitted} />
          <FocusCard icon={<CheckCircle2 size={18} />} label="Việc đã đóng / chưa đóng" note={`${unresolvedActivities} việc chưa đóng`} tone={unresolvedActivities > 0 ? 'warn' : 'good'} value={closedActivities} />
        </aside>
      </section>

      <section className="grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-4 max-[1120px]:grid-cols-1">
        <div className="rounded-[22px] border border-[#e5e5e5] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
          <PanelHeader eyebrow="Cơ cấu công việc" title="Tỷ trọng theo loại việc" subtitle="Nhìn nhanh loại việc chiếm nhiều thời gian nhất." />
          <div className="mt-4 grid gap-3">
            {workMix.map((item) => (
              <div className="grid gap-1.5" key={item.label}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-[#333333]">{item.label}</span>
                  <strong className={toneText(item.tone)}>{item.value}</strong>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#eeeeee]">
                  <span className={`block h-full rounded-full ${toneBar(item.tone)}`} style={{ width: `${Math.round((item.value / maxWorkValue) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <WorkDonut items={workMix} />
        </div>

        <div className="grid gap-4">
          <div className="rounded-[22px] border border-[#e5e5e5] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <PanelHeader eyebrow="Tuần đang xem" title={currentWeekReport ? `Báo cáo tuần ${formatDate(currentWeekReport.weekStart)}` : 'Chưa có báo cáo tuần'} subtitle={`${weeklyApproved} tuần đã duyệt, ${weeklyRowCount} dòng báo cáo trong kỳ.`} />
              <Link className="primary-button" to={currentWeeklyReportHref}>
                <FileText size={16} />
                Mở báo cáo
              </Link>
            </div>
            <div className="mt-4 rounded-[16px] border border-[#eeeeee] bg-[#fafafa] p-4">
              {currentWeekReport ? (
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-[#333333]">{weeklyStatusLabel(currentWeekReport.status)}</span>
                    <span className="text-xs font-medium text-[#666666]">{currentWeekReport.rows.length} dòng công việc</span>
                  </div>
                  <p className="line-clamp-3 text-sm leading-6 text-[#4b5563]">{currentWeekReport.note || firstWeeklyReportSummary(currentWeekReport) || 'Chưa có ghi chú hoặc nội dung báo cáo.'}</p>
                </div>
              ) : (
                <EmptyState text="Tuần đang chọn chưa có báo cáo. Mở báo cáo tuần để cập nhật nội dung." />
              )}
            </div>
          </div>

          <div className="rounded-[22px] border border-[#e5e5e5] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
            <PanelHeader eyebrow="Khách hàng nổi bật" title="Nơi phát sinh nhiều việc" subtitle={`${summary?.totals.customers ?? 0} khách hàng trong khoảng này`} />
            <div className="mt-4 grid gap-2">
              {topCustomers.length ? topCustomers.slice(0, 5).map((customer) => {
                const total = customer.installationCount + customer.repairCount + customer.maintenanceCount;
                const maxCustomer = Math.max(1, ...topCustomers.map((item) => item.installationCount + item.repairCount + item.maintenanceCount));

                return (
                  <div className="grid gap-2 rounded-[14px] bg-[#fafafa] p-3" key={customer.id || customer.name}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm text-[#1f1f1f]">{customer.name}</strong>
                      <span className="text-xs font-semibold text-[#333333]">{total} việc</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#eeeeee]">
                      <span className="block h-full rounded-full bg-[#18181b]" style={{ width: `${Math.round((total / maxCustomer) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-[#666666]">{[customer.code, customer.province, customer.phone].filter(Boolean).join(' - ') || displayCustomerStatus(customer.status)}</span>
                  </div>
                );
              }) : <EmptyState text="Chưa có khách hàng trong khoảng này." />}
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-[#e5e5e5] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.045)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eeeeee] bg-[#fafafa] px-4 py-3">
          <PanelHeader eyebrow="Nhật ký gần đây" title="Công việc trong kỳ" subtitle={`${summary?.activities.length ?? 0} đầu việc, hiển thị 10 dòng mới nhất`} />
          {currentTechnicalReportHref ? (
            <Link className="secondary-button" to={currentTechnicalReportHref}>
              <BarChart3 size={16} />
              Xem thống kê
            </Link>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="text-xs text-[#666666]">
                {['Ngày', 'Loại', 'Mã phiếu', 'Khách hàng', 'Máy', 'Kết quả'].map((header) => (
                  <th className="border-b border-[#eeeeee] px-4 py-3 font-medium" key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <LoadingRows /> : null}
              {!loading && recentActivities.length ? recentActivities.map((activity) => (
                <tr key={`${activity.kind}-${activity.id}`}>
                  <td className={cellClass}>{formatDate(activity.date)}</td>
                  <td className={cellClass}><span className="rounded-lg bg-[#fafafa] px-2 py-1 text-xs font-medium text-[#333333]">{activityKindLabel(activity.kind)}</span></td>
                  <td className={`${cellClass} font-medium text-[#1f1f1f]`}>{activity.code}</td>
                  <td className={cellClass}>
                    <strong className="block text-[#1f1f1f]">{activity.customer.name}</strong>
                    <span className="text-xs text-[#666666]">{displayCustomerStatus(activity.customer.status)}</span>
                  </td>
                  <td className={cellClass}>{machineSummaryLabel(activity.machine)}</td>
                  <td className={cellClass}>{activity.result || activity.title}</td>
                </tr>
              )) : null}
              {!loading && !recentActivities.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-[#666666]" colSpan={6}>Chưa có công việc hoàn thành trong khoảng này.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </PageFrame>
  );

  function setDateRange(nextFrom: Date, nextTo: Date) {
    setFrom(toDateInput(nextFrom));
    setTo(toDateInput(nextTo));
    setWeekStart(toDateInput(startOfWeek(nextFrom)));
  }
}

function MiniMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-white/12 bg-white/10 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-3 text-white/70">
        <span className="text-sm font-semibold">{label}</span>
        {icon}
      </div>
      <strong className="mt-3 block text-3xl leading-none tracking-[-0.03em] text-white">{value}</strong>
    </div>
  );
}

function FocusCard({ icon, label, note, tone, value }: { icon: ReactNode; label: string; note?: string; tone: 'good' | 'warn' | 'danger'; value: number }) {
  const toneClass = tone === 'good'
    ? 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]'
    : tone === 'danger'
      ? 'border-[#fecdd3] bg-[#fff1f3] text-[#b5121b]'
      : 'border-[#efd8a8] bg-[#fff8ed] text-[#9b5a17]';

  return (
    <div className={`grid min-h-[118px] content-between gap-3 rounded-[20px] border p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        {icon}
      </div>
      <div>
        <strong className="block text-3xl leading-none tracking-[-0.03em]">{value}</strong>
        {note ? <span className="mt-1 block text-xs font-semibold opacity-75">{note}</span> : null}
      </div>
    </div>
  );
}

function PanelHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div>
      <span className="text-[12px] font-medium text-[#666666]">{eyebrow}</span>
      <h2 className="mt-1 text-lg font-medium text-[#1f1f1f]">{title}</h2>
      {subtitle ? <p className="mt-1 line-clamp-1 text-xs font-medium text-[#8a8f99]">{subtitle}</p> : null}
    </div>
  );
}

function WorkDonut({ items }: { items: Array<{ label: string; value: number; tone: 'good' | 'warn' | 'neutral' }> }) {
  const total = Math.max(0, items.reduce((sum, item) => sum + item.value, 0));
  const radius = 46;
  const circumference = Math.PI * 2 * radius;
  let offset = 0;

  return (
    <div className="mt-5 grid grid-cols-[132px_minmax(0,1fr)] items-center gap-4 rounded-lg border border-[#eeeeee] bg-[#fafafa] p-3 max-sm:grid-cols-1">
      <div className="relative h-[132px] w-[132px] justify-self-center">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 132 132" role="img" aria-label="Biểu đồ tỷ trọng công việc">
          <circle cx="66" cy="66" fill="none" r={radius} stroke="#e8eef6" strokeWidth="16" />
          {total > 0 ? items.map((item) => {
            const segment = (item.value / total) * circumference;
            const dashOffset = -offset;
            offset += segment;
            return (
              <circle
                cx="66"
                cy="66"
                fill="none"
                key={item.label}
                r={radius}
                stroke={toneHex(item.tone)}
                strokeDasharray={`${segment} ${circumference - segment}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                strokeWidth="16"
              />
            );
          }) : null}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <span>
            <strong className="block text-2xl leading-none text-[#1f1f1f]">{total}</strong>
            <small className="text-xs font-medium text-[#666666]">việc</small>
          </span>
        </div>
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm" key={item.label}>
            <span className="inline-flex items-center gap-2 font-medium text-[#333333]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: toneHex(item.tone) }} />
              {item.label}
            </span>
            <strong className={toneText(item.tone)}>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 4 }, (_, index) => (
        <tr key={index}>
          {Array.from({ length: 6 }, (_, cell) => (
            <td className={cellClass} key={cell}>
              <span className="block h-4 animate-pulse rounded bg-[#eeeeee]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-[#e5e5e5] bg-[#fafafa] p-4 text-sm text-[#666666]">{text}</div>;
}

function activityKindLabel(kind: EngineerWorkSummary['activities'][number]['kind']) {
  if (kind === 'installation') return 'Lắp đặt';
  if (kind === 'repair') return 'Sửa chữa';
  return 'Bảo trì';
}

function machineSummaryLabel(machine: EngineerWorkSummary['activities'][number]['machine']) {
  return [machine.code, machine.serialNumber, machine.modelName || machine.name, machine.businessLine].filter(Boolean).join(' - ') || 'Chưa rõ máy';
}

function displayCustomerStatus(value?: string | null) {
  const labels: Record<string, string> = {
    ACTIVE: 'Đang hoạt động',
    INACTIVE: 'Ngưng hoạt động',
    POTENTIAL: 'Tiềm năng',
    BLACKLISTED: 'Hạn chế',
  };
  return value ? labels[value] ?? value : 'Chưa rõ';
}

function weeklyStatusLabel(value: EngineerWorkSummary['weeklyReports'][number]['status']) {
  const labels: Record<EngineerWorkSummary['weeklyReports'][number]['status'], string> = {
    DRAFT: 'Nháp',
    SUBMITTED: 'Đã gửi',
    APPROVED: 'Đã duyệt',
    NEEDS_REVISION: 'Cần sửa',
  };
  return labels[value] ?? value;
}

function buildWeeklyReportHref(weekStart: string, engineerId?: string) {
  const params = new URLSearchParams({ weekStart: toDateInput(startOfWeek(new Date(`${weekStart}T00:00:00`))) });
  if (engineerId) params.set('userId', engineerId);
  return `/weekly-reports?${params.toString()}`;
}

function buildTechnicalReportHref(from: string, to: string, engineerId: string, includeEngineerId: boolean, returnBasePath: string) {
  if (!from || !to || !engineerId) return '';
  const params = new URLSearchParams({ from, to, returnTo: `${returnBasePath}?from=${from}&to=${to}` });
  if (includeEngineerId) {
    params.set('engineerId', engineerId);
    params.set('returnTo', `${returnBasePath}?engineerId=${engineerId}&from=${from}&to=${to}`);
  }
  return `/technical-statistics?${params.toString()}`;
}

function toneText(tone: 'good' | 'warn' | 'neutral') {
  if (tone === 'good') return 'text-[#177245]';
  if (tone === 'warn') return 'text-[#9b5a17]';
  return 'text-[#18181b]';
}

function toneBar(tone: 'good' | 'warn' | 'neutral') {
  if (tone === 'good') return 'bg-[#177245]';
  if (tone === 'warn') return 'bg-[#9b5a17]';
  return 'bg-[#18181b]';
}

function toneHex(tone: 'good' | 'warn' | 'neutral') {
  if (tone === 'good') return '#177245';
  if (tone === 'warn') return '#9b5a17';
  return '#18181b';
}

function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function toDateInput(value: Date) {
  if (Number.isNaN(value.getTime())) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN').format(date);
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function firstWeeklyReportSummary(report: EngineerWorkSummary['weeklyReports'][number]) {
  const row = report.rows.find((item) => item.content || item.result || item.pending || item.proposal);
  return [row?.content, row?.result, row?.pending, row?.proposal].filter(Boolean).join(' - ');
}

const fieldClass = 'min-h-11 rounded-lg border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]';
const cellClass = 'border-b border-[#eeeeee] px-4 py-3 align-top text-[#333333]';

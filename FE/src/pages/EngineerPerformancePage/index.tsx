import { BarChart3, CalendarDays, Download, FileText, Loader2, RefreshCw, Users } from 'lucide-react';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';

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

export function EngineerPerformancePage({ currentRole, user }: EngineerPerformancePageProps) {
  const isAdmin = currentRole === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const [engineers, setEngineers] = useState<ApiUser[]>([]);
  const [engineerId, setEngineerId] = useState(() => searchParams.get('engineerId') || searchParams.get('userId') || (isAdmin ? '' : user.id));
  const [from, setFrom] = useState(() => searchParams.get('from') || toDateInput(startOfWeek(today)));
  const [to, setTo] = useState(() => searchParams.get('to') || toDateInput(addDays(startOfWeek(today), 6)));
  const [summary, setSummary] = useState<EngineerWorkSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    void loadEngineers();
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && !engineerId) return;
    syncUrl();
    void loadSummary();
  }, [engineerId, from, to, isAdmin]);

  const selectedEngineer = engineers.find((engineer) => engineer.id === engineerId);
  const workMix = [
    { label: 'Lắp đặt', value: summary?.totals.installations ?? 0, tone: 'good' as const },
    { label: 'Sửa chữa', value: summary?.totals.repairs ?? 0, tone: 'warn' as const },
    { label: 'Bảo trì', value: summary?.totals.maintenances ?? 0, tone: 'neutral' as const },
  ];
  const maxWorkValue = Math.max(1, ...workMix.map((item) => item.value));
  const selectedEngineerName = selectedEngineer?.fullName || summary?.engineer?.fullName || summary?.engineer?.email || user.fullName || user.email;
  const weeklyRowCount = summary?.weeklyReports?.reduce((sum, report) => sum + report.rows.length, 0) ?? 0;
  const currentWeeklyReportHref = buildWeeklyReportHref(from, isAdmin ? engineerId : '');
  const sortedWeeklyReports = useMemo(
    () => [...(summary?.weeklyReports ?? [])].sort((left, right) => right.weekStart.localeCompare(left.weekStart)),
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

  async function loadEngineers() {
    try {
      const result = await apiFetch<Paginated<ApiUser>>('/users?limit=100&roleName=engineer&status=ACTIVE');
      setEngineers(result.data);
      setEngineerId((current) => current || result.data[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách kỹ sư.');
    }
  }

  async function loadSummary() {
    if (isAdmin && !engineerId) return;
    setLoading(true);
    setError('');

    const query = new URLSearchParams({ from, to });
    if (isAdmin && engineerId) query.set('userId', engineerId);

    try {
      const result = await apiFetch<EngineerWorkSummary>(`/weekly-reports/summary?${query.toString()}`);
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dashboard hiệu suất.');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  function syncUrl() {
    const next = new URLSearchParams({ from, to });
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
        eyebrow="Báo cáo vận hành"
        title="Dashboard hiệu suất kỹ sư"
        description="Xem trực quan khối lượng lắp đặt, sửa chữa, bảo trì, khách hàng và máy đã xử lý theo khoảng thời gian."
      />

      {error ? <Notice message={error} /> : null}

      <section className="grid gap-4 rounded-lg border border-[#dde5ee] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_160px_160px_auto_auto]">
          {isAdmin ? (
            <label className="grid gap-1.5 text-sm font-medium text-[#344054]">
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
              <span className="text-xs font-medium text-[#667085]">Kỹ sư</span>
              <strong className="min-h-11 rounded-lg border border-[#dde5ee] bg-[#f8fafc] px-3 py-2.5 text-[#101828]">{user.fullName || user.email}</strong>
            </div>
          )}
          <label className="grid gap-1.5 text-sm font-medium text-[#344054]">
            Từ ngày
            <input className={fieldClass} onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-[#344054]">
            Đến ngày
            <input className={fieldClass} onChange={(event) => setTo(event.target.value)} type="date" value={to} />
          </label>
          <button className="secondary-button self-end" disabled={loading} onClick={loadSummary} type="button">
            {loading ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
            Cập nhật
          </button>
          <button className="secondary-button self-end" disabled={!summary?.activities.length} onClick={exportCsv} type="button">
            <Download size={16} />
            CSV
          </button>
        </div>
      </section>

      <section className="grid grid-cols-6 gap-3 max-[1180px]:grid-cols-3 max-sm:grid-cols-2">
        <MetricCard icon={<BarChart3 size={18} />} label="Tổng việc" value={summary?.totals.activities ?? 0} />
        <MetricCard icon={<CalendarDays size={18} />} label="Lắp đặt" value={summary?.totals.installations ?? 0} />
        <MetricCard icon={<BarChart3 size={18} />} label="Sửa chữa" value={summary?.totals.repairs ?? 0} />
        <MetricCard icon={<BarChart3 size={18} />} label="Bảo trì" value={summary?.totals.maintenances ?? 0} />
        <MetricCard icon={<Users size={18} />} label="Khách hàng" value={summary?.totals.customers ?? 0} />
        <MetricCard icon={<BarChart3 size={18} />} label="Máy tác động" value={summary?.totals.machines ?? 0} />
      </section>

      <section className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4 max-[1120px]:grid-cols-1">
        <div className="rounded-lg border border-[#dde5ee] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <PanelHeader eyebrow="Cơ cấu công việc" title="Tỷ trọng theo loại việc" subtitle={selectedEngineerName || ''} />
          <div className="mt-4 grid gap-3">
            {workMix.map((item) => (
              <div className="grid gap-1.5" key={item.label}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-[#344054]">{item.label}</span>
                  <strong className={toneText(item.tone)}>{item.value}</strong>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#edf2f7]">
                  <span className={`block h-full rounded-full ${toneBar(item.tone)}`} style={{ width: `${Math.round((item.value / maxWorkValue) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <WorkDonut items={workMix} />
        </div>

        <div className="rounded-lg border border-[#dde5ee] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <PanelHeader eyebrow="Khách hàng" title="Khách hàng xử lý nhiều nhất" subtitle={`${summary?.totals.customers ?? 0} khách trong khoảng này`} />
          <div className="mt-4 grid gap-2">
            {topCustomers.length ? topCustomers.map((customer) => {
              const total = customer.installationCount + customer.repairCount + customer.maintenanceCount;
              const maxCustomer = Math.max(1, ...topCustomers.map((item) => item.installationCount + item.repairCount + item.maintenanceCount));

              return (
                <div className="grid gap-2 rounded-lg border border-[#edf2f7] bg-[#fbfdff] p-3" key={customer.id || customer.name}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm text-[#101828]">{customer.name}</strong>
                    <span className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-[#344054]">{displayCustomerStatus(customer.status)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#edf2f7]">
                    <span className="block h-full rounded-full bg-[#d92d20]" style={{ width: `${Math.round((total / maxCustomer) * 100)}%` }} />
                  </div>
                  <span className="text-xs text-[#667085]">{total} việc, {customer.machineCount} máy - {[customer.code, customer.province, customer.phone].filter(Boolean).join(' - ') || '-'}</span>
                </div>
              );
            }) : <EmptyState text="Chưa có khách hàng trong khoảng này." />}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#dde5ee] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf2f7] bg-[#f8fafc] px-4 py-3">
          <PanelHeader eyebrow="Báo cáo tuần" title="Theo dõi báo cáo đã gửi" subtitle={`${sortedWeeklyReports.length} tuần, ${weeklyRowCount} dòng báo cáo trong khoảng này`} />
          <Link className="primary-button" to={currentWeeklyReportHref}>
            <FileText size={16} />
            Mở tuần đang xem
          </Link>
        </div>
        <div className="grid gap-3 p-4">
          {sortedWeeklyReports.length ? sortedWeeklyReports.map((report) => (
            <div className="grid gap-3 rounded-lg border border-[#edf2f7] bg-white p-3 md:grid-cols-[minmax(0,1fr)_auto]" key={report.id}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-[#101828]">Tuần {formatDate(report.weekStart)}</strong>
                  <span className="rounded-lg bg-[#f8fafc] px-2 py-1 text-xs font-medium text-[#344054]">{weeklyStatusLabel(report.status)}</span>
                  <span className="text-xs text-[#667085]">{report.rows.length} dòng</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-[#667085]">
                  {report.note || firstWeeklyReportSummary(report) || 'Chưa có ghi chú hoặc nội dung báo cáo.'}
                </p>
                {report.submittedAt ? <span className="mt-1 block text-xs text-[#98a2b3]">Gửi ngày {formatDate(report.submittedAt)}</span> : null}
              </div>
              <Link className="secondary-button self-center" to={buildWeeklyReportHref(report.weekStart, isAdmin ? engineerId : '')}>
                <FileText size={16} />
                Mở báo cáo
              </Link>
            </div>
          )) : <EmptyState text="Chưa có dòng báo cáo tuần trong khoảng này." />}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#dde5ee] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="border-b border-[#edf2f7] bg-[#f8fafc] px-4 py-3">
          <PanelHeader eyebrow="Timeline" title="Công việc đã hoàn thành" subtitle={`${summary?.activities.length ?? 0} đầu việc`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="text-xs text-[#667085]">
                {['Ngày', 'Loại', 'Mã phiếu', 'Khách hàng', 'Máy', 'Kết quả'].map((header) => (
                  <th className="border-b border-[#edf2f7] px-4 py-3 font-medium" key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <LoadingRows /> : null}
              {!loading && summary?.activities.length ? summary.activities.map((activity) => (
                <tr key={`${activity.kind}-${activity.id}`}>
                  <td className={cellClass}>{formatDate(activity.date)}</td>
                  <td className={cellClass}><span className="rounded-lg bg-[#f8fafc] px-2 py-1 text-xs font-medium text-[#344054]">{activityKindLabel(activity.kind)}</span></td>
                  <td className={`${cellClass} font-medium text-[#101828]`}>{activity.code}</td>
                  <td className={cellClass}>
                    <strong className="block text-[#101828]">{activity.customer.name}</strong>
                    <span className="text-xs text-[#667085]">{displayCustomerStatus(activity.customer.status)}</span>
                  </td>
                  <td className={cellClass}>{machineSummaryLabel(activity.machine)}</td>
                  <td className={cellClass}>{activity.result || activity.title}</td>
                </tr>
              )) : null}
              {!loading && !summary?.activities.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-[#667085]" colSpan={6}>Chưa có công việc hoàn thành trong khoảng này.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </PageFrame>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="grid min-h-[104px] gap-2 rounded-lg border border-[#dde5ee] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[#667085]">{label}</span>
        <span className="text-[#d92d20]">{icon}</span>
      </div>
      <strong className="text-3xl leading-none text-[#101828]">{value}</strong>
    </div>
  );
}

function PanelHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div>
      <span className="text-[12px] font-medium text-[#667085]">{eyebrow}</span>
      <h2 className="mt-1 text-lg font-medium text-[#101828]">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-[#667085]">{subtitle}</p> : null}
    </div>
  );
}

function WorkDonut({ items }: { items: Array<{ label: string; value: number; tone: 'good' | 'warn' | 'neutral' }> }) {
  const total = Math.max(0, items.reduce((sum, item) => sum + item.value, 0));
  const radius = 46;
  const circumference = Math.PI * 2 * radius;
  let offset = 0;

  return (
    <div className="mt-5 grid grid-cols-[132px_minmax(0,1fr)] items-center gap-4 rounded-lg border border-[#edf2f7] bg-[#fbfdff] p-3 max-sm:grid-cols-1">
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
            <strong className="block text-2xl leading-none text-[#101828]">{total}</strong>
            <small className="text-xs font-medium text-[#667085]">việc</small>
          </span>
        </div>
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm" key={item.label}>
            <span className="inline-flex items-center gap-2 font-medium text-[#344054]">
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
              <span className="block h-4 animate-pulse rounded bg-[#edf2f7]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-[#dde5ee] bg-[#fbfdff] p-4 text-sm text-[#667085]">{text}</div>;
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

function toneText(tone: 'good' | 'warn' | 'neutral') {
  if (tone === 'good') return 'text-[#067647]';
  if (tone === 'warn') return 'text-[#b54708]';
  return 'text-[#175cd3]';
}

function toneBar(tone: 'good' | 'warn' | 'neutral') {
  if (tone === 'good') return 'bg-[#067647]';
  if (tone === 'warn') return 'bg-[#b54708]';
  return 'bg-[#175cd3]';
}

function toneHex(tone: 'good' | 'warn' | 'neutral') {
  if (tone === 'good') return '#067647';
  if (tone === 'warn') return '#b54708';
  return '#175cd3';
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

const fieldClass = 'min-h-11 rounded-lg border border-[#cfd8e3] bg-white px-3 text-[#101828] outline-none focus:border-[#d92d20] focus:shadow-[0_0_0_3px_rgba(217,45,32,0.12)]';
const cellClass = 'border-b border-[#edf2f7] px-4 py-3 align-top text-[#344054]';

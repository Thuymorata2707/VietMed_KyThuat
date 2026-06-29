import { useQuery } from '@tanstack/react-query';
import { ArrowDownWideNarrow, CalendarDays, Loader2, MapPinned, PackageCheck, Table2, UserRound, Users } from 'lucide-react';
import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../api';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { queryKeys } from '../../lib/queryKeys';

type ReportView = 'summary' | 'engineers' | 'machines' | 'customers' | 'models' | 'provinces' | 'details';

type InstallationReportGroup = {
  id: string;
  label: string;
  count: number;
  customers: number;
  machines: number;
  engineers: number;
  provinces: number;
  lastInstalledAt: string | null;
};

type InstallationReportRow = {
  id: string;
  code: string;
  status: string;
  reviewStatus: string;
  installedAt: string;
  engineer: string;
  customer: string;
  province: string;
  region: string;
  model: string;
  machineCode: string;
  serialNumber: string;
};

type InstallationReport = {
  filters: {
    from: string;
    to: string;
  };
  summary: {
    totalInstallations: number;
    totalMachines: number;
    totalCustomers: number;
    totalEngineers: number;
    totalProvinces: number;
  };
  byEngineer: InstallationReportGroup[];
  byCustomer: InstallationReportGroup[];
  byModel: InstallationReportGroup[];
  byProvince: InstallationReportGroup[];
  rows: InstallationReportRow[];
};

const reportTabs: Array<{ key: ReportView; label: string; icon: ReactNode }> = [
  { key: 'summary', label: 'Tổng hợp', icon: <PackageCheck size={16} /> },
  { key: 'engineers', label: 'Tất cả kỹ sư', icon: <UserRound size={16} /> },
  { key: 'machines', label: 'Máy lắp trong kỳ', icon: <ArrowDownWideNarrow size={16} /> },
  { key: 'customers', label: 'Tất cả khách hàng', icon: <Users size={16} /> },
  { key: 'models', label: 'Từng model máy', icon: <Table2 size={16} /> },
  { key: 'provinces', label: 'Theo tỉnh', icon: <MapPinned size={16} /> },
  { key: 'details', label: 'Chi tiết', icon: <CalendarDays size={16} /> },
];

export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = normalizeView(searchParams.get('view'));
  const defaultDates = useMemo(() => currentMonthRange(), []);
  const from = searchParams.get('from') || defaultDates.from;
  const to = searchParams.get('to') || defaultDates.to;
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const requestParams = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    return params.toString();
  }, [from, to]);
  const reportQuery = useQuery({
    queryKey: queryKeys.reports.installations(requestParams),
    queryFn: () => apiFetch<InstallationReport>(`/reports/installations?${requestParams}`),
  });
  const report = reportQuery.data;
  const loading = reportQuery.isLoading || reportQuery.isFetching;
  const error = reportQuery.error instanceof Error ? reportQuery.error.message : reportQuery.isError ? 'Không tải được báo cáo' : '';

  function changeView(nextView: ReportView) {
    const next = new URLSearchParams(searchParams);
    next.set('view', nextView);
    next.set('from', from);
    next.set('to', to);
    setSearchParams(next);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    next.set('view', activeView);
    next.set('from', draftFrom);
    next.set('to', draftTo);
    setSearchParams(next);
  }

  return (
    <PageFrame>
      <div className="grid gap-5 rounded-[14px] border border-[#d9e1eb] bg-white p-5 shadow-[0_18px_46px_rgba(28,39,56,0.07)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageTitle
            description="Tổng hợp số lượng máy lắp đặt theo kỹ sư, khách hàng, model và địa bàn trong một kỳ báo cáo."
            eyebrow="Báo cáo vận hành"
            title="Báo cáo lắp đặt"
          />
          <form className="flex flex-wrap items-end gap-2 rounded-[10px] border border-[#e9edf2] bg-[#f8fafc] p-3" onSubmit={applyFilters}>
            <label className="grid gap-1 text-xs font-semibold text-[#647084]">
              Từ ngày
              <input className="h-10 rounded-lg border border-[#dde3ea] bg-white px-3 text-sm font-medium text-[#18212f]" onChange={(event) => setDraftFrom(event.target.value)} type="date" value={draftFrom} />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[#647084]">
              Đến ngày
              <input className="h-10 rounded-lg border border-[#dde3ea] bg-white px-3 text-sm font-medium text-[#18212f]" onChange={(event) => setDraftTo(event.target.value)} type="date" value={draftTo} />
            </label>
            <button className="inline-flex h-10 items-center justify-center rounded-lg bg-[#18212f] px-3.5 text-sm font-semibold text-white hover:bg-[#c91f2d]" type="submit">
              Áp dụng
            </button>
          </form>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-[#e9edf2] pb-3">
          {reportTabs.map((tab) => (
            <button
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
                activeView === tab.key
                  ? 'border-[#f1c4c9] bg-[#fff3f4] text-[#a81524]'
                  : 'border-[#dde3ea] bg-white text-[#647084] hover:border-[#f1c4c9] hover:text-[#c91f2d]'
              }`}
              key={tab.key}
              onClick={() => changeView(tab.key)}
              type="button"
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="rounded-lg border border-[#f1c4c9] bg-[#fff3f4] px-4 py-3 text-sm font-medium text-[#a81524]">{error}</div>
        ) : null}

        {loading && !report ? (
          <div className="grid min-h-[360px] place-items-center rounded-[10px] border border-[#e9edf2] bg-[#f8fafc] text-[#647084]">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <Loader2 className="spin-icon" size={18} />
              Đang tổng hợp báo cáo
            </span>
          </div>
        ) : report ? (
          <ReportContent report={report} view={activeView} />
        ) : null}
      </div>
    </PageFrame>
  );
}

function ReportContent({ report, view }: { report: InstallationReport; view: ReportView }) {
  if (view === 'summary') {
    return (
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Tổng phiếu lắp đặt" value={report.summary.totalInstallations} />
          <SummaryCard label="Máy lắp trong kỳ" value={report.summary.totalMachines} />
          <SummaryCard label="Khách hàng" value={report.summary.totalCustomers} />
          <SummaryCard label="Kỹ sư tham gia" value={report.summary.totalEngineers} />
          <SummaryCard label="Tỉnh phát sinh" value={report.summary.totalProvinces} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <GroupTable rows={report.byEngineer.slice(0, 8)} title="Kỹ sư lắp đặt nổi bật" variant="engineers" />
          <GroupTable rows={report.byProvince.slice(0, 8)} title="Tỉnh có phát sinh lắp đặt" variant="provinces" />
        </div>
      </div>
    );
  }

  if (view === 'engineers') {
    return <GroupTable rows={report.byEngineer} title="Báo cáo tổng hợp theo tất cả kỹ sư" variant="engineers" />;
  }

  if (view === 'machines') {
    return <DetailTable rows={report.rows} title="Báo cáo tổng hợp theo số lượng tất cả máy lắp đặt trong kỳ" />;
  }

  if (view === 'customers') {
    return <GroupTable rows={report.byCustomer} title="Báo cáo tổng hợp theo tất cả khách hàng" variant="customers" />;
  }

  if (view === 'models') {
    return <GroupTable rows={report.byModel} title="Báo cáo tổng hợp theo từng model máy" variant="models" />;
  }

  if (view === 'provinces') {
    return <GroupTable rows={report.byProvince} title="Báo cáo tổng hợp theo từng vùng địa lý theo tỉnh" variant="provinces" />;
  }

  return <DetailTable rows={report.rows} title="Danh sách chi tiết phiếu lắp đặt trong kỳ" />;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid min-h-[118px] content-between rounded-[10px] border border-[#e9edf2] bg-[#f8fafc] p-4">
      <span className="text-sm font-semibold text-[#647084]">{label}</span>
      <strong className="text-[36px] leading-none text-[#18212f]">{value}</strong>
    </div>
  );
}

function GroupTable({
  title,
  rows,
  variant,
}: {
  title: string;
  rows: InstallationReportGroup[];
  variant: 'engineers' | 'customers' | 'models' | 'provinces';
}) {
  const labelHeader =
    variant === 'engineers' ? 'Kỹ sư' : variant === 'customers' ? 'Khách hàng' : variant === 'models' ? 'Model máy' : 'Tỉnh';

  return (
    <section className="overflow-hidden rounded-[10px] border border-[#e9edf2] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9edf2] bg-[#f8fafc] px-4 py-3">
        <h2 className="text-base font-semibold text-[#18212f]">{title}</h2>
        <span className="text-xs font-semibold text-[#647084]">{rows.length} dòng</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase text-[#647084]">
              <th className="border-b border-[#e9edf2] px-4 py-2.5 font-semibold">{labelHeader}</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5 font-semibold">Số phiếu</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5 font-semibold">Máy</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5 font-semibold">Khách hàng</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5 font-semibold">Kỹ sư</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5 font-semibold">Tỉnh</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5 font-semibold">Lắp gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="hover:bg-[#fffafa]" key={row.id}>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-bold text-[#18212f]">{row.label}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-lg font-bold text-[#a81524]">{row.count}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#303a4b]">{row.machines}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#303a4b]">{row.customers}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#303a4b]">{row.engineers}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#303a4b]">{row.provinces}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#647084]">{formatDate(row.lastInstalledAt)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-medium text-[#647084]" colSpan={7}>
                  Không có dữ liệu trong kỳ này.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DetailTable({ title, rows }: { title: string; rows: InstallationReportRow[] }) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-[#e9edf2] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9edf2] bg-[#f8fafc] px-4 py-3">
        <h2 className="text-base font-semibold text-[#18212f]">{title}</h2>
        <span className="text-xs font-semibold text-[#647084]">{rows.length} máy / phiếu</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase text-[#647084]">
              <th className="border-b border-[#e9edf2] px-4 py-2.5 font-semibold">Mã phiếu</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5 font-semibold">Ngày lắp</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5 font-semibold">Kỹ sư</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5 font-semibold">Khách hàng</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5 font-semibold">Model</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5 font-semibold">Mã máy</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5 font-semibold">Serial</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5 font-semibold">Tỉnh</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5 font-semibold">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="hover:bg-[#fffafa]" key={row.id}>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-bold text-[#18212f]">
                  <Link className="hover:text-[#c91f2d]" to={`/installations/${row.id}/update`}>
                    {row.code}
                  </Link>
                </td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#647084]">{formatDate(row.installedAt)}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#303a4b]">{row.engineer}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold text-[#303a4b]">{row.customer}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#303a4b]">{row.model}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#303a4b]">{row.machineCode}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#303a4b]">{row.serialNumber}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#303a4b]">{row.province}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3">
                  <span className="inline-flex min-h-7 items-center rounded-lg border border-[#dde3ea] bg-[#f8fafc] px-2.5 text-xs font-semibold text-[#647084]">
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-medium text-[#647084]" colSpan={9}>
                  Không có dữ liệu trong kỳ này.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function normalizeView(value: string | null): ReportView {
  return reportTabs.some((tab) => tab.key === value) ? (value as ReportView) : 'summary';
}

function currentMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    from: toDateInput(from),
    to: toDateInput(to),
  };
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('vi-VN');
}

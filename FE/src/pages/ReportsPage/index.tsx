import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BarChart3, CalendarDays, Download, Loader2, MapPinned, PackageCheck, Table2, Users, Wrench } from 'lucide-react';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../api';
import { DateInput } from '../../components/DateInput';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { queryKeys } from '../../lib/queryKeys';
import { displayLabel } from '../../utils/displayLabels';

type ReportView = 'summary' | 'kinds' | 'customers' | 'machines' | 'models' | 'provinces' | 'details' | 'customer';
type WorkKind = 'installation' | 'repair' | 'maintenance' | 'demo' | 'applicationSupport';

type EngineerFilterOption = {
  id: string;
  email: string;
  fullName?: string | null;
  region?: { id: string; name: string } | null;
};

type WorkReportRow = {
  id: string;
  code: string;
  kind: WorkKind;
  title: string;
  status: string;
  date: string;
  completedAt: string | null;
  engineerId: string | null;
  engineer: string;
  customerId: string | null;
  customer: string;
  province: string;
  machineId: string | null;
  machineModelId: string | null;
  model: string;
  machineCode: string;
  serialNumber: string;
  note: string | null;
};

type TechnicalReportGroup = {
  id: string;
  label: string;
  total: number;
  installation: number;
  repair: number;
  maintenance: number;
  demo: number;
  applicationSupport: number;
  customers: number;
  machines: number;
  lastWorkedAt: string | null;
};

type TechnicalMachineGroup = {
  id: string;
  machineCode: string;
  serialNumber: string;
  model: string;
  customer: string;
  customerId: string | null;
  province: string;
  total: number;
  installation: number;
  repair: number;
  maintenance: number;
  demo: number;
  applicationSupport: number;
  lastWorkedAt: string | null;
};

type TechnicalEngineerCustomer = TechnicalReportGroup & {
  province: string;
  latestWork: WorkReportRow | null;
};

type TechnicalEngineerDetail = TechnicalReportGroup & {
  customersList: TechnicalEngineerCustomer[];
  recentWorks: WorkReportRow[];
};

type FilterOption = { id: string; label: string };

type TechnicalReport = {
  filters: {
    from: string;
    to: string;
    engineers?: EngineerFilterOption[];
    customers?: FilterOption[];
    models?: FilterOption[];
    provinces?: FilterOption[];
  };
  summary: {
    total: number;
    installations: number;
    repairs: number;
    maintenances: number;
    demos: number;
    applicationSupport: number;
    customers: number;
    machines: number;
    engineers: number;
    provinces: number;
  };
  byEngineer: TechnicalReportGroup[];
  engineerDetails: TechnicalEngineerDetail[];
  byCustomer: TechnicalReportGroup[];
  byMachine: TechnicalMachineGroup[];
  byModel: TechnicalReportGroup[];
  byProvince: TechnicalReportGroup[];
  rows: WorkReportRow[];
};

const reportTabs: Array<{ key: ReportView; label: string; icon: ReactNode }> = [
  { key: 'summary', label: 'Tổng quan', icon: <BarChart3 size={16} /> },
  { key: 'kinds', label: 'Loại việc', icon: <Wrench size={16} /> },
  { key: 'customers', label: 'Khách hàng', icon: <Users size={16} /> },
  { key: 'machines', label: 'Máy', icon: <PackageCheck size={16} /> },
  { key: 'models', label: 'Model', icon: <Table2 size={16} /> },
  { key: 'provinces', label: 'Tỉnh', icon: <MapPinned size={16} /> },
  { key: 'details', label: 'Chi tiết', icon: <CalendarDays size={16} /> },
];

const reportFieldClass =
  'h-11 min-w-0 rounded-2xl border border-[#ded8d8] bg-[#ffffff] px-3.5 text-sm font-semibold text-[#1f1f1f] outline-none transition hover:border-[#e4e4e7] focus:border-[#18181b] focus:shadow-[0_0_0_4px_rgba(24,24,27,0.12)]';
const reportTablePageSize = 10;

export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultDates = useMemo(() => currentMonthRange(), []);
  const activeView = normalizeView(searchParams.get('view'));
  const from = searchParams.get('from') || defaultDates.from;
  const to = searchParams.get('to') || defaultDates.to;
  const engineerId = searchParams.get('engineerId') || '';
  const customer = searchParams.get('customer') || '';
  const model = searchParams.get('model') || '';
  const province = searchParams.get('province') || '';
  const focusCustomerId = searchParams.get('customerDetail') || '';
  const isCustomerDetail = activeView === 'customer' && Boolean(focusCustomerId);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  const requestParams = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    if (engineerId) params.set('engineerId', engineerId);
    if (customer) params.set('customerId', customer);
    if (model) params.set('machineModelId', model);
    if (province) params.set('province', province);
    return params.toString();
  }, [customer, engineerId, from, model, province, to]);

  const reportQuery = useQuery({
    queryKey: queryKeys.reports.technical(requestParams),
    queryFn: () => apiFetch<TechnicalReport>(`/reports/technical?${requestParams}`),
  });

  const report = reportQuery.data;
  const loading = reportQuery.isLoading || reportQuery.isFetching;
  const error = reportQuery.error instanceof Error ? reportQuery.error.message : '';
  const filterOptions = useMemo(() => buildFilterOptions(report), [report]);

  function changeView(view: ReportView) {
    const next = new URLSearchParams(searchParams);
    next.set('view', view);
    next.set('from', from);
    next.set('to', to);
    if (view !== 'customer') next.delete('customerDetail');
    setSearchParams(next);
  }

  function openCustomer(customerId: string) {
    const next = new URLSearchParams(searchParams);
    next.set('view', 'customer');
    next.set('customerDetail', customerId);
    next.set('from', from);
    next.set('to', to);
    setSearchParams(next);
  }

  function updateFilter(key: 'from' | 'to' | 'engineerId' | 'customer' | 'model' | 'province', value: string) {
    const next = new URLSearchParams(searchParams);
    next.set('view', activeView);
    next.set('from', key === 'from' ? value : from);
    next.set('to', key === 'to' ? value : to);
    setOrDelete(next, 'engineerId', key === 'engineerId' ? value : engineerId);
    setOrDelete(next, 'customer', key === 'customer' ? value : customer);
    setOrDelete(next, 'model', key === 'model' ? value : model);
    setOrDelete(next, 'province', key === 'province' ? value : province);
    setSearchParams(next);
  }

  function resetFilters() {
    setDraftFrom(defaultDates.from);
    setDraftTo(defaultDates.to);
    const next = new URLSearchParams({ view: activeView });
    setSearchParams(next);
  }

  function exportCsv() {
    if (!report) return;
    exportRows(`bao-cao-tong-hop-${from}-${to}.csv`, report.rows);
  }

  return (
    <PageFrame>
      <div className="grid gap-5 rounded-[28px] bg-white/95 p-5 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07),0_12px_30px_rgba(24,24,27,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageTitle
            description="Theo khách hàng & máy — bấm vào khách hàng để xem chi tiết."
            eyebrow="Báo cáo kỹ thuật"
            title="Báo cáo tổng hợp"
          />
          <button className="secondary-button" disabled={!report} onClick={exportCsv} type="button">
            <Download size={16} />
            Xuất CSV
          </button>
        </div>

        <section className="grid gap-3 rounded-[24px] bg-[#fafafa] p-3 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm text-[#202124]">Bộ lọc báo cáo</strong>
            <button className="secondary-button compact" onClick={resetFilters} type="button">
              Xóa lọc
            </button>
          </div>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
            <DateInput className="grid gap-1.5 text-xs font-semibold text-[#667085]" label="Từ ngày" onChange={(value) => { setDraftFrom(value); updateFilter('from', value); }} value={draftFrom} />
            <DateInput className="grid gap-1.5 text-xs font-semibold text-[#667085]" label="Đến ngày" onChange={(value) => { setDraftTo(value); updateFilter('to', value); }} value={draftTo} />
            <SelectFilter label="Kỹ sư" onChange={(value) => updateFilter('engineerId', value)} options={filterOptions.engineers} value={engineerId} />
            <SelectFilter label="Khách hàng" onChange={(value) => updateFilter('customer', value)} options={filterOptions.customers} value={customer} />
            <SelectFilter label="Model" onChange={(value) => updateFilter('model', value)} options={filterOptions.models} value={model} />
            <SelectFilter label="Tỉnh" onChange={(value) => updateFilter('province', value)} options={filterOptions.provinces} value={province} />
          </div>
        </section>

        <div className="flex gap-2 overflow-x-auto border-b border-[#e4e4e7] pb-3">
          {reportTabs.map((tab) => (
            <button
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition ${
                activeView === tab.key
                  ? 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]'
                  : 'border-[#ded8d8] bg-white text-[#667085] hover:text-[#18181b]'
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

        {error ? <Notice message={error} /> : null}
        {loading && !report ? <LoadingState /> : null}
        {report ? <ReportSummary report={report} from={from} to={to} /> : null}
        {report ? (
          isCustomerDetail ? (
            <CustomerDetailView customerId={focusCustomerId} onBack={() => changeView('customers')} report={report} />
          ) : (
            <ReportContent onOpenCustomer={openCustomer} report={report} view={activeView} />
          )
        ) : null}
      </div>
    </PageFrame>
  );
}

function SelectFilter({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<{ id: string; label: string }>; value: string }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#667085]">
      {label}
      <select className={reportFieldClass} onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">Tất cả</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReportSummary({ from, report, to }: { from: string; report: TechnicalReport; to: string }) {
  return (
    <section className="grid gap-4 rounded-[24px] bg-[#f6f8f7] p-4 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.06)]">
      <div>
        <span className="text-xs font-bold uppercase text-[#3e8375]">Tóm tắt kỳ</span>
        <h2 className="mt-1 text-xl font-semibold text-[#202124]">
          {report.summary.total} việc từ {formatDate(from)} đến {formatDate(to)}
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Tổng việc" value={report.summary.total} />
        <SummaryCard label="Lắp đặt" value={report.summary.installations} />
        <SummaryCard label="Sửa chữa" value={report.summary.repairs} />
        <SummaryCard label="Bảo trì" value={report.summary.maintenances} />
        <SummaryCard label="Demo" value={report.summary.demos} />
        <SummaryCard label="Hỗ trợ app" value={report.summary.applicationSupport} />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <MiniSummary label="Khách hàng" value={report.summary.customers} />
        <MiniSummary label="Máy/model" value={report.summary.machines} />
        <MiniSummary label="Kỹ sư" value={report.summary.engineers} />
        <MiniSummary label="Tỉnh" value={report.summary.provinces} />
      </div>
    </section>
  );
}

function ReportContent({ onOpenCustomer, report, view }: { onOpenCustomer: (customerId: string) => void; report: TechnicalReport; view: ReportView }) {
  if (view === 'summary') {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <CustomerHighlights onOpen={onOpenCustomer} report={report} title="Khách hàng phát sinh nhiều việc" />
        <MachineGroupTable rows={report.byMachine.slice(0, 6)} title="Máy phát sinh nhiều việc" />
        <KindTable report={report} />
        <TrendPanel rows={report.rows} />
      </div>
    );
  }
  if (view === 'kinds') return <KindTable report={report} />;
  if (view === 'customers') return <GroupTable onSelect={onOpenCustomer} rows={report.byCustomer} title="Theo khách hàng" />;
  if (view === 'machines') return <MachineGroupTable rows={report.byMachine} title="Theo máy" />;
  if (view === 'models') return <GroupTable rows={report.byModel} title="Theo model" />;
  if (view === 'provinces') return <GroupTable rows={report.byProvince} title="Theo tỉnh" />;
  return <DetailTable rows={report.rows} />;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-2 rounded-[20px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.06)]">
      <span className="text-sm font-medium text-[#667085]">{label}</span>
      <strong className="text-3xl font-semibold text-[#202124]">{value}</strong>
    </div>
  );
}

function MiniSummary({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-3">
      <span className="text-sm font-medium text-[#667085]">{label}</span>
      <strong className="text-lg text-[#202124]">{value}</strong>
    </div>
  );
}

function KindTable({ report }: { report: TechnicalReport }) {
  const rows = [
    { key: 'installation' as WorkKind, label: 'Lắp đặt', value: report.summary.installations },
    { key: 'repair' as WorkKind, label: 'Sửa chữa', value: report.summary.repairs },
    { key: 'maintenance' as WorkKind, label: 'Bảo trì', value: report.summary.maintenances },
    { key: 'demo' as WorkKind, label: 'Demo / dùng thử', value: report.summary.demos },
    { key: 'applicationSupport' as WorkKind, label: 'Hỗ trợ app', value: report.summary.applicationSupport },
  ];
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <section className="rounded-[24px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07)]">
      <TableTitle count={rows.length} title="Theo loại việc" />
      <div className="mt-3 grid gap-3">
        {rows.map((row) => (
          <div className="grid gap-2" key={row.key}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-[#202124]">{row.label}</span>
              <strong>{row.value}</strong>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#eef0f3]">
              <span className="block h-full rounded-full bg-[#3e8375]" style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function GroupTable({ onSelect, rows, title }: { onSelect?: (id: string) => void; rows: TechnicalReportGroup[]; title: string }) {
  const pagination = usePagedRows(rows, title);

  return (
    <section className="overflow-hidden rounded-[24px] bg-white shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07)]">
      <TableTitle count={rows.length} title={title} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="text-xs uppercase text-[#667085]">
            <tr>
              <th className="border-b border-[#eef0f3] px-4 py-3">Tên</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Tổng</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Lắp</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Sửa</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Bảo trì</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Demo</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">App</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Phạm vi</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {pagination.rows.map((row) => (
              <tr className="hover:bg-[#fafafa]" key={row.id}>
                <td className="border-b border-[#f1f2f4] px-4 py-3">
                  {onSelect ? (
                    <button className="inline-flex items-center gap-1 font-semibold text-[#202124] transition hover:text-[#3e8375]" onClick={() => onSelect(row.id)} type="button">
                      {row.label}
                      <ArrowLeft className="rotate-180" size={14} />
                    </button>
                  ) : (
                    <span className="font-semibold text-[#202124]">{row.label}</span>
                  )}
                </td>
                <td className="border-b border-[#f1f2f4] px-4 py-3 font-semibold">{row.total}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">{row.installation}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">{row.repair}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">{row.maintenance}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">{row.demo}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">{row.applicationSupport}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3 text-[#667085]">{row.customers} khách · {row.machines} máy</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3 text-[#667085]">{formatDate(row.lastWorkedAt)}</td>
              </tr>
            ))}
            <EmptyRow colSpan={9} show={!rows.length} />
          </tbody>
        </table>
      </div>
      <ReportTablePager {...pagination} label="kết quả" />
    </section>
  );
}

function MachineGroupTable({ rows, title }: { rows: TechnicalMachineGroup[]; title: string }) {
  const pagination = usePagedRows(rows, title);

  return (
    <section className="overflow-hidden rounded-[24px] bg-white shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07)]">
      <TableTitle count={rows.length} title={title} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="text-xs uppercase text-[#667085]">
            <tr>
              <th className="border-b border-[#eef0f3] px-4 py-3">Máy</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Model</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Khách hàng</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Tỉnh</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Tổng</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Lắp</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Sửa</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Bảo trì</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Demo</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">App</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {pagination.rows.map((row) => (
              <tr className="hover:bg-[#fafafa]" key={row.id}>
                <td className="border-b border-[#f1f2f4] px-4 py-3">
                  <strong className="block text-[#202124]">{row.machineCode}</strong>
                  <span className="text-xs text-[#667085]">{row.serialNumber}</span>
                </td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">{row.model}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">
                  {row.customerId ? <Link className="hover:text-[#3e8375]" to={`/customers/profile?customerId=${row.customerId}`}>{row.customer}</Link> : row.customer}
                </td>
                <td className="border-b border-[#f1f2f4] px-4 py-3 text-[#667085]">{row.province}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3 font-semibold">{row.total}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">{row.installation}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">{row.repair}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">{row.maintenance}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">{row.demo}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">{row.applicationSupport}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3 text-[#667085]">{formatDate(row.lastWorkedAt)}</td>
              </tr>
            ))}
            <EmptyRow colSpan={11} show={!rows.length} />
          </tbody>
        </table>
      </div>
      <ReportTablePager {...pagination} label="máy" />
    </section>
  );
}

function TrendPanel({ rows }: { rows: WorkReportRow[] }) {
  const buckets = buildTrendBuckets(rows);
  const max = Math.max(1, ...buckets.map((item) => item.total));
  return (
    <section className="rounded-[24px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07)]">
      <TableTitle count={rows.length} title="Xu hướng theo ngày" />
      <div className="mt-4 grid min-h-[180px] grid-cols-[repeat(auto-fit,minmax(50px,1fr))] items-end gap-2">
        {buckets.map((item) => (
          <div className="grid gap-2 text-center" key={item.label}>
            <div className="flex h-[120px] items-end rounded-xl bg-[#f6f8f7] px-2">
              <span className="block w-full rounded-t-lg bg-[#3e8375]" style={{ height: `${Math.max(6, (item.total / max) * 100)}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-[#667085]">{item.label}</span>
            <strong className="text-sm">{item.total}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function DetailTable({ rows }: { rows: WorkReportRow[] }) {
  const pagination = usePagedRows(rows, 'details');

  return (
    <section className="overflow-hidden rounded-[24px] bg-white shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07)]">
      <TableTitle count={rows.length} title="Chi tiết tất cả phiếu trong kỳ" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="text-xs uppercase text-[#667085]">
            <tr>
              <th className="border-b border-[#eef0f3] px-4 py-3">Phiếu</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Loại</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Ngày</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Kỹ sư</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Khách hàng</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Máy/model</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Nội dung</th>
              <th className="border-b border-[#eef0f3] px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {pagination.rows.map((row) => (
              <tr className="hover:bg-[#fafafa]" key={`${row.kind}-${row.id}`}>
                <td className="border-b border-[#f1f2f4] px-4 py-3 font-semibold text-[#202124]">
                  {workHref(row) ? <Link className="hover:text-[#3e8375]" to={workHref(row)!}>{row.code}</Link> : row.code}
                </td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">{workLabel(row.kind)}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3 text-[#667085]">{formatDate(row.date)}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">{row.engineer}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">{row.customerId ? <Link to={`/customers/profile?customerId=${row.customerId}`}>{row.customer}</Link> : row.customer}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">
                  <strong className="block">{row.machineCode}</strong>
                  <span className="text-xs text-[#667085]">{row.model} · {row.serialNumber}</span>
                </td>
                <td className="border-b border-[#f1f2f4] px-4 py-3 text-[#667085]">{row.note || row.title}</td>
                <td className="border-b border-[#f1f2f4] px-4 py-3">{displayLabel(row.status)}</td>
              </tr>
            ))}
            <EmptyRow colSpan={8} show={!rows.length} />
          </tbody>
        </table>
      </div>
      <ReportTablePager {...pagination} label="phiếu" />
    </section>
  );
}

function CustomerHighlights({ onOpen, report, title }: { onOpen: (customerId: string) => void; report: TechnicalReport; title: string }) {
  const rows = report.byCustomer.slice(0, 6);
  return (
    <section className="overflow-hidden rounded-[24px] bg-white shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07)]">
      <TableTitle count={report.byCustomer.length} title={title} />
      {rows.length ? (
        <div className="grid">
          {rows.map((row) => (
            <button
              className="grid gap-2.5 border-b border-[#eef0f3] p-4 text-left transition last:border-b-0 hover:bg-[#fafafa]"
              key={row.id}
              onClick={() => onOpen(row.id)}
              type="button"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-[#202124]">{row.label}</strong>
                <span className="text-sm font-semibold text-[#3e8375]">{row.total} việc</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <KindChip label="Lắp đặt" value={row.installation} />
                <KindChip label="Sửa chữa" value={row.repair} />
                <KindChip label="Bảo trì" value={row.maintenance} />
                <KindChip label="Demo" value={row.demo} />
                <KindChip label="Hỗ trợ app" value={row.applicationSupport} />
              </div>
              <span className="text-xs font-medium text-[#667085]">
                {row.machines} máy · gần nhất {formatDate(row.lastWorkedAt)} · bấm để xem chi tiết
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-sm text-[#667085]">Không có dữ liệu trong kỳ này.</div>
      )}
    </section>
  );
}

function KindChip({ label, value }: { label: string; value: number }) {
  if (!value) return null;
  return <span className="rounded-lg border border-[#eef0f3] bg-[#fafafa] px-2 py-1 text-xs font-semibold text-[#667085]">{label} {value}</span>;
}

function CustomerDetailView({ customerId, onBack, report }: { customerId: string; onBack: () => void; report: TechnicalReport }) {
  const group = report.byCustomer.find((item) => item.id === customerId);
  const [kindFilter, setKindFilter] = useState<WorkKind | ''>('');

  const machineRows = useMemo(
    () =>
      report.byMachine.filter(
        (item) => item.customerId === customerId || (!item.customerId && group?.label && item.customer === group.label),
      ),
    [customerId, group, report.byMachine],
  );
  const workRows = useMemo(
    () =>
      [...report.rows]
        .filter((row) => row.customerId === customerId || (!row.customerId && group?.label && row.customer === group.label))
        .sort((first, second) => second.date.localeCompare(first.date)),
    [customerId, group, report.rows],
  );
  const visibleWorks = kindFilter ? workRows.filter((row) => row.kind === kindFilter) : workRows;
  const machinePagination = usePagedRows(machineRows, customerId);
  const workPagination = usePagedRows(visibleWorks, `${customerId}-${kindFilter || 'all'}`);

  if (!group) {
    return (
      <section className="rounded-[24px] bg-white p-6 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07)]">
        <button className="secondary-button" onClick={onBack} type="button">
          <ArrowLeft size={16} />
          Quay lại danh sách
        </button>
        <p className="mt-4 text-sm text-[#667085]">Không tìm thấy khách hàng trong kỳ báo cáo.</p>
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="secondary-button" onClick={onBack} type="button">
          <ArrowLeft size={16} />
          Quay lại danh sách
        </button>
        <button
          className="secondary-button"
          disabled={!workRows.length}
          onClick={() => exportRows(`bao-cao-khach-hang-${report.filters.from}-${report.filters.to}.csv`, workRows)}
          type="button"
        >
          <Download size={16} />
          Xuất CSV
        </button>
      </div>

      <section className="rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07)]">
        <span className="text-xs font-bold uppercase text-[#3e8375]">Báo cáo theo khách hàng</span>
        <h2 className="mt-1 text-2xl font-semibold text-[#202124]">{group.label}</h2>
        <p className="mt-1 text-sm font-medium text-[#667085]">
          {group.total} việc · {group.machines} máy · gần nhất {formatDate(group.lastWorkedAt)} · {formatDate(report.filters.from)} - {formatDate(report.filters.to)}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <KindStat label="Lắp đặt" value={group.installation} />
          <KindStat label="Sửa chữa" value={group.repair} />
          <KindStat label="Bảo trì" value={group.maintenance} />
          <KindStat label="Demo" value={group.demo} />
          <KindStat label="Hỗ trợ app" value={group.applicationSupport} />
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] bg-white shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07)]">
        <TableTitle count={machineRows.length} title={`Máy của ${group.label}`} />
        {machineRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs uppercase text-[#667085]">
                <tr>
                  {['Máy', 'Model', 'Khách hàng', 'Tỉnh', 'Tổng', 'Lắp', 'Sửa', 'Bảo trì', 'Demo', 'App', 'Gần nhất'].map((header) => (
                    <th className="border-b border-[#eef0f3] px-4 py-3" key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {machinePagination.rows.map((row) => (
                  <tr className="hover:bg-[#fafafa]" key={row.id}>
                    <td className="border-b border-[#f1f2f4] px-4 py-3">
                      <strong className="block text-[#202124]">{row.machineCode}</strong>
                      <span className="text-xs text-[#667085]">{row.serialNumber}</span>
                    </td>
                    <td className="border-b border-[#f1f2f4] px-4 py-3">{row.model}</td>
                    <td className="border-b border-[#f1f2f4] px-4 py-3">
                      {row.customerId ? <Link className="hover:text-[#3e8375]" to={`/customers/profile?customerId=${row.customerId}`}>{row.customer}</Link> : row.customer}
                    </td>
                    <td className="border-b border-[#f1f2f4] px-4 py-3 text-[#667085]">{row.province}</td>
                    <td className="border-b border-[#f1f2f4] px-4 py-3 font-semibold">{row.total}</td>
                    <td className="border-b border-[#f1f2f4] px-4 py-3">{row.installation}</td>
                    <td className="border-b border-[#f1f2f4] px-4 py-3">{row.repair}</td>
                    <td className="border-b border-[#f1f2f4] px-4 py-3">{row.maintenance}</td>
                    <td className="border-b border-[#f1f2f4] px-4 py-3">{row.demo}</td>
                    <td className="border-b border-[#f1f2f4] px-4 py-3">{row.applicationSupport}</td>
                    <td className="border-b border-[#f1f2f4] px-4 py-3 text-[#667085]">{formatDate(row.lastWorkedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-[#667085]">Chưa có máy phát sinh trong kỳ.</div>
        )}
        <ReportTablePager {...machinePagination} label="máy" />
      </section>

      <section className="overflow-hidden rounded-[24px] bg-white shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef0f3] px-4 py-3">
          <h2 className="font-semibold text-[#202124]">Toàn bộ phiếu trong kỳ</h2>
          <div className="flex flex-wrap gap-1.5">
            {(['', 'installation', 'repair', 'maintenance', 'demo', 'applicationSupport'] as const).map((kind) => (
              <button
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${kindFilter === kind ? 'border-[#3e8375] bg-[#eefaf3] text-[#177245]' : 'border-[#eef0f3] bg-[#fafafa] text-[#667085] hover:text-[#18181b]'}`}
                key={kind || 'all'}
                onClick={() => setKindFilter(kind)}
                type="button"
              >
                {kind ? workLabel(kind) : 'Tất cả'}
              </button>
            ))}
          </div>
        </div>
        {visibleWorks.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs uppercase text-[#667085]">
                <tr>
                  {['Phiếu', 'Loại', 'Ngày', 'Kỹ sư', 'Máy/model', 'Nội dung', 'Trạng thái'].map((header) => (
                    <th className="border-b border-[#eef0f3] px-4 py-3" key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workPagination.rows.map((row) => (
                  <tr className="hover:bg-[#fafafa]" key={`${row.kind}-${row.id}`}>
                    <td className="border-b border-[#f1f2f4] px-4 py-3 font-semibold text-[#202124]">
                      {workHref(row) ? <Link className="hover:text-[#3e8375]" to={workHref(row)!}>{row.code}</Link> : row.code}
                    </td>
                    <td className="border-b border-[#f1f2f4] px-4 py-3">{workLabel(row.kind)}</td>
                    <td className="border-b border-[#f1f2f4] px-4 py-3 text-[#667085]">{formatDate(row.date)}</td>
                    <td className="border-b border-[#f1f2f4] px-4 py-3">{row.engineer}</td>
                    <td className="border-b border-[#f1f2f4] px-4 py-3">
                      <strong className="block">{row.machineCode}</strong>
                      <span className="text-xs text-[#667085]">{row.model} · {row.serialNumber}</span>
                    </td>
                    <td className="border-b border-[#f1f2f4] px-4 py-3 text-[#667085]">{row.note || row.title}</td>
                    <td className="border-b border-[#f1f2f4] px-4 py-3">{displayLabel(row.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-[#667085]">Chưa có phiếu nào cho loại này trong kỳ.</div>
        )}
        <ReportTablePager {...workPagination} label="phiếu" />
      </section>
    </div>
  );
}

function KindStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[#f6f8f7] px-3 py-3">
      <span className="text-xs font-semibold text-[#667085]">{label}</span>
      <strong className="mt-1 block text-2xl leading-none text-[#202124]">{value}</strong>
    </div>
  );
}

function TableTitle({ count, title }: { count: number; title: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#eef0f3] px-4 py-3">
      <h2 className="font-semibold text-[#202124]">{title}</h2>
      <span className="text-xs font-semibold text-[#667085]">{count} kết quả</span>
    </div>
  );
}

function usePagedRows<T>(rows: T[], resetKey: string) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / reportTablePageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = rows.slice((currentPage - 1) * reportTablePageSize, currentPage * reportTablePageSize);

  useEffect(() => {
    setPage(1);
  }, [resetKey, rows.length]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return {
    disabled: false,
    page: currentPage,
    pageSize: reportTablePageSize,
    rows: pagedRows,
    total: rows.length,
    totalPages,
    onPageChange: setPage,
  };
}

function ReportTablePager({
  disabled,
  label,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
}: {
  disabled: boolean;
  label: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef0f3] bg-[#fafafa] px-4 py-3 text-sm font-medium text-[#667085]">
      <span>{total ? `${first}-${last}/${total} ${label}` : `0 ${label}`}</span>
      <div className="flex items-center gap-2">
        <button className="secondary-button compact" disabled={disabled || page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} type="button">
          Trước
        </button>
        <span>Trang {page}/{totalPages}</span>
        <button className="secondary-button compact" disabled={disabled || page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))} type="button">
          Sau
        </button>
      </div>
    </div>
  );
}

function EmptyRow({ colSpan, show }: { colSpan: number; show: boolean }) {
  if (!show) return null;
  return (
    <tr>
      <td className="px-4 py-8 text-center text-sm text-[#667085]" colSpan={colSpan}>Không có dữ liệu trong kỳ này.</td>
    </tr>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-[320px] place-items-center rounded-[24px] bg-[#fafafa] text-sm font-semibold text-[#667085]">
      <span className="inline-flex items-center gap-2"><Loader2 className="spin-icon" size={18} />Đang tổng hợp báo cáo</span>
    </div>
  );
}

function buildFilterOptions(report?: TechnicalReport) {
  return {
    engineers: (report?.filters.engineers ?? []).map((item) => ({ id: item.id, label: [item.fullName || item.email, item.region?.name].filter(Boolean).join(' - ') })),
    customers: uniqueOptions(report?.filters.customers ?? []),
    models: uniqueOptions(report?.filters.models ?? []),
    provinces: uniqueOptions(report?.filters.provinces ?? []),
  };
}

function uniqueOptions(options: Array<{ id: string; label: string }>) {
  const map = new Map<string, { id: string; label: string }>();
  options.filter((item) => item.id && item.label).forEach((item) => map.set(item.id, item));
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
}

function buildTrendBuckets(rows: WorkReportRow[]) {
  const groups = new Map<string, number>();
  rows.forEach((row) => {
    const key = dateKey(row.date);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  });
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([key, total]) => ({ label: formatShortDate(key), total }));
}

function workHref(row: WorkReportRow) {
  if (row.kind === 'installation') return `/installations/${row.id}/update`;
  if (row.kind === 'repair') return `/repairs/${row.id}/update`;
  if (row.kind === 'maintenance') return `/maintenance/${row.id}/update`;
  if (row.kind === 'applicationSupport') return '/application-support';
  return null;
}

function workLabel(kind: WorkKind) {
  if (kind === 'installation') return 'Lắp đặt';
  if (kind === 'repair') return 'Sửa chữa';
  if (kind === 'maintenance') return 'Bảo trì';
  if (kind === 'demo') return 'Demo';
  return 'Hỗ trợ app';
}

function normalizeView(value: string | null): ReportView {
  return reportTabs.some((tab) => tab.key === value) || value === 'customer' ? (value as ReportView) : 'summary';
}

function currentMonthRange() {
  const now = new Date();
  return {
    from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}

function exportRows(filename: string, rows: WorkReportRow[]) {
  const headers = ['Mã phiếu', 'Loại', 'Ngày', 'Kỹ sư', 'Khách hàng', 'Tỉnh', 'Máy', 'Model', 'Serial', 'Nội dung', 'Trạng thái'];
  const lines = [
    headers,
    ...rows.map((row) => [
      row.code,
      workLabel(row.kind),
      formatDate(row.date),
      row.engineer,
      row.customer,
      row.province,
      row.machineCode,
      row.model,
      row.serialNumber,
      row.note || row.title,
      displayLabel(row.status),
    ]),
  ];
  const csv = lines.map((line) => line.map(csvCell).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

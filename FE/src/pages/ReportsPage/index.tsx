import { useQuery } from '@tanstack/react-query';
import { ArrowDownWideNarrow, Building2, CalendarDays, ChevronLeft, Download, Loader2, MapPinned, PackageCheck, Table2, UserRound, Users, Wrench } from 'lucide-react';
import { ReactNode, useEffect, useMemo, useState } from 'react';
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
  engineerId: string | null;
  engineer: string;
  customerId: string | null;
  customer: string;
  province: string;
  region: string;
  machineId: string | null;
  machineModelId: string | null;
  model: string;
  machineCode: string;
  serialNumber: string;
};

type WorkReportRow = {
  id: string;
  code: string;
  kind: 'installation' | 'repair' | 'maintenance';
  title: string;
  status: string;
  date: string;
  completedAt: string | null;
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

type DrilldownCustomer = {
  id: string;
  label: string;
  province: string;
  installations: number;
  repairs: number;
  maintenances: number;
  machines: number;
  lastWorkedAt: string | null;
  assigned?: boolean;
};

type DrilldownMachine = {
  id: string;
  label: string;
  serialNumber: string;
  model: string;
  customerId: string | null;
  customer: string;
  province: string;
  installations: number;
  repairs: number;
  maintenances: number;
  lastWorkedAt: string | null;
  notes: string[];
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

type FilterKey = 'engineer' | 'customer' | 'model' | 'province';

type ReportFilterState = {
  engineerId: string;
  customerId: string;
  modelKey: string;
  province: string;
};

type ReportFilterOption = {
  id: string;
  label: string;
  count: number;
};

type EngineerReport = {
  engineer: {
    id: string;
    name: string;
    email: string | null;
    region: string | null;
    profile: {
      employeeCode?: string | null;
      position?: string | null;
      department?: string | null;
      expertiseGroup?: string | null;
    } | null;
  };
  summary: {
    installations: number;
    repairs: number;
    maintenances: number;
    customers: number;
    machines: number;
    assignedCustomers: number;
  };
  customers: DrilldownCustomer[];
  machines: DrilldownMachine[];
  workRows: WorkReportRow[];
};

type ModelReport = {
  model: {
    id: string;
    name: string;
    code: string | null;
    manufacturer: string | null;
    businessLine: string | null;
    productIndustry: string | null;
  };
  summary: {
    installations: number;
    repairs: number;
    maintenances: number;
    customers: number;
    machines: number;
  };
  machines: DrilldownMachine[];
  customers: DrilldownCustomer[];
  workRows: WorkReportRow[];
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

const reportFieldClass =
  'h-10 min-w-0 rounded-lg border border-[#dde3ea] bg-white px-3 text-sm font-medium text-[#18212f] outline-none transition hover:border-[#c8d2df] focus:border-[#c91f2d] focus:shadow-[0_0_0_3px_rgba(201,31,45,0.10)]';

export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = normalizeView(searchParams.get('view'));
  const selectedEngineerId = searchParams.get('engineerId') || '';
  const selectedModelKey = searchParams.get('modelKey') || '';
  const filterEngineerId = searchParams.get('filterEngineerId') || '';
  const filterCustomerId = searchParams.get('filterCustomerId') || '';
  const filterModelKey = searchParams.get('filterModelKey') || '';
  const filterProvince = searchParams.get('filterProvince') || '';
  const defaultDates = useMemo(() => currentMonthRange(), []);
  const from = searchParams.get('from') || defaultDates.from;
  const to = searchParams.get('to') || defaultDates.to;
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [draftEngineerId, setDraftEngineerId] = useState(filterEngineerId);
  const [draftCustomerId, setDraftCustomerId] = useState(filterCustomerId);
  const [draftModelKey, setDraftModelKey] = useState(filterModelKey);
  const [draftProvince, setDraftProvince] = useState(filterProvince);
  const optionParams = useMemo(() => new URLSearchParams({ from, to }).toString(), [from, to]);
  const requestParams = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    if (filterEngineerId) params.set('engineerId', filterEngineerId);
    if (filterCustomerId) params.set('customerId', filterCustomerId);
    if (filterModelKey) params.set('machineModelId', filterModelKey);
    if (filterProvince) params.set('province', filterProvince);
    return params.toString();
  }, [filterCustomerId, filterEngineerId, filterModelKey, filterProvince, from, to]);
  const reportQuery = useQuery({
    queryKey: queryKeys.reports.installations(requestParams),
    queryFn: () => apiFetch<InstallationReport>(`/reports/installations?${requestParams}`),
  });
  const optionsQuery = useQuery({
    queryKey: queryKeys.reports.installations(`options:${optionParams}`),
    queryFn: () => apiFetch<InstallationReport>(`/reports/installations?${optionParams}`),
  });
  const engineerReportQuery = useQuery({
    enabled: Boolean(selectedEngineerId),
    queryKey: queryKeys.reports.engineer(selectedEngineerId, requestParams),
    queryFn: () => apiFetch<EngineerReport>(`/reports/engineers/${selectedEngineerId}?${requestParams}`),
  });
  const modelReportQuery = useQuery({
    enabled: Boolean(selectedModelKey),
    queryKey: queryKeys.reports.model(selectedModelKey, requestParams),
    queryFn: () => apiFetch<ModelReport>(`/reports/models/${encodeURIComponent(selectedModelKey)}?${requestParams}`),
  });
  const report = reportQuery.data;
  const optionsReport = optionsQuery.data ?? report;
  const filterOptions = useMemo(
    () =>
      buildDependentFilterOptions(optionsReport?.rows ?? [], {
        engineerId: draftEngineerId,
        customerId: draftCustomerId,
        modelKey: draftModelKey,
        province: draftProvince,
      }),
    [draftCustomerId, draftEngineerId, draftModelKey, draftProvince, optionsReport?.rows],
  );
  const selectedFilterLabels = useMemo(
    () =>
      resolveSelectedFilterLabels(optionsReport?.rows ?? [], {
        engineerId: filterEngineerId,
        customerId: filterCustomerId,
        modelKey: filterModelKey,
        province: filterProvince,
      }),
    [filterCustomerId, filterEngineerId, filterModelKey, filterProvince, optionsReport?.rows],
  );
  const detailLoading = engineerReportQuery.isFetching || modelReportQuery.isFetching;
  const loading = reportQuery.isLoading || reportQuery.isFetching || detailLoading;
  const error =
    errorMessage(reportQuery.error) ||
    errorMessage(engineerReportQuery.error) ||
    errorMessage(modelReportQuery.error) ||
    (reportQuery.isError ? 'Không tải được báo cáo' : '');
  const hasAdvancedFilters = Boolean(filterEngineerId || filterCustomerId || filterModelKey || filterProvince);

  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
    setDraftEngineerId(filterEngineerId);
    setDraftCustomerId(filterCustomerId);
    setDraftModelKey(filterModelKey);
    setDraftProvince(filterProvince);
  }, [filterCustomerId, filterEngineerId, filterModelKey, filterProvince, from, to]);

  function changeView(nextView: ReportView) {
    const next = new URLSearchParams(searchParams);
    next.set('view', nextView);
    next.set('from', from);
    next.set('to', to);
    next.delete('engineerId');
    next.delete('modelKey');
    setSearchParams(next);
  }

  function clearDrilldown() {
    const next = new URLSearchParams(searchParams);
    next.delete('engineerId');
    next.delete('modelKey');
    setSearchParams(next);
  }

  function updateReportFilter(key: 'from' | 'to' | 'filterEngineerId' | 'filterCustomerId' | 'filterModelKey' | 'filterProvince', value: string) {
    const next = new URLSearchParams(searchParams);
    next.set('view', activeView);
    next.set('from', key === 'from' ? value : from);
    next.set('to', key === 'to' ? value : to);
    setOrDelete(next, 'filterEngineerId', key === 'filterEngineerId' ? value : filterEngineerId);
    setOrDelete(next, 'filterCustomerId', key === 'filterCustomerId' ? value : filterCustomerId);
    setOrDelete(next, 'filterModelKey', key === 'filterModelKey' ? value : filterModelKey);
    setOrDelete(next, 'filterProvince', key === 'filterProvince' ? value : filterProvince);
    next.delete('engineerId');
    next.delete('modelKey');
    setSearchParams(next);
  }

  function resetFilters() {
    setDraftFrom(defaultDates.from);
    setDraftTo(defaultDates.to);
    setDraftEngineerId('');
    setDraftCustomerId('');
    setDraftModelKey('');
    setDraftProvince('');
    const next = new URLSearchParams();
    next.set('view', activeView);
    setSearchParams(next);
  }

  function exportCurrentView() {
    if (selectedEngineerId && engineerReportQuery.data) {
      exportWorkRows(`bao-cao-ky-su-${safeFileName(engineerReportQuery.data.engineer.name)}.csv`, engineerReportQuery.data.workRows);
      return;
    }

    if (selectedModelKey && modelReportQuery.data) {
      exportWorkRows(`bao-cao-model-${safeFileName(modelReportQuery.data.model.name)}.csv`, modelReportQuery.data.workRows);
      return;
    }

    if (!report) return;
    exportReportView(activeView, report);
  }

  return (
    <PageFrame>
      <div className="grid gap-5 rounded-[14px] border border-[#d9e1eb] bg-white p-5 shadow-[0_18px_46px_rgba(28,39,56,0.07)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageTitle
            description="Tổng hợp lắp đặt, máy, khách hàng, model và địa bàn. Các bộ lọc liên kết với nhau để chỉ hiện dữ liệu còn liên quan."
            eyebrow="Báo cáo kỹ thuật"
            title="Báo cáo vận hành kỹ thuật"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#dde3ea] bg-white px-3.5 text-sm font-semibold text-[#303a4b] hover:border-[#f1c4c9] hover:text-[#c91f2d] disabled:opacity-50"
              disabled={!report && !engineerReportQuery.data && !modelReportQuery.data}
              onClick={exportCurrentView}
              type="button"
            >
              <Download size={16} />
              Xuất Excel
            </button>
          </div>
        </div>

        <section className="grid gap-3 rounded-[12px] border border-[#dde3ea] bg-[#f8fafc] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e9edf2] pb-3">
            <div>
              <span className="text-xs font-semibold text-[#c91f2d]">Bộ lọc báo cáo</span>
              <p className="mt-0.5 text-xs font-medium text-[#647084]">Chọn điều kiện là dữ liệu tự tải lại, không cần bấm áp dụng.</p>
            </div>
            <div className="flex items-center gap-2">
              {hasAdvancedFilters ? <span className="rounded-lg border border-[#efd8a8] bg-[#fff8ed] px-2.5 py-1 text-xs font-semibold text-[#9b5a17]">Đang lọc nâng cao</span> : null}
              <button className="inline-flex h-9 items-center justify-center rounded-lg border border-[#dde3ea] bg-white px-3 text-xs font-semibold text-[#647084] hover:border-[#f1c4c9] hover:text-[#c91f2d]" onClick={resetFilters} type="button">
                Clear
              </button>
            </div>
          </div>

          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#647084]">
              Từ ngày
              <input
                className={reportFieldClass}
                onChange={(event) => {
                  setDraftFrom(event.target.value);
                  updateReportFilter('from', event.target.value);
                }}
                type="date"
                value={draftFrom}
              />
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#647084]">
              Đến ngày
              <input
                className={reportFieldClass}
                onChange={(event) => {
                  setDraftTo(event.target.value);
                  updateReportFilter('to', event.target.value);
                }}
                type="date"
                value={draftTo}
              />
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#647084]">
              Kỹ sư
              <select
                className={reportFieldClass}
                onChange={(event) => {
                  setDraftEngineerId(event.target.value);
                  updateReportFilter('filterEngineerId', event.target.value);
                }}
                value={draftEngineerId}
              >
                <option value="">Tất cả</option>
                {filterOptions.engineers.map((item) => (
                  <option key={item.id} value={item.id}>{optionLabel(item)}</option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#647084]">
              Khách hàng
              <select
                className={reportFieldClass}
                onChange={(event) => {
                  setDraftCustomerId(event.target.value);
                  updateReportFilter('filterCustomerId', event.target.value);
                }}
                value={draftCustomerId}
              >
                <option value="">Tất cả</option>
                {filterOptions.customers.map((item) => (
                  <option key={item.id} value={item.id}>{optionLabel(item)}</option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#647084]">
              Model
              <select
                className={reportFieldClass}
                onChange={(event) => {
                  setDraftModelKey(event.target.value);
                  updateReportFilter('filterModelKey', event.target.value);
                }}
                value={draftModelKey}
              >
                <option value="">Tất cả</option>
                {filterOptions.models.map((item) => (
                  <option key={item.id} value={item.id}>{optionLabel(item)}</option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#647084]">
              Tỉnh
              <select
                className={reportFieldClass}
                onChange={(event) => {
                  setDraftProvince(event.target.value);
                  updateReportFilter('filterProvince', event.target.value);
                }}
                value={draftProvince}
              >
                <option value="">Tất cả</option>
                {filterOptions.provinces.map((item) => (
                  <option key={item.id} value={item.id}>{optionLabel(item)}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

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

        {report ? <ReportScopeInsight labels={selectedFilterLabels} report={report} /> : null}

        {loading && !report ? (
          <div className="grid min-h-[360px] place-items-center rounded-[10px] border border-[#e9edf2] bg-[#f8fafc] text-[#647084]">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <Loader2 className="spin-icon" size={18} />
              Đang tổng hợp báo cáo
            </span>
          </div>
        ) : selectedEngineerId && engineerReportQuery.data ? (
          <EngineerDrilldown onBack={clearDrilldown} report={engineerReportQuery.data} />
        ) : selectedModelKey && modelReportQuery.data ? (
          <ModelDrilldown onBack={clearDrilldown} report={modelReportQuery.data} />
        ) : report ? (
          <ReportContent from={from} report={report} to={to} view={activeView} />
        ) : null}
      </div>
    </PageFrame>
  );
}

function ReportScopeInsight({ labels, report }: { labels: Record<FilterKey, string>; report: InstallationReport }) {
  const activeFilters = [
    labels.engineer ? `Kỹ sư: ${labels.engineer}` : '',
    labels.customer ? `Khách hàng: ${labels.customer}` : '',
    labels.model ? `Model: ${labels.model}` : '',
    labels.province ? `Tỉnh: ${labels.province}` : '',
  ].filter(Boolean);

  if (!activeFilters.length) return null;

  const topModels = report.byModel.filter((item) => item.id !== 'unknown-model').slice(0, 4);
  const topCustomers = report.byCustomer.filter((item) => item.id !== 'unknown-customer').slice(0, 4);
  const focusTitle = labels.customer
    ? 'Khách hàng đang chọn'
    : labels.engineer
      ? 'Kỹ sư đang chọn'
      : labels.model
        ? 'Model đang chọn'
        : 'Phạm vi đang chọn';

  return (
    <section className="grid gap-3 rounded-[12px] border border-[#f1c4c9] bg-[#fffafa] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold text-[#c91f2d]">{focusTitle}</span>
          <h2 className="mt-1 text-lg font-semibold text-[#18212f]">{activeFilters.join(' | ')}</h2>
          <p className="mt-1 text-sm text-[#647084]">
            Đang có {report.summary.totalInstallations} phiếu, {report.summary.totalMachines} máy, {report.summary.totalCustomers} khách hàng, {report.byModel.length} model và {report.summary.totalProvinces} tỉnh trong phạm vi này.
          </p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <InsightList title={labels.customer ? 'Model khách hàng đang dùng' : 'Model liên quan'} rows={topModels} />
        <InsightList title={labels.engineer ? 'Khách hàng kỹ sư đang care' : 'Khách hàng liên quan'} rows={topCustomers} />
      </div>
    </section>
  );
}

function InsightList({ rows, title }: { rows: InstallationReportGroup[]; title: string }) {
  return (
    <div className="rounded-[10px] border border-[#f3d5d8] bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <strong className="text-sm text-[#18212f]">{title}</strong>
        <span className="text-xs font-semibold text-[#647084]">{rows.length} mục nổi bật</span>
      </div>
      <div className="grid gap-2">
        {rows.length ? rows.map((row) => (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-[#f8fafc] px-3 py-2 text-sm" key={row.id}>
            <span className="min-w-0 truncate font-semibold text-[#303a4b]">{row.label}</span>
            <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-bold text-[#a81524]">{row.count} phiếu</span>
          </div>
        )) : <span className="rounded-lg bg-[#f8fafc] px-3 py-3 text-sm font-medium text-[#647084]">Chưa có dữ liệu phù hợp.</span>}
      </div>
    </div>
  );
}

function ReportContent({ report, view, from, to }: { report: InstallationReport; view: ReportView; from: string; to: string }) {
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
        <TrendPanel rows={report.rows.map((row) => ({ date: row.installedAt, kind: 'installation' }))} title="Xu hướng lắp đặt trong kỳ" />
        <div className="grid gap-4 xl:grid-cols-2">
          <GroupTable from={from} rows={report.byEngineer.slice(0, 8)} title="Kỹ sư lắp đặt nổi bật" to={to} variant="engineers" />
          <GroupTable from={from} rows={report.byProvince.slice(0, 8)} title="Tỉnh có phát sinh lắp đặt" to={to} variant="provinces" />
        </div>
      </div>
    );
  }

  if (view === 'engineers') {
    return <GroupTable from={from} rows={report.byEngineer} title="Báo cáo tổng hợp theo tất cả kỹ sư" to={to} variant="engineers" />;
  }

  if (view === 'machines') {
    return <DetailTable rows={report.rows} title="Báo cáo tổng hợp theo số lượng tất cả máy lắp đặt trong kỳ" />;
  }

  if (view === 'customers') {
    return <GroupTable from={from} rows={report.byCustomer} title="Báo cáo tổng hợp theo tất cả khách hàng" to={to} variant="customers" />;
  }

  if (view === 'models') {
    return <GroupTable from={from} rows={report.byModel} title="Báo cáo tổng hợp theo từng model máy" to={to} variant="models" />;
  }

  if (view === 'provinces') {
    return <GroupTable from={from} rows={report.byProvince} title="Báo cáo tổng hợp theo từng vùng địa lý theo tỉnh" to={to} variant="provinces" />;
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
  from,
  to,
}: {
  title: string;
  rows: InstallationReportGroup[];
  variant: 'engineers' | 'customers' | 'models' | 'provinces';
  from: string;
  to: string;
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
                <td className="border-b border-[#eeeeee] px-4 py-3 font-bold text-[#18212f]">
                  <GroupLink from={from} row={row} to={to} variant={variant} />
                </td>
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

function GroupLink({
  row,
  variant,
  from,
  to,
}: {
  row: InstallationReportGroup;
  variant: 'engineers' | 'customers' | 'models' | 'provinces';
  from: string;
  to: string;
}) {
  if (variant === 'engineers' && row.id !== 'unassigned') {
    return (
      <Link className="inline-flex items-center gap-1.5 hover:text-[#c91f2d]" to={`/reports?view=engineers&from=${from}&to=${to}&engineerId=${row.id}`}>
        {row.label}
        <ArrowDownWideNarrow size={14} />
      </Link>
    );
  }

  if (variant === 'models' && row.id !== 'unknown-model') {
    return (
      <Link className="inline-flex items-center gap-1.5 hover:text-[#c91f2d]" to={`/reports?view=models&from=${from}&to=${to}&modelKey=${encodeURIComponent(row.id)}`}>
        {row.label}
        <ArrowDownWideNarrow size={14} />
      </Link>
    );
  }

  if (variant === 'customers' && row.id !== 'unknown-customer') {
    return (
      <Link className="inline-flex items-center gap-1.5 hover:text-[#c91f2d]" to={`/customers/profile?customerId=${row.id}`}>
        {row.label}
        <Building2 size={14} />
      </Link>
    );
  }

  return <span>{row.label}</span>;
}

function EngineerDrilldown({ report, onBack }: { report: EngineerReport; onBack: () => void }) {
  return (
    <div className="grid gap-4">
      <DrilldownHeader
        eyebrow="Chi tiết kỹ sư"
        meta={[report.engineer.region, report.engineer.profile?.position, report.engineer.profile?.department].filter(Boolean).join(' - ') || report.engineer.email || ''}
        onBack={onBack}
        title={report.engineer.name}
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Máy đã lắp" value={report.summary.installations} />
        <SummaryCard label="Ca sửa chữa" value={report.summary.repairs} />
        <SummaryCard label="Lượt bảo trì" value={report.summary.maintenances} />
        <SummaryCard label="Khách đã care" value={report.summary.customers} />
        <SummaryCard label="Máy đã xử lý" value={report.summary.machines} />
        <SummaryCard label="Khách phụ trách" value={report.summary.assignedCustomers} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <CustomerCareTable rows={report.customers} title="Khách hàng kỹ sư đã care" />
        <MachineHistoryTable rows={report.machines} title="Máy kỹ sư đã lắp/sửa/bảo trì" />
      </div>
      <TrendPanel rows={report.workRows} title="Nhịp công việc của kỹ sư" />
      <WorkLogTable rows={report.workRows} title="Lịch sử công việc trong kỳ" />
    </div>
  );
}

function ModelDrilldown({ report, onBack }: { report: ModelReport; onBack: () => void }) {
  return (
    <div className="grid gap-4">
      <DrilldownHeader
        eyebrow="Chi tiết model"
        meta={[report.model.code, report.model.manufacturer, report.model.businessLine, report.model.productIndustry].filter(Boolean).join(' - ')}
        onBack={onBack}
        title={report.model.name}
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Máy đã lắp" value={report.summary.installations} />
        <SummaryCard label="Ca sửa chữa" value={report.summary.repairs} />
        <SummaryCard label="Lượt bảo trì" value={report.summary.maintenances} />
        <SummaryCard label="Khách hàng" value={report.summary.customers} />
        <SummaryCard label="Máy liên quan" value={report.summary.machines} />
      </div>
      <MachineHistoryTable rows={report.machines} title="Máy thuộc model này" />
      <TrendPanel rows={report.workRows} title="Xu hướng phát sinh của model" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <CustomerCareTable rows={report.customers} title="Khách hàng đang dùng model này" />
        <WorkLogTable rows={report.workRows} title="Lịch sử lắp đặt, sửa chữa, bảo trì" />
      </div>
    </div>
  );
}

function DrilldownHeader({
  eyebrow,
  title,
  meta,
  onBack,
}: {
  eyebrow: string;
  title: string;
  meta: string;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-[#e9edf2] bg-[#f8fafc] p-4">
      <div>
        <span className="text-xs font-semibold text-[#c91f2d]">{eyebrow}</span>
        <h2 className="mt-1 text-2xl font-semibold text-[#18212f]">{title}</h2>
        {meta ? <p className="mt-1 text-sm font-medium text-[#647084]">{meta}</p> : null}
      </div>
      <button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dde3ea] bg-white px-3 text-sm font-semibold text-[#303a4b] hover:border-[#f1c4c9] hover:text-[#c91f2d]" onClick={onBack} type="button">
        <ChevronLeft size={16} />
        Back
      </button>
    </div>
  );
}

function CustomerCareTable({ rows, title }: { rows: DrilldownCustomer[]; title: string }) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-[#e9edf2] bg-white">
      <TableHeader count={rows.length} title={title} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase text-[#647084]">
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Khách hàng</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Tỉnh</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Lắp</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Sửa</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Bảo trì</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Máy</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="hover:bg-[#fffafa]" key={row.id}>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-bold text-[#18212f]">
                  {row.id.startsWith('unknown') || !row.id ? (
                    row.label
                  ) : (
                    <Link className="hover:text-[#c91f2d]" to={`/customers/profile?customerId=${row.id}`}>
                      {row.label}
                    </Link>
                  )}
                  {row.assigned ? <span className="ml-2 rounded-md bg-[#eefaf3] px-2 py-1 text-[11px] text-[#177245]">phụ trách</span> : null}
                </td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#647084]">{row.province}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold">{row.installations}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold">{row.repairs}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold">{row.maintenances}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold">{row.machines}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#647084]">{formatDate(row.lastWorkedAt)}</td>
              </tr>
            ))}
            <EmptyRow colSpan={7} show={rows.length === 0} />
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MachineHistoryTable({ rows, title }: { rows: DrilldownMachine[]; title: string }) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-[#e9edf2] bg-white">
      <TableHeader count={rows.length} title={title} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase text-[#647084]">
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Máy</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Model</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Khách hàng</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Tỉnh</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Lắp</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Sửa</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Bảo trì</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Ghi chú gần đây</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="hover:bg-[#fffafa]" key={row.id}>
                <td className="border-b border-[#eeeeee] px-4 py-3">
                  <strong className="block text-[#18212f]">{row.label || '-'}</strong>
                  <span className="text-xs text-[#647084]">{row.serialNumber}</span>
                </td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#303a4b]">{row.model}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold text-[#303a4b]">
                  {row.customerId ? <Link className="hover:text-[#c91f2d]" to={`/customers/profile?customerId=${row.customerId}`}>{row.customer}</Link> : row.customer}
                </td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#647084]">{row.province}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold">{row.installations}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold">{row.repairs}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold">{row.maintenances}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#647084]">{row.notes[0] || formatDate(row.lastWorkedAt)}</td>
              </tr>
            ))}
            <EmptyRow colSpan={8} show={rows.length === 0} />
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WorkLogTable({ rows, title }: { rows: WorkReportRow[]; title: string }) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-[#e9edf2] bg-white">
      <TableHeader count={rows.length} title={title} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase text-[#647084]">
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Phiếu</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Loại việc</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Ngày</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Khách hàng</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Máy / model</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Nội dung</th>
              <th className="border-b border-[#e9edf2] px-4 py-2.5">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="hover:bg-[#fffafa]" key={`${row.kind}-${row.id}`}>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-bold text-[#18212f]">
                  <Link className="hover:text-[#c91f2d]" to={workHref(row)}>
                    {row.code}
                  </Link>
                </td>
                <td className="border-b border-[#eeeeee] px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#dde3ea] bg-[#f8fafc] px-2.5 py-1 text-xs font-semibold text-[#647084]">
                    {workIcon(row.kind)}
                    {workLabel(row.kind)}
                  </span>
                </td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#647084]">{formatDate(row.date)}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold text-[#303a4b]">
                  {row.customerId ? <Link className="hover:text-[#c91f2d]" to={`/customers/profile?customerId=${row.customerId}`}>{row.customer}</Link> : row.customer}
                </td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#303a4b]">
                  <strong className="block">{row.machineCode}</strong>
                  <span className="text-xs text-[#647084]">{row.model}</span>
                </td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#303a4b]">{row.note || row.title}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#647084]">{row.status}</td>
              </tr>
            ))}
            <EmptyRow colSpan={7} show={rows.length === 0} />
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TableHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9edf2] bg-[#f8fafc] px-4 py-3">
      <h2 className="text-base font-semibold text-[#18212f]">{title}</h2>
      <span className="text-xs font-semibold text-[#647084]">{count} dòng</span>
    </div>
  );
}

function EmptyRow({ show, colSpan }: { show: boolean; colSpan: number }) {
  if (!show) return null;
  return (
    <tr>
      <td className="px-4 py-8 text-center text-sm font-medium text-[#647084]" colSpan={colSpan}>
        Không có dữ liệu trong kỳ này.
      </td>
    </tr>
  );
}

function TrendPanel({ rows, title }: { rows: Array<{ date: string; kind?: WorkReportRow['kind'] }>; title: string }) {
  const buckets = buildTrendBuckets(rows);
  const maxValue = Math.max(1, ...buckets.map((item) => item.total));

  return (
    <section className="rounded-[10px] border border-[#e9edf2] bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-semibold text-[#c91f2d]">Xu hướng</span>
          <h2 className="mt-1 text-base font-semibold text-[#18212f]">{title}</h2>
        </div>
        <span className="text-xs font-semibold text-[#647084]">{rows.length} việc</span>
      </div>
      <div className="grid min-h-[190px] grid-cols-[repeat(auto-fit,minmax(56px,1fr))] items-end gap-2 border-b border-[#e9edf2] pb-3">
        {buckets.map((item) => (
          <div className="grid gap-2 text-center" key={item.label}>
            <div className="flex h-[142px] items-end justify-center rounded-lg bg-[#f8fafc] px-2">
              <span
                className="block w-full max-w-10 rounded-t-lg bg-[#c91f2d]"
                style={{ height: `${Math.max(6, (item.total / maxValue) * 100)}%` }}
                title={`${item.label}: ${item.total}`}
              />
            </div>
            <span className="text-[11px] font-semibold text-[#647084]">{item.label}</span>
            <strong className="text-sm text-[#18212f]">{item.total}</strong>
          </div>
        ))}
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '';
}

function buildDependentFilterOptions(rows: InstallationReportRow[], filters: ReportFilterState) {
  return {
    engineers: buildOptions(rows, 'engineer', filters),
    customers: buildOptions(rows, 'customer', filters),
    models: buildOptions(rows, 'model', filters),
    provinces: buildOptions(rows, 'province', filters),
  };
}

function buildOptions(rows: InstallationReportRow[], target: FilterKey, filters: ReportFilterState): ReportFilterOption[] {
  const groups = new Map<string, ReportFilterOption>();

  for (const row of rows) {
    if (!matchesFilter(row, filters, target)) continue;
    const option = optionFromRow(row, target);
    if (!option || isUnknownOption(option.id)) continue;

    const current = groups.get(option.id) ?? { ...option, count: 0 };
    current.count += 1;
    groups.set(option.id, current);
  }

  return [...groups.values()].sort((first, second) => first.label.localeCompare(second.label, 'vi'));
}

function matchesFilter(row: InstallationReportRow, filters: ReportFilterState, ignore?: FilterKey) {
  if (ignore !== 'engineer' && filters.engineerId && row.engineerId !== filters.engineerId) return false;
  if (ignore !== 'customer' && filters.customerId && row.customerId !== filters.customerId) return false;
  if (ignore !== 'model' && filters.modelKey && modelKeyForRow(row) !== filters.modelKey) return false;
  if (ignore !== 'province' && filters.province && row.province !== filters.province) return false;
  return true;
}

function optionFromRow(row: InstallationReportRow, target: FilterKey): ReportFilterOption | null {
  if (target === 'engineer') {
    return { id: row.engineerId || 'unassigned', label: row.engineer || 'Chưa phân công', count: 0 };
  }

  if (target === 'customer') {
    return { id: row.customerId || 'unknown-customer', label: row.customer || 'Chưa có khách hàng', count: 0 };
  }

  if (target === 'model') {
    return { id: modelKeyForRow(row), label: row.model || 'Chưa có model', count: 0 };
  }

  return { id: row.province || 'unknown-province', label: row.province || 'Chưa có tỉnh', count: 0 };
}

function modelKeyForRow(row: InstallationReportRow) {
  return row.machineModelId || row.model || 'unknown-model';
}

function isUnknownOption(id: string) {
  return id === 'unassigned' || id === 'unknown-customer' || id === 'unknown-model' || id === 'unknown-province';
}

function optionLabel(option: ReportFilterOption) {
  return `${option.label} (${option.count})`;
}

function resolveSelectedFilterLabels(rows: InstallationReportRow[], filters: ReportFilterState): Record<FilterKey, string> {
  const allOptions = {
    engineer: buildOptions(rows, 'engineer', { engineerId: '', customerId: '', modelKey: '', province: '' }),
    customer: buildOptions(rows, 'customer', { engineerId: '', customerId: '', modelKey: '', province: '' }),
    model: buildOptions(rows, 'model', { engineerId: '', customerId: '', modelKey: '', province: '' }),
    province: buildOptions(rows, 'province', { engineerId: '', customerId: '', modelKey: '', province: '' }),
  };

  return {
    engineer: allOptions.engineer.find((item) => item.id === filters.engineerId)?.label || '',
    customer: allOptions.customer.find((item) => item.id === filters.customerId)?.label || '',
    model: allOptions.model.find((item) => item.id === filters.modelKey)?.label || '',
    province: allOptions.province.find((item) => item.id === filters.province)?.label || '',
  };
}

function workHref(row: WorkReportRow) {
  if (row.kind === 'installation') return `/installations/${row.id}/update`;
  if (row.kind === 'repair') return `/repairs/${row.id}/update`;
  return `/maintenance/${row.id}/update`;
}

function workLabel(kind: WorkReportRow['kind']) {
  if (kind === 'installation') return 'Lắp đặt';
  if (kind === 'repair') return 'Sửa chữa';
  return 'Bảo trì';
}

function workIcon(kind: WorkReportRow['kind']) {
  if (kind === 'installation') return <PackageCheck size={13} />;
  if (kind === 'repair') return <Wrench size={13} />;
  return <CalendarDays size={13} />;
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

function buildTrendBuckets(rows: Array<{ date: string; kind?: WorkReportRow['kind'] }>) {
  const labels = rows
    .map((row) => toMonthLabel(row.date))
    .filter(Boolean);
  const uniqueLabels = [...new Set(labels)].sort();
  const buckets = (uniqueLabels.length ? uniqueLabels : [toMonthLabel(new Date().toISOString())]).map((label) => ({
    label,
    total: 0,
  }));

  for (const row of rows) {
    const label = toMonthLabel(row.date);
    const bucket = buckets.find((item) => item.label === label);
    if (bucket) bucket.total += 1;
  }

  return buckets;
}

function toMonthLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

function exportReportView(view: ReportView, report: InstallationReport) {
  if (view === 'engineers') {
    exportGroupRows('bao-cao-theo-ky-su.csv', report.byEngineer);
    return;
  }

  if (view === 'customers') {
    exportGroupRows('bao-cao-theo-khach-hang.csv', report.byCustomer);
    return;
  }

  if (view === 'models') {
    exportGroupRows('bao-cao-theo-model.csv', report.byModel);
    return;
  }

  if (view === 'provinces') {
    exportGroupRows('bao-cao-theo-tinh.csv', report.byProvince);
    return;
  }

  exportInstallationRows('bao-cao-lap-dat-chi-tiet.csv', report.rows);
}

function exportGroupRows(filename: string, rows: InstallationReportGroup[]) {
  downloadCsv(filename, [
    ['Tên nhóm', 'Số phiếu', 'Máy', 'Khách hàng', 'Kỹ sư', 'Tỉnh', 'Lắp gần nhất'],
    ...rows.map((row) => [
      row.label,
      row.count,
      row.machines,
      row.customers,
      row.engineers,
      row.provinces,
      formatDate(row.lastInstalledAt),
    ]),
  ]);
}

function exportInstallationRows(filename: string, rows: InstallationReportRow[]) {
  downloadCsv(filename, [
    ['Mã phiếu', 'Ngày lắp', 'Kỹ sư', 'Khách hàng', 'Tỉnh', 'Model', 'Mã máy', 'Serial', 'Trạng thái'],
    ...rows.map((row) => [
      row.code,
      formatDate(row.installedAt),
      row.engineer,
      row.customer,
      row.province,
      row.model,
      row.machineCode,
      row.serialNumber,
      row.status,
    ]),
  ]);
}

function exportWorkRows(filename: string, rows: WorkReportRow[]) {
  downloadCsv(filename, [
    ['Mã phiếu', 'Loại việc', 'Ngày', 'Kỹ sư', 'Khách hàng', 'Tỉnh', 'Model', 'Mã máy', 'Serial', 'Nội dung', 'Trạng thái'],
    ...rows.map((row) => [
      row.code,
      workLabel(row.kind),
      formatDate(row.date),
      row.engineer,
      row.customer,
      row.province,
      row.model,
      row.machineCode,
      row.serialNumber,
      row.note || row.title,
      row.status,
    ]),
  ]);
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

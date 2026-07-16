import { useQuery } from '@tanstack/react-query';
import { ArrowDownWideNarrow, Building2, CalendarDays, ChevronLeft, Download, Loader2, MapPinned, PackageCheck, Table2, UserRound, Users, Wrench } from 'lucide-react';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../api';
import { DateInput } from '../../components/DateInput';
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

type EngineerFilterOption = {
  id: string;
  email: string;
  fullName?: string | null;
  region?: {
    id: string;
    name: string;
  } | null;
  engineerProfile?: {
    expertiseGroup?: string | null;
  } | null;
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
    engineers?: EngineerFilterOption[];
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
  'h-11 min-w-0 rounded-2xl border border-[#ded8d8] bg-[#ffffff] px-3.5 text-sm font-semibold text-[#1f1f1f] outline-none transition hover:border-[#e4e4e7] focus:border-[#18181b] focus:shadow-[0_0_0_4px_rgba(24,24,27,0.12)]';

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
  const engineerDirectory = optionsReport?.filters.engineers ?? [];
  const filterOptions = useMemo(
    () =>
      buildDependentFilterOptions(optionsReport?.rows ?? [], {
        engineerId: draftEngineerId,
        customerId: draftCustomerId,
        modelKey: draftModelKey,
        province: draftProvince,
      }, engineerDirectory),
    [draftCustomerId, draftEngineerId, draftModelKey, draftProvince, engineerDirectory, optionsReport?.rows],
  );
  const selectedFilterLabels = useMemo(
    () =>
      resolveSelectedFilterLabels(optionsReport?.rows ?? [], {
        engineerId: filterEngineerId,
        customerId: filterCustomerId,
        modelKey: filterModelKey,
        province: filterProvince,
      }, engineerDirectory),
    [engineerDirectory, filterCustomerId, filterEngineerId, filterModelKey, filterProvince, optionsReport?.rows],
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
      <div className="grid gap-5 rounded-[28px] border border-[#e4e4e7] bg-white/95 p-5 shadow-[0_12px_30px_rgba(24,24,27,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageTitle
            description="Lắp đặt theo kỳ."
            eyebrow="Báo cáo kỹ thuật"
            title="Báo cáo vận hành kỹ thuật"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#e4e4e7] bg-[#f4f4f5] px-3.5 text-sm font-bold text-[#18181b] hover:border-[#18181b] disabled:opacity-50"
              disabled={!report && !engineerReportQuery.data && !modelReportQuery.data}
              onClick={exportCurrentView}
              type="button"
            >
              <Download size={16} />
              Xuất Excel
            </button>
          </div>
        </div>

        <section className="grid gap-3 rounded-[24px] border border-[#e4e4e7] bg-[#fafafa] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e4e7] pb-3">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#18181b]">Bộ lọc báo cáo</span>
              <p className="mt-0.5 text-xs font-semibold text-[#666666]">Tự tải lại.</p>
            </div>
            <div className="flex items-center gap-2">
              {hasAdvancedFilters ? <span className="rounded-lg border border-[#efd8a8] bg-[#fff8ed] px-2.5 py-1 text-xs font-semibold text-[#9b5a17]">Đang lọc nâng cao</span> : null}
              <button className="inline-flex h-9 items-center justify-center rounded-xl border border-[#ded8d8] bg-white px-3 text-xs font-bold text-[#666666] hover:border-[#e4e4e7] hover:text-[#18181b]" onClick={resetFilters} type="button">
                Xóa lọc
              </button>
            </div>
          </div>

          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
            <DateInput
              className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#71717a]"
              label="Từ ngày"
              onChange={(value) => {
                setDraftFrom(value);
                updateReportFilter('from', value);
              }}
              value={draftFrom}
            />
            <DateInput
              className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#71717a]"
              label="Đến ngày"
              onChange={(value) => {
                setDraftTo(value);
                updateReportFilter('to', value);
              }}
              value={draftTo}
            />
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#71717a]">
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
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#71717a]">
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
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#71717a]">
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
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#71717a]">
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

        <div className="flex gap-2 overflow-x-auto border-b border-[#e4e4e7] pb-3">
          {reportTabs.map((tab) => (
            <button
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-2xl border px-3 text-sm font-bold transition ${
                activeView === tab.key
                  ? 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8] shadow-[0_10px_24px_rgba(37,99,235,0.10)]'
                  : 'border-[#ded8d8] bg-white text-[#666666] hover:border-[#e4e4e7] hover:text-[#18181b]'
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
          <div className="rounded-2xl border border-[#fecdd3] bg-[#fff1f3] px-4 py-3 text-sm font-bold text-[#b5121b]">{error}</div>
        ) : null}

        {report ? <ReportExecutiveSummary from={from} report={report} to={to} /> : null}
        {report ? <ReportScopeInsight labels={selectedFilterLabels} report={report} /> : null}

        {loading && !report ? (
          <div className="grid min-h-[360px] place-items-center rounded-[10px] border border-[#ededf0] bg-[#fafafa] text-[#71717a]">
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
    <section className="grid gap-3 rounded-[12px] border border-[#f1c4c9] bg-[#fafafa] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold text-[#18181b]">{focusTitle}</span>
          <h2 className="mt-1 text-lg font-semibold text-[#18212f]">{activeFilters.join(' | ')}</h2>
          <p className="mt-1 text-sm text-[#71717a]">
            {report.summary.totalInstallations} phiếu · {report.summary.totalMachines} máy · {report.summary.totalCustomers} khách.
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

function ReportExecutiveSummary({ from, report, to }: { from: string; report: InstallationReport; to: string }) {
  const topEngineer = topGroup(report.byEngineer);
  const topCustomer = topGroup(report.byCustomer);
  const topModel = topGroup(report.byModel);
  const topProvince = topGroup(report.byProvince);
  const latest = latestInstallation(report.rows);
  const coverage = [
    `${report.summary.totalEngineers} kỹ sư`,
    `${report.summary.totalCustomers} khách hàng`,
    `${report.summary.totalMachines} máy`,
    `${report.summary.totalProvinces} tỉnh`,
  ].join(' · ');

  return (
    <section className="grid gap-4 rounded-[26px] border border-[#e4e4e7] bg-[linear-gradient(135deg,#fafafa,#ffffff_48%,#fafafa)] p-5 shadow-[0_8px_24px_rgba(24,24,27,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#18181b]">Tóm tắt điều hành</span>
          <h2 className="mt-1 text-2xl font-extrabold leading-tight text-[#1f1f1f]">
            {report.summary.totalInstallations} phiếu lắp đặt trong kỳ {formatDate(from)} - {formatDate(to)}
          </h2>
          <p className="mt-2 max-w-[760px] text-sm font-semibold leading-6 text-[#666666]">
            Phạm vi: {coverage}.
          </p>
        </div>
        <div className="rounded-2xl border border-[#e4e4e7] bg-white px-4 py-3 text-right shadow-[0_12px_28px_rgba(24,24,27,0.06)]">
          <span className="block text-xs font-bold text-[#666666]">Lắp gần nhất</span>
          <strong className="mt-1 block text-sm text-[#1f1f1f]">{latest ? formatDate(latest.installedAt) : '-'}</strong>
          <span className="mt-1 block max-w-[220px] truncate text-xs font-semibold text-[#18181b]">{latest?.code || 'Chưa có phiếu'}</span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ExecutiveFocusCard label="Kỹ sư nổi bật" row={topEngineer} total={report.summary.totalInstallations} />
        <ExecutiveFocusCard label="Khách hàng nổi bật" row={topCustomer} total={report.summary.totalInstallations} />
        <ExecutiveFocusCard label="Model nhiều nhất" row={topModel} total={report.summary.totalInstallations} />
        <ExecutiveFocusCard label="Tỉnh phát sinh nhiều" row={topProvince} total={report.summary.totalInstallations} />
      </div>
    </section>
  );
}

function ExecutiveFocusCard({ label, row, total }: { label: string; row?: InstallationReportGroup; total: number }) {
  const percent = total > 0 && row ? Math.round((row.count / total) * 100) : 0;

  return (
    <article className="grid gap-3 rounded-[22px] border border-[#e4e4e7] bg-white p-4">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#18181b]">{label}</span>
      <div>
        <strong className="line-clamp-2 text-lg font-extrabold leading-tight text-[#1f1f1f]">{row?.label || 'Chưa có dữ liệu'}</strong>
        <p className="mt-1 text-sm font-semibold text-[#666666]">{row ? `${row.count} phiếu · ${percent}% tổng kỳ` : 'Không phát sinh trong kỳ'}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#f1f2f4]">
        <span className="block h-full rounded-full bg-[#18181b]" style={{ width: `${Math.max(0, percent)}%` }} />
      </div>
    </article>
  );
}

function InsightList({ rows, title }: { rows: InstallationReportGroup[]; title: string }) {
  return (
    <div className="rounded-[10px] border border-[#f3d5d8] bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <strong className="text-sm text-[#18212f]">{title}</strong>
        <span className="text-xs font-semibold text-[#71717a]">{rows.length} mục nổi bật</span>
      </div>
      <div className="grid gap-2">
        {rows.length ? rows.map((row) => (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-[#fafafa] px-3 py-2 text-sm" key={row.id}>
            <span className="min-w-0 truncate font-semibold text-[#3f3f46]">{row.label}</span>
            <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-bold text-[#09090b]">{row.count} phiếu</span>
          </div>
        )) : <span className="rounded-lg bg-[#fafafa] px-3 py-3 text-sm font-medium text-[#71717a]">Chưa có dữ liệu phù hợp.</span>}
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
    <div className="grid min-h-[118px] content-between rounded-[22px] border border-[#e4e4e7] bg-[#fafafa] p-4 shadow-[0_12px_28px_rgba(24,24,27,0.04)]">
      <span className="text-sm font-bold text-[#666666]">{label}</span>
      <strong className="text-[38px] font-extrabold leading-none text-[#1f1f1f]">{value}</strong>
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
  const sortedRows = [...rows].sort(compareReportGroups);
  const maxCount = Math.max(1, ...sortedRows.map((row) => row.count));
  const totalCount = sortedRows.reduce((total, row) => total + row.count, 0);

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#e4e4e7] bg-white shadow-[0_14px_38px_rgba(24,24,27,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e4e7] bg-[#fafafa] px-4 py-3">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#18181b]">Ranking</span>
          <h2 className="mt-1 text-base font-extrabold text-[#1f1f1f]">{title}</h2>
        </div>
        <span className="rounded-full border border-[#e4e4e7] bg-white px-3 py-1 text-xs font-bold text-[#18181b]">{rows.length} dòng</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.08em] text-[#666666]">
              <th className="border-b border-[#e4e4e7] px-4 py-3 font-bold">#</th>
              <th className="border-b border-[#e4e4e7] px-4 py-3 font-bold">{labelHeader}</th>
              <th className="border-b border-[#e4e4e7] px-4 py-3 font-bold">Tỷ trọng</th>
              <th className="border-b border-[#e4e4e7] px-4 py-3 font-bold">Số phiếu</th>
              <th className="border-b border-[#e4e4e7] px-4 py-3 font-bold">Phạm vi liên quan</th>
              <th className="border-b border-[#e4e4e7] px-4 py-3 font-bold">Lắp gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, index) => {
              const percent = totalCount > 0 ? Math.round((row.count / totalCount) * 100) : 0;
              const width = Math.max(4, (row.count / maxCount) * 100);
              return (
              <tr className="hover:bg-[#fafafa]" key={row.id}>
                <td className="border-b border-[#e4ecee] px-4 py-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#f4f4f5] text-xs font-extrabold text-[#18181b]">{index + 1}</span>
                </td>
                <td className="border-b border-[#e4ecee] px-4 py-3 font-bold text-[#1f1f1f]">
                  <GroupLink from={from} row={row} to={to} variant={variant} />
                </td>
                <td className="border-b border-[#e4ecee] px-4 py-3">
                  <div className="grid gap-1.5">
                    <div className="h-2 overflow-hidden rounded-full bg-[#f1f2f4]">
                      <span className="block h-full rounded-full bg-[#18181b]" style={{ width: `${width}%` }} />
                    </div>
                    <span className="text-xs font-bold text-[#666666]">{percent}% tổng nhóm</span>
                  </div>
                </td>
                <td className="border-b border-[#e4ecee] px-4 py-3 text-xl font-extrabold text-[#18181b]">{row.count}</td>
                <td className="border-b border-[#e4ecee] px-4 py-3 text-[#333333]">
                  <div className="flex flex-wrap gap-1.5">
                    <MiniMetric label="máy" value={row.machines} />
                    <MiniMetric label="khách" value={row.customers} />
                    <MiniMetric label="kỹ sư" value={row.engineers} />
                    <MiniMetric label="tỉnh" value={row.provinces} />
                  </div>
                </td>
                <td className="border-b border-[#e4ecee] px-4 py-3 text-[#666666]">{formatDate(row.lastInstalledAt)}</td>
              </tr>
              );
            })}
            {sortedRows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-[#666666]" colSpan={6}>
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

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-lg border border-[#ededf0] bg-[#fafafa] px-2 py-1 text-xs font-bold text-[#333333]">
      {value} {label}
    </span>
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
      <Link className="inline-flex items-center gap-1.5 hover:text-[#18181b]" to={`/reports?view=engineers&from=${from}&to=${to}&engineerId=${row.id}`}>
        {row.label}
        <ArrowDownWideNarrow size={14} />
      </Link>
    );
  }

  if (variant === 'models' && row.id !== 'unknown-model') {
    return (
      <Link className="inline-flex items-center gap-1.5 hover:text-[#18181b]" to={`/reports?view=models&from=${from}&to=${to}&modelKey=${encodeURIComponent(row.id)}`}>
        {row.label}
        <ArrowDownWideNarrow size={14} />
      </Link>
    );
  }

  if (variant === 'customers' && row.id !== 'unknown-customer') {
    return (
      <Link className="inline-flex items-center gap-1.5 hover:text-[#18181b]" to={`/customers/profile?customerId=${row.id}`}>
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
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-[#ededf0] bg-[#fafafa] p-4">
      <div>
        <span className="text-xs font-semibold text-[#18181b]">{eyebrow}</span>
        <h2 className="mt-1 text-2xl font-semibold text-[#18212f]">{title}</h2>
        {meta ? <p className="mt-1 text-sm font-medium text-[#71717a]">{meta}</p> : null}
      </div>
      <button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#e4e4e7] bg-white px-3 text-sm font-semibold text-[#3f3f46] hover:border-[#f1c4c9] hover:text-[#18181b]" onClick={onBack} type="button">
        <ChevronLeft size={16} />
        Back
      </button>
    </div>
  );
}

function CustomerCareTable({ rows, title }: { rows: DrilldownCustomer[]; title: string }) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-[#ededf0] bg-white">
      <TableHeader count={rows.length} title={title} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase text-[#71717a]">
              <th className="border-b border-[#ededf0] px-4 py-2.5">Khách hàng</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Tỉnh</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Lắp</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Sửa</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Bảo trì</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Máy</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="hover:bg-[#fafafa]" key={row.id}>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-bold text-[#18212f]">
                  {row.id.startsWith('unknown') || !row.id ? (
                    row.label
                  ) : (
                    <Link className="hover:text-[#18181b]" to={`/customers/profile?customerId=${row.id}`}>
                      {row.label}
                    </Link>
                  )}
                  {row.assigned ? <span className="ml-2 rounded-md bg-[#eefaf3] px-2 py-1 text-[11px] text-[#177245]">phụ trách</span> : null}
                </td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#71717a]">{row.province}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold">{row.installations}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold">{row.repairs}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold">{row.maintenances}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold">{row.machines}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#71717a]">{formatDate(row.lastWorkedAt)}</td>
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
    <section className="overflow-hidden rounded-[10px] border border-[#ededf0] bg-white">
      <TableHeader count={rows.length} title={title} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase text-[#71717a]">
              <th className="border-b border-[#ededf0] px-4 py-2.5">Máy</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Model</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Khách hàng</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Tỉnh</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Lắp</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Sửa</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Bảo trì</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Ghi chú gần đây</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="hover:bg-[#fafafa]" key={row.id}>
                <td className="border-b border-[#eeeeee] px-4 py-3">
                  <strong className="block text-[#18212f]">{row.label || '-'}</strong>
                  <span className="text-xs text-[#71717a]">{row.serialNumber}</span>
                </td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#3f3f46]">{row.model}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold text-[#3f3f46]">
                  {row.customerId ? <Link className="hover:text-[#18181b]" to={`/customers/profile?customerId=${row.customerId}`}>{row.customer}</Link> : row.customer}
                </td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#71717a]">{row.province}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold">{row.installations}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold">{row.repairs}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold">{row.maintenances}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#71717a]">{row.notes[0] || formatDate(row.lastWorkedAt)}</td>
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
  const sortedRows = [...rows].sort(compareWorkRowsByDateDesc);

  return (
    <section className="overflow-hidden rounded-[10px] border border-[#ededf0] bg-white">
      <TableHeader count={rows.length} title={title} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase text-[#71717a]">
              <th className="border-b border-[#ededf0] px-4 py-2.5">Phiếu</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Loại việc</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Ngày</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Khách hàng</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Máy / model</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Nội dung</th>
              <th className="border-b border-[#ededf0] px-4 py-2.5">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr className="hover:bg-[#fafafa]" key={`${row.kind}-${row.id}`}>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-bold text-[#18212f]">
                  <Link className="hover:text-[#18181b]" to={workHref(row)}>
                    {row.code}
                  </Link>
                </td>
                <td className="border-b border-[#eeeeee] px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#e4e4e7] bg-[#fafafa] px-2.5 py-1 text-xs font-semibold text-[#71717a]">
                    {workIcon(row.kind)}
                    {workLabel(row.kind)}
                  </span>
                </td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#71717a]">{formatDate(row.date)}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 font-semibold text-[#3f3f46]">
                  {row.customerId ? <Link className="hover:text-[#18181b]" to={`/customers/profile?customerId=${row.customerId}`}>{row.customer}</Link> : row.customer}
                </td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#3f3f46]">
                  <strong className="block">{row.machineCode}</strong>
                  <span className="text-xs text-[#71717a]">{row.model}</span>
                </td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#3f3f46]">{row.note || row.title}</td>
                <td className="border-b border-[#eeeeee] px-4 py-3 text-[#71717a]">{row.status}</td>
              </tr>
            ))}
            <EmptyRow colSpan={7} show={sortedRows.length === 0} />
          </tbody>
        </table>
      </div>
    </section>
  );
}

function compareWorkRowsByDateDesc(left: WorkReportRow, right: WorkReportRow) {
  return dateTime(right.date) - dateTime(left.date) || left.code.localeCompare(right.code);
}

function TableHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ededf0] bg-[#fafafa] px-4 py-3">
      <h2 className="text-base font-semibold text-[#18212f]">{title}</h2>
      <span className="text-xs font-semibold text-[#71717a]">{count} dòng</span>
    </div>
  );
}

function EmptyRow({ show, colSpan }: { show: boolean; colSpan: number }) {
  if (!show) return null;
  return (
    <tr>
      <td className="px-4 py-8 text-center text-sm font-medium text-[#71717a]" colSpan={colSpan}>
        Không có dữ liệu trong kỳ này.
      </td>
    </tr>
  );
}

function TrendPanel({ rows, title }: { rows: Array<{ date: string; kind?: WorkReportRow['kind'] }>; title: string }) {
  const buckets = buildTrendBuckets(rows);
  const maxValue = Math.max(1, ...buckets.map((item) => item.total));

  return (
    <section className="rounded-[10px] border border-[#ededf0] bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-semibold text-[#18181b]">Xu hướng</span>
          <h2 className="mt-1 text-base font-semibold text-[#18212f]">{title}</h2>
        </div>
        <span className="text-xs font-semibold text-[#71717a]">{rows.length} việc</span>
      </div>
      <div className="grid min-h-[190px] grid-cols-[repeat(auto-fit,minmax(56px,1fr))] items-end gap-2 border-b border-[#ededf0] pb-3">
        {buckets.map((item) => (
          <div className="grid gap-2 text-center" key={item.label}>
            <div className="flex h-[142px] items-end justify-center rounded-lg bg-[#fafafa] px-2">
              <span
                className="block w-full max-w-10 rounded-t-lg bg-[#18181b]"
                style={{ height: `${Math.max(6, (item.total / maxValue) * 100)}%` }}
                title={`${item.label}: ${item.total}`}
              />
            </div>
            <span className="text-[11px] font-semibold text-[#71717a]">{item.label}</span>
            <strong className="text-sm text-[#18212f]">{item.total}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function DetailTable({ title, rows }: { title: string; rows: InstallationReportRow[] }) {
  const groups = groupInstallationRowsByDate(rows);

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#e4e4e7] bg-white shadow-[0_14px_38px_rgba(24,24,27,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e4e7] bg-[#fafafa] px-4 py-3">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#18181b]">Chi tiết theo ngày</span>
          <h2 className="mt-1 text-base font-extrabold text-[#1f1f1f]">{title}</h2>
        </div>
        <span className="rounded-full border border-[#e4e4e7] bg-white px-3 py-1 text-xs font-bold text-[#18181b]">{rows.length} máy / phiếu</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.08em] text-[#666666]">
              <th className="border-b border-[#e4e4e7] px-4 py-3 font-bold">Mã phiếu</th>
              <th className="border-b border-[#e4e4e7] px-4 py-3 font-bold">Kỹ sư</th>
              <th className="border-b border-[#e4e4e7] px-4 py-3 font-bold">Khách hàng</th>
              <th className="border-b border-[#e4e4e7] px-4 py-3 font-bold">Model</th>
              <th className="border-b border-[#e4e4e7] px-4 py-3 font-bold">Mã máy</th>
              <th className="border-b border-[#e4e4e7] px-4 py-3 font-bold">Serial</th>
              <th className="border-b border-[#e4e4e7] px-4 py-3 font-bold">Tỉnh</th>
              <th className="border-b border-[#e4e4e7] px-4 py-3 font-bold">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <DateDetailGroup group={group} key={group.key} />
            ))}
            {groups.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm font-semibold text-[#666666]" colSpan={8}>
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

function DateDetailGroup({ group }: { group: { key: string; label: string; rows: InstallationReportRow[] } }) {
  return (
    <>
      <tr>
        <td className="border-b border-[#e4ecee] bg-[#fafafa] px-4 py-2" colSpan={8}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="h-px w-7 bg-[#d8dde5]" />
            <span className="font-semibold text-[#8a94a3]">{group.label}</span>
            <span className="rounded-md border border-[#e5e9ef] bg-white px-2 py-0.5 font-semibold text-[#9aa3af]">{group.rows.length} phiếu</span>
          </div>
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr className="hover:bg-[#fafafa]" key={row.id}>
          <td className="border-b border-[#e4ecee] px-4 py-3 font-bold text-[#1f1f1f]">
            <Link className="hover:text-[#18181b]" to={`/installations/${row.id}/update`}>
              {row.code}
            </Link>
          </td>
          <td className="border-b border-[#e4ecee] px-4 py-3 text-[#333333]">{row.engineer}</td>
          <td className="border-b border-[#e4ecee] px-4 py-3 font-semibold text-[#333333]">{row.customer}</td>
          <td className="border-b border-[#e4ecee] px-4 py-3 text-[#333333]">{row.model}</td>
          <td className="border-b border-[#e4ecee] px-4 py-3 text-[#333333]">{row.machineCode}</td>
          <td className="border-b border-[#e4ecee] px-4 py-3 text-[#333333]">{row.serialNumber}</td>
          <td className="border-b border-[#e4ecee] px-4 py-3 text-[#333333]">{row.province}</td>
          <td className="border-b border-[#e4ecee] px-4 py-3">
            <span className="inline-flex min-h-7 items-center rounded-lg border border-[#ededf0] bg-[#fafafa] px-2.5 text-xs font-bold text-[#666666]">
              {row.status}
            </span>
          </td>
        </tr>
      ))}
    </>
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

function compareReportGroups(left: InstallationReportGroup, right: InstallationReportGroup) {
  return right.count - left.count || dateTime(right.lastInstalledAt) - dateTime(left.lastInstalledAt) || left.label.localeCompare(right.label, 'vi');
}

function topGroup(rows: InstallationReportGroup[]) {
  return [...rows].filter((row) => row.count > 0).sort(compareReportGroups)[0];
}

function latestInstallation(rows: InstallationReportRow[]) {
  return [...rows].sort(compareInstallationRowsByDateDesc)[0];
}

function compareInstallationRowsByDateDesc(left: InstallationReportRow, right: InstallationReportRow) {
  return dateTime(right.installedAt) - dateTime(left.installedAt) || left.code.localeCompare(right.code);
}

function groupInstallationRowsByDate(rows: InstallationReportRow[]) {
  const groups = new Map<string, InstallationReportRow[]>();

  rows.forEach((row) => {
    const key = dateKey(row.installedAt);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return Array.from(groups.entries())
    .sort(([left], [right]) => compareDateKeysDesc(left, right))
    .map(([key, groupRows]) => ({
      key,
      label: key === '__missing__' ? 'Chưa có ngày lắp' : formatDate(key),
      rows: groupRows.sort(compareInstallationRowsByDateDesc),
    }));
}

function compareDateKeysDesc(left: string, right: string) {
  if (left === '__missing__') return 1;
  if (right === '__missing__') return -1;
  return right.localeCompare(left);
}

function dateKey(value?: string | null) {
  if (!value) return '__missing__';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '__missing__';
  return date.toISOString().slice(0, 10);
}

function dateTime(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '';
}

function buildDependentFilterOptions(rows: InstallationReportRow[], filters: ReportFilterState, engineers: EngineerFilterOption[] = []) {
  const shouldShowAllEngineers = !filters.customerId && !filters.modelKey && !filters.province;
  return {
    engineers: mergeEngineerOptions(buildOptions(rows, 'engineer', filters), engineers, {
      includeAll: shouldShowAllEngineers,
      selectedEngineerId: filters.engineerId,
    }),
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

function mergeEngineerOptions(
  rowOptions: ReportFilterOption[],
  engineers: EngineerFilterOption[],
  mergeOptions: { includeAll: boolean; selectedEngineerId?: string } = { includeAll: true },
): ReportFilterOption[] {
  const nextOptions = new Map(rowOptions.map((option) => [option.id, option]));

  for (const engineer of engineers) {
    if (!engineer.id || nextOptions.has(engineer.id)) continue;
    if (!mergeOptions.includeAll && engineer.id !== mergeOptions.selectedEngineerId) continue;
    nextOptions.set(engineer.id, {
      id: engineer.id,
      label: [engineer.fullName || engineer.email, engineer.region?.name].filter(Boolean).join(' - '),
      count: 0,
    });
  }

  return [...nextOptions.values()].sort((first, second) => {
    if (second.count !== first.count) return second.count - first.count;
    return first.label.localeCompare(second.label, 'vi');
  });
}

function resolveSelectedFilterLabels(rows: InstallationReportRow[], filters: ReportFilterState, engineers: EngineerFilterOption[] = []): Record<FilterKey, string> {
  const allOptions = {
    engineer: mergeEngineerOptions(buildOptions(rows, 'engineer', { engineerId: '', customerId: '', modelKey: '', province: '' }), engineers, {
      includeAll: true,
    }),
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

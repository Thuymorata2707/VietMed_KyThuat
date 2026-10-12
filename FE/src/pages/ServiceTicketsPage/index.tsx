import { Archive, ArrowLeft, ArrowRight, BarChart3, ChevronDown, ClipboardCheck, Download, Filter, Loader2, Plus, RefreshCw, Search, Stethoscope, Trash2, Wrench, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages } from '../../api';
import { getRoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { DeleteTicketDialog } from '../../components/DeleteTicketDialog';
import { DateInput } from '../../components/DateInput';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { queryKeys } from '../../lib/queryKeys';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { displayLabel } from '../../utils/displayLabels';
import { isTechnicalUser, technicalUserName } from '../../utils/technicalUsers';
import { hasDeleteRequestNote } from '../../utils/workDeleteRequests';

type ServiceTicketKind = 'repairs' | 'maintenance';
type BoardKind = ServiceTicketKind | 'installations';
type TicketScope = BoardKind | 'demo' | 'device-service';
type QueueKey = 'action' | 'active' | 'review' | 'closed' | 'all';
type GroupByKey = 'date' | 'engineer' | 'industry' | 'customer';
type WorkKind = 'installation' | 'repair' | 'maintenance' | 'demo' | 'applicationSupport';

type ProductIndustry = {
  id: string;
  name: string;
  code?: string | null;
};

type EngineerOption = {
  id: string;
  email: string;
  fullName?: string | null;
  engineerProfile?: unknown;
  role?: { name?: string | null } | null;
  roleName?: string | null;
  status?: string | null;
};

type MachineSummary = {
  id?: string | null;
  name?: string | null;
  machineCode?: string | null;
  serialNumber?: string | null;
  modelName?: string | null;
  inventoryStatus?: string | null;
  status?: string | null;
  demoCategory?: 'DEMO_UNIT' | 'DEMO_STOCK' | 'DEMO_USED' | null;
  demoPreparationStatus?: 'NOT_REQUIRED' | 'REQUIRED' | 'COMPLETED' | null;
  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;
  productCategory?: string | null;
  businessLine?: {
    name?: string | null;
    productIndustry?: {
      name?: string | null;
    } | null;
  } | null;
  customer?: {
    id?: string | null;
    name?: string | null;
    hospitalName?: string | null;
    province?: string | null;
    fullAddress?: string | null;
    address?: string | null;
  } | null;
};

type CustomerOption = {
  id: string;
  name: string;
  hospitalName?: string | null;
  province?: string | null;
  fullAddress?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  contactPosition?: string | null;
  contactPhone?: string | null;
  phone?: string | null;
};

type DemoLoanRow = {
  id: string;
  code: string;
  ticketCode?: string | null;
  status: 'PLANNED' | 'HANDED_OVER' | 'OVERDUE' | 'RETURNED' | 'CANCELLED';
  machineUse?: 'DEMO_UNIT' | 'NEW_STOCK' | 'DEMO_USED' | 'UNKNOWN';
  preparationStatus?: 'NOT_REQUIRED' | 'REQUIRED' | 'COMPLETED';
  preparedAt?: string | null;
  preparationNote?: string | null;
  returnRequiresRepair?: boolean;
  plannedHandoverAt: string;
  handedOverAt?: string | null;
  expectedReturnAt: string;
  returnedAt?: string | null;
  handedOverBy?: EngineerOption | null;
  returnedBy?: EngineerOption | null;
  handoverAddress?: string | null;
  receiverName?: string | null;
  receiverPosition?: string | null;
  receiverPhone?: string | null;
  handoverCondition?: string | null;
  handoverAccessories?: string[] | null;
  handoverNote?: string | null;
  returnCondition?: string | null;
  returnAccessories?: string[] | null;
  returnNote?: string | null;
  purpose?: string | null;
  engineer?: EngineerOption | null;
  assignments?: Array<{ isLead: boolean; engineer: EngineerOption }>;
  customer?: CustomerOption | null;
  machine?: MachineSummary | null;
};

type DemoReturnDraft = {
  items: DemoReturnMachineDraft[];
  occurredAt: string;
};

type DemoReturnMachineDraft = {
  accessoriesText: string;
  condition: string;
  loan: DemoLoanRow;
  note: string;
  needsRepair: boolean;
};

type DeviceServiceStatus = 'RECEIVED' | 'RETURNED' | 'CANCELLED';

type DeviceServiceRow = {
  id: string;
  receiveCode: string;
  returnCode?: string | null;
  status: DeviceServiceStatus;
  receivedAt: string;
  returnedAt?: string | null;
  usingDepartment?: string | null;
  representative?: string | null;
  representativePosition?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  deviceName?: string | null;
  modelName?: string | null;
  serialNumber?: string | null;
  warrantyStatus?: string | null;
  warrantyTerm?: string | null;
  receivedCondition?: string | null;
  receivedAccessories?: string | null;
  preliminaryCause?: string | null;
  repairMethod?: string | null;
  repairCostItems?: string | null;
  resultNote?: string | null;
  returnCondition?: string | null;
  totalRepairCost?: string | null;
  repairCostInWords?: string | null;
  note?: string | null;
  usedParts?: DeviceUsedPartRow[];
  engineer?: EngineerOption | null;
  customer?: CustomerOption | null;
  machine?: MachineSummary | null;
};

type DeviceUsedPartRow = {
  id?: string;
  name?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  serialNumber?: string | null;
  unitCost?: number | string | null;
  unitPrice?: number | string | null;
  totalPrice?: number | string | null;
  note?: string | null;
};

type DeviceUsedPartDraft = {
  name: string;
  note: string;
  quantity: number;
  serialNumber: string;
  unit: string;
  unitCost: number;
  unitPrice: number;
};

type DeviceReceiveForm = {
  address: string;
  contactPhone: string;
  customerId: string;
  deviceName: string;
  engineerId: string;
  machineId: string;
  modelName: string;
  preliminaryCause: string;
  receivedAccessories: string;
  receivedAt: string;
  receivedCondition: string;
  representative: string;
  representativePosition: string;
  serialNumber: string;
  usingDepartment: string;
  warrantyStatus: string;
  warrantyTerm: string;
};

type DeviceReturnForm = {
  repairCostInWords: string;
  repairCostItems: string;
  repairMethod: string;
  resultNote: string;
  returnCondition: string;
  returnedAt: string;
  ticket: DeviceServiceRow;
  totalRepairCost: string;
  usedParts: DeviceUsedPartDraft[];
};

type ServiceRow = {
  id: string;
  code?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  type?: string | null;
  reportedAt?: string | null;
  scheduledDate?: string | null;
  completedAt?: string | null;
  reviewStatus?: string | null;
  reviewNote?: string | null;
  engineer?: EngineerOption | null;
  customer?: {
    name?: string | null;
    hospitalName?: string | null;
    province?: string | null;
    fullAddress?: string | null;
    address?: string | null;
  } | null;
  machine?: MachineSummary | null;
  usingDepartment?: string | null;
  address?: string | null;
};

type InstallationRow = {
  id: string;
  code?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  status?: string | null;
  installedAt?: string | null;
  reviewStatus?: string | null;
  reviewNote?: string | null;
  installedBy?: EngineerOption | null;
  installedDeviceItems?: Array<{
    itemName?: string | null;
    model?: string | null;
    serialNumber?: string | null;
  }> | null;
  machine?: MachineSummary | null;
  customer?: {
    name?: string | null;
    hospitalName?: string | null;
    province?: string | null;
    fullAddress?: string | null;
    address?: string | null;
  } | null;
  businessLine?: {
    name?: string | null;
    productIndustry?: {
      name?: string | null;
    } | null;
  } | null;
  plannedModelName?: string | null;
  plannedMachineModel?: {
    name?: string | null;
    displayName?: string | null;
    businessLine?: {
      name?: string | null;
      productIndustry?: {
        name?: string | null;
      } | null;
    } | null;
  } | null;
  warrantyEndDate?: string | null;
  warrantyCard?: {
    endDate?: string | null;
  } | null;
};

type BoardItem = {
  id: string;
  code: string;
  title: string;
  kind: 'repair' | 'maintenance' | 'installation';
  status: string;
  reviewStatus?: string | null;
  reviewNote?: string | null;
  date?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  engineer?: EngineerOption | null;
  machine?: MachineSummary | null;
  customer?: { name?: string | null; hospitalName?: string | null; province?: string | null; fullAddress?: string | null; address?: string | null } | null;
  productIndustry?: string | null;
  warrantyEndDate?: string | null;
  secondary?: string | null;
  address?: string | null;
  urgency?: string | null;
};

type TechnicalReportRow = {
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

type TechnicalReport = {
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
  rows: TechnicalReportRow[];
};

type TicketPortalCard = {
  countKey: TicketScope;
  icon: ReactNode;
  label: string;
  meta?: string;
  value: TicketScope;
};

const serviceTicketOptions: TicketPortalCard[] = [
  {
    countKey: 'repairs',
    icon: <Wrench size={23} />,
    label: 'Sửa chữa',
    value: 'repairs',
  },
  {
    countKey: 'device-service',
    icon: <Archive size={23} />,
    label: 'Nhận / trả thiết bị',
    meta: 'PNTB · PTTB',
    value: 'device-service',
  },
  {
    countKey: 'maintenance',
    icon: <ClipboardCheck size={23} />,
    label: 'Bảo trì',
    value: 'maintenance',
  },
  {
    countKey: 'installations',
    icon: <Stethoscope size={23} />,
    label: 'Lắp đặt',
    value: 'installations',
  },
  {
    countKey: 'demo',
    icon: <Archive size={23} />,
    label: 'Demo / dùng thử',
    value: 'demo',
  },
];

const queues: Array<{ key: QueueKey; label: string }> = [
  { key: 'all', label: 'Tất cả phiếu' },
  { key: 'action', label: 'Cần xử lý' },
  { key: 'active', label: 'Đang làm' },
  { key: 'review', label: 'Chờ phê duyệt' },
  { key: 'closed', label: 'Đã xong' },
];

const groupOptions: Array<{ label: string; value: GroupByKey }> = [
  { label: 'Theo ngày', value: 'date' },
  { label: 'Theo kỹ sư', value: 'engineer' },
  { label: 'Theo ngành hàng', value: 'industry' },
  { label: 'Theo khách hàng', value: 'customer' },
];

export function ServiceTicketsPage({ user }: { user: ApiUser }) {
  const [searchParams] = useSearchParams();
  const initialKind = searchParams.get('type');
  const [selectedKind, setSelectedKind] = useState<TicketScope | ''>(
    initialKind === 'demo' || initialKind === 'device-service' ? initialKind : '',
  );
  useEffect(() => {
    if (initialKind === 'demo' || initialKind === 'device-service') setSelectedKind(initialKind);
  }, [initialKind]);
  const role = getRoleName(user);
  const defaultRange = useMemo(() => currentMonthRange(), []);
  const [reportFrom, setReportFrom] = useState(defaultRange.from);
  const [reportTo, setReportTo] = useState(defaultRange.to);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const overviewQuery = useTicketPortalOverview();
  const reportQuery = useTechnicalWorkRegister(reportFrom, reportTo, role !== 'engineer' && isReportOpen);
  const overviewCounts = overviewQuery.data ?? { demo: 0, installations: 0, maintenance: 0, repairs: 0, 'device-service': 0 };
  const loading = overviewQuery.isLoading || overviewQuery.isFetching;
  const error =
    (overviewQuery.error instanceof Error ? overviewQuery.error.message : '') ||
    (reportQuery.error instanceof Error ? reportQuery.error.message : '');

  if (!selectedKind) {
    return (
      <PageFrame>
        <TicketPortalHero loading={loading} onRefresh={() => void overviewQuery.refetch()} />
        {error ? <Notice message={error} /> : null}
        <TicketPortalFlowBoard counts={overviewCounts} loading={loading} onSelect={setSelectedKind} />
        {role !== 'engineer' ? (isReportOpen ? (
          <TechnicalWorkRegister
            from={reportFrom}
            loading={reportQuery.isLoading || reportQuery.isFetching}
            onClose={() => setIsReportOpen(false)}
            onFromChange={setReportFrom}
            onRefresh={() => void reportQuery.refetch()}
            onToChange={setReportTo}
            report={reportQuery.data}
            to={reportTo}
          />
        ) : (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e7e1db] bg-white p-4 shadow-[0_8px_24px_rgba(45,35,26,0.045)] sm:p-5">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#252c30]">Công việc trong kỳ</h2>
            </div>
            <button className="secondary-button" onClick={() => setIsReportOpen(true)} type="button">
              <BarChart3 size={16} />
              Mở báo cáo tháng
            </button>
          </section>
        )) : null}
      </PageFrame>
    );
  }

  if (selectedKind === 'demo') {
    return (
      <PageFrame>
        <DemoLoansBoard onBack={() => setSelectedKind('')} user={user} />
      </PageFrame>
    );
  }

  if (selectedKind === 'device-service') {
    return (
      <PageFrame>
        <DeviceServiceBoard onBack={() => setSelectedKind('')} user={user} />
      </PageFrame>
    );
  }

  return (
    <OperationsBoard
      kind={selectedKind}
      onBack={() => setSelectedKind('')}
      reportHref={`/technical-statistics?workType=${selectedKind === 'maintenance' ? 'maintenance' : selectedKind === 'installations' ? 'installation' : 'repair'}&returnTo=/service-tickets`}
      title={`Tổng hợp phiếu ${ticketScopeLabel(selectedKind).toLowerCase()}`}
      user={user}
    />
  );
}

export function InstallationsPage({ user }: { user: ApiUser }) {
  return (
    <OperationsBoard
      kind="installations"
      reportHref="/technical-statistics?workType=installation&returnTo=/installations"
      title="Kế hoạch lắp đặt"
      user={user}
    />
  );
}

function useTicketPortalOverview() {
  return useQuery({
    queryKey: queryKeys.serviceTickets.board('portal', 'overview'),
    queryFn: () => apiFetch<Record<TicketScope, number>>('/reports/service-ticket-overview'),
  });
}

function useTechnicalWorkRegister(from: string, to: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: queryKeys.reports.installations(`work-register:${from}:${to}`),
    queryFn: async () => apiFetch<TechnicalReport>(`/reports/technical?from=${from}&to=${to}`),
  });
}

function TicketPortalHero({ loading, onRefresh }: { loading: boolean; onRefresh: () => void }) {
  return (
    <header className="ticket-portal-hero flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white px-5 py-5 md:px-6">
      <h1 className="text-[clamp(26px,3vw,36px)] font-semibold leading-tight tracking-[-0.04em] text-[#252c30]">Trung tâm phiếu kỹ thuật</h1>
      <button className="secondary-button" disabled={loading} onClick={onRefresh} type="button">
          {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
        Làm mới
      </button>
    </header>
  );
}

function TicketPortalFlowBoard({ counts, loading, onSelect }: { counts: Record<TicketScope, number>; loading: boolean; onSelect: (value: TicketScope) => void }) {
  return (
    <section className="ticket-portal-work-panel overflow-hidden rounded-2xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe5df] px-4 py-4 sm:px-5">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#252c30]">Chọn loại phiếu</h2>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3 sm:p-4">
        {serviceTicketOptions.map((item) => (
          <TicketPortalListButton count={counts[item.countKey]} item={item} key={item.value} loading={loading} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

function TicketPortalListButton({
  count,
  item,
  loading,
  onSelect,
}: {
  count: number;
  item: TicketPortalCard;
  loading: boolean;
  onSelect: (value: TicketScope) => void;
}) {
  const className = [
    'group grid min-h-[76px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[#e8e3de] bg-white p-3 text-left transition hover:border-[#bd8a8e] hover:bg-[#fffdfc] hover:shadow-[0_6px_18px_rgba(75,34,37,0.07)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861b27] active:translate-y-px sm:p-4',
  ].join(' ');

  return (
    <button className={className} onClick={() => onSelect(item.value)} type="button">
      <span className={`${ticketPortalIconClass(item.value)} flex h-10 w-10 items-center justify-center rounded-xl`}>
        {item.icon}
      </span>
      <span className="grid min-w-0 gap-1">
        <strong className="truncate text-base font-semibold text-[#202124]">{item.label}</strong>
        {item.meta ? <span className="text-xs text-[#737b80]">{item.meta}</span> : null}
      </span>
      <span className="grid justify-items-end gap-1">
        <strong className="text-xl leading-none tabular-nums text-[#252c30]">{loading ? '—' : count}</strong>
        <ArrowRight className="text-[#861b27] transition group-hover:translate-x-0.5" size={15} />
      </span>
    </button>
  );
}

function TechnicalWorkRegister({
  from,
  loading,
  onClose,
  onFromChange,
  onRefresh,
  onToChange,
  report,
  to,
}: {
  from: string;
  loading: boolean;
  onClose: () => void;
  onFromChange: (value: string) => void;
  onRefresh: () => void;
  onToChange: (value: string) => void;
  report?: TechnicalReport;
  to: string;
}) {
  const navigate = useNavigate();
  const rows = report?.rows ?? [];
  const [kindFilter, setKindFilter] = useState<WorkKind | ''>('');
  const filteredRows = useMemo(
    () => kindFilter ? rows.filter((row) => row.kind === kindFilter) : rows,
    [kindFilter, rows],
  );
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [from, kindFilter, rows.length, to]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <section className="grid gap-4 rounded-2xl border border-[#e7e1db] bg-white p-4 shadow-[0_8px_24px_rgba(45,35,26,0.045)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.025em] text-[#252c30]">Công việc trong kỳ</h2>
          <span className="mt-1 block text-sm text-[#737b80]">{loading ? 'Đang tải' : `${filteredRows.length} phiếu`}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="secondary-button" onClick={onClose} type="button">
            Thu gọn
          </button>
          <button className="secondary-button" disabled={loading} onClick={onRefresh} type="button">
            {loading ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
            Làm mới
          </button>
          <button className="primary-button" disabled={!filteredRows.length} onClick={() => exportTechnicalWorkExcel(filteredRows, from, to)} type="button">
            <Download size={16} />
            Xuất Excel
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl bg-[#f7f5f2] p-3 sm:grid-cols-2 sm:items-end sm:p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_240px]">
        <DateInput className="operation-filter-field" label="Từ ngày" onChange={onFromChange} value={from} />
        <DateInput className="operation-filter-field" label="Đến ngày" onChange={onToChange} value={to} />
        <label className="grid gap-1.5 text-xs font-semibold text-[#4d565b]">
          <span>Loại phiếu</span>
          <select
            className="form-input h-10 bg-white text-sm"
            onChange={(event) => setKindFilter(event.target.value as WorkKind | '')}
            value={kindFilter}
          >
            <option value="">Tất cả loại phiếu</option>
            <option value="repair">Sửa chữa</option>
            <option value="installation">Lắp đặt</option>
            <option value="maintenance">Bảo trì</option>
            <option value="demo">Demo / dùng thử</option>
            <option value="applicationSupport">Hỗ trợ ứng dụng</option>
          </select>
        </label>
      </div>

      <div className="grid gap-2 min-[1600px]:hidden">
        {loading ? <div className="grid min-h-24 place-items-center rounded-xl bg-[#f7f5f2] text-sm text-[#667085]"><Loader2 className="spin-icon" size={19} />Đang tổng hợp dữ liệu</div> : null}
        {!loading && pagedRows.map((row) => (
          <Link className="group grid gap-2 rounded-xl border border-[#e8e3de] p-3 transition hover:border-[#bd8a8e] hover:bg-[#fffdfc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#861b27] sm:p-4" key={`${row.kind}-${row.id}`} to={technicalWorkHref(row)}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="grid gap-1"><span className="text-xs text-[#737b80]">{formatDate(row.date)}</span><strong className="text-sm text-[#252c30]">{row.code} · {workKindLabel(row.kind)}</strong></div>
              <span className="rounded-md bg-[#f7f5f2] px-2 py-1 text-xs font-semibold text-[#4d565b]">{displayLabel(row.status)}</span>
            </div>
            <div className="border-t border-[#f0ece8] pt-2">
              <strong className="block truncate text-sm text-[#252c30]">{row.machineCode || row.model || 'Chưa gắn thiết bị'}</strong>
              <span className="block truncate text-xs text-[#737b80]">{[row.model, row.serialNumber ? `S/N ${row.serialNumber}` : ''].filter(Boolean).join(' · ') || 'Không có thông tin model/serial'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="min-w-0 truncate text-[#4d565b]">{row.customer || 'Chưa có khách hàng'}</span>
              <span className="truncate text-right text-[#737b80]">{row.province || 'Chưa rõ địa điểm'}</span>
            </div>
            <span className="truncate text-xs text-[#737b80]">Kỹ sư: {row.engineer || 'Chưa phân công'}</span>
            <span className="flex items-center justify-end gap-1 text-xs font-semibold text-[#861b27]">Mở phiếu <ArrowRight size={14} className="transition group-hover:translate-x-0.5" /></span>
          </Link>
        ))}
        {!loading && filteredRows.length === 0 ? <p className="rounded-xl bg-[#f7f5f2] px-4 py-8 text-center text-sm text-[#667085]">Không có phiếu phù hợp với bộ lọc.</p> : null}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-[#e8e3de] min-[1600px]:block">
          <table className="w-full min-w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[9%]" /><col className="w-[11%]" /><col className="w-[11%]" /><col className="w-[22%]" />
              <col className="w-[10%]" /><col className="w-[16%]" /><col className="w-[12%]" /><col className="w-[9%]" />
            </colgroup>
            <thead className="bg-[#fafafa] text-xs uppercase text-[#667085]">
              <tr>
                <th className="border-b border-[#eef0f3] px-3 py-3">Ngày</th>
                <th className="border-b border-[#eef0f3] px-3 py-3">Loại</th>
                <th className="border-b border-[#eef0f3] px-3 py-3">Mã phiếu</th>
                <th className="border-b border-[#eef0f3] px-3 py-3">Máy / Model / S/N</th>
                <th className="border-b border-[#eef0f3] px-3 py-3">Địa điểm</th>
                <th className="border-b border-[#eef0f3] px-3 py-3">Khách hàng</th>
                <th className="border-b border-[#eef0f3] px-3 py-3">Kỹ sư</th>
                <th className="border-b border-[#eef0f3] px-3 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm font-semibold text-[#667085]" colSpan={8}>
                    <span className="inline-flex items-center gap-2"><Loader2 className="spin-icon" size={17} />Đang tổng hợp dữ liệu</span>
                  </td>
                </tr>
              ) : null}
              {!loading && pagedRows.map((row) => (
                <tr
                  aria-label={`Mở phiếu ${row.code}, ${workKindLabel(row.kind)}`}
                  className="cursor-pointer outline-none transition hover:bg-[#fff8f7] focus-within:bg-[#fff8f7] focus-visible:bg-[#fff8f7]"
                  key={`${row.kind}-${row.id}`}
                  onClick={() => navigate(technicalWorkHref(row))}
                  role="link"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(technicalWorkHref(row));
                    }
                  }}
                  tabIndex={0}
                  title={`Mở phiếu ${row.code}`}
                >
                  <td className="border-b border-[#f1f2f4] px-4 py-3 text-[#667085]">{formatDate(row.date)}</td>
                  <td className="border-b border-[#f1f2f4] px-4 py-3 font-semibold text-[#202124]">{workKindLabel(row.kind)}</td>
                  <td className="border-b border-[#f1f2f4] px-4 py-3 font-semibold text-[#202124]">{row.code}</td>
                  <td className="border-b border-[#f1f2f4] px-4 py-3">
                    <strong className="block text-[#202124]">{row.machineCode || '-'}</strong>
                    <span className="text-xs font-medium text-[#667085]">{[row.model, row.serialNumber ? `S/N ${row.serialNumber}` : ''].filter(Boolean).join(' - ') || '-'}</span>
                  </td>
                  <td className="border-b border-[#f1f2f4] px-4 py-3 text-[#667085]">{row.province || '-'}</td>
                  <td className="border-b border-[#f1f2f4] px-4 py-3">{row.customer || '-'}</td>
                  <td className="border-b border-[#f1f2f4] px-4 py-3">{row.engineer || '-'}</td>
                  <td className="border-b border-[#f1f2f4] px-4 py-3"><span className="flex items-center justify-between gap-2">{displayLabel(row.status)}<ArrowRight aria-hidden="true" className="shrink-0 text-[#861b27]" size={15} /></span></td>
                </tr>
              ))}
              {!loading && filteredRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm font-semibold text-[#667085]" colSpan={8}>
                    Không có phiếu phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
      </div>
      <RegisterTablePager
        disabled={loading}
        page={currentPage}
        pageSize={pageSize}
        total={filteredRows.length}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </section>
  );
}

function RegisterTablePager({
  disabled,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  description,
}: {
  disabled: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  description?: string;
}) {
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef0f3] bg-[#fafafa] px-4 py-3 text-sm font-medium text-[#667085]">
      <span>{description ?? (total ? `${first}-${last}/${total} phiếu` : '0 phiếu')}</span>
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

function ticketPortalIconClass(_value: TicketScope) {
  return 'bg-[#f7e9e9] text-[#861b27]';
}

function DemoLoansBoard({ onBack, user }: { onBack: () => void; user: ApiUser }) {
  const role = getRoleName(user);
  const canManage = role === 'admin' || role === 'manager';
  const canCreateDemo = canManage || role === 'engineer';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [preparationStatus, setPreparationStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [returnDraft, setReturnDraft] = useState<DemoReturnDraft | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<DemoLoanRow | null>(null);
  const [selectedLoanMachines, setSelectedLoanMachines] = useState<DemoLoanRow[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const listParams = useMemo(() => {
    const params = new URLSearchParams({ limit: String(pageSize), page: String(page) });
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (status) params.set('status', status);
    if (preparationStatus) params.set('preparationStatus', preparationStatus);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    return params.toString();
  }, [dateFrom, dateTo, debouncedSearch, page, preparationStatus, status]);

  const loansQuery = useQuery({
    queryKey: ['demo-loans', user.id, listParams],
    queryFn: () => apiFetch<Paginated<DemoLoanRow>>(`/demo-loans?${listParams}`),
  });

  const loans = loansQuery.data?.data ?? [];
  const loanGroups = useMemo(() => {
    const groups = new Map<string, DemoLoanRow[]>();
    for (const loan of loans) {
      const key = loan.ticketCode || loan.code;
      groups.set(key, [...(groups.get(key) ?? []), loan]);
    }
    return [...groups.entries()].map(([ticketCode, groupLoans]) => ({ ticketCode, loans: groupLoans }));
  }, [loans]);
  const loanMeta = loansQuery.data?.meta;
  const summary = demoLoanSummary(loans);

  const actionMutation = useMutation({
    mutationFn: ({ action, id, ids, entries, payload }: { action: 'handover' | 'return' | 'prepare' | 'cancel'; id?: string; ids?: string[]; entries?: Array<{ id: string; payload?: Record<string, unknown> }>; payload?: Record<string, unknown> }) =>
      Promise.all((entries ?? (ids ?? (id ? [id] : [])).map((loanId) => ({ id: loanId, payload }))).map(({ id: loanId, payload: itemPayload }) => apiFetch<DemoLoanRow>(`/demo-loans/${loanId}/${action}`, {
        method: 'POST',
        body: action === 'cancel' ? undefined : JSON.stringify(itemPayload ?? (action === 'handover' ? { occurredAt: new Date().toISOString() } : {})),
      }))),
    onSuccess: () => {
      setSuccess('Đã cập nhật trạng thái phiếu demo.');
      setReturnDraft(null);
      void queryClient.invalidateQueries({ queryKey: ['demo-loans'] });
      void queryClient.invalidateQueries({ queryKey: ['service-tickets'] });
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : 'Không cập nhật được phiếu demo.'),
  });

  function openReturnDraft(loans: DemoLoanRow[]) {
    setFormError('');
    setSuccess('');
    setReturnDraft({
      items: loans.map((item) => ({
        accessoriesText: (item.handoverAccessories ?? []).join('\n'),
        condition: 'Máy nhận đủ và hoạt động bình thường.',
        loan: item,
        note: '',
        needsRepair: false,
      })),
      occurredAt: toDateInput(new Date()),
    });
  }

  useEffect(() => setPage(1), [debouncedSearch, status, preparationStatus, dateFrom, dateTo]);

  function submitReturnDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!returnDraft) return;
    actionMutation.mutate({
      action: 'return',
      entries: returnDraft.items.map((item) => ({
        id: item.loan.id,
        payload: {
          accessories: item.accessoriesText.split('\n').map((accessory) => accessory.trim()).filter(Boolean),
          condition: item.condition,
          requiresRepair: item.needsRepair,
          note: item.note,
          occurredAt: returnDraft.occurredAt,
        },
      })),
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 min-[980px]:grid-cols-[minmax(0,1fr)_auto] min-[980px]:items-end">
        <div className="grid gap-3">
          <button className="secondary-button mt-5 w-fit justify-self-start" onClick={onBack} type="button">
            <ArrowLeft size={16} />
            Quay lại loại phiếu
          </button>
          <PageTitle
            eyebrow="Máy demo"
            title="Bàn giao và thu hồi máy dùng thử"
          />
        </div>
        <div className="flex flex-wrap gap-2 min-[980px]:justify-end">
          {canCreateDemo ? (
            <Link className="primary-button" to="/demo-loans/create?returnTo=/service-tickets">
              <Plus size={16} />
              Tạo phiếu demo
            </Link>
          ) : null}
          <button className="secondary-button" disabled={loansQuery.isFetching} onClick={() => void loansQuery.refetch()} type="button">
            {loansQuery.isFetching ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
            Làm mới
          </button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        <DemoMetric label="Đang demo" tone="warn" value={summary.active} />
        <DemoMetric label="Quá hạn" tone="danger" value={summary.overdue} />
        <DemoMetric label="Sắp thu hồi" tone="warn" value={summary.dueSoon} />
        <DemoMetric label="Cần xử lý sau thu hồi" tone="warn" value={summary.preparationRequired} />
      </section>

      {formError ? <Notice message={formError} /> : null}
      {success ? <Notice message={success} /> : null}

      <section className="grid gap-3 rounded-[24px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07),0_12px_30px_rgba(24,24,27,0.05)]">
        <div className="grid gap-3 min-[1280px]:grid-cols-[minmax(0,1fr)_150px_190px_150px_150px] min-[1280px]:items-end">
          <label className="operation-filter-field">
            <span>Tra cứu</span>
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Mã phiếu, khách hàng, serial..." value={search} />
          </label>
          <label className="operation-filter-field">
            <span>Trạng thái</span>
            <select onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="">Tất cả</option>
              <option value="PLANNED">Chờ bàn giao</option>
              <option value="HANDED_OVER">Đang demo</option>
              <option value="OVERDUE">Quá hạn</option>
              <option value="RETURNED">Đã thu hồi</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </label>
          <label className="operation-filter-field">
            <span>Sau thu hồi</span>
            <select onChange={(event) => setPreparationStatus(event.target.value)} value={preparationStatus}>
              <option value="">Tất cả</option>
              <option value="REQUIRED">Chờ xử lý</option>
              <option value="COMPLETED">Đã xử lý</option>
              <option value="NOT_REQUIRED">Không cần xử lý</option>
            </select>
          </label>
          <DateInput label="Từ ngày" onChange={setDateFrom} value={dateFrom} />
          <DateInput label="Đến ngày" onChange={setDateTo} value={dateTo} />
        </div>

        {loansQuery.isLoading ? (
          <div className="grid min-h-[160px] place-items-center text-sm font-semibold text-[#667085]">
            <Loader2 className="spin-icon" size={20} />
            Đang tải phiếu demo
          </div>
        ) : null}

        {!loansQuery.isLoading && loans.length === 0 ? (
          <div className="grid min-h-[160px] place-items-center gap-2 text-center text-sm text-[#667085]">
            <Archive size={28} />
            <strong className="text-[#202124]">Chưa có phiếu demo phù hợp</strong>
          </div>
        ) : null}

        {!loansQuery.isLoading ? (
          <div className="grid gap-2">
            {loanGroups.map((group) => {
              const loan = group.loans[0];
              const assignedToCurrentUser = group.loans.some((item) => item.engineer?.id === user.id || item.assignments?.some((assignment) => assignment.engineer.id === user.id));
              return (
              <DemoLoanCard
                actionLoading={actionMutation.isPending}
                canCancel={canManage}
                canUpdate={canManage || assignedToCurrentUser}
                canReturn={canManage || (role === 'engineer' && assignedToCurrentUser)}
                key={group.ticketCode}
                loan={loan}
                machines={group.loans}
                onView={() => { setSelectedLoan(loan); setSelectedLoanMachines(group.loans); }}
                onReturn={() => openReturnDraft(group.loans)}
                onPrepare={() => actionMutation.mutate({ action: 'prepare', id: loan.id })}
                onCancelPlanned={() => actionMutation.mutate({ action: 'cancel', ids: group.loans.map((item) => item.id) })}
              />
            );})}
          </div>
        ) : null}
        {loanMeta ? <RegisterTablePager description={`${loanGroups.length} phiếu · ${loans.length} máy trong trang này`} disabled={loansQuery.isFetching} page={loanMeta.page} pageSize={loanMeta.limit} total={loanMeta.total} totalPages={Math.max(1, loanMeta.totalPages)} onPageChange={setPage} /> : null}
      </section>

      {returnDraft ? (
        <DemoReturnModal
          draft={returnDraft}
          loading={actionMutation.isPending}
          onDateChange={(occurredAt) => setReturnDraft((current) => (current ? { ...current, occurredAt } : current))}
          onMachineChange={(loanId, patch) => setReturnDraft((current) => (current ? { ...current, items: current.items.map((item) => item.loan.id === loanId ? { ...item, ...patch } : item) } : current))}
          onClose={() => setReturnDraft(null)}
          onSubmit={submitReturnDraft}
        />
      ) : null}
      {selectedLoan ? <DemoLoanDetailModal loan={selectedLoan} machines={selectedLoanMachines} onClose={() => { setSelectedLoan(null); setSelectedLoanMachines([]); }} /> : null}
    </div>
  );
}

function DemoMetric({ label, tone, value }: { label: string; tone: 'good' | 'warn' | 'danger'; value: number }) {
  const toneClass = tone === 'good' ? 'text-[#177245]' : tone === 'danger' ? 'text-[#b5121b]' : 'text-[#9b5a17]';
  return (
    <div className="rounded-[20px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07),0_8px_22px_rgba(24,24,27,0.045)]">
      <span className="text-sm font-medium text-[#667085]">{label}</span>
      <strong className={`mt-2 block text-3xl font-semibold ${toneClass}`}>{value}</strong>
    </div>
  );
}

function DemoLoanCard({
  actionLoading,
  canCancel,
  canReturn,
  canUpdate,
  loan,
  machines,
  onCancelPlanned,
  onPrepare,
  onReturn,
  onView,
}: {
  actionLoading: boolean;
  canCancel: boolean;
  canReturn: boolean;
  canUpdate: boolean;
  loan: DemoLoanRow;
  machines: DemoLoanRow[];
  onCancelPlanned: () => void;
  onPrepare: () => void;
  onReturn: () => void;
  onView: () => void;
}) {
  return (
    <article className="grid gap-3 rounded-[20px] bg-[#fafafa] p-4 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.06)] min-[980px]:grid-cols-[minmax(0,1fr)_220px_180px] min-[980px]:items-center">
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(loan.status)}>{demoStatusLabel(loan.status)}</Badge>
          <span className="text-xs font-semibold text-[#667085]">{loan.ticketCode || loan.code}</span>
          {demoIsDueSoon(loan) ? <Badge tone="warn">Sắp đến hạn</Badge> : null}
        </div>
        <div className="grid gap-1">
          {machines.map((item) => (
            <div className="flex min-w-0 flex-wrap items-center gap-2" key={item.id}>
              <h3 className="min-w-0 truncate text-lg font-semibold text-[#202124]">{demoMachineLabel(item.machine)}</h3>
              {item.machine?.demoCategory ? <Badge tone="neutral">{demoMachineCategoryLabel(item.machine.demoCategory)}</Badge> : null}
            </div>
          ))}
          {machines.length > 1 ? <span className="text-xs font-semibold text-[#667085]">{machines.length} thiết bị trong phiếu</span> : null}
        </div>
        {loan.preparationStatus === 'REQUIRED' ? <Badge tone={loan.returnRequiresRepair ? 'danger' : 'warn'}>{loan.returnRequiresRepair ? 'Chờ sửa chữa' : 'Chờ vệ sinh/đóng gói'}</Badge> : null}
        <div className="flex flex-wrap gap-2 text-sm font-medium text-[#667085]">
          <span>{loan.customer ? demoCustomerLabel(loan.customer) : 'Chưa có khách'}</span>
          <span>{loan.handoverAddress || loan.customer?.fullAddress || loan.customer?.address || ''}</span>
        </div>
        {loan.purpose ? <p className="line-clamp-2 text-sm leading-6 text-[#667085]">{loan.purpose}</p> : null}
      </div>
      <div className="grid gap-2 text-sm text-[#667085]">
        <span>Bàn giao: <strong className="text-[#202124]">{formatDate(loan.handedOverAt || loan.plannedHandoverAt)}</strong></span>
        <span>Hạn thu hồi: <strong className="text-[#202124]">{formatDate(loan.expectedReturnAt)}</strong></span>
        <span>Giao cho: <strong className="text-[#202124]">{[...new Map(machines.flatMap((item) => item.assignments ?? []).map((assignment) => [assignment.engineer.id, technicalUserName(assignment.engineer)])).values()].join(', ') || 'Chưa phân'}</strong></span>
        {loan.handedOverBy ? <span>Xác nhận bàn giao: <strong className="text-[#202124]">{technicalUserName(loan.handedOverBy)}</strong></span> : null}
        {loan.returnedBy ? <span>Thu hồi bởi: <strong className="text-[#202124]">{technicalUserName(loan.returnedBy)}</strong></span> : null}
      </div>
      <div className="flex flex-wrap gap-2 min-[980px]:justify-end">
        <button className="secondary-button rounded-2xl" onClick={onView} type="button">Chi tiết</button>
        {canCancel && loan.status === 'PLANNED' ? (
          <button className="secondary-button danger rounded-2xl" disabled={actionLoading} onClick={onCancelPlanned} type="button">
            {actionLoading ? <Loader2 className="spin-icon" size={15} /> : <X size={15} />}
            Hủy lịch
          </button>
        ) : null}
        {canReturn && ['HANDED_OVER', 'OVERDUE'].includes(loan.status) ? (
          <button className="secondary-button rounded-2xl" disabled={actionLoading} onClick={onReturn} type="button">
            {actionLoading ? <Loader2 className="spin-icon" size={15} /> : null}
            Ghi nhận thu hồi
          </button>
        ) : null}
        {canUpdate && loan.status === 'RETURNED' && loan.preparationStatus === 'REQUIRED' ? (
          <button className="primary-button rounded-2xl" disabled={actionLoading} onClick={onPrepare} type="button">
            {actionLoading ? <Loader2 className="spin-icon" size={15} /> : null}
            {loan.returnRequiresRepair ? 'Hoàn tất xử lý' : 'Đã vệ sinh/đóng gói'}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function DemoLoanDetailModal({ loan, machines, onClose }: { loan: DemoLoanRow; machines: DemoLoanRow[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#182033]/45 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <section aria-labelledby="demo-ticket-detail-title" aria-modal="true" className="grid max-h-[90vh] w-full max-w-3xl gap-5 overflow-y-auto rounded-2xl border border-[#e7e2dc] bg-white p-5 shadow-[0_24px_72px_rgba(24,24,27,0.2)] sm:p-6" onClick={(event) => event.stopPropagation()} role="dialog">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eee9e4] pb-4">
          <div>
            <span className="text-sm font-medium text-[#737b80]">Phiếu demo · {demoStatusLabel(loan.status)}</span>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[#252c30]" id="demo-ticket-detail-title">{loan.ticketCode || loan.code}</h2>
          </div>
          <button aria-label="Đóng chi tiết" className="secondary-button compact" onClick={onClose} type="button">Đóng</button>
        </header>
        <div className="grid gap-5 md:grid-cols-2">
          <section className="grid content-start gap-3">
            <h3 className="font-semibold text-[#252c30]">Thiết bị và khách hàng</h3>
            <div className="grid gap-2 rounded-2xl bg-[#f8fafc] p-3">
              <span className="text-sm text-[#737b80]">Thiết bị trong phiếu ({machines.length})</span>
              {machines.map((item) => <strong className="text-sm font-medium text-[#252c30]" key={item.id}>{demoMachineLabel(item.machine)}</strong>)}
            </div>
            <RegisterDetailRow label="Khách hàng" value={loan.customer ? demoCustomerLabel(loan.customer) : 'Chưa có khách hàng'} />
            <RegisterDetailRow label="Địa chỉ bàn giao" value={loan.handoverAddress || loan.customer?.fullAddress || loan.customer?.address} />
            <RegisterDetailRow label="Giao việc cho" value={[...new Map(machines.flatMap((item) => item.assignments ?? []).map((assignment) => [assignment.engineer.id, technicalUserName(assignment.engineer)])).values()].join(', ')} />
            <RegisterDetailRow label="Mục đích" value={loan.purpose} />
          </section>
          <section className="grid content-start gap-3">
            <h3 className="font-semibold text-[#252c30]">Bàn giao và thu hồi</h3>
            <RegisterDetailRow label="Dự kiến bàn giao" value={formatTicketDate(loan.plannedHandoverAt)} />
            <RegisterDetailRow label="Ngày bàn giao" value={formatTicketDate(loan.handedOverAt)} />
            <RegisterDetailRow label="Kỹ sư xác nhận bàn giao" value={loan.handedOverBy ? technicalUserName(loan.handedOverBy) : null} />
            <RegisterDetailRow label="Hạn thu hồi" value={formatTicketDate(loan.expectedReturnAt)} />
            <RegisterDetailRow label="Ngày thu hồi" value={formatTicketDate(loan.returnedAt)} />
            <RegisterDetailRow label="Kỹ sư thu hồi" value={loan.returnedBy ? technicalUserName(loan.returnedBy) : null} />
            <RegisterDetailRow label="Loại máy" value={loan.machine?.demoCategory ? demoMachineCategoryLabel(loan.machine.demoCategory) : demoMachineUseLabel(loan.machineUse)} />
            <RegisterDetailRow label="Sau thu hồi" value={demoPreparationLabel(loan.preparationStatus, loan.returnRequiresRepair)} />
            <RegisterDetailRow label="Sửa chữa" value={loan.returnRequiresRepair ? 'Có' : 'Không'} />
            <RegisterDetailRow label="Người nhận" value={[loan.receiverName, loan.receiverPosition, loan.receiverPhone].filter(Boolean).join(' · ')} />
          </section>
          <section className="grid content-start gap-3 md:col-span-2">
            <h3 className="font-semibold text-[#252c30]">Ghi nhận tình trạng</h3>
            <RegisterDetailRow label="Tình trạng lúc bàn giao" value={loan.handoverCondition} />
            <RegisterDetailRow label="Phụ kiện bàn giao" value={loan.handoverAccessories?.join(', ')} />
            <RegisterDetailRow label="Ghi chú bàn giao" value={loan.handoverNote} />
            <RegisterDetailRow label="Tình trạng khi thu hồi" value={loan.returnCondition} />
            <RegisterDetailRow label="Phụ kiện thu hồi" value={loan.returnAccessories?.join(', ')} />
            <RegisterDetailRow label="Ghi chú thu hồi" value={loan.returnNote} />
          </section>
        </div>
      </section>
    </div>
  );
}

function RegisterDetailRow({ label, value }: { label: string; value?: string | null }) {
  return <div className="grid gap-1 border-b border-[#f0ece8] pb-2 text-sm sm:grid-cols-[150px_minmax(0,1fr)]"><span className="text-[#737b80]">{label}</span><strong className="break-words font-medium text-[#252c30]">{value || '—'}</strong></div>;
}

function formatTicketDate(value?: string | null) {
  return value ? formatDate(value) : '—';
}

function DemoReturnModal({
  draft,
  loading,
  onDateChange,
  onMachineChange,
  onClose,
  onSubmit,
}: {
  draft: DemoReturnDraft;
  loading: boolean;
  onDateChange: (occurredAt: string) => void;
  onMachineChange: (loanId: string, patch: Partial<Omit<DemoReturnMachineDraft, 'loan'>>) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const ticketCode = draft.items[0]?.loan.ticketCode || draft.items[0]?.loan.code || '';
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#182033]/45 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <form
        className="grid max-h-[92vh] w-full max-w-[720px] gap-4 overflow-y-auto rounded-[28px] bg-white p-5 shadow-[0_30px_90px_rgba(24,24,27,0.28)]"
        onClick={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-sm font-semibold text-[#3e8375]">Phiếu nhận thiết bị</span>
            <h2 className="mt-1 text-2xl font-semibold text-[#202124]">Thu hồi phiếu {ticketCode}</h2>
          </div>
          <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e4e7] bg-white text-[#667085] hover:bg-[#f4f4f5]" onClick={onClose} type="button" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <DateInput label="Ngày thu hồi" onChange={onDateChange} required value={draft.occurredAt} />
        <div className="grid gap-3">
          {draft.items.map((item, index) => (
            <section className="grid gap-3 rounded-2xl border border-[#e8e4df] bg-[#faf9f7] p-4" key={item.loan.id}>
              <header>
                <span className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Thiết bị {index + 1}</span>
                <h3 className="mt-1 font-semibold text-[#202124]">{demoMachineLabel(item.loan.machine)}</h3>
              </header>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#334155]">
                Kết quả kiểm tra
                <select className="h-12 rounded-2xl border border-[#cbd5e1] bg-white px-3" onChange={(event) => onMachineChange(item.loan.id, { needsRepair: event.target.value === 'repair' })} value={item.needsRepair ? 'repair' : 'normal'}>
                  <option value="normal">Đạt kiểm tra, không cần sửa chữa</option>
                  <option value="repair">Cần kiểm tra hoặc sửa chữa</option>
                </select>
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#334155]">
                Tình trạng thiết bị khi thu hồi
                <textarea className="min-h-[80px] rounded-2xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm font-medium leading-6 text-[#172033]" onChange={(event) => onMachineChange(item.loan.id, { condition: event.target.value })} required value={item.condition} />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#334155]">
                Phụ kiện thu hồi
                <textarea className="min-h-[64px] rounded-2xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm font-medium leading-6 text-[#172033]" onChange={(event) => onMachineChange(item.loan.id, { accessoriesText: event.target.value })} placeholder="Mỗi phụ kiện một dòng" value={item.accessoriesText} />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#334155]">
                Ghi chú thiết bị
                <textarea className="min-h-[64px] rounded-2xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm font-medium leading-6 text-[#172033]" onChange={(event) => onMachineChange(item.loan.id, { note: event.target.value })} value={item.note} />
              </label>
            </section>
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button className="secondary-button" onClick={onClose} type="button">
            Hủy
          </button>
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? <Loader2 className="spin-icon" size={16} /> : null}
            Lưu thu hồi
          </button>
        </div>
      </form>
    </div>
  );
}

function demoLoanSummary(loans: DemoLoanRow[]) {
  const countTickets = (matching: DemoLoanRow[]) => new Set(matching.map((loan) => loan.ticketCode || loan.code)).size;
  return {
    active: countTickets(loans.filter((loan) => loan.status === 'HANDED_OVER')),
    overdue: countTickets(loans.filter((loan) => loan.status === 'OVERDUE')),
    dueSoon: countTickets(loans.filter(demoIsDueSoon)),
    preparationRequired: countTickets(loans.filter((loan) => loan.preparationStatus === 'REQUIRED')),
  };
}

function demoIsDueSoon(loan: DemoLoanRow) {
  if (loan.status !== 'HANDED_OVER') return false;
  const dueTime = new Date(loan.expectedReturnAt).getTime();
  if (Number.isNaN(dueTime)) return false;
  const daysLeft = Math.ceil((dueTime - Date.now()) / 86_400_000);
  return daysLeft >= 0 && daysLeft <= 3;
}

function demoStatusLabel(status: DemoLoanRow['status']) {
  if (status === 'PLANNED') return 'Chờ bàn giao';
  if (status === 'HANDED_OVER') return 'Đang demo';
  if (status === 'OVERDUE') return 'Quá hạn';
  if (status === 'RETURNED') return 'Đã thu hồi';
  return 'Đã hủy';
}

function demoMachineCategoryLabel(category: NonNullable<MachineSummary['demoCategory']>) {
  if (category === 'DEMO_UNIT') return 'Máy demo';
  if (category === 'DEMO_USED') return 'Đã qua demo';
  return 'Máy mới đang demo';
}

function demoMachineUseLabel(machineUse?: DemoLoanRow['machineUse']) {
  if (machineUse === 'DEMO_UNIT') return 'Máy demo chuyên dụng';
  if (machineUse === 'NEW_STOCK') return 'Máy mới mang đi demo';
  if (machineUse === 'DEMO_USED') return 'Đã qua demo';
  return 'Chưa phân loại';
}

function demoPreparationLabel(status?: DemoLoanRow['preparationStatus'], requiresRepair = false) {
  if (status === 'REQUIRED') return requiresRepair ? 'Chờ sửa chữa' : 'Chờ vệ sinh/đóng gói';
  if (status === 'COMPLETED') return 'Đã vệ sinh/đóng gói';
  if (status === 'NOT_REQUIRED') return 'Không cần xử lý thêm';
  return '—';
}

function demoMachineLabel(machine?: MachineSummary | null) {
  if (!machine) return 'Chưa gắn máy';
  return [machine.machineCode, machine.name || machine.modelName, machine.serialNumber ? `S/N ${machine.serialNumber}` : '', machine.inventoryStatus ? displayLabel(machine.inventoryStatus) : '']
    .filter(Boolean)
    .join(' - ');
}

function demoCustomerLabel(customer: CustomerOption) {
  return [customer.name || customer.hospitalName, customer.province].filter(Boolean).join(' - ');
}

function DeviceServiceBoard({ onBack, user }: { onBack: () => void; user: ApiUser }) {
  const queryClient = useQueryClient();
  const role = getRoleName(user);
  const isAdmin = role === 'admin';
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [returnForm, setReturnForm] = useState<DeviceReturnForm | null>(null);
  const [selectedDeviceTicket, setSelectedDeviceTicket] = useState<DeviceServiceRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeviceServiceRow | null>(null);
  const [receiveForm, setReceiveForm] = useState<DeviceReceiveForm>(() => emptyDeviceReceiveForm(user));

  const ticketsQuery = useQuery({
    queryKey: queryKeys.serviceTickets.board('device-service', `${debouncedSearch}:${status}:${page}`),
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (status) params.set('status', status);
      return apiFetch<Paginated<DeviceServiceRow>>(`/device-service-tickets?${params.toString()}`);
    },
  });

  useEffect(() => setPage(1), [debouncedSearch, status]);

  const optionsQuery = useQuery({
    queryKey: queryKeys.serviceTickets.deviceServiceOptions,
    queryFn: async () => {
      const [customers, machines, engineersResult] = await Promise.all([
        apiFetchAllPages<CustomerOption>('/customers'),
        apiFetchAllPages<MachineSummary>('/machines'),
        apiFetch<Paginated<EngineerOption>>('/users?limit=100&status=ACTIVE'),
      ]);
      return {
        customers,
        machines,
        engineers: engineersResult.data.filter(isTechnicalUser),
      };
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<DeviceServiceRow>('/device-service-tickets', {
        method: 'POST',
        body: JSON.stringify(compactPayload(receiveForm)),
      }),
    onSuccess: async () => {
      setReceiveOpen(false);
      setReceiveForm(emptyDeviceReceiveForm(user));
      await queryClient.invalidateQueries({ queryKey: ['service-tickets'] });
    },
  });

  const returnMutation = useMutation({
    mutationFn: (form: DeviceReturnForm) =>
      apiFetch<DeviceServiceRow>(`/device-service-tickets/${form.ticket.id}/return`, {
        method: form.ticket.status === 'RECEIVED' ? 'POST' : 'PATCH',
        body: JSON.stringify(compactPayload({
          returnedAt: form.returnedAt,
          repairMethod: form.repairMethod,
          repairCostItems: form.repairCostItems,
          resultNote: form.resultNote,
          returnCondition: form.returnCondition,
          totalRepairCost: form.totalRepairCost,
          repairCostInWords: form.repairCostInWords,
          usedParts: normalizeDeviceUsedPartsPayload(form.usedParts),
        })),
      }),
    onSuccess: async () => {
      setReturnForm(null);
      await queryClient.invalidateQueries({ queryKey: ['service-tickets'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ticket: DeviceServiceRow) => apiFetch(`/device-service-tickets/${ticket.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setSelectedDeviceTicket(null);
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['service-tickets'] });
    },
  });

  const tickets = ticketsQuery.data?.data ?? [];
  const ticketMeta = ticketsQuery.data?.meta;
  const activeCount = tickets.filter((ticket) => ticket.status === 'RECEIVED').length;
  const returnedCount = tickets.filter((ticket) => ticket.status === 'RETURNED').length;
  const customers = optionsQuery.data?.customers ?? [];
  const machines = optionsQuery.data?.machines ?? [];
  const engineers = optionsQuery.data?.engineers ?? [];

  function applyCustomer(customerId: string) {
    const customer = customers.find((item) => item.id === customerId);
    setReceiveForm((current) => ({
      ...current,
      customerId,
      usingDepartment: customer?.name || current.usingDepartment,
      representative: customer?.contactPerson || current.representative,
      representativePosition: customer?.contactPosition || current.representativePosition,
      contactPhone: customer?.contactPhone || customer?.phone || current.contactPhone,
      address: customer?.fullAddress || customer?.address || current.address,
    }));
  }

  function applyMachine(machineId: string) {
    const machine = machines.find((item) => item.id === machineId);
    setReceiveForm((current) => ({
      ...current,
      machineId,
      customerId: machine?.customer?.id || current.customerId,
      deviceName: machine?.name || machine?.modelName || current.deviceName,
      modelName: machine?.modelName || current.modelName,
      serialNumber: machine?.serialNumber || current.serialNumber,
    }));
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 min-[980px]:grid-cols-[minmax(0,1fr)_auto] min-[980px]:items-end">
        <div className="grid gap-3">
          <button className="secondary-button mt-5 w-fit" onClick={onBack} type="button">
            <ArrowLeft size={16} />
            Quay lại loại phiếu
          </button>
          <PageTitle eyebrow="Phiếu kỹ thuật" title="Nhận / trả thiết bị" />
        </div>
        <div className="flex flex-wrap gap-2 min-[980px]:justify-end">
          <button className="primary-button" onClick={() => setReceiveOpen((value) => !value)} type="button">
            <Plus size={16} />
            Tạo phiếu nhận
          </button>
          <button className="secondary-button" disabled={ticketsQuery.isFetching} onClick={() => void ticketsQuery.refetch()} type="button">
            {ticketsQuery.isFetching ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
            Làm mới
          </button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <DemoMetric label="Đang ở phòng kỹ thuật" tone="warn" value={activeCount} />
        <DemoMetric label="Đã trả thiết bị" tone="good" value={returnedCount} />
        <DemoMetric label="Tổng phiếu" tone="good" value={ticketMeta?.total ?? 0} />
      </section>

      {createMutation.error instanceof Error ? <Notice message={createMutation.error.message} /> : null}
      {returnMutation.error instanceof Error ? <Notice message={returnMutation.error.message} /> : null}

      {receiveOpen ? (
        <section className="grid gap-4 rounded-[24px] border border-[#dbe6f3] bg-[#fbfdff] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <h2 className="text-xl font-semibold text-[#202124]">Phiếu nhận thiết bị</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <DateInput label="Ngày nhận" onChange={(value) => setReceiveForm((current) => ({ ...current, receivedAt: value }))} value={receiveForm.receivedAt} />
            <label className={deviceLabelClass}>
              Kỹ sư phụ trách
              <select className={deviceFieldClass} disabled={role === 'engineer'} onChange={(event) => setReceiveForm((current) => ({ ...current, engineerId: event.target.value }))} value={receiveForm.engineerId}>
                <option value="">Chưa phân công</option>
                {engineers.map((engineer) => (
                  <option key={engineer.id} value={engineer.id}>{technicalUserName(engineer)}</option>
                ))}
              </select>
            </label>
            <label className={deviceLabelClass}>
              Khách hàng
              <select className={deviceFieldClass} onChange={(event) => applyCustomer(event.target.value)} value={receiveForm.customerId}>
                <option value="">Chọn khách hàng</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{demoCustomerLabel(customer)}</option>
                ))}
              </select>
            </label>
            <label className={deviceLabelClass}>
              Thiết bị có sẵn
              <select className={deviceFieldClass} onChange={(event) => applyMachine(event.target.value)} value={receiveForm.machineId}>
                <option value="">Không chọn, nhập tay</option>
                {machines.filter((machine) => machine.id).map((machine) => (
                  <option key={machine.id || machine.serialNumber || machine.machineCode} value={machine.id || ''}>{demoMachineLabel(machine)}</option>
                ))}
              </select>
            </label>
            <DeviceInput label="Đơn vị sử dụng" onChange={(value) => setReceiveForm((current) => ({ ...current, usingDepartment: value }))} value={receiveForm.usingDepartment} />
            <DeviceInput label="Người đại diện" onChange={(value) => setReceiveForm((current) => ({ ...current, representative: value }))} value={receiveForm.representative} />
            <DeviceInput label="Chức vụ" onChange={(value) => setReceiveForm((current) => ({ ...current, representativePosition: value }))} value={receiveForm.representativePosition} />
            <DeviceInput label="Số điện thoại" onChange={(value) => setReceiveForm((current) => ({ ...current, contactPhone: value }))} value={receiveForm.contactPhone} />
            <DeviceInput label="Địa chỉ" onChange={(value) => setReceiveForm((current) => ({ ...current, address: value }))} value={receiveForm.address} wide />
            <DeviceInput label="Tên thiết bị" onChange={(value) => setReceiveForm((current) => ({ ...current, deviceName: value }))} value={receiveForm.deviceName} />
            <DeviceInput label="Model" onChange={(value) => setReceiveForm((current) => ({ ...current, modelName: value }))} value={receiveForm.modelName} />
            <DeviceInput label="S/N" onChange={(value) => setReceiveForm((current) => ({ ...current, serialNumber: value }))} value={receiveForm.serialNumber} />
            <label className={deviceLabelClass}>
              Tình trạng bảo hành
              <select className={deviceFieldClass} onChange={(event) => setReceiveForm((current) => ({ ...current, warrantyStatus: event.target.value }))} value={receiveForm.warrantyStatus}>
                <option value="IN_WARRANTY">Còn bảo hành</option>
                <option value="OUT_OF_WARRANTY">Hết bảo hành</option>
                <option value="UNKNOWN">Chưa rõ</option>
              </select>
            </label>
            <DeviceInput label="Thời hạn bảo hành" onChange={(value) => setReceiveForm((current) => ({ ...current, warrantyTerm: value }))} value={receiveForm.warrantyTerm} />
            <DeviceTextarea label="Tình trạng thiết bị lúc nhận" onChange={(value) => setReceiveForm((current) => ({ ...current, receivedCondition: value }))} value={receiveForm.receivedCondition} />
            <DeviceTextarea label="Phụ kiện nhận kèm" onChange={(value) => setReceiveForm((current) => ({ ...current, receivedAccessories: value }))} value={receiveForm.receivedAccessories} />
            <DeviceTextarea label="Sơ bộ xác định nguyên nhân" onChange={(value) => setReceiveForm((current) => ({ ...current, preliminaryCause: value }))} value={receiveForm.preliminaryCause} />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button className="secondary-button" onClick={() => setReceiveOpen(false)} type="button">Hủy</button>
            <button className="primary-button" disabled={createMutation.isPending} onClick={() => createMutation.mutate()} type="button">
              {createMutation.isPending ? <Loader2 className="spin-icon" size={16} /> : null}
              Lưu phiếu nhận
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 rounded-[24px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07),0_12px_30px_rgba(24,24,27,0.05)]">
        <div className="grid gap-3 min-[860px]:grid-cols-[minmax(0,1fr)_180px]">
          <label className="operation-filter-field">
            <span>Tra cứu</span>
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Mã phiếu, khách hàng, serial..." value={search} />
          </label>
          <label className="operation-filter-field">
            <span>Trạng thái</span>
            <select onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="">Tất cả</option>
              <option value="RECEIVED">Đang ở kỹ thuật</option>
              <option value="RETURNED">Đã trả</option>
            </select>
          </label>
        </div>
        {ticketsQuery.isLoading ? <div className="py-12 text-center text-sm font-semibold text-[#667085]">Đang tải phiếu</div> : null}
        {!ticketsQuery.isLoading && !tickets.length ? <div className="py-12 text-center text-sm font-semibold text-[#667085]">Chưa có phiếu nhận/trả thiết bị.</div> : null}
        <div className="grid gap-2">
          {tickets.map((ticket) => (
            <DeviceServiceCard
              key={ticket.id}
              isAdmin={isAdmin}
              loading={returnMutation.isPending || deleteMutation.isPending}
              onDelete={() => setDeleteTarget(ticket)}
              onView={() => setSelectedDeviceTicket(ticket)}
              onReturn={() => setReturnForm(emptyDeviceReturnForm(ticket))}
              ticket={ticket}
            />
          ))}
        </div>
        {ticketMeta ? <RegisterTablePager disabled={ticketsQuery.isFetching} page={ticketMeta.page} pageSize={ticketMeta.limit} total={ticketMeta.total} totalPages={Math.max(1, ticketMeta.totalPages)} onPageChange={setPage} /> : null}
      </section>

      {returnForm ? (
        <DeviceReturnModal
          form={returnForm}
          loading={returnMutation.isPending}
          onChange={(patch) => setReturnForm((current) => (current ? { ...current, ...patch } : current))}
          onClose={() => setReturnForm(null)}
          onSubmit={() => returnMutation.mutate(returnForm)}
        />
      ) : null}
      {selectedDeviceTicket ? <DeviceServiceDetailModal onClose={() => setSelectedDeviceTicket(null)} ticket={selectedDeviceTicket} /> : null}
      {deleteTarget ? (
        <DeleteTicketDialog
          details={[
            { label: 'Mã phiếu nhận', value: deleteTarget.receiveCode },
            { label: 'Mã phiếu trả', value: deleteTarget.returnCode },
            { label: 'Khách hàng', value: deleteTarget.customer?.name || deleteTarget.usingDepartment },
            { label: 'Thiết bị', value: deleteTarget.deviceName || deleteTarget.machine?.name || deleteTarget.modelName },
            { label: 'Serial', value: deleteTarget.serialNumber },
            { label: 'Trạng thái', value: deviceStatusLabel(deleteTarget.status) },
          ]}
          loading={deleteMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget)}
          title="Xác nhận xóa phiếu nhận/trả thiết bị"
          warning="Phiếu và lịch sử phụ kiện liên quan sẽ bị xóa. Trạng thái máy sẽ được cập nhật lại."
        />
      ) : null}
    </div>
  );
}

function OperationsBoard({
  kind,
  onBack,
  reportHref,
  title,
  user,
}: {
  kind: BoardKind;
  onBack?: () => void;
  reportHref: string;
  title: string;
  user: ApiUser;
}) {
  const role = getRoleName(user);
  const [productIndustryId, setProductIndustryId] = useState('');
  const [engineerId, setEngineerId] = useState('');
  const [queue, setQueue] = useState<QueueKey>('all');
  const [groupBy, setGroupBy] = useState<GroupByKey>('date');
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BoardItem | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 280);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    setSelectedItem(null);
  }, [kind]);

  useEffect(() => {
    if (!selectedItem) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedItem(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem]);

  const boardParams = useMemo(() => {
    const params = new URLSearchParams({ limit: String(pageSize), page: String(page) });
    if (debouncedQuery) params.set('search', debouncedQuery);
    if (productIndustryId) params.set('productIndustryId', productIndustryId);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return params.toString();
  }, [dateFrom, dateTo, debouncedQuery, page, productIndustryId]);

  const boardQuery = useQuery({
    queryKey: queryKeys.serviceTickets.board(kind, `${boardParams}&engineer=${engineerId}`),
    queryFn: async () => {
      const scopes: BoardKind[] = [kind];
      const responses = await Promise.all(
        scopes.map(async (scope) => {
          const endpoint = scope === 'installations' ? '/installations' : scope === 'maintenance' ? '/maintenance' : '/repairs';
          const result = await apiFetch<Paginated<ServiceRow | InstallationRow>>(
            `${endpoint}?${paramsForScope(boardParams, scope, engineerId)}`,
          );
          return { items: result.data.map((row) => normalizeBoardItem(row, scope)), meta: result.meta };
        }),
      );
      return { items: responses.flatMap((response) => response.items), meta: responses[0]?.meta };
    },
  });

  useEffect(() => setPage(1), [kind, debouncedQuery, productIndustryId, engineerId, dateFrom, dateTo, queue]);

  const engineersQuery = useQuery({
    queryKey: queryKeys.serviceTickets.engineers,
    queryFn: async () => {
      const result = await apiFetch<Paginated<EngineerOption> | EngineerOption[]>('/users?limit=100&status=ACTIVE');
      const users = Array.isArray(result) ? result : result.data ?? [];
      return users.filter(isTechnicalUser);
    },
  });

  const items = useMemo(() => [...(boardQuery.data?.items ?? [])].sort(compareBoardItemsByDateDesc), [boardQuery.data]);
  const dateFilteredItems = useMemo(() => filterByDateRange(items, dateFrom, dateTo), [dateFrom, dateTo, items]);
  const engineers = engineersQuery.data ?? [];
  const loading = boardQuery.isLoading || boardQuery.isFetching;
  const error =
    (boardQuery.error instanceof Error ? boardQuery.error.message : '') ||
    (engineersQuery.error instanceof Error ? engineersQuery.error.message : '');

  const counts = useMemo(() => buildQueueCounts(dateFilteredItems), [dateFilteredItems]);
  const visibleItems = useMemo(() => filterByQueue(dateFilteredItems, queue).sort(compareBoardItemsByDateDesc), [dateFilteredItems, queue]);
  const groupedItems = useMemo(() => groupItems(visibleItems, groupBy), [groupBy, visibleItems]);
  const activeFilterCount = [productIndustryId, engineerId, dateFrom, dateTo, groupBy !== 'date' ? groupBy : ''].filter(Boolean).length;
  const selectedEngineer = engineers.find((engineer) => engineer.id === engineerId);

  return (
    <PageFrame>
      <div className="grid gap-4 min-[900px]:flex min-[900px]:items-start min-[900px]:justify-between">
        <div className="grid gap-3">
          {onBack ? (
            <button className="secondary-button w-fit" onClick={onBack} type="button">
              <ArrowLeft size={16} />
              Chọn loại phiếu
            </button>
          ) : null}
          <PageTitle eyebrow="Hồ sơ phiếu" title={title} />
        </div>
        <div className="operation-board-actions">
          <CreateTicketButton kind={kind} />
          {role !== 'engineer' ? (
            <Link className="secondary-button" to={reportHref}>
              <BarChart3 size={16} />
              Xem báo cáo
            </Link>
          ) : null}
          <button className="secondary-button" disabled={loading} onClick={() => void boardQuery.refetch()} type="button">
            {loading ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
            Làm mới
          </button>
        </div>
      </div>

      <section className="relative overflow-visible rounded-[28px] border border-[#e4e4e7] bg-[#fafafa] p-4 shadow-[0_18px_46px_rgba(24,24,27,0.07)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_6%_0%,rgba(14,165,233,0.07),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.72),rgba(248,250,252,0.86))]" />
        <div className="relative grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              {queues.map((item) => (
                <button className={queueChipClass(queue === item.key)} key={item.key} onClick={() => setQueue(item.key)} type="button">
                  <span>{item.label}</span>
                  <strong>{counts[item.key]}</strong>
                </button>
              ))}
            </div>
            <button className={filterToggleClass(filtersOpen || activeFilterCount > 0)} onClick={() => setFiltersOpen((current) => !current)} type="button">
              <Filter size={16} />
              Bộ lọc
              {activeFilterCount > 0 ? <strong>{activeFilterCount}</strong> : null}
              <ChevronDown className={filtersOpen ? 'rotate-180 transition' : 'transition'} size={16} />
            </button>
          </div>

          <div className="grid gap-3 min-[980px]:grid-cols-[minmax(280px,1fr)_auto] min-[980px]:items-center">
            <label className="grid min-w-0 gap-1.5">
              <span className="text-xs font-bold text-[#7a6367]">Tra cứu</span>
              <div className="flex min-h-12 items-center gap-3 rounded-[20px] border border-[#e4e4e7] bg-white px-4 text-[#667985] shadow-[0_12px_28px_rgba(24,24,27,0.06)] focus-within:border-[#18181b] focus-within:shadow-[0_0_0_4px_rgba(24,24,27,0.12)]">
                <Search size={17} />
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-[#1f1f1f] outline-none placeholder:text-[#9b8a8d]"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Mã phiếu, khách hàng, model, serial..."
                  value={query}
                />
                {query ? (
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#667985] hover:bg-[#f4f4f5] hover:text-[#18181b]" onClick={() => setQuery('')} type="button" aria-label="Xóa tìm kiếm">
                    <X size={15} />
                  </button>
                ) : null}
              </div>
            </label>

            <div className="flex flex-wrap gap-2 text-xs font-bold text-[#667985]">
              <FilterSummary label="Nhóm" value={groupOptions.find((option) => option.value === groupBy)?.label || 'Theo ngày'} />
              {selectedEngineer ? <FilterSummary label="Kỹ sư" value={technicalUserName(selectedEngineer)} /> : null}
              {productIndustryId ? <FilterSummary label="Ngành hàng" value="Đang lọc" /> : null}
              {dateFrom ? <FilterSummary label="Từ ngày" value={formatDate(dateFrom)} /> : null}
              {dateTo ? <FilterSummary label="Đến ngày" value={formatDate(dateTo)} /> : null}
            </div>
          </div>

          {filtersOpen ? (
            <div className="grid gap-3 rounded-[24px] border border-[#e4e4e7] bg-white/86 p-3 shadow-[0_10px_28px_rgba(24,24,27,0.06)] min-[980px]:grid-cols-[minmax(190px,1fr)_minmax(190px,1fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_160px_auto] min-[980px]:items-end">
              <ProductIndustryFilter onChange={setProductIndustryId} value={productIndustryId} />
              <label className="operation-filter-field">
                <span>Kỹ sư</span>
                <select onChange={(event) => setEngineerId(event.target.value)} value={engineerId}>
                  <option value="">Tất cả kỹ sư</option>
                  {engineers.map((engineer) => (
                    <option key={engineer.id} value={engineer.id}>
                      {technicalUserName(engineer)}
                    </option>
                  ))}
                </select>
              </label>
              <DateInput className="operation-filter-field" label="Từ ngày" onChange={setDateFrom} value={dateFrom} />
              <DateInput className="operation-filter-field" label="Đến ngày" onChange={setDateTo} value={dateTo} />
              <label className="operation-filter-field">
                <span>Nhóm theo</span>
                <select onChange={(event) => setGroupBy(event.target.value as GroupByKey)} value={groupBy}>
                  {groupOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary-button min-h-[42px] rounded-2xl"
                disabled={!activeFilterCount && !query}
                onClick={() => {
                  setProductIndustryId('');
                  setEngineerId('');
                  setDateFrom('');
                  setDateTo('');
                  setGroupBy('date');
                  setQuery('');
                }}
                type="button"
              >
                <X size={15} />
                Xóa lọc
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {error ? <Notice message={error} /> : null}

      <section className="overflow-hidden rounded-[28px] border border-[#e4e4e7] bg-white shadow-[0_18px_46px_rgba(24,24,27,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f4e2e4] bg-[#fafafa] px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-[#1f1f1f]">{queues.find((item) => item.key === queue)?.label}</h2>
            <p className="mt-1 text-sm text-[#666666]">{loading ? 'Đang tải' : `${boardQuery.data?.meta?.total ?? visibleItems.length} phiếu · Trang ${boardQuery.data?.meta?.page ?? page}/${Math.max(1, boardQuery.data?.meta?.totalPages ?? 1)}`}</p>
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-[240px] place-items-center gap-2 p-8 text-sm font-semibold text-[#666666]">
            <Loader2 className="spin-icon" size={20} />
            Đang tải danh sách phiếu
          </div>
        ) : null}

        {!loading && visibleItems.length === 0 ? (
          <div className="grid min-h-[260px] place-items-center gap-2 p-8 text-center text-[#666666]">
            <ClipboardCheck size={26} />
            <strong className="text-[#1f1f1f]">Không có phiếu phù hợp</strong>
          </div>
        ) : null}

        {!loading ? (
          <div className="grid">
            {groupedItems.map((group) => (
              <section className="border-b border-[#eeeeee] last:border-b-0" key={group.key}>
                <div className="flex items-center justify-between bg-[#fafafa] px-4 py-2.5">
                  <strong className="text-sm text-[#1f1f1f]">{group.label}</strong>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#667985]">{group.items.length} phiếu</span>
                </div>
                <div className="grid gap-2 bg-[#ffffff] p-2.5">
                  {group.items.map((item) => (
                    <TicketCard item={item} key={`${item.kind}-${item.id}`} onView={setSelectedItem} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </section>

      {boardQuery.data?.meta ? <RegisterTablePager disabled={boardQuery.isFetching} page={boardQuery.data.meta.page} pageSize={boardQuery.data.meta.limit} total={boardQuery.data.meta.total} totalPages={Math.max(1, boardQuery.data.meta.totalPages)} onPageChange={setPage} /> : null}

      {selectedItem ? <TicketPreviewModal item={selectedItem} onClose={() => setSelectedItem(null)} /> : null}
    </PageFrame>
  );
}

function CreateTicketButton({ kind }: { kind: BoardKind }) {
  const ticket = createTicketLink(kind);

  return (
    <Link className="primary-button" to={ticket.to}>
      <Plus size={16} />
      {ticket.label}
    </Link>
  );
}

function FilterSummary({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-[#e4e4e7] bg-white/82 px-3 text-[#667985] shadow-[0_6px_14px_rgba(24,24,27,0.04)]">
      <span className="text-[#9b7479]">{label}</span>
      <strong className="max-w-[220px] truncate text-[#333333]">{value}</strong>
    </span>
  );
}

function TicketCard({ item, onView }: { item: BoardItem; onView: (item: BoardItem) => void }) {
  return (
    <article
      className={`${ticketCardClass(item)} cursor-pointer focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(24,24,27,0.14)]`}
      onClick={() => onView(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onView(item);
        }
      }}
      tabIndex={0}
    >
      <div className={kindIconClass(item.kind)}>{kindIcon(item.kind)}</div>
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#666666]">
          <Badge tone={item.kind === 'installation' ? 'good' : 'neutral'}>{kindLabel(item.kind)}</Badge>
          <span>{item.code}</span>
          {item.date ? <span>{formatDate(item.date)}</span> : null}
          {item.productIndustry ? <span>{item.productIndustry}</span> : null}
        </div>
        <h3 className="text-[16px] font-semibold leading-snug text-[#1f1f1f]">{item.title}</h3>
        <div className="flex flex-wrap gap-1.5">
          {alertBadges(item).map((badge) => (
            <Badge key={badge.label} tone={badge.tone}>{badge.label}</Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-[13px] leading-5 text-[#666666]">
          <span><strong className="text-[#475569]">Khách hàng:</strong> {customerText(item)}</span>
          {item.address ? <span className="basis-full truncate"><strong className="text-[#475569]">Địa chỉ:</strong> {item.address}</span> : null}
          <span>{machineText(item)}</span>
          {item.warrantyEndDate ? <WarrantyBadge value={item.warrantyEndDate} /> : null}
          {item.secondary ? <span>{item.secondary}</span> : null}
        </div>
      </div>
      <div className="grid justify-items-start gap-2">
        <Badge tone={statusTone(item.status)}>{displayLabel(item.status)}</Badge>
        {item.reviewStatus && item.reviewStatus !== 'NOT_REQUIRED' ? <Badge tone={reviewTone(item.reviewStatus)}>{reviewLabel(item.reviewStatus)}</Badge> : null}
        <span className="text-[13px] font-semibold text-[#333333]">{item.engineer ? technicalUserName(item.engineer) : 'Chưa phân kỹ sư'}</span>
      </div>
      <div className="grid gap-2" onClick={(event) => event.stopPropagation()}>
        <Link className="primary-button justify-center rounded-2xl" to={editHref(item)}>
          Cập nhật
        </Link>
      </div>
    </article>
  );
}

function TicketPreviewModal({ item, onClose }: { item: BoardItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#182033]/45 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <section
        aria-modal="true"
        className="grid max-h-[92vh] w-full max-w-[860px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[30px] border border-[#e4e4e7] bg-white shadow-[0_30px_90px_rgba(24,24,27,0.28)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="relative overflow-hidden border-b border-[#f4e2e4] bg-[#f4f4f5] p-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(14,165,233,0.10),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.88),rgba(239,246,255,0.82))]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="grid min-w-0 gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={kindIconClass(item.kind)}>{kindIcon(item.kind)}</span>
                <Badge tone={statusTone(item.status)}>{displayLabel(item.status)}</Badge>
                {item.reviewStatus && item.reviewStatus !== 'NOT_REQUIRED' ? <Badge tone={reviewTone(item.reviewStatus)}>{reviewLabel(item.reviewStatus)}</Badge> : null}
              </div>
              <div>
                <span className="text-sm font-black text-[#18181b]">{kindLabel(item.kind)} · {item.code}</span>
                <h2 className="mt-2 text-[clamp(26px,4vw,42px)] font-black leading-[1.02] tracking-[-0.04em] text-[#1f1f1f]">{item.title}</h2>
              </div>
            </div>
            <button className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e4e4e7] bg-white text-[#667985] shadow-[0_8px_18px_rgba(24,24,27,0.08)] hover:border-[#18181b]/35 hover:text-[#18181b]" onClick={onClose} type="button" aria-label="Đóng xem phiếu">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto p-5">
          <div className="grid gap-4 min-[760px]:grid-cols-[minmax(0,1fr)_280px]">
            <section className="grid gap-3 rounded-[24px] border border-[#e4e4e7] bg-[#ffffff] p-4">
              <h3 className="text-sm font-black text-[#1f1f1f]">Thông tin phiếu</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <PreviewField label="Loại phiếu" value={kindLabel(item.kind)} />
                <PreviewField label="Ngày ghi nhận" value={item.date ? formatDate(item.date) : 'Chưa có ngày'} />
                <PreviewField label="Kỹ sư phụ trách" value={item.engineer ? technicalUserName(item.engineer) : 'Chưa phân kỹ sư'} />
                <PreviewField label="Ngành hàng" value={item.productIndustry || 'Chưa phân ngành'} />
                <PreviewField label="Nội dung phụ" value={item.secondary || 'Chưa có'} />
                <PreviewField label="Bảo hành" value={item.warrantyEndDate ? `Đến ${formatDate(item.warrantyEndDate)}` : 'Chưa có thông tin'} />
              </div>
            </section>

            <aside className="grid content-start gap-3 rounded-[24px] border border-[#e4e4e7] bg-[#fafafa] p-4">
              <h3 className="text-sm font-black text-[#1f1f1f]">Tình trạng cần chú ý</h3>
              <div className="flex flex-wrap gap-2">
                {alertBadges(item).length ? (
                  alertBadges(item).map((badge) => <Badge key={badge.label} tone={badge.tone}>{badge.label}</Badge>)
                ) : (
                  <Badge tone="good">Không có cảnh báo</Badge>
                )}
              </div>
              <div className="h-px bg-[#f4e2e4]" />
              <PreviewField label="Trạng thái" value={displayLabel(item.status)} />
              <PreviewField label="Phê duyệt hồ sơ" value={item.reviewStatus && item.reviewStatus !== 'NOT_REQUIRED' ? reviewLabel(item.reviewStatus) : 'Không yêu cầu'} />
            </aside>

            <section className="grid gap-3 rounded-[24px] border border-[#e4e4e7] bg-white p-4 min-[760px]:col-span-2">
              <h3 className="text-sm font-black text-[#1f1f1f]">Khách hàng và thiết bị</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <PreviewField label="Khách hàng" value={customerText(item)} />
                <PreviewField label="Thiết bị" value={machineText(item)} />
                <PreviewField label="Mã máy" value={item.machine?.machineCode || 'Chưa có'} />
                <PreviewField label="Model" value={item.machine?.modelName || 'Chưa có'} />
                <PreviewField label="Serial" value={item.machine?.serialNumber || 'Chưa có'} />
                <PreviewField label="Tỉnh" value={item.customer?.province || item.machine?.customer?.province || 'Chưa có'} />
              </div>
            </section>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#f4e2e4] bg-[#fafafa] p-4">
          <button className="secondary-button" onClick={onClose} type="button">
            Đóng
          </button>
          <Link className="primary-button" to={editHref(item)}>
            Cập nhật phiếu
          </Link>
        </div>
      </section>
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-2xl bg-[#fafafa] px-3 py-2.5">
      <span className="text-[11px] font-black uppercase tracking-[0.08em] text-[#9b7479]">{label}</span>
      <strong className="min-w-0 break-words text-sm font-bold leading-5 text-[#2b2526]">{value || '-'}</strong>
    </div>
  );
}

function ticketCardClass(item: BoardItem) {
  const base = 'grid gap-3 rounded-[22px] border px-4 py-4 shadow-[0_8px_24px_rgba(24,24,27,0.045)] transition hover:-translate-y-px hover:shadow-[0_16px_34px_rgba(24,24,27,0.08)] min-[960px]:grid-cols-[42px_minmax(0,1fr)_220px_118px] min-[960px]:items-center';
  if (urgencyRank(item) >= 70) return `${base} border-[#e4e4e7] bg-[#fafafa]`;
  if (urgencyRank(item) >= 30) return `${base} border-[#efd8a8] bg-[#fffdf8]`;
  return `${base} border-[#e4e4e7] bg-white`;
}

function ProductIndustryFilter({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const industriesQuery = useQuery({
    queryKey: queryKeys.serviceTickets.industries,
    queryFn: async () => {
      const result = await apiFetch<Paginated<ProductIndustry> | ProductIndustry[]>('/product-industries?limit=100');
      return Array.isArray(result) ? result : result.data ?? [];
    },
  });
  const industries = industriesQuery.data ?? [];

  return (
    <label className="operation-filter-field">
      <span>Ngành hàng</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">Tất cả ngành hàng</option>
        {industries.map((industry) => (
          <option key={industry.id} value={industry.id}>
            {industry.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function normalizeBoardItem(row: ServiceRow | InstallationRow, boardKind: BoardKind): BoardItem {
  if (boardKind === 'installations') {
    const item = row as InstallationRow;
    const machine = item.machine;
    const customer = item.customer ?? machine?.customer;
    return {
      id: item.id,
      code: item.code || item.id,
      title: installationTitle(item),
      kind: 'installation',
      status: item.status || 'PENDING',
      reviewStatus: item.reviewStatus,
      reviewNote: item.reviewNote,
      date: item.installedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      engineer: item.installedBy,
      machine,
      customer,
      address: customer?.fullAddress || customer?.address || null,
      productIndustry: item.businessLine?.productIndustry?.name || machine?.businessLine?.productIndustry?.name || item.plannedMachineModel?.businessLine?.productIndustry?.name,
      warrantyEndDate: item.warrantyEndDate || item.warrantyCard?.endDate || machine?.warrantyEndDate,
      secondary: [item.businessLine?.name || item.plannedMachineModel?.businessLine?.name || machine?.businessLine?.name, item.plannedMachineModel?.displayName || item.plannedMachineModel?.name || item.plannedModelName].filter(Boolean).join(' - '),
      urgency: null,
    };
  }

  const item = row as ServiceRow;
  const isMaintenance = boardKind === 'maintenance';
  return {
    id: item.id,
    code: item.code || item.id,
    title: item.title || item.code || (isMaintenance ? 'Bảo trì' : 'Sửa chữa'),
    kind: isMaintenance ? 'maintenance' : 'repair',
    status: item.status || 'PENDING',
    reviewStatus: item.reviewStatus,
    reviewNote: item.reviewNote,
    date: isMaintenance ? item.scheduledDate : item.reportedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    engineer: item.engineer,
    machine: item.machine,
    customer: item.customer || item.machine?.customer || (item.usingDepartment ? { name: item.usingDepartment } : null),
    address: item.address || item.customer?.fullAddress || item.customer?.address || null,
    productIndustry: item.machine?.businessLine?.productIndustry?.name,
    warrantyEndDate: item.machine?.warrantyEndDate,
    secondary: isMaintenance ? displayLabel(item.type || '') : displayLabel(item.priority || ''),
    urgency: isMaintenance ? item.type : item.priority,
  };
}

function buildQueueCounts(items: BoardItem[]) {
  return {
    action: items.filter((item) => isAction(item)).length,
    active: items.filter((item) => !isClosed(item.status) && !isAction(item)).length,
    review: items.filter((item) => item.reviewStatus === 'PENDING').length,
    closed: items.filter((item) => isClosed(item.status)).length,
    all: items.length,
  };
}

function filterByQueue(items: BoardItem[], queue: QueueKey) {
  if (queue === 'action') return items.filter(isAction);
  if (queue === 'active') return items.filter((item) => !isClosed(item.status) && !isAction(item));
  if (queue === 'review') return items.filter((item) => item.reviewStatus === 'PENDING');
  if (queue === 'closed') return items.filter((item) => isClosed(item.status));
  return items;
}

function filterByDateRange(items: BoardItem[], dateFrom: string, dateTo: string) {
  if (!dateFrom && !dateTo) return items;

  const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;

  return items.filter((item) => {
    if (!item.date) return false;
    const itemTime = new Date(item.date).getTime();
    if (Number.isNaN(itemTime)) return false;
    return itemTime >= fromTime && itemTime <= toTime;
  });
}

function groupItems(items: BoardItem[], groupBy: GroupByKey) {
  const groups = new Map<string, BoardItem[]>();
  items.forEach((item) => {
    const key = groupKey(item, groupBy);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  return Array.from(groups.entries())
    .sort(([left], [right]) => compareGroupKeys(left, right, groupBy))
    .map(([key, groupItems]) => ({
      key,
      label: groupLabel(key, groupBy),
      items: groupItems.sort(compareBoardItemsByDateDesc),
    }));
}

function groupKey(item: BoardItem, groupBy: GroupByKey) {
  if (groupBy === 'date') return item.date ? safeDateKey(item.date) : '__missing__';
  if (groupBy === 'engineer') return item.engineer ? technicalUserName(item.engineer) : '__missing__';
  if (groupBy === 'industry') return item.productIndustry || '__missing__';
  return customerText(item) === 'Chưa có khách hàng' ? '__missing__' : customerText(item);
}

function groupLabel(key: string, groupBy: GroupByKey) {
  if (key !== '__missing__') return groupBy === 'date' ? formatDate(key) : key;
  if (groupBy === 'date') return 'Chưa có ngày hẹn';
  if (groupBy === 'engineer') return 'Chưa phân kỹ sư';
  if (groupBy === 'industry') return 'Chưa phân ngành hàng';
  return 'Chưa có khách hàng';
}

function compareGroupKeys(left: string, right: string, groupBy: GroupByKey) {
  if (left === '__missing__') return 1;
  if (right === '__missing__') return -1;
  return groupBy === 'date' ? right.localeCompare(left) : left.localeCompare(right, 'vi');
}

function safeDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '__missing__';
  return date.toISOString().slice(0, 10);
}

function compareItemDateDesc(left: BoardItem, right: BoardItem) {
  const leftTime = left.date ? new Date(left.date).getTime() : 0;
  const rightTime = right.date ? new Date(right.date).getTime() : 0;
  return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
}

function compareBoardItemsByDateDesc(left: BoardItem, right: BoardItem) {
  return compareItemFreshnessDesc(left, right) || compareItemDateDesc(left, right) || urgencyRank(right) - urgencyRank(left) || right.code.localeCompare(left.code);
}

function compareItemFreshnessDesc(left: BoardItem, right: BoardItem) {
  const leftTime = latestTimestamp(left.updatedAt, left.createdAt);
  const rightTime = latestTimestamp(right.updatedAt, right.createdAt);
  return rightTime - leftTime;
}

function latestTimestamp(...values: Array<string | null | undefined>) {
  return values.reduce((latest, value) => {
    if (!value) return latest;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? latest : Math.max(latest, time);
  }, 0);
}

function installationTitle(item: InstallationRow) {
  const deviceItems = item.installedDeviceItems?.filter((device) => device.itemName || device.model || device.serialNumber) ?? [];
  const firstDevice = deviceItems[0];
  const primaryName =
    firstDevice?.itemName ||
    item.machine?.modelName ||
    item.plannedMachineModel?.displayName ||
    item.plannedMachineModel?.name ||
    item.plannedModelName ||
    item.machine?.machineCode ||
    item.machine?.serialNumber ||
    item.code ||
    '';
  const extraCount = Math.max(0, deviceItems.length - 1);
  return `Lắp đặt ${primaryName}${extraCount ? ` + ${extraCount} thiết bị` : ''}`.trim();
}

function isAction(item: BoardItem) {
  return !item.engineer?.id || item.reviewStatus === 'PENDING' || ['PENDING', 'WAITING_PARTS', 'OVERDUE'].includes(item.status);
}

function alertBadges(item: BoardItem): Array<{ label: string; tone: 'good' | 'warn' | 'danger' | 'neutral' }> {
  const badges: Array<{ label: string; tone: 'good' | 'warn' | 'danger' | 'neutral' }> = [];

  if (!item.engineer?.id) badges.push({ label: 'Chưa phân kỹ sư', tone: 'danger' });
  if (item.reviewStatus === 'PENDING') badges.push({ label: hasDeleteRequestNote(item) ? 'Chờ phê duyệt yêu cầu xóa' : 'Chờ phê duyệt', tone: hasDeleteRequestNote(item) ? 'danger' : 'warn' });
  if (item.reviewStatus === 'NEEDS_REVISION') badges.push({ label: 'Cần bổ sung', tone: 'danger' });
  if (item.status === 'WAITING_PARTS') badges.push({ label: 'Chờ linh kiện', tone: 'danger' });
  if (item.status === 'OVERDUE') badges.push({ label: 'Quá hạn', tone: 'danger' });
  if (item.urgency === 'URGENT') badges.push({ label: 'Khẩn cấp', tone: 'danger' });
  if (item.urgency === 'HIGH') badges.push({ label: 'Ưu tiên cao', tone: 'warn' });
  if (item.kind === 'installation' && item.reviewStatus === 'APPROVED') badges.push({ label: 'Đã nghiệm thu', tone: 'good' });

  return badges.slice(0, 3);
}

function urgencyRank(item: BoardItem) {
  let score = 0;
  if (!item.engineer?.id) score += 80;
  if (item.reviewStatus === 'PENDING') score += 70;
  if (item.reviewStatus === 'NEEDS_REVISION') score += 65;
  if (item.status === 'WAITING_PARTS' || item.status === 'OVERDUE') score += 60;
  if (item.urgency === 'URGENT') score += 50;
  if (item.urgency === 'HIGH') score += 30;
  if (item.status === 'PENDING') score += 20;
  return score;
}

function isClosed(status: string) {
  return ['COMPLETED', 'CANCELLED', 'INSTALLED'].includes(status);
}

function editHref(item: BoardItem) {
  if (item.kind === 'installation') return `/installations/${item.id}/update?returnTo=/service-tickets`;
  if (item.kind === 'maintenance') return `/maintenance/${item.id}/update?returnTo=/service-tickets`;
  return `/repairs/${item.id}/update?returnTo=/service-tickets`;
}

function technicalWorkHref(row: TechnicalReportRow) {
  const returnTo = encodeURIComponent('/service-tickets');
  if (row.kind === 'installation') return `/installations/${row.id}/update?returnTo=${returnTo}`;
  if (row.kind === 'maintenance') return `/maintenance/${row.id}/update?returnTo=${returnTo}`;
  if (row.kind === 'repair') return `/repairs/${row.id}/update?returnTo=${returnTo}`;
  if (row.kind === 'demo') {
    return '/service-tickets?type=demo';
  }
  const supportParams = new URLSearchParams({ search: row.title || row.code, case: row.id });
  return `/application-support?${supportParams.toString()}`;
}

function createTicketLink(kind: BoardKind) {
  if (kind === 'installations') return { label: 'Tạo phiếu lắp đặt', to: '/installations/create?returnTo=/service-tickets' };
  if (kind === 'maintenance') return { label: 'Tạo phiếu bảo trì', to: '/service-tickets/create?kind=maintenance&returnTo=/service-tickets' };
  return { label: 'Tạo phiếu sửa chữa', to: '/service-tickets/create?kind=repair&returnTo=/service-tickets' };
}

function queueChipClass(active: boolean) {
  return [
    'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-bold transition hover:-translate-y-px hover:border-[#18181b]/35 hover:bg-white',
    active
      ? 'border-[#18181b] bg-white text-[#18181b] shadow-[0_10px_24px_rgba(24,24,27,0.10)]'
      : 'border-[#e4e4e7] bg-white/64 text-[#667985]',
  ].join(' ');
}

function filterToggleClass(active: boolean) {
  return [
    'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-bold transition hover:-translate-y-px',
    active
      ? 'border-[#18181b] bg-white text-[#18181b] shadow-[0_10px_24px_rgba(24,24,27,0.10)]'
      : 'border-[#e4e4e7] bg-white/70 text-[#667985] hover:border-[#18181b]/35 hover:bg-white',
  ].join(' ');
}

function kindIconClass(kind: BoardItem['kind']) {
  const base = 'flex h-[42px] w-[42px] items-center justify-center rounded-lg border';
  if (kind === 'maintenance') return `${base} border-[#b9e8ca] bg-[#eefaf3] text-[#177245]`;
  if (kind === 'installation') return `${base} border-[#e4e4e7] bg-[#f4f4f5] text-[#18181b]`;
  return `${base} border-[#e4e4e7] bg-[#f4f4f5] text-[#18181b]`;
}

function kindIcon(kind: BoardItem['kind']) {
  if (kind === 'maintenance') return <ClipboardCheck size={19} />;
  if (kind === 'installation') return <Stethoscope size={19} />;
  return <Wrench size={19} />;
}

function kindLabel(kind: BoardItem['kind']) {
  if (kind === 'maintenance') return 'Bảo trì';
  if (kind === 'installation') return 'Lắp đặt';
  return 'Sửa chữa';
}

function Badge({ children, tone }: { children: ReactNode; tone: 'good' | 'warn' | 'danger' | 'neutral' }) {
  const classes = {
    good: 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]',
    warn: 'border-[#efd8a8] bg-[#fff8ed] text-[#9b5a17]',
    danger: 'border-[#fecdd3] bg-[#fff1f3] text-[#b5121b]',
    neutral: 'border-[#e5e5e5] bg-[#f4f7fb] text-[#333333]',
  };
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>{children}</span>;
}

function statusTone(status: string): 'good' | 'warn' | 'danger' | 'neutral' {
  if (['COMPLETED', 'INSTALLED'].includes(status)) return 'good';
  if (['CANCELLED', 'WAITING_PARTS', 'OVERDUE'].includes(status)) return 'danger';
  if (['PENDING', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS'].includes(status)) return 'warn';
  return 'neutral';
}

function reviewTone(status: string): 'good' | 'warn' | 'danger' | 'neutral' {
  if (status === 'APPROVED') return 'good';
  if (status === 'NEEDS_REVISION') return 'danger';
  if (status === 'PENDING') return 'warn';
  return 'neutral';
}

function reviewLabel(status: string) {
  if (status === 'PENDING') return 'Chờ phê duyệt';
  if (status === 'APPROVED') return 'Đã phê duyệt';
  if (status === 'NEEDS_REVISION') return 'Cần bổ sung';
  return displayLabel(status);
}

function customerText(item: BoardItem) {
  return [item.customer?.name || item.customer?.hospitalName, item.customer?.province].filter(Boolean).join(' - ') || 'Chưa có khách hàng';
}

function machineText(item: BoardItem) {
  return [item.machine?.machineCode, item.machine?.modelName, item.machine?.serialNumber ? `S/N ${item.machine.serialNumber}` : ''].filter(Boolean).join(' - ') || 'Chưa gắn máy';
}

function WarrantyBadge({ value }: { value: string }) {
  const status = warrantyStatus(value);
  const classes = {
    active: 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]',
    expiring: 'border-[#efd8a8] bg-[#fff8ed] text-[#9b5a17]',
    expired: 'border-[#fecdd3] bg-[#fff1f3] text-[#b5121b]',
  };

  return <span className={`rounded-full border px-2 py-0.5 text-[12px] font-semibold ${classes[status]}`}>BH đến {formatDate(value)}</span>;
}

function warrantyStatus(value: string): 'active' | 'expiring' | 'expired' {
  const endDate = new Date(value);
  if (Number.isNaN(endDate.getTime())) return 'active';

  const today = new Date();
  const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / 86_400_000);
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 45) return 'expiring';
  return 'active';
}

function paramsForScope(baseParams: string, scope: BoardKind, engineerId: string) {
  const params = new URLSearchParams(baseParams);
  const dateFrom = params.get('dateFrom');
  const dateTo = params.get('dateTo');
  params.delete('dateFrom');
  params.delete('dateTo');
  if (scope === 'installations') {
    if (dateFrom) params.set('installedFrom', dateFrom);
    if (dateTo) params.set('installedTo', dateTo);
  } else if (scope === 'maintenance') {
    if (dateFrom) params.set('scheduledFrom', dateFrom);
    if (dateTo) params.set('scheduledTo', dateTo);
  } else {
    if (dateFrom) params.set('reportedFrom', dateFrom);
    if (dateTo) params.set('reportedTo', dateTo);
  }
  if (engineerId) params.set(scope === 'installations' ? 'installedById' : 'engineerId', engineerId);
  return params.toString();
}

const deviceLabelClass = 'grid min-w-0 gap-2 text-sm font-semibold text-[#334155]';
const deviceFieldClass = 'min-h-12 rounded-2xl border border-[#cbd5e1] bg-white px-3 text-sm font-semibold text-[#172033] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_4px_rgba(24,24,27,0.10)]';
const deviceTextareaClass = 'min-h-[112px] rounded-2xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm font-semibold leading-6 text-[#172033] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_4px_rgba(24,24,27,0.10)]';

function DeviceInput({ label, onChange, value, wide }: { label: string; onChange: (value: string) => void; value: string; wide?: boolean }) {
  return (
    <label className={`${deviceLabelClass} ${wide ? 'md:col-span-2' : ''}`}>
      {label}
      <input className={deviceFieldClass} onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

function DeviceTextarea({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className={`${deviceLabelClass} md:col-span-2`}>
      {label}
      <textarea className={deviceTextareaClass} onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

function DeviceServiceCard({ isAdmin, loading, onDelete, onReturn, onView, ticket }: { isAdmin: boolean; loading: boolean; onDelete: () => void; onReturn: () => void; onView: () => void; ticket: DeviceServiceRow }) {
  const usedParts = ticket.usedParts ?? [];
  const partsTotal = usedParts.reduce((sum, part) => sum + Number(part.totalPrice ?? Number(part.quantity || 0) * Number(part.unitPrice || 0)), 0);
  return (
    <article className="grid gap-3 rounded-[20px] bg-[#fafafa] p-4 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.06)] min-[980px]:grid-cols-[minmax(0,1fr)_220px_180px] min-[980px]:items-center">
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={ticket.status === 'RETURNED' ? 'good' : 'warn'}>{deviceStatusLabel(ticket.status)}</Badge>
          <span className="text-xs font-semibold text-[#667085]">{ticket.receiveCode}</span>
          {ticket.returnCode ? <span className="text-xs font-semibold text-[#667085]">{ticket.returnCode}</span> : null}
        </div>
        <h3 className="truncate text-lg font-semibold text-[#202124]">{[ticket.deviceName || ticket.machine?.name || ticket.machine?.modelName, ticket.modelName, ticket.serialNumber ? `S/N ${ticket.serialNumber}` : ''].filter(Boolean).join(' - ') || 'Thiết bị sửa chữa'}</h3>
        <div className="flex flex-wrap gap-2 text-sm font-medium text-[#667085]">
          <span>{ticket.customer ? demoCustomerLabel(ticket.customer) : ticket.usingDepartment || 'Chưa có khách hàng'}</span>
          <span>{ticket.address || ''}</span>
        </div>
        {ticket.preliminaryCause ? <p className="line-clamp-2 text-sm leading-6 text-[#667085]">{ticket.preliminaryCause}</p> : null}
        {usedParts.length ? (
          <div className="flex flex-wrap gap-2">
            {usedParts.slice(0, 3).map((part, index) => (
              <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#3e8375] shadow-[inset_0_0_0_1px_rgba(62,131,117,0.18)]" key={part.id || `${part.name}-${index}`}>
                {part.name} x {Number(part.quantity || 0)}
              </span>
            ))}
            {usedParts.length > 3 ? <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#667085]">+{usedParts.length - 3}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="grid gap-2 text-sm text-[#667085]">
        <span>Ngày nhận: <strong className="text-[#202124]">{formatDate(ticket.receivedAt)}</strong></span>
        <span>Ngày trả: <strong className="text-[#202124]">{ticket.returnedAt ? formatDate(ticket.returnedAt) : 'Chưa trả'}</strong></span>
        <span>Kỹ sư: <strong className="text-[#202124]">{ticket.engineer ? technicalUserName(ticket.engineer) : 'Chưa phân'}</strong></span>
        <span>Phụ kiện: <strong className="text-[#202124]">{usedParts.length ? `${usedParts.length} dòng - ${formatMoney(partsTotal)}` : 'Chưa có'}</strong></span>
      </div>
      <div className="flex flex-wrap gap-2 min-[980px]:justify-end">
        <button className="secondary-button rounded-2xl" onClick={onView} type="button">Chi tiết</button>
        {isAdmin && ticket.status === 'RECEIVED' ? <button className="secondary-button danger rounded-2xl" disabled={loading} onClick={onDelete} type="button"><Trash2 size={15} /> Xóa</button> : null}
        {ticket.status === 'RECEIVED' ? (
          <button className="primary-button rounded-2xl" disabled={loading} onClick={onReturn} type="button">
            {loading ? <Loader2 className="spin-icon" size={15} /> : null}
            Trả thiết bị
          </button>
        ) : (
          <button className="secondary-button rounded-2xl" disabled={loading} onClick={onReturn} type="button">
            {loading ? <Loader2 className="spin-icon" size={15} /> : null}
            Sửa chi tiết
          </button>
        )}
      </div>
    </article>
  );
}

function DeviceServiceDetailModal({ onClose, ticket }: { onClose: () => void; ticket: DeviceServiceRow }) {
  const usedParts = ticket.usedParts ?? [];
  const partsTotal = usedParts.reduce((sum, part) => sum + Number(part.totalPrice ?? Number(part.quantity || 0) * Number(part.unitPrice || 0)), 0);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#182033]/45 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <section aria-labelledby="device-ticket-detail-title" aria-modal="true" className="grid max-h-[90vh] w-full max-w-4xl gap-5 overflow-y-auto rounded-2xl border border-[#e7e2dc] bg-white p-5 shadow-[0_24px_72px_rgba(24,24,27,0.2)] sm:p-6" onClick={(event) => event.stopPropagation()} role="dialog">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eee9e4] pb-4">
          <div>
            <span className="text-sm font-medium text-[#737b80]">Nhận / trả thiết bị · {deviceStatusLabel(ticket.status)}</span>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[#252c30]" id="device-ticket-detail-title">{ticket.receiveCode}{ticket.returnCode ? ` · ${ticket.returnCode}` : ''}</h2>
          </div>
          <button aria-label="Đóng chi tiết" className="secondary-button compact" onClick={onClose} type="button">Đóng</button>
        </header>
        <div className="grid gap-5 md:grid-cols-2">
          <section className="grid content-start gap-3">
            <h3 className="font-semibold text-[#252c30]">Thiết bị và nơi tiếp nhận</h3>
            <RegisterDetailRow label="Thiết bị" value={[ticket.deviceName || ticket.machine?.name || ticket.machine?.modelName, ticket.modelName].filter(Boolean).join(' · ')} />
            <RegisterDetailRow label="Mã máy / S/N" value={[ticket.machine?.machineCode, ticket.serialNumber || ticket.machine?.serialNumber].filter(Boolean).join(' · ')} />
            <RegisterDetailRow label="Khách hàng" value={ticket.customer ? demoCustomerLabel(ticket.customer) : ticket.usingDepartment} />
            <RegisterDetailRow label="Đơn vị sử dụng" value={ticket.usingDepartment} />
            <RegisterDetailRow label="Người liên hệ" value={[ticket.representative, ticket.representativePosition, ticket.contactPhone].filter(Boolean).join(' · ')} />
            <RegisterDetailRow label="Địa chỉ" value={ticket.address} />
            <RegisterDetailRow label="Kỹ sư" value={ticket.engineer ? technicalUserName(ticket.engineer) : 'Chưa phân công'} />
          </section>
          <section className="grid content-start gap-3">
            <h3 className="font-semibold text-[#252c30]">Tiếp nhận và xử lý</h3>
            <RegisterDetailRow label="Ngày nhận" value={formatTicketDate(ticket.receivedAt)} />
            <RegisterDetailRow label="Ngày trả" value={formatTicketDate(ticket.returnedAt)} />
            <RegisterDetailRow label="Bảo hành" value={[ticket.warrantyStatus, ticket.warrantyTerm].filter(Boolean).join(' · ')} />
            <RegisterDetailRow label="Tình trạng khi nhận" value={ticket.receivedCondition} />
            <RegisterDetailRow label="Phụ kiện nhận kèm" value={ticket.receivedAccessories} />
            <RegisterDetailRow label="Nguyên nhân ban đầu" value={ticket.preliminaryCause} />
            <RegisterDetailRow label="Cách xử lý" value={ticket.repairMethod} />
          </section>
          <section className="grid content-start gap-3 md:col-span-2">
            <h3 className="font-semibold text-[#252c30]">Kết quả và chi phí</h3>
            <RegisterDetailRow label="Kết quả xử lý" value={ticket.resultNote} />
            <RegisterDetailRow label="Tình trạng khi trả" value={ticket.returnCondition} />
            <RegisterDetailRow label="Hư hỏng / chi phí" value={ticket.repairCostItems} />
            <RegisterDetailRow label="Tổng chi phí" value={ticket.totalRepairCost ? `${formatMoney(Number(ticket.totalRepairCost))}${ticket.repairCostInWords ? ` · ${ticket.repairCostInWords}` : ''}` : ticket.repairCostInWords} />
            <RegisterDetailRow label="Ghi chú" value={ticket.note} />
            {usedParts.length ? <div className="overflow-x-auto rounded-xl border border-[#eee9e4]"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-[#faf9f7] text-xs text-[#737b80]"><tr><th className="p-3">Phụ tùng</th><th className="p-3">Số lượng</th><th className="p-3">Đơn giá</th><th className="p-3">Thành tiền</th></tr></thead><tbody>{usedParts.map((part, index) => <tr className="border-t border-[#eee9e4]" key={part.id || `${part.name}-${index}`}><td className="p-3">{part.name || '—'}{part.serialNumber ? ` · S/N ${part.serialNumber}` : ''}</td><td className="p-3">{part.quantity ?? 0} {part.unit || ''}</td><td className="p-3">{formatMoney(Number(part.unitPrice || 0))}</td><td className="p-3">{formatMoney(Number(part.totalPrice ?? Number(part.quantity || 0) * Number(part.unitPrice || 0)))}</td></tr>)}</tbody><tfoot><tr className="border-t border-[#eee9e4] font-semibold"><td className="p-3" colSpan={3}>Tổng phụ tùng</td><td className="p-3">{formatMoney(partsTotal)}</td></tr></tfoot></table></div> : <p className="text-sm text-[#737b80]">Phiếu chưa ghi nhận phụ tùng đã sử dụng.</p>}
          </section>
        </div>
      </section>
    </div>
  );
}

function DeviceReturnModal({
  form,
  loading,
  onChange,
  onClose,
  onSubmit,
}: {
  form: DeviceReturnForm;
  loading: boolean;
  onChange: (patch: Partial<DeviceReturnForm>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  function updatePart(index: number, patch: Partial<DeviceUsedPartDraft>) {
    onChange({
      usedParts: form.usedParts.map((part, partIndex) => (partIndex === index ? { ...part, ...patch } : part)),
    });
  }

  function addPart() {
    onChange({
      usedParts: [
        ...form.usedParts,
        {
          name: '',
          note: '',
          quantity: 1,
          serialNumber: '',
          unit: 'cái',
          unitCost: 0,
          unitPrice: 0,
        },
      ],
    });
  }

  function removePart(index: number) {
    onChange({ usedParts: form.usedParts.filter((_, partIndex) => partIndex !== index) });
  }

  const usedPartsTotal = form.usedParts.reduce((sum, part) => sum + Number(part.quantity || 0) * Number(part.unitPrice || 0), 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#182033]/45 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <form
        className="grid max-h-[92vh] w-full max-w-[760px] gap-4 overflow-y-auto rounded-[28px] bg-white p-5 shadow-[0_30px_90px_rgba(24,24,27,0.28)]"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-sm font-semibold text-[#3e8375]">Phiếu trả thiết bị</span>
            <h2 className="mt-1 text-2xl font-semibold text-[#202124]">{form.ticket.receiveCode}</h2>
            <p className="mt-1 text-sm font-medium text-[#667085]">{form.ticket.deviceName || form.ticket.modelName || 'Thiết bị sửa chữa'}</p>
          </div>
          <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e4e7] bg-white text-[#667085] hover:bg-[#f4f4f5]" onClick={onClose} type="button" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <DateInput label="Ngày trả" onChange={(value) => onChange({ returnedAt: value })} required value={form.returnedAt} />
          <DeviceInput label="Tổng chi phí sửa chữa" onChange={(value) => onChange({ totalRepairCost: value })} value={form.totalRepairCost} />
          <DeviceInput label="Bằng chữ" onChange={(value) => onChange({ repairCostInWords: value })} value={form.repairCostInWords} wide />
          <DeviceTextarea label="Phương pháp sửa chữa" onChange={(value) => onChange({ repairMethod: value })} value={form.repairMethod} />
          <DeviceTextarea label="Hư hỏng / biện pháp / chi phí" onChange={(value) => onChange({ repairCostItems: value })} value={form.repairCostItems} />
          <DeviceTextarea label="Kết quả" onChange={(value) => onChange({ resultNote: value })} value={form.resultNote} />
          <DeviceTextarea label="Tình trạng khi trả" onChange={(value) => onChange({ returnCondition: value })} value={form.returnCondition} />
        </div>
        <section className="grid gap-3 rounded-[22px] border border-[#e4e4e7] bg-[#fafafa] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-[#202124]">Phụ kiện / linh kiện thay thế</h3>
              <span className="text-xs font-semibold text-[#667085]">Tổng giá bán: {formatMoney(usedPartsTotal)}</span>
            </div>
            <button className="secondary-button compact" onClick={addPart} type="button">
              <Plus size={15} />
              Thêm
            </button>
          </div>
          <div className="grid gap-2">
            {form.usedParts.map((part, index) => (
              <article className="grid gap-2 rounded-2xl bg-white p-3 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07)]" key={`${index}-${part.name}-${part.serialNumber}`}>
                <div className="grid gap-2 min-[900px]:grid-cols-[minmax(180px,1.5fr)_80px_90px_120px_120px_120px_auto]">
                  <input className={deviceFieldClass} onChange={(event) => updatePart(index, { name: event.target.value })} placeholder="Tên phụ kiện, ví dụ Chấn tử đầu dò" value={part.name} />
                  <input className={deviceFieldClass} min={0.01} onChange={(event) => updatePart(index, { quantity: Number(event.target.value) })} step={0.01} type="number" value={part.quantity} />
                  <input className={deviceFieldClass} onChange={(event) => updatePart(index, { unit: event.target.value })} placeholder="Đơn vị" value={part.unit} />
                  <input className={deviceFieldClass} onChange={(event) => updatePart(index, { serialNumber: event.target.value })} placeholder="Serial" value={part.serialNumber} />
                  <input className={deviceFieldClass} min={0} onChange={(event) => updatePart(index, { unitCost: Number(event.target.value) })} placeholder="Giá vốn" step={1000} type="number" value={part.unitCost || ''} />
                  <input className={deviceFieldClass} min={0} onChange={(event) => updatePart(index, { unitPrice: Number(event.target.value) })} placeholder="Giá bán" step={1000} type="number" value={part.unitPrice || ''} />
                  <button className="secondary-button compact justify-center text-[#b5121b]" onClick={() => removePart(index)} type="button" aria-label="Xóa phụ kiện">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="grid gap-2 min-[760px]:grid-cols-[minmax(0,1fr)_140px] min-[760px]:items-center">
                  <input className={deviceFieldClass} onChange={(event) => updatePart(index, { note: event.target.value })} placeholder="Ghi chú sửa chữa/thay thế" value={part.note} />
                  <strong className="rounded-xl bg-[#eefaf3] px-3 py-2 text-sm text-[#177245]">{formatMoney(Number(part.quantity || 0) * Number(part.unitPrice || 0))}</strong>
                </div>
              </article>
            ))}
            {!form.usedParts.length ? (
              <div className="rounded-2xl bg-white px-4 py-5 text-center text-sm font-semibold text-[#667085]">
                Chưa có phụ kiện thay thế.
              </div>
            ) : null}
          </div>
        </section>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="secondary-button" onClick={onClose} type="button">Hủy</button>
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? <Loader2 className="spin-icon" size={16} /> : null}
            {form.ticket.status === 'RECEIVED' ? 'Lưu phiếu trả' : 'Cập nhật phiếu'}
          </button>
        </div>
      </form>
    </div>
  );
}

function emptyDeviceReceiveForm(user: ApiUser): DeviceReceiveForm {
  return {
    address: '',
    contactPhone: '',
    customerId: '',
    deviceName: '',
    engineerId: getRoleName(user) === 'engineer' ? user.id : '',
    machineId: '',
    modelName: '',
    preliminaryCause: '',
    receivedAccessories: '',
    receivedAt: toDateInput(new Date()),
    receivedCondition: '',
    representative: '',
    representativePosition: '',
    serialNumber: '',
    usingDepartment: '',
    warrantyStatus: 'IN_WARRANTY',
    warrantyTerm: '',
  };
}

function emptyDeviceReturnForm(ticket: DeviceServiceRow): DeviceReturnForm {
  return {
    repairCostInWords: ticket.repairCostInWords || '',
    repairCostItems: ticket.repairCostItems || '',
    repairMethod: ticket.repairMethod || '',
    resultNote: ticket.resultNote || '',
    returnCondition: ticket.returnCondition || '',
    returnedAt: ticket.returnedAt ? toDateInput(new Date(ticket.returnedAt)) : toDateInput(new Date()),
    ticket,
    totalRepairCost: ticket.totalRepairCost || '',
    usedParts: buildDeviceUsedParts(ticket.usedParts),
  };
}

function buildDeviceUsedParts(parts?: DeviceUsedPartRow[] | null): DeviceUsedPartDraft[] {
  return (parts ?? []).map((part) => ({
    name: part.name || '',
    note: part.note || '',
    quantity: Number(part.quantity || 1),
    serialNumber: part.serialNumber || '',
    unit: part.unit || 'cái',
    unitCost: Number(part.unitCost || 0),
    unitPrice: Number(part.unitPrice || 0),
  }));
}

function normalizeDeviceUsedPartsPayload(parts: DeviceUsedPartDraft[]) {
  return parts
    .map((part) => ({
      name: part.name.trim(),
      note: part.note.trim() || undefined,
      quantity: Number(part.quantity || 0),
      serialNumber: part.serialNumber.trim() || undefined,
      unit: part.unit.trim() || 'cái',
      unitCost: Number(part.unitCost || 0),
      unitPrice: Number(part.unitPrice || 0),
    }))
    .filter((part) => part.name && part.quantity > 0);
}

function compactPayload<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

function deviceStatusLabel(status: DeviceServiceStatus) {
  if (status === 'RECEIVED') return 'Đang ở kỹ thuật';
  if (status === 'RETURNED') return 'Đã trả';
  return 'Đã hủy';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

function formatMoney(value: number) {
  if (!value) return '0 đ';
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'VND',
  }).format(value);
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

function workKindLabel(kind: WorkKind) {
  if (kind === 'installation') return 'Lắp đặt';
  if (kind === 'repair') return 'Sửa chữa';
  if (kind === 'maintenance') return 'Bảo trì';
  if (kind === 'demo') return 'Demo';
  return 'Ứng dụng xét nghiệm';
}

function exportTechnicalWorkExcel(rows: TechnicalReportRow[], from: string, to: string) {
  const headers = ['Ngày', 'Loại phiếu', 'Mã phiếu', 'Máy', 'Model', 'Serial', 'Địa điểm', 'Khách hàng', 'Kỹ sư', 'Nội dung', 'Trạng thái'];
  const bodyRows = rows.map((row) => [
    formatDate(row.date),
    workKindLabel(row.kind),
    row.code,
    row.machineCode,
    row.model,
    row.serialNumber,
    row.province,
    row.customer,
    row.engineer,
    row.note || row.title,
    displayLabel(row.status),
  ]);
  const table = [headers, ...bodyRows]
    .map((line) => `<tr>${line.map((value) => `<td>${escapeHtml(String(value ?? ''))}</td>`).join('')}</tr>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table>${table}</table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `so-cong-viec-ky-thuat-${from}-${to}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function listCount<T>(result: Paginated<T> | T[]) {
  return Array.isArray(result) ? result.length : result.meta?.total ?? result.data?.length ?? 0;
}

function ticketScopeLabel(kind: BoardKind) {
  if (kind === 'maintenance') return 'Bảo trì';
  if (kind === 'installations') return 'Lắp đặt';
  return 'Sửa chữa';
}

import { ClipboardCheck, Loader2, Plus, RefreshCw, Search, Stethoscope, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { displayLabel } from '../../utils/displayLabels';

type ServiceTicketKind = 'repairs' | 'maintenance';
type BoardKind = ServiceTicketKind | 'installations';
type QueueKey = 'action' | 'active' | 'review' | 'closed' | 'all';

type ProductIndustry = {
  id: string;
  name: string;
  code?: string | null;
};

type EngineerOption = {
  id: string;
  email: string;
  fullName?: string | null;
};

type MachineSummary = {
  machineCode?: string | null;
  serialNumber?: string | null;
  modelName?: string | null;
  productCategory?: string | null;
  businessLine?: {
    name?: string | null;
    productIndustry?: {
      name?: string | null;
    } | null;
  } | null;
  customer?: {
    name?: string | null;
    hospitalName?: string | null;
    province?: string | null;
  } | null;
};

type ServiceRow = {
  id: string;
  code?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  type?: string | null;
  reportedAt?: string | null;
  scheduledDate?: string | null;
  completedAt?: string | null;
  reviewStatus?: string | null;
  engineer?: EngineerOption | null;
  customer?: {
    name?: string | null;
    hospitalName?: string | null;
    province?: string | null;
  } | null;
  machine?: MachineSummary | null;
  usingDepartment?: string | null;
};

type InstallationRow = {
  id: string;
  code?: string | null;
  status?: string | null;
  installedAt?: string | null;
  reviewStatus?: string | null;
  installedBy?: EngineerOption | null;
  machine?: MachineSummary | null;
  customer?: {
    name?: string | null;
    hospitalName?: string | null;
    province?: string | null;
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
};

type BoardItem = {
  id: string;
  code: string;
  title: string;
  kind: 'repair' | 'maintenance' | 'installation';
  status: string;
  reviewStatus?: string | null;
  date?: string | null;
  engineer?: EngineerOption | null;
  machine?: MachineSummary | null;
  customer?: { name?: string | null; hospitalName?: string | null; province?: string | null } | null;
  productIndustry?: string | null;
  secondary?: string | null;
};

const serviceTicketOptions: Array<{ label: string; value: ServiceTicketKind }> = [
  { label: 'Sửa chữa', value: 'repairs' },
  { label: 'Bảo trì', value: 'maintenance' },
];

const queues: Array<{ key: QueueKey; label: string }> = [
  { key: 'action', label: 'Cần xử lý' },
  { key: 'active', label: 'Đang làm' },
  { key: 'review', label: 'Chờ xác nhận' },
  { key: 'closed', label: 'Hoàn tất' },
  { key: 'all', label: 'Tất cả' },
];

export function ServiceTicketsPage(_props: { user: ApiUser }) {
  const [kind, setKind] = useState<ServiceTicketKind>('repairs');

  return (
    <OperationsBoard
      createHref={`/service-tickets/create?kind=${kind === 'maintenance' ? 'maintenance' : 'repair'}&returnTo=/service-tickets`}
      description="Theo dõi phiếu sửa chữa và bảo trì theo hàng đợi xử lý, ngành hàng, kỹ sư và trạng thái."
      kind={kind}
      kindSelector={
        <label className="operation-filter-field operation-filter-field--compact">
          <span>Loại phiếu</span>
          <select onChange={(event) => setKind(event.target.value as ServiceTicketKind)} value={kind}>
            {serviceTicketOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      }
      title="Phiếu kỹ thuật"
    />
  );
}

export function InstallationsPage(_props: { user: ApiUser }) {
  return (
    <OperationsBoard
      createHref="/installations/create?returnTo=/installations"
      description="Theo dõi kế hoạch lắp đặt, kỹ sư phụ trách, nghiệm thu và bảo hành theo ngành hàng."
      kind="installations"
      title="Kế hoạch lắp đặt"
    />
  );
}

function OperationsBoard({
  createHref,
  description,
  kind,
  kindSelector,
  title,
}: {
  createHref: string;
  description: string;
  kind: BoardKind;
  kindSelector?: ReactNode;
  title: string;
}) {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [engineers, setEngineers] = useState<EngineerOption[]>([]);
  const [productIndustryId, setProductIndustryId] = useState('');
  const [engineerId, setEngineerId] = useState('');
  const [queue, setQueue] = useState<QueueKey>('action');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 280);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    void loadBoard();
  }, [debouncedQuery, engineerId, kind, productIndustryId]);

  useEffect(() => {
    apiFetch<Paginated<EngineerOption> | EngineerOption[]>('/users?limit=100&roleName=engineer&status=ACTIVE')
      .then((result) => setEngineers(Array.isArray(result) ? result : result.data ?? []))
      .catch(() => setEngineers([]));
  }, []);

  async function loadBoard() {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ limit: '100' });
      if (debouncedQuery) params.set('search', debouncedQuery);
      if (productIndustryId) params.set('productIndustryId', productIndustryId);
      if (engineerId) params.set(kind === 'installations' ? 'installedById' : 'engineerId', engineerId);
      const endpoint = kind === 'installations' ? '/installations' : kind === 'maintenance' ? '/maintenance' : '/repairs';
      const result = await apiFetch<Paginated<ServiceRow | InstallationRow> | Array<ServiceRow | InstallationRow>>(`${endpoint}?${params.toString()}`);
      const rows = Array.isArray(result) ? result : result.data ?? [];
      setItems(rows.map((row) => normalizeBoardItem(row, kind)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách phiếu.');
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => buildQueueCounts(items), [items]);
  const visibleItems = useMemo(() => filterByQueue(items, queue), [items, queue]);
  const groupedItems = useMemo(() => groupByDate(visibleItems), [visibleItems]);

  return (
    <PageFrame>
      <div className="grid gap-4 min-[900px]:flex min-[900px]:items-start min-[900px]:justify-between">
        <PageTitle eyebrow="Vận hành kỹ thuật" title={title} description={description} />
        <div className="operation-board-actions">
          {kindSelector}
          <Link className="primary-button" to={createHref}>
            <Plus size={16} />
            Tạo phiếu
          </Link>
          <button className="secondary-button" disabled={loading} onClick={() => void loadBoard()} type="button">
            {loading ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
            Làm mới
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {queues.map((item) => (
          <button className={queueCardClass(queue === item.key)} key={item.key} onClick={() => setQueue(item.key)} type="button">
            <span>{item.label}</span>
            <strong>{counts[item.key]}</strong>
          </button>
        ))}
      </div>

      <section className="operation-filter-panel">
        <div className="operation-filter-grid">
          <label className="operation-search-field">
            <span>Tìm kiếm</span>
            <div>
              <Search size={16} />
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm mã phiếu, máy, khách hàng, serial"
                value={query}
              />
            </div>
          </label>
          <ProductIndustryFilter onChange={setProductIndustryId} value={productIndustryId} />
          <label className="operation-filter-field">
            <span>Kỹ sư</span>
            <select onChange={(event) => setEngineerId(event.target.value)} value={engineerId}>
              <option value="">Tất cả kỹ sư</option>
              {engineers.map((engineer) => (
                <option key={engineer.id} value={engineer.id}>
                  {engineer.fullName || engineer.email}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? <Notice message={error} /> : null}

      <section className="overflow-hidden rounded-lg border border-[#e5e5e5] bg-white shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeeee] bg-[#fafafa] px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-[#1f1f1f]">{queues.find((item) => item.key === queue)?.label}</h2>
            <p className="mt-1 text-sm text-[#666666]">{loading ? 'Đang tải dữ liệu' : `${visibleItems.length} phiếu đang hiển thị`}</p>
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
            <span className="text-sm">Thử đổi ngành hàng, kỹ sư hoặc hàng đợi trạng thái.</span>
          </div>
        ) : null}

        {!loading ? (
          <div className="grid">
            {groupedItems.map((group) => (
              <section className="border-b border-[#eeeeee] last:border-b-0" key={group.key}>
                <div className="flex items-center justify-between bg-[#fbfdff] px-4 py-2.5">
                  <strong className="text-sm text-[#1f1f1f]">{group.label}</strong>
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-[#666666]">{group.items.length} phiếu</span>
                </div>
                <div className="grid gap-0">
                  {group.items.map((item) => (
                    <TicketCard item={item} key={`${item.kind}-${item.id}`} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </section>
    </PageFrame>
  );
}

function TicketCard({ item }: { item: BoardItem }) {
  return (
    <article className="grid gap-3 border-t border-[#eeeeee] px-4 py-4 first:border-t-0 min-[960px]:grid-cols-[42px_minmax(0,1fr)_220px_auto] min-[960px]:items-center">
      <div className={kindIconClass(item.kind)}>{kindIcon(item.kind)}</div>
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#666666]">
          <span>{kindLabel(item.kind)}</span>
          <span>{item.code}</span>
          {item.date ? <span>{formatDate(item.date)}</span> : null}
          {item.productIndustry ? <span>{item.productIndustry}</span> : null}
        </div>
        <h3 className="text-[16px] font-semibold leading-snug text-[#1f1f1f]">{item.title}</h3>
        <div className="flex flex-wrap gap-2 text-[13px] leading-5 text-[#666666]">
          <span>{customerText(item)}</span>
          <span>{machineText(item)}</span>
          {item.secondary ? <span>{item.secondary}</span> : null}
        </div>
      </div>
      <div className="grid justify-items-start gap-2">
        <Badge tone={statusTone(item.status)}>{displayLabel(item.status)}</Badge>
        {item.reviewStatus && item.reviewStatus !== 'NOT_REQUIRED' ? <Badge tone={reviewTone(item.reviewStatus)}>{reviewLabel(item.reviewStatus)}</Badge> : null}
        <span className="text-[13px] font-semibold text-[#333333]">{item.engineer?.fullName || item.engineer?.email || 'Chưa phân kỹ sư'}</span>
      </div>
      <Link className="secondary-button justify-center" to={editHref(item)}>
        Cập nhật
      </Link>
    </article>
  );
}

function ProductIndustryFilter({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const [industries, setIndustries] = useState<ProductIndustry[]>([]);

  useEffect(() => {
    apiFetch<Paginated<ProductIndustry> | ProductIndustry[]>('/product-industries?limit=100')
      .then((result) => setIndustries(Array.isArray(result) ? result : result.data ?? []))
      .catch(() => setIndustries([]));
  }, []);

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
      title: `Lắp đặt ${machine?.machineCode || machine?.serialNumber || item.plannedMachineModel?.displayName || item.plannedMachineModel?.name || item.plannedModelName || item.code || ''}`.trim(),
      kind: 'installation',
      status: item.status || 'PENDING',
      reviewStatus: item.reviewStatus,
      date: item.installedAt,
      engineer: item.installedBy,
      machine,
      customer,
      productIndustry: item.businessLine?.productIndustry?.name || machine?.businessLine?.productIndustry?.name || item.plannedMachineModel?.businessLine?.productIndustry?.name,
      secondary: item.businessLine?.name || item.plannedMachineModel?.businessLine?.name || machine?.businessLine?.name,
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
    date: isMaintenance ? item.scheduledDate : item.reportedAt,
    engineer: item.engineer,
    machine: item.machine,
    customer: item.customer || item.machine?.customer || (item.usingDepartment ? { name: item.usingDepartment } : null),
    productIndustry: item.machine?.businessLine?.productIndustry?.name,
    secondary: isMaintenance ? displayLabel(item.type || '') : displayLabel(item.priority || ''),
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

function groupByDate(items: BoardItem[]) {
  const groups = new Map<string, BoardItem[]>();
  items.forEach((item) => {
    const key = item.date ? new Date(item.date).toISOString().slice(0, 10) : 'no-date';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  return Array.from(groups.entries())
    .sort(([left], [right]) => (left === 'no-date' ? 1 : right === 'no-date' ? -1 : left.localeCompare(right)))
    .map(([key, groupItems]) => ({
      key,
      label: key === 'no-date' ? 'Chưa có ngày hẹn' : formatDate(key),
      items: groupItems.sort((left, right) => left.code.localeCompare(right.code)),
    }));
}

function isAction(item: BoardItem) {
  return !item.engineer?.id || item.reviewStatus === 'PENDING' || ['PENDING', 'WAITING_PARTS', 'OVERDUE'].includes(item.status);
}

function isClosed(status: string) {
  return ['COMPLETED', 'CANCELLED', 'INSTALLED'].includes(status);
}

function editHref(item: BoardItem) {
  if (item.kind === 'installation') return `/installations/${item.id}/update?returnTo=/installations`;
  if (item.kind === 'maintenance') return `/maintenance/${item.id}/update?returnTo=/service-tickets`;
  return `/repairs/${item.id}/update?returnTo=/service-tickets`;
}

function queueCardClass(active: boolean) {
  return [
    'grid min-h-[92px] gap-2 rounded-lg border p-4 text-left transition hover:-translate-y-px hover:border-[#d71920] hover:shadow-[0_10px_28px_rgba(20,32,51,0.08)]',
    active ? 'border-[#d71920] bg-[#fff7f7] shadow-[0_10px_28px_rgba(215,25,32,0.08)]' : 'border-[#e5e5e5] bg-white',
  ].join(' ');
}

function kindIconClass(kind: BoardItem['kind']) {
  const base = 'flex h-[42px] w-[42px] items-center justify-center rounded-lg border';
  if (kind === 'maintenance') return `${base} border-[#b9e8ca] bg-[#eefaf3] text-[#177245]`;
  return `${base} border-[#f5c7cb] bg-[#fff5f5] text-[#d71920]`;
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
  if (status === 'PENDING') return 'Chờ xác nhận';
  if (status === 'APPROVED') return 'Đã xác nhận';
  if (status === 'NEEDS_REVISION') return 'Cần bổ sung';
  return displayLabel(status);
}

function customerText(item: BoardItem) {
  return [item.customer?.hospitalName || item.customer?.name, item.customer?.province].filter(Boolean).join(' - ') || 'Chưa có khách hàng';
}

function machineText(item: BoardItem) {
  return [item.machine?.machineCode, item.machine?.modelName, item.machine?.serialNumber ? `S/N ${item.machine.serialNumber}` : ''].filter(Boolean).join(' - ') || 'Chưa gắn máy';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

import { BarChart3, ClipboardCheck, Loader2, Plus, RefreshCw, Search, Stethoscope, Wrench } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { getRoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { queryKeys } from '../../lib/queryKeys';
import { displayLabel } from '../../utils/displayLabels';

type ServiceTicketKind = 'repairs' | 'maintenance';
type BoardKind = ServiceTicketKind | 'installations';
type TicketScope = BoardKind | 'all';
type QueueKey = 'action' | 'active' | 'review' | 'closed' | 'all';
type GroupByKey = 'date' | 'engineer' | 'industry' | 'customer';

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
  date?: string | null;
  engineer?: EngineerOption | null;
  machine?: MachineSummary | null;
  customer?: { name?: string | null; hospitalName?: string | null; province?: string | null } | null;
  productIndustry?: string | null;
  warrantyEndDate?: string | null;
  secondary?: string | null;
  urgency?: string | null;
};

const serviceTicketOptions: Array<{ label: string; value: TicketScope }> = [
  { label: 'Tất cả phiếu', value: 'all' },
  { label: 'Sửa chữa', value: 'repairs' },
  { label: 'Bảo trì', value: 'maintenance' },
  { label: 'Lắp đặt', value: 'installations' },
];

const queues: Array<{ key: QueueKey; label: string }> = [
  { key: 'all', label: 'Tất cả phiếu' },
  { key: 'action', label: 'Cần xử lý' },
  { key: 'active', label: 'Đang làm' },
  { key: 'review', label: 'Chờ xác nhận' },
  { key: 'closed', label: 'Đã xong' },
];

const groupOptions: Array<{ label: string; value: GroupByKey }> = [
  { label: 'Theo ngày', value: 'date' },
  { label: 'Theo kỹ sư', value: 'engineer' },
  { label: 'Theo ngành hàng', value: 'industry' },
  { label: 'Theo khách hàng', value: 'customer' },
];

export function ServiceTicketsPage({ user }: { user: ApiUser }) {
  const [kind, setKind] = useState<TicketScope>('all');

  return (
    <OperationsBoard
      description="Tra cứu lắp đặt, sửa chữa, bảo trì và bảo hành theo khách hàng, model hoặc S/N."
      kind={kind}
      kindSelector={
        <label className="operation-filter-field operation-filter-field--compact">
          <span>Phạm vi</span>
          <select onChange={(event) => setKind(event.target.value as TicketScope)} value={kind}>
            {serviceTicketOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      }
      reportHref={kind === 'all' ? '/reports?view=details' : `/technical-statistics?workType=${kind === 'maintenance' ? 'maintenance' : kind === 'installations' ? 'installation' : 'repair'}&returnTo=/service-tickets`}
      title="Tổng hợp phiếu"
      user={user}
    />
  );
}

export function InstallationsPage({ user }: { user: ApiUser }) {
  return (
    <OperationsBoard
      description="Theo dõi kế hoạch lắp đặt, kỹ sư phụ trách, nghiệm thu và bảo hành theo ngành hàng."
      kind="installations"
      reportHref="/technical-statistics?workType=installation&returnTo=/installations"
      title="Kế hoạch lắp đặt"
      user={user}
    />
  );
}

function OperationsBoard({
  description,
  kind,
  kindSelector,
  reportHref,
  title,
  user,
}: {
  description: string;
  kind: TicketScope;
  kindSelector?: ReactNode;
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
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 280);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const boardParams = useMemo(() => {
    const params = new URLSearchParams({ limit: '100' });
    if (debouncedQuery) params.set('search', debouncedQuery);
    if (productIndustryId) params.set('productIndustryId', productIndustryId);
    return params.toString();
  }, [debouncedQuery, productIndustryId]);

  const boardQuery = useQuery({
    queryKey: queryKeys.serviceTickets.board(kind, `${boardParams}&engineer=${engineerId}`),
    queryFn: async () => {
      const scopes: BoardKind[] = kind === 'all' ? ['repairs', 'maintenance', 'installations'] : [kind];
      const responses = await Promise.all(
        scopes.map(async (scope) => {
          const endpoint = scope === 'installations' ? '/installations' : scope === 'maintenance' ? '/maintenance' : '/repairs';
          const result = await apiFetch<Paginated<ServiceRow | InstallationRow> | Array<ServiceRow | InstallationRow>>(`${endpoint}?${paramsForScope(boardParams, scope, engineerId)}`);
          const rows = Array.isArray(result) ? result : result.data ?? [];
          return rows.map((row) => normalizeBoardItem(row, scope));
        }),
      );
      return responses.flat();
    },
  });

  const engineersQuery = useQuery({
    queryKey: queryKeys.serviceTickets.engineers,
    queryFn: async () => {
      const result = await apiFetch<Paginated<EngineerOption> | EngineerOption[]>('/users?limit=100&roleName=engineer&status=ACTIVE');
      return Array.isArray(result) ? result : result.data ?? [];
    },
  });

  const items = useMemo(() => [...(boardQuery.data ?? [])].sort(compareBoardItemsByDateDesc), [boardQuery.data]);
  const engineers = engineersQuery.data ?? [];
  const loading = boardQuery.isLoading || boardQuery.isFetching;
  const error =
    (boardQuery.error instanceof Error ? boardQuery.error.message : '') ||
    (engineersQuery.error instanceof Error ? engineersQuery.error.message : '');

  const counts = useMemo(() => buildQueueCounts(items), [items]);
  const visibleItems = useMemo(() => filterByQueue(items, queue).sort(compareBoardItemsByDateDesc), [items, queue]);
  const groupedItems = useMemo(() => groupItems(visibleItems, groupBy), [groupBy, visibleItems]);

  return (
    <PageFrame>
      <div className="grid gap-4 min-[900px]:flex min-[900px]:items-start min-[900px]:justify-between">
        <PageTitle eyebrow="Hồ sơ phiếu" title={title} description={description} />
        <div className="operation-board-actions">
          {kindSelector}
          <CreateTicketButtons />
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

      <div className="grid gap-3 md:grid-cols-5">
        {queues.map((item) => (
          <button className={queueCardClass(queue === item.key)} key={item.key} onClick={() => setQueue(item.key)} type="button">
            <span>{item.label}</span>
            <strong>{counts[item.key]}</strong>
          </button>
        ))}
      </div>

      <section className="operation-filter-panel">
        <div className="grid gap-2 min-[900px]:grid-cols-[minmax(260px,1fr)_220px_220px_180px]">
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
        </div>
      </section>

      {error ? <Notice message={error} /> : null}

      <section className="overflow-hidden rounded-lg border border-[#e5e5e5] bg-white shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeeee] bg-[#fafafa] px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-[#1f1f1f]">{queues.find((item) => item.key === queue)?.label}</h2>
            <p className="mt-1 text-sm text-[#666666]">{loading ? 'Đang tải' : `${visibleItems.length} phiếu · ${groupOptions.find((item) => item.value === groupBy)?.label.toLowerCase()}`}</p>
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
            <span className="text-sm">Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</span>
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

function CreateTicketButtons() {
  const links = [
    { label: 'Lắp đặt', to: '/installations/create?returnTo=/service-tickets' },
    { label: 'Sửa chữa', to: '/service-tickets/create?kind=repair&returnTo=/service-tickets' },
    { label: 'Bảo trì', to: '/service-tickets/create?kind=maintenance&returnTo=/service-tickets' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#f0d7d9] bg-[#fffafa] p-1">
      {links.map((item, index) => (
        <Link
          className={index === 0 ? 'primary-button compact' : 'secondary-button compact bg-white'}
          key={item.to}
          to={item.to}
        >
          <Plus size={15} />
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function TicketCard({ item }: { item: BoardItem }) {
  return (
    <article className={ticketCardClass(item)}>
      <div className={kindIconClass(item.kind)}>{kindIcon(item.kind)}</div>
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#666666]">
          <span>{kindLabel(item.kind)}</span>
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
          <span>{customerText(item)}</span>
          <span>{machineText(item)}</span>
          {item.warrantyEndDate ? <WarrantyBadge value={item.warrantyEndDate} /> : null}
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

function ticketCardClass(item: BoardItem) {
  const base = 'grid gap-3 border-t px-4 py-4 first:border-t-0 min-[960px]:grid-cols-[42px_minmax(0,1fr)_220px_auto] min-[960px]:items-center';
  if (urgencyRank(item) >= 70) return `${base} border-[#f5c7cb] bg-[#fffafa]`;
  if (urgencyRank(item) >= 30) return `${base} border-[#efd8a8] bg-[#fffdf8]`;
  return `${base} border-[#eeeeee] bg-white`;
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
      title: `Lắp đặt ${machine?.machineCode || machine?.serialNumber || item.plannedMachineModel?.displayName || item.plannedMachineModel?.name || item.plannedModelName || item.code || ''}`.trim(),
      kind: 'installation',
      status: item.status || 'PENDING',
      reviewStatus: item.reviewStatus,
      date: item.installedAt,
      engineer: item.installedBy,
      machine,
      customer,
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
    date: isMaintenance ? item.scheduledDate : item.reportedAt,
    engineer: item.engineer,
    machine: item.machine,
    customer: item.customer || item.machine?.customer || (item.usingDepartment ? { name: item.usingDepartment } : null),
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
  if (groupBy === 'engineer') return item.engineer?.fullName || item.engineer?.email || '__missing__';
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
  return compareItemDateDesc(left, right) || urgencyRank(right) - urgencyRank(left) || left.code.localeCompare(right.code);
}

function isAction(item: BoardItem) {
  return !item.engineer?.id || item.reviewStatus === 'PENDING' || ['PENDING', 'WAITING_PARTS', 'OVERDUE'].includes(item.status);
}

function alertBadges(item: BoardItem): Array<{ label: string; tone: 'good' | 'warn' | 'danger' | 'neutral' }> {
  const badges: Array<{ label: string; tone: 'good' | 'warn' | 'danger' | 'neutral' }> = [];

  if (!item.engineer?.id) badges.push({ label: 'Chưa phân kỹ sư', tone: 'danger' });
  if (item.reviewStatus === 'PENDING') badges.push({ label: 'Chờ xác nhận', tone: 'warn' });
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

function queueCardClass(active: boolean) {
  return [
    'grid min-h-[92px] gap-2 rounded-lg border p-4 text-left transition hover:-translate-y-px hover:border-[#d71920] hover:shadow-[0_10px_28px_rgba(20,32,51,0.08)]',
    active ? 'border-[#d71920] bg-[#fff7f7] shadow-[0_10px_28px_rgba(215,25,32,0.08)]' : 'border-[#e5e5e5] bg-white',
  ].join(' ');
}

function kindIconClass(kind: BoardItem['kind']) {
  const base = 'flex h-[42px] w-[42px] items-center justify-center rounded-lg border';
  if (kind === 'maintenance') return `${base} border-[#b9e8ca] bg-[#eefaf3] text-[#177245]`;
  if (kind === 'installation') return `${base} border-[#f0d7d9] bg-[#fff7f7] text-[#b5121b]`;
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
  if (engineerId) params.set(scope === 'installations' ? 'installedById' : 'engineerId', engineerId);
  return params.toString();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

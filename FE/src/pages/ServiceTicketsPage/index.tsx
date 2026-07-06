import { Archive, ArrowLeft, ArrowRight, BarChart3, ChevronDown, ClipboardCheck, Filter, Loader2, Plus, RefreshCw, Search, Stethoscope, Wrench, X } from 'lucide-react';
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
import { isTechnicalUser, technicalUserName } from '../../utils/technicalUsers';

type ServiceTicketKind = 'repairs' | 'maintenance';
type BoardKind = ServiceTicketKind | 'installations';
type TicketScope = BoardKind | 'receiving';
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
  engineerProfile?: unknown;
  role?: { name?: string | null } | null;
  roleName?: string | null;
  status?: string | null;
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

type TicketPortalCard = {
  actionLabel: string;
  countKey: TicketScope;
  description: string;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  meta: string;
  value: TicketScope;
};

const serviceTicketOptions: TicketPortalCard[] = [
  {
    actionLabel: 'Mở phiếu sửa chữa',
    countKey: 'repairs',
    description: 'Tổng hợp lỗi máy, bảo hành, chờ linh kiện và kết quả sửa chữa.',
    icon: <Wrench size={23} />,
    label: 'Sửa chữa',
    meta: 'Lỗi máy, bảo hành',
    value: 'repairs',
  },
  {
    actionLabel: 'Mở phiếu bảo trì',
    countKey: 'maintenance',
    description: 'Theo dõi lịch định kỳ, quá hạn, lịch hẹn lại và nghiệm thu bảo trì.',
    icon: <ClipboardCheck size={23} />,
    label: 'Bảo trì',
    meta: 'Lịch định kỳ',
    value: 'maintenance',
  },
  {
    actionLabel: 'Mở phiếu lắp đặt',
    countKey: 'installations',
    description: 'Quản lý bàn giao, bảo hành thiết bị và phiếu lắp đặt theo khách hàng.',
    icon: <Stethoscope size={23} />,
    label: 'Lắp đặt',
    meta: 'Bàn giao, bảo hành',
    value: 'installations',
  },
  {
    actionLabel: 'Để trống',
    countKey: 'receiving',
    description: 'Giữ chỗ cho nghiệp vụ nhận thiết bị. Chưa ghi nhận dữ liệu ở phiên bản này.',
    disabled: true,
    icon: <Archive size={23} />,
    label: 'Phiếu nhận thiết bị',
    meta: 'Sẽ bổ sung sau',
    value: 'receiving',
  },
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
  const [selectedKind, setSelectedKind] = useState<TicketScope | ''>('');
  const overviewQuery = useTicketPortalOverview();
  const overviewCounts = overviewQuery.data ?? { installations: 0, maintenance: 0, receiving: 0, repairs: 0 };
  const loading = overviewQuery.isLoading || overviewQuery.isFetching;
  const error = overviewQuery.error instanceof Error ? overviewQuery.error.message : '';

  if (!selectedKind) {
    return (
      <PageFrame>
        <TicketPortalHero loading={loading} onRefresh={() => void overviewQuery.refetch()} />
        {error ? <Notice message={error} /> : null}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {serviceTicketOptions.map((item) => (
            <TicketPortalCardButton count={overviewCounts[item.countKey]} item={item} key={item.value} onSelect={setSelectedKind} />
          ))}
        </section>
      </PageFrame>
    );
  }

  if (selectedKind === 'receiving') {
    return (
      <PageFrame>
        <ReceivingPlaceholder onBack={() => setSelectedKind('')} />
      </PageFrame>
    );
  }

  return (
    <OperationsBoard
      description={ticketScopeDescription(selectedKind)}
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
      description="Kế hoạch lắp đặt và bảo hành theo ngành hàng."
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
    queryFn: async () => {
      const [repairsResult, maintenanceResult, installationsResult] = await Promise.all([
        apiFetch<Paginated<ServiceRow> | ServiceRow[]>('/repairs?limit=100'),
        apiFetch<Paginated<ServiceRow> | ServiceRow[]>('/maintenance?limit=100'),
        apiFetch<Paginated<InstallationRow> | InstallationRow[]>('/installations?limit=100'),
      ]);

      return {
        installations: listCount(installationsResult),
        maintenance: listCount(maintenanceResult),
        receiving: 0,
        repairs: listCount(repairsResult),
      } satisfies Record<TicketScope, number>;
    },
  });
}

function TicketPortalHero({ loading, onRefresh }: { loading: boolean; onRefresh: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[#e4e4e7] bg-[#f4f4f5] px-5 py-9 shadow-[0_12px_30px_rgba(24,24,27,0.05)] md:px-8 md:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(24,24,27,0.075)_1px,transparent_1px),linear-gradient(180deg,rgba(24,24,27,0.055)_1px,transparent_1px)] bg-[size:70px_70px]" />
      <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#e4e4e7]/38 blur-3xl" />
      <div className="relative grid gap-5 min-[980px]:grid-cols-[minmax(0,1fr)_auto] min-[980px]:items-end">
        <div>
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#e4e4e7] bg-white/84 px-4 text-sm font-bold text-[#18181b] shadow-[0_10px_28px_rgba(24,24,27,0.08)]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#18181b]" />
            Kho phiếu kỹ thuật
          </span>
          <h1 className="mt-5 max-w-[760px] text-[clamp(38px,6vw,76px)] font-black leading-[0.96] tracking-[-0.055em] text-[#1f1f1f]">
            Tổng hợp phiếu
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] font-semibold leading-7 text-[#667985]">
            Tạo hoặc tra cứu phiếu. Admin duyệt tại Điều phối & duyệt.
          </p>
        </div>
        <button className="secondary-button bg-white/86" disabled={loading} onClick={onRefresh} type="button">
          {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
          Làm mới
        </button>
      </div>
    </section>
  );
}

function TicketPortalCardButton({ count, item, onSelect }: { count: number; item: TicketPortalCard; onSelect: (value: TicketScope) => void }) {
  const isDisabled = Boolean(item.disabled);

  return (
    <button
      className={[
        'group relative min-h-[218px] overflow-hidden rounded-[28px] border border-[#e4e4e7] bg-white/94 p-5 text-left shadow-[0_8px_24px_rgba(24,24,27,0.05)] transition',
        isDisabled ? 'cursor-pointer opacity-78 hover:border-[#e4e4e7]' : 'hover:-translate-y-1 hover:border-[#18181b]/35 hover:shadow-[0_14px_34px_rgba(24,24,27,0.08)]',
      ].join(' ')}
      onClick={() => onSelect(item.value)}
      type="button"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(14,165,233,0.10),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))]" />
      <div className="relative grid h-full gap-5">
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#18181b,#3f3f46)] text-white shadow-[0_16px_34px_rgba(24,24,27,0.24)]">
            {item.icon}
          </span>
          <span className="rounded-full border border-[#e4e4e7] bg-white px-3 py-1 text-xs font-black text-[#667985]">
            {count} phiếu
          </span>
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-black text-[#18181b]">{item.meta}</span>
          <strong className="block text-2xl font-black tracking-[-0.03em] text-[#1f1f1f]">{item.label}</strong>
          <span className="text-sm font-semibold leading-6 text-[#667985]">{item.description}</span>
        </div>
        <span className="mt-auto inline-flex items-center gap-2 text-sm font-black text-[#18181b]">
          {item.actionLabel}
          <ArrowRight className={isDisabled ? '' : 'transition group-hover:translate-x-1'} size={16} />
        </span>
      </div>
    </button>
  );
}

function ReceivingPlaceholder({ onBack }: { onBack: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-dashed border-[#e4e4e7] bg-[#fafafa] p-8 text-center shadow-[0_18px_46px_rgba(24,24,27,0.06)]">
      <div className="mx-auto grid max-w-2xl justify-items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#f4f4f5] text-[#18181b]">
          <Archive size={28} />
        </span>
        <div>
          <span className="text-sm font-black text-[#18181b]">Để trống nghiệp vụ</span>
          <h1 className="mt-2 text-[clamp(30px,5vw,52px)] font-black tracking-[-0.045em] text-[#1f1f1f]">Phiếu nhận thiết bị</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-[#667985]">
            Mục này đã được đặt chỗ trong luồng tổng hợp. Khi chốt nghiệp vụ nhận thiết bị, mình sẽ nối form, danh sách và báo cáo vào đúng vị trí này.
          </p>
        </div>
        <button className="secondary-button" onClick={onBack} type="button">
          <ArrowLeft size={16} />
          Quay lại loại phiếu
        </button>
      </div>
    </section>
  );
}

function OperationsBoard({
  description,
  kind,
  onBack,
  reportHref,
  title,
  user,
}: {
  description: string;
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
    const params = new URLSearchParams({ limit: '100' });
    if (debouncedQuery) params.set('search', debouncedQuery);
    if (productIndustryId) params.set('productIndustryId', productIndustryId);
    return params.toString();
  }, [debouncedQuery, productIndustryId]);

  const boardQuery = useQuery({
    queryKey: queryKeys.serviceTickets.board(kind, `${boardParams}&engineer=${engineerId}`),
    queryFn: async () => {
      const scopes: BoardKind[] = [kind];
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
      const result = await apiFetch<Paginated<EngineerOption> | EngineerOption[]>('/users?limit=100&status=ACTIVE');
      const users = Array.isArray(result) ? result : result.data ?? [];
      return users.filter(isTechnicalUser);
    },
  });

  const items = useMemo(() => [...(boardQuery.data ?? [])].sort(compareBoardItemsByDateDesc), [boardQuery.data]);
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
          <PageTitle eyebrow="Hồ sơ phiếu" title={title} description={description} />
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

      <section className="relative overflow-hidden rounded-[28px] border border-[#e4e4e7] bg-[#fafafa] p-4 shadow-[0_18px_46px_rgba(24,24,27,0.07)]">
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
              <span className="text-xs font-bold text-[#7a6367]">Tìm nhanh</span>
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
              <label className="operation-filter-field">
                <span>Từ ngày</span>
                <input onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
              </label>
              <label className="operation-filter-field">
                <span>Đến ngày</span>
                <input onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} />
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
              <PreviewField label="Duyệt admin" value={item.reviewStatus && item.reviewStatus !== 'NOT_REQUIRED' ? reviewLabel(item.reviewStatus) : 'Không yêu cầu'} />
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
  return compareItemDateDesc(left, right) || urgencyRank(right) - urgencyRank(left) || left.code.localeCompare(right.code);
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

function listCount<T>(result: Paginated<T> | T[]) {
  return Array.isArray(result) ? result.length : result.meta?.total ?? result.data?.length ?? 0;
}

function ticketScopeLabel(kind: BoardKind) {
  if (kind === 'maintenance') return 'Bảo trì';
  if (kind === 'installations') return 'Lắp đặt';
  return 'Sửa chữa';
}

function ticketScopeDescription(kind: BoardKind) {
  if (kind === 'maintenance') return 'Tổng hợp riêng các phiếu bảo trì: lịch hẹn, quá hạn, kỹ sư phụ trách và kết quả nghiệm thu.';
  if (kind === 'installations') return 'Tổng hợp riêng các phiếu lắp đặt: bàn giao, bảo hành, khách hàng và thiết bị đã lắp.';
  return 'Tổng hợp riêng các phiếu sửa chữa: lỗi máy, bảo hành, chờ linh kiện và kết quả xử lý.';
}

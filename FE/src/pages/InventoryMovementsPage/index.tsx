import { Boxes, ClipboardCheck, History, Loader2, PackageCheck, RotateCcw, Search, ShoppingCart, Split, Wrench, X } from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Paginated, apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { RoleName } from '../../auth/roles';
import { displayLabel } from '../../utils/displayLabels';
import { formatValue } from '../../utils/format';

type InventoryTab = 'stock' | 'installed' | 'history';
type InventoryStatus = 'IN_STOCK' | 'ACCESSORY_SPLIT' | 'INSTALLED' | 'RESERVED' | 'RETURNED' | 'SOLD';
type MovementType = 'IMPORT' | 'SPLIT_ACCESSORY' | 'RESERVE' | 'INSTALL' | 'RETURN' | 'SELL' | 'ADJUST_STATUS';
type StatusFilter = 'ALL' | InventoryStatus;

type Customer = {
  id: string;
  customerCode?: string | null;
  name: string;
  phone?: string | null;
  province?: string | null;
};

type Machine = {
  id: string;
  machineCode?: string | null;
  serialNumber?: string | null;
  modelName?: string | null;
  name?: string | null;
  inventoryStatus: InventoryStatus;
  status?: string | null;
  installDate?: string | null;
  warrantyEndDate?: string | null;
  customer?: Customer | null;
  primaryEngineer?: { fullName?: string | null; email?: string | null } | null;
  machineModel?: { code?: string | null; name?: string | null } | null;
  accessories?: unknown[];
};

type InventoryMovement = {
  id: string;
  code?: string | null;
  type: MovementType;
  fromStatus?: InventoryStatus | null;
  toStatus: InventoryStatus;
  occurredAt: string;
  note?: string | null;
  machine?: Machine | null;
  customer?: Customer | null;
  createdBy?: { fullName?: string | null; email?: string | null } | null;
};

type MovementAction = {
  label: string;
  type: MovementType;
  toStatus: InventoryStatus;
  note: string;
  requiresCustomer?: boolean;
};

const stockStatuses: InventoryStatus[] = ['IN_STOCK', 'RESERVED', 'RETURNED', 'ACCESSORY_SPLIT'];

export function InventoryMovementsPage({ currentRole }: { currentRole: RoleName }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<InventoryTab>(() => normalizeInventoryTab(searchParams.get('tab')));
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => normalizeStatusFilter(searchParams.get('status')));
  const [machines, setMachines] = useState<Machine[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeMove, setActiveMove] = useState<{ action: MovementAction; machine: Machine } | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [movementCustomerId, setMovementCustomerId] = useState('');
  const [movementNote, setMovementNote] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedMachine) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedMachine(null);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMachine]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredMachines = useMemo(() => {
    return machines.filter((machine) => {
      if (tab === 'stock' && !stockStatuses.includes(machine.inventoryStatus)) return false;
      if (tab === 'installed' && machine.inventoryStatus !== 'INSTALLED') return false;
      if (statusFilter !== 'ALL' && machine.inventoryStatus !== statusFilter) return false;
      if (!normalizedQuery) return true;
      return machineSearchText(machine).includes(normalizedQuery);
    }).sort(compareInventoryMachines);
  }, [machines, normalizedQuery, statusFilter, tab]);

  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      if (!normalizedQuery) return true;
      return [
        movement.code,
        movement.type,
        movement.fromStatus,
        movement.toStatus,
        movement.machine?.machineCode,
        movement.machine?.serialNumber,
        movement.machine?.modelName,
        movement.customer?.name,
        movement.createdBy?.fullName,
        movement.note,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [movements, normalizedQuery]);

  const stats = useMemo(
    () => ({
      available: machines.filter((machine) => machine.inventoryStatus === 'IN_STOCK').length,
      installed: machines.filter((machine) => machine.inventoryStatus === 'INSTALLED').length,
      accessorySplit: machines.filter((machine) => machine.inventoryStatus === 'ACCESSORY_SPLIT').length,
      history: movements.length,
      reserved: machines.filter((machine) => machine.inventoryStatus === 'RESERVED').length,
      returned: machines.filter((machine) => machine.inventoryStatus === 'RETURNED').length,
      returnedRepairing: machines.filter((machine) => machine.inventoryStatus === 'RETURNED' && machine.status === 'REPAIRING').length,
    }),
    [machines, movements],
  );
  const inventorySearch = buildInventorySearch(tab, query);
  const returnToInventory = encodeURIComponent(`/inventory-movements${inventorySearch}`);
  const splitAccessoryMachineIds = useMemo(
    () => new Set(movements.filter((movement) => movement.type === 'SPLIT_ACCESSORY' && movement.machine?.id).map((movement) => movement.machine!.id)),
    [movements],
  );

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [machinesResult, movementsResult, customersResult] = await Promise.all([
        apiFetch<Paginated<Machine>>('/machines?limit=100'),
        apiFetch<InventoryMovement[]>('/inventory-movements'),
        apiFetch<Paginated<Customer>>('/customers?limit=100'),
      ]);

      setMachines(machinesResult.data);
      setMovements(movementsResult);
      setCustomers(customersResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu kho máy.');
    } finally {
      setLoading(false);
    }
  }

  function openMovement(machine: Machine, action: MovementAction) {
    setActiveMove({ action, machine });
    setMovementCustomerId(machine.customer?.id ?? '');
    setMovementNote(action.note);
    setError('');
    setSuccess('');
  }

  function updateInventoryState(nextTab: InventoryTab, nextQuery: string, nextStatus: StatusFilter = statusFilter) {
    setTab(nextTab);
    setQuery(nextQuery);
    const normalizedStatus = nextTab === 'history' || nextTab === 'installed' ? 'ALL' : nextStatus;
    setStatusFilter(normalizedStatus);

    const nextParams = new URLSearchParams();
    if (nextTab !== 'stock') nextParams.set('tab', nextTab);
    if (nextQuery.trim()) nextParams.set('q', nextQuery.trim());
    if (normalizedStatus !== 'ALL') nextParams.set('status', normalizedStatus);
    setSearchParams(nextParams, { replace: true });
  }

  async function submitMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeMove) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiFetch('/inventory-movements', {
        method: 'POST',
        body: JSON.stringify({
          machineId: activeMove.machine.id,
          type: activeMove.action.type,
          toStatus: activeMove.action.toStatus,
          customerId: movementCustomerId || undefined,
          note: movementNote.trim() || undefined,
        }),
      });

      setSuccess('Đã ghi nhận phiếu kho và cập nhật trạng thái máy.');
      setActiveMove(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được phiếu kho.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageFrame>
      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="overflow-hidden rounded-[24px] border border-[#e4e4e7] bg-white font-sans shadow-[0_16px_36px_rgba(24,24,27,0.06)]">
        <div className="grid gap-4 border-b border-[#eeeeee] bg-[#fbfbfc] p-4 min-[1280px]:grid-cols-[minmax(220px,0.58fr)_minmax(0,1.42fr)_auto] min-[1280px]:items-center">
          <div className="min-w-0">
            <span className="text-xs font-black text-[#667085]">Kho kỹ thuật</span>
            <h1 className="mt-1 truncate text-2xl font-black tracking-[-0.03em] text-[#18181b]">Kho máy</h1>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <InventoryMetric icon={<Boxes size={16} />} label="Sẵn sàng" tone="neutral" value={stats.available} />
            <InventoryMetric icon={<ClipboardCheck size={16} />} label="Đã giữ" tone="warn" value={stats.reserved} />
            <InventoryMetric icon={<RotateCcw size={16} />} label="Trả về" tone="danger" value={stats.returned} />
            <InventoryMetric icon={<PackageCheck size={16} />} label="Đã lắp" tone="good" value={stats.installed} />
          </div>
          <button className="secondary-button bg-white min-[1120px]:justify-self-end" disabled={loading} onClick={loadData} type="button">
            {loading ? <Loader2 className="spin-icon" size={17} /> : <History size={17} />}
            {loading ? 'Đang tải' : 'Làm mới'}
          </button>
        </div>

        <div className="grid gap-3 p-3 min-[1180px]:grid-cols-[minmax(0,1fr)_auto] min-[1180px]:items-center">
          {tab === 'stock' ? (
            <StockFilterRail
              activeStatus={statusFilter}
              stats={stats}
              onChange={(nextStatus) => updateInventoryState('stock', query, nextStatus)}
            />
          ) : (
            <span className="text-sm font-bold text-[#667085]">{tab === 'installed' ? 'Máy đã lắp đặt tại khách hàng' : 'Lịch sử điều chuyển kho'}</span>
          )}
          <div className="flex flex-wrap gap-2 min-[1180px]:justify-end">
            <TabButton active={tab === 'stock'} icon={<Boxes size={16} />} label="Tồn kho" onClick={() => updateInventoryState('stock', query, 'ALL')} />
            <TabButton active={tab === 'installed'} icon={<PackageCheck size={16} />} label="Đã lắp" onClick={() => updateInventoryState('installed', query, 'ALL')} />
            <TabButton active={tab === 'history'} icon={<History size={16} />} label="Lịch sử" onClick={() => updateInventoryState('history', query, 'ALL')} />
          </div>
        </div>
      </section>

      <InventoryResultToolbar
        count={tab === 'history' ? filteredMovements.length : filteredMachines.length}
        query={query}
        searchPlaceholder={tab === 'history' ? 'Tìm phiếu, máy, khách hàng' : 'Tìm mã máy, serial, model'}
        subtitle={tab === 'history' ? 'Lịch sử kho' : tab === 'installed' ? 'Máy đã lắp' : 'Danh sách kho'}
        title={tab === 'history' ? 'Lịch sử điều chuyển' : tab === 'installed' ? 'Máy đang ở khách hàng' : statusFilter === 'ALL' ? 'Tất cả máy trong kho' : displayLabel(statusFilter)}
        onQueryChange={(nextQuery) => updateInventoryState(tab, nextQuery, statusFilter)}
      />

      {tab === 'history' ? (
        <HistoryTable loading={loading} movements={filteredMovements} resetKey={`history-${query}`} />
      ) : (
        <section className="grid gap-3">
          <MachineTable
            loading={loading}
            machines={filteredMachines}
            mode={tab}
            resetKey={`${tab}-${statusFilter}-${query}`}
            canManageInventory={currentRole === 'admin'}
            returnTo={returnToInventory}
            splitAccessoryMachineIds={splitAccessoryMachineIds}
            onMove={openMovement}
            onView={setSelectedMachine}
          />
        </section>
      )}

      {selectedMachine ? (
        <MachinePreviewModal machine={selectedMachine} onClose={() => setSelectedMachine(null)} returnTo={returnToInventory} />
      ) : null}

      {activeMove ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-5" role="presentation">
          <form className="grid w-full max-w-[520px] gap-4 rounded-lg border border-[#e5e5e5] bg-white p-5 font-sans shadow-[0_24px_70px_rgba(24,24,27,0.2)]" onSubmit={submitMovement}>
            <div>
              <span className="text-xs font-medium text-[#18181b]">Phiếu kho</span>
              <h2 className="mt-1 text-xl font-medium text-[#1f1f1f]">{activeMove.action.label}</h2>
              <p className="mt-1 text-sm text-[#666666]">{machineLabel(activeMove.machine)}</p>
            </div>

            {activeMove.action.requiresCustomer ? (
              <label className="grid gap-2 text-sm font-semibold text-[#333333]">
                Khách hàng
                <select className={fieldClass} onChange={(event) => setMovementCustomerId(event.target.value)} required value={movementCustomerId}>
                  <option value="">Chọn khách hàng</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customerLabel(customer)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <MovementChecklist action={activeMove.action} />

            <label className="grid gap-2 text-sm font-semibold text-[#333333]">
              Ghi chú
              <textarea className={`${fieldClass} min-h-24 py-2.5`} onChange={(event) => setMovementNote(event.target.value)} value={movementNote} />
            </label>

            <div className="flex justify-end gap-2 border-t border-[#eeeeee] pt-4">
              <button className="secondary-button" disabled={saving} onClick={() => setActiveMove(null)} type="button">
                Hủy
              </button>
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? <Loader2 className="spin-icon" size={17} /> : <ClipboardCheck size={17} />}
                {saving ? 'Đang lưu' : 'Lưu'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </PageFrame>
  );
}

function SummaryCard({
  detail,
  icon,
  label,
  tone,
  value,
}: {
  detail?: string;
  icon: ReactNode;
  label: string;
  tone: 'good' | 'warn' | 'danger' | 'neutral';
  value: number;
}) {
  return (
    <div className="grid gap-2 rounded-[18px] border border-[#e4e4e7] bg-white p-4 font-sans shadow-[0_10px_26px_rgba(24,24,27,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#666666]">{label}</span>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-[14px] ${summaryIconTone[tone]}`}>{icon}</span>
      </div>
      <strong className="text-3xl leading-none text-[#1f1f1f]">{value}</strong>
      {detail ? <span className="text-xs text-[#666666]">{detail}</span> : null}
    </div>
  );
}

function InventoryMetric({
  icon,
  label,
  tone,
  value,
}: {
  icon: ReactNode;
  label: string;
  tone: 'good' | 'warn' | 'danger' | 'neutral';
  value: number;
}) {
  return (
    <div className="grid min-h-[74px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] border border-[#e8ecef] bg-white px-3 py-2.5">
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold text-[#667085]">{label}</span>
        <strong className="mt-1 block text-2xl leading-none tracking-[-0.04em] text-[#18181b]">{value}</strong>
      </span>
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-[13px] ${summaryIconTone[tone]}`}>{icon}</span>
    </div>
  );
}

function InventoryResultToolbar({
  count,
  onQueryChange,
  query,
  searchPlaceholder,
  subtitle,
  title,
}: {
  count: number;
  onQueryChange: (value: string) => void;
  query: string;
  searchPlaceholder: string;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="grid gap-3 rounded-[20px] border border-[#e4e4e7] bg-white p-3 shadow-[0_10px_24px_rgba(24,24,27,0.04)] min-[1180px]:grid-cols-[minmax(220px,0.58fr)_minmax(300px,0.9fr)_auto] min-[1180px]:items-center">
      <div className="min-w-0">
        <span className="text-xs font-black text-[#667085]">{subtitle}</span>
        <h2 className="mt-1 truncate text-xl font-black tracking-[-0.02em] text-[#18181b]">{title}</h2>
      </div>
      <label className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-[16px] border border-[#e4e4e7] bg-[#fbfbfc] px-3 text-[#666666] transition focus-within:border-[#18181b] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(24,24,27,0.10)]">
        <Search size={18} />
        <input
          className="min-w-0 flex-1 border-0 bg-transparent font-sans text-[#1f1f1f] outline-none"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          value={query}
        />
      </label>
      <span className="rounded-[14px] border border-[#e8ecef] bg-[#fbfbfc] px-3 py-2 text-sm font-bold text-[#3f3f46] min-[980px]:justify-self-end">
        {count} kết quả
      </span>
    </section>
  );
}

function StockFilterRail({
  activeStatus,
  onChange,
  stats,
}: {
  activeStatus: StatusFilter;
  onChange: (status: StatusFilter) => void;
  stats: {
    accessorySplit: number;
    available: number;
    reserved: number;
    returned: number;
  };
}) {
  const items: Array<{ count: number; label: string; value: StatusFilter }> = [
    { count: stats.available + stats.reserved + stats.returned + stats.accessorySplit, label: 'Tất cả', value: 'ALL' },
    { count: stats.available, label: 'Sẵn sàng', value: 'IN_STOCK' },
    { count: stats.reserved, label: 'Đã giữ', value: 'RESERVED' },
    { count: stats.returned, label: 'Thu hồi', value: 'RETURNED' },
    { count: stats.accessorySplit, label: 'Tách phụ kiện', value: 'ACCESSORY_SPLIT' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-black text-[#667085]">Lọc kho</span>
      {items.map((item) => {
        const active = activeStatus === item.value;

        return (
          <button
            className={[
              'inline-flex min-h-8 items-center gap-2 rounded-[999px] border px-3 text-sm font-bold transition',
              active
                ? 'border-[#18181b] bg-[#18181b] text-white shadow-[0_8px_18px_rgba(24,24,27,0.14)]'
                : 'border-[#e4e4e7] bg-white text-[#3f3f46] hover:border-[#18181b]/40 hover:bg-[#fafafa]',
            ].join(' ')}
            key={item.value}
            onClick={() => onChange(item.value)}
            type="button"
          >
            <span>{item.label}</span>
            <strong className={active ? 'text-white' : 'text-[#18181b]'}>{item.count}</strong>
          </button>
        );
      })}
    </div>
  );
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-[999px] border px-3 text-sm font-bold transition ${
        active
          ? 'border-[#18181b] bg-[#18181b] text-white shadow-[0_8px_18px_rgba(24,24,27,0.14)]'
          : 'border-[#e4e4e7] bg-white text-[#3f3f46] hover:border-[#18181b]/40 hover:bg-[#fafafa]'
      }`}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function MachineTable({
  loading,
  machines,
  mode,
  resetKey,
  canManageInventory,
  returnTo,
  splitAccessoryMachineIds,
  onMove,
  onView,
}: {
  loading: boolean;
  machines: Machine[];
  mode: 'stock' | 'installed';
  resetKey: string;
  canManageInventory: boolean;
  returnTo: string;
  splitAccessoryMachineIds: Set<string>;
  onMove: (machine: Machine, action: MovementAction) => void;
  onView: (machine: Machine) => void;
}) {
  const pagination = usePagedRows(machines, resetKey);

  return (
    <>
      <div className="responsive-table-wrap overflow-x-auto rounded-t-[22px] border border-[#e4e4e7] bg-white font-sans shadow-[0_14px_34px_rgba(24,24,27,0.05)]">
        <table className="responsive-data-table w-full min-w-[1040px] border-collapse">
          <thead>
            <tr>
              {['Máy', 'Serial / Model', 'Khách hàng', 'Trạng thái', mode === 'installed' ? 'Bảo hành / Kỹ sư' : 'Phụ kiện', 'Thao tác'].map((header) => (
                <th className="border-b border-[#eeeeee] bg-[#fafafa] px-4 py-3 text-left text-xs font-medium text-[#666666]" key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <LoadingRows columns={6} /> : null}
            {!loading && pagination.rows.map((machine) => (
              <tr
                className="cursor-pointer even:bg-[#fcfdff] hover:bg-[#fafafa] focus:bg-[#fafafa] focus:outline-none focus-visible:shadow-[inset_3px_0_0_#18181b]"
                key={machine.id}
                onClick={() => onView(machine)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onView(machine);
                  }
                }}
                tabIndex={0}
              >
                <td className={cellClass}>
                  <strong className="block text-[#1f1f1f]">{machine.machineCode || 'Chưa có mã máy'}</strong>
                  <span className="mt-1 block text-xs text-[#666666]">{machine.name || machine.modelName || 'Thiết bị'}</span>
                </td>
                <td className={cellClass}>
                  <MachineSerialLink machine={machine} />
                  <span className="mt-1 block text-xs text-[#666666]">{machine.machineModel?.code || machine.modelName || machine.machineModel?.name || '-'}</span>
                </td>
                <td className={cellClass}>
                  <span className="block max-w-[220px] truncate">{machine.customer?.name || '-'}</span>
                  {machine.customer?.province ? <span className="mt-1 block text-xs text-[#666666]">{machine.customer.province}</span> : null}
                </td>
                <td className={cellClass}>
                  <StatusBadge value={machine.inventoryStatus} />
                  {machine.status && machine.status !== 'ACTIVE' ? <span className="ml-2 text-xs font-medium text-[#9b5a17]">{displayLabel(machine.status)}</span> : null}
                </td>
                <td className={cellClass}>
                  {mode === 'installed' ? (
                    <>
                      <span className="block">{machine.warrantyEndDate ? formatValue(machine.warrantyEndDate) : 'Chưa có hạn BH'}</span>
                      <span className="text-xs text-[#666666]">{machine.primaryEngineer?.fullName || machine.primaryEngineer?.email || 'Chưa có kỹ sư'}</span>
                    </>
                  ) : (
                    `${machine.accessories?.length ?? 0} phụ kiện`
                  )}
                </td>
                <td className={`${cellClass} min-w-[260px]`}>
                  <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                    {mode === 'installed' ? (
                      <>
                        {canManageInventory ? (
                          <button className="secondary-button" onClick={() => onMove(machine, movementActions.return)} type="button">
                            <RotateCcw size={15} />
                            Thu hồi
                          </button>
                        ) : null}
                        <Link className="secondary-button" to={`/service-tickets/create?kind=repair&machineId=${machine.id}&returnTo=${returnTo}`}>
                          <Wrench size={15} />
                          Sửa chữa
                        </Link>
                        <Link className="secondary-button" to={`/service-tickets/create?kind=maintenance&machineId=${machine.id}&returnTo=${returnTo}`}>
                          <ClipboardCheck size={15} />
                          Bảo trì
                        </Link>
                      </>
                    ) : (
                      <>
                        {canManageInventory && machine.inventoryStatus === 'IN_STOCK' ? (
                          <button className="secondary-button" onClick={() => onMove(machine, movementActions.reserve)} type="button">
                            <ClipboardCheck size={15} />
                            Giữ máy
                          </button>
                        ) : null}
                        {canInstallFromInventory(machine) ? (
                          <Link className="primary-button" to={`/installations/create?machineId=${machine.id}&returnTo=${returnTo}`}>
                            <PackageCheck size={15} />
                            Lắp đặt
                          </Link>
                        ) : null}
                        {machine.inventoryStatus === 'RETURNED' ? (
                          <>
                            <Link className="secondary-button" to={`/service-tickets/create?kind=repair&machineId=${machine.id}&returnTo=${returnTo}`}>
                              <Wrench size={15} />
                              Sửa/kiểm tra
                            </Link>
                            {canManageInventory ? (
                              <button className="primary-button" onClick={() => onMove(machine, movementActions.returnToCustomer)} type="button">
                                <PackageCheck size={15} />
                                Trả khách
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {canManageInventory && (machine.inventoryStatus === 'RETURNED' || machine.inventoryStatus === 'ACCESSORY_SPLIT') ? (
                          <button className="primary-button" onClick={() => onMove(machine, movementActions.import)} type="button">
                            <PackageCheck size={15} />
                            Nhập lại kho
                          </button>
                        ) : null}
                        {canManageInventory && (machine.inventoryStatus === 'IN_STOCK' || (machine.inventoryStatus === 'RETURNED' && machine.status !== 'REPAIRING')) ? (
                          <button className="secondary-button" onClick={() => onMove(machine, movementActions.splitAccessory)} type="button">
                            <Split size={15} />
                            Tách phụ kiện
                          </button>
                        ) : null}
                        {canManageInventory && (machine.inventoryStatus === 'IN_STOCK' || machine.inventoryStatus === 'RESERVED') && !splitAccessoryMachineIds.has(machine.id) ? (
                          <Link className="secondary-button" to={`/installations/create?machineId=${machine.id}&returnTo=${returnTo}`}>
                            <ShoppingCart size={15} />
                            Bán máy
                          </Link>
                        ) : null}
                        {splitAccessoryMachineIds.has(machine.id) ? (
                          <span className="rounded-lg border border-[#efd8a8] bg-[#fff8ed] px-2.5 py-2 text-xs font-bold text-[#9b5a17]">
                            Đã tách phụ kiện, không xuất bán
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && machines.length === 0 ? <EmptyRow columns={6} /> : null}
          </tbody>
        </table>
      </div>
      <InventoryTablePager {...pagination} disabled={loading} label="máy" />
    </>
  );
}

function MachinePreviewModal({ machine, onClose, returnTo }: { machine: Machine; onClose: () => void; returnTo: string }) {
  const canInstall = canInstallFromInventory(machine);
  const canCreateService = machine.inventoryStatus === 'INSTALLED' || machine.inventoryStatus === 'RETURNED';
  const title = machine.machineCode || machine.serialNumber || machine.modelName || 'Thiết bị';

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-[#182033]/45 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <section
        aria-modal="true"
        className="grid max-h-[92vh] w-full max-w-[880px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[24px] border border-[#e4e4e7] bg-white font-sans shadow-[0_34px_90px_rgba(24,24,27,0.24)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#e4e4e7] bg-gradient-to-br from-[#f4f4f5] via-white to-[#f4f4f5] px-5 py-4">
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#18181b]">Chi tiết máy</span>
            <h2 className="mt-1 truncate text-2xl font-semibold text-[#182033]">{title}</h2>
            <p className="mt-1 text-sm text-[#667085]">{machine.name || machine.machineModel?.name || machine.modelName || 'Chưa có tên thiết bị'}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge value={machine.inventoryStatus} />
            <button
              aria-label="Đóng xem chi tiết máy"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e4e7] bg-white text-[#344054] transition hover:-translate-y-0.5 hover:border-[#18181b] hover:text-[#18181b]"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="overflow-y-auto px-5 py-5">
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="grid gap-4">
              <section className="rounded-[18px] border border-[#e4e4e7] bg-[#ffffff] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-[#182033]">Thông tin máy</h3>
                  {machine.status && machine.status !== 'ACTIVE' ? (
                    <span className="rounded-full bg-[#fff8ed] px-2.5 py-1 text-xs font-semibold text-[#9b5a17]">{displayLabel(machine.status)}</span>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <PreviewField label="Mã máy" value={machine.machineCode || 'Chưa có mã'} />
                  <PreviewField label="Serial" value={<MachineSerialLink machine={machine} />} />
                  <PreviewField label="Model" value={machine.machineModel?.code || machine.modelName || machine.machineModel?.name || 'Chưa có model'} />
                  <PreviewField label="Tên thiết bị" value={machine.name || machine.machineModel?.name || 'Chưa có tên'} />
                </div>
              </section>

              <section className="rounded-[18px] border border-[#e6edf5] bg-[#fafafa] p-4">
                <h3 className="mb-3 font-semibold text-[#182033]">Khách hàng & bảo hành</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <PreviewField label="Khách hàng" value={machine.customer?.name || 'Chưa gắn khách hàng'} />
                  <PreviewField label="Khu vực" value={machine.customer?.province || 'Chưa có khu vực'} />
                  <PreviewField label="Ngày lắp" value={machine.installDate ? formatValue(machine.installDate) : 'Chưa lắp'} />
                  <PreviewField label="Hạn bảo hành" value={machine.warrantyEndDate ? formatValue(machine.warrantyEndDate) : 'Chưa có hạn BH'} />
                </div>
              </section>
            </div>

            <aside className="grid content-start gap-4">
              <section className="rounded-[18px] border border-[#e4e4e7] bg-white p-4 shadow-[0_12px_30px_rgba(24,24,27,0.05)]">
                <h3 className="font-semibold text-[#182033]">Phụ trách</h3>
                <div className="mt-3 grid gap-3">
                  <PreviewField label="Kỹ sư chính" value={machine.primaryEngineer?.fullName || machine.primaryEngineer?.email || 'Chưa phân kỹ sư'} />
                  <PreviewField label="Phụ kiện" value={`${machine.accessories?.length ?? 0} phụ kiện`} />
                </div>
              </section>

              <section className="rounded-[18px] border border-[#e4e4e7] bg-[#f4f4f5] p-4">
                <h3 className="font-semibold text-[#182033]">Gợi ý thao tác</h3>
                <p className="mt-2 text-sm leading-6 text-[#667085]">Kiểm tra trước khi tạo phiếu.</p>
              </section>
            </aside>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e4e4e7] bg-white px-5 py-4">
          <button className="secondary-button" onClick={onClose} type="button">
            Đóng
          </button>
          {canInstall ? (
            <Link className="primary-button" to={`/installations/create?machineId=${machine.id}&returnTo=${returnTo}`}>
              <PackageCheck size={15} />
              Tạo phiếu lắp đặt
            </Link>
          ) : null}
          {canCreateService ? (
            <Link className="secondary-button" to={`/service-tickets/create?kind=repair&machineId=${machine.id}&returnTo=${returnTo}`}>
              <Wrench size={15} />
              Sửa chữa
            </Link>
          ) : null}
          {machine.inventoryStatus === 'INSTALLED' ? (
            <Link className="secondary-button" to={`/service-tickets/create?kind=maintenance&machineId=${machine.id}&returnTo=${returnTo}`}>
              <ClipboardCheck size={15} />
              Bảo trì
            </Link>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

function MachineSerialLink({ machine }: { machine: Machine }) {
  if (!machine.serialNumber) {
    return <span className="block font-semibold text-[#18181b]">-</span>;
  }

  return (
    <Link
      className="block w-fit font-semibold text-[#18181b] underline decoration-[#cbd5e1] underline-offset-4 transition hover:text-[#0f5ea8] hover:decoration-[#0f5ea8]"
      onClick={(event) => event.stopPropagation()}
      to={`/technical-machines/${machine.id}`}
    >
      {machine.serialNumber}
    </Link>
  );
}

function PreviewField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-white/70 bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(24,24,27,0.04)]">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">{label}</span>
      <strong className="mt-1 block break-words text-sm font-semibold text-[#202939]">{value}</strong>
    </div>
  );
}

function HistoryTable({ loading, movements, resetKey }: { loading: boolean; movements: InventoryMovement[]; resetKey: string }) {
  const pagination = usePagedRows(movements, resetKey);

  return (
    <>
      <div className="responsive-table-wrap overflow-x-auto rounded-t-[22px] border border-[#e4e4e7] bg-white font-sans shadow-[0_14px_34px_rgba(24,24,27,0.05)]">
        <table className="responsive-data-table w-full min-w-[980px] border-collapse">
          <thead>
            <tr>
              {['Mã phiếu', 'Loại', 'Máy', 'Chuyển trạng thái', 'Khách hàng', 'Người tạo', 'Ngày'].map((header) => (
                <th className="border-b border-[#eeeeee] bg-[#fafafa] px-4 py-3 text-left text-xs font-medium text-[#666666]" key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <LoadingRows columns={7} /> : null}
            {!loading && pagination.rows.map((movement) => (
              <tr className="even:bg-[#fcfdff] hover:bg-[#fafafa]" key={movement.id}>
                <td className={cellClass}>{movement.code || '-'}</td>
                <td className={cellClass}>{displayLabel(movement.type)}</td>
                <td className={cellClass}>{movement.machine ? machineLabel(movement.machine) : '-'}</td>
                <td className={cellClass}>
                  <span>{movement.fromStatus ? displayLabel(movement.fromStatus) : '-'}</span>
                  <span className="px-2 text-[#8a8a8a]">→</span>
                  <StatusBadge value={movement.toStatus} />
                </td>
                <td className={cellClass}>{movement.customer?.name || '-'}</td>
                <td className={cellClass}>{movement.createdBy?.fullName || movement.createdBy?.email || '-'}</td>
                <td className={cellClass}>{formatValue(movement.occurredAt)}</td>
              </tr>
            ))}
            {!loading && movements.length === 0 ? <EmptyRow columns={7} /> : null}
          </tbody>
        </table>
      </div>
      <InventoryTablePager {...pagination} disabled={loading} label="phiếu" />
    </>
  );
}

function usePagedRows<T>(items: T[], resetKey: string) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [items.length, resetKey]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return {
    page: currentPage,
    pageSize,
    rows,
    total: items.length,
    totalPages,
    onPageChange: setPage,
  };
}

function InventoryTablePager({
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-[22px] border-x border-b border-[#e4e4e7] bg-[#fafafa] px-4 py-3 text-sm font-medium text-[#666666]">
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

function StatusBadge({ value }: { value: InventoryStatus }) {
  const tone = value === 'INSTALLED' ? 'good' : value === 'RESERVED' ? 'warn' : value === 'SOLD' ? 'danger' : 'neutral';
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-medium ${statusToneClass[tone]}`}>{displayLabel(value)}</span>;
}

function MovementChecklist({ action }: { action: MovementAction }) {
  const items =
    action.type === 'RETURN'
      ? [
          'Ghi rõ lý do thu hồi và tình trạng máy khi nhận',
          'Đối chiếu serial máy và phụ kiện đi kèm',
          'Chụp ảnh tình trạng máy/phụ kiện trước khi nhập kho',
          'Nếu cần sửa, tạo phiếu sửa chữa ngay sau khi thu hồi',
        ]
      : action.label.includes('Trả khách')
        ? [
            'Xác nhận máy đã kiểm tra/sửa xong trước khi trả khách',
            'Đối chiếu đủ phụ kiện lúc trả lại',
            'Ghi nhận người nhận bàn giao và thời điểm trả',
            'Chụp ảnh/biên bản bàn giao lại nếu có',
          ]
        : action.type === 'IMPORT'
          ? [
              'Kiểm tra lại tình trạng máy trước khi nhập kho sẵn sàng',
              'Cập nhật phụ kiện còn thiếu nếu có',
              'Ghi chú rõ nguồn nhập lại kho',
            ]
          : [];

  if (!items.length) return null;

  return (
    <div className="grid gap-2 rounded-lg border border-[#dbe5ef] bg-[#fafafa] p-3">
      <strong className="text-sm text-[#1f1f1f]">Checklist nghiệp vụ kho</strong>
      {items.map((item) => (
        <label className="flex items-start gap-2 text-sm leading-5 text-[#333333]" key={item}>
          <input className="mt-1" type="checkbox" />
          <span>{item}</span>
        </label>
      ))}
    </div>
  );
}

function LoadingRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <tr key={`loading-${rowIndex}`}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <td className={cellClass} key={columnIndex}>
              <span className="skeleton-line" style={{ width: `${columnIndex % 2 === 0 ? 74 : 52}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function EmptyRow({ columns }: { columns: number }) {
  return (
    <tr>
      <td colSpan={columns}>
        <div className="grid min-h-[180px] place-items-center content-center justify-center gap-2.5 text-center text-[#666666]">
          <Boxes className="rounded-lg border border-[#e4e4e7] bg-[#f4f4f5] p-2.5 text-[#18181b]" size={42} />
          <strong className="text-[15px] text-[#1f1f1f]">Chưa có dữ liệu phù hợp</strong>
        </div>
      </td>
    </tr>
  );
}

function machineSearchText(machine: Machine) {
  return [machine.machineCode, machine.serialNumber, machine.modelName, machine.name, machine.customer?.name, machine.inventoryStatus]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function compareInventoryMachines(a: Machine, b: Machine) {
  const priority = (machine: Machine) => {
    if (machine.inventoryStatus === 'RETURNED' && machine.status === 'REPAIRING') return 0;
    if (machine.inventoryStatus === 'RETURNED') return 1;
    if (machine.inventoryStatus === 'RESERVED') return 2;
    if (machine.inventoryStatus === 'IN_STOCK') return 3;
    if (machine.inventoryStatus === 'ACCESSORY_SPLIT') return 4;
    return 5;
  };
  const byPriority = priority(a) - priority(b);
  if (byPriority !== 0) return byPriority;
  return machineLabel(a).localeCompare(machineLabel(b));
}

function canInstallFromInventory(machine: Machine) {
  if (machine.status === 'REPAIRING') return false;
  return ['IN_STOCK', 'RESERVED'].includes(machine.inventoryStatus);
}

function machineLabel(machine: Machine) {
  return [machine.machineCode, machine.serialNumber, machine.modelName || machine.machineModel?.name || machine.name].filter(Boolean).join(' - ');
}

function customerLabel(customer: Customer) {
  return [customer.customerCode, customer.name, customer.province, customer.phone].filter(Boolean).join(' - ');
}

function normalizeInventoryTab(value: string | null): InventoryTab {
  if (value === 'installed' || value === 'history') return value;
  return 'stock';
}

function normalizeStatusFilter(value: string | null): StatusFilter {
  if (value === 'IN_STOCK' || value === 'RESERVED' || value === 'RETURNED' || value === 'ACCESSORY_SPLIT') return value;
  return 'ALL';
}

function buildInventorySearch(tab: InventoryTab, query: string) {
  const params = new URLSearchParams();
  if (tab !== 'stock') params.set('tab', tab);
  if (query.trim()) params.set('q', query.trim());
  const value = params.toString();
  return value ? `?${value}` : '';
}

const movementActions = {
  import: { label: 'Nhập lại kho sẵn sàng', type: 'IMPORT', toStatus: 'IN_STOCK', note: 'Đã kiểm tra và nhập lại kho sẵn sàng.' },
  reserve: { label: 'Giữ máy cho khách/dự án', type: 'RESERVE', toStatus: 'RESERVED', note: 'Giữ máy từ kho cho khách hàng/dự án.', requiresCustomer: true },
  return: { label: 'Thu hồi máy chờ kiểm tra', type: 'RETURN', toStatus: 'RETURNED', note: 'Thu hồi máy từ khách hàng, chờ kiểm tra tình trạng.', requiresCustomer: true },
  returnToCustomer: { label: 'Trả lại máy cho khách', type: 'INSTALL', toStatus: 'INSTALLED', note: 'Đã sửa/kiểm tra xong và trả lại máy cho khách hàng.', requiresCustomer: true },
  splitAccessory: { label: 'Tách phụ kiện khỏi máy', type: 'SPLIT_ACCESSORY', toStatus: 'ACCESSORY_SPLIT', note: 'Tách phụ kiện khỏi máy để quản lý riêng.' },
} satisfies Record<string, MovementAction>;

const cellClass = 'border-b border-[#eeeeee] px-4 py-3.5 text-left align-middle text-[#202939]';
const fieldClass = 'min-h-11 w-full rounded-lg border border-[#d6d6d6] bg-white px-3 font-sans text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]';
const statusToneClass = {
  good: 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]',
  warn: 'border-[#efd8a8] bg-[#fff8ed] text-[#9b5a17]',
  danger: 'border-[#fecdd3] bg-[#fff1f3] text-[#b5121b]',
  neutral: 'border-[#e5e5e5] bg-[#f4f7fb] text-[#333333]',
};

const summaryIconTone = {
  good: 'bg-[#eefaf3] text-[#177245]',
  warn: 'bg-[#fff8ed] text-[#9b5a17]',
  danger: 'bg-[#fff1f3] text-[#b5121b]',
  neutral: 'bg-[#fafafa] text-[#18181b]',
};

import { Download, Loader2, PenLine, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dispatch, FormEvent, SetStateAction, useMemo, useState } from 'react';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages } from '../../api';
import { getRoleName } from '../../auth/roles';
import { DateInput } from '../../components/DateInput';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { queryKeys } from '../../lib/queryKeys';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

type AccessoryStockRow = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  unitCost?: number | string | null;
  salePrice?: number | string | null;
  quantity?: number | string | null;
  currentStock?: number;
  stockValue?: number;
  requiresSerial?: boolean;
  sortOrder?: number | string | null;
  status?: 'ACTIVE' | 'INACTIVE' | string | null;
  machineModel?: {
    id: string;
    code?: string | null;
    name?: string | null;
    displayName?: string | null;
    businessLine?: { name?: string | null } | null;
  } | null;
  component?: { id: string; code?: string | null; name?: string | null } | null;
};

type StockMovementType = 'IMPORT' | 'EXPORT' | 'ADJUSTMENT';

type StockMovementRow = {
  id: string;
  code: string;
  type: StockMovementType;
  quantityDelta: number | string;
  unit?: string | null;
  serialNumber?: string | null;
  unitCost?: number | string | null;
  unitPrice?: number | string | null;
  totalCost?: number | string | null;
  totalPrice?: number | string | null;
  reason?: string | null;
  note?: string | null;
  occurredAt: string;
  componentAccessory?: AccessoryStockRow | null;
  machine?: {
    id: string;
    machineCode?: string | null;
    serialNumber?: string | null;
    modelName?: string | null;
  } | null;
  customer?: { id: string; name?: string | null; hospitalName?: string | null } | null;
  repair?: { id: string; code?: string | null; title?: string | null } | null;
  maintenance?: { id: string; code?: string | null; title?: string | null } | null;
  deviceServiceTicket?: { id: string; receiveCode?: string | null; returnCode?: string | null; deviceName?: string | null; modelName?: string | null } | null;
  createdBy?: { fullName?: string | null; email?: string | null } | null;
};

type MachineOption = {
  id: string;
  machineCode?: string | null;
  serialNumber?: string | null;
  modelName?: string | null;
  customer?: { id: string; name?: string | null; hospitalName?: string | null } | null;
};

type CustomerOption = {
  id: string;
  name?: string | null;
  hospitalName?: string | null;
};

type MachineModelOption = {
  id: string;
  code?: string | null;
  name?: string | null;
  displayName?: string | null;
};

type CatalogAccessoryForm = {
  id?: string;
  machineModelId: string;
  code: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  requiresSerial: boolean;
  unitCost: number;
  salePrice: number;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
};

type MovementForm = {
  componentAccessoryId: string;
  customerId: string;
  machineId: string;
  note: string;
  occurredAt: string;
  quantity: number;
  quantityDelta: number;
  reason: string;
  serialNumber: string;
  type: StockMovementType;
  unit: string;
  unitCost: number;
  unitPrice: number;
};

type UsedPartsSummary = {
  totals: {
    parts: number;
    totalCost: number;
    totalRevenue: number;
    grossProfit: number;
    waiting: number;
    used: number;
  };
  byEngineer: Array<{
    engineerId: string;
    engineerName: string;
    quantity: number;
    totalCost: number;
    totalRevenue: number;
    grossProfit: number;
    waiting: number;
    used: number;
  }>;
};

const movementTypes: StockMovementType[] = ['IMPORT', 'EXPORT', 'ADJUSTMENT'];
const accessoryUnits = ['cái', 'bộ', 'chiếc', 'cặp', 'sợi', 'dây', 'ống', 'lọ', 'hộp', 'gói', 'kit', 'test', 'cuộn', 'mét'];

export function AccessoryInventoryPage({ user }: { user: ApiUser }) {
  const queryClient = useQueryClient();
  const role = getRoleName(user);
  const canManageAccessories = role === 'admin';
  const [activeTab, setActiveTab] = useState<'stock' | 'catalog' | 'history'>('catalog');
  const [search, setSearch] = useState('');
  const [movementSearch, setMovementSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const debouncedMovementSearch = useDebouncedValue(movementSearch);
  const [revenueFrom, setRevenueFrom] = useState(() => toDateInput(startOfMonth(new Date())));
  const [revenueTo, setRevenueTo] = useState(() => toDateInput(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [showSalesSummary, setShowSalesSummary] = useState(false);
  const [form, setForm] = useState<MovementForm>(() => emptyMovementForm());
  const [catalogForm, setCatalogForm] = useState<CatalogAccessoryForm | null>(null);
  const params = new URLSearchParams({ limit: '100' });
  if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
  const movementParams = new URLSearchParams({ limit: '100' });
  if (debouncedMovementSearch.trim()) movementParams.set('search', debouncedMovementSearch.trim());
  const revenueParams = new URLSearchParams({ from: revenueFrom, to: revenueTo });

  const stockQuery = useQuery({
    queryKey: queryKeys.accessoryInventory.stock(params.toString()),
    queryFn: async () => apiFetch<Paginated<AccessoryStockRow>>(`/accessory-inventory?${params.toString()}`),
  });

  const movementsQuery = useQuery({
    queryKey: queryKeys.accessoryInventory.movements(movementParams.toString()),
    queryFn: async () => apiFetch<Paginated<StockMovementRow>>(`/accessory-inventory/movements?${movementParams.toString()}`),
  });

  const optionsQuery = useQuery({
    queryKey: queryKeys.accessoryInventory.options,
    queryFn: async () => {
      const [accessories, machines, customers, machineModels] = await Promise.all([
        apiFetchAllPages<AccessoryStockRow>('/component-accessories'),
        apiFetchAllPages<MachineOption>('/machines'),
        apiFetchAllPages<CustomerOption>('/customers'),
        apiFetchAllPages<MachineModelOption>('/machine-models'),
      ]);
      return {
        accessories,
        machines,
        customers,
        machineModels,
      };
    },
  });

  const usedPartsSummaryQuery = useQuery({
    enabled: canManageAccessories && activeTab === 'stock' && showSalesSummary,
    queryKey: ['work-operations', 'used-parts-summary', revenueParams.toString()],
    queryFn: async () => apiFetch<UsedPartsSummary>(`/work-operations/used-parts/summary?${revenueParams.toString()}`),
  });

  const createMovementMutation = useMutation({
    mutationFn: () =>
      apiFetch('/accessory-inventory/movements', {
        method: 'POST',
        body: JSON.stringify(normalizeMovementPayload(form)),
      }),
    onSuccess: async () => {
      setForm(emptyMovementForm());
      setShowForm(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accessory-inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['service-tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['product-catalog'] }),
      ]);
    },
  });

  const createAccessoryMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof normalizeCatalogPayload>) =>
      apiFetch('/component-accessories', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      setCatalogForm(null);
      await refreshAccessoryData(queryClient);
    },
  });

  const updateAccessoryMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReturnType<typeof normalizeCatalogPayload> }) =>
      apiFetch(`/component-accessories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      setCatalogForm(null);
      await refreshAccessoryData(queryClient);
    },
  });

  const deleteAccessoryMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/component-accessories/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await refreshAccessoryData(queryClient);
    },
  });

  const stockRows = stockQuery.data?.data ?? [];
  const movementRows = movementsQuery.data?.data ?? [];
  const accessories = optionsQuery.data?.accessories ?? [];
  const machines = optionsQuery.data?.machines ?? [];
  const customers = optionsQuery.data?.customers ?? [];
  const machineModels = optionsQuery.data?.machineModels ?? [];
  const usedPartsSummary = usedPartsSummaryQuery.data ?? null;
  const catalogError =
    createAccessoryMutation.error ||
    updateAccessoryMutation.error ||
    deleteAccessoryMutation.error;
  const isSavingCatalog = createAccessoryMutation.isPending || updateAccessoryMutation.isPending;
  const totals = useMemo(
    () => ({
      accessories: stockRows.length,
      stock: stockRows.reduce((sum, row) => sum + Number(row.currentStock || 0), 0),
      value: stockRows.reduce((sum, row) => sum + Number(row.stockValue || 0), 0),
      low: stockRows.filter((row) => Number(row.currentStock || 0) <= 0).length,
    }),
    [stockRows],
  );

  function selectAccessory(accessoryId: string) {
    const accessory = accessories.find((item) => item.id === accessoryId) || stockRows.find((item) => item.id === accessoryId);
    setForm((current) => ({
      ...current,
      componentAccessoryId: accessoryId,
      unit: accessory?.unit || current.unit || 'cái',
      unitCost: Number(accessory?.unitCost || 0),
      unitPrice: Number(accessory?.salePrice || 0),
    }));
  }

  function selectMachine(machineId: string) {
    const machine = machines.find((item) => item.id === machineId);
    setForm((current) => ({
      ...current,
      machineId,
      customerId: machine?.customer?.id || current.customerId,
    }));
  }

  function submitMovement(event: FormEvent) {
    event.preventDefault();
    createMovementMutation.mutate();
  }

  function openCreateAccessory() {
    setCatalogForm(emptyCatalogForm());
    setActiveTab('catalog');
  }

  function openEditAccessory(row: AccessoryStockRow) {
    setCatalogForm(catalogFormFromRow(row));
    setActiveTab('catalog');
  }

  function submitAccessory(event: FormEvent) {
    event.preventDefault();
    if (!catalogForm) return;
    const payload = normalizeCatalogPayload(catalogForm);
    if (catalogForm.id) {
      updateAccessoryMutation.mutate({ id: catalogForm.id, payload });
    } else {
      createAccessoryMutation.mutate(payload);
    }
  }

  function deleteAccessory(row: AccessoryStockRow) {
    const ok = window.confirm(`Xóa phụ kiện "${row.name}"? Chỉ xóa được khi phụ kiện chưa có lịch sử kho, sửa chữa hoặc bảo trì.`);
    if (!ok) return;
    deleteAccessoryMutation.mutate(row.id);
  }

  return (
    <PageFrame>
      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PageTitle eyebrow="Phụ kiện" title="Quản lý linh kiện thay thế" />
          <div className="flex flex-wrap gap-2">
            <Button disabled={stockQuery.isFetching || movementsQuery.isFetching} onClick={() => void Promise.all([stockQuery.refetch(), movementsQuery.refetch()])} type="button" variant="outline">
              {stockQuery.isFetching || movementsQuery.isFetching ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
              Làm mới
            </Button>
            {activeTab === 'stock' ? (
              <Button onClick={() => setShowForm((value) => !value)} type="button">
                <Plus size={16} />
                Tạo phiếu kho
              </Button>
            ) : null}
            {activeTab === 'history' ? (
              <Button disabled={!movementRows.length} onClick={() => exportMovementsCsv(movementRows)} type="button" variant="outline">
                <Download size={16} />
                Xuất lịch sử
              </Button>
            ) : null}
          </div>
        </div>

        <Card className="p-1.5">
          <div className="grid gap-2 md:grid-cols-3">
            <TabButton active={activeTab === 'catalog'} label="Danh mục phụ kiện" onClick={() => setActiveTab('catalog')} />
            <TabButton active={activeTab === 'stock'} label="Tồn kho" onClick={() => setActiveTab('stock')} />
            <TabButton active={activeTab === 'history'} label="Lịch sử phát sinh" onClick={() => setActiveTab('history')} />
          </div>
        </Card>

        {!canManageAccessories && activeTab === 'catalog' ? (
          <Notice message="Tài khoản của bạn được xem danh mục phụ kiện. Thao tác thêm, sửa, xóa chỉ dành cho admin." />
        ) : null}

        {activeTab === 'stock' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InventoryMetric label="Mặt hàng" value={totals.accessories} />
            <InventoryMetric label="Tổng số lượng" value={formatQuantity(totals.stock)} />
            <InventoryMetric label="Giá trị tồn kho" value={formatMoney(totals.value)} />
            <InventoryMetric label="Đang hết hàng" tone="warn" value={totals.low} />
          </div>
        ) : null}

        {createMovementMutation.error instanceof Error ? <Notice message={createMovementMutation.error.message} /> : null}
        {catalogError instanceof Error ? <Notice message={catalogError.message} /> : null}
        {stockQuery.error instanceof Error ? <Notice message={stockQuery.error.message} /> : null}
        {movementsQuery.error instanceof Error ? <Notice message={movementsQuery.error.message} /> : null}
        {usedPartsSummaryQuery.error instanceof Error ? <Notice message={usedPartsSummaryQuery.error.message} /> : null}

        {canManageAccessories && activeTab === 'stock' ? (
          <div className="grid gap-3">
            <Button className="justify-self-start" onClick={() => setShowSalesSummary((value) => !value)} type="button" variant="outline">
              {showSalesSummary ? 'Ẩn báo cáo linh kiện thay thế' : 'Xem báo cáo linh kiện thay thế'}
            </Button>
            {showSalesSummary ? (
          <Card className="grid gap-4 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Badge variant="outline">Theo dõi</Badge>
                <h2 className="mt-2 text-lg font-semibold text-[#202124]">Doanh số thay thế linh kiện</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-[160px_160px_auto]">
                <DateInput label="Từ ngày" onChange={setRevenueFrom} value={revenueFrom} />
                <DateInput label="Đến ngày" onChange={setRevenueTo} value={revenueTo} />
                <Button className="self-end" disabled={usedPartsSummaryQuery.isFetching} onClick={() => void usedPartsSummaryQuery.refetch()} type="button" variant="outline">
                  {usedPartsSummaryQuery.isFetching ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
                  Cập nhật
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <InventoryMetric label="Linh kiện đã thay" value={formatQuantity(usedPartsSummary?.totals.parts ?? 0)} />
              <InventoryMetric label="Doanh thu" value={formatMoney(usedPartsSummary?.totals.totalRevenue ?? 0)} />
              <InventoryMetric label="Giá vốn" value={formatMoney(usedPartsSummary?.totals.totalCost ?? 0)} />
              <InventoryMetric label="Lãi gộp" tone={(usedPartsSummary?.totals.grossProfit ?? 0) < 0 ? 'warn' : 'neutral'} value={formatMoney(usedPartsSummary?.totals.grossProfit ?? 0)} />
            </div>
            {usedPartsSummary?.byEngineer?.length ? (
              <div className="overflow-hidden rounded-[18px] border border-[#eef0f3]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-[#fafafa] text-xs uppercase text-[#667085]">
                      <tr>
                        <th className="border-b border-[#eef0f3] px-4 py-3">Kỹ sư</th>
                        <th className="border-b border-[#eef0f3] px-4 py-3">Số lượng</th>
                        <th className="border-b border-[#eef0f3] px-4 py-3">Doanh thu</th>
                        <th className="border-b border-[#eef0f3] px-4 py-3">Giá vốn</th>
                        <th className="border-b border-[#eef0f3] px-4 py-3">Lãi gộp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usedPartsSummary.byEngineer.slice(0, 5).map((engineer) => (
                        <tr className="hover:bg-[#fafafa]" key={engineer.engineerId}>
                          <td className="border-b border-[#f1f2f4] px-4 py-3 font-semibold text-[#202124]">{engineer.engineerName}</td>
                          <td className="border-b border-[#f1f2f4] px-4 py-3">{formatQuantity(engineer.quantity)}</td>
                          <td className="border-b border-[#f1f2f4] px-4 py-3">{formatMoney(engineer.totalRevenue)}</td>
                          <td className="border-b border-[#f1f2f4] px-4 py-3">{formatMoney(engineer.totalCost)}</td>
                          <td className="border-b border-[#f1f2f4] px-4 py-3 font-semibold text-[#202124]">{formatMoney(engineer.grossProfit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-[#fafafa] p-4 text-sm font-semibold text-[#667085]">Chưa có linh kiện thay thế trong khoảng này.</div>
            )}
          </Card>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'stock' && showForm ? (
          <form className="grid gap-4 rounded-[24px] border border-[#dbe6f3] bg-[#fbfdff] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]" onSubmit={submitMovement}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[#202124]">Phiếu kho phụ kiện</h2>
              </div>
              <span className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-[#3e8375] shadow-[inset_0_0_0_1px_rgba(62,131,117,0.18)]">
                {movementTypeLabel(form.type)}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className={fieldLabelClass}>
                Loại phát sinh
                <select className={fieldClass} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as StockMovementType }))} value={form.type}>
                  {movementTypes.map((type) => (
                    <option key={type} value={type}>{movementTypeLabel(type)}</option>
                  ))}
                </select>
              </label>
              <DateInput label="Ngày phát sinh" onChange={(value) => setForm((current) => ({ ...current, occurredAt: value }))} value={form.occurredAt} />
              <label className={`${fieldLabelClass} xl:col-span-2`}>
                Phụ kiện
                <select className={fieldClass} onChange={(event) => selectAccessory(event.target.value)} required value={form.componentAccessoryId}>
                  <option value="">Chọn phụ kiện</option>
                  {accessories.map((accessory) => (
                    <option key={accessory.id} value={accessory.id}>
                      {[accessory.code, accessory.name, accessory.machineModel?.displayName || accessory.machineModel?.name].filter(Boolean).join(' - ')}
                    </option>
                  ))}
                </select>
              </label>
              {form.type === 'ADJUSTMENT' ? (
                <NumberInput label="Tăng/giảm tồn" onChange={(value) => setForm((current) => ({ ...current, quantityDelta: value }))} value={form.quantityDelta} />
              ) : (
                <NumberInput label="Số lượng" min={0.01} onChange={(value) => setForm((current) => ({ ...current, quantity: value }))} value={form.quantity} />
              )}
              <TextInput label="Đơn vị" onChange={(value) => setForm((current) => ({ ...current, unit: value }))} value={form.unit} />
              <NumberInput label="Giá vốn" min={0} onChange={(value) => setForm((current) => ({ ...current, unitCost: value }))} value={form.unitCost} />
              <NumberInput label="Giá bán" min={0} onChange={(value) => setForm((current) => ({ ...current, unitPrice: value }))} value={form.unitPrice} />
              <TextInput label="Serial linh kiện" onChange={(value) => setForm((current) => ({ ...current, serialNumber: value }))} value={form.serialNumber} />
              <label className={fieldLabelClass}>
                Gắn máy
                <select className={fieldClass} onChange={(event) => selectMachine(event.target.value)} value={form.machineId}>
                  <option value="">Không gắn máy</option>
                  {machines.map((machine) => (
                    <option key={machine.id} value={machine.id}>{machineLabel(machine)}</option>
                  ))}
                </select>
              </label>
              <label className={fieldLabelClass}>
                Khách hàng
                <select className={fieldClass} onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))} value={form.customerId}>
                  <option value="">Không gắn khách</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customerLabel(customer)}</option>
                  ))}
                </select>
              </label>
              <TextInput label="Lý do" onChange={(value) => setForm((current) => ({ ...current, reason: value }))} value={form.reason} wide />
              <TextInput label="Ghi chú" onChange={(value) => setForm((current) => ({ ...current, note: value }))} value={form.note} wide />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="secondary-button" onClick={() => setShowForm(false)} type="button">Hủy</button>
              <button className="primary-button" disabled={createMovementMutation.isPending} type="submit">
                {createMovementMutation.isPending ? <Loader2 className="spin-icon" size={16} /> : null}
                Lưu phát sinh
              </button>
            </div>
          </form>
        ) : null}

        {activeTab === 'stock' ? (
        <section className="grid gap-3 rounded-[24px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07),0_12px_30px_rgba(24,24,27,0.05)]">
          <div className="grid gap-3 min-[900px]:grid-cols-[minmax(0,1fr)_auto] min-[900px]:items-end">
            <label className="operation-filter-field">
              <span>Tìm tồn kho</span>
              <input onChange={(event) => setSearch(event.target.value)} placeholder="Mã phụ kiện, tên, model..." value={search} />
            </label>
            <Button disabled={!stockRows.length} onClick={() => exportStockCsv(stockRows)} type="button" variant="outline">
              <Download size={16} />
              Xuất CSV
            </Button>
          </div>
          <div className="overflow-hidden rounded-[20px] border border-[#eef0f3]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-[#fafafa] text-xs uppercase text-[#667085]">
                  <tr>
                    <th className="border-b border-[#eef0f3] px-4 py-3">Phụ kiện</th>
                    <th className="border-b border-[#eef0f3] px-4 py-3">Model</th>
                    <th className="border-b border-[#eef0f3] px-4 py-3">Tồn</th>
                    <th className="border-b border-[#eef0f3] px-4 py-3">Giá vốn</th>
                    <th className="border-b border-[#eef0f3] px-4 py-3">Giá bán</th>
                    <th className="border-b border-[#eef0f3] px-4 py-3">Giá trị tồn</th>
                  </tr>
                </thead>
                <tbody>
                  {stockQuery.isLoading ? <TableMessage colSpan={6} text="Đang tải tồn kho" /> : null}
                  {!stockQuery.isLoading && !stockRows.length ? <TableMessage colSpan={6} text="Chưa có phụ kiện phù hợp." /> : null}
                  {stockRows.map((row) => (
                    <tr className="hover:bg-[#fafafa]" key={row.id}>
                      <td className="border-b border-[#f1f2f4] px-4 py-3">
                        <strong className="block text-[#202124]">{row.name}</strong>
                        <span className="text-xs font-semibold text-[#667085]">{row.code}</span>
                      </td>
                      <td className="border-b border-[#f1f2f4] px-4 py-3">{row.machineModel?.displayName || row.machineModel?.name || '-'}</td>
                      <td className="border-b border-[#f1f2f4] px-4 py-3">
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${Number(row.currentStock || 0) > 0 ? 'bg-[#eefaf3] text-[#177245]' : 'bg-[#fff5f5] text-[#b5121b]'}`}>
                          {formatQuantity(row.currentStock || 0)} {row.unit || 'cái'}
                        </span>
                      </td>
                      <td className="border-b border-[#f1f2f4] px-4 py-3">{formatMoney(Number(row.unitCost || 0))}</td>
                      <td className="border-b border-[#f1f2f4] px-4 py-3">{formatMoney(Number(row.salePrice || 0))}</td>
                      <td className="border-b border-[#f1f2f4] px-4 py-3 font-semibold text-[#202124]">{formatMoney(Number(row.stockValue || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        ) : null}

        {activeTab === 'catalog' ? (
        <CatalogSection
          canManageAccessories={canManageAccessories}
          onCreate={openCreateAccessory}
          onDelete={deleteAccessory}
          onEdit={openEditAccessory}
          rows={stockRows}
          search={search}
          setSearch={setSearch}
          stockQueryLoading={stockQuery.isLoading}
        />
        ) : null}

        {activeTab === 'history' ? (
        <section className="grid gap-3 rounded-[24px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07),0_12px_30px_rgba(24,24,27,0.05)]">
          <label className="operation-filter-field">
            <span>Tìm lịch sử phát sinh</span>
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8f99]" size={16} />
              <input className="pl-9" onChange={(event) => setMovementSearch(event.target.value)} placeholder="Mã phiếu, serial, máy, khách..." value={movementSearch} />
            </span>
          </label>
          <div className="grid gap-2">
            {movementsQuery.isLoading ? <div className="py-10 text-center text-sm font-semibold text-[#667085]">Đang tải lịch sử kho</div> : null}
            {!movementsQuery.isLoading && !movementRows.length ? <div className="py-10 text-center text-sm font-semibold text-[#667085]">Chưa có phát sinh kho.</div> : null}
            {movementRows.map((movement) => (
              <MovementCard movement={movement} key={movement.id} />
            ))}
          </div>
        </section>
        ) : null}

        {catalogForm ? (
          <CatalogAccessoryModal
            form={catalogForm}
            isSaving={isSavingCatalog}
            machineModels={machineModels}
            onClose={() => setCatalogForm(null)}
            onSubmit={submitAccessory}
            setForm={setCatalogForm}
          />
        ) : null}
      </section>
    </PageFrame>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`min-h-11 rounded-md px-4 py-3 text-center text-sm font-semibold outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/35 ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-transparent text-[#344054] hover:bg-accent'}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function CatalogSection({
  canManageAccessories,
  onCreate,
  onDelete,
  onEdit,
  rows,
  search,
  setSearch,
  stockQueryLoading,
}: {
  canManageAccessories: boolean;
  onCreate: () => void;
  onDelete: (row: AccessoryStockRow) => void;
  onEdit: (row: AccessoryStockRow) => void;
  rows: AccessoryStockRow[];
  search: string;
  setSearch: (value: string) => void;
  stockQueryLoading: boolean;
}) {
  return (
    <section className="grid gap-4 rounded-[24px] border border-[#e8ebef] bg-white p-4 shadow-[0_12px_30px_rgba(24,24,27,0.035)] sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[#202124]">Danh mục phụ kiện</h2>
        </div>
        {canManageAccessories ? (
          <Button onClick={onCreate} type="button"><Plus size={16} />Thêm phụ kiện</Button>
        ) : null}
      </div>
      <label className="relative block w-full max-w-xl">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8f99]" size={17} />
        <Input aria-label="Tìm phụ kiện" className="pl-10" onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo mã, tên hoặc model" value={search} />
      </label>
      {stockQueryLoading ? (
        <div className="rounded-2xl border border-dashed border-[#d9dee5] px-4 py-12 text-center text-sm text-[#667085]">Đang tải danh mục…</div>
      ) : !rows.length ? (
        <div className="rounded-2xl border border-dashed border-[#d9dee5] px-4 py-12 text-center">
          <p className="font-semibold text-[#344054]">{search ? 'Không tìm thấy phụ kiện phù hợp' : 'Danh mục chưa có phụ kiện'}</p>
          {canManageAccessories && !search ? <Button className="mt-4" onClick={onCreate} type="button" variant="outline"><Plus size={16} />Thêm phụ kiện đầu tiên</Button> : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {rows.map((row) => {
            const stock = Number(row.currentStock || 0);
            return (
              <article className="grid min-w-0 gap-4 rounded-2xl border border-[#e8ebef] bg-[#fff] p-4 transition-colors hover:border-[#cad5df]" key={row.id}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold leading-5 text-[#202124]">{row.name}</h3>
                    <p className="mt-1 truncate text-xs font-medium tracking-wide text-[#667085]">{row.code}</p>
                  </div>
                  <Badge className="shrink-0" variant={row.status === 'INACTIVE' ? 'secondary' : 'outline'}>{row.status === 'INACTIVE' ? 'Ngừng dùng' : 'Đang dùng'}</Badge>
                </div>
                <div className="grid gap-1 border-t border-[#f0f1f3] pt-3 text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-[#8a8f99]">Model máy</span>
                  <span className="break-words font-medium text-[#344054]">{modelLabel(row.machineModel)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#f7f8fa] p-3">
                  <div><span className="block text-xs text-[#667085]">Tồn kho</span><strong className={`mt-1 block ${stock > 0 ? 'text-[#177245]' : 'text-[#b5121b]'}`}>{formatQuantity(stock)} {row.unit || 'cái'}</strong></div>
                  <div><span className="block text-xs text-[#667085]">Đơn vị chuẩn</span><strong className="mt-1 block text-[#344054]">{formatQuantity(Number(row.quantity || 1))} {row.unit || 'cái'}</strong></div>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="text-xs leading-5 text-[#667085]">Giá vốn {formatMoney(Number(row.unitCost || 0))}<br />Giá bán {formatMoney(Number(row.salePrice || 0))}</div>
                  {canManageAccessories ? <div className="flex gap-2">
                    <Button aria-label={`Sửa ${row.name}`} onClick={() => onEdit(row)} size="sm" type="button" variant="outline"><PenLine size={14} />Sửa</Button>
                    <Button aria-label={`Xóa ${row.name}`} onClick={() => onDelete(row)} size="sm" type="button" variant="destructive"><Trash2 size={14} />Xóa</Button>
                  </div> : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function modelLabel(model?: MachineModelOption | null) {
  return [model?.code, model?.displayName || model?.name].filter(Boolean).join(' - ') || 'Chưa chọn model';
}

function CatalogAccessoryModal({
  form,
  isSaving,
  machineModels,
  onClose,
  onSubmit,
  setForm,
}: {
  form: CatalogAccessoryForm;
  isSaving: boolean;
  machineModels: MachineModelOption[];
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  setForm: Dispatch<SetStateAction<CatalogAccessoryForm | null>>;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#111827]/35 px-4 py-6" onClick={onClose}>
      <form className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-border bg-card p-5 text-card-foreground shadow-[0_24px_80px_rgba(15,23,42,0.24)]" onClick={(event) => event.stopPropagation()} onSubmit={onSubmit}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[#202124]">{form.id ? 'Sửa phụ kiện' : 'Thêm phụ kiện'}</h2>
          </div>
          <Button onClick={onClose} type="button" title="Đóng" variant="outline">
            <X size={16} />
            Đóng
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className={fieldLabelClass}>
            Model máy
            <select className={fieldClass} onChange={(event) => setForm((current) => current ? { ...current, machineModelId: event.target.value } : current)} required value={form.machineModelId}>
              <option value="">Chọn model</option>
              {machineModels.map((model) => (
                <option key={model.id} value={model.id}>{[model.code, model.displayName || model.name].filter(Boolean).join(' - ')}</option>
              ))}
            </select>
          </label>
          <TextInput label="Mã phụ kiện" onChange={(value) => setForm((current) => current ? { ...current, code: value } : current)} value={form.code} />
          <TextInput label="Tên phụ kiện" onChange={(value) => setForm((current) => current ? { ...current, name: value } : current)} required value={form.name} />
          <UnitSelect label="Đơn vị tính" onChange={(value) => setForm((current) => current ? { ...current, unit: value } : current)} value={form.unit} />
          <NumberInput label="Số lượng chuẩn" min={1} onChange={(value) => setForm((current) => current ? { ...current, quantity: value } : current)} value={form.quantity} />
          <NumberInput label="Giá vốn" min={0} onChange={(value) => setForm((current) => current ? { ...current, unitCost: value } : current)} value={form.unitCost} />
          <NumberInput label="Giá bán" min={0} onChange={(value) => setForm((current) => current ? { ...current, salePrice: value } : current)} value={form.salePrice} />
          <label className={fieldLabelClass}>
            Trạng thái
            <select className={fieldClass} onChange={(event) => setForm((current) => current ? { ...current, status: event.target.value as CatalogAccessoryForm['status'] } : current)} value={form.status}>
              <option value="ACTIVE">Đang dùng</option>
              <option value="INACTIVE">Ngưng dùng</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[#d7dce5] bg-white px-3 text-sm font-semibold text-[#3f4654]">
            <input checked={form.requiresSerial} className="h-4 w-4 accent-[#3e8375]" onChange={(event) => setForm((current) => current ? { ...current, requiresSerial: event.target.checked } : current)} type="checkbox" />
            Cần serial khi thay thế
          </label>
          <TextInput label="Ghi chú" onChange={(value) => setForm((current) => current ? { ...current, description: value } : current)} value={form.description} wide />
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">Hủy</Button>
          <Button disabled={isSaving} type="submit">
            {isSaving ? <Loader2 className="spin-icon" size={16} /> : null}
            Lưu phụ kiện
          </Button>
        </div>
      </form>
    </div>
  );
}

function MovementCard({ movement }: { movement: StockMovementRow }) {
  const quantity = Number(movement.quantityDelta || 0);
  return (
    <article className="grid gap-3 rounded-[18px] bg-[#fafafa] p-4 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.06)] min-[980px]:grid-cols-[minmax(0,1fr)_180px_220px] min-[980px]:items-center">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${movementTypeTone(movement.type)}`}>{movementTypeLabel(movement.type)}</span>
          <span className="text-xs font-semibold text-[#667085]">{movement.code}</span>
        </div>
        <h3 className="truncate text-base font-semibold text-[#202124]">{movement.componentAccessory?.name || 'Phụ kiện'}</h3>
        <p className="mt-1 text-sm font-medium text-[#667085]">
          {[movement.componentAccessory?.code, movement.componentAccessory?.machineModel?.displayName || movement.componentAccessory?.machineModel?.name, movement.serialNumber ? `S/N ${movement.serialNumber}` : ''].filter(Boolean).join(' - ')}
        </p>
        <p className="mt-1 text-sm text-[#667085]">{movement.reason || movement.note || '-'}</p>
      </div>
      <div className="grid gap-1 text-sm text-[#667085]">
        <span>Ngày: <strong className="text-[#202124]">{formatDate(movement.occurredAt)}</strong></span>
        <span>Số lượng: <strong className={quantity < 0 ? 'text-[#b5121b]' : 'text-[#177245]'}>{quantity > 0 ? '+' : ''}{formatQuantity(quantity)} {movement.unit || ''}</strong></span>
        <span>Giá bán: <strong className="text-[#202124]">{formatMoney(Number(movement.totalPrice || 0))}</strong></span>
      </div>
      <div className="grid gap-1 text-sm text-[#667085]">
        <span>Máy: <strong className="text-[#202124]">{movement.machine ? machineLabel(movement.machine) : '-'}</strong></span>
        <span>Khách: <strong className="text-[#202124]">{movement.customer ? customerLabel(movement.customer) : '-'}</strong></span>
        <span>Phiếu: <strong className="text-[#202124]">{movementSourceLabel(movement)}</strong></span>
      </div>
    </article>
  );
}

function InventoryMetric({ label, tone = 'neutral', value }: { label: string; tone?: 'neutral' | 'warn'; value: number | string }) {
  return (
    <div className={`rounded-[18px] border p-4 ${tone === 'warn' ? 'border-[#f2d5d8] bg-[#fff8f8]' : 'border-[#e4e4e7] bg-white'}`}>
      <span className="text-xs font-semibold text-[#667085]">{label}</span>
      <strong className="mt-1 block text-2xl leading-none text-[#202124]">{value}</strong>
    </div>
  );
}

function TextInput({ label, onChange, required, value, wide }: { label: string; onChange: (value: string) => void; required?: boolean; value: string; wide?: boolean }) {
  return (
    <label className={`${fieldLabelClass} ${wide ? 'md:col-span-2' : ''}`}>
      {label}
      <Input onChange={(event) => onChange(event.target.value)} required={required} value={value} />
    </label>
  );
}

function NumberInput({ label, min, onChange, value }: { label: string; min?: number; onChange: (value: number) => void; value: number }) {
  return (
    <label className={fieldLabelClass}>
      {label}
      <Input min={min} onChange={(event) => onChange(Number(event.target.value))} step={0.01} type="number" value={value} />
    </label>
  );
}

function UnitSelect({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className={fieldLabelClass}>
      {label}
      <select className={fieldClass} onChange={(event) => onChange(event.target.value)} value={value || 'cái'}>
        {accessoryUnits.map((unit) => (
          <option key={unit} value={unit}>{unit}</option>
        ))}
      </select>
    </label>
  );
}

function TableMessage({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td className="px-4 py-8 text-center text-sm font-semibold text-[#667085]" colSpan={colSpan}>
        {text}
      </td>
    </tr>
  );
}

function emptyMovementForm(): MovementForm {
  return {
    componentAccessoryId: '',
    customerId: '',
    machineId: '',
    note: '',
    occurredAt: toDateInput(new Date()),
    quantity: 1,
    quantityDelta: 0,
    reason: '',
    serialNumber: '',
    type: 'IMPORT',
    unit: 'cái',
    unitCost: 0,
    unitPrice: 0,
  };
}

function normalizeMovementPayload(form: MovementForm) {
  return Object.fromEntries(
    Object.entries({
      componentAccessoryId: form.componentAccessoryId,
      customerId: form.customerId || undefined,
      machineId: form.machineId || undefined,
      note: form.note.trim() || undefined,
      occurredAt: form.occurredAt,
      quantity: form.type === 'ADJUSTMENT' ? undefined : Number(form.quantity || 0),
      quantityDelta: form.type === 'ADJUSTMENT' ? Number(form.quantityDelta || 0) : undefined,
      reason: form.reason.trim() || undefined,
      serialNumber: form.serialNumber.trim() || undefined,
      type: form.type,
      unit: form.unit.trim() || 'cái',
      unitCost: Number(form.unitCost || 0),
      unitPrice: Number(form.unitPrice || 0),
    }).filter(([, value]) => value !== undefined && value !== ''),
  );
}

function emptyCatalogForm(): CatalogAccessoryForm {
  return {
    code: '',
    description: '',
    machineModelId: '',
    name: '',
    quantity: 1,
    requiresSerial: true,
    salePrice: 0,
    sortOrder: 0,
    status: 'ACTIVE',
    unit: 'cái',
    unitCost: 0,
  };
}

function catalogFormFromRow(row: AccessoryStockRow): CatalogAccessoryForm {
  return {
    id: row.id,
    code: row.code || '',
    description: row.description || '',
    machineModelId: row.machineModel?.id || '',
    name: row.name || '',
    quantity: Number(row.quantity || 1),
    requiresSerial: row.requiresSerial ?? true,
    salePrice: Number(row.salePrice || 0),
    sortOrder: Number(row.sortOrder || 0),
    status: row.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    unit: row.unit || 'cái',
    unitCost: Number(row.unitCost || 0),
  };
}

function normalizeCatalogPayload(form: CatalogAccessoryForm) {
  return Object.fromEntries(
    Object.entries({
      code: form.code.trim() || undefined,
      componentId: null,
      description: form.description.trim() || null,
      machineModelId: form.machineModelId,
      name: form.name.trim(),
      quantity: Number(form.quantity || 1),
      requiresSerial: form.requiresSerial,
      salePrice: Number(form.salePrice || 0),
      sortOrder: Number(form.sortOrder || 0),
      status: form.status,
      unit: form.unit.trim() || 'cái',
      unitCost: Number(form.unitCost || 0),
    }).filter(([, value]) => value !== undefined && value !== ''),
  );
}

async function refreshAccessoryData(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['accessory-inventory'] }),
    queryClient.invalidateQueries({ queryKey: ['component-accessories'] }),
    queryClient.invalidateQueries({ queryKey: ['product-catalog'] }),
  ]);
}

function movementTypeLabel(type: StockMovementType) {
  if (type === 'IMPORT') return 'Nhập kho';
  if (type === 'EXPORT') return 'Xuất kho';
  return 'Điều chỉnh tồn';
}

function movementTypeTone(type: StockMovementType) {
  if (type === 'IMPORT') return 'bg-[#eefaf3] text-[#177245]';
  if (type === 'EXPORT') return 'bg-[#fff5f5] text-[#b5121b]';
  return 'bg-[#eef6ff] text-[#255e9b]';
}

function movementSourceLabel(movement: StockMovementRow) {
  if (movement.repair?.code) return movement.repair.code;
  if (movement.maintenance?.code) return movement.maintenance.code;
  if (movement.deviceServiceTicket?.returnCode || movement.deviceServiceTicket?.receiveCode) return movement.deviceServiceTicket.returnCode || movement.deviceServiceTicket.receiveCode;
  return '-';
}

function machineLabel(machine: MachineOption | NonNullable<StockMovementRow['machine']>) {
  return [machine.machineCode, machine.modelName, machine.serialNumber ? `S/N ${machine.serialNumber}` : ''].filter(Boolean).join(' - ') || 'Máy';
}

function customerLabel(customer: CustomerOption | NonNullable<StockMovementRow['customer']>) {
  return customer.name || customer.hospitalName || 'Khách hàng';
}

function formatMoney(value: number) {
  if (!value) return '0 đ';
  return new Intl.NumberFormat('vi-VN', {
    currency: 'VND',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function exportStockCsv(rows: AccessoryStockRow[]) {
  const header = ['Mã', 'Phụ kiện', 'Model', 'Tồn', 'Đơn vị', 'Giá vốn', 'Giá bán', 'Giá trị tồn'];
  const body = rows.map((row) => [
    row.code,
    row.name,
    row.machineModel?.displayName || row.machineModel?.name || '',
    row.currentStock || 0,
    row.unit || '',
    row.unitCost || 0,
    row.salePrice || 0,
    row.stockValue || 0,
  ]);
  const csv = [header, ...body].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `kho-phu-kien-${toDateInput(new Date())}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportMovementsCsv(rows: StockMovementRow[]) {
  const header = ['Mã phiếu', 'Loại', 'Ngày', 'Phụ kiện', 'Serial', 'Số lượng', 'Đơn vị', 'Giá bán', 'Máy', 'Khách', 'Phiếu liên quan'];
  const body = rows.map((row) => [
    row.code,
    movementTypeLabel(row.type),
    formatDate(row.occurredAt),
    [row.componentAccessory?.code, row.componentAccessory?.name].filter(Boolean).join(' - '),
    row.serialNumber || '',
    row.quantityDelta || 0,
    row.unit || '',
    row.totalPrice || 0,
    row.machine ? machineLabel(row.machine) : '',
    row.customer ? customerLabel(row.customer) : '',
    movementSourceLabel(row),
  ]);
  const csv = [header, ...body].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `lich-su-phu-kien-${toDateInput(new Date())}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

const fieldLabelClass = 'grid gap-1.5 text-sm font-semibold text-[#3f4654]';
const fieldClass = 'h-11 min-w-0 rounded-xl border border-[#d7dce5] bg-white px-3 text-sm font-semibold text-[#202124] outline-none transition focus:border-[#3e8375] focus:shadow-[0_0_0_3px_rgba(62,131,117,0.12)]';

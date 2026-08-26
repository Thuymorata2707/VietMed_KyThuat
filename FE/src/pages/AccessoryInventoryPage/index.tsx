import { Download, Loader2, PenLine, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dispatch, FormEvent, SetStateAction, useMemo, useState } from 'react';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages } from '../../api';
import { getRoleName } from '../../auth/roles';
import { DateInput } from '../../components/DateInput';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { queryKeys } from '../../lib/queryKeys';

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
  component?: { id: string; name?: string | null } | null;
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

type ComponentOption = {
  id: string;
  code?: string | null;
  name?: string | null;
  machineModelId?: string | null;
  machineModel?: MachineModelOption | null;
};

type CatalogAccessoryForm = {
  id?: string;
  machineModelId: string;
  componentId: string;
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

const movementTypes: StockMovementType[] = ['IMPORT', 'EXPORT', 'ADJUSTMENT'];

export function AccessoryInventoryPage({ user }: { user: ApiUser }) {
  const queryClient = useQueryClient();
  const role = getRoleName(user);
  const canManageAccessories = role === 'admin';
  const [activeTab, setActiveTab] = useState<'stock' | 'catalog' | 'history'>('stock');
  const [search, setSearch] = useState('');
  const [movementSearch, setMovementSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<MovementForm>(() => emptyMovementForm());
  const [catalogForm, setCatalogForm] = useState<CatalogAccessoryForm | null>(null);
  const params = new URLSearchParams({ limit: '100' });
  if (search.trim()) params.set('search', search.trim());
  const movementParams = new URLSearchParams({ limit: '100' });
  if (movementSearch.trim()) movementParams.set('search', movementSearch.trim());

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
      const [accessories, machinesResult, customersResult, machineModels, machineComponents] = await Promise.all([
        apiFetchAllPages<AccessoryStockRow>('/component-accessories'),
        apiFetch<Paginated<MachineOption>>('/machines?limit=100'),
        apiFetch<Paginated<CustomerOption>>('/customers?limit=100'),
        apiFetchAllPages<MachineModelOption>('/machine-models'),
        apiFetchAllPages<ComponentOption>('/machine-components'),
      ]);
      return {
        accessories,
        machines: machinesResult.data ?? [],
        customers: customersResult.data ?? [],
        machineComponents,
        machineModels,
      };
    },
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
  const machineComponents = optionsQuery.data?.machineComponents ?? [];
  const filteredComponents = catalogForm?.machineModelId
    ? machineComponents.filter((component) => component.machineModelId === catalogForm.machineModelId || component.machineModel?.id === catalogForm.machineModelId)
    : machineComponents;
  const catalogError = createAccessoryMutation.error || updateAccessoryMutation.error || deleteAccessoryMutation.error;
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
          <PageTitle eyebrow="Phụ kiện" title="Danh mục, tồn kho & lịch sử thay thế" />
          <div className="flex flex-wrap gap-2">
            <button className="secondary-button" disabled={stockQuery.isFetching || movementsQuery.isFetching} onClick={() => void Promise.all([stockQuery.refetch(), movementsQuery.refetch()])} type="button">
              {stockQuery.isFetching || movementsQuery.isFetching ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
              Làm mới
            </button>
            {activeTab === 'catalog' && canManageAccessories ? (
              <button className="primary-button" onClick={openCreateAccessory} type="button">
                <Plus size={16} />
                Thêm phụ kiện
              </button>
            ) : null}
            {activeTab === 'stock' ? (
              <button className="primary-button" onClick={() => setShowForm((value) => !value)} type="button">
                <Plus size={16} />
                Tạo phiếu kho
              </button>
            ) : null}
            {activeTab === 'history' ? (
              <button className="secondary-button" disabled={!movementRows.length} onClick={() => exportMovementsCsv(movementRows)} type="button">
                <Download size={16} />
                Xuất lịch sử
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 rounded-[18px] border border-[#e5ebf3] bg-white p-1.5 md:grid-cols-3">
          <TabButton active={activeTab === 'stock'} description="Nhập, xuất, điều chỉnh tồn" label="Tồn kho" onClick={() => setActiveTab('stock')} />
          <TabButton active={activeTab === 'catalog'} description="Thêm, sửa, xóa phụ kiện" label="Danh mục" onClick={() => setActiveTab('catalog')} />
          <TabButton active={activeTab === 'history'} description="Máy, khách, phiếu thay thế" label="Lịch sử" onClick={() => setActiveTab('history')} />
        </div>

        {!canManageAccessories && activeTab === 'catalog' ? (
          <Notice message="Tài khoản của bạn được xem danh mục phụ kiện. Thao tác thêm, sửa, xóa chỉ dành cho admin." />
        ) : null}

        {canManageAccessories && activeTab === 'catalog' ? (
          <div className="rounded-[18px] border border-[#dbe6f3] bg-[#fbfdff] px-4 py-3 text-sm font-medium text-[#586174]">
            Danh mục phụ kiện và kho đã được gom chung tại đây. Sau khi thêm hoặc sửa, bạn vẫn ở lại màn Phụ kiện để kiểm tra tồn kho và lịch sử.
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-4">
          <InventoryMetric label="Mã phụ kiện" value={totals.accessories} />
          <InventoryMetric label="Tổng tồn" value={formatQuantity(totals.stock)} />
          <InventoryMetric label="Giá trị tồn" value={formatMoney(totals.value)} />
          <InventoryMetric label="Hết tồn" tone="warn" value={totals.low} />
        </div>

        {createMovementMutation.error instanceof Error ? <Notice message={createMovementMutation.error.message} /> : null}
        {catalogError instanceof Error ? <Notice message={catalogError.message} /> : null}
        {stockQuery.error instanceof Error ? <Notice message={stockQuery.error.message} /> : null}
        {movementsQuery.error instanceof Error ? <Notice message={movementsQuery.error.message} /> : null}

        {activeTab === 'stock' && showForm ? (
          <form className="grid gap-4 rounded-[24px] border border-[#dbe6f3] bg-[#fbfdff] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]" onSubmit={submitMovement}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-[#202124]">Phiếu kho phụ kiện</h2>
                <p className="mt-1 text-sm font-medium text-[#667085]">Nhập kho, xuất kho ngoài phiếu hoặc điều chỉnh tồn.</p>
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
            <button className="secondary-button" disabled={!stockRows.length} onClick={() => exportStockCsv(stockRows)} type="button">
              <Download size={16} />
              Xuất CSV
            </button>
          </div>
          <div className="overflow-hidden rounded-[20px] border border-[#eef0f3]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-[#fafafa] text-xs uppercase text-[#667085]">
                  <tr>
                    <th className="border-b border-[#eef0f3] px-4 py-3">Phụ kiện</th>
                    <th className="border-b border-[#eef0f3] px-4 py-3">Model</th>
                    <th className="border-b border-[#eef0f3] px-4 py-3">Nhóm</th>
                    <th className="border-b border-[#eef0f3] px-4 py-3">Tồn</th>
                    <th className="border-b border-[#eef0f3] px-4 py-3">Giá vốn</th>
                    <th className="border-b border-[#eef0f3] px-4 py-3">Giá bán</th>
                    <th className="border-b border-[#eef0f3] px-4 py-3">Giá trị tồn</th>
                  </tr>
                </thead>
                <tbody>
                  {stockQuery.isLoading ? <TableMessage colSpan={7} text="Đang tải tồn kho" /> : null}
                  {!stockQuery.isLoading && !stockRows.length ? <TableMessage colSpan={7} text="Chưa có phụ kiện phù hợp." /> : null}
                  {stockRows.map((row) => (
                    <tr className="hover:bg-[#fafafa]" key={row.id}>
                      <td className="border-b border-[#f1f2f4] px-4 py-3">
                        <strong className="block text-[#202124]">{row.name}</strong>
                        <span className="text-xs font-semibold text-[#667085]">{row.code}</span>
                      </td>
                      <td className="border-b border-[#f1f2f4] px-4 py-3">{row.machineModel?.displayName || row.machineModel?.name || '-'}</td>
                      <td className="border-b border-[#f1f2f4] px-4 py-3">{row.component?.name || '-'}</td>
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
            components={filteredComponents}
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

function TabButton({ active, description, label, onClick }: { active: boolean; description: string; label: string; onClick: () => void }) {
  return (
    <button
      className={`rounded-[14px] px-4 py-3 text-left transition ${active ? 'bg-[#202124] text-white shadow-[0_10px_24px_rgba(24,24,27,0.18)]' : 'bg-transparent text-[#344054] hover:bg-[#f6f8fb]'}`}
      onClick={onClick}
      type="button"
    >
      <strong className="block text-sm">{label}</strong>
      <span className={`mt-1 block text-xs font-medium ${active ? 'text-white/75' : 'text-[#667085]'}`}>{description}</span>
    </button>
  );
}

function CatalogSection({
  canManageAccessories,
  onDelete,
  onEdit,
  rows,
  search,
  setSearch,
  stockQueryLoading,
}: {
  canManageAccessories: boolean;
  onDelete: (row: AccessoryStockRow) => void;
  onEdit: (row: AccessoryStockRow) => void;
  rows: AccessoryStockRow[];
  search: string;
  setSearch: (value: string) => void;
  stockQueryLoading: boolean;
}) {
  return (
    <section className="grid gap-3 rounded-[24px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07),0_12px_30px_rgba(24,24,27,0.05)]">
      <label className="operation-filter-field">
        <span>Tìm phụ kiện</span>
        <input onChange={(event) => setSearch(event.target.value)} placeholder="Mã phụ kiện, tên, model, nhóm..." value={search} />
      </label>
      <div className="overflow-hidden rounded-[20px] border border-[#eef0f3]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-[#fafafa] text-xs uppercase text-[#667085]">
              <tr>
                <th className="border-b border-[#eef0f3] px-4 py-3">Phụ kiện</th>
                <th className="border-b border-[#eef0f3] px-4 py-3">Model</th>
                <th className="border-b border-[#eef0f3] px-4 py-3">Nhóm</th>
                <th className="border-b border-[#eef0f3] px-4 py-3">Đơn vị</th>
                <th className="border-b border-[#eef0f3] px-4 py-3">Giá vốn</th>
                <th className="border-b border-[#eef0f3] px-4 py-3">Giá bán</th>
                <th className="border-b border-[#eef0f3] px-4 py-3">Serial</th>
                <th className="border-b border-[#eef0f3] px-4 py-3">Tồn</th>
                {canManageAccessories ? <th className="border-b border-[#eef0f3] px-4 py-3">Thao tác</th> : null}
              </tr>
            </thead>
            <tbody>
              {stockQueryLoading ? <TableMessage colSpan={canManageAccessories ? 9 : 8} text="Đang tải danh mục phụ kiện" /> : null}
              {!stockQueryLoading && !rows.length ? <TableMessage colSpan={canManageAccessories ? 9 : 8} text="Chưa có phụ kiện phù hợp." /> : null}
              {rows.map((row) => (
                <tr className="hover:bg-[#fafafa]" key={row.id}>
                  <td className="border-b border-[#f1f2f4] px-4 py-3">
                    <strong className="block text-[#202124]">{row.name}</strong>
                    <span className="text-xs font-semibold text-[#667085]">{row.code}</span>
                  </td>
                  <td className="border-b border-[#f1f2f4] px-4 py-3">{row.machineModel?.displayName || row.machineModel?.name || '-'}</td>
                  <td className="border-b border-[#f1f2f4] px-4 py-3">{row.component?.name || '-'}</td>
                  <td className="border-b border-[#f1f2f4] px-4 py-3">{row.unit || 'cái'}</td>
                  <td className="border-b border-[#f1f2f4] px-4 py-3">{formatMoney(Number(row.unitCost || 0))}</td>
                  <td className="border-b border-[#f1f2f4] px-4 py-3">{formatMoney(Number(row.salePrice || 0))}</td>
                  <td className="border-b border-[#f1f2f4] px-4 py-3">{row.requiresSerial ? 'Có' : 'Không'}</td>
                  <td className="border-b border-[#f1f2f4] px-4 py-3 font-semibold text-[#202124]">{formatQuantity(row.currentStock || 0)} {row.unit || 'cái'}</td>
                  {canManageAccessories ? (
                    <td className="border-b border-[#f1f2f4] px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button className="secondary-button compact" onClick={() => onEdit(row)} type="button">
                          <PenLine size={14} />
                          Sửa
                        </button>
                        <button className="danger-button compact" onClick={() => onDelete(row)} type="button">
                          <Trash2 size={14} />
                          Xóa
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CatalogAccessoryModal({
  components,
  form,
  isSaving,
  machineModels,
  onClose,
  onSubmit,
  setForm,
}: {
  components: ComponentOption[];
  form: CatalogAccessoryForm;
  isSaving: boolean;
  machineModels: MachineModelOption[];
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  setForm: Dispatch<SetStateAction<CatalogAccessoryForm | null>>;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#111827]/35 px-4 py-6" onClick={onClose}>
      <form className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[24px] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)]" onClick={(event) => event.stopPropagation()} onSubmit={onSubmit}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[#202124]">{form.id ? 'Sửa phụ kiện' : 'Thêm phụ kiện'}</h2>
            <p className="mt-1 text-sm font-medium text-[#667085]">Khai báo đơn vị, giá vốn, giá bán và yêu cầu serial ngay trong màn Phụ kiện.</p>
          </div>
          <button className="secondary-button compact" onClick={onClose} type="button" title="Đóng">
            <X size={16} />
            Đóng
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className={`${fieldLabelClass} xl:col-span-2`}>
            Model máy
            <select className={fieldClass} onChange={(event) => setForm((current) => current ? { ...current, componentId: '', machineModelId: event.target.value } : current)} required value={form.machineModelId}>
              <option value="">Chọn model</option>
              {machineModels.map((model) => (
                <option key={model.id} value={model.id}>{[model.code, model.displayName || model.name].filter(Boolean).join(' - ')}</option>
              ))}
            </select>
          </label>
          <label className={`${fieldLabelClass} xl:col-span-2`}>
            Nhóm phụ kiện
            <select className={fieldClass} onChange={(event) => setForm((current) => current ? { ...current, componentId: event.target.value } : current)} value={form.componentId}>
              <option value="">Không chọn nhóm</option>
              {components.map((component) => (
                <option key={component.id} value={component.id}>{[component.code, component.name].filter(Boolean).join(' - ')}</option>
              ))}
            </select>
          </label>
          <TextInput label="Mã phụ kiện" onChange={(value) => setForm((current) => current ? { ...current, code: value } : current)} value={form.code} />
          <TextInput label="Tên phụ kiện" onChange={(value) => setForm((current) => current ? { ...current, name: value } : current)} value={form.name} />
          <TextInput label="Đơn vị tính" onChange={(value) => setForm((current) => current ? { ...current, unit: value } : current)} value={form.unit} />
          <NumberInput label="Số lượng chuẩn" min={1} onChange={(value) => setForm((current) => current ? { ...current, quantity: value } : current)} value={form.quantity} />
          <NumberInput label="Giá vốn" min={0} onChange={(value) => setForm((current) => current ? { ...current, unitCost: value } : current)} value={form.unitCost} />
          <NumberInput label="Giá bán" min={0} onChange={(value) => setForm((current) => current ? { ...current, salePrice: value } : current)} value={form.salePrice} />
          <NumberInput label="Thứ tự" min={0} onChange={(value) => setForm((current) => current ? { ...current, sortOrder: value } : current)} value={form.sortOrder} />
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
          <TextInput label="Mô tả / ghi chú" onChange={(value) => setForm((current) => current ? { ...current, description: value } : current)} value={form.description} wide />
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button className="secondary-button" onClick={onClose} type="button">Hủy</button>
          <button className="primary-button" disabled={isSaving} type="submit">
            {isSaving ? <Loader2 className="spin-icon" size={16} /> : null}
            Lưu phụ kiện
          </button>
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

function TextInput({ label, onChange, value, wide }: { label: string; onChange: (value: string) => void; value: string; wide?: boolean }) {
  return (
    <label className={`${fieldLabelClass} ${wide ? 'xl:col-span-2' : ''}`}>
      {label}
      <input className={fieldClass} onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

function NumberInput({ label, min, onChange, value }: { label: string; min?: number; onChange: (value: number) => void; value: number }) {
  return (
    <label className={fieldLabelClass}>
      {label}
      <input className={fieldClass} min={min} onChange={(event) => onChange(Number(event.target.value))} step={0.01} type="number" value={value} />
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
    componentId: '',
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
    componentId: row.component?.id || '',
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
      componentId: form.componentId || null,
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
  return customer.hospitalName || customer.name || 'Khách hàng';
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

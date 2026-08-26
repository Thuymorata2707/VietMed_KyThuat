import { Boxes, Download, Loader2, Plus, RefreshCw, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  unit?: string | null;
  unitCost?: number | string | null;
  salePrice?: number | string | null;
  currentStock?: number;
  stockValue?: number;
  requiresSerial?: boolean;
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
  const [search, setSearch] = useState('');
  const [movementSearch, setMovementSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<MovementForm>(() => emptyMovementForm());
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
      const [accessories, machinesResult, customersResult] = await Promise.all([
        apiFetchAllPages<AccessoryStockRow>('/component-accessories'),
        apiFetch<Paginated<MachineOption>>('/machines?limit=100'),
        apiFetch<Paginated<CustomerOption>>('/customers?limit=100'),
      ]);
      return {
        accessories,
        machines: machinesResult.data ?? [],
        customers: customersResult.data ?? [],
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

  const stockRows = stockQuery.data?.data ?? [];
  const movementRows = movementsQuery.data?.data ?? [];
  const accessories = optionsQuery.data?.accessories ?? [];
  const machines = optionsQuery.data?.machines ?? [];
  const customers = optionsQuery.data?.customers ?? [];
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

  return (
    <PageFrame>
      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PageTitle eyebrow="Kho phụ kiện" title="Tồn kho & lịch sử thay thế" />
          <div className="flex flex-wrap gap-2">
            {canManageAccessories ? (
              <>
                <Link className="secondary-button" to="/component-accessories">
                  <Boxes size={16} />
                  Danh mục phụ kiện
                </Link>
                <Link className="secondary-button" to="/component-accessories/new">
                  <Plus size={16} />
                  Thêm phụ kiện
                </Link>
              </>
            ) : null}
            <button className="secondary-button" disabled={stockQuery.isFetching || movementsQuery.isFetching} onClick={() => void Promise.all([stockQuery.refetch(), movementsQuery.refetch()])} type="button">
              {stockQuery.isFetching || movementsQuery.isFetching ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
              Làm mới
            </button>
            <button className="primary-button" onClick={() => setShowForm((value) => !value)} type="button">
              <Plus size={16} />
              Tạo phát sinh
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <InventoryMetric label="Mã phụ kiện" value={totals.accessories} />
          <InventoryMetric label="Tổng tồn" value={formatQuantity(totals.stock)} />
          <InventoryMetric label="Giá trị tồn" value={formatMoney(totals.value)} />
          <InventoryMetric label="Hết tồn" tone="warn" value={totals.low} />
        </div>

        {createMovementMutation.error instanceof Error ? <Notice message={createMovementMutation.error.message} /> : null}
        {stockQuery.error instanceof Error ? <Notice message={stockQuery.error.message} /> : null}
        {movementsQuery.error instanceof Error ? <Notice message={movementsQuery.error.message} /> : null}

        {showForm ? (
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
                    {canManageAccessories ? <th className="border-b border-[#eef0f3] px-4 py-3">Thao tác</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {stockQuery.isLoading ? <TableMessage colSpan={canManageAccessories ? 8 : 7} text="Đang tải tồn kho" /> : null}
                  {!stockQuery.isLoading && !stockRows.length ? <TableMessage colSpan={canManageAccessories ? 8 : 7} text="Chưa có phụ kiện phù hợp." /> : null}
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
                      {canManageAccessories ? (
                        <td className="border-b border-[#f1f2f4] px-4 py-3">
                          <Link className="secondary-button compact" to={`/component-accessories/${row.id}/edit`}>
                            Sửa
                          </Link>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

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
      </section>
    </PageFrame>
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

const fieldLabelClass = 'grid gap-1.5 text-sm font-semibold text-[#3f4654]';
const fieldClass = 'h-11 min-w-0 rounded-xl border border-[#d7dce5] bg-white px-3 text-sm font-semibold text-[#202124] outline-none transition focus:border-[#3e8375] focus:shadow-[0_0_0_3px_rgba(62,131,117,0.12)]';

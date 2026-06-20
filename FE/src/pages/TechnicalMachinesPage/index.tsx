import { ArrowLeft, ChevronLeft, ChevronRight, Edit3, Loader2, PackageSearch, Plus, RotateCcw, Save, Search, Trash2, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paginated, apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { RoleName } from '../../auth/roles';
import { ultrasoundProbeOptions } from '../../config/ultrasoundProbes';
import { displayLabel } from '../../utils/displayLabels';

type DashboardCustomer = {
  id: string;
  customerCode?: string | null;
  name: string;
  hospitalName?: string | null;
  phone?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  province?: string | null;
  district?: string | null;
  address?: string | null;
  fullAddress?: string | null;
};

type DashboardEngineer = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
};

type DashboardMachine = {
  id: string;
  machineCode?: string | null;
  serialNumber: string;
  machineModelId?: string | null;
  modelName: string;
  name?: string | null;
  manufacturer?: string | null;
  productCategory?: string | null;
  status?: string | null;
  inventoryStatus?: string | null;
  dataStatus?: string | null;
  createdSource?: string | null;
  installDate?: string | null;
  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;
  installedBy?: DashboardEngineer | null;
  primaryEngineer?: DashboardEngineer | null;
  customer?: DashboardCustomer | null;
  accessories?: Array<{
    id: string;
    code?: string | null;
    name: string;
    serialNumber?: string | null;
    description?: string | null;
    note?: string | null;
    componentAccessory?: {
      id: string;
      code?: string | null;
      name: string;
      component?: {
        id: string;
        code?: string | null;
        name: string;
      } | null;
    } | null;
  }>;
  installation?: {
    id: string;
    code: string;
    status: string;
    installedAt: string;
    receiverInstallAddress?: string | null;
    receiverRepresentative?: string | null;
    receiverPhone?: string | null;
    warrantyCard?: {
      id: string;
      code: string;
      status: string;
      startDate: string;
      endDate: string;
    } | null;
  } | null;
};

type EditMachineForm = {
  machineCode: string;
  serialNumber: string;
  name: string;
  modelName: string;
  manufacturer: string;
  productCategory: string;
  status: string;
  inventoryStatus: string;
  customerId: string;
  installDate: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  accessories: EditMachineAccessoryForm[];
};

type EditMachineAccessoryForm = {
  clientId: string;
  id?: string;
  componentAccessoryId?: string | null;
  code: string;
  name: string;
  serialNumber: string;
  description: string;
  note: string;
};

type MachineModelDetail = {
  id: string;
  productCategory?: string | null;
  businessLine?: {
    productCategory?: string | null;
  } | null;
  components?: Array<{
    id: string;
    code: string;
    name: string;
    accessories?: TemplateAccessory[];
  }>;
};

type TemplateAccessory = {
  id: string;
  code: string;
  name: string;
  requiresSerial?: boolean;
  componentName?: string;
};

type TechnicalMachineGroup = {
  id: string | null;
  code: string | null;
  name: string;
  productCategory: string;
  count: number;
};

type TechnicalMachines = {
  total: number;
  filteredTotal: number;
  page: number;
  limit: number;
  totalPages: number;
  businessLines: TechnicalMachineGroup[];
  machines: DashboardMachine[];
};

export function TechnicalMachinesPage({ currentRole }: { currentRole: RoleName }) {
  const navigate = useNavigate();
  const [technicalMachines, setTechnicalMachines] = useState<TechnicalMachines | null>(null);
  const [customers, setCustomers] = useState<DashboardCustomer[]>([]);
  const [selectedBusinessLineKey, setSelectedBusinessLineKey] = useState('ALL');
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [editingMachine, setEditingMachine] = useState<DashboardMachine | null>(null);
  const [editForm, setEditForm] = useState<EditMachineForm>(() => emptyEditMachineForm());
  const [templateAccessories, setTemplateAccessories] = useState<TemplateAccessory[]>([]);
  const [loadingAccessoryTemplates, setLoadingAccessoryTemplates] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [installState, setInstallState] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (currentRole !== 'admin') return;
    void loadCustomers();
  }, [currentRole]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void loadTechnicalMachines();
  }, [search, selectedBusinessLineKey, installState, page, limit]);

  async function loadTechnicalMachines() {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (search) params.set('search', search);
      if (selectedBusinessLineKey !== 'ALL') params.set('businessLineId', selectedBusinessLineKey);
      if (installState !== 'ALL') params.set('installState', installState);

      const result = await apiFetch<TechnicalMachines>(`/dashboard/technical-machines?${params.toString()}`);
      const firstMachine = result.machines[0];
      setTechnicalMachines(result);
      setSelectedMachineId((current) => (current && result.machines.some((machine) => machine.id === current) ? current : firstMachine?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách máy.');
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomers() {
    try {
      const result = await apiFetch<Paginated<DashboardCustomer>>('/customers?limit=100');
      setCustomers(result.data);
    } catch {
      setCustomers([]);
    }
  }

  const selectedBusinessLine = useMemo(() => {
    if (selectedBusinessLineKey === 'ALL') return null;
    if (!technicalMachines?.businessLines.length) return null;
    return technicalMachines.businessLines.find((businessLine) => businessLineKey(businessLine) === selectedBusinessLineKey) ?? null;
  }, [selectedBusinessLineKey, technicalMachines]);

  const selectedMachine = useMemo(() => {
    if (!technicalMachines?.machines.length) return null;
    return technicalMachines.machines.find((machine) => machine.id === selectedMachineId) ?? technicalMachines.machines[0];
  }, [selectedMachineId, technicalMachines]);

  function resetFilters() {
    setSearchInput('');
    setSearch('');
    setInstallState('ALL');
    setSelectedBusinessLineKey('ALL');
    setSelectedMachineId(null);
    setPage(1);
  }

  function openEditMachine(machine: DashboardMachine) {
    setEditingMachine(machine);
    setEditForm(buildEditMachineForm(machine));
    setTemplateAccessories([]);
    setSuccess('');
    setError('');
    void loadAccessoryTemplates(machine);
  }

  async function loadAccessoryTemplates(machine: DashboardMachine) {
    if (!machine.machineModelId) return;

    setLoadingAccessoryTemplates(true);
    try {
      const result = await apiFetch<MachineModelDetail>(`/machine-models/${machine.machineModelId}`);
      setTemplateAccessories(flattenTemplateAccessories(result));
    } catch {
      setTemplateAccessories([]);
    } finally {
      setLoadingAccessoryTemplates(false);
    }
  }

  function updateEditForm(patch: Partial<EditMachineForm>) {
    setEditForm((current) => ({ ...current, ...patch }));
  }

  function addAccessoryForm() {
    setEditForm((current) => ({
      ...current,
      accessories: [...current.accessories, emptyEditAccessoryForm()],
    }));
  }

  function updateAccessoryForm(clientId: string, patch: Partial<EditMachineAccessoryForm>) {
    setEditForm((current) => ({
      ...current,
      accessories: current.accessories.map((accessory) => (accessory.clientId === clientId ? { ...accessory, ...patch } : accessory)),
    }));
  }

  function removeAccessoryForm(clientId: string) {
    setEditForm((current) => ({
      ...current,
      accessories: current.accessories.filter((accessory) => accessory.clientId !== clientId),
    }));
  }

  function addProbeAccessory(code: string) {
    if (!code) return;
    setEditForm((current) => ({
      ...current,
      accessories: [...current.accessories, { ...emptyEditAccessoryForm(), code, name: code }],
    }));
  }

  function toggleTemplateAccessory(template: TemplateAccessory, checked: boolean) {
    setEditForm((current) => {
      if (!checked) {
        return {
          ...current,
          accessories: current.accessories.filter((accessory) => accessory.componentAccessoryId !== template.id),
        };
      }

      if (current.accessories.some((accessory) => accessory.componentAccessoryId === template.id)) return current;

      return {
        ...current,
        accessories: [
          ...current.accessories,
          {
            ...emptyEditAccessoryForm(),
            componentAccessoryId: template.id,
            code: template.code,
            name: template.code || template.name,
          },
        ],
      };
    });
  }

  async function handleSaveMachine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingMachine) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const accessories = editForm.accessories.filter(hasAccessoryContent);

      if (accessories.some((accessory) => !accessory.name.trim())) {
        setError('Tên phụ kiện là bắt buộc. Nếu không dùng nữa, hãy xóa dòng phụ kiện đó.');
        return;
      }

      await apiFetch(`/machines/${editingMachine.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          machineCode: editForm.machineCode.trim() || null,
          serialNumber: editForm.serialNumber.trim(),
          name: editForm.name.trim() || undefined,
          modelName: editForm.modelName.trim(),
          manufacturer: editForm.manufacturer.trim(),
          productCategory: editForm.productCategory,
          status: editForm.status,
          inventoryStatus: editForm.inventoryStatus,
          customerId: editForm.customerId || null,
          installDate: editForm.installDate || null,
          warrantyStartDate: editForm.warrantyStartDate || null,
          warrantyEndDate: editForm.warrantyEndDate || null,
          dataStatus: 'VERIFIED',
          accessories: accessories.map((accessory) => ({
            id: accessory.id,
            componentAccessoryId: accessory.componentAccessoryId ?? undefined,
            code: accessory.code.trim() || null,
            name: accessory.name.trim(),
            serialNumber: accessory.serialNumber.trim() || null,
            description: accessory.description.trim() || null,
            note: accessory.note.trim() || null,
          })),
        }),
      });
      setSuccess('Đã cập nhật và xác minh hồ sơ máy.');
      setEditingMachine(null);
      await loadTechnicalMachines();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được thông tin máy.');
    } finally {
      setSaving(false);
    }
  }

  const isEditingUltrasound = isUltrasoundMachine(editingMachine);

  return (
    <PageFrame>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Phòng kỹ thuật"
          title="Danh sách máy quản lý"
          description="Chọn ngành hàng, xem số S/N của máy và thông tin khách hàng đã lắp. Máy chưa lắp sẽ để trống thông tin khách hàng."
        />
        <button className="secondary-button" onClick={() => navigate('/')} type="button">
          <ArrowLeft size={17} />
          Quay lại Dashboard
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="grid min-w-0 gap-3 rounded-lg border border-[#dde5ee] bg-white p-4 min-[1320px]:grid-cols-[minmax(220px,1fr)_180px_150px_auto]">
        <label className="relative grid min-w-0 gap-2 text-sm font-semibold text-[#344054]">
          Tìm kiếm
          <Search className="pointer-events-none absolute bottom-[11px] left-3 text-[#98a2b3]" size={17} />
          <input
            className="h-11 min-w-0 rounded-lg border border-[#cfd8e3] pl-9 pr-3 text-[#101828] outline-none focus:border-[#d92d20] focus:shadow-[0_0_0_3px_rgba(217,45,32,0.12)]"
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="S/N máy, model, khách hàng, S/N đầu dò..."
            value={searchInput}
          />
        </label>
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#344054]">
          Trạng thái lắp
          <select
            className="h-11 min-w-0 rounded-lg border border-[#cfd8e3] px-3 text-[#101828] outline-none focus:border-[#d92d20] focus:shadow-[0_0_0_3px_rgba(217,45,32,0.12)]"
            onChange={(event) => {
              setInstallState(event.target.value);
              setPage(1);
              setSelectedMachineId(null);
            }}
            value={installState}
          >
            <option value="ALL">Tất cả</option>
            <option value="INSTALLED">Đã lắp</option>
            <option value="UNINSTALLED">Chưa lắp</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#344054]">
          Số dòng
          <select
            className="h-11 min-w-0 rounded-lg border border-[#cfd8e3] px-3 text-[#101828] outline-none focus:border-[#d92d20] focus:shadow-[0_0_0_3px_rgba(217,45,32,0.12)]"
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
              setSelectedMachineId(null);
            }}
            value={limit}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <button className="secondary-button self-end" onClick={resetFilters} type="button">
          <RotateCcw size={17} />
          Đặt lại
        </button>
      </section>

      <section className="grid min-w-0 gap-4 min-[1320px]:grid-cols-[280px_minmax(0,1fr)] min-[1680px]:grid-cols-[300px_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-4">
          <div className="rounded-lg border border-[#dde5ee] bg-white p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-medium text-[#101828]">Máy theo ngành hàng</h2>
                <p className="text-sm text-[#667085]">
                  {loading ? 'Đang tải dữ liệu máy.' : `${technicalMachines?.businessLines.length ?? 0} ngành hàng`}
                </p>
              </div>
              <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#dbe5ef] bg-[#f8fafc] px-2.5 text-sm font-medium text-[#2f5f98]">
                {loading ? <Loader2 className="spin-icon" size={17} /> : <PackageSearch size={17} />}
                {loading ? '-' : technicalMachines?.total ?? 0}
              </span>
            </div>

            <div className="grid gap-2">
              <button
                className={`grid min-h-[54px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${selectedBusinessLineKey === 'ALL' ? 'border-[#b8cbe1] bg-[#f3f8ff]' : 'border-[#edf2f7] bg-white hover:border-[#d7e0eb] hover:bg-[#fbfdff]'}`}
                onClick={() => {
                  setSelectedBusinessLineKey('ALL');
                  setSelectedMachineId(null);
                  setPage(1);
                }}
                type="button"
              >
                <span className="grid min-w-0 gap-1">
                  <strong className="truncate text-sm text-[#101828]">Tất cả ngành hàng</strong>
                  <span className="text-[12px] text-[#667085]">Theo bộ lọc hiện tại</span>
                </span>
                <b className="text-lg text-[#2f5f98]">{technicalMachines?.businessLines.reduce((sum, item) => sum + item.count, 0) ?? 0}</b>
              </button>
              {technicalMachines?.businessLines.length ? (
                technicalMachines.businessLines.map((businessLine) => {
                  const isActive = businessLineKey(businessLine) === selectedBusinessLineKey;
                  return (
                    <button
                      className={`grid min-h-[54px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${isActive ? 'border-[#b8cbe1] bg-[#f3f8ff]' : 'border-[#edf2f7] bg-white hover:border-[#d7e0eb] hover:bg-[#fbfdff]'}`}
                      key={businessLineKey(businessLine)}
                      onClick={() => {
                        setSelectedBusinessLineKey(businessLineKey(businessLine));
                        setSelectedMachineId(null);
                        setPage(1);
                      }}
                      type="button"
                    >
                      <span className="grid min-w-0 gap-1">
                        <strong className="truncate text-sm text-[#101828]">{businessLine.name}</strong>
                        <span className="text-[12px] text-[#667085]">{businessLine.code || displayProductCategory(businessLine.productCategory)}</span>
                      </span>
                      <b className="text-lg text-[#2f5f98]">{businessLine.count}</b>
                      </button>
                  );
                })
              ) : (
                <EmptyState text={loading ? 'Đang tải dữ liệu máy.' : 'Chưa có máy trong phạm vi dữ liệu.'} />
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[#dde5ee] bg-white p-4">
            <div className="mb-4">
              <h2 className="text-base font-medium text-[#101828]">Số S/N</h2>
              <p className="text-sm text-[#667085]">
                {selectedBusinessLine?.name ?? 'Tất cả ngành hàng'} - {technicalMachines?.filteredTotal ?? 0} kết quả
              </p>
            </div>
            <div className="grid max-h-[520px] gap-2 overflow-auto pr-1">
              {technicalMachines?.machines.length ? (
                technicalMachines.machines.map((machine) => (
                  <button
                    className={`grid min-h-[50px] gap-1 rounded-lg border px-2.5 py-2 text-left transition ${machine.id === selectedMachine?.id ? 'border-[#b8cbe1] bg-[#f3f8ff]' : 'border-[#edf2f7] bg-white hover:border-[#d7e0eb] hover:bg-[#fbfdff]'}`}
                    key={machine.id}
                    onClick={() => setSelectedMachineId(machine.id)}
                    type="button"
                  >
                    <strong className="text-[13px] text-[#2f5f98]">{machine.serialNumber}</strong>
                    <span className="truncate text-[12px] text-[#667085]">{machine.modelName}</span>
                  </button>
                ))
              ) : (
                <EmptyState text={loading ? 'Đang tải danh sách máy.' : 'Không có máy phù hợp bộ lọc.'} />
              )}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#edf2f7] pt-3">
              <button
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#dde5ee] bg-white px-2.5 text-sm font-medium text-[#344054] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={loading || page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                type="button"
              >
                <ChevronLeft size={16} />
                Trước
              </button>
              <span className="text-sm font-semibold text-[#667085]">
                {technicalMachines?.page ?? page}/{technicalMachines?.totalPages ?? 1}
              </span>
              <button
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#dde5ee] bg-white px-2.5 text-sm font-medium text-[#344054] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={loading || page >= (technicalMachines?.totalPages ?? 1)}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Sau
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        <MachineDetailPanel canEdit={currentRole === 'admin'} machine={selectedMachine} onEdit={openEditMachine} />
      </section>

      {editingMachine ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-5" role="presentation">
          <form className="grid max-h-[calc(100vh-40px)] w-full max-w-[920px] gap-4 overflow-y-auto rounded-lg border border-[#dde5ee] bg-white p-5 shadow-[0_24px_70px_rgba(16,24,40,0.22)]" onSubmit={handleSaveMachine}>
            <div className="flex items-start justify-between gap-3 border-b border-[#edf2f7] pb-3">
              <div>
                <span className="text-[12px] font-medium text-[#667085]">Chuẩn hóa hồ sơ máy</span>
                <h2 className="mt-1 text-xl font-medium text-[#101828]">{editingMachine.serialNumber}</h2>
              </div>
              <button className="icon-button" onClick={() => setEditingMachine(null)} title="Đóng" type="button">
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className={editLabelClass}>
                Mã máy
                <input className={editFieldClass} onChange={(event) => updateEditForm({ machineCode: event.target.value })} value={editForm.machineCode} />
              </label>
              <label className={editLabelClass}>
                Serial
                <input className={editFieldClass} onChange={(event) => updateEditForm({ serialNumber: event.target.value })} required value={editForm.serialNumber} />
              </label>
              <label className={editLabelClass}>
                Tên thiết bị
                <input className={editFieldClass} onChange={(event) => updateEditForm({ name: event.target.value })} value={editForm.name} />
              </label>
              <label className={editLabelClass}>
                Model
                <input className={editFieldClass} onChange={(event) => updateEditForm({ modelName: event.target.value })} required value={editForm.modelName} />
              </label>
              <label className={editLabelClass}>
                Hãng
                <input className={editFieldClass} onChange={(event) => updateEditForm({ manufacturer: event.target.value })} value={editForm.manufacturer} />
              </label>
              <label className={editLabelClass}>
                Loại thiết bị
                <select className={editFieldClass} onChange={(event) => updateEditForm({ productCategory: event.target.value })} value={editForm.productCategory}>
                  {['ULTRASOUND', 'LAB_TESTING', 'BIOCHEMISTRY', 'IMMUNOLOGY', 'HEMATOLOGY', 'X_RAY', 'ENDOSCOPY', 'OTHER'].map((value) => (
                    <option key={value} value={value}>{displayLabel(value)}</option>
                  ))}
                </select>
              </label>
              <label className={editLabelClass}>
                Trạng thái máy
                <select className={editFieldClass} onChange={(event) => updateEditForm({ status: event.target.value })} value={editForm.status}>
                  {['ACTIVE', 'MAINTENANCE', 'REPAIRING', 'INACTIVE'].map((value) => (
                    <option key={value} value={value}>{displayLabel(value)}</option>
                  ))}
                </select>
              </label>
              <label className={editLabelClass}>
                Trạng thái kho
                <select
                  className={editFieldClass}
                  onChange={(event) => updateEditForm({
                    inventoryStatus: event.target.value,
                    ...inventoryStatusFormPatch(event.target.value),
                  })}
                  value={editForm.inventoryStatus}
                >
                  {['IN_STOCK', 'ACCESSORY_SPLIT', 'INSTALLED', 'RESERVED', 'RETURNED', 'SOLD'].map((value) => (
                    <option key={value} value={value}>{displayLabel(value)}</option>
                  ))}
                </select>
              </label>
              <label className={`${editLabelClass} md:col-span-2`}>
                Khách hàng
                <select className={editFieldClass} onChange={(event) => updateEditForm({ customerId: event.target.value })} value={editForm.customerId}>
                  <option value="">Chưa gắn khách hàng</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{[customer.customerCode, customer.name, customer.province].filter(Boolean).join(' - ')}</option>
                  ))}
                </select>
              </label>
              <label className={editLabelClass}>
                Ngày lắp
                <input className={editFieldClass} onChange={(event) => updateEditForm({ installDate: event.target.value })} type="date" value={editForm.installDate} />
              </label>
              <label className={editLabelClass}>
                Bắt đầu bảo hành
                <input className={editFieldClass} onChange={(event) => updateEditForm({ warrantyStartDate: event.target.value })} type="date" value={editForm.warrantyStartDate} />
              </label>
              <label className={editLabelClass}>
                Hết bảo hành
                <input className={editFieldClass} onChange={(event) => updateEditForm({ warrantyEndDate: event.target.value })} type="date" value={editForm.warrantyEndDate} />
              </label>
            </div>

            <section className="grid gap-3 border-t border-[#edf2f7] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[12px] font-medium text-[#667085]">Đầu dò / Phụ kiện</span>
                  <h3 className="mt-1 text-base font-medium text-[#101828]">{editForm.accessories.length} dòng phụ kiện</h3>
                </div>
                <button className="secondary-button" onClick={addAccessoryForm} type="button">
                  <Plus size={16} />
                  Thêm phụ kiện
                </button>
              </div>

              {isEditingUltrasound ? (
                <ProbePicker onSelect={addProbeAccessory} />
              ) : (
                <TemplateAccessoryPicker
                  loading={loadingAccessoryTemplates}
                  selectedIds={new Set(editForm.accessories.map((accessory) => accessory.componentAccessoryId).filter((id): id is string => Boolean(id)))}
                  templates={templateAccessories}
                  onToggle={toggleTemplateAccessory}
                />
              )}

              <div className="grid gap-3">
                {editForm.accessories.map((accessory, index) => (
                  <div className="grid gap-3 rounded-lg border border-[#edf2f7] bg-[#fbfdff] p-3" key={accessory.clientId}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-[#344054]">Phụ kiện {index + 1}</span>
                      <button className="icon-button" onClick={() => removeAccessoryForm(accessory.clientId)} title="Xóa phụ kiện" type="button">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className={editLabelClass}>
                        {isEditingUltrasound ? 'Model đầu dò' : 'Tên phụ kiện'}
                        {isEditingUltrasound ? (
                          <select
                            className={editFieldClass}
                            onChange={(event) => updateAccessoryForm(accessory.clientId, { code: event.target.value, name: event.target.value })}
                            required
                            value={accessory.code || accessory.name}
                          >
                            <option value="">Chọn đầu dò</option>
                            {ultrasoundProbeOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        ) : (
                          <input className={editFieldClass} onChange={(event) => updateAccessoryForm(accessory.clientId, { name: event.target.value })} required value={accessory.name} />
                        )}
                      </label>
                      <label className={editLabelClass}>
                        Serial phụ kiện
                        <input className={editFieldClass} onChange={(event) => updateAccessoryForm(accessory.clientId, { serialNumber: event.target.value })} value={accessory.serialNumber} />
                      </label>
                      <label className={editLabelClass}>
                        Mã phụ kiện
                        <input className={editFieldClass} onChange={(event) => updateAccessoryForm(accessory.clientId, { code: event.target.value })} value={accessory.code} />
                      </label>
                      <label className={editLabelClass}>
                        Mô tả
                        <input className={editFieldClass} onChange={(event) => updateAccessoryForm(accessory.clientId, { description: event.target.value })} value={accessory.description} />
                      </label>
                      <label className={`${editLabelClass} md:col-span-2`}>
                        Ghi chú
                        <textarea className={`${editFieldClass} min-h-[74px] py-2`} onChange={(event) => updateAccessoryForm(accessory.clientId, { note: event.target.value })} value={accessory.note} />
                      </label>
                    </div>
                  </div>
                ))}
                {editForm.accessories.length === 0 ? <EmptyState text="Máy này chưa có phụ kiện. Bấm Thêm phụ kiện để khai báo." /> : null}
              </div>
            </section>

            <div className="flex justify-end gap-2 border-t border-[#edf2f7] pt-4">
              <button className="secondary-button" disabled={saving} onClick={() => setEditingMachine(null)} type="button">Hủy</button>
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
                Lưu và xác minh
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </PageFrame>
  );
}

function MachineDetailPanel({ canEdit, machine, onEdit }: { canEdit: boolean; machine: DashboardMachine | null; onEdit: (machine: DashboardMachine) => void }) {
  if (!machine) {
    return (
      <aside className="rounded-lg border border-[#dde5ee] bg-white p-6">
        <EmptyState text="Chọn S/N để xem thông tin máy." />
      </aside>
    );
  }

  const customer = machine.customer;
  const installAddress = machine.installation?.receiverInstallAddress || customer?.fullAddress || customer?.address || '';

  const accessories = machine.accessories ?? [];

  return (
    <aside className="grid min-w-0 gap-4 self-start">
      <div className="min-w-0 rounded-lg border border-[#dde5ee] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-medium leading-tight text-[#101828]">Thông tin máy</h2>
            <p className="mt-1 text-lg font-medium text-[#2f5f98]">{machine.serialNumber}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {machine.dataStatus === 'PENDING_REVIEW' ? (
              <span className="inline-flex min-h-8 items-center rounded-full border border-[#fedf89] bg-[#fff7ed] px-3 text-sm font-medium text-[#b54708]">Chờ xác minh</span>
            ) : null}
            <span className="inline-flex min-h-8 items-center rounded-full bg-[#eef6ff] px-3 text-sm font-medium text-[#2f5f98]">
              {displayLabel(machine.inventoryStatus || machine.status || '')}
            </span>
            {canEdit ? (
              <button className="secondary-button" onClick={() => onEdit(machine)} type="button">
                <Edit3 size={16} />
                Sửa thông tin
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <InfoItem label="Model" value={machine.modelName} />
          <InfoItem label="Mã máy" value={machine.machineCode} />
          <InfoItem label="Tên máy" value={machine.name || machine.modelName} />
          <InfoItem label="Hãng" value={machine.manufacturer} />
          <InfoItem label="Loại thiết bị" value={displayProductCategory(machine.productCategory)} />
          <InfoItem label="Ngày lắp" value={formatDashboardDate(machine.installDate)} />
          <InfoItem label="Hết bảo hành" value={formatDashboardDate(machine.warrantyEndDate)} />
          <InfoItem label="Kỹ sư lắp đặt" value={machine.installedBy?.fullName} />
          <InfoItem label="Kỹ sư phụ trách" value={machine.primaryEngineer?.fullName} />
        </div>

        <div className="mt-6 border-t border-[#edf2f7] pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-xl font-medium text-[#101828]">Đầu dò / Phụ kiện</h3>
            <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-sm font-medium text-[#2f5f98]">{accessories.length}</span>
          </div>
          {accessories.length ? (
            <div className="grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {accessories.map((accessory) => (
                <div className="grid min-w-0 gap-2 rounded-lg border border-[#edf2f7] bg-[#fbfdff] p-4" key={accessory.id}>
                  <div className="grid gap-1">
                    <span className="text-[12px] font-medium text-[#667085]">
                      {accessory.componentAccessory?.component?.name || accessory.componentAccessory?.name || accessory.code || 'Phụ kiện'}
                    </span>
                    <strong className="break-words text-base font-medium leading-snug text-[#101828]">{accessory.name}</strong>
                  </div>
                  <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-2 text-sm">
                    <span className="font-semibold text-[#667085]">S/N</span>
                    <strong className="break-words text-[#2f5f98]">{accessory.serialNumber || '-'}</strong>
                    <span className="font-semibold text-[#667085]">Mã</span>
                    <span className="break-words text-[#344054]">{accessory.code || accessory.componentAccessory?.code || '-'}</span>
                  </div>
                  {accessory.note || accessory.description ? (
                    <p className="text-sm leading-snug text-[#667085]">{accessory.note || accessory.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Chưa có thông tin đầu dò/phụ kiện." />
          )}
        </div>
      </div>

      <div className="min-w-0 rounded-lg border border-[#dde5ee] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
          <h2 className="text-2xl font-medium leading-tight text-[#101828]">Khách hàng đã lắp máy</h2>
          {machine.installation?.code ? <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-sm font-semibold text-[#667085]">{machine.installation.code}</span> : null}
        </div>
        {customer ? (
          <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            <InfoItem label="Khách hàng" value={customer.hospitalName || customer.name} />
            <InfoItem label="Mã khách hàng" value={customer.customerCode} />
            <InfoItem label="Người liên hệ" value={machine.installation?.receiverRepresentative || customer.contactPerson} />
            <InfoItem label="Điện thoại" value={machine.installation?.receiverPhone || customer.contactPhone || customer.phone} />
            <InfoItem label="Tỉnh/TP" value={customer.province} />
            <InfoItem label="Địa chỉ lắp đặt" value={installAddress} />
          </div>
        ) : (
          <EmptyState text="Máy chưa có thông tin lắp đặt." />
        )}
      </div>
    </aside>
  );
}

function InfoItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="grid min-w-0 gap-1.5 rounded-lg border border-[#edf2f7] bg-[#fbfdff] p-3">
      <span className="text-[12px] font-medium text-[#667085]">{label}</span>
      <strong className="min-h-6 break-words text-base font-semibold leading-snug text-[#101828]">{value || '-'}</strong>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-[#d7e0eb] bg-[#fbfdff] p-4 text-sm text-[#667085]">{text}</div>;
}

function ProbePicker({ onSelect }: { onSelect: (code: string) => void }) {
  return (
    <div className="grid gap-2 rounded-lg border border-[#edf2f7] bg-[#fff] p-3">
      <span className="text-sm font-medium text-[#344054]">Thêm nhanh đầu dò siêu âm</span>
      <select
        className={editFieldClass}
        onChange={(event) => {
          onSelect(event.target.value);
          event.currentTarget.value = '';
        }}
        value=""
      >
        <option value="">Chọn model đầu dò để thêm</option>
        {ultrasoundProbeOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function TemplateAccessoryPicker({
  loading,
  selectedIds,
  templates,
  onToggle,
}: {
  loading: boolean;
  selectedIds: Set<string>;
  templates: TemplateAccessory[];
  onToggle: (template: TemplateAccessory, checked: boolean) => void;
}) {
  if (loading) {
    return (
      <div className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#edf2f7] bg-[#fbfdff] px-3 text-sm text-[#667085]">
        <Loader2 className="spin-icon" size={16} />
        Đang tải danh sách phụ kiện mẫu
      </div>
    );
  }

  if (!templates.length) {
    return <EmptyState text="Model này chưa có danh sách phụ kiện mẫu để tích chọn nhanh." />;
  }

  return (
    <div className="grid gap-2 rounded-lg border border-[#edf2f7] bg-white p-3">
      <span className="text-sm font-medium text-[#344054]">Tích chọn phụ kiện mẫu của model</span>
      <div className="grid gap-2 md:grid-cols-2">
        {templates.map((template) => (
          <label className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 rounded-lg border border-[#edf2f7] bg-[#fbfdff] px-3 py-2 text-sm text-[#344054]" key={template.id}>
            <input
              checked={selectedIds.has(template.id)}
              className="mt-1"
              onChange={(event) => onToggle(template, event.target.checked)}
              type="checkbox"
            />
            <span className="grid min-w-0 gap-0.5">
              <strong className="font-medium text-[#101828]">{template.code || template.name}</strong>
              <small className="truncate text-xs text-[#667085]">{[template.componentName, template.name].filter(Boolean).join(' - ')}</small>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function businessLineKey(businessLine?: TechnicalMachineGroup | null) {
  return businessLine?.id ?? '__unassigned__';
}

function displayProductCategory(value?: string | null) {
  return value ? displayLabel(value) : '-';
}

function formatDashboardDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

function emptyEditMachineForm(): EditMachineForm {
  return {
    machineCode: '',
    serialNumber: '',
    name: '',
    modelName: '',
    manufacturer: '',
    productCategory: 'OTHER',
    status: 'ACTIVE',
    inventoryStatus: 'IN_STOCK',
    customerId: '',
    installDate: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    accessories: [],
  };
}

function buildEditMachineForm(machine: DashboardMachine): EditMachineForm {
  return {
    machineCode: machine.machineCode || '',
    serialNumber: machine.serialNumber || '',
    name: machine.name || '',
    modelName: machine.modelName || '',
    manufacturer: machine.manufacturer || '',
    productCategory: machine.productCategory || 'OTHER',
    status: machine.status || 'ACTIVE',
    inventoryStatus: machine.inventoryStatus || 'IN_STOCK',
    customerId: machine.customer?.id || '',
    installDate: toDateInput(machine.installDate),
    warrantyStartDate: toDateInput(machine.warrantyStartDate),
    warrantyEndDate: toDateInput(machine.warrantyEndDate),
    accessories: (machine.accessories ?? []).map((accessory) => ({
      clientId: accessory.id,
      id: accessory.id,
      componentAccessoryId: accessory.componentAccessory?.id ?? null,
      code: accessory.code || accessory.componentAccessory?.code || '',
      name: accessory.name || accessory.componentAccessory?.name || '',
      serialNumber: accessory.serialNumber || '',
      description: accessory.description || '',
      note: accessory.note || '',
    })),
  };
}

function emptyEditAccessoryForm(): EditMachineAccessoryForm {
  return {
    clientId: createAccessoryClientId(),
    code: '',
    name: '',
    serialNumber: '',
    description: '',
    note: '',
  };
}

function flattenTemplateAccessories(model: MachineModelDetail) {
  return (model.components ?? []).flatMap((component) =>
    (component.accessories ?? []).map((accessory) => ({
      ...accessory,
      componentName: component.name,
    })),
  );
}

function hasAccessoryContent(accessory: EditMachineAccessoryForm) {
  return Boolean(accessory.id || accessory.name.trim() || accessory.serialNumber.trim() || accessory.code.trim() || accessory.description.trim() || accessory.note.trim());
}

function isUltrasoundMachine(machine?: DashboardMachine | null) {
  return machine?.productCategory === 'ULTRASOUND';
}

function inventoryStatusFormPatch(inventoryStatus: string): Partial<EditMachineForm> {
  if (['IN_STOCK', 'ACCESSORY_SPLIT', 'RETURNED'].includes(inventoryStatus)) {
    return {
      status: inventoryStatus === 'RETURNED' ? 'REPAIRING' : 'ACTIVE',
      customerId: '',
      installDate: '',
      warrantyStartDate: '',
      warrantyEndDate: '',
    };
  }

  if (inventoryStatus === 'RESERVED') {
    return {
      status: 'ACTIVE',
      installDate: '',
      warrantyStartDate: '',
      warrantyEndDate: '',
    };
  }

  if (inventoryStatus === 'SOLD') {
    return {
      status: 'INACTIVE',
      installDate: '',
      warrantyStartDate: '',
      warrantyEndDate: '',
    };
  }

  return {};
}

function createAccessoryClientId() {
  return `new-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

const editLabelClass = 'grid min-w-0 gap-2 text-sm font-medium text-[#344054]';
const editFieldClass = 'h-11 min-w-0 rounded-lg border border-[#cfd8e3] bg-white px-3 text-[#101828] outline-none focus:border-[#d92d20] focus:shadow-[0_0_0_3px_rgba(217,45,32,0.12)]';

import { ArrowLeft, ChevronLeft, ChevronRight, Edit3, Eye, Loader2, PackageSearch, Plus, RotateCcw, Save, Search, Trash2, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Paginated, apiFetch, apiFetchAllPages } from '../../api';
import { Notice } from '../../components/Notice';
import { ModelInfoFields } from '../../components/ModelInfoFields';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { RoleName } from '../../auth/roles';
import { endoscopyAccessoryOptions, isEndoscopyMachineModel } from '../../config/endoscopyAccessories';
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
  manufacturingDate?: string | null;
  warehouseImportDate?: string | null;
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
  repairs?: Array<{
    id: string;
    code: string;
    status: string;
    reportedAt?: string | null;
    completedAt?: string | null;
    title?: string | null;
    resultNote?: string | null;
    engineer?: DashboardEngineer | null;
  }>;
  maintenances?: Array<{
    id: string;
    code: string;
    status: string;
    type?: string | null;
    scheduledDate?: string | null;
    completedAt?: string | null;
    resultNote?: string | null;
    nextDueDate?: string | null;
    engineer?: DashboardEngineer | null;
  }>;
  inventoryMovements?: Array<{
    id: string;
    code?: string | null;
    type: string;
    fromStatus?: string | null;
    toStatus: string;
    occurredAt: string;
    note?: string | null;
    customer?: DashboardCustomer | null;
    createdBy?: DashboardEngineer | null;
  }>;
  installations?: Array<{
    id: string;
    code: string;
    status: string;
    installedAt: string;
    customer?: DashboardCustomer | null;
    installedBy?: DashboardEngineer | null;
    warrantyCard?: {
      id: string;
      code: string;
      status: string;
      startDate: string;
      endDate: string;
    } | null;
  }>;
  warrantyCards?: Array<{
    id: string;
    code: string;
    status: string;
    startDate: string;
    endDate: string;
    note?: string | null;
  }>;
};

type MachineLifecycleEvent = {
  id: string;
  kind: 'installation' | 'warranty' | 'repair' | 'maintenance' | 'inventory';
  title: string;
  status?: string | null;
  date?: string | null;
  description?: string;
  meta?: string;
};

type EditMachineForm = {
  machineCode: string;
  serialNumber: string;
  machineModelId: string;
  name: string;
  modelName: string;
  manufacturer: string;
  productCategory: string;
  status: string;
  inventoryStatus: string;
  customerId: string;
  manufacturingDate: string;
  warehouseImportDate: string;
  installDate: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  accessories: EditMachineAccessoryForm[];
};

type BulkMachineForm = {
  machineModelId: string;
  modelName: string;
  manufacturer: string;
  productCategory: string;
  inventoryStatus: string;
  manufacturingDate: string;
  warehouseImportDate: string;
  serialRows: string;
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
  code?: string | null;
  name?: string | null;
  displayName?: string | null;
  manufacturer?: string | null;
  countryOfOrigin?: string | null;
  productCategory?: string | null;
  productLine?: string | null;
  businessLine?: {
    name?: string | null;
    countryOfOrigin?: string | null;
    productCategory?: string | null;
    productIndustry?: {
      name?: string | null;
    } | null;
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

type MachineModelOption = MachineModelDetail;

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
  const location = useLocation();
  const { machineId } = useParams();
  const isMachineEditRoute = Boolean(machineId && location.pathname.endsWith('/edit'));
  const [technicalMachines, setTechnicalMachines] = useState<TechnicalMachines | null>(null);
  const [customers, setCustomers] = useState<DashboardCustomer[]>([]);
  const [machineModels, setMachineModels] = useState<MachineModelOption[]>([]);
  const [selectedBusinessLineKey, setSelectedBusinessLineKey] = useState('ALL');
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [machineDetail, setMachineDetail] = useState<DashboardMachine | null>(null);
  const [loadingMachineDetail, setLoadingMachineDetail] = useState(false);
  const [editingMachine, setEditingMachine] = useState<DashboardMachine | null>(null);
  const [editForm, setEditForm] = useState<EditMachineForm>(() => emptyEditMachineForm());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState<BulkMachineForm>(() => emptyBulkMachineForm());
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

  const machineStatusSummary = useMemo(() => {
    const machines = technicalMachines?.machines ?? [];
    return {
      total: technicalMachines?.filteredTotal ?? 0,
      installed: machines.filter((machine) => machine.inventoryStatus === 'INSTALLED').length,
      inStock: machines.filter((machine) => machine.inventoryStatus === 'IN_STOCK').length,
      returned: machines.filter((machine) => machine.inventoryStatus === 'RETURNED').length,
    };
  }, [technicalMachines]);

  const machineIndustryChartItems = useMemo(
    () => technicalMachines?.businessLines.map((businessLine) => ({
      id: businessLineKey(businessLine),
      name: businessLine.name,
      count: businessLine.count,
    })) ?? [],
    [technicalMachines],
  );

  useEffect(() => {
    if (currentRole !== 'admin') return;
    void loadCustomers();
    void loadMachineModels();
  }, [currentRole]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (machineId) return;
    void loadTechnicalMachines();
  }, [machineId, search, selectedBusinessLineKey, installState, page, limit]);

  useEffect(() => {
    if (machineId) return;
    if (!selectedMachineId) {
      setMachineDetail(null);
      return;
    }
    void loadMachineDetail(selectedMachineId);
  }, [machineId, selectedMachineId]);

  useEffect(() => {
    if (!machineId) return;
    void loadMachineDetail(machineId);
  }, [machineId]);

  useEffect(() => {
    if (!machineDetail || !isMachineEditRoute) return;
    setEditingMachine(machineDetail);
    setEditForm(buildEditMachineForm(machineDetail));
    void loadAccessoryTemplates(machineDetail.machineModelId || undefined);
  }, [isMachineEditRoute, machineDetail?.id]);

  useEffect(() => {
    if (isMachineEditRoute) return;
    setEditingMachine(null);
  }, [isMachineEditRoute]);

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

  async function loadMachineModels() {
    try {
      const result = await apiFetchAllPages<MachineModelOption>('/machine-models');
      setMachineModels(result);
    } catch {
      setMachineModels([]);
    }
  }

  async function loadMachineDetail(machineId: string) {
    setLoadingMachineDetail(true);
    try {
      const result = await apiFetch<DashboardMachine>(`/machines/${machineId}`);
      setMachineDetail(result);
    } catch {
      setMachineDetail(null);
    } finally {
      setLoadingMachineDetail(false);
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
    navigate(`/technical-machines/${machine.id}/edit`);
  }

  async function loadAccessoryTemplates(nextMachineModelId?: string | null) {
    if (!nextMachineModelId) {
      setTemplateAccessories([]);
      return;
    }

    setLoadingAccessoryTemplates(true);
    try {
      const result = await apiFetch<MachineModelDetail>(`/machine-models/${nextMachineModelId}`);
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

  function selectEditMachineModel(machineModelId: string) {
    const model = machineModels.find((item) => item.id === machineModelId);
    updateEditForm({
      machineModelId,
      modelName: model?.name || model?.displayName || model?.code || editForm.modelName,
      manufacturer: model?.manufacturer || editForm.manufacturer,
      productCategory: model?.productCategory || model?.businessLine?.productCategory || editForm.productCategory,
    });
    void loadAccessoryTemplates(machineModelId);
  }

  function openBulkCreate() {
    setBulkForm(emptyBulkMachineForm());
    setBulkOpen(true);
    setError('');
    setSuccess('');
  }

  function updateBulkForm(patch: Partial<BulkMachineForm>) {
    setBulkForm((current) => ({ ...current, ...patch }));
  }

  function selectBulkMachineModel(machineModelId: string) {
    const model = machineModels.find((item) => item.id === machineModelId);
    updateBulkForm({
      machineModelId,
      modelName: model?.name || model?.displayName || model?.code || bulkForm.modelName,
      manufacturer: model?.manufacturer || bulkForm.manufacturer,
      productCategory: model?.productCategory || model?.businessLine?.productCategory || bulkForm.productCategory,
    });
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

  function toggleEndoscopyAccessory(name: string, checked: boolean) {
    setEditForm((current) => {
      const exists = current.accessories.some((accessory) => (accessory.name || accessory.code) === name);
      if (!checked) {
        return {
          ...current,
          accessories: current.accessories.filter((accessory) => (accessory.name || accessory.code) !== name),
        };
      }
      if (exists) return current;
      return {
        ...current,
        accessories: [...current.accessories, { ...emptyEditAccessoryForm(), code: name, name }],
      };
    });
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
          machineModelId: editForm.machineModelId || null,
          name: editForm.name.trim() || undefined,
          modelName: editForm.modelName.trim(),
          manufacturer: editForm.manufacturer.trim(),
          productCategory: editForm.productCategory,
          status: editForm.status,
          inventoryStatus: editForm.inventoryStatus,
          customerId: editForm.customerId || null,
          manufacturingDate: editForm.manufacturingDate || null,
          warehouseImportDate: editForm.warehouseImportDate || null,
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
      if (machineId) {
        await loadMachineDetail(machineId);
        navigate(`/technical-machines/${machineId}`);
      } else {
        await loadTechnicalMachines();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được thông tin máy.');
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkCreateMachines(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rows = parseBulkMachineRows(bulkForm.serialRows);

    if (!rows.length) {
      setError('Vui lòng nhập ít nhất 1 serial máy.');
      return;
    }

    if (!bulkForm.machineModelId && !bulkForm.modelName.trim()) {
      setError('Vui lòng chọn model hoặc nhập tên model cho lô máy.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      for (const row of rows) {
        await apiFetch('/machines', {
          method: 'POST',
          body: JSON.stringify({
            machineCode: row.machineCode || undefined,
            serialNumber: row.serialNumber,
            machineModelId: bulkForm.machineModelId || undefined,
            name: row.name || bulkForm.modelName.trim() || undefined,
            modelName: bulkForm.modelName.trim() || undefined,
            manufacturer: bulkForm.manufacturer.trim() || undefined,
            productCategory: bulkForm.productCategory,
            inventoryStatus: bulkForm.inventoryStatus,
            manufacturingDate: bulkForm.manufacturingDate || undefined,
            warehouseImportDate: bulkForm.warehouseImportDate || undefined,
            status: 'ACTIVE',
            dataStatus: 'VERIFIED',
          }),
        });
      }

      setSuccess(`Đã tạo ${rows.length} máy trong lô.`);
      setBulkOpen(false);
      setBulkForm(emptyBulkMachineForm());
      await loadTechnicalMachines();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được lô máy.');
    } finally {
      setSaving(false);
    }
  }

  const selectedEditModel = machineModels.find((model) => model.id === editForm.machineModelId);
  const isEditingUltrasound = isUltrasoundMachine(editingMachine) || editForm.productCategory === 'ULTRASOUND' || selectedEditModel?.productCategory === 'ULTRASOUND';
  const isEditingEndoscopy = isEndoscopyMachine(editingMachine) || editForm.productCategory === 'ENDOSCOPY' || isEndoscopyMachineModel(selectedEditModel);

  if (machineId) {
    const recordMachine = machineDetail?.id === machineId ? machineDetail : null;

    return (
      <PageFrame>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageTitle
            eyebrow="Hồ sơ máy"
            title={isMachineEditRoute ? 'Edit máy' : 'Thông tin máy'}
            description={recordMachine ? [recordMachine.machineCode, recordMachine.serialNumber, recordMachine.modelName].filter(Boolean).join(' - ') : 'Đang tải hồ sơ máy.'}
          />
          <Link className="secondary-button" to="/technical-machines">
            <ArrowLeft size={17} />
            Back
          </Link>
        </div>

        {error ? <Notice message={error} /> : null}
        {success ? <div className="success-notice">{success}</div> : null}

        {isMachineEditRoute ? (
          <MachineEditForm
            customers={customers}
            editForm={editForm}
            isEditingEndoscopy={isEditingEndoscopy}
            isEditingUltrasound={isEditingUltrasound}
            loading={loadingMachineDetail}
            loadingAccessoryTemplates={loadingAccessoryTemplates}
            machine={recordMachine}
            machineModels={machineModels}
            saving={saving}
            templateAccessories={templateAccessories}
            onAddAccessory={addAccessoryForm}
            onAddProbe={addProbeAccessory}
            onCancel={() => {
              setEditingMachine(null);
              navigate(`/technical-machines/${machineId}`);
            }}
            onRemoveAccessory={removeAccessoryForm}
            onSave={handleSaveMachine}
            onSelectModel={selectEditMachineModel}
            onToggleEndoscopy={toggleEndoscopyAccessory}
            onToggleTemplate={toggleTemplateAccessory}
            onUpdateAccessory={updateAccessoryForm}
            onUpdateForm={updateEditForm}
          />
        ) : (
          <MachineDetailPanel
            canEdit={currentRole === 'admin'}
            loading={loadingMachineDetail}
            machine={recordMachine}
            onEdit={openEditMachine}
          />
        )}
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Phòng kỹ thuật"
          title="Danh sách máy quản lý"
          description="Tra cứu máy theo ngành hàng, S/N và khách hàng."
        />
          <button className="secondary-button" onClick={() => navigate('/')} type="button">
            <ArrowLeft size={17} />
          Back
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="grid gap-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <MachineIndustryBarChart
            activeId={selectedBusinessLineKey}
            items={machineIndustryChartItems}
            loading={loading}
            onSelect={(nextId) => {
              setSelectedBusinessLineKey(nextId);
              setSelectedMachineId(null);
              setPage(1);
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <MachineSummaryCard label="Tổng kết quả" value={machineStatusSummary.total} />
            <MachineSummaryCard label="Đã lắp" tone="green" value={machineStatusSummary.installed} />
            <MachineSummaryCard label="Trong kho" tone="blue" value={machineStatusSummary.inStock} />
            <MachineSummaryCard label="Thu hồi" tone="amber" value={machineStatusSummary.returned} />
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border border-[#d8e0ea] bg-white p-3 shadow-[0_10px_28px_rgba(24,24,27,0.05)]">
          {currentRole === 'admin' ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-3 py-2">
              <div>
                <strong className="block text-sm text-[#18181b]">Nhập máy theo lô</strong>
                <span className="text-xs font-medium text-[#64748b]">Dán nhiều serial, hệ thống sẽ tạo nhiều hồ sơ máy cùng model.</span>
              </div>
              <button className="primary-button bg-[#2563eb] hover:bg-[#1d4ed8]" onClick={openBulkCreate} type="button">
                <Plus size={17} />
                Nhập lô máy
              </button>
            </div>
          ) : null}
          <div className="grid gap-3 min-[1120px]:grid-cols-[minmax(240px,320px)_minmax(260px,1fr)_180px_150px_auto]">
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#666666]">
              Ngành hàng
              <select
                className="h-11 min-w-0 rounded-lg border border-[#d6d6d6] bg-white px-3 text-sm font-medium text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]"
                onChange={(event) => {
                  setSelectedBusinessLineKey(event.target.value);
                  setSelectedMachineId(null);
                  setPage(1);
                }}
                value={selectedBusinessLineKey}
              >
                <option value="ALL">Tất cả ngành hàng ({technicalMachines?.businessLines.reduce((sum, item) => sum + item.count, 0) ?? 0})</option>
                {technicalMachines?.businessLines.map((businessLine) => (
                  <option key={businessLineKey(businessLine)} value={businessLineKey(businessLine)}>
                    {businessLine.name} ({businessLine.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8a8a]" size={17} />
              <input
                className="mt-[22px] h-11 w-full min-w-0 rounded-lg border border-[#d6d6d6] bg-[#fafafa] pl-9 pr-3 text-[#1f1f1f] outline-none focus:border-[#18181b] focus:bg-white focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm S/N, model, khách hàng, đầu dò..."
                value={searchInput}
              />
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#666666]">
              Trạng thái
              <select
                className="h-11 min-w-0 rounded-lg border border-[#d6d6d6] bg-white px-3 text-sm text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]"
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
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#666666]">
              Số dòng
              <select
                className="h-11 min-w-0 rounded-lg border border-[#d6d6d6] bg-white px-3 text-sm text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]"
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(1);
                  setSelectedMachineId(null);
                }}
                value={limit}
              >
                <option value={10}>10 dòng</option>
                <option value={25}>25 dòng</option>
                <option value={50}>50 dòng</option>
                <option value={100}>100 dòng</option>
              </select>
            </label>
            <button className="secondary-button mt-[22px] justify-center" onClick={resetFilters} type="button">
              <RotateCcw size={17} />
              Đặt lại
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_12px_34px_rgba(24,24,27,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeeee] bg-[#fafafa] px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-[#1f1f1f]">Danh sách máy</h2>
              <p className="mt-1 text-sm text-[#666666]">
                {selectedBusinessLine?.name ?? 'Tất cả ngành hàng'} - {technicalMachines?.filteredTotal ?? 0} kết quả
              </p>
            </div>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#dbe5ef] bg-white px-2.5 text-sm font-medium text-[#18181b]">
              {loading ? <Loader2 className="spin-icon" size={17} /> : <PackageSearch size={17} />}
              {loading ? '-' : technicalMachines?.total ?? 0}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse">
              <thead>
                <tr className="border-b border-[#eeeeee] text-left text-xs font-semibold text-[#666666]">
                  <th className="px-4 py-3">Máy</th>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Bảo hành</th>
                  <th className="px-4 py-3">Kỹ sư</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {technicalMachines?.machines.map((machine) => (
                  <MachineTableRow canEdit={currentRole === 'admin'} key={machine.id} machine={machine} />
                ))}
                {loading ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm font-semibold text-[#666666]" colSpan={6}>
                      <Loader2 className="spin-icon mx-auto mb-2" size={20} />
                      Đang tải danh sách máy
                    </td>
                  </tr>
                ) : null}
                {!loading && !technicalMachines?.machines.length ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-[#666666]" colSpan={6}>
                      Không có máy phù hợp bộ lọc.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#eeeeee] px-4 py-3">
            <button
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-2.5 text-sm font-medium text-[#333333] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              type="button"
            >
              <ChevronLeft size={16} />
              Trước
            </button>
            <span className="text-sm font-semibold text-[#666666]">
              Trang {technicalMachines?.page ?? page}/{technicalMachines?.totalPages ?? 1}
            </span>
            <button
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-2.5 text-sm font-medium text-[#333333] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={loading || page >= (technicalMachines?.totalPages ?? 1)}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Sau
              <ChevronRight size={16} />
            </button>
          </div>
        </section>
      </section>

      {editingMachine && !machineId ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-5" role="presentation">
          <form className="grid max-h-[calc(100vh-40px)] w-full max-w-[920px] gap-4 overflow-y-auto rounded-lg border border-[#e5e5e5] bg-white p-5 shadow-[0_24px_70px_rgba(24,24,27,0.22)]" onSubmit={handleSaveMachine}>
            <div className="flex items-start justify-between gap-3 border-b border-[#eeeeee] pb-3">
              <div>
                <span className="text-[12px] font-medium text-[#666666]">Chuẩn hóa hồ sơ máy</span>
                <h2 className="mt-1 text-xl font-medium text-[#1f1f1f]">{editingMachine?.serialNumber}</h2>
              </div>
              <button className="icon-button" onClick={() => setEditingMachine(null)} title="Đóng" type="button">
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className={editLabelClass}>
                Mã máy (tự sinh nếu để trống khi tạo mới)
                <input className={editFieldClass} onChange={(event) => updateEditForm({ machineCode: event.target.value })} placeholder="VD: XCUBE50-001" value={editForm.machineCode} />
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
              <label className={editLabelClass}>
                Ngày sản xuất
                <input className={editFieldClass} onChange={(event) => updateEditForm({ manufacturingDate: event.target.value })} type="date" value={editForm.manufacturingDate} />
              </label>
              <label className={editLabelClass}>
                Ngày nhập kho
                <input className={editFieldClass} onChange={(event) => updateEditForm({ warehouseImportDate: event.target.value })} type="date" value={editForm.warehouseImportDate} />
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

            <section className="grid gap-3 border-t border-[#eeeeee] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[12px] font-medium text-[#666666]">Đầu dò / Phụ kiện</span>
                  <h3 className="mt-1 text-base font-medium text-[#1f1f1f]">{editForm.accessories.length} dòng phụ kiện</h3>
                </div>
                <button className="secondary-button" onClick={addAccessoryForm} type="button">
                  <Plus size={16} />
                  Add accessory
                </button>
              </div>

              {isEditingUltrasound ? (
                <ProbePicker onSelect={addProbeAccessory} />
              ) : isEditingEndoscopy ? (
                <EndoscopyAccessoryChecklist
                  selectedNames={new Set(editForm.accessories.map((accessory) => accessory.name || accessory.code).filter((name): name is string => Boolean(name)))}
                  onToggle={toggleEndoscopyAccessory}
                />
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
                  <div className="grid gap-3 rounded-lg border border-[#eeeeee] bg-[#fafafa] p-3" key={accessory.clientId}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-[#333333]">Phụ kiện {index + 1}</span>
                      <button className="icon-button" onClick={() => removeAccessoryForm(accessory.clientId)} title="Delete accessory" type="button">
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
                {editForm.accessories.length === 0 ? <EmptyState text="Máy này chưa có phụ kiện. Bấm Add accessory để khai báo." /> : null}
              </div>
            </section>

            <div className="flex justify-end gap-2 border-t border-[#eeeeee] pt-4">
              <button className="secondary-button" disabled={saving} onClick={() => setEditingMachine(null)} type="button">Cancel</button>
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
                {saving ? 'Saving' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {bulkOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-5" role="presentation">
          <form className="grid max-h-[calc(100vh-40px)] w-full max-w-[900px] gap-4 overflow-y-auto rounded-2xl border border-[#dbeafe] bg-white p-5 shadow-[0_24px_70px_rgba(24,24,27,0.22)]" onSubmit={handleBulkCreateMachines}>
            <div className="flex items-start justify-between gap-3 border-b border-[#eeeeee] pb-3">
              <div>
                <span className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#2563eb]">Nhập lô máy</span>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#18181b]">Tạo nhiều hồ sơ máy cùng lúc</h2>
                <p className="mt-1 text-sm text-[#64748b]">Mỗi dòng là Serial, hoặc Serial | Mã máy | Tên máy.</p>
              </div>
              <button className="icon-button" onClick={() => setBulkOpen(false)} title="Đóng" type="button">
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className={`${editLabelClass} md:col-span-2`}>
                Model cố định cho cả lô
                <select className={editFieldClass} onChange={(event) => selectBulkMachineModel(event.target.value)} required value={bulkForm.machineModelId}>
                  <option value="">Chọn model trong danh mục</option>
                  {machineModels.map((model) => (
                    <option key={model.id} value={model.id}>{modelOptionText(model)}</option>
                  ))}
                </select>
              </label>
              <ModelInfoFields className="md:col-span-2" model={machineModels.find((model) => model.id === bulkForm.machineModelId)} />
              <label className={editLabelClass}>
                Tên model hiển thị
                <input className={editFieldClass} onChange={(event) => updateBulkForm({ modelName: event.target.value })} required value={bulkForm.modelName} />
              </label>
              <label className={editLabelClass}>
                Hãng
                <input className={editFieldClass} onChange={(event) => updateBulkForm({ manufacturer: event.target.value })} value={bulkForm.manufacturer} />
              </label>
              <label className={editLabelClass}>
                Loại thiết bị
                <select className={editFieldClass} onChange={(event) => updateBulkForm({ productCategory: event.target.value })} value={bulkForm.productCategory}>
                  {['ULTRASOUND', 'LAB_TESTING', 'BIOCHEMISTRY', 'IMMUNOLOGY', 'HEMATOLOGY', 'X_RAY', 'ENDOSCOPY', 'OTHER'].map((value) => (
                    <option key={value} value={value}>{displayLabel(value)}</option>
                  ))}
                </select>
              </label>
              <label className={editLabelClass}>
                Trạng thái kho
                <select className={editFieldClass} onChange={(event) => updateBulkForm({ inventoryStatus: event.target.value })} value={bulkForm.inventoryStatus}>
                  {['IN_STOCK', 'RESERVED'].map((value) => (
                    <option key={value} value={value}>{displayLabel(value)}</option>
                  ))}
                </select>
              </label>
              <label className={editLabelClass}>
                Ngày sản xuất
                <input className={editFieldClass} onChange={(event) => updateBulkForm({ manufacturingDate: event.target.value })} type="date" value={bulkForm.manufacturingDate} />
              </label>
              <label className={editLabelClass}>
                Ngày nhập kho
                <input className={editFieldClass} onChange={(event) => updateBulkForm({ warehouseImportDate: event.target.value })} type="date" value={bulkForm.warehouseImportDate} />
              </label>
              <label className={`${editLabelClass} md:col-span-2`}>
                Danh sách serial
                <textarea
                  className={`${editFieldClass} min-h-[220px] py-3 font-mono text-sm`}
                  onChange={(event) => updateBulkForm({ serialRows: event.target.value })}
                  placeholder={'AF3-2605-00012\nAF3-2605-00013 | AIRF13C-002 | Máy lọc không khí chuẩn\nAF3-2605-00014'}
                  required
                  value={bulkForm.serialRows}
                />
              </label>
            </div>

            <div className="rounded-xl border border-[#dbeafe] bg-[#eff6ff] px-3 py-2 text-sm font-medium text-[#1d4ed8]">
              Số máy sẽ tạo: {parseBulkMachineRows(bulkForm.serialRows).length}
            </div>

            <div className="flex justify-end gap-2 border-t border-[#eeeeee] pt-4">
              <button className="secondary-button" disabled={saving} onClick={() => setBulkOpen(false)} type="button">Đóng</button>
              <button className="primary-button bg-[#2563eb] hover:bg-[#1d4ed8]" disabled={saving} type="submit">
                {saving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
                {saving ? 'Đang tạo' : 'Tạo lô máy'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </PageFrame>
  );
}

function MachineDetailPanel({
  canEdit,
  loading,
  machine,
  onEdit,
}: {
  canEdit: boolean;
  loading: boolean;
  machine: DashboardMachine | null;
  onEdit: (machine: DashboardMachine) => void;
}) {
  if (!machine) {
    return (
      <aside className="rounded-lg border border-[#e5e5e5] bg-white p-6">
        <EmptyState text="Chọn S/N để xem thông tin máy." />
      </aside>
    );
  }

  const latestInstallation = machine.installation ?? machine.installations?.[0] ?? null;
  const latestInstallationCustomer = machine.installations?.[0]?.customer ?? null;
  const customer = machine.customer ?? latestInstallationCustomer;
  const installAddress = machine.installation?.receiverInstallAddress || customer?.fullAddress || customer?.address || '';
  const accessories = machine.accessories ?? [];
  const repairs = machine.repairs ?? [];
  const maintenances = machine.maintenances ?? [];
  const installations = machine.installations ?? [];
  const movements = machine.inventoryMovements ?? [];
  const warrantyCards = machine.warrantyCards ?? [];
  const warrantyEndDate = machine.warrantyEndDate ?? warrantyCards[0]?.endDate ?? latestInstallation?.warrantyCard?.endDate;
  const lifecycleEvents = buildMachineLifecycleEvents(machine);

  return (
    <aside className="grid min-w-0 gap-4 self-start">
      <div className="min-w-0 rounded-lg border border-[#e5e5e5] bg-white p-6 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
        <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-medium leading-tight text-[#1f1f1f]">Thông tin máy</h2>
            <p className="mt-1 text-lg font-medium text-[#18181b]">{machine.serialNumber}</p>
            {loading ? <span className="mt-1 inline-flex items-center gap-2 text-xs text-[#666666]"><Loader2 className="spin-icon" size={14} />Đang tải hồ sơ đầy đủ</span> : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {machine.dataStatus === 'PENDING_REVIEW' ? (
              <span className="inline-flex min-h-8 items-center rounded-full border border-[#efd8a8] bg-[#fff8ed] px-3 text-sm font-medium text-[#9b5a17]">Chờ xác minh</span>
            ) : null}
            <span className="inline-flex min-h-8 items-center rounded-full bg-[#eef6ff] px-3 text-sm font-medium text-[#18181b]">
              {displayLabel(machine.inventoryStatus || machine.status || '')}
            </span>
            {canEdit ? (
              <button className="secondary-button" onClick={() => onEdit(machine)} type="button">
                <Edit3 size={16} />
                Edit
              </button>
            ) : null}
          </div>
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ProfileStat label="Sửa chữa" value={repairs.length} />
          <ProfileStat label="Bảo trì" value={maintenances.length} />
          <ProfileStat label="Luân chuyển kho" value={movements.length} />
          <ProfileStat label="Phụ kiện" value={accessories.length} />
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <InfoItem label="Model" value={machine.modelName} />
          <InfoItem label="Mã máy" value={machine.machineCode} />
          <InfoItem label="Tên máy" value={machine.name || machine.modelName} />
          <InfoItem label="Hãng" value={machine.manufacturer} />
          <InfoItem label="Loại thiết bị" value={displayProductCategory(machine.productCategory)} />
          <InfoItem label="Ngày sản xuất" value={formatDashboardDate(machine.manufacturingDate)} />
          <InfoItem label="Ngày nhập kho" value={formatDashboardDate(machine.warehouseImportDate)} />
          <InfoItem label="Ngày lắp" value={formatDashboardDate(machine.installDate)} />
          <InfoItem label="Hết bảo hành" value={formatDashboardDate(warrantyEndDate)} />
          <InfoItem label="Kỹ sư lắp đặt" value={machine.installedBy?.fullName} />
          <InfoItem label="Kỹ sư phụ trách" value={machine.primaryEngineer?.fullName} />
        </div>

        <div className="mt-6 border-t border-[#eeeeee] pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-xl font-medium text-[#1f1f1f]">Đầu dò / Phụ kiện</h3>
            <span className="rounded-full bg-[#fafafa] px-3 py-1 text-sm font-medium text-[#18181b]">{accessories.length}</span>
          </div>
          {accessories.length ? (
            <div className="grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {accessories.map((accessory) => (
                <div className="grid min-w-0 gap-2 rounded-lg border border-[#eeeeee] bg-[#fafafa] p-4" key={accessory.id}>
                  <div className="grid gap-1">
                    <span className="text-[12px] font-medium text-[#666666]">
                      {accessory.componentAccessory?.component?.name || accessory.componentAccessory?.name || accessory.code || 'Phụ kiện'}
                    </span>
                    <strong className="break-words text-base font-medium leading-snug text-[#1f1f1f]">{accessory.name}</strong>
                  </div>
                  <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-2 text-sm">
                    <span className="font-semibold text-[#666666]">S/N</span>
                    <strong className="break-words text-[#18181b]">{accessory.serialNumber || '-'}</strong>
                    <span className="font-semibold text-[#666666]">Mã</span>
                    <span className="break-words text-[#333333]">{accessory.code || accessory.componentAccessory?.code || '-'}</span>
                  </div>
                  {accessory.note || accessory.description ? (
                    <p className="text-sm leading-snug text-[#666666]">{accessory.note || accessory.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Chưa có thông tin đầu dò/phụ kiện." />
          )}
        </div>
      </div>

      <div className="min-w-0 rounded-lg border border-[#e5e5e5] bg-white p-6 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
        <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
          <h2 className="text-2xl font-medium leading-tight text-[#1f1f1f]">Khách hàng đã lắp máy</h2>
          {latestInstallation?.code ? <span className="rounded-full bg-[#fafafa] px-3 py-1 text-sm font-semibold text-[#666666]">{latestInstallation.code}</span> : null}
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

      <MachineLifecycleTimeline events={lifecycleEvents} />

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <TimelineBox
          emptyText="Chưa có lịch sử sửa chữa."
          items={repairs.slice(0, 5).map((repair) => ({
            id: repair.id,
            title: `${repair.code} - ${displayLabel(repair.status)}`,
            date: formatDashboardDate(repair.completedAt || repair.reportedAt),
            description: [repair.title, repair.resultNote, repair.engineer?.fullName].filter(Boolean).join(' - '),
          }))}
          title="Sửa chữa gần đây"
        />
        <TimelineBox
          emptyText="Chưa có lịch sử bảo trì."
          items={maintenances.slice(0, 5).map((maintenance) => ({
            id: maintenance.id,
            title: `${maintenance.code} - ${displayLabel(maintenance.status)}`,
            date: formatDashboardDate(maintenance.completedAt || maintenance.scheduledDate),
            description: [displayLabel(maintenance.type || ''), maintenance.resultNote, maintenance.engineer?.fullName, maintenance.nextDueDate ? `Hẹn lại ${formatDashboardDate(maintenance.nextDueDate)}` : ''].filter(Boolean).join(' - '),
          }))}
          title="Bảo trì"
        />
        <TimelineBox
          emptyText="Chưa có lịch sử kho."
          items={movements.slice(0, 5).map((movement) => ({
            id: movement.id,
            title: `${displayLabel(movement.type)}: ${displayLabel(movement.fromStatus || '')} → ${displayLabel(movement.toStatus)}`,
            date: formatDashboardDate(movement.occurredAt),
            description: [movement.customer?.name, movement.createdBy?.fullName, movement.note].filter(Boolean).join(' - '),
          }))}
          title="Lịch sử kho"
        />
        <TimelineBox
          emptyText="Chưa có lịch sử lắp đặt."
          items={installations.slice(0, 5).map((installation) => ({
            id: installation.id,
            title: `${installation.code} - ${displayLabel(installation.status)}`,
            date: formatDashboardDate(installation.installedAt),
            description: [installation.customer?.name, installation.installedBy?.fullName, installation.warrantyCard?.endDate ? `BH đến ${formatDashboardDate(installation.warrantyCard.endDate)}` : ''].filter(Boolean).join(' - '),
          }))}
          title="Lắp đặt"
        />
        <TimelineBox
          emptyText="Chưa có thẻ bảo hành."
          items={warrantyCards.slice(0, 5).map((card) => ({
            id: card.id,
            title: `${card.code} - ${displayLabel(card.status)}`,
            date: `${formatDashboardDate(card.startDate)} - ${formatDashboardDate(card.endDate)}`,
            description: card.note || '',
          }))}
          title="Bảo hành"
        />
      </div>
    </aside>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#eeeeee] bg-[#fafafa] p-3">
      <span className="text-xs font-medium text-[#666666]">{label}</span>
      <strong className="mt-1 block text-2xl leading-none text-[#1f1f1f]">{value}</strong>
    </div>
  );
}

function MachineLifecycleTimeline({ events }: { events: MachineLifecycleEvent[] }) {
  const latestEvents = events.slice(0, 12);

  return (
    <section className="min-w-0 rounded-lg border border-[#e5e5e5] bg-white p-6 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[12px] font-semibold text-[#666666]">Vòng đời thiết bị</span>
          <h2 className="mt-1 text-2xl font-medium leading-tight text-[#1f1f1f]">Timeline hồ sơ máy</h2>
          <p className="mt-1 text-sm leading-6 text-[#666666]">Lịch sử vòng đời thiết bị theo thời gian.</p>
        </div>
        <span className="inline-flex min-h-9 items-center rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 text-sm font-semibold text-[#18181b]">
          {events.length} sự kiện
        </span>
      </div>

      {latestEvents.length ? (
        <div className="relative grid gap-0 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-[#e5e5e5]">
          {latestEvents.map((event) => (
            <article className="relative grid gap-2 pb-5 pl-10 last:pb-0" key={`${event.kind}-${event.id}`}>
              <span className={`absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold ${lifecycleKindClass(event.kind)}`}>
                {lifecycleKindShortLabel(event.kind)}
              </span>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666666]">
                    <span>{lifecycleKindLabel(event.kind)}</span>
                    {event.date ? <span>{formatDashboardDate(event.date)}</span> : null}
                    {event.meta ? <span>{event.meta}</span> : null}
                  </div>
                  <h3 className="mt-1 break-words text-base font-semibold leading-snug text-[#1f1f1f]">{event.title}</h3>
                </div>
                {event.status ? (
                  <span className={`inline-flex min-h-7 shrink-0 items-center rounded-full border px-2.5 text-xs font-semibold ${lifecycleStatusClass(event.status)}`}>
                    {displayLabel(event.status)}
                  </span>
                ) : null}
              </div>
              {event.description ? <p className="break-words text-sm leading-6 text-[#666666]">{event.description}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState text="Chưa có lịch sử vòng đời cho máy này." />
      )}
    </section>
  );
}

function TimelineBox({
  emptyText,
  items,
  title,
}: {
  emptyText: string;
  items: Array<{ id: string; title: string; date?: string; description?: string }>;
  title: string;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
      <h3 className="text-base font-medium text-[#1f1f1f]">{title}</h3>
      <div className="mt-3 grid gap-2">
        {items.length ? items.map((item) => (
          <div className="grid gap-1 rounded-lg border border-[#eeeeee] bg-[#fafafa] p-3" key={item.id}>
            <div className="flex items-start justify-between gap-2">
              <strong className="text-sm leading-snug text-[#1f1f1f]">{item.title}</strong>
              {item.date ? <span className="shrink-0 text-xs font-medium text-[#666666]">{item.date}</span> : null}
            </div>
            {item.description ? <p className="text-xs leading-snug text-[#666666]">{item.description}</p> : null}
          </div>
        )) : <EmptyState text={emptyText} />}
      </div>
    </section>
  );
}

function MachineListActionPanel({ canEdit, machine }: { canEdit: boolean; machine: DashboardMachine | null }) {
  return (
    <aside className="grid min-w-0 gap-4 self-start rounded-lg border border-[#e5e5e5] bg-white p-6 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
      <div>
        <span className="text-[12px] font-medium text-[#666666]">Thao tác hồ sơ</span>
        <h2 className="mt-1 text-2xl font-medium leading-tight text-[#1f1f1f]">Mở trang riêng để xem hoặc sửa</h2>
        <p className="mt-2 text-sm leading-6 text-[#666666]">
          Hồ sơ máy, lịch sử kho, sửa chữa và phụ kiện sẽ hiển thị trên một trang riêng để dễ đọc hơn.
        </p>
      </div>

      {machine ? (
        <div className="grid gap-3 rounded-lg border border-[#eeeeee] bg-[#fafafa] p-4">
          <div>
            <strong className="block text-lg text-[#18181b]">{machine.serialNumber}</strong>
            <span className="text-sm text-[#666666]">{[machine.machineCode, machine.modelName, machine.customer?.name].filter(Boolean).join(' - ') || 'Chưa có thông tin thêm'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="primary-button" to={`/technical-machines/${machine.id}`}>
              <Eye size={16} />
              Xem thông tin
            </Link>
            {canEdit ? (
              <Link className="secondary-button" to={`/technical-machines/${machine.id}/edit`}>
                <Edit3 size={16} />
                Edit
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <EmptyState text="Chọn một S/N trong danh sách để mở hồ sơ máy." />
      )}
    </aside>
  );
}

function MachineSummaryCard({ label, tone = 'neutral', value }: { label: string; tone?: 'neutral' | 'green' | 'blue' | 'amber'; value: number }) {
  const toneClass = {
    neutral: 'bg-[#fafafa] text-[#333333]',
    green: 'bg-[#eefaf3] text-[#177245]',
    blue: 'bg-[#eef6ff] text-[#18181b]',
    amber: 'bg-[#fff8ed] text-[#9b5a17]',
  }[tone];

  return (
    <div className="grid gap-2 rounded-lg border border-[#d8e0ea] bg-white p-4 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
      <span className="text-sm font-medium text-[#666666]">{label}</span>
      <div className="flex items-end justify-between gap-3">
        <strong className="text-3xl font-semibold leading-none text-[#1f1f1f]">{value}</strong>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>
          <PackageSearch size={16} />
        </span>
      </div>
    </div>
  );
}

function MachineIndustryBarChart({
  activeId,
  items,
  loading,
  onSelect,
}: {
  activeId: string;
  items: Array<{ id: string; name: string; count: number }>;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  const maxCount = Math.max(1, ...items.map((item) => item.count));

  return (
    <section className="grid min-h-[300px] gap-5 rounded-lg border border-[#d8e0ea] bg-white p-5 shadow-[0_12px_34px_rgba(24,24,27,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[12px] font-semibold text-[#666666]">Biểu đồ ngành hàng</span>
          <h2 className="mt-1 text-xl font-semibold text-[#1f1f1f]">Số máy theo ngành hàng</h2>
        </div>
        <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#dbe5ef] bg-[#fafafa] px-2.5 text-sm font-medium text-[#18181b]">
          <PackageSearch size={17} />
          {items.reduce((sum, item) => sum + item.count, 0)}
        </span>
      </div>

      {loading ? (
        <div className="grid min-h-[180px] place-items-center rounded-lg border border-dashed border-[#d7e0eb] bg-[#fafafa] text-sm font-semibold text-[#666666]">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="spin-icon" size={17} />
            Đang tải biểu đồ
          </span>
        </div>
      ) : null}

      {!loading && items.length ? (
        <div className="grid min-h-[220px] grid-cols-[repeat(auto-fit,minmax(88px,1fr))] items-end gap-3">
          {items.map((item) => {
            const height = Math.max(12, Math.round((item.count / maxCount) * 100));
            return (
              <button
                className={`group grid h-full min-h-[220px] items-end gap-2 rounded-lg border p-2 text-center transition hover:border-[#b8cbe1] hover:bg-[#fafafa] ${activeId === item.id ? 'border-[#b8cbe1] bg-[#f3f8ff]' : 'border-transparent'}`}
                key={item.id}
                onClick={() => onSelect(item.id)}
                type="button"
              >
                <span className="text-sm font-semibold tabular-nums text-[#1f1f1f]">{item.count}</span>
                <span className="flex h-36 items-end rounded-lg bg-[#eeeeee] p-1.5">
                  <span
                    className={`block w-full rounded-md transition-all duration-300 group-hover:bg-[#18181b] ${activeId === item.id ? 'bg-[#18181b]' : 'bg-[#18181b]'}`}
                    style={{ height: `${height}%` }}
                  />
                </span>
                <span className="line-clamp-2 min-h-9 text-xs font-medium leading-snug text-[#666666]">{item.name}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {!loading && !items.length ? <EmptyState text="Chưa có dữ liệu ngành hàng để hiển thị biểu đồ." /> : null}
    </section>
  );
}

function MachineTableRow({ canEdit, machine }: { canEdit: boolean; machine: DashboardMachine }) {
  const customerName = machine.customer?.hospitalName || machine.customer?.name || '';
  const warrantyText = machine.warrantyEndDate ? formatDashboardDate(machine.warrantyEndDate) : '';
  const engineerName = machine.primaryEngineer?.fullName || machine.installedBy?.fullName || machine.primaryEngineer?.email || machine.installedBy?.email || '';

  return (
    <tr className="border-b border-[#eeeeee] transition hover:bg-[#fafafa]">
      <td className="px-4 py-3">
        <div className="grid gap-1">
          <Link className="font-semibold text-[#18181b] hover:underline" to={`/technical-machines/${machine.id}`}>
            {machine.serialNumber}
          </Link>
          <span className="text-sm text-[#1f1f1f]">{machine.machineCode || machine.name || 'Chưa có mã máy'}</span>
          <span className="text-xs text-[#666666]">{machine.modelName}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="grid gap-1 text-sm">
          <strong className="max-w-[240px] truncate text-[#1f1f1f]">{customerName || 'Chưa gắn khách hàng'}</strong>
          <span className="text-xs text-[#666666]">{[machine.customer?.province, machine.customer?.phone || machine.customer?.contactPhone].filter(Boolean).join(' - ') || '-'}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <StatusPill value={machine.inventoryStatus || ''} />
          <StatusPill subtle value={machine.status || ''} />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="grid gap-1 text-sm">
          <strong className={warrantyClass(machine.warrantyEndDate)}>{warrantyText || 'Chưa có hạn'}</strong>
          <span className="text-xs text-[#666666]">{machine.installDate ? `Lắp ${formatDashboardDate(machine.installDate)}` : 'Chưa có ngày lắp'}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-[#333333]">{engineerName || '-'}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <Link className="secondary-button compact" to={`/technical-machines/${machine.id}`}>
            <Eye size={16} />
            View
          </Link>
          {canEdit ? (
            <Link className="primary-button compact" to={`/technical-machines/${machine.id}/edit`}>
              <Edit3 size={16} />
              Edit
            </Link>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function StatusPill({ subtle, value }: { subtle?: boolean; value: string }) {
  if (!value) return null;
  const color = subtle ? 'border-[#e5e5e5] bg-[#fafafa] text-[#333333]' : statusPillTone(value);
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${color}`}>{displayLabel(value)}</span>;
}

function statusPillTone(value: string) {
  if (value === 'INSTALLED' || value === 'ACTIVE') return 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]';
  if (value === 'IN_STOCK' || value === 'RESERVED') return 'border-[#b8cbe1] bg-[#eef6ff] text-[#18181b]';
  if (value === 'RETURNED' || value === 'REPAIRING' || value === 'MAINTENANCE') return 'border-[#efd8a8] bg-[#fff8ed] text-[#9b5a17]';
  if (value === 'SOLD' || value === 'INACTIVE') return 'border-[#e4e4e7] bg-[#f4f4f5] text-[#18181b]';
  return 'border-[#e5e5e5] bg-[#fafafa] text-[#333333]';
}

function buildMachineLifecycleEvents(machine: DashboardMachine): MachineLifecycleEvent[] {
  const events: MachineLifecycleEvent[] = [];

  (machine.installations ?? []).forEach((installation) => {
    events.push({
      id: installation.id,
      kind: 'installation',
      title: `${installation.code} - ${installation.customer?.hospitalName || installation.customer?.name || 'Lắp đặt máy'}`,
      status: installation.status,
      date: installation.installedAt,
      description: [installation.installedBy?.fullName, installation.warrantyCard?.endDate ? `Bảo hành đến ${formatDashboardDate(installation.warrantyCard.endDate)}` : ''].filter(Boolean).join(' - '),
      meta: installation.code,
    });
  });

  (machine.warrantyCards ?? []).forEach((card) => {
    events.push({
      id: card.id,
      kind: 'warranty',
      title: `${card.code} - Thẻ bảo hành`,
      status: card.status,
      date: card.startDate,
      description: [`Hiệu lực ${formatDashboardDate(card.startDate)} - ${formatDashboardDate(card.endDate)}`, card.note].filter(Boolean).join(' - '),
      meta: card.code,
    });
  });

  (machine.repairs ?? []).forEach((repair) => {
    events.push({
      id: repair.id,
      kind: 'repair',
      title: `${repair.code} - ${repair.title || 'Sửa chữa'}`,
      status: repair.status,
      date: repair.completedAt || repair.reportedAt,
      description: [repair.resultNote, repair.engineer?.fullName].filter(Boolean).join(' - '),
      meta: repair.code,
    });
  });

  (machine.maintenances ?? []).forEach((maintenance) => {
    events.push({
      id: maintenance.id,
      kind: 'maintenance',
      title: `${maintenance.code} - ${displayLabel(maintenance.type || 'Bảo trì')}`,
      status: maintenance.status,
      date: maintenance.completedAt || maintenance.scheduledDate,
      description: [maintenance.resultNote, maintenance.engineer?.fullName, maintenance.nextDueDate ? `Hẹn lại ${formatDashboardDate(maintenance.nextDueDate)}` : ''].filter(Boolean).join(' - '),
      meta: maintenance.code,
    });
  });

  (machine.inventoryMovements ?? []).forEach((movement) => {
    events.push({
      id: movement.id,
      kind: 'inventory',
      title: `${displayLabel(movement.type)}: ${displayLabel(movement.fromStatus || '')} -> ${displayLabel(movement.toStatus)}`,
      status: movement.toStatus,
      date: movement.occurredAt,
      description: [movement.customer?.hospitalName || movement.customer?.name, movement.createdBy?.fullName, movement.note].filter(Boolean).join(' - '),
      meta: movement.code || undefined,
    });
  });

  return events.sort((left, right) => lifecycleDateValue(right.date) - lifecycleDateValue(left.date));
}

function lifecycleDateValue(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function lifecycleKindLabel(kind: MachineLifecycleEvent['kind']) {
  const labels: Record<MachineLifecycleEvent['kind'], string> = {
    installation: 'Lắp đặt',
    warranty: 'Bảo hành',
    repair: 'Sửa chữa',
    maintenance: 'Bảo trì',
    inventory: 'Kho',
  };
  return labels[kind];
}

function lifecycleKindShortLabel(kind: MachineLifecycleEvent['kind']) {
  const labels: Record<MachineLifecycleEvent['kind'], string> = {
    installation: 'LĐ',
    warranty: 'BH',
    repair: 'SC',
    maintenance: 'BT',
    inventory: 'K',
  };
  return labels[kind];
}

function lifecycleKindClass(kind: MachineLifecycleEvent['kind']) {
  const classes: Record<MachineLifecycleEvent['kind'], string> = {
    installation: 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]',
    warranty: 'border-[#d8e0ea] bg-[#eef6ff] text-[#18181b]',
    repair: 'border-[#fecdd3] bg-[#fff1f3] text-[#b5121b]',
    maintenance: 'border-[#efd8a8] bg-[#fff8ed] text-[#9b5a17]',
    inventory: 'border-[#e5e5e5] bg-[#f4f7fb] text-[#333333]',
  };
  return classes[kind];
}

function lifecycleStatusClass(status: string) {
  const normalized = status.toUpperCase();
  if (['COMPLETED', 'INSTALLED', 'ACTIVE', 'APPROVED', 'IN_STOCK', 'AT_CUSTOMER'].includes(normalized)) {
    return 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]';
  }
  if (['CANCELLED', 'OVERDUE', 'REPAIRING', 'IN_REPAIR', 'INACTIVE'].includes(normalized)) {
    return 'border-[#fecdd3] bg-[#fff1f3] text-[#b5121b]';
  }
  if (['PENDING', 'ASSIGNED', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_PARTS', 'MAINTENANCE'].includes(normalized)) {
    return 'border-[#efd8a8] bg-[#fff8ed] text-[#9b5a17]';
  }
  return 'border-[#e5e5e5] bg-[#f4f7fb] text-[#333333]';
}

function warrantyClass(value?: string | null) {
  if (!value) return 'text-[#666666]';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'text-[#1f1f1f]';
  const daysLeft = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (daysLeft < 0) return 'text-[#18181b]';
  if (daysLeft <= 30) return 'text-[#9b5a17]';
  return 'text-[#177245]';
}

function MachineEditForm({
  customers,
  editForm,
  isEditingEndoscopy,
  isEditingUltrasound,
  loading,
  loadingAccessoryTemplates,
  machine,
  machineModels,
  saving,
  templateAccessories,
  onAddAccessory,
  onAddProbe,
  onCancel,
  onRemoveAccessory,
  onSave,
  onSelectModel,
  onToggleEndoscopy,
  onToggleTemplate,
  onUpdateAccessory,
  onUpdateForm,
}: {
  customers: DashboardCustomer[];
  editForm: EditMachineForm;
  isEditingEndoscopy: boolean;
  isEditingUltrasound: boolean;
  loading: boolean;
  loadingAccessoryTemplates: boolean;
  machine: DashboardMachine | null;
  machineModels: MachineModelOption[];
  saving: boolean;
  templateAccessories: TemplateAccessory[];
  onAddAccessory: () => void;
  onAddProbe: (code: string) => void;
  onCancel: () => void;
  onRemoveAccessory: (clientId: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onSelectModel: (machineModelId: string) => void;
  onToggleEndoscopy: (name: string, checked: boolean) => void;
  onToggleTemplate: (template: TemplateAccessory, checked: boolean) => void;
  onUpdateAccessory: (clientId: string, patch: Partial<EditMachineAccessoryForm>) => void;
  onUpdateForm: (patch: Partial<EditMachineForm>) => void;
}) {
  if (loading && !machine) {
    return (
      <section className="grid min-h-[360px] place-items-center rounded-lg border border-[#e5e5e5] bg-white p-8">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-[#666666]">
          <Loader2 className="spin-icon" size={17} />
          Đang tải hồ sơ máy
        </span>
      </section>
    );
  }

  if (!machine) {
    return <EmptyState text="Không tìm thấy hồ sơ máy để sửa." />;
  }

  return (
    <form className="grid gap-5 rounded-lg border border-[#e5e5e5] bg-white p-5 shadow-[0_1px_2px_rgba(24,24,27,0.04)]" onSubmit={onSave}>
      <div className="flex items-start justify-between gap-3 border-b border-[#eeeeee] pb-4">
        <div>
          <span className="text-[12px] font-medium text-[#666666]">Chuẩn hóa hồ sơ máy</span>
          <h2 className="mt-1 text-xl font-medium text-[#1f1f1f]">{machine.serialNumber}</h2>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className={editLabelClass}>
          Mã máy (tự sinh nếu để trống khi tạo mới)
          <input className={editFieldClass} onChange={(event) => onUpdateForm({ machineCode: event.target.value })} placeholder="VD: XCUBE50-001" value={editForm.machineCode} />
        </label>
        <label className={editLabelClass}>
          Serial
          <input className={editFieldClass} onChange={(event) => onUpdateForm({ serialNumber: event.target.value })} required value={editForm.serialNumber} />
        </label>
        <label className={`${editLabelClass} md:col-span-2`}>
          Model cố định
          <select className={editFieldClass} onChange={(event) => onSelectModel(event.target.value)} required value={editForm.machineModelId}>
            <option value="">Chọn model trong danh mục</option>
            {machineModels.map((model) => (
              <option key={model.id} value={model.id}>
                {modelOptionText(model)}
              </option>
            ))}
          </select>
        </label>
        <ModelInfoFields className="md:col-span-2" model={machineModels.find((model) => model.id === editForm.machineModelId)} />
        <label className={editLabelClass}>
          Tên thiết bị
          <input className={editFieldClass} onChange={(event) => onUpdateForm({ name: event.target.value })} value={editForm.name} />
        </label>
        <label className={editLabelClass}>
          Tên model hiển thị
          <input className={editFieldClass} onChange={(event) => onUpdateForm({ modelName: event.target.value })} required value={editForm.modelName} />
        </label>
        <label className={editLabelClass}>
          Hãng
          <input className={editFieldClass} onChange={(event) => onUpdateForm({ manufacturer: event.target.value })} value={editForm.manufacturer} />
        </label>
        <label className={editLabelClass}>
          Loại thiết bị
          <select className={editFieldClass} onChange={(event) => onUpdateForm({ productCategory: event.target.value })} value={editForm.productCategory}>
            {['ULTRASOUND', 'LAB_TESTING', 'BIOCHEMISTRY', 'IMMUNOLOGY', 'HEMATOLOGY', 'X_RAY', 'ENDOSCOPY', 'OTHER'].map((value) => (
              <option key={value} value={value}>{displayLabel(value)}</option>
            ))}
          </select>
        </label>
        <label className={editLabelClass}>
          Trạng thái máy
          <select className={editFieldClass} onChange={(event) => onUpdateForm({ status: event.target.value })} value={editForm.status}>
            {['ACTIVE', 'MAINTENANCE', 'REPAIRING', 'INACTIVE'].map((value) => (
              <option key={value} value={value}>{displayLabel(value)}</option>
            ))}
          </select>
        </label>
        <label className={editLabelClass}>
          Trạng thái kho
          <select
            className={editFieldClass}
            onChange={(event) => onUpdateForm({
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
        <label className={editLabelClass}>
          Ngày sản xuất
          <input className={editFieldClass} onChange={(event) => onUpdateForm({ manufacturingDate: event.target.value })} type="date" value={editForm.manufacturingDate} />
        </label>
        <label className={editLabelClass}>
          Ngày nhập kho
          <input className={editFieldClass} onChange={(event) => onUpdateForm({ warehouseImportDate: event.target.value })} type="date" value={editForm.warehouseImportDate} />
        </label>
        <label className={`${editLabelClass} md:col-span-2`}>
          Khách hàng
          <select className={editFieldClass} onChange={(event) => onUpdateForm({ customerId: event.target.value })} value={editForm.customerId}>
            <option value="">Chưa gắn khách hàng</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{[customer.customerCode, customer.name, customer.province].filter(Boolean).join(' - ')}</option>
            ))}
          </select>
        </label>
        <label className={editLabelClass}>
          Ngày lắp
          <input className={editFieldClass} onChange={(event) => onUpdateForm({ installDate: event.target.value })} type="date" value={editForm.installDate} />
        </label>
        <label className={editLabelClass}>
          Bắt đầu bảo hành
          <input className={editFieldClass} onChange={(event) => onUpdateForm({ warrantyStartDate: event.target.value })} type="date" value={editForm.warrantyStartDate} />
        </label>
        <label className={editLabelClass}>
          Hết bảo hành
          <input className={editFieldClass} onChange={(event) => onUpdateForm({ warrantyEndDate: event.target.value })} type="date" value={editForm.warrantyEndDate} />
        </label>
      </div>

      <section className="grid gap-4 border-t border-[#eeeeee] pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[12px] font-medium text-[#666666]">Đầu dò / Phụ kiện</span>
            <h3 className="mt-1 text-base font-medium text-[#1f1f1f]">{editForm.accessories.length} dòng phụ kiện</h3>
          </div>
          <button className="secondary-button" onClick={onAddAccessory} type="button">
            <Plus size={16} />
            Add accessory
          </button>
        </div>

        {isEditingUltrasound ? (
          <ProbePicker onSelect={onAddProbe} />
        ) : isEditingEndoscopy ? (
          <EndoscopyAccessoryChecklist
            selectedNames={new Set(editForm.accessories.map((accessory) => accessory.name || accessory.code).filter((name): name is string => Boolean(name)))}
            onToggle={onToggleEndoscopy}
          />
        ) : (
          <TemplateAccessoryPicker
            loading={loadingAccessoryTemplates}
            selectedIds={new Set(editForm.accessories.map((accessory) => accessory.componentAccessoryId).filter((id): id is string => Boolean(id)))}
            templates={templateAccessories}
            onToggle={onToggleTemplate}
          />
        )}

        <div className="grid gap-3">
          {editForm.accessories.map((accessory, index) => (
            <div className="grid gap-3 rounded-lg border border-[#dbe5ef] bg-[#fafafa] p-4" key={accessory.clientId}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[#333333]">Phụ kiện {index + 1}</span>
                <button className="icon-button" onClick={() => onRemoveAccessory(accessory.clientId)} title="Delete accessory" type="button">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className={editLabelClass}>
                  {isEditingUltrasound ? 'Model đầu dò' : 'Tên phụ kiện'}
                  {isEditingUltrasound ? (
                    <select
                      className={editFieldClass}
                      onChange={(event) => onUpdateAccessory(accessory.clientId, { code: event.target.value, name: event.target.value })}
                      required
                      value={accessory.code || accessory.name}
                    >
                      <option value="">Chọn đầu dò</option>
                      {ultrasoundProbeOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input className={editFieldClass} onChange={(event) => onUpdateAccessory(accessory.clientId, { name: event.target.value })} required value={accessory.name} />
                  )}
                </label>
                <label className={editLabelClass}>
                  Serial phụ kiện
                  <input className={editFieldClass} onChange={(event) => onUpdateAccessory(accessory.clientId, { serialNumber: event.target.value })} value={accessory.serialNumber} />
                </label>
                <label className={editLabelClass}>
                  Mã phụ kiện
                  <input className={editFieldClass} onChange={(event) => onUpdateAccessory(accessory.clientId, { code: event.target.value })} value={accessory.code} />
                </label>
                <label className={editLabelClass}>
                  Mô tả
                  <input className={editFieldClass} onChange={(event) => onUpdateAccessory(accessory.clientId, { description: event.target.value })} value={accessory.description} />
                </label>
                <label className={`${editLabelClass} md:col-span-2`}>
                  Ghi chú
                  <textarea className={`${editFieldClass} min-h-[74px] py-2`} onChange={(event) => onUpdateAccessory(accessory.clientId, { note: event.target.value })} value={accessory.note} />
                </label>
              </div>
            </div>
          ))}
          {editForm.accessories.length === 0 ? <EmptyState text="Máy này chưa có phụ kiện. Bấm Add accessory để khai báo." /> : null}
        </div>
      </section>

      <div className="flex justify-end gap-2 border-t border-[#eeeeee] pt-4">
        <button className="secondary-button" disabled={saving} onClick={onCancel} type="button">Cancel</button>
        <button className="primary-button" disabled={saving} type="submit">
          {saving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
          {saving ? 'Saving' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function InfoItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="grid min-w-0 gap-1.5 rounded-lg border border-[#eeeeee] bg-[#fafafa] p-3">
      <span className="text-[12px] font-medium text-[#666666]">{label}</span>
      <strong className="min-h-6 break-words text-base font-semibold leading-snug text-[#1f1f1f]">{value || '-'}</strong>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-[#d7e0eb] bg-[#fafafa] p-4 text-sm text-[#666666]">{text}</div>;
}

function ProbePicker({ onSelect }: { onSelect: (code: string) => void }) {
  return (
    <div className="grid gap-3 rounded-lg border border-[#dbe5ef] bg-[#fafafa] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-sm font-semibold text-[#333333]">Add probe</span>
          <p className="mt-1 text-xs leading-5 text-[#666666]">Chọn model đầu dò từ danh sách chuẩn, sau đó nhập S/N thực tế ở dòng bên dưới.</p>
        </div>
        <select
          className={`${editFieldClass} max-w-[260px]`}
          onChange={(event) => {
            onSelect(event.target.value);
            event.currentTarget.value = '';
          }}
          value=""
        >
          <option value="">Chọn model đầu dò</option>
          {ultrasoundProbeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ultrasoundProbeOptions.slice(0, 8).map((option) => (
          <button
            className="rounded-lg border border-[#eeeeee] bg-white px-3 py-2 text-left text-sm font-medium text-[#18181b] transition hover:-translate-y-px hover:border-[#b8cbe1] hover:bg-[#f3f8ff]"
            key={option.value}
            onClick={() => onSelect(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EndoscopyAccessoryChecklist({
  onToggle,
  selectedNames,
}: {
  onToggle: (name: string, checked: boolean) => void;
  selectedNames: Set<string>;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-[#dbe5ef] bg-[#fafafa] p-4">
      <div>
        <span className="text-sm font-semibold text-[#333333]">Checklist phụ kiện nội soi tiêu hóa</span>
        <p className="mt-1 text-xs leading-5 text-[#666666]">Tích vật tư có theo máy. Nếu checklist chưa có, dùng Add accessory.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {endoscopyAccessoryOptions.map((option) => (
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-[#eeeeee] bg-white px-3 py-2 text-sm font-medium text-[#333333]" key={option.value}>
            <input
              checked={selectedNames.has(option.value)}
              onChange={(event) => onToggle(option.value, event.target.checked)}
              type="checkbox"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
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
      <div className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#eeeeee] bg-[#fafafa] px-3 text-sm text-[#666666]">
        <Loader2 className="spin-icon" size={16} />
        Đang tải danh sách phụ kiện mẫu
      </div>
    );
  }

  if (!templates.length) {
    return <EmptyState text="Model này chưa có danh sách phụ kiện mẫu để tích chọn nhanh." />;
  }

  return (
    <div className="grid gap-2 rounded-lg border border-[#eeeeee] bg-white p-3">
      <span className="text-sm font-medium text-[#333333]">Tích chọn phụ kiện mẫu của model</span>
      <div className="grid gap-2 md:grid-cols-2">
        {templates.map((template) => (
          <label className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 rounded-lg border border-[#eeeeee] bg-[#fafafa] px-3 py-2 text-sm text-[#333333]" key={template.id}>
            <input
              checked={selectedIds.has(template.id)}
              className="mt-1"
              onChange={(event) => onToggle(template, event.target.checked)}
              type="checkbox"
            />
            <span className="grid min-w-0 gap-0.5">
              <strong className="font-medium text-[#1f1f1f]">{template.code || template.name}</strong>
              <small className="truncate text-xs text-[#666666]">{[template.componentName, template.name].filter(Boolean).join(' - ')}</small>
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

function modelOptionText(model: MachineModelOption) {
  return model.code || model.displayName || model.name || 'Model';
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
    machineModelId: '',
    name: '',
    modelName: '',
    manufacturer: '',
    productCategory: 'OTHER',
    status: 'ACTIVE',
    inventoryStatus: 'IN_STOCK',
    customerId: '',
    manufacturingDate: '',
    warehouseImportDate: '',
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
    machineModelId: machine.machineModelId || '',
    name: machine.name || '',
    modelName: machine.modelName || '',
    manufacturer: machine.manufacturer || '',
    productCategory: machine.productCategory || 'OTHER',
    status: machine.status || 'ACTIVE',
    inventoryStatus: machine.inventoryStatus || 'IN_STOCK',
    customerId: machine.customer?.id || '',
    manufacturingDate: toDateInput(machine.manufacturingDate),
    warehouseImportDate: toDateInput(machine.warehouseImportDate),
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

function emptyBulkMachineForm(): BulkMachineForm {
  return {
    machineModelId: '',
    modelName: '',
    manufacturer: '',
    productCategory: 'OTHER',
    inventoryStatus: 'IN_STOCK',
    manufacturingDate: '',
    warehouseImportDate: toDateInput(new Date().toISOString()),
    serialRows: '',
  };
}

function parseBulkMachineRows(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serialNumber = '', machineCode = '', name = ''] = line.split('|').map((part) => part.trim());
      return {
        serialNumber,
        machineCode,
        name,
      };
    })
    .filter((row) => row.serialNumber);
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

function isEndoscopyMachine(machine?: DashboardMachine | null) {
  return machine?.productCategory === 'ENDOSCOPY';
}

function inventoryStatusFormPatch(inventoryStatus: string): Partial<EditMachineForm> {
  if (['IN_STOCK', 'ACCESSORY_SPLIT'].includes(inventoryStatus)) {
    return {
      status: 'ACTIVE',
      customerId: '',
      installDate: '',
      warrantyStartDate: '',
      warrantyEndDate: '',
    };
  }

  if (inventoryStatus === 'RETURNED') {
    return {
      status: 'REPAIRING',
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

const editLabelClass = 'grid min-w-0 gap-2 text-sm font-medium text-[#333333]';
const editFieldClass = 'h-11 min-w-0 rounded-lg border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]';

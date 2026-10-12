import { AlertTriangle, ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ClipboardCheck, Edit3, Eye, Loader2, PackageSearch, Plus, RotateCcw, Save, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiFetch, apiFetchAllPages } from '../../api';
import { Notice } from '../../components/Notice';
import { DateInput } from '../../components/DateInput';
import { ModelInfoFields } from '../../components/ModelInfoFields';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { EquipmentAreaNav } from '../../components/EquipmentAreaNav';
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
  locality?: string | null;
  ward?: string | null;
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
  machineModel?: { code?: string | null; name?: string | null; displayName?: string | null } | null;
  modelName: string;
  name?: string | null;
  manufacturer?: string | null;
  productCategory?: string | null;
  status?: string | null;
  inventoryStatus?: string | null;
  demoCategory?: 'DEMO_UNIT' | 'DEMO_STOCK' | 'DEMO_USED' | null;
  demoPreparationStatus?: 'NOT_REQUIRED' | 'REQUIRED' | 'COMPLETED' | null;
  dataStatus?: string | null;
  createdSource?: string | null;
  manufacturingDate?: string | null;
  warehouseImportDate?: string | null;
  installDate?: string | null;
  latestActivity?: { date: string; type: string } | null;
  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;
  installedBy?: DashboardEngineer | null;
  primaryEngineer?: DashboardEngineer | null;
  engineerAssignments?: Array<{ engineer: DashboardEngineer }>;
  customer?: DashboardCustomer | null;
  accessories?: Array<{
    id: string;
    code?: string | null;
    name: string;
    quantity?: number | null;
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
    customer?: DashboardCustomer | null;
    usedParts?: MachineUsedPart[];
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
    customer?: DashboardCustomer | null;
    usedParts?: MachineUsedPart[];
  }>;
  deviceServiceTickets?: Array<{
    id: string;
    receiveCode: string;
    returnCode?: string | null;
    status: string;
    receivedAt?: string | null;
    returnedAt?: string | null;
    deviceName?: string | null;
    modelName?: string | null;
    serialNumber?: string | null;
    engineer?: DashboardEngineer | null;
    customer?: DashboardCustomer | null;
    usedParts?: MachineUsedPart[];
  }>;
  applicationSupportCases?: Array<{
    id: string;
    title: string;
    status: string;
    supportedAt?: string | null;
    workType?: string | null;
    issueCategory?: string | null;
    channel?: string | null;
    appModule?: string | null;
    reagentName?: string | null;
    reagentLot?: string | null;
    reagentExpiry?: string | null;
    assayName?: string | null;
    qcResult?: string | null;
    calibrationResult?: string | null;
    lisHisStatus?: string | null;
    issueDescription?: string | null;
    resolution?: string | null;
    engineer?: DashboardEngineer | null;
    customer?: DashboardCustomer | null;
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
  demoLoans?: Array<{
    id: string;
    code: string;
    status: string;
    machineUse?: string | null;
    plannedHandoverAt: string;
    handedOverAt?: string | null;
    expectedReturnAt: string;
    returnedAt?: string | null;
    preparedAt?: string | null;
    preparationStatus?: string | null;
    customer?: { name?: string | null; hospitalName?: string | null } | null;
    engineer?: DashboardEngineer | null;
  }>;
};

type MachineUsedPart = {
  id: string;
  name: string;
  quantity?: number | string | null;
  unit?: string | null;
  serialNumber?: string | null;
  unitPrice?: number | string | null;
  totalPrice?: number | string | null;
  note?: string | null;
  usedAt?: string | null;
  inventoryItemId?: string | null;
};

type MachinePartHistoryItem = {
  id: string;
  sourceCode: string;
  sourceKind: 'Sửa chữa' | 'Bảo trì' | 'Nhận/trả';
  sourceId: string;
  date?: string | null;
  part: MachineUsedPart;
  engineer?: DashboardEngineer | null;
  customer?: DashboardCustomer | null;
};

type MachineLifecycleEvent = {
  id: string;
  kind: 'installation' | 'warranty' | 'repair' | 'maintenance' | 'inventory' | 'app' | 'demo';
  title: string;
  status?: string | null;
  date?: string | null;
  description?: string;
  meta?: string;
};

type MachineBusinessSignal = {
  id: string;
  label: string;
  value: string;
  tone: 'good' | 'info' | 'warning' | 'danger' | 'neutral';
  href?: string;
};

type MachineProfileGap = {
  id: string;
  label: string;
  done: boolean;
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
  demoCategory: string;
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
  quantity: number;
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
    ComponentAccessory?: TemplateAccessory[];
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
  inventorySummary?: Record<string, number>;
  businessLines: TechnicalMachineGroup[];
  productIndustries?: Array<{
    id: string | null;
    name: string;
    count: number;
  }>;
  machines: DashboardMachine[];
};

export function TechnicalMachinesPage({ currentRole }: { currentRole: RoleName }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { machineId } = useParams();
  const initialParams = new URLSearchParams(location.search);
  const isMachineEditRoute = Boolean(machineId && location.pathname.endsWith('/edit'));
  const [technicalMachines, setTechnicalMachines] = useState<TechnicalMachines | null>(null);
  const [customers, setCustomers] = useState<DashboardCustomer[]>([]);
  const [machineModels, setMachineModels] = useState<MachineModelOption[]>([]);
  const [selectedBusinessLineKey, setSelectedBusinessLineKey] = useState(() => initialParams.get('businessLineId') || 'ALL');
  const [selectedProductIndustryId, setSelectedProductIndustryId] = useState(() => initialParams.get('productIndustryId') || '');
  const [machineDetail, setMachineDetail] = useState<DashboardMachine | null>(null);
  const [loadingMachineDetail, setLoadingMachineDetail] = useState(false);
  const [editingMachine, setEditingMachine] = useState<DashboardMachine | null>(null);
  const [editForm, setEditForm] = useState<EditMachineForm>(() => emptyEditMachineForm());
  const [editMachinePreviewCode, setEditMachinePreviewCode] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState<BulkMachineForm>(() => emptyBulkMachineForm());
  const [templateAccessories, setTemplateAccessories] = useState<TemplateAccessory[]>([]);
  const [loadingAccessoryTemplates, setLoadingAccessoryTemplates] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [installState, setInstallState] = useState(() => initialParams.get('installState') || 'ALL');
  const [attention, setAttention] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const machineStatusSummary = useMemo(() => {
    const inventorySummary = technicalMachines?.inventorySummary ?? {};
    return {
      total: technicalMachines?.filteredTotal ?? 0,
      installed: inventorySummary.INSTALLED ?? 0,
      inStock: inventorySummary.IN_STOCK ?? 0,
      returned: inventorySummary.RETURNED ?? 0,
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
    if (currentRole !== 'admin' && currentRole !== 'engineer') return;
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
  }, [machineId, search, selectedBusinessLineKey, selectedProductIndustryId, installState, attention, page, limit]);

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

  useEffect(() => {
    if (editForm.machineCode) {
      setEditMachinePreviewCode(editForm.machineCode);
      return;
    }

    let cancelled = false;
    const model = machineModels.find((item) => item.id === editForm.machineModelId);
    const source = model?.code || model?.name || editForm.modelName || editForm.name || 'MAY';
    const params = new URLSearchParams({ source });

    void apiFetch<{ code?: string | null }>(`/machines/next-code?${params.toString()}`)
      .then((result) => {
        if (!cancelled) setEditMachinePreviewCode(result.code || '');
      })
      .catch(() => {
        if (!cancelled) setEditMachinePreviewCode('');
      });

    return () => {
      cancelled = true;
    };
  }, [editForm.machineCode, editForm.machineModelId, editForm.modelName, editForm.name, machineModels]);

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
      if (selectedProductIndustryId) params.set('productIndustryId', selectedProductIndustryId);
      if (installState !== 'ALL') params.set('installState', installState);
      if (attention !== 'ALL') params.set('attention', attention);

      const result = await apiFetch<TechnicalMachines>(`/dashboard/technical-machines?${params.toString()}`);
      setTechnicalMachines(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách máy.');
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomers() {
    try {
      const result = await apiFetchAllPages<DashboardCustomer>('/customers');
      setCustomers(result);
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
  const selectedProductIndustry = useMemo(() => {
    if (!selectedProductIndustryId) return null;
    return technicalMachines?.productIndustries?.find((industry) => industry.id === selectedProductIndustryId) ?? null;
  }, [selectedProductIndustryId, technicalMachines]);

  function resetFilters() {
    setSearchInput('');
    setSearch('');
    setInstallState('ALL');
    setAttention('ALL');
    setSelectedBusinessLineKey('ALL');
    setSelectedProductIndustryId('');
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
    const template = templateAccessories.find((accessory) => accessory.code === code || accessory.name === code);
    setEditForm((current) => ({
      ...current,
      accessories: [...current.accessories, { ...emptyEditAccessoryForm(), componentAccessoryId: template?.id ?? null, code, name: template?.name || code }],
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
        accessories: [...current.accessories, { ...emptyEditAccessoryForm(), code: name, name, quantity: isCoreEndoscopyAccessoryName(name) ? 1 : 1 }],
      };
    });
  }

  function setAllEndoscopyAccessories(checked: boolean) {
    setEditForm((current) => {
      const optionNames = new Set<string>(endoscopyAccessoryOptions.map((option) => option.value));
      if (!checked) {
        return {
          ...current,
          accessories: current.accessories.filter((accessory) => !optionNames.has(accessory.name || accessory.code)),
        };
      }

      const existingNames = new Set(current.accessories.map((accessory) => accessory.name || accessory.code).filter(Boolean));
      const missingAccessories = endoscopyAccessoryOptions
        .filter((option) => !existingNames.has(option.value))
        .map((option) => ({ ...emptyEditAccessoryForm(), code: option.value, name: option.value, quantity: isCoreEndoscopyAccessoryName(option.value) ? 1 : 1 }));

      return {
        ...current,
        accessories: [...current.accessories, ...missingAccessories],
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
      const selectedModel = machineModels.find((model) => model.id === editForm.machineModelId);
      const isEndoscopy = isEndoscopyMachine(editingMachine) || editForm.productCategory === 'ENDOSCOPY' || isEndoscopyMachineModel(selectedModel);
      const machineSerialNumber = (editForm.serialNumber.trim() || (isEndoscopy ? getEndoscopyRepresentativeSerial(accessories) : '')).trim();

      if (accessories.some((accessory) => !accessory.name.trim())) {
        setError('Tên phụ kiện là bắt buộc. Nếu không dùng nữa, hãy xóa phụ kiện đó.');
        return;
      }

      if (isEndoscopy) {
        const missingCoreSerials = missingEndoscopyCoreSerials(accessories);
        if (missingCoreSerials.length) {
          setError(`Máy nội soi cần serial: ${missingCoreSerials.join(', ')}.`);
          return;
        }
      }

      if (!isEndoscopy && !machineSerialNumber) {
        setError('Serial máy là bắt buộc.');
        return;
      }

      await apiFetch(`/machines/${editingMachine.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          machineCode: undefined,
          serialNumber: machineSerialNumber || undefined,
          machineModelId: editForm.machineModelId || null,
          name: editForm.name.trim() || undefined,
          modelName: editForm.modelName.trim(),
          manufacturer: editForm.manufacturer.trim(),
          productCategory: editForm.productCategory,
          status: editForm.status,
          inventoryStatus: editForm.inventoryStatus,
          demoCategory: editForm.demoCategory || null,
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
            quantity: isCoreEndoscopyAccessoryName(accessory.name || accessory.code) ? undefined : Math.max(1, Number(accessory.quantity) || 1),
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
            machineCode: undefined,
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

  async function verifyMachineProfile(machine: DashboardMachine) {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiFetch(`/machines/${machine.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          dataStatus: 'VERIFIED',
        }),
      });
      setSuccess('Đã xác minh hồ sơ máy.');
      await loadMachineDetail(machine.id);
      if (!machineId) {
        await loadTechnicalMachines();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xác minh được hồ sơ máy.');
    } finally {
      setSaving(false);
    }
  }

  const selectedEditModel = machineModels.find((model) => model.id === editForm.machineModelId);
  const isEditingUltrasound = isUltrasoundMachine(editingMachine) || editForm.productCategory === 'ULTRASOUND' || selectedEditModel?.productCategory === 'ULTRASOUND';
  const isEditingEndoscopy = isEndoscopyMachine(editingMachine) || editForm.productCategory === 'ENDOSCOPY' || isEndoscopyMachineModel(selectedEditModel);

  useEffect(() => {
    if (!isEditingEndoscopy) return;
    setEditForm((current) => {
      const nextAccessories = ensureEndoscopyCoreAccessories(current.accessories);
      return nextAccessories === current.accessories ? current : { ...current, accessories: nextAccessories };
    });
  }, [isEditingEndoscopy, editForm.machineModelId, editingMachine?.id]);

  if (machineId) {
    const recordMachine = machineDetail?.id === machineId ? machineDetail : null;

    return (
      <PageFrame>
        <EquipmentAreaNav active="machines" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageTitle
            eyebrow="Hồ sơ máy"
            meta={recordMachine ? [recordMachine.machineCode, recordMachine.serialNumber, recordMachine.modelName].filter(Boolean).join(' · ') : undefined}
            title={isMachineEditRoute ? 'Chỉnh sửa máy' : 'Thông tin máy'}
          />
            <Link className="secondary-button" to={isMachineEditRoute ? `/technical-machines/${machineId}` : '/technical-machines'}>
              <ArrowLeft size={17} />
            Quay lại
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
            previewCode={editMachinePreviewCode}
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
            canEdit={currentRole === 'admin' || currentRole === 'engineer'}
            loading={loadingMachineDetail}
            machine={recordMachine}
            onEdit={openEditMachine}
            onVerify={verifyMachineProfile}
            verifying={saving}
          />
        )}
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <EquipmentAreaNav active="machines" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Phòng kỹ thuật"
          title="Danh sách máy quản lý"
        />
          <button className="secondary-button" onClick={() => navigate('/')} type="button">
            <ArrowLeft size={17} />
          Quay lại
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="grid gap-4">
        <div className="grid items-start gap-4 min-[1280px]:grid-cols-[minmax(0,1fr)_320px]">
          <MachineIndustryBarChart
            activeId={selectedBusinessLineKey}
            items={machineIndustryChartItems}
            loading={loading}
            onSelect={(nextId) => {
              setSelectedBusinessLineKey(nextId);
              setPage(1);
            }}
          />
          <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <MachineSummaryCard label="Tổng kết quả" value={machineStatusSummary.total} />
            <MachineSummaryCard label="Đã lắp" tone="green" value={machineStatusSummary.installed} />
            <MachineSummaryCard label="Trong kho" tone="blue" value={machineStatusSummary.inStock} />
            <MachineSummaryCard label="Thu hồi" tone="amber" value={machineStatusSummary.returned} />
          </div>
        </div>

        <div className="machine-filter-panel grid gap-3 rounded-lg border border-[#d8e0ea] bg-white p-3 shadow-[0_10px_28px_rgba(24,24,27,0.05)]">
          {(currentRole === 'admin' || currentRole === 'engineer') ? (
            <div className="flex justify-end">
              <button aria-label="Nhập lô máy" className="primary-button !min-h-9 !gap-1.5 !px-3 !text-sm" onClick={openBulkCreate} title="Nhập lô máy" type="button">
                <Plus size={17} />
                Nhập lô máy
              </button>
            </div>
          ) : null}
          <div className="machine-filter-grid grid gap-3">
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#666666]">
              Ngành hàng
              <select
                className="h-11 min-w-0 rounded-lg border border-[#d6d6d6] bg-white px-3 text-sm font-medium text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]"
                onChange={(event) => {
                  setSelectedBusinessLineKey(event.target.value);
                  setPage(1);
                }}
                value={selectedBusinessLineKey}
              >
                <option value="ALL">Tất cả nhóm sản phẩm ({technicalMachines?.businessLines.reduce((sum, item) => sum + item.count, 0) ?? 0})</option>
                {technicalMachines?.businessLines.map((businessLine) => (
                  <option key={businessLineKey(businessLine)} value={businessLineKey(businessLine)}>
                    {businessLine.name} ({businessLine.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="machine-search-field relative grid min-w-0 gap-1.5 text-xs font-semibold text-[#666666]">
              Tìm kiếm
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8a8a]" size={17} />
              <input
                className="h-11 w-full min-w-0 rounded-lg border border-[#d6d6d6] bg-[#fafafa] pl-9 pr-3 text-sm font-medium text-[#1f1f1f] outline-none focus:border-[#18181b] focus:bg-white focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]"
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
                }}
                value={installState}
              >
                <option value="ALL">Tất cả</option>
                <option value="INSTALLED">Đã lắp</option>
                <option value="UNINSTALLED">Chưa lắp</option>
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#666666]">
              Cần chú ý
              <select
                className="h-11 min-w-0 rounded-lg border border-[#d6d6d6] bg-white px-3 text-sm text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]"
                onChange={(event) => {
                  setAttention(event.target.value);
                  setPage(1);
                }}
                value={attention}
              >
                <option value="ALL">Tất cả tình trạng</option>
                <option value="REPAIRING">Đang sửa chữa</option>
                <option value="WAITING_PARTS">Chờ linh kiện</option>
                <option value="OVERDUE_MAINTENANCE">Quá hạn bảo trì</option>
                <option value="WARRANTY_30D">Sắp hết bảo hành · 30 ngày</option>
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#666666]">
              Hiển thị
              <select
                className="h-11 min-w-0 rounded-lg border border-[#d6d6d6] bg-white px-3 text-sm text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]"
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(1);
                }}
                value={limit}
              >
                <option value={10}>10 mục/trang</option>
                <option value={25}>25 mục/trang</option>
                <option value={50}>50 mục/trang</option>
                <option value={100}>100 mục/trang</option>
              </select>
            </label>
            <button className="machine-filter-reset secondary-button justify-center" onClick={resetFilters} type="button">
              <RotateCcw size={17} />
              Đặt lại
            </button>
          </div>
          {selectedProductIndustryId ? (
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-md border border-[#dbe5ef] bg-white px-2 py-1 text-xs font-semibold text-[#475467]">
                Ngành hàng: {selectedProductIndustry?.name || 'Đang tải'}
              </span>
            </div>
          ) : null}
        </div>

        <section className="machine-list-panel overflow-hidden rounded-lg border border-[#d8e0ea] bg-white shadow-[0_12px_34px_rgba(24,24,27,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeeee] bg-[#fafafa] px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-[#1f1f1f]">Danh sách máy</h2>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center rounded-md bg-[#eef2f6] px-2 py-1 text-xs font-semibold text-[#475467]">
                  {selectedBusinessLine?.name ?? 'Tất cả ngành hàng'}
                </span>
                <span className="inline-flex items-center rounded-md bg-[#eef2f6] px-2 py-1 text-xs font-semibold tabular-nums text-[#475467]">
                  {technicalMachines?.filteredTotal ?? 0} kết quả
                </span>
              </div>
            </div>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#dbe5ef] bg-white px-2.5 text-sm font-medium text-[#18181b]">
              {loading ? <Loader2 className="spin-icon" size={17} /> : <PackageSearch size={17} />}
                {loading ? '-' : `Tổng: ${technicalMachines?.total ?? 0} máy`}
            </span>
          </div>

          <div className="machine-table-scroll overflow-auto">
            <table className="machine-management-table w-full min-w-[1180px] border-collapse">
              <thead>
                <tr>
                  <th>Máy</th>
                  <th>Model</th>
                  <th>Khách hàng</th>
                  <th>Trạng thái</th>
                  <th>Bảo hành</th>
                  <th>Hoạt động gần nhất</th>
                  <th>Kỹ sư</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {[...(technicalMachines?.machines ?? [])]
                  .sort((a, b) => new Date(b.latestActivity?.date ?? 0).getTime() - new Date(a.latestActivity?.date ?? 0).getTime())
                  .map((machine) => {
                    const linkedModel = machineModels.find((model) => model.id === machine.machineModelId);
                    const modelLabel = machine.machineModel?.code || machine.machineModel?.displayName || machine.machineModel?.name || linkedModel?.code || linkedModel?.displayName || linkedModel?.name || machine.modelName;
                    return (
                      <MachineTableRow canEdit={currentRole === 'admin' || currentRole === 'engineer'} key={machine.id} machine={machine} modelLabel={modelLabel} />
                    );
                  })}
                {loading ? (
                  <tr><td className="machine-table-empty" colSpan={8}><Loader2 className="spin-icon" size={20} />Đang tải danh sách máy</td></tr>
                ) : null}
                {!loading && !technicalMachines?.machines.length ? (
                  <tr><td className="machine-table-empty" colSpan={8}>Không có máy phù hợp bộ lọc.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeeee] px-4 py-3">
            <button
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-2.5 text-sm font-medium text-[#333333] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              type="button"
            >
              <ChevronLeft size={16} />
              Trước
            </button>
            <span className="order-first w-full text-center text-sm font-semibold text-[#666666] sm:order-none sm:w-auto">
              {technicalMachines?.filteredTotal
                ? `${(technicalMachines.page - 1) * technicalMachines.limit + 1}–${Math.min(technicalMachines.page * technicalMachines.limit, technicalMachines.filteredTotal)}/${technicalMachines.filteredTotal} máy · ${technicalMachines.page}/${technicalMachines.totalPages} trang`
                : '0 máy'}
            </span>
            <button
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#e5e5e5] bg-white px-2.5 text-sm font-medium text-[#333333] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={loading || !technicalMachines?.totalPages || page >= technicalMachines.totalPages}
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
                Mã máy
                <input className={editFieldClass} disabled placeholder="Đang sinh mã..." value={editForm.machineCode || editMachinePreviewCode || 'Đang sinh mã...'} />
              </label>
              <label className={editLabelClass}>
                {isEditingEndoscopy ? 'Serial đại diện' : 'Serial'}
                <input
                  className={editFieldClass}
                  onChange={(event) => updateEditForm({ serialNumber: event.target.value })}
                  required={!isEditingEndoscopy}
                  value={editForm.serialNumber}
                />
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
                Phân loại demo
                <select className={editFieldClass} onChange={(event) => updateEditForm({ demoCategory: event.target.value })} value={editForm.demoCategory}>
                  <option value="">Máy thông thường</option>
                  <option value="DEMO_UNIT">Máy demo chuyên dụng</option>
                  <option value="DEMO_STOCK">Máy mới có thể đem demo</option>
                  <option value="DEMO_USED">Máy đã qua demo</option>
                </select>
              </label>
              <DateInput className={editLabelClass} label="Ngày sản xuất" onChange={(value) => updateEditForm({ manufacturingDate: value })} value={editForm.manufacturingDate} />
              <DateInput className={editLabelClass} label="Ngày nhập kho" onChange={(value) => updateEditForm({ warehouseImportDate: value })} value={editForm.warehouseImportDate} />
              <label className={`${editLabelClass} md:col-span-2`}>
                Khách hàng
                <select className={editFieldClass} onChange={(event) => updateEditForm({ customerId: event.target.value })} value={editForm.customerId}>
                  <option value="">Chưa gắn khách hàng</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{[customer.customerCode, customer.name, customer.province].filter(Boolean).join(' - ')}</option>
                  ))}
                </select>
              </label>
              <DateInput className={editLabelClass} label="Ngày lắp" onChange={(value) => updateEditForm({ installDate: value })} value={editForm.installDate} />
              <DateInput className={editLabelClass} label="Bắt đầu bảo hành" onChange={(value) => updateEditForm({ warrantyStartDate: value })} value={editForm.warrantyStartDate} />
              <DateInput className={editLabelClass} label="Hết bảo hành" onChange={(value) => updateEditForm({ warrantyEndDate: value })} value={editForm.warrantyEndDate} />
            </div>

            <section className="grid gap-3 border-t border-[#eeeeee] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[12px] font-medium text-[#666666]">Đầu dò / Phụ kiện</span>
                  <h3 className="mt-1 text-base font-medium text-[#1f1f1f]">{editForm.accessories.length} phụ kiện</h3>
                </div>
                <button className="secondary-button" onClick={addAccessoryForm} type="button">
                  <Plus size={16} />
                  Thêm
                </button>
              </div>

              {isEditingUltrasound ? (
                <ProbePicker onSelect={addProbeAccessory} />
              ) : isEditingEndoscopy ? (
                <EndoscopyAccessoryChecklist
                  selectedNames={new Set(editForm.accessories.map((accessory) => accessory.name || accessory.code).filter((name): name is string => Boolean(name)))}
                  onToggle={toggleEndoscopyAccessory}
                  onToggleAll={setAllEndoscopyAccessories}
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
                      <button className="icon-button" onClick={() => removeAccessoryForm(accessory.clientId)} title="Xóa phụ kiện" type="button">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className={`grid gap-3 ${!isEditingUltrasound && !isCoreEndoscopyAccessoryName(accessory.name || accessory.code) ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                      <label className={editLabelClass}>
                        {isEditingUltrasound ? 'Model đầu dò' : 'Tên phụ kiện'}
                        {isEditingUltrasound ? (
                          <select
                            className={editFieldClass}
                            onChange={(event) => {
                              const template = templateAccessories.find((item) => item.code === event.target.value || item.name === event.target.value);
                              updateAccessoryForm(accessory.clientId, {
                                componentAccessoryId: template?.id ?? null,
                                code: event.target.value,
                                name: template?.name || event.target.value,
                              });
                            }}
                            required
                            value={accessory.code || accessory.name}
                          >
                            <option value="">Chọn đầu dò</option>
                            {(templateAccessories.some((item) => ultrasoundProbeOptions.some((option) => option.value === item.code))
                              ? templateAccessories.filter((item) => ultrasoundProbeOptions.some((option) => option.value === item.code)).map((item) => ({ label: item.code, value: item.code }))
                              : ultrasoundProbeOptions).map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        ) : (
                          <input className={editFieldClass} onChange={(event) => updateAccessoryForm(accessory.clientId, { name: event.target.value })} required value={accessory.name} />
                        )}
                      </label>
                      <label className={editLabelClass}>
                        Serial
                        <input className={editFieldClass} onChange={(event) => updateAccessoryForm(accessory.clientId, { serialNumber: event.target.value })} value={accessory.serialNumber} />
                      </label>
                      {!isEditingUltrasound && !isCoreEndoscopyAccessoryName(accessory.name || accessory.code) ? (
                        <label className={editLabelClass}>
                          Số lượng
                          <input className={editFieldClass} min={1} onChange={(event) => updateAccessoryForm(accessory.clientId, { quantity: Number(event.target.value) || 1 })} type="number" value={accessory.quantity} />
                        </label>
                      ) : null}
                    </div>
                    <details className="rounded-2xl border border-[#eef0f3] bg-white px-3 py-2 text-sm text-[#475569]">
                      <summary className="cursor-pointer font-semibold text-[#334155]">Thông tin thêm</summary>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
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
                    </details>
                  </div>
                ))}
                {editForm.accessories.length === 0 ? <EmptyState text="Chưa có phụ kiện." /> : null}
              </div>
            </section>

            <div className="flex justify-end gap-2 border-t border-[#eeeeee] pt-4">
              <button className="secondary-button" disabled={saving} onClick={() => setEditingMachine(null)} type="button">Hủy</button>
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
                {saving ? 'Đang lưu' : 'Lưu'}
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
              <DateInput className={editLabelClass} label="Ngày sản xuất" onChange={(value) => updateBulkForm({ manufacturingDate: value })} value={bulkForm.manufacturingDate} />
              <DateInput className={editLabelClass} label="Ngày nhập kho" onChange={(value) => updateBulkForm({ warehouseImportDate: value })} value={bulkForm.warehouseImportDate} />
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
              <button className="primary-button" disabled={saving} type="submit">
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
  onVerify,
  verifying,
}: {
  canEdit: boolean;
  loading: boolean;
  machine: DashboardMachine | null;
  onEdit: (machine: DashboardMachine) => void;
  onVerify: (machine: DashboardMachine) => void;
  verifying: boolean;
}) {
  const [activeSection, setActiveSection] = useState<'overview' | 'accessories' | 'parts' | 'app' | 'customer' | 'history'>('overview');

  if (!machine) {
    return (
      <aside className="rounded-lg border border-[#e5e5e5] bg-white p-6">
        <EmptyState text="Chưa chọn S/N." />
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
  const appCases = machine.applicationSupportCases ?? [];
  const warrantyCards = machine.warrantyCards ?? [];
  const partHistory = buildMachinePartHistory(machine);
  const warrantyEndDate = machine.warrantyEndDate ?? warrantyCards[0]?.endDate ?? latestInstallation?.warrantyCard?.endDate;
  const lifecycleEvents = buildMachineLifecycleEvents(machine);
  const businessSignals = buildMachineBusinessSignals(machine, warrantyEndDate);
  const profileGaps = buildMachineProfileGaps(machine);
  const completedGaps = profileGaps.filter((gap) => gap.done).length;
  const detailTabs = [
    { id: 'overview', label: 'Tổng quan', value: completedGaps },
    { id: 'accessories', label: 'Phụ kiện', value: accessories.length },
    { id: 'parts', label: 'Linh kiện', value: partHistory.length },
    { id: 'app', label: 'App', value: appCases.length },
    { id: 'customer', label: 'Khách hàng', value: customer ? 1 : 0 },
    { id: 'history', label: 'Lịch sử', value: lifecycleEvents.length },
  ] as const;

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
              <>
              {machine.dataStatus === 'PENDING_REVIEW' ? (
                <button className="primary-button" disabled={verifying} onClick={() => onVerify(machine)} type="button">
                  {verifying ? <Loader2 className="spin-icon" size={16} /> : <ClipboardCheck size={16} />}
                  Xác minh hồ sơ
                </button>
              ) : null}
              <button className="secondary-button" onClick={() => onEdit(machine)} type="button">
                <Edit3 size={16} />
                Edit
              </button>
              </>
            ) : null}
          </div>
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ProfileStat label="Sửa chữa" value={repairs.length} />
          <ProfileStat label="Bảo trì" value={maintenances.length} />
          <ProfileStat label="Luân chuyển kho" value={movements.length} />
          <ProfileStat label="Linh kiện thay" value={partHistory.length} />
          <ProfileStat label="Ca app" value={appCases.length} />
        </div>

        <div className="mb-5 grid gap-2 rounded-[18px] border border-[#e4e4e7] bg-[#fafafa] p-2 md:grid-cols-6">
          {detailTabs.map((tab) => (
            <button
              className={`flex min-h-11 items-center justify-between rounded-[14px] px-3 text-left text-sm font-semibold transition ${
                activeSection === tab.id ? 'bg-[#18181b] text-white shadow-[0_12px_30px_rgba(24,24,27,0.18)]' : 'bg-white text-[#555555] hover:bg-[#f4f4f5]'
              }`}
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              type="button"
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${activeSection === tab.id ? 'bg-white/14 text-white' : 'bg-[#fafafa] text-[#18181b]'}`}>{tab.value}</span>
            </button>
          ))}
        </div>

        {activeSection === 'overview' ? (
          <>
            <MachineBusinessSignalPanel signals={businessSignals} />

            <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              <InfoItem label="Model" value={machine.modelName} />
              <InfoItem label="Mã máy" value={machine.machineCode} />
              <InfoItem label="Tên máy" value={machine.name || machine.modelName} />
              <InfoItem label="Hãng" value={machine.manufacturer} />
              <InfoItem label="Loại thiết bị" value={displayProductCategory(machine.productCategory)} />
              <InfoItem label="Phân loại demo" value={machine.demoCategory ? demoCategoryLabel(machine.demoCategory) : 'Máy thông thường'} />
              {machine.demoPreparationStatus && machine.demoPreparationStatus !== 'NOT_REQUIRED' ? <InfoItem label="Xử lý sau demo" value={displayLabel(machine.demoPreparationStatus)} /> : null}
              <InfoItem label="Số phiếu demo" value={String(machine.demoLoans?.length ?? 0)} />
              <InfoItem label="Ngày lắp" value={formatDashboardDate(machine.installDate)} />
              <InfoItem label="Hết bảo hành" value={formatDashboardDate(warrantyEndDate)} />
              <InfoItem label="Kỹ sư phụ trách" value={machine.primaryEngineer?.fullName || machine.installedBy?.fullName} />
              <InfoItem label="Kỹ sư cùng quản lý" value={machine.engineerAssignments?.map(({ engineer }) => engineer.fullName || engineer.email).filter(Boolean).join(', ')} />
            </div>

            <MachineProfileCompletenessCard completed={completedGaps} gaps={profileGaps} total={profileGaps.length} />
          </>
        ) : null}

        {activeSection === 'accessories' ? (
          <div className="border-t border-[#eeeeee] pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-medium text-[#1f1f1f]">Đầu dò / Phụ kiện</h3>
              </div>
              {canEdit ? (
                <button className="secondary-button" onClick={() => onEdit(machine)} type="button">
                  <Edit3 size={16} />
                  Quản lý phụ kiện
                </button>
              ) : null}
            </div>
            {accessories.length ? (
              <div className="grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {accessories.map((accessory) => (
                  <div className="grid min-w-0 gap-2 rounded-lg border border-[#eeeeee] bg-[#fafafa] p-4" key={accessory.id}>
                    <span className="text-[12px] font-medium text-[#666666]">
                      {accessory.componentAccessory?.component?.name || accessory.componentAccessory?.name || accessory.code || 'Phụ kiện'}
                    </span>
                    <strong className="break-words text-base font-medium leading-snug text-[#1f1f1f]">{accessory.name}</strong>
                    <span className="text-sm text-[#666666]">S/N: <b className="font-semibold text-[#18181b]">{accessory.serialNumber || '-'}</b></span>
                    <span className="text-sm text-[#666666]">Mã: <b className="font-semibold text-[#18181b]">{accessory.code || accessory.componentAccessory?.code || '-'}</b></span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="Chưa có thông tin đầu dò/phụ kiện." />
            )}
          </div>
        ) : null}

        {activeSection === 'parts' ? (
          <div className="border-t border-[#eeeeee] pt-5">
            <div className="mb-3">
              <h3 className="text-xl font-medium text-[#1f1f1f]">Lịch sử linh kiện thay thế</h3>
            </div>
            {partHistory.length ? (
              <div className="grid gap-2">
                {partHistory.map((item) => (
                  <article className="grid gap-3 rounded-[18px] border border-[#eeeeee] bg-[#fafafa] p-4 min-[980px]:grid-cols-[minmax(0,1fr)_170px_220px]" key={item.id}>
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-[#3e8375] shadow-[inset_0_0_0_1px_rgba(62,131,117,0.18)]">{item.sourceKind}</span>
                        <span className="text-xs font-semibold text-[#667085]">{item.sourceCode}</span>
                      </div>
                      <strong className="block truncate text-base font-semibold text-[#202124]">{item.part.name}</strong>
                      <span className="mt-1 block text-sm text-[#667085]">
                        {[item.part.serialNumber ? `S/N ${item.part.serialNumber}` : '', item.part.note].filter(Boolean).join(' - ') || 'Không có ghi chú'}
                      </span>
                    </div>
                    <div className="grid content-start gap-1 text-sm text-[#667085]">
                      <span>Ngày: <strong className="text-[#202124]">{formatDashboardDate(item.date)}</strong></span>
                      <span>Số lượng: <strong className="text-[#202124]">{formatNumber(Number(item.part.quantity || 0))} {item.part.unit || ''}</strong></span>
                      <span>Giá bán: <strong className="text-[#202124]">{formatCurrency(Number(item.part.totalPrice ?? Number(item.part.quantity || 0) * Number(item.part.unitPrice || 0)))}</strong></span>
                    </div>
                    <div className="grid content-start gap-1 text-sm text-[#667085]">
                      <span>Kỹ sư: <strong className="text-[#202124]">{item.engineer?.fullName || item.engineer?.email || '-'}</strong></span>
                      <span>Khách: <strong className="text-[#202124]">{item.customer?.name || item.customer?.hospitalName || customer?.name || customer?.hospitalName || '-'}</strong></span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState text="Chưa có lịch sử thay thế linh kiện cho máy này." />
            )}
          </div>
        ) : null}
      </div>

      {activeSection === 'app' ? (
      <div className="min-w-0 rounded-lg border border-[#e5e5e5] bg-white p-6 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
        <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
          <h2 className="text-2xl font-medium leading-tight text-[#1f1f1f]">Lịch sử ứng dụng xét nghiệm</h2>
          <span className="rounded-full bg-[#fafafa] px-3 py-1 text-sm font-semibold text-[#666666]">{appCases.length} ca</span>
        </div>
        {appCases.length ? (
          <div className="grid gap-2">
            {appCases.map((item) => (
              <article className="grid gap-3 rounded-[18px] border border-[#eeeeee] bg-[#fafafa] p-4 min-[980px]:grid-cols-[minmax(0,1fr)_190px_220px]" key={item.id}>
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-[#3e8375] shadow-[inset_0_0_0_1px_rgba(62,131,117,0.18)]">{appWorkTypeLabel(item.workType)}</span>
                    {item.issueCategory ? <span className="text-xs font-semibold text-[#667085]">{displayLabel(item.issueCategory)}</span> : null}
                  </div>
                  <strong className="block truncate text-base font-semibold text-[#202124]">{item.title}</strong>
                  {item.issueDescription ? <span className="mt-1 block text-sm text-[#667085]">{item.issueDescription}</span> : null}
                  {item.resolution ? <span className="mt-2 block rounded-xl bg-white px-3 py-2 text-sm text-[#333333]">{item.resolution}</span> : null}
                </div>
                <div className="grid content-start gap-1 text-sm text-[#667085]">
                  <span>Ngày: <strong className="text-[#202124]">{formatDashboardDate(item.supportedAt)}</strong></span>
                  <span>Trạng thái: <strong className="text-[#202124]">{displayLabel(item.status)}</strong></span>
                  <span>Kênh: <strong className="text-[#202124]">{item.channel ? displayLabel(item.channel) : '-'}</strong></span>
                </div>
                <div className="grid content-start gap-1 text-sm text-[#667085]">
                  <span>Kỹ sư: <strong className="text-[#202124]">{item.engineer?.fullName || item.engineer?.email || '-'}</strong></span>
                  <span>Khách: <strong className="text-[#202124]">{item.customer?.name || item.customer?.hospitalName || customer?.name || customer?.hospitalName || '-'}</strong></span>
                  {machineAppSummary(item) ? <span><strong className="text-[#202124]">{machineAppSummary(item)}</strong></span> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState text="Chưa có lịch sử app cho máy này." />
        )}
      </div>
      ) : null}

      {activeSection === 'customer' ? (
      <div className="min-w-0 rounded-lg border border-[#e5e5e5] bg-white p-6 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
        <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
          <h2 className="text-2xl font-medium leading-tight text-[#1f1f1f]">Khách hàng đã lắp máy</h2>
          {latestInstallation?.code ? <span className="rounded-full bg-[#fafafa] px-3 py-1 text-sm font-semibold text-[#666666]">{latestInstallation.code}</span> : null}
        </div>
        {customer ? (
          <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            <InfoItem label="Khách hàng" value={customer.name || customer.hospitalName} />
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
      ) : null}

      {activeSection === 'history' ? (
      <>
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
          emptyText="Chưa có lịch sử app."
          items={appCases.slice(0, 5).map((item) => ({
            id: item.id,
            title: `${appWorkTypeLabel(item.workType)} - ${displayLabel(item.status)}`,
            date: formatDashboardDate(item.supportedAt),
            description: [item.title, item.resolution, machineAppSummary(item), item.engineer?.fullName].filter(Boolean).join(' - '),
          }))}
          title="Ứng dụng xét nghiệm"
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
      </>
      ) : null}
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

function MachineBusinessSignalPanel({ signals }: { signals: MachineBusinessSignal[] }) {
  const prioritySignals = signals.filter((signal) => signal.tone === 'danger' || signal.tone === 'warning');

  return (
    <section className="mb-5 grid gap-3 rounded-lg border border-[#d8e0ea] bg-[#f8fafc] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[12px] font-semibold text-[#666666]">Tín hiệu nghiệp vụ</span>
          <h3 className="mt-1 text-lg font-semibold leading-tight text-[#1f1f1f]">Việc cần chú ý trên máy này</h3>
        </div>
        <span className={`inline-flex min-h-8 items-center gap-2 rounded-lg border px-2.5 text-sm font-semibold ${prioritySignals.length ? 'border-[#efd8a8] bg-[#fff8ed] text-[#9b5a17]' : 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]'}`}>
          {prioritySignals.length ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
          {prioritySignals.length ? `${prioritySignals.length} cảnh báo` : 'Ổn định'}
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
        {signals.map((signal) => {
          const content = (
            <>
              <span className="text-[12px] font-medium text-[#666666]">{signal.label}</span>
              <strong className="mt-1 block break-words text-base font-semibold leading-snug text-[#1f1f1f]">{signal.value}</strong>
            </>
          );

          if (signal.href) {
            return (
              <Link className={`grid min-h-[82px] gap-1 rounded-lg border p-3 transition hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(24,24,27,0.08)] ${businessSignalToneClass(signal.tone)}`} key={signal.id} to={signal.href}>
                {content}
              </Link>
            );
          }

          return (
            <div className={`grid min-h-[82px] gap-1 rounded-lg border p-3 ${businessSignalToneClass(signal.tone)}`} key={signal.id}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MachineProfileCompletenessCard({
  completed,
  gaps,
  total,
}: {
  completed: number;
  gaps: MachineProfileGap[];
  total: number;
}) {
  const percent = total ? Math.round((completed / total) * 100) : 100;
  const missing = gaps.filter((gap) => !gap.done);

  return (
    <section className="mt-5 rounded-lg border border-[#e5e5e5] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[12px] font-semibold text-[#666666]">Độ đầy đủ hồ sơ</span>
          <h3 className="mt-1 text-lg font-semibold text-[#1f1f1f]">{percent}% đã hoàn thiện</h3>
        </div>
        <span className={`inline-flex min-h-8 items-center gap-2 rounded-lg border px-2.5 text-sm font-semibold ${missing.length ? 'border-[#efd8a8] bg-[#fff8ed] text-[#9b5a17]' : 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]'}`}>
          <ClipboardCheck size={16} />
          {completed}/{total}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eeeeee]">
        <span className="block h-full rounded-full bg-[#18181b]" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {gaps.map((gap) => (
          <div className="flex min-h-9 items-center gap-2 rounded-lg border border-[#eeeeee] bg-[#fafafa] px-3 py-2 text-sm" key={gap.id}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${gap.done ? 'bg-[#177245]' : 'bg-[#d97706]'}`} />
            <span className={gap.done ? 'font-medium text-[#333333]' : 'font-semibold text-[#9b5a17]'}>{gap.label}</span>
          </div>
        ))}
      </div>
    </section>
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
        <h2 className="mt-1 text-2xl font-medium leading-tight text-[#1f1f1f]">Chi tiết máy</h2>
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
        <EmptyState text="Chưa chọn S/N." />
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
    <div className="grid gap-1.5 rounded-lg border border-[#d8e0ea] bg-white p-3 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
      <span className="text-xs font-medium text-[#666666]">{label}</span>
      <div className="flex items-end justify-between gap-3">
        <strong className="text-2xl font-semibold leading-none text-[#1f1f1f]">{value}</strong>
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${toneClass}`}>
          <PackageSearch size={15} />
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
  const [expanded, setExpanded] = useState(false);
  const maxCount = Math.max(1, ...items.map((item) => item.count));

  return (
    <section className={`grid gap-4 rounded-lg border border-[#d8e0ea] bg-white p-5 shadow-[0_12px_34px_rgba(24,24,27,0.06)] ${expanded ? 'min-h-[300px]' : 'content-start'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[12px] font-semibold text-[#666666]">Biểu đồ ngành hàng</span>
          <h2 className="mt-1 text-xl font-semibold text-[#1f1f1f]">Số máy theo ngành hàng</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#dbe5ef] bg-[#fafafa] px-2.5 text-sm font-medium text-[#18181b]">
            <PackageSearch size={17} />
            {items.reduce((sum, item) => sum + item.count, 0)}
          </span>
          <button className="secondary-button compact" onClick={() => setExpanded((value) => !value)} type="button">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {expanded ? 'Thu gọn' : 'Mở biểu đồ'}
          </button>
        </div>
      </div>

      {expanded && loading ? (
        <div className="grid min-h-[180px] place-items-center rounded-lg border border-dashed border-[#d7e0eb] bg-[#fafafa] text-sm font-semibold text-[#666666]">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="spin-icon" size={17} />
            Đang tải biểu đồ
          </span>
        </div>
      ) : null}

      {expanded && !loading && items.length ? (
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

      {expanded && !loading && !items.length ? <EmptyState text="Chưa có dữ liệu ngành hàng để hiển thị biểu đồ." /> : null}
    </section>
  );
}

function MachineTableRow({ canEdit, machine, modelLabel }: { canEdit: boolean; machine: DashboardMachine; modelLabel: string }) {
  const customerName = machine.customer?.name || machine.customer?.hospitalName || '';
  const warrantyText = machine.warrantyEndDate ? formatDashboardDate(machine.warrantyEndDate) : '';
  const engineerName = machine.primaryEngineer?.fullName || machine.installedBy?.fullName || machine.primaryEngineer?.email || machine.installedBy?.email || '';

  return (
    <tr>
      <td className="machine-table-device">
        <Link className="font-semibold text-[#18181b] hover:underline" to={`/technical-machines/${machine.id}`}>{machine.serialNumber}</Link>
        <span>{machine.machineCode || machine.name || 'Chưa có mã máy'}</span>
      </td>
      <td><strong className="machine-table-model" title={modelLabel}>{modelLabel || 'Chưa có model'}</strong></td>
      <td className="machine-table-customer">
        <strong title={customerName}>{customerName || 'Chưa gắn khách hàng'}</strong>
        <span>{[machine.customer?.province, machine.customer?.phone || machine.customer?.contactPhone].filter(Boolean).join(' · ') || '-'}</span>
      </td>
      <td>
        <div className="machine-table-status">
          <StatusPill value={machine.inventoryStatus || ''} />
          <StatusPill subtle value={machine.status || ''} />
          {machine.demoCategory ? <span className="rounded-full bg-[#f0eaff] px-2 py-1 text-[11px] font-bold text-[#6236a5]">{demoCategoryLabel(machine.demoCategory)}</span> : null}
          {machine.demoPreparationStatus === 'REQUIRED' ? <span className="rounded-full bg-[#fff3df] px-2 py-1 text-[11px] font-bold text-[#9a5a00]">Chờ xử lý demo</span> : null}
        </div>
      </td>
      <td className="machine-table-detail">
        <strong className={warrantyClass(machine.warrantyEndDate)}>{warrantyText || 'Chưa có hạn'}</strong>
        <span>{machine.installDate ? `Lắp ${formatDashboardDate(machine.installDate)}` : 'Chưa có ngày lắp'}</span>
      </td>
      <td className="machine-table-detail">
        <strong>{machine.latestActivity ? formatDashboardDate(machine.latestActivity.date) : 'Chưa có hoạt động'}</strong>
        {machine.latestActivity ? <span>{displayLabel(machine.latestActivity.type)}</span> : null}
      </td>
      <td className="machine-table-engineer">{engineerName || '-'}</td>
      <td>
        <div className="machine-table-actions">
          <Link aria-label={`Xem máy ${machine.serialNumber}`} className="icon-button machine-action--view !h-7 !w-7" title="Xem hồ sơ máy" to={`/technical-machines/${machine.id}`}><Eye size={13} /></Link>
          {canEdit ? <Link aria-label={`Sửa máy ${machine.serialNumber}`} className="icon-button machine-action--edit !h-7 !w-7" title="Sửa hồ sơ máy" to={`/technical-machines/${machine.id}/edit`}><Edit3 size={13} /></Link> : null}
        </div>
      </td>
    </tr>
  );
}

function demoCategoryLabel(value: NonNullable<DashboardMachine['demoCategory']>) {
  if (value === 'DEMO_UNIT') return 'Máy demo';
  if (value === 'DEMO_USED') return 'Đã qua demo';
  return 'Máy mới đang demo';
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

function buildMachineBusinessSignals(machine: DashboardMachine, warrantyEndDate?: string | null): MachineBusinessSignal[] {
  const repairs = machine.repairs ?? [];
  const maintenances = machine.maintenances ?? [];
  const installations = machine.installations ?? [];
  const openRepairs = repairs.filter((repair) => !['COMPLETED', 'CANCELLED'].includes(repair.status));
  const waitingParts = repairs.filter((repair) => repair.status === 'WAITING_PARTS');
  const openMaintenances = maintenances.filter((maintenance) => !['COMPLETED', 'CANCELLED'].includes(maintenance.status));
  const overdueMaintenances = openMaintenances.filter((maintenance) => isPastDate(maintenance.scheduledDate));
  const pendingInstallations = installations.filter((installation) => installation.status === 'PENDING');
  const nextMaintenance = findNextMaintenance(maintenances);
  const warrantySignal = buildWarrantySignal(warrantyEndDate);
  const operationSignal = buildOperationSignal(openRepairs.length, waitingParts.length, overdueMaintenances.length, pendingInstallations.length);
  const nextMaintenanceSignal: MachineBusinessSignal = nextMaintenance
    ? {
        id: 'next-maintenance',
        label: 'Bảo trì tiếp theo',
        value: `${formatDashboardDate(nextMaintenance.date)}${nextMaintenance.source === 'nextDueDate' ? ' - lịch hẹn lại' : ' - lịch đang mở'}`,
        tone: isPastDate(nextMaintenance.date) ? 'danger' : daysUntil(nextMaintenance.date) <= 14 ? 'warning' : 'info',
      }
    : {
        id: 'next-maintenance',
        label: 'Bảo trì tiếp theo',
        value: maintenances.length ? 'Chưa có lịch tiếp theo' : 'Chưa từng bảo trì',
        tone: maintenances.length ? 'warning' : 'neutral',
      };
  const ownerSignal: MachineBusinessSignal = machine.primaryEngineer || machine.installedBy
    ? {
        id: 'owner',
        label: 'Kỹ sư phụ trách',
        value: machine.primaryEngineer?.fullName || machine.installedBy?.fullName || machine.primaryEngineer?.email || machine.installedBy?.email || 'Đã phân công',
        tone: 'good',
      }
    : {
        id: 'owner',
        label: 'Kỹ sư phụ trách',
        value: 'Chưa phân công',
        tone: 'warning',
      };

  return [warrantySignal, operationSignal, nextMaintenanceSignal, ownerSignal];
}

function buildWarrantySignal(warrantyEndDate?: string | null): MachineBusinessSignal {
  if (!warrantyEndDate) {
    return {
      id: 'warranty',
      label: 'Bảo hành',
      value: 'Chưa có hạn bảo hành',
      tone: 'warning',
    };
  }

  const left = daysUntil(warrantyEndDate);
  if (left < 0) {
    return {
      id: 'warranty',
      label: 'Bảo hành',
      value: `Đã hết hạn ${Math.abs(left)} ngày`,
      tone: 'danger',
    };
  }

  if (left <= 30) {
    return {
      id: 'warranty',
      label: 'Bảo hành',
      value: `Còn ${left} ngày`,
      tone: 'warning',
    };
  }

  return {
    id: 'warranty',
    label: 'Bảo hành',
    value: `Còn ${left} ngày`,
    tone: 'good',
  };
}

function buildOperationSignal(openRepairs: number, waitingParts: number, overdueMaintenances: number, pendingInstallations: number): MachineBusinessSignal {
  const parts = [
    openRepairs ? `${openRepairs} sửa chữa mở` : '',
    waitingParts ? `${waitingParts} chờ linh kiện` : '',
    overdueMaintenances ? `${overdueMaintenances} bảo trì quá hạn` : '',
    pendingInstallations ? `${pendingInstallations} lắp đặt chờ` : '',
  ].filter(Boolean);

  if (!parts.length) {
    return {
      id: 'operation',
      label: 'Vận hành',
      value: 'Không có việc mở',
      tone: 'good',
      href: '/service-tickets',
    };
  }

  return {
    id: 'operation',
    label: 'Vận hành',
    value: parts.join(' - '),
    tone: overdueMaintenances || waitingParts ? 'danger' : 'warning',
    href: '/service-tickets',
  };
}

function buildMachineProfileGaps(machine: DashboardMachine): MachineProfileGap[] {
  const customer = machine.customer ?? machine.installations?.[0]?.customer ?? null;
  const isInstalledLike = ['INSTALLED', 'RESERVED', 'SOLD'].includes(machine.inventoryStatus || '');

  return [
    { id: 'serial', label: 'Có serial máy', done: Boolean(machine.serialNumber) },
    { id: 'model', label: 'Có model/hãng thiết bị', done: Boolean(machine.modelName && machine.manufacturer) },
    { id: 'customer', label: 'Gắn khách hàng khi máy đã giao/lắp', done: !isInstalledLike || Boolean(customer) },
    { id: 'install-date', label: 'Có ngày lắp đặt', done: !isInstalledLike || Boolean(machine.installDate || machine.installation?.installedAt) },
    { id: 'warranty', label: 'Có thời hạn bảo hành', done: !isInstalledLike || Boolean(machine.warrantyEndDate || machine.warrantyCards?.[0]?.endDate || machine.installation?.warrantyCard?.endDate) },
    { id: 'engineer', label: 'Có kỹ sư phụ trách', done: Boolean(machine.primaryEngineer || machine.installedBy) },
    { id: 'accessories', label: 'Khai báo phụ kiện/đầu dò', done: Boolean(machine.accessories?.length) || machine.productCategory === 'OTHER' },
    { id: 'data-review', label: 'Dữ liệu đã xác minh', done: machine.dataStatus !== 'PENDING_REVIEW' },
  ];
}

function findNextMaintenance(maintenances: NonNullable<DashboardMachine['maintenances']>) {
  const candidates = maintenances
    .flatMap((maintenance) => [
      maintenance.nextDueDate ? { date: maintenance.nextDueDate, source: 'nextDueDate' as const } : null,
      !['COMPLETED', 'CANCELLED'].includes(maintenance.status) && maintenance.scheduledDate
        ? { date: maintenance.scheduledDate, source: 'scheduledDate' as const }
        : null,
    ])
    .filter((item): item is { date: string; source: 'nextDueDate' | 'scheduledDate' } => Boolean(item?.date))
    .sort((left, right) => Math.abs(daysUntil(left.date)) - Math.abs(daysUntil(right.date)));

  return candidates[0] ?? null;
}

function buildMachineLifecycleEvents(machine: DashboardMachine): MachineLifecycleEvent[] {
  const events: MachineLifecycleEvent[] = [];

  (machine.installations ?? []).forEach((installation) => {
    events.push({
      id: installation.id,
      kind: 'installation',
      title: `${installation.code} - ${installation.customer?.name || installation.customer?.hospitalName || 'Lắp đặt máy'}`,
      status: installation.status,
      date: installation.installedAt,
      description: [installation.installedBy?.fullName, installation.warrantyCard?.endDate ? `Bảo hành đến ${formatDashboardDate(installation.warrantyCard.endDate)}` : ''].filter(Boolean).join(' - '),
      meta: installation.code,
    });
  });

  (machine.demoLoans ?? []).forEach((loan) => {
    events.push({
      id: loan.id,
      kind: 'demo',
      title: `${loan.code} - Phiếu demo tại ${loan.customer?.name || loan.customer?.hospitalName || 'khách hàng'}`,
      status: loan.status,
      date: loan.preparedAt || loan.returnedAt || loan.handedOverAt || loan.plannedHandoverAt,
      description: [loan.engineer?.fullName || loan.engineer?.email, loan.preparationStatus ? `Chuẩn bị sau demo: ${displayLabel(loan.preparationStatus)}` : ''].filter(Boolean).join(' · '),
      meta: `Hạn thu hồi ${formatDashboardDate(loan.expectedReturnAt)}`,
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
      description: [movement.customer?.name || movement.customer?.hospitalName, movement.createdBy?.fullName, movement.note].filter(Boolean).join(' - '),
      meta: movement.code || undefined,
    });
  });

  (machine.applicationSupportCases ?? []).forEach((item) => {
    events.push({
      id: item.id,
      kind: 'app',
      title: `${appWorkTypeLabel(item.workType)} - ${item.title || 'Ứng dụng xét nghiệm'}`,
      status: item.status,
      date: item.supportedAt,
      description: [item.resolution, machineAppSummary(item), item.engineer?.fullName].filter(Boolean).join(' - '),
      meta: item.appModule || undefined,
    });
  });

  return events.sort((left, right) => {
    const dateOrder = lifecycleDateValue(right.date) - lifecycleDateValue(left.date);
    if (dateOrder !== 0) return dateOrder;

    const leftIsCurrentState = left.status === machine.inventoryStatus;
    const rightIsCurrentState = right.status === machine.inventoryStatus;
    if (leftIsCurrentState !== rightIsCurrentState) return rightIsCurrentState ? 1 : -1;

    if (left.kind === 'inventory' && right.kind === 'inventory') {
      return (right.meta || '').localeCompare(left.meta || '', 'en', { numeric: true });
    }
    return 0;
  });
}

function buildMachinePartHistory(machine: DashboardMachine): MachinePartHistoryItem[] {
  const items: MachinePartHistoryItem[] = [];

  (machine.repairs ?? []).forEach((repair) => {
    (repair.usedParts ?? []).forEach((part) => {
      items.push({
        id: `repair-${repair.id}-${part.id}`,
        sourceCode: repair.code,
        sourceId: repair.id,
        sourceKind: 'Sửa chữa',
        date: part.usedAt || repair.completedAt || repair.reportedAt,
        part,
        engineer: repair.engineer,
        customer: repair.customer ?? machine.customer,
      });
    });
  });

  (machine.maintenances ?? []).forEach((maintenance) => {
    (maintenance.usedParts ?? []).forEach((part) => {
      items.push({
        id: `maintenance-${maintenance.id}-${part.id}`,
        sourceCode: maintenance.code,
        sourceId: maintenance.id,
        sourceKind: 'Bảo trì',
        date: part.usedAt || maintenance.completedAt || maintenance.scheduledDate,
        part,
        engineer: maintenance.engineer,
        customer: maintenance.customer ?? machine.customer,
      });
    });
  });

  (machine.deviceServiceTickets ?? []).forEach((ticket) => {
    (ticket.usedParts ?? []).forEach((part) => {
      items.push({
        id: `device-service-${ticket.id}-${part.id}`,
        sourceCode: ticket.returnCode || ticket.receiveCode,
        sourceId: ticket.id,
        sourceKind: 'Nhận/trả',
        date: part.usedAt || ticket.returnedAt || ticket.receivedAt,
        part,
        engineer: ticket.engineer,
        customer: ticket.customer ?? machine.customer,
      });
    });
  });

  return items.sort((left, right) => lifecycleDateValue(right.date) - lifecycleDateValue(left.date));
}

function appWorkTypeLabel(value?: string | null) {
  const labels: Record<string, string> = {
    APP_SUPPORT: 'Ứng dụng xét nghiệm',
    REAGENT_SETUP: 'Cài hóa chất',
    QC_CALIBRATION: 'QC/Calib',
    LIS_HIS: 'LIS/HIS',
    TRAINING: 'Đào tạo',
    FOLLOW_UP: 'Follow-up',
    OTHER: 'Khác',
  };
  return labels[value || 'APP_SUPPORT'] || displayLabel(value || 'APP_SUPPORT');
}

function machineAppSummary(item: NonNullable<DashboardMachine['applicationSupportCases']>[number]) {
  return [
    item.reagentName ? `Hóa chất ${item.reagentName}` : '',
    item.reagentLot ? `Lot ${item.reagentLot}` : '',
    item.reagentExpiry ? `HSD ${formatDashboardDate(item.reagentExpiry)}` : '',
    item.assayName ? `Assay ${item.assayName}` : '',
    item.qcResult ? `QC ${item.qcResult}` : '',
    item.calibrationResult ? `Calib ${item.calibrationResult}` : '',
    item.lisHisStatus ? `LIS/HIS ${item.lisHisStatus}` : '',
  ].filter(Boolean).join(' | ');
}

function lifecycleDateValue(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function daysUntil(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function isPastDate(value?: string | null) {
  return daysUntil(value) < 0;
}

function businessSignalToneClass(tone: MachineBusinessSignal['tone']) {
  const classes: Record<MachineBusinessSignal['tone'], string> = {
    good: 'border-[#b9e8ca] bg-[#eefaf3]',
    info: 'border-[#b8cbe1] bg-[#eef6ff]',
    warning: 'border-[#efd8a8] bg-[#fff8ed]',
    danger: 'border-[#fecdd3] bg-[#fff1f3]',
    neutral: 'border-[#e5e5e5] bg-white',
  };
  return classes[tone];
}

function lifecycleKindLabel(kind: MachineLifecycleEvent['kind']) {
  const labels: Record<MachineLifecycleEvent['kind'], string> = {
    installation: 'Lắp đặt',
    warranty: 'Bảo hành',
    repair: 'Sửa chữa',
    maintenance: 'Bảo trì',
    inventory: 'Kho',
    app: 'App',
    demo: 'Demo',
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
    app: 'APP',
    demo: 'DM',
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
    app: 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]',
    demo: 'border-[#e9d5ff] bg-[#faf5ff] text-[#6b21a8]',
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
  previewCode,
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
  previewCode: string;
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

      <section className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] p-4 sm:p-5">
        <div><h3 className="text-base font-semibold text-[#202124]">Nhận diện thiết bị</h3></div>
        <div className="grid gap-3 md:grid-cols-2">
        <label className={editLabelClass}>
          Mã máy
          <input className={editFieldClass} disabled placeholder="Đang sinh mã..." value={editForm.machineCode || previewCode || 'Đang sinh mã...'} />
        </label>
        <label className={editLabelClass}>
          {isEditingEndoscopy ? 'Serial đại diện' : 'Serial'}
          <input
            className={editFieldClass}
            onChange={(event) => onUpdateForm({ serialNumber: event.target.value })}
            required={!isEditingEndoscopy}
            value={editForm.serialNumber}
          />
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
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] p-4 sm:p-5">
        <div><h3 className="text-base font-semibold text-[#202124]">Tình trạng thiết bị</h3></div>
        <div className="grid gap-3 md:grid-cols-2">
        <label className={editLabelClass}>
          Trạng thái máy
          <select className={editFieldClass} onChange={(event) => onUpdateForm({ status: event.target.value })} value={editForm.status}>
            {['ACTIVE', 'MAINTENANCE', 'REPAIRING', 'INACTIVE'].map((value) => (
              <option key={value} value={value}>{displayLabel(value)}</option>
            ))}
          </select>
        </label>
        <label className={editLabelClass}>
          Phân loại demo
          <select className={editFieldClass} onChange={(event) => onUpdateForm({ demoCategory: event.target.value })} value={editForm.demoCategory}>
            <option value="">Máy thông thường</option>
            <option value="DEMO_UNIT">Máy demo chuyên dụng</option>
            <option value="DEMO_STOCK">Máy mới có thể đem demo</option>
            <option value="DEMO_USED">Máy đã qua demo</option>
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
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] p-4 sm:p-5">
        <div><h3 className="text-base font-semibold text-[#202124]">Khách hàng quản lý</h3></div>
        <label className={editLabelClass}>
          Khách hàng
          <select className={editFieldClass} onChange={(event) => onUpdateForm({ customerId: event.target.value })} value={editForm.customerId}>
            <option value="">Chưa gắn khách hàng</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{[customer.customerCode, customer.name, customer.province].filter(Boolean).join(' - ')}</option>
            ))}
          </select>
        </label>
      </section>

      <section className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-[#fafafa] p-4 sm:p-5">
        <div><h3 className="text-base font-semibold text-[#202124]">Mốc thời gian và bảo hành</h3></div>
        <div className="grid gap-3 md:grid-cols-2">
        <DateInput className={editLabelClass} label="Ngày sản xuất" onChange={(value) => onUpdateForm({ manufacturingDate: value })} value={editForm.manufacturingDate} />
        <DateInput className={editLabelClass} label="Ngày nhập kho" onChange={(value) => onUpdateForm({ warehouseImportDate: value })} value={editForm.warehouseImportDate} />
        <DateInput className={editLabelClass} label="Ngày lắp" onChange={(value) => onUpdateForm({ installDate: value })} value={editForm.installDate} />
        <DateInput className={editLabelClass} label="Bắt đầu bảo hành" onChange={(value) => onUpdateForm({ warrantyStartDate: value })} value={editForm.warrantyStartDate} />
        <DateInput className={editLabelClass} label="Hết bảo hành" onChange={(value) => onUpdateForm({ warrantyEndDate: value })} value={editForm.warrantyEndDate} />
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-[#e5e7eb] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[12px] font-medium text-[#666666]">Đầu dò / Phụ kiện</span>
            <h3 className="mt-1 text-base font-medium text-[#1f1f1f]">{editForm.accessories.length} phụ kiện</h3>
          </div>
          <button className="secondary-button" onClick={onAddAccessory} type="button">
            <Plus size={16} />
            Thêm
          </button>
        </div>

        {isEditingUltrasound ? (
          <ProbePicker onSelect={onAddProbe} />
        ) : isEditingEndoscopy ? (
          <EndoscopyAccessoryChecklist
            selectedNames={new Set(editForm.accessories.map((accessory) => accessory.name || accessory.code).filter((name): name is string => Boolean(name)))}
            onToggle={onToggleEndoscopy}
            onToggleAll={(checked) => {
              endoscopyAccessoryOptions.forEach((option) => onToggleEndoscopy(option.value, checked));
            }}
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
                <button className="icon-button" onClick={() => onRemoveAccessory(accessory.clientId)} title="Xóa phụ kiện" type="button">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className={`grid gap-3 ${!isEditingUltrasound && !isCoreEndoscopyAccessoryName(accessory.name || accessory.code) ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                <label className={editLabelClass}>
                  {isEditingUltrasound ? 'Model đầu dò' : 'Tên phụ kiện'}
                  {isEditingUltrasound ? (
                    <select
                      className={editFieldClass}
                      onChange={(event) => {
                        const template = templateAccessories.find((item) => item.code === event.target.value || item.name === event.target.value);
                        onUpdateAccessory(accessory.clientId, {
                          componentAccessoryId: template?.id ?? null,
                          code: event.target.value,
                          name: template?.name || event.target.value,
                        });
                      }}
                      required
                      value={accessory.code || accessory.name}
                    >
                      <option value="">Chọn đầu dò</option>
                      {(templateAccessories.some((item) => ultrasoundProbeOptions.some((option) => option.value === item.code))
                        ? templateAccessories.filter((item) => ultrasoundProbeOptions.some((option) => option.value === item.code)).map((item) => ({ label: item.code, value: item.code }))
                        : ultrasoundProbeOptions).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input className={editFieldClass} onChange={(event) => onUpdateAccessory(accessory.clientId, { name: event.target.value })} required value={accessory.name} />
                  )}
                </label>
                <label className={editLabelClass}>
                  Serial
                  <input className={editFieldClass} onChange={(event) => onUpdateAccessory(accessory.clientId, { serialNumber: event.target.value })} value={accessory.serialNumber} />
                </label>
                {!isEditingUltrasound && !isCoreEndoscopyAccessoryName(accessory.name || accessory.code) ? (
                  <label className={editLabelClass}>
                    Số lượng
                    <input className={editFieldClass} min={1} onChange={(event) => onUpdateAccessory(accessory.clientId, { quantity: Number(event.target.value) || 1 })} type="number" value={accessory.quantity} />
                  </label>
                ) : null}
              </div>
              <details className="rounded-2xl border border-[#eef0f3] bg-white px-3 py-2 text-sm text-[#475569]">
                <summary className="cursor-pointer font-semibold text-[#334155]">Thông tin thêm</summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
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
              </details>
            </div>
          ))}
          {editForm.accessories.length === 0 ? <EmptyState text="Chưa có phụ kiện." /> : null}
        </div>
      </section>

      <div className="flex justify-end gap-2 border-t border-[#eeeeee] pt-4">
        <button className="secondary-button" disabled={saving} onClick={onCancel} type="button">Hủy</button>
        <button className="primary-button" disabled={saving} type="submit">
          {saving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
          {saving ? 'Đang lưu' : 'Lưu'}
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
    <div className="rounded-2xl border border-[#dbe5ef] bg-[#fafafa] p-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px] md:items-center">
        <span className="text-sm font-semibold text-[#333333]">Chọn đầu dò</span>
        <select
          className={editFieldClass}
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
    </div>
  );
}

function EndoscopyAccessoryChecklist({
  onToggle,
  onToggleAll,
  selectedNames,
}: {
  onToggle: (name: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  selectedNames: Set<string>;
}) {
  const [search, setSearch] = useState('');
  const visibleOptions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return endoscopyAccessoryOptions;
    return endoscopyAccessoryOptions.filter((option) => option.label.toLowerCase().includes(keyword));
  }, [search]);

  return (
    <div className="grid gap-3 rounded-lg border border-[#dbe5ef] bg-[#fafafa] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[#333333]">Checklist nội soi</span>
        <div className="flex flex-wrap gap-2">
          <button className="secondary-button compact" onClick={() => onToggleAll(true)} type="button">
            Chọn tất cả
          </button>
          <button className="secondary-button compact" onClick={() => onToggleAll(false)} type="button">
            Bỏ chọn
          </button>
        </div>
      </div>
      <input
        className="h-10 rounded-xl border border-[#d6d6d6] bg-white px-3 text-sm font-semibold text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.10)]"
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Tìm phụ kiện"
        value={search}
      />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visibleOptions.map((option) => (
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
    return <EmptyState text="Model này chưa có danh sách phụ kiện mẫu." />;
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

function formatCurrency(value: number) {
  if (!value) return '0 đ';
  return new Intl.NumberFormat('vi-VN', {
    currency: 'VND',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
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
    demoCategory: '',
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
    demoCategory: machine.demoCategory || '',
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
      quantity: Math.max(1, Number(accessory.quantity ?? 1) || 1),
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
    quantity: 1,
    serialNumber: '',
    description: '',
    note: '',
  };
}

function flattenTemplateAccessories(model: MachineModelDetail) {
  return (model.components ?? []).flatMap((component) =>
    (component.accessories ?? component.ComponentAccessory ?? []).map((accessory) => ({
      ...accessory,
      componentName: component.name,
    })),
  );
}

function hasAccessoryContent(accessory: EditMachineAccessoryForm) {
  return Boolean(accessory.id || accessory.name.trim() || accessory.serialNumber.trim() || accessory.code.trim() || accessory.description.trim() || accessory.note.trim());
}

const endoscopyCoreAccessoryNames = ['Bộ xử lý', 'Nguồn sáng'];
const endoscopyNoQuantityAccessoryNames = ['Bộ xử lý', 'Nguồn sáng', 'Màn hình'];

function ensureEndoscopyCoreAccessories(accessories: EditMachineAccessoryForm[]) {
  const existingNames = new Set(accessories.map((accessory) => accessory.name || accessory.code).filter(Boolean));
  const missingAccessories = endoscopyCoreAccessoryNames
    .filter((name) => !existingNames.has(name))
    .map((name) => ({ ...emptyEditAccessoryForm(), code: name, name }));

  return missingAccessories.length ? [...missingAccessories, ...accessories] : accessories;
}

function missingEndoscopyCoreSerials(accessories: EditMachineAccessoryForm[]) {
  return endoscopyCoreAccessoryNames.filter((name) => {
    const accessory = accessories.find((item) => item.name === name || item.code === name);
    return !accessory?.serialNumber.trim();
  });
}

function isCoreEndoscopyAccessoryName(name: string) {
  return endoscopyNoQuantityAccessoryNames.includes(name);
}

function getEndoscopyRepresentativeSerial(accessories: EditMachineAccessoryForm[]) {
  const processor = accessories.find((accessory) => accessory.name === 'Bộ xử lý' || accessory.code === 'Bộ xử lý');
  const lightSource = accessories.find((accessory) => accessory.name === 'Nguồn sáng' || accessory.code === 'Nguồn sáng');
  return processor?.serialNumber.trim() || lightSource?.serialNumber.trim() || '';
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

import { ArrowRight, CalendarDays, Download, FileText, FileUp, Loader2, Plus, Search, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages, getApiBaseUrl, getToken } from '../../api';
import { MachineAccessoryEditor } from '../../components/MachineAccessoryEditor';
import { isUltrasoundMachineModel } from '../../config/ultrasoundProbes';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { parseMachineAccessoriesInput } from '../../utils/machineAccessories';
import { InstallationHandoverForm } from './InstallationHandoverForm';
import { SummaryTile } from './SummaryTile';
import { attachmentOptionsByKind, installationStatusOptions, maintenanceStatusOptions, repairStatusOptions } from './constants';
import type {
  AttachmentType,
  CreateTicketForm,
  EngineerTask,
  InstallationDeviceItem,
  InstallationTask,
  KindFilter,
  MaintenanceTask,
  RepairTask,
  SelectOption,
  TaskAttachment,
  TaskFilter,
  TaskKind,
  TaskMachine,
  WorkspaceTab,
} from './types';
import {
  attachmentTypeLabel,
  compareTasks,
  createTicketTitle,
  deviceConditionLabel,
  emptyCreateTicketForm,
  emptyInstallationDeviceItem,
  entityTypeForTask,
  formatDate,
  formatFileSize,
  isOverdueTask,
  isTodayTask,
  isUpcomingTask,
  needsMachineProfile,
  matchesFilter,
  nextDefaultStatus,
  normalizeInstallationDeviceItems,
  secondaryLabel,
  secondaryTone,
  splitLines,
  statusLabel,
  statusTone,
  taskCustomer,
  taskDate,
  taskDescription,
  taskIcon,
  taskKindLabel,
  taskModelText,
  taskSerialText,
  taskTitle,
  warrantyStatusLabel,
} from './utils';
import './styles.css';

type QuickMachineForm = {
  accessoriesText: string;
  customerId: string;
  machineModelId: string;
  modelName: string;
  name: string;
  serialNumber: string;
};

const emptyQuickMachineForm = (): QuickMachineForm => ({
  accessoriesText: '',
  customerId: '',
  machineModelId: '',
  modelName: '',
  name: '',
  serialNumber: '',
});

type DailyWorkNote = {
  id: string;
  title: string;
  note?: string | null;
  workDate: string;
  startTime?: string | null;
  endTime?: string | null;
  color?: string | null;
  type?: DailyWorkType;
  status?: DailyWorkStatus;
  rejectReason?: string | null;
};

type DailyWorkType = 'WORK' | 'BUSINESS_TRIP' | 'LEAVE' | 'REPAIR' | 'INSTALLATION' | 'MAINTENANCE' | 'OTHER';
type DailyWorkStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

const dailyWorkTypeLabels: Record<DailyWorkType, string> = {
  WORK: 'Công việc',
  BUSINESS_TRIP: 'Công tác',
  LEAVE: 'Nghỉ phép',
  REPAIR: 'Sửa chữa',
  INSTALLATION: 'Lắp đặt',
  MAINTENANCE: 'Bảo trì',
  OTHER: 'Khác',
};

const dailyWorkStatusMeta: Record<DailyWorkStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Nháp', className: 'border-[#d9e1ea] bg-white text-[#657386]' },
  PENDING: { label: 'Chờ duyệt', className: 'border-[#efd8a8] bg-[#fffaeb] text-[#9b5a17]' },
  APPROVED: { label: 'Đã duyệt', className: 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]' },
  REJECTED: { label: 'Từ chối', className: 'border-[#f4c9c4] bg-[#fff6f4] text-[#a3342b]' },
  CANCELLED: { label: 'Đã hủy', className: 'border-[#d9e1ea] bg-[#f8fafc] text-[#657386]' },
};

type QuickCustomerForm = {
  address: string;
  contactPerson: string;
  name: string;
  phone: string;
  province: string;
};

const emptyQuickCustomerForm = (): QuickCustomerForm => ({
  address: '',
  contactPerson: '',
  name: '',
  phone: '',
  province: '',
});

type QuickMachineModel = {
  id: string;
  code?: string | null;
  name?: string | null;
  displayName?: string | null;
  manufacturer?: string | null;
  productCategory?: string | null;
  businessLine?: {
    productCategory?: string | null;
    expertiseGroup?: 'IMAGING' | 'LAB_TESTING' | null;
    productIndustry?: {
      expertiseGroup?: 'IMAGING' | 'LAB_TESTING' | null;
    } | null;
  } | null;
};

type PickerOption<Row> = SelectOption & {
  row: Row;
};

type PickerMachine = TaskMachine & {
  id: string;
  inventoryStatus?: string | null;
  name?: string | null;
  customer?: {
    id?: string | null;
    name?: string | null;
    province?: string | null;
  } | null;
};

type PickerCustomer = {
  id: string;
  customerCode?: string | null;
  name: string;
  phone?: string | null;
  province?: string | null;
};

type BusinessTab = 'repair' | 'maintenance' | 'installation' | 'warranty' | 'calendar';

type WeeklyReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'NEEDS_REVISION';

type WeeklyReportQuick = {
  id: string;
  weekStart: string;
  status: WeeklyReportStatus;
  submittedAt?: string | null;
  rows?: Array<{ id: string }>;
};

const weeklyReportStatusLabels: Record<WeeklyReportStatus | 'NONE', string> = {
  NONE: 'Chưa có',
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã gửi',
  APPROVED: 'Đã duyệt',
  NEEDS_REVISION: 'Cần sửa',
};

const businessTabs: Array<{ value: BusinessTab; label: string }> = [
  { value: 'repair', label: 'Sửa chữa' },
  { value: 'maintenance', label: 'Bảo trì' },
  { value: 'installation', label: 'Lắp đặt' },
  { value: 'warranty', label: 'Bảo hành' },
  { value: 'calendar', label: 'Lịch công việc' },
];

export function EngineerTasksPage({ user }: { user: ApiUser }) {
  const [tasks, setTasks] = useState<EngineerTask[]>([]);
  const [dailyWorkNotes, setDailyWorkNotes] = useState<DailyWorkNote[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportQuick | null>(null);
  const [loadingWeeklyReport, setLoadingWeeklyReport] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingDailyWork, setLoadingDailyWork] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [loadingCreateOptions, setLoadingCreateOptions] = useState(true);
  const [creatingMachine, setCreatingMachine] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TaskFilter>('open');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('assigned');
  const [businessTab, setBusinessTab] = useState<BusinessTab>('repair');
  const [selectedTask, setSelectedTask] = useState<EngineerTask | null>(null);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [attachmentType, setAttachmentType] = useState<AttachmentType>('MACHINE_PHOTO');
  const [attachmentTitle, setAttachmentTitle] = useState('');
  const [attachmentDescription, setAttachmentDescription] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [status, setStatus] = useState('');
  const [resultNote, setResultNote] = useState('');
  const [customerFeedback, setCustomerFeedback] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [installationDate, setInstallationDate] = useState('');
  const [createForm, setCreateForm] = useState<CreateTicketForm>(() => emptyCreateTicketForm());
  const [installationEditForm, setInstallationEditForm] = useState<CreateTicketForm>(() => emptyCreateTicketForm('installation'));
  const [isQuickMachineOpen, setIsQuickMachineOpen] = useState(false);
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);
  const [quickMachineForm, setQuickMachineForm] = useState<QuickMachineForm>(() => emptyQuickMachineForm());
  const [quickCustomerForm, setQuickCustomerForm] = useState<QuickCustomerForm>(() => emptyQuickCustomerForm());
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [machineOptions, setMachineOptions] = useState<Array<PickerOption<PickerMachine>>>([]);
  const [machineModelOptions, setMachineModelOptions] = useState<QuickMachineModel[]>([]);
  const [customerOptions, setCustomerOptions] = useState<Array<PickerOption<PickerCustomer>>>([]);

  useEffect(() => {
    loadTasks();
    loadDailyWorkNotes();
    loadWeeklyReportQuick();
  }, [user.id]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tasks.filter((task) => {
      if (!matchesBusinessTab(task, businessTab)) return false;
      if (!matchesFilter(task, filter)) return false;
      if (kindFilter !== 'all' && task.kind !== kindFilter) return false;
      if (!normalizedQuery) return true;

      return [
        task.code,
        taskTitle(task),
        taskDescription(task),
        task.machine?.machineCode,
        task.machine?.serialNumber,
        task.machine?.modelName,
        taskCustomer(task),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [businessTab, filter, kindFilter, query, tasks]);

  const businessTabCounts = useMemo(
    () => ({
      repair: tasks.filter((task) => matchesBusinessTab(task, 'repair')).length,
      maintenance: tasks.filter((task) => matchesBusinessTab(task, 'maintenance')).length,
      installation: tasks.filter((task) => matchesBusinessTab(task, 'installation')).length,
      warranty: tasks.filter((task) => matchesBusinessTab(task, 'warranty')).length,
      calendar: dailyWorkNotes.length,
    }),
    [dailyWorkNotes.length, tasks],
  );

  const filteredDailyWorkNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return dailyWorkNotes.filter((note) => {
      if (!normalizedQuery) return true;
      return [note.title, note.note, formatDailyWorkDate(note.workDate), note.startTime, note.endTime]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [dailyWorkNotes, query]);

  const taskStats = useMemo(
    () => ({
      open: tasks.filter((task) => matchesFilter(task, 'open')).length,
      progress: tasks.filter((task) => matchesFilter(task, 'progress')).length,
      done: tasks.filter((task) => matchesFilter(task, 'done')).length,
      today: tasks.filter(isTodayTask).length,
      overdue: tasks.filter(isOverdueTask).length,
      upcoming: tasks.filter(isUpcomingTask).length,
      missingMachine: tasks.filter(needsMachineProfile).length,
    }),
    [tasks],
  );

  const priorityTasks = useMemo(() => {
    return tasks
      .filter((task) => !['COMPLETED', 'CANCELLED', 'INSTALLED'].includes(task.status))
      .filter((task) => isOverdueTask(task) || isTodayTask(task) || needsMachineProfile(task))
      .sort((a, b) => {
        const priorityA = taskPriorityScore(a);
        const priorityB = taskPriorityScore(b);
        if (priorityB !== priorityA) return priorityB - priorityA;
        return compareTasks(a, b);
      })
      .slice(0, 5);
  }, [tasks]);

  async function loadTasks() {
    setLoading(true);
    setError('');

    try {
      const [repairs, maintenances, installations] = await Promise.all([
        apiFetch<Paginated<RepairTask>>(`/repairs?engineerId=${user.id}&limit=100`),
        apiFetch<Paginated<MaintenanceTask>>(`/maintenance?engineerId=${user.id}&limit=100`),
        apiFetch<Paginated<InstallationTask>>(`/installations?installedById=${user.id}&limit=100`),
      ]);

      setTasks([
        ...repairs.data.map((task) => ({ ...task, kind: 'repair' as const })),
        ...maintenances.data.map((task) => ({ ...task, kind: 'maintenance' as const })),
        ...installations.data.map((task) => ({ ...task, kind: 'installation' as const })),
      ].sort(compareTasks));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được việc được giao.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDailyWorkNotes() {
    setLoadingDailyWork(true);

    const today = startOfDay(new Date());
    const future = addDays(today, 60);
    const query = new URLSearchParams({
      from: toDateInput(today),
      to: toDateInput(future),
    });

    try {
      const result = await apiFetch<DailyWorkNote[]>(`/daily-work-notes?${query.toString()}`);
      setDailyWorkNotes(result);
    } catch {
      setDailyWorkNotes([]);
    } finally {
      setLoadingDailyWork(false);
    }
  }

  async function loadWeeklyReportQuick() {
    setLoadingWeeklyReport(true);
    const weekStart = toDateInput(startOfWeek(new Date()));

    try {
      const result = await apiFetch<WeeklyReportQuick | null | undefined>(`/weekly-reports?weekStart=${weekStart}`);
      setWeeklyReport(result ?? null);
    } catch {
      setWeeklyReport(null);
    } finally {
      setLoadingWeeklyReport(false);
    }
  }

  async function loadCreateOptions() {
    setLoadingCreateOptions(true);

    try {
      const [machinesResult, customersResult] = await Promise.all([
        apiFetch<Paginated<PickerMachine>>('/machines?limit=20&inventoryStatus=INSTALLED'),
        apiFetch<Paginated<PickerCustomer>>('/customers?limit=20'),
      ]);
      const modelsResult = await apiFetchAllPages<QuickMachineModel>('/machine-models');

      setMachineOptions(
        machinesResult.data.filter((machine) => canEngineerSeeMachine(user, machine)).map((machine) => ({
          value: machine.id,
          label: machinePickerLabel(machine),
          row: machine,
        })),
      );
      setCustomerOptions(
        customersResult.data.map((customer) => ({
          value: customer.id,
          label: customerPickerLabel(customer),
          row: customer,
        })),
      );
      setMachineModelOptions(modelsResult.filter((model) => canEngineerSeeModel(user, model)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu tạo phiếu.');
    } finally {
      setLoadingCreateOptions(false);
    }
  }

  async function handleCreateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (createForm.kind === 'repair') {
        await apiFetch('/repairs', {
          method: 'POST',
          body: JSON.stringify({
            title: createForm.title.trim(),
            description: createForm.description.trim() || undefined,
            machineId: createForm.machineId || undefined,
            engineerId: user.id,
            priority: createForm.priority,
            reportedAt: createForm.workDate || undefined,
            usingDepartment: createForm.usingDepartment.trim() || undefined,
            representative: createForm.representative.trim() || undefined,
            address: createForm.address.trim() || undefined,
            contactPhone: createForm.contactPhone.trim() || undefined,
            deviceName: createForm.deviceName.trim() || undefined,
            modelName: createForm.modelName.trim() || undefined,
            serialNumber: createForm.serialNumber.trim() || undefined,
            warrantyStatus: createForm.warrantyStatus,
            conditionAssessment: createForm.conditionAssessment.trim() || undefined,
            repairMethod: createForm.repairMethod.trim() || undefined,
          }),
        });
      } else if (createForm.kind === 'maintenance') {
        await apiFetch('/maintenance', {
          method: 'POST',
          body: JSON.stringify({
            title: createForm.title.trim(),
            description: createForm.description.trim() || undefined,
            type: createForm.maintenanceType,
            machineId: createForm.machineId || undefined,
            engineerId: user.id,
            scheduledDate: createForm.workDate,
            nextDueDate: createForm.nextDueDate || undefined,
            checklist: splitLines(createForm.checklist),
            usingDepartment: createForm.usingDepartment.trim() || undefined,
            representative: createForm.representative.trim() || undefined,
            address: createForm.address.trim() || undefined,
            contactPhone: createForm.contactPhone.trim() || undefined,
            deviceName: createForm.deviceName.trim() || undefined,
            modelName: createForm.modelName.trim() || undefined,
            serialNumber: createForm.serialNumber.trim() || undefined,
          }),
        });
      } else {
        const selectedModel = machineModelOptions.find((model) => model.id === createForm.machineModelId);
        await apiFetch('/installations', {
          method: 'POST',
          body: JSON.stringify({
            machineId: createForm.machineId || undefined,
            machineModelId: createForm.machineModelId || undefined,
            plannedModelName: selectedModel?.name || createForm.modelName.trim() || undefined,
            customerId: createForm.customerId,
            installedById: user.id,
            installedAt: createForm.workDate,
            warrantyStartDate: createForm.workDate,
            warrantyEndDate: createForm.warrantyEndDate,
            accessories: splitLines(createForm.accessories),
            note: createForm.description.trim() || undefined,
            handoverInstallerName: createForm.handoverInstallerName.trim() || undefined,
            handoverInstallerPosition: createForm.handoverInstallerPosition.trim() || undefined,
            handoverVehicle: createForm.handoverVehicle.trim() || undefined,
            handoverDepartureDate: createForm.handoverDepartureDate || undefined,
            receiverInstallAddress: createForm.receiverInstallAddress.trim() || undefined,
            receiverRepresentative: createForm.receiverRepresentative.trim() || undefined,
            receiverPosition: createForm.receiverPosition.trim() || undefined,
            receiverPhone: createForm.receiverPhone.trim() || undefined,
            installedDeviceItems: normalizeInstallationDeviceItems(createForm.installedDeviceItems),
            deviceCondition: createForm.deviceCondition,
            deviceConditionNote: createForm.deviceConditionNote.trim() || undefined,
          }),
        });
      }

      setCreateForm(emptyCreateTicketForm());
      setSuccess('Đã tạo phiếu và gửi về hệ thống cho admin theo dõi.');
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được phiếu.');
    } finally {
      setSaving(false);
    }
  }

  function updateCreateForm(patch: Partial<CreateTicketForm>) {
    setCreateForm((current) => ({ ...current, ...patch }));
  }

  function updateInstallationEditForm(patch: Partial<CreateTicketForm>) {
    setInstallationEditForm((current) => ({ ...current, ...patch }));
  }

  function changeCreateKind(kind: TaskKind) {
    setCreateForm((current) => ({
      ...current,
      kind,
      machineId: '',
      customerId: '',
      deviceName: '',
      modelName: '',
      serialNumber: '',
    }));
    setQuickMachineForm(emptyQuickMachineForm());
  }

  function openCreateRequest() {
    const kind = defaultCreateKindForBusinessTab(businessTab);
    setCreateForm((current) => ({
      ...current,
      kind,
      machineId: '',
      customerId: '',
      deviceName: '',
      modelName: '',
      serialNumber: '',
      warrantyStatus: businessTab === 'warranty' ? 'IN_WARRANTY' : current.warrantyStatus,
      maintenanceType: businessTab === 'warranty' ? 'WARRANTY' : current.maintenanceType,
    }));
    setQuickMachineForm(emptyQuickMachineForm());
    setWorkspaceTab('create');
  }

  function backToAssignedWork() {
    setWorkspaceTab('assigned');
  }

  function updateQuickMachineForm(patch: Partial<QuickMachineForm>) {
    setQuickMachineForm((current) => ({ ...current, ...patch }));
  }

  function updateQuickCustomerForm(patch: Partial<QuickCustomerForm>) {
    setQuickCustomerForm((current) => ({ ...current, ...patch }));
  }

  function selectQuickMachineModel(machineModelId: string, selectedModel?: QuickMachineModel) {
    const model = selectedModel || machineModelOptions.find((item) => item.id === machineModelId);
    if (selectedModel) {
      setMachineModelOptions((current) => [selectedModel, ...current.filter((item) => item.id !== selectedModel.id)]);
    }
    setQuickMachineForm((current) => ({
      ...current,
      machineModelId,
      modelName: model?.name || current.modelName,
      name: current.name || model?.displayName || model?.name || '',
    }));
  }

  function selectCreateMachine(machine: PickerMachine) {
    updateCreateForm({
      machineId: machine.id,
      customerId: machine.customer?.id || createForm.customerId,
      modelName: machine.modelName || createForm.modelName,
      serialNumber: machine.serialNumber || createForm.serialNumber,
      deviceName: machine.name || createForm.deviceName,
    });
  }

  async function handleQuickMachineCreate() {
    const serialNumber = quickMachineForm.serialNumber.trim();
    const selectedModel = machineModelOptions.find((model) => model.id === quickMachineForm.machineModelId);
    const modelName = quickMachineForm.modelName.trim() || selectedModel?.name?.trim() || selectedModel?.code?.trim() || '';
    const name = quickMachineForm.name.trim();
    const customerId = quickMachineForm.customerId || createForm.customerId;
    const inventoryStatus = createForm.kind === 'installation' ? 'IN_STOCK' : 'INSTALLED';

    if (!serialNumber || !modelName) {
      setError('Vui lòng nhập Serial và Model/Tên thiết bị để tạo thiết bị nhanh.');
      return;
    }

    setCreatingMachine(true);
    setError('');
    setSuccess('');

    try {
      const machine = await apiFetch<
        TaskMachine & {
          id: string;
          name?: string | null;
          customer?: { id?: string | null; name?: string | null; province?: string | null } | null;
        }
      >('/machines', {
        method: 'POST',
        body: JSON.stringify({
          serialNumber,
          machineModelId: selectedModel?.id,
          modelName: selectedModel ? undefined : modelName,
          name: name || modelName,
          customerId: customerId || undefined,
          primaryEngineerId: isEngineerUser(user) ? user.id : undefined,
          inventoryStatus,
          status: 'ACTIVE',
          accessories: parseMachineAccessoriesInput(quickMachineForm.accessoriesText),
        }),
      });
      const customerOption = customerOptions.find((option) => option.value === customerId);
      const pickerMachine: PickerMachine = {
        ...machine,
        customer: machine.customer ?? (customerId ? { id: customerId, name: customerOption?.label } : null),
        inventoryStatus,
      };
      const option = {
        value: machine.id,
        label: machinePickerLabel(pickerMachine),
        row: pickerMachine,
      };
      setMachineOptions((current) => [option, ...current.filter((item) => item.value !== option.value)]);
      setCreateForm((current) => ({
        ...current,
        machineId: machine.id,
        customerId: current.customerId || customerId || machine.customer?.id || '',
        modelName: current.modelName || selectedModel?.code || modelName,
        serialNumber: current.serialNumber || serialNumber,
        deviceName: current.deviceName || name || machine.name || modelName,
      }));
      setQuickMachineForm(emptyQuickMachineForm());
      setIsQuickMachineOpen(false);
      setSuccess('Đã tạo thiết bị nhanh và chọn vào phiếu hiện tại.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được thiết bị nhanh.');
    } finally {
      setCreatingMachine(false);
    }
  }

  async function handleQuickCustomerCreate() {
    const name = quickCustomerForm.name.trim();
    const regionId = user.regionId || user.region?.id;

    if (!name) {
      setError('Vui lòng nhập tên khách hàng.');
      return;
    }

    if (!regionId) {
      setError('Tài khoản kỹ sư chưa được gán khu vực, không thể tạo khách hàng nhanh.');
      return;
    }

    setCreatingCustomer(true);
    setError('');
    setSuccess('');

    try {
      const customer = await apiFetch<PickerCustomer>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone: quickCustomerForm.phone.trim() || undefined,
          contactPerson: quickCustomerForm.contactPerson.trim() || undefined,
          contactPhone: quickCustomerForm.phone.trim() || undefined,
          province: quickCustomerForm.province.trim() || undefined,
          address: quickCustomerForm.address.trim() || undefined,
          regionId,
          status: 'ACTIVE',
        }),
      });
      const option = {
        value: customer.id,
        label: customerPickerLabel(customer),
        row: customer,
      };

      setCustomerOptions((current) => [option, ...current.filter((item) => item.value !== option.value)]);
      setCreateForm((current) => ({ ...current, customerId: customer.id }));
      setQuickMachineForm((current) => ({ ...current, customerId: customer.id }));
      setQuickCustomerForm(emptyQuickCustomerForm());
      setIsQuickCustomerOpen(false);
      setSuccess('Đã tạo khách hàng nhanh và chọn vào phiếu hiện tại.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được khách hàng nhanh.');
    } finally {
      setCreatingCustomer(false);
    }
  }

  function updateInstallationDeviceItem(index: number, patch: Partial<InstallationDeviceItem>) {
    setCreateForm((current) => ({
      ...current,
      installedDeviceItems: current.installedDeviceItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addInstallationDeviceItem() {
    setCreateForm((current) => ({
      ...current,
      installedDeviceItems: [...current.installedDeviceItems, emptyInstallationDeviceItem()],
    }));
  }

  function removeInstallationDeviceItem(index: number) {
    setCreateForm((current) => ({
      ...current,
      installedDeviceItems:
        current.installedDeviceItems.length === 1
          ? [emptyInstallationDeviceItem()]
          : current.installedDeviceItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function updateInstallationEditDeviceItem(index: number, patch: Partial<InstallationDeviceItem>) {
    setInstallationEditForm((current) => ({
      ...current,
      installedDeviceItems: current.installedDeviceItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addInstallationEditDeviceItem() {
    setInstallationEditForm((current) => ({
      ...current,
      installedDeviceItems: [...current.installedDeviceItems, emptyInstallationDeviceItem()],
    }));
  }

  function removeInstallationEditDeviceItem(index: number) {
    setInstallationEditForm((current) => ({
      ...current,
      installedDeviceItems:
        current.installedDeviceItems.length === 1
          ? [emptyInstallationDeviceItem()]
          : current.installedDeviceItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function openTask(task: EngineerTask) {
    setSelectedTask(task);
    setAttachments([]);
    setAttachmentType(attachmentOptionsByKind[task.kind][0].value);
    setAttachmentTitle('');
    setAttachmentDescription('');
    setAttachmentFile(null);
    setFileInputKey((value) => value + 1);
    loadAttachments(task);

    if (task.kind === 'installation') {
      setStatus(task.status);
      setResultNote(task.note || '');
      setCustomerFeedback('');
      setNextDueDate('');
      setInstallationDate(task.installedAt ? task.installedAt.slice(0, 10) : '');
      setInstallationEditForm(buildInstallationEditForm(task));
      setError('');
      setSuccess('');
      return;
    }
    setStatus(nextDefaultStatus(task));
    setResultNote(task.resultNote || '');
    setCustomerFeedback(task.kind === 'repair' ? task.customerFeedback || '' : '');
    setNextDueDate(task.kind === 'maintenance' && task.nextDueDate ? task.nextDueDate.slice(0, 10) : '');
    setInstallationDate('');
    setError('');
    setSuccess('');
  }

  async function loadAttachments(task: EngineerTask) {
    setLoadingAttachments(true);

    try {
      const response = await apiFetch<Paginated<TaskAttachment>>(
        `/attachments?entityType=${entityTypeForTask(task.kind)}&entityId=${task.id}&limit=100`,
      );
      setAttachments(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được tài liệu của phiếu.');
    } finally {
      setLoadingAttachments(false);
    }
  }

  async function handleAttachmentUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask || !attachmentFile) return;

    setUploadingAttachment(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('entityType', entityTypeForTask(selectedTask.kind));
    formData.append('entityId', selectedTask.id);
    formData.append('type', attachmentType);
    if (attachmentTitle.trim()) formData.append('title', attachmentTitle.trim());
    if (attachmentDescription.trim()) formData.append('description', attachmentDescription.trim());
    formData.append('file', attachmentFile);

    try {
      await apiFetch('/attachments', {
        method: 'POST',
        body: formData,
      });
      setAttachmentTitle('');
      setAttachmentDescription('');
      setAttachmentFile(null);
      setFileInputKey((value) => value + 1);
      setSuccess('Đã tải tài liệu lên phiếu.');
      await loadAttachments(selectedTask);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được tài liệu lên.');
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function downloadAttachment(attachment: TaskAttachment) {
    setError('');

    try {
      const token = getToken();
      const response = await fetch(`${getApiBaseUrl()}${attachment.url}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error('Không tải được file. Vui lòng đăng nhập lại hoặc thử lại sau.');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = attachment.originalName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được file.');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const endpoint =
        selectedTask.kind === 'installation'
          ? `/installations/${selectedTask.id}`
          : selectedTask.kind === 'repair'
          ? `/repairs/${selectedTask.id}/status`
          : `/maintenance/${selectedTask.id}/status`;
      const payload =
        selectedTask.kind === 'installation'
          ? {
              status,
              installedAt: installationDate || installationEditForm.workDate || undefined,
              warrantyStartDate: installationEditForm.workDate || installationDate || undefined,
              warrantyEndDate: installationEditForm.warrantyEndDate || undefined,
              note: resultNote,
              warrantyNote: installationEditForm.description,
              handoverInstallerName: installationEditForm.handoverInstallerName,
              handoverInstallerPosition: installationEditForm.handoverInstallerPosition,
              handoverVehicle: installationEditForm.handoverVehicle,
              handoverDepartureDate: installationEditForm.handoverDepartureDate || undefined,
              receiverInstallAddress: installationEditForm.receiverInstallAddress,
              receiverRepresentative: installationEditForm.receiverRepresentative,
              receiverPosition: installationEditForm.receiverPosition,
              receiverPhone: installationEditForm.receiverPhone,
              installedDeviceItems: normalizeInstallationDeviceItems(installationEditForm.installedDeviceItems),
              deviceCondition: installationEditForm.deviceCondition,
              deviceConditionNote: installationEditForm.deviceConditionNote,
            }
          : selectedTask.kind === 'repair'
          ? { status, resultNote, customerFeedback }
          : { status, resultNote, nextDueDate: nextDueDate || undefined };

      await apiFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setSuccess('Đã cập nhật trạng thái công việc.');
      setSelectedTask(null);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được công việc.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageFrame>
      <PageTitle
        eyebrow="Kỹ sư"
        title="Việc của tôi"
        description="Theo dõi lắp đặt, sửa chữa, bảo trì và cập nhật tiến độ công việc được giao."
      />

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <SummaryTile label="Hôm nay" value={taskStats.today} />
        <SummaryTile label="Quá hạn" value={taskStats.overdue} tone={taskStats.overdue > 0 ? 'danger' : 'neutral'} />
        <SummaryTile label="Sắp tới" value={taskStats.upcoming} />
        <SummaryTile label="Chờ xử lý" value={taskStats.open} />
        <SummaryTile label="Đang xử lý" value={taskStats.progress} />
        <SummaryTile label="Thiếu hồ sơ máy" value={taskStats.missingMachine} tone={taskStats.missingMachine > 0 ? 'danger' : 'neutral'} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-[#d9e1ea] bg-white shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8edf3] bg-[#f8fafc] px-4 py-3">
            <div>
              <span className="text-[12px] font-medium text-[#657386]">Ưu tiên hôm nay</span>
              <h2 className="mt-1 text-lg font-medium text-[#142033]">Việc cần mở trước</h2>
            </div>
            <button className="secondary-button" onClick={openCreateRequest} type="button">
              <Plus size={16} />
              Tạo phiếu mới
            </button>
          </div>
          <div className="grid divide-y divide-[#e8edf3]">
            {priorityTasks.length ? priorityTasks.map((task) => (
              <PriorityTaskRow key={`${task.kind}-${task.id}`} task={task} />
            )) : (
              <div className="px-4 py-5 text-sm text-[#657386]">Không có việc quá hạn, việc hôm nay hoặc phiếu thiếu hồ sơ máy.</div>
            )}
          </div>
        </div>
        <WeeklyReportQuickCard loading={loadingWeeklyReport} report={weeklyReport} />
      </section>

      {workspaceTab === 'create' ? (
        <section className="engineer-create-panel">
          <div className="task-section-heading">
            <div>
              <span>Gửi phiếu về admin</span>
              <h3>{createTicketTitle(createForm.kind)}</h3>
            </div>
          </div>

          <label className="task-filter-select create-kind-select">
            <span>Loại phiếu</span>
            <select onChange={(event) => changeCreateKind(event.target.value as TaskKind)} value={createForm.kind}>
              <option value="repair">Phiếu bảo dưỡng, sửa chữa thiết bị tại chỗ</option>
              <option value="maintenance">Bảo trì</option>
              <option value="installation">Lắp đặt</option>
            </select>
          </label>

          <form className="engineer-create-form" onSubmit={handleCreateTicket}>
            {createForm.kind !== 'installation' ? (
              <label className="create-span-6">
                Tiêu đề
                <input
                  onChange={(event) => updateCreateForm({ title: event.target.value })}
                  placeholder={createForm.kind === 'repair' ? 'VD: Máy báo lỗi đầu dò' : 'VD: Bảo trì định kỳ tháng này'}
                  required
                  value={createForm.title}
                />
              </label>
            ) : null}

            {createForm.kind === 'installation' ? (
              <div className="machine-picker create-span-6">
                <AsyncEntityPicker<QuickMachineModel>
                  className="engineer-picker"
                  disabled={loadingCreateOptions}
                  endpoint="/machine-models?limit=100"
                  formatOption={(model) => ({
                    label: quickModelLabel(model),
                    row: model,
                    value: model.id,
                  })}
                  initialOptions={machineModelOptions.map((model) => ({
                    label: quickModelLabel(model),
                    row: model,
                    value: model.id,
                  }))}
                  label="Model dự kiến"
                  onChange={(value, model) => {
                    updateCreateForm({
                      machineModelId: value,
                      modelName: model?.name || model?.displayName || '',
                      deviceName: model?.displayName || model?.name || '',
                    });
                  }}
                  placeholder="VD: X-CUBE 50, X-CUBE 70..."
                  required
                  rowFilter={(model) => canEngineerSeeModel(user, model)}
                  value={createForm.machineModelId}
                />
              </div>
            ) : (
              <div className="machine-picker">
                <AsyncEntityPicker<PickerMachine>
                  className="engineer-picker"
                  disabled={loadingCreateOptions}
                  endpoint={machinePickerEndpoint(createForm.kind)}
                  formatOption={(machine) => ({
                    label: machinePickerLabel(machine),
                    row: machine,
                    value: machine.id,
                  })}
                  initialOptions={machineOptions
                    .filter((option) => isMachineEligibleForTicket(createForm.kind, option.row))}
                  label="Thiết bị có sẵn"
                  onChange={(value, machine) => {
                    updateCreateForm({ machineId: value });
                    if (machine) selectCreateMachine(machine);
                  }}
                  placeholder="Không bắt buộc, tìm mã máy, S/N, model hoặc khách hàng"
                  rowFilter={(machine) => canEngineerSeeMachine(user, machine) && isMachineEligibleForTicket(createForm.kind, machine)}
                  value={createForm.machineId}
                />
                <button className="task-secondary" onClick={() => setIsQuickMachineOpen((value) => !value)} type="button">
                  <Plus size={16} />
                  Thêm thiết bị
                </button>
              </div>
            )}

            {isQuickMachineOpen ? (
              <div className="quick-machine-form">
                {(() => {
                  const selectedQuickModel = machineModelOptions.find((model) => model.id === quickMachineForm.machineModelId);
                  const supportsProbes = isUltrasoundMachineModel(selectedQuickModel);

                  return (
                    <>
                <AsyncEntityPicker<QuickMachineModel>
                  disabled={loadingCreateOptions}
                  endpoint="/machine-models?limit=100"
                  formatOption={(model) => ({
                    label: quickModelLabel(model),
                    row: model,
                    value: model.id,
                  })}
                  initialOptions={machineModelOptions.map((model) => ({
                    label: quickModelLabel(model),
                    row: model,
                    value: model.id,
                  }))}
                  label="Model chuẩn"
                  onChange={(value, model) => selectQuickMachineModel(value, model)}
                  placeholder="Tìm mã model, tên model hoặc hãng"
                  rowFilter={(model) => canEngineerSeeModel(user, model)}
                  value={quickMachineForm.machineModelId}
                />
                <label>
                  Serial
                  <input
                    onChange={(event) => updateQuickMachineForm({ serialNumber: event.target.value })}
                    value={quickMachineForm.serialNumber}
                  />
                </label>
                <label>
                  Model/Tên máy tạm
                  <input
                    disabled={Boolean(quickMachineForm.machineModelId)}
                    onChange={(event) => updateQuickMachineForm({ modelName: event.target.value })}
                    value={quickMachineForm.modelName}
                  />
                </label>
                <label>
                  Tên thiết bị
                  <input onChange={(event) => updateQuickMachineForm({ name: event.target.value })} value={quickMachineForm.name} />
                </label>
                <AsyncEntityPicker<PickerCustomer>
                  disabled={loadingCreateOptions}
                  endpoint="/customers?limit=20"
                  formatOption={(customer) => ({
                    label: customerPickerLabel(customer),
                    row: customer,
                    value: customer.id,
                  })}
                  initialOptions={customerOptions}
                  label="Khách hàng"
                  onChange={(value) => updateQuickMachineForm({ customerId: value })}
                  placeholder="Tìm tên, mã khách hàng, tỉnh hoặc số điện thoại"
                  value={quickMachineForm.customerId || createForm.customerId}
                />
                <button className="task-secondary quick-customer-toggle" onClick={() => setIsQuickCustomerOpen((value) => !value)} type="button">
                  <Plus size={16} />
                  Thêm KH
                </button>
                <div className="quick-machine-accessories">
                  {supportsProbes ? (
                    <MachineAccessoryEditor
                      compact
                      onChange={(value) => updateQuickMachineForm({ accessoriesText: value })}
                      value={quickMachineForm.accessoriesText}
                    />
                  ) : (
                    <label>
                      Phụ kiện đi kèm
                      <textarea
                        onChange={(event) => updateQuickMachineForm({ accessoriesText: event.target.value })}
                        placeholder={'Mỗi dòng: Phụ kiện | S/N\\nVí dụ: Bộ dây nguồn | ACC-001'}
                        value={quickMachineForm.accessoriesText}
                      />
                    </label>
                  )}
                </div>
                <button className="task-primary" disabled={creatingMachine || loadingCreateOptions} onClick={handleQuickMachineCreate} type="button">
                  {creatingMachine ? 'Đang tạo' : 'Tạo và chọn'}
                </button>
                    </>
                  );
                })()}
              </div>
            ) : null}

            {createForm.kind === 'installation' ? (
              <div className="customer-picker-row create-span-6">
                <AsyncEntityPicker<PickerCustomer>
                  className="customer-picker-main"
                  disabled={loadingCreateOptions}
                  endpoint="/customers?limit=20"
                  formatOption={(customer) => ({
                    label: customerPickerLabel(customer),
                    row: customer,
                    value: customer.id,
                  })}
                  initialOptions={customerOptions}
                  label="Khách hàng"
                  onChange={(value) => updateCreateForm({ customerId: value })}
                  placeholder="Tìm tên, mã khách hàng, tỉnh hoặc số điện thoại"
                  required
                  value={createForm.customerId}
                />
                <button className="task-secondary quick-customer-toggle" onClick={() => setIsQuickCustomerOpen((value) => !value)} type="button">
                  <Plus size={16} />
                  Thêm khách hàng
                </button>
              </div>
            ) : (
              <div className="customer-picker-row create-span-6">
                <AsyncEntityPicker<PickerCustomer>
                  className="customer-picker-main"
                  disabled={loadingCreateOptions}
                  endpoint="/customers?limit=20"
                  formatOption={(customer) => ({
                    label: customerPickerLabel(customer),
                    row: customer,
                    value: customer.id,
                  })}
                  initialOptions={customerOptions}
                  label="Khách hàng cho thiết bị mới"
                  onChange={(value) => {
                    updateCreateForm({ customerId: value });
                    updateQuickMachineForm({ customerId: value });
                  }}
                  placeholder="Chọn trước khách hàng nếu cần tạo thiết bị nhanh"
                  value={createForm.customerId}
                />
                <button className="task-secondary quick-customer-toggle" onClick={() => setIsQuickCustomerOpen((value) => !value)} type="button">
                  <Plus size={16} />
                  Thêm khách hàng
                </button>
              </div>
            )}

            {isQuickCustomerOpen ? (
              <div className="quick-customer-form">
                <div className="quick-customer-heading">
                  <strong>Thêm khách hàng nhanh</strong>
                  <span>Dùng khi admin chưa kịp tạo hồ sơ. Khách hàng sẽ thuộc khu vực của bạn.</span>
                </div>
                <label>
                  Tên khách hàng
                  <input
                    onChange={(event) => updateQuickCustomerForm({ name: event.target.value })}
                    placeholder="VD: Bệnh viện Đa khoa..."
                    value={quickCustomerForm.name}
                  />
                </label>
                <label>
                  Tỉnh/Thành
                  <input onChange={(event) => updateQuickCustomerForm({ province: event.target.value })} value={quickCustomerForm.province} />
                </label>
                <label>
                  Người liên hệ
                  <input onChange={(event) => updateQuickCustomerForm({ contactPerson: event.target.value })} value={quickCustomerForm.contactPerson} />
                </label>
                <label>
                  Số điện thoại
                  <input onChange={(event) => updateQuickCustomerForm({ phone: event.target.value })} value={quickCustomerForm.phone} />
                </label>
                <label className="create-wide-field">
                  Địa chỉ
                  <input onChange={(event) => updateQuickCustomerForm({ address: event.target.value })} value={quickCustomerForm.address} />
                </label>
                <button className="task-primary" disabled={creatingCustomer} onClick={handleQuickCustomerCreate} type="button">
                  {creatingCustomer ? 'Đang tạo khách hàng' : 'Tạo và chọn khách hàng'}
                </button>
              </div>
            ) : null}

            {createForm.kind === 'repair' ? (
              <>
                <label>
                  Mức ưu tiên
                  <select onChange={(event) => updateCreateForm({ priority: event.target.value })} value={createForm.priority}>
                    <option value="LOW">Thấp</option>
                    <option value="NORMAL">Bình thường</option>
                    <option value="HIGH">Cao</option>
                    <option value="URGENT">Khẩn cấp</option>
                  </select>
                </label>
                <label>
                  Ngày báo lỗi
                  <input onChange={(event) => updateCreateForm({ workDate: event.target.value })} required type="date" value={createForm.workDate} />
                </label>
                <div className="create-form-section">Thông tin đơn vị sử dụng</div>
                <label>
                  Đơn vị sử dụng thiết bị
                  <input onChange={(event) => updateCreateForm({ usingDepartment: event.target.value })} value={createForm.usingDepartment} />
                </label>
                <label>
                  Người đại diện
                  <input onChange={(event) => updateCreateForm({ representative: event.target.value })} value={createForm.representative} />
                </label>
                <label>
                  Số điện thoại
                  <input onChange={(event) => updateCreateForm({ contactPhone: event.target.value })} value={createForm.contactPhone} />
                </label>
                <label className="create-wide-field">
                  Địa chỉ
                  <input onChange={(event) => updateCreateForm({ address: event.target.value })} value={createForm.address} />
                </label>
                <div className="create-form-section">Thông tin thiết bị</div>
                <label>
                  Tên thiết bị
                  <input onChange={(event) => updateCreateForm({ deviceName: event.target.value })} value={createForm.deviceName} />
                </label>
                <label>
                  Model
                  <input onChange={(event) => updateCreateForm({ modelName: event.target.value })} value={createForm.modelName} />
                </label>
                <label>
                  S/N
                  <input onChange={(event) => updateCreateForm({ serialNumber: event.target.value })} value={createForm.serialNumber} />
                </label>
                <label>
                  Thời hạn bảo hành
                  <select onChange={(event) => updateCreateForm({ warrantyStatus: event.target.value })} value={createForm.warrantyStatus}>
                    <option value="IN_WARRANTY">Còn bảo hành</option>
                    <option value="OUT_OF_WARRANTY">Hết bảo hành</option>
                  </select>
                </label>
                <div className="create-form-section">Kiểm tra và phương án</div>
                <label className="create-wide-field">
                  Mô tả lỗi
                  <textarea onChange={(event) => updateCreateForm({ description: event.target.value })} value={createForm.description} />
                </label>
                <label className="create-wide-field">
                  Kiểm tra tình trạng thiết bị
                  <textarea
                    onChange={(event) => updateCreateForm({ conditionAssessment: event.target.value })}
                    placeholder="Tình trạng thiết bị và sơ bộ xác định nguyên nhân"
                    value={createForm.conditionAssessment}
                  />
                </label>
                <label className="create-wide-field">
                  Phương pháp sửa chữa
                  <textarea onChange={(event) => updateCreateForm({ repairMethod: event.target.value })} value={createForm.repairMethod} />
                </label>
              </>
            ) : null}

            {createForm.kind === 'maintenance' ? (
              <>
                <label>
                  Loại bảo trì
                  <select onChange={(event) => updateCreateForm({ maintenanceType: event.target.value })} value={createForm.maintenanceType}>
                    <option value="PERIODIC">Định kỳ</option>
                    <option value="WARRANTY">Bảo hành</option>
                    <option value="CONTRACT">Hợp đồng</option>
                    <option value="INTERNAL">Nội bộ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </label>
                <label>
                  Ngày bảo trì
                  <input onChange={(event) => updateCreateForm({ workDate: event.target.value })} required type="date" value={createForm.workDate} />
                </label>
                <label>
                  Lịch tiếp theo
                  <input onChange={(event) => updateCreateForm({ nextDueDate: event.target.value })} type="date" value={createForm.nextDueDate} />
                </label>
                <div className="create-form-section">Thông tin đơn vị sử dụng</div>
                <label>
                  Đơn vị sử dụng thiết bị
                  <input onChange={(event) => updateCreateForm({ usingDepartment: event.target.value })} value={createForm.usingDepartment} />
                </label>
                <label>
                  Người đại diện
                  <input onChange={(event) => updateCreateForm({ representative: event.target.value })} value={createForm.representative} />
                </label>
                <label>
                  Số điện thoại
                  <input onChange={(event) => updateCreateForm({ contactPhone: event.target.value })} value={createForm.contactPhone} />
                </label>
                <label className="create-wide-field">
                  Địa chỉ
                  <input onChange={(event) => updateCreateForm({ address: event.target.value })} value={createForm.address} />
                </label>
                <div className="create-form-section">Thông tin thiết bị</div>
                <label>
                  Tên thiết bị
                  <input onChange={(event) => updateCreateForm({ deviceName: event.target.value })} value={createForm.deviceName} />
                </label>
                <label>
                  Model
                  <input onChange={(event) => updateCreateForm({ modelName: event.target.value })} value={createForm.modelName} />
                </label>
                <label>
                  S/N
                  <input onChange={(event) => updateCreateForm({ serialNumber: event.target.value })} value={createForm.serialNumber} />
                </label>
                <label className="create-wide-field">
                  Checklist
                  <textarea
                    onChange={(event) => updateCreateForm({ checklist: event.target.value })}
                    placeholder="Mỗi dòng là một hạng mục kiểm tra"
                    value={createForm.checklist}
                  />
                </label>
                <label className="create-wide-field">
                  Ghi chú
                  <textarea onChange={(event) => updateCreateForm({ description: event.target.value })} value={createForm.description} />
                </label>
              </>
            ) : null}

            {createForm.kind === 'installation' ? (
              <>
                <InstallationHandoverForm
                  addDeviceItem={addInstallationDeviceItem}
                  form={createForm}
                  removeDeviceItem={removeInstallationDeviceItem}
                  updateDeviceItem={updateInstallationDeviceItem}
                  updateForm={updateCreateForm}
                  user={user}
                />
                <label>
                  Ngày lắp đặt
                  <input onChange={(event) => updateCreateForm({ workDate: event.target.value })} required type="date" value={createForm.workDate} />
                </label>
                <label>
                  Hạn bảo hành
                  <input onChange={(event) => updateCreateForm({ warrantyEndDate: event.target.value })} required type="date" value={createForm.warrantyEndDate} />
                </label>
                <label className="create-wide-field">
                  Ghi chú lắp đặt
                  <textarea onChange={(event) => updateCreateForm({ description: event.target.value })} value={createForm.description} />
                </label>
                <label className="create-wide-field">
                  Phụ kiện bàn giao
                  <textarea
                    onChange={(event) => updateCreateForm({ accessories: event.target.value })}
                    placeholder="Mỗi dòng là một phụ kiện"
                    value={createForm.accessories}
                  />
                </label>
              </>
            ) : null}

            <button className="task-primary create-submit" disabled={saving || loadingCreateOptions} type="submit">
              {saving ? 'Đang gửi' : 'Gửi phiếu về admin'}
            </button>
            <button className="task-secondary create-cancel" onClick={backToAssignedWork} type="button">
              Quay lại công việc
            </button>
          </form>
        </section>
      ) : (
        <section className="min-w-0 overflow-hidden rounded-lg border border-[#d9e1ea] bg-white shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
          <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-1 border-b border-[#e8edf3] bg-[#f8fafc] p-2" aria-label="Nhóm công việc">
            {businessTabs.map((tab) => (
              <button
                className={[
                  'flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-lg border-0 px-3 text-left text-sm font-medium transition',
                  businessTab === tab.value
                    ? 'bg-white text-[#c83f34] shadow-[0_1px_5px_rgba(20,32,51,0.08)]'
                    : 'bg-transparent text-[#334155] hover:bg-white/70',
                ].join(' ')}
                key={tab.value}
                onClick={() => {
                  setBusinessTab(tab.value);
                  setKindFilter('all');
                }}
                type="button"
              >
                <span className="min-w-0 truncate">{tab.label}</span>
                <strong
                  className={[
                    'inline-flex min-w-7 items-center justify-center rounded-full border px-2 py-[3px] text-xs',
                    businessTab === tab.value
                      ? 'border-[#f4c9c4] bg-[#fff6f4] text-[#c83f34]'
                      : 'border-[#d9e1ea] bg-white text-[#657386]',
                  ].join(' ')}
                >
                  {businessTabCounts[tab.value]}
                </strong>
              </button>
            ))}
          </div>

          <div className="grid min-w-0 gap-3 border-b border-[#e8edf3] p-3 min-[1180px]:grid-cols-[minmax(220px,1fr)_auto_minmax(180px,220px)] min-[1180px]:items-end">
            <div className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-[#cbd5e1] bg-white px-3 text-[#657386] focus-within:border-[#c83f34] focus-within:shadow-[0_0_0_3px_rgba(200,63,52,0.12)]">
              <Search size={17} />
              <input className="min-w-0 flex-1 border-0 text-[#142033] outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã phiếu, mã máy, serial, khách hàng" value={query} />
            </div>
            <div className="grid w-full grid-cols-2 gap-[3px] rounded-lg border border-[#d9e1ea] bg-[#f4f7fb] p-[3px] min-[560px]:inline-flex min-[560px]:w-auto">
              {[
                ['open', 'Cần xử lý'],
                ['progress', 'Đang làm'],
                ['done', 'Hoàn tất'],
                ['all', 'Tất cả'],
              ].map(([value, label]) => (
                <button
                  className={[
                    'min-h-8 min-w-0 flex-1 rounded-md border-0 px-2 text-xs font-medium leading-tight min-[560px]:flex-none min-[560px]:px-3 min-[560px]:text-sm',
                    filter === value ? 'bg-white text-[#c83f34] shadow-[0_1px_4px_rgba(20,32,51,0.08)]' : 'bg-transparent text-[#334155]',
                  ].join(' ')}
                  key={value}
                  onClick={() => setFilter(value as TaskFilter)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-[#334155]">
              <span>Loại công việc</span>
              <select className="h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 text-[#142033] outline-none focus:border-[#c83f34] focus:shadow-[0_0_0_3px_rgba(200,63,52,0.12)]" onChange={(event) => setKindFilter(event.target.value as KindFilter)} value={kindFilter}>
                {businessTab === 'repair' ? (
                  <>
                    <option value="all">Sửa chữa</option>
                    <option value="repair">Sửa chữa</option>
                  </>
                ) : businessTab === 'maintenance' ? (
                  <>
                    <option value="all">Bảo trì</option>
                    <option value="maintenance">Bảo trì</option>
                  </>
                ) : businessTab === 'installation' ? (
                  <>
                    <option value="all">Lắp đặt</option>
                    <option value="installation">Lắp đặt</option>
                  </>
                ) : businessTab === 'warranty' ? (
                  <>
                    <option value="all">Tất cả bảo hành</option>
                    <option value="repair">Sửa chữa bảo hành</option>
                    <option value="maintenance">Bảo trì bảo hành</option>
                  </>
                ) : (
                  <option value="all">Lịch công việc</option>
                )}
              </select>
            </label>
          </div>

          <div className="grid">
            {loading ? (
              <div className="flex min-h-40 items-center justify-center gap-2 p-6 text-[#657386]">
                <Loader2 className="spin-icon" size={18} />
                Đang tải việc được giao...
              </div>
            ) : null}

            {!loading && businessTab === 'calendar' ? (
              <>
                {loadingDailyWork ? (
                  <div className="flex min-h-40 items-center justify-center gap-2 p-6 text-[#657386]">
                    <Loader2 className="spin-icon" size={18} />
                    Đang tải lịch công việc...
                  </div>
                ) : null}

                {!loadingDailyWork && filteredDailyWorkNotes.length === 0 ? (
                  <div className="grid min-h-40 place-items-center gap-2 p-6 text-center text-[#657386]">
                    <strong className="text-[#142033]">Chưa có lịch công việc phù hợp</strong>
                    <span className="text-sm">Lịch admin thêm cho bạn và ghi chú công việc cá nhân sẽ xuất hiện tại đây.</span>
                  </div>
                ) : null}

                {!loadingDailyWork
                  ? filteredDailyWorkNotes.map((note) => (
                      <article className="grid min-w-0 items-center gap-3.5 border-b border-[#e8edf3] p-4 last:border-b-0 min-[640px]:grid-cols-[66px_minmax(0,1fr)]" key={note.id}>
                        <div className="grid min-h-16 justify-items-center rounded-lg border border-l-4 bg-[#fffdfb] p-2" style={{ borderColor: note.color || '#c83f34' }}>
                          <strong className="text-2xl leading-none text-[#142033]">{dayNumber(note.workDate)}</strong>
                          <span className="text-xs font-medium text-[#657386]">{monthLabel(note.workDate)}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#657386]">
                            <span>{dailyWorkTypeLabels[note.type || 'WORK']}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[12px] font-semibold ${dailyWorkStatusMeta[note.status || 'APPROVED'].className}`}>
                              {dailyWorkStatusMeta[note.status || 'APPROVED'].label}
                            </span>
                            <span>{formatDailyWorkDate(note.workDate)}</span>
                            <span>{formatDailyWorkTime(note)}</span>
                          </div>
                          <h2 className="mt-1 text-[17px] font-medium text-[#142033] [overflow-wrap:anywhere]">{note.title}</h2>
                          <p className="mt-1.5 leading-6 text-[#334155] [overflow-wrap:anywhere]">{note.note || 'Chưa có ghi chú chi tiết.'}</p>
                          {note.rejectReason ? <p className="mt-2 rounded-lg border border-[#f4c9c4] bg-[#fff6f4] px-3 py-2 text-sm text-[#a3342b]">Lý do từ chối: {note.rejectReason}</p> : null}
                        </div>
                      </article>
                    ))
                  : null}
              </>
            ) : null}

            {!loading && businessTab !== 'calendar' && filteredTasks.length === 0 ? (
              <div className="grid min-h-40 place-items-center gap-2 p-6 text-center text-[#657386]">
                <strong className="text-[#142033]">Chưa có công việc phù hợp</strong>
                <span className="text-sm">Thử đổi bộ lọc hoặc kiểm tra lại phiếu được admin phân công.</span>
              </div>
            ) : null}

            {businessTab !== 'calendar' ? filteredTasks.map((task) => (
              <article className="grid min-w-0 gap-3.5 border-b border-[#e8edf3] p-4 last:border-b-0 min-[860px]:grid-cols-[minmax(0,1fr)_auto] min-[860px]:items-center" key={`${task.kind}-${task.id}`}>
                <div className="grid min-w-0 gap-3 min-[560px]:grid-cols-[40px_minmax(0,1fr)]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#f4c9c4] bg-[#fff6f4] text-[#c83f34]">{taskIcon(task.kind)}</div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#657386]">
                      <span>{taskKindLabel(task.kind)}</span>
                      <span>{task.code}</span>
                      {task.kind === 'repair' && task.createdBy?.fullName ? <span>Người tạo: {task.createdBy.fullName}</span> : null}
                      {isOverdueTask(task) ? <span className="font-medium text-[#a3342b]">Quá hạn</span> : null}
                      {needsMachineProfile(task) ? <span className="font-medium text-[#9b5a17]">Cần tạo hồ sơ máy</span> : null}
                    </div>
                    <h2 className="mt-1 text-[17px] font-medium text-[#142033] [overflow-wrap:anywhere]">{taskTitle(task)}</h2>
                    <p className="mt-1.5 line-clamp-2 leading-6 text-[#657386]">{taskDescription(task) || 'Chưa có mô tả chi tiết.'}</p>
                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-[#657386]">
                      <span className="min-w-0 [overflow-wrap:anywhere]">{task.machine?.machineCode || task.machine?.serialNumber || taskSerialText(task) || 'Chưa có mã máy'}</span>
                      <span className="min-w-0 [overflow-wrap:anywhere]">{task.machine?.modelName || taskModelText(task) || 'Chưa có model'}</span>
                      <span className="min-w-0 [overflow-wrap:anywhere]">{taskCustomer(task) || 'Chưa có khách hàng'}</span>
                    </div>
                  </div>
                </div>
                <div className="grid min-w-0 justify-items-start gap-2 min-[860px]:min-w-[150px] min-[860px]:justify-items-end">
                  <span className={`task-badge ${statusTone(task.status)}`}>{statusLabel(task.status)}</span>
                  <span className={`task-badge ${secondaryTone(task)}`}>{secondaryLabel(task)}</span>
                  <span className="text-[13px] text-[#657386]">{taskDate(task)}</span>
                  {task.kind === 'installation' ? (
                    <Link className="task-action" to={`/installations/${task.id}/update?returnTo=/my-tasks`}>
                      Cập nhật
                    </Link>
                  ) : task.kind === 'repair' ? (
                    <Link className="task-action" to={`/repairs/${task.id}/update?returnTo=/my-tasks`}>
                      Cập nhật
                    </Link>
                  ) : task.kind === 'maintenance' ? (
                    <Link className="task-action" to={`/maintenance/${task.id}/update?returnTo=/my-tasks`}>
                      Cập nhật
                    </Link>
                  ) : (
                    <button className="task-action" onClick={() => openTask(task)} type="button">
                      Cập nhật
                    </button>
                  )}
                </div>
              </article>
            )) : null}
          </div>
        </section>
      )}

      {selectedTask ? (
        <div className="task-drawer-backdrop" onClick={() => setSelectedTask(null)} role="presentation">
          <aside aria-modal="true" className="task-drawer" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="task-drawer-heading">
              <div>
                <span>{taskKindLabel(selectedTask.kind)}</span>
                <h2>{taskTitle(selectedTask)}</h2>
              </div>
              <button className="task-close" onClick={() => setSelectedTask(null)} title="Đóng" type="button">
                <X size={16} />
              </button>
            </div>

            <dl className="task-detail-grid">
              <div>
                <dt>Mã phiếu</dt>
                <dd>{selectedTask.code}</dd>
              </div>
              <div>
                <dt>Thiết bị</dt>
                <dd>{selectedTask.machine?.machineCode || selectedTask.machine?.serialNumber || '-'}</dd>
              </div>
              <div>
                <dt>Khách hàng</dt>
                <dd>{taskCustomer(selectedTask) || '-'}</dd>
              </div>
              <div>
                <dt>Trạng thái hiện tại</dt>
                <dd>{statusLabel(selectedTask.status)}</dd>
              </div>
            </dl>

            {selectedTask.kind === 'repair' ? (
              <div className="task-info-block">
                <h3>Thông tin phiếu sửa chữa tại chỗ</h3>
                <dl className="task-repair-detail-grid">
                  <div>
                    <dt>Người tạo phiếu</dt>
                    <dd>{selectedTask.createdBy?.fullName || selectedTask.createdBy?.email || '-'}</dd>
                  </div>
                  <div>
                    <dt>Đơn vị sử dụng</dt>
                    <dd>{selectedTask.usingDepartment || '-'}</dd>
                  </div>
                  <div>
                    <dt>Người đại diện</dt>
                    <dd>{selectedTask.representative || '-'}</dd>
                  </div>
                  <div>
                    <dt>Số điện thoại</dt>
                    <dd>{selectedTask.contactPhone || '-'}</dd>
                  </div>
                  <div className="wide-detail">
                    <dt>Địa chỉ</dt>
                    <dd>{selectedTask.address || '-'}</dd>
                  </div>
                  <div>
                    <dt>Tên thiết bị</dt>
                    <dd>{selectedTask.deviceName || selectedTask.machine?.modelName || '-'}</dd>
                  </div>
                  <div>
                    <dt>Model</dt>
                    <dd>{selectedTask.modelName || selectedTask.machine?.modelName || '-'}</dd>
                  </div>
                  <div>
                    <dt>S/N</dt>
                    <dd>{selectedTask.serialNumber || selectedTask.machine?.serialNumber || '-'}</dd>
                  </div>
                  <div>
                    <dt>Bảo hành</dt>
                    <dd>{warrantyStatusLabel(selectedTask.warrantyStatus)}</dd>
                  </div>
                  <div className="wide-detail">
                    <dt>Kiểm tra tình trạng thiết bị</dt>
                    <dd>{selectedTask.conditionAssessment || '-'}</dd>
                  </div>
                  <div className="wide-detail">
                    <dt>Phương pháp sửa chữa</dt>
                    <dd>{selectedTask.repairMethod || '-'}</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            {selectedTask.kind === 'maintenance' ? (
              <div className="task-info-block">
                <h3>Thông tin phiếu bảo trì</h3>
                <dl className="task-repair-detail-grid">
                  <div>
                    <dt>Đơn vị sử dụng</dt>
                    <dd>{selectedTask.usingDepartment || '-'}</dd>
                  </div>
                  <div>
                    <dt>Người đại diện</dt>
                    <dd>{selectedTask.representative || '-'}</dd>
                  </div>
                  <div>
                    <dt>Số điện thoại</dt>
                    <dd>{selectedTask.contactPhone || '-'}</dd>
                  </div>
                  <div className="wide-detail">
                    <dt>Địa chỉ</dt>
                    <dd>{selectedTask.address || '-'}</dd>
                  </div>
                  <div>
                    <dt>Tên thiết bị</dt>
                    <dd>{selectedTask.deviceName || selectedTask.machine?.modelName || '-'}</dd>
                  </div>
                  <div>
                    <dt>Model</dt>
                    <dd>{selectedTask.modelName || selectedTask.machine?.modelName || '-'}</dd>
                  </div>
                  <div>
                    <dt>S/N</dt>
                    <dd>{selectedTask.serialNumber || selectedTask.machine?.serialNumber || '-'}</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            {selectedTask.kind === 'maintenance' && selectedTask.checklist?.length ? (
              <div className="task-info-block">
                <h3>Checklist bảo trì</h3>
                <ul>
                  {selectedTask.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {selectedTask.kind === 'installation' && selectedTask.accessories?.length ? (
              <div className="task-info-block">
                <h3>Phụ kiện lắp đặt</h3>
                <ul>
                  {selectedTask.accessories.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {selectedTask.kind === 'installation' ? (
              <div className="task-info-block">
                <h3>Phiếu bàn giao và bảo hành thiết bị</h3>
                <dl className="task-repair-detail-grid">
                  <div>
                    <dt>Người lắp đặt</dt>
                    <dd>{selectedTask.handoverInstallerName || '-'}</dd>
                  </div>
                  <div>
                    <dt>Chức vụ bên bàn giao</dt>
                    <dd>{selectedTask.handoverInstallerPosition || '-'}</dd>
                  </div>
                  <div>
                    <dt>Phương tiện đi</dt>
                    <dd>{selectedTask.handoverVehicle || '-'}</dd>
                  </div>
                  <div>
                    <dt>Ngày đi</dt>
                    <dd>{selectedTask.handoverDepartureDate ? formatDate(selectedTask.handoverDepartureDate) : '-'}</dd>
                  </div>
                  <div className="wide-detail">
                    <dt>Địa chỉ lắp đặt</dt>
                    <dd>{selectedTask.receiverInstallAddress || '-'}</dd>
                  </div>
                  <div>
                    <dt>Người đại diện</dt>
                    <dd>{selectedTask.receiverRepresentative || '-'}</dd>
                  </div>
                  <div>
                    <dt>Chức vụ bên nhận</dt>
                    <dd>{selectedTask.receiverPosition || '-'}</dd>
                  </div>
                  <div>
                    <dt>SĐT bên nhận</dt>
                    <dd>{selectedTask.receiverPhone || '-'}</dd>
                  </div>
                  <div className="wide-detail">
                    <dt>Tình trạng thiết bị</dt>
                    <dd>{deviceConditionLabel(selectedTask.deviceCondition, selectedTask.deviceConditionNote)}</dd>
                  </div>
                </dl>
                {selectedTask.installedDeviceItems?.length ? (
                  <div className="installed-device-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Tên hàng</th>
                          <th>Model</th>
                          <th>S/N</th>
                          <th>NSX</th>
                          <th>SL</th>
                          <th>Bảo hành</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTask.installedDeviceItems.map((item, index) => (
                          <tr key={`${item.itemName}-${index}`}>
                            <td>{item.itemName || '-'}</td>
                            <td>{item.model || '-'}</td>
                            <td>{item.serialNumber || '-'}</td>
                            <td>{item.manufactureDate ? formatDate(item.manufactureDate) : '-'}</td>
                            <td>{item.quantity || 1}</td>
                            <td>{item.warrantyPeriod || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedTask.kind === 'installation' ? (
              <form className="task-update-form" onSubmit={handleSubmit}>
                <label>
                  Trạng thái
                  <select disabled onChange={(event) => setStatus(event.target.value)} required value={status}>
                    {installationStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ngày lắp đặt
                  <input onChange={(event) => setInstallationDate(event.target.value)} type="date" value={installationDate} />
                </label>
                <label>
                  Ghi chú lắp đặt
                  <textarea onChange={(event) => setResultNote(event.target.value)} value={resultNote} />
                </label>
                <label>
                  Kết thúc bảo hành
                  <input
                    onChange={(event) => updateInstallationEditForm({ warrantyEndDate: event.target.value })}
                    required
                    type="date"
                    value={installationEditForm.warrantyEndDate}
                  />
                </label>
                <label className="create-wide-field">
                  Ghi chú bảo hành
                  <textarea
                    onChange={(event) => updateInstallationEditForm({ description: event.target.value })}
                    value={installationEditForm.description}
                  />
                </label>
                <InstallationHandoverForm
                  addDeviceItem={addInstallationEditDeviceItem}
                  form={installationEditForm}
                  removeDeviceItem={removeInstallationEditDeviceItem}
                  updateDeviceItem={updateInstallationEditDeviceItem}
                  updateForm={updateInstallationEditForm}
                  user={user}
                />
                <div className="task-drawer-actions">
                  <button className="task-secondary" onClick={() => setSelectedTask(null)} type="button">
                    Hủy
                  </button>
                  <button className="task-primary" disabled={saving} type="submit">
                    {saving ? 'Đang lưu' : 'Lưu cập nhật'}
                  </button>
                </div>
              </form>
            ) : (
              <form className="task-update-form" onSubmit={handleSubmit}>
              <label>
                Trạng thái mới
                <select onChange={(event) => setStatus(event.target.value)} required value={status}>
                  {(selectedTask.kind === 'repair' ? repairStatusOptions : maintenanceStatusOptions).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kết quả/Ghi chú kỹ thuật
                <textarea onChange={(event) => setResultNote(event.target.value)} value={resultNote} />
              </label>
              {selectedTask.kind === 'repair' ? (
                <label>
                  Phản hồi khách hàng
                  <textarea onChange={(event) => setCustomerFeedback(event.target.value)} value={customerFeedback} />
                </label>
              ) : (
                <label>
                  Lịch bảo trì tiếp theo
                  <input onChange={(event) => setNextDueDate(event.target.value)} type="date" value={nextDueDate} />
                </label>
              )}
              <div className="task-drawer-actions">
                <button className="task-secondary" onClick={() => setSelectedTask(null)} type="button">
                  Hủy
                </button>
                <button className="task-primary" disabled={saving} type="submit">
                  {saving ? 'Đang lưu' : 'Lưu cập nhật'}
                </button>
              </div>
            </form>
            )}

            <section className="task-attachment-panel">
              <div className="task-section-heading">
                <div>
                  <span>Tài liệu hiện trường</span>
                  <h3>Ảnh và biên bản</h3>
                </div>
                <strong>{attachments.length}</strong>
              </div>

              <div className="task-attachment-list">
                {loadingAttachments ? (
                  <div className="task-attachment-state">
                    <Loader2 className="spin-icon" size={16} />
                    Đang tải tài liệu...
                  </div>
                ) : null}

                {!loadingAttachments && attachments.length === 0 ? (
                  <div className="task-attachment-state empty">Chưa có ảnh hoặc tài liệu nào cho phiếu này.</div>
                ) : null}

                {!loadingAttachments &&
                  attachments.map((attachment) => (
                    <article className="task-attachment-item" key={attachment.id}>
                      <div>
                        <span>{attachmentTypeLabel(attachment.type)}</span>
                        <strong>{attachment.title || attachment.originalName}</strong>
                        <small>
                          {attachment.originalName} · {formatFileSize(attachment.size)}
                        </small>
                      </div>
                      <button className="task-secondary icon-button" onClick={() => downloadAttachment(attachment)} title="Tải xuống" type="button">
                        <Download size={16} />
                      </button>
                    </article>
                  ))}
              </div>

              <form className="task-upload-form" onSubmit={handleAttachmentUpload}>
                <label>
                  Loại tài liệu
                  <select onChange={(event) => setAttachmentType(event.target.value as AttachmentType)} value={attachmentType}>
                    {attachmentOptionsByKind[selectedTask.kind].map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tên hiển thị
                  <input onChange={(event) => setAttachmentTitle(event.target.value)} placeholder="VD: Ảnh serial trước sửa chữa" value={attachmentTitle} />
                </label>
                <label>
                  Ghi chú
                  <textarea onChange={(event) => setAttachmentDescription(event.target.value)} placeholder="Ghi chú ngắn cho file nếu cần" value={attachmentDescription} />
                </label>
                <label className="task-file-field">
                  File ảnh/PDF
                  <input
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    key={fileInputKey}
                    onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)}
                    required
                    type="file"
                  />
                </label>
                <button className="task-primary upload-button" disabled={uploadingAttachment || !attachmentFile} type="submit">
                  <FileUp size={16} />
                  {uploadingAttachment ? 'Đang tải lên' : 'Tải lên phiếu'}
                </button>
              </form>
            </section>
          </aside>
        </div>
      ) : null}
    </PageFrame>
  );
}

function canEngineerSeeMachine(user: ApiUser, machine: TaskMachine) {
  const expertiseGroup = user.engineerProfile?.expertiseGroup;
  if (!expertiseGroup) return true;
  const machineGroup = machine.businessLine?.productIndustry?.expertiseGroup ?? machine.businessLine?.expertiseGroup;
  return !machineGroup || machineGroup === expertiseGroup;
}

function AsyncEntityPicker<Row extends { id: string }>({
  className,
  disabled,
  endpoint,
  formatOption,
  initialOptions,
  label,
  onChange,
  placeholder,
  required,
  rowFilter,
  value,
}: {
  className?: string;
  disabled?: boolean;
  endpoint: string;
  formatOption: (row: Row) => PickerOption<Row>;
  initialOptions: Array<PickerOption<Row>>;
  label: string;
  onChange: (value: string, row?: Row) => void;
  placeholder: string;
  required?: boolean;
  rowFilter?: (row: Row) => boolean;
  value: string;
}) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<Array<PickerOption<Row>>>(initialOptions);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    setOptions((current) => {
      const merged = mergePickerOptions([...current, ...initialOptions]);
      const isSame =
        merged.length === current.length &&
        merged.every((option, index) => option.value === current[index]?.value && option.label === current[index]?.label);
      return isSame ? current : merged;
    });
  }, [initialOptions]);

  useEffect(() => {
    if (!open || disabled) return;

    const timeout = window.setTimeout(() => {
      loadOptions();
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [open, search, endpoint, disabled]);

  async function loadOptions() {
    setLoading(true);

    try {
      const result = await apiFetch<Paginated<Row>>(
        withSearchParams(endpoint, {
          limit: '20',
          search: search.trim(),
        }),
      );
      const nextOptions = result.data
        .filter((row) => (rowFilter ? rowFilter(row) : true))
        .map(formatOption);
      setOptions((current) => mergePickerOptions([...current, ...nextOptions]));
    } catch {
      setOptions((current) => current);
    } finally {
      setLoading(false);
    }
  }

  function choose(option: PickerOption<Row>) {
    onChange(option.value, option.row);
    setSearch(option.label);
    setOpen(false);
  }

  const inputValue = open ? search : selectedOption?.label || '';

  return (
    <div className={['async-entity-picker', className].filter(Boolean).join(' ')}>
      <span>{label}</span>
      <div className="async-picker-control">
        <input
          disabled={disabled}
          onBlur={() => {
            window.setTimeout(() => {
              setSearch('');
              setOpen(false);
            }, 160);
          }}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setSearch('');
            setOpen(true);
          }}
          placeholder={placeholder}
          value={inputValue}
        />
        {required && !value ? <input className="async-picker-required" required value="" onChange={() => null} /> : null}
        {open ? (
          <div className="async-picker-menu">
            {loading ? <div className="async-picker-state">Đang tìm...</div> : null}
            {!loading && options.length === 0 ? <div className="async-picker-state">Không tìm thấy dữ liệu phù hợp.</div> : null}
            {!loading
              ? options.map((option) => (
                  <button
                    className={option.value === value ? 'active' : ''}
                    key={option.value}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(option)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))
              : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function machinePickerLabel(machine: PickerMachine) {
  return [machine.machineCode, machine.serialNumber ? `S/N ${machine.serialNumber}` : '', machine.modelName || machine.name, machine.customer?.name]
    .filter(Boolean)
    .join(' - ');
}

function machinePickerEndpoint(kind: TaskKind) {
  const inventoryStatus = kind === 'installation' ? 'IN_STOCK' : 'INSTALLED';
  return `/machines?limit=20&inventoryStatus=${inventoryStatus}`;
}

function isMachineEligibleForTicket(kind: TaskKind, machine: PickerMachine) {
  if (!machine.inventoryStatus) return true;
  return kind === 'installation' ? machine.inventoryStatus === 'IN_STOCK' : machine.inventoryStatus === 'INSTALLED';
}

function customerPickerLabel(customer: PickerCustomer) {
  return [customer.customerCode, customer.name, customer.province, customer.phone].filter(Boolean).join(' - ');
}

function mergePickerOptions<Row>(options: Array<PickerOption<Row>>) {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (!option.value || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function withSearchParams(endpoint: string, params: Record<string, string>) {
  const [path, query = ''] = endpoint.split('?');
  const searchParams = new URLSearchParams(query);

  Object.entries(params).forEach(([key, paramValue]) => {
    if (paramValue) {
      searchParams.set(key, paramValue);
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function canEngineerSeeModel(user: ApiUser, model: QuickMachineModel) {
  const expertiseGroup = user.engineerProfile?.expertiseGroup;
  if (!expertiseGroup) return true;
  const modelGroup = model.businessLine?.productIndustry?.expertiseGroup ?? model.businessLine?.expertiseGroup;
  return !modelGroup || modelGroup === expertiseGroup;
}

function quickModelLabel(model: QuickMachineModel) {
  const shortName = model.code || model.displayName || model.name || 'Model';
  const detail = [model.name, model.manufacturer].filter(Boolean).join(' - ');
  return detail && detail !== shortName ? `${shortName} - ${detail}` : shortName;
}

function isEngineerUser(user: ApiUser) {
  return user.roleName === 'engineer' || user.role?.name === 'engineer' || user.role?.name === 'kỹ sư';
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek(value: Date) {
  const date = startOfDay(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function toDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDailyWorkDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
  }).format(date);
}

function dayNumber(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return String(date.getDate()).padStart(2, '0');
}

function monthLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '---';
  return `T${date.getMonth() + 1}`;
}

function formatDailyWorkTime(note: DailyWorkNote) {
  const range = [note.startTime, note.endTime].filter(Boolean).join(' - ');
  return range || 'Cả ngày';
}

function matchesBusinessTab(task: EngineerTask, tab: BusinessTab) {
  if (tab === 'repair') {
    return task.kind === 'repair' && task.warrantyStatus !== 'IN_WARRANTY';
  }

  if (tab === 'maintenance') {
    return task.kind === 'maintenance' && task.type !== 'WARRANTY';
  }

  if (tab === 'installation') {
    return task.kind === 'installation';
  }

  if (tab === 'warranty') {
    return (
      (task.kind === 'repair' && task.warrantyStatus === 'IN_WARRANTY') ||
      (task.kind === 'maintenance' && task.type === 'WARRANTY')
    );
  }

  if (tab === 'calendar') {
    return false;
  }

  return false;
}

function buildInstallationEditForm(task: InstallationTask): CreateTicketForm {
  const installedAt = task.installedAt ? task.installedAt.slice(0, 10) : '';
  const warrantyStartDate = task.warrantyCard?.startDate ? task.warrantyCard.startDate.slice(0, 10) : installedAt;
  const warrantyEndDate = task.warrantyCard?.endDate ? task.warrantyCard.endDate.slice(0, 10) : '';
  const installedDeviceItems = task.installedDeviceItems?.length
    ? task.installedDeviceItems.map((item) => ({
        itemName: item.itemName || '',
        model: item.model || '',
        serialNumber: item.serialNumber || '',
        manufactureDate: item.manufactureDate ? item.manufactureDate.slice(0, 10) : '',
        quantity: Number(item.quantity) || 1,
        warrantyPeriod: item.warrantyPeriod || '',
      }))
    : [emptyInstallationDeviceItem()];

  return {
    ...emptyCreateTicketForm('installation'),
    workDate: warrantyStartDate,
    warrantyEndDate,
    description: task.warrantyCard?.note || '',
    handoverInstallerName: task.handoverInstallerName || '',
    handoverInstallerPosition: task.handoverInstallerPosition || '',
    handoverVehicle: task.handoverVehicle || '',
    handoverDepartureDate: task.handoverDepartureDate ? task.handoverDepartureDate.slice(0, 10) : warrantyStartDate,
    receiverInstallAddress: task.receiverInstallAddress || '',
    receiverRepresentative: task.receiverRepresentative || '',
    receiverPosition: task.receiverPosition || '',
    receiverPhone: task.receiverPhone || '',
    installedDeviceItems,
    deviceCondition: task.deviceCondition || 'NEW_100',
    deviceConditionNote: task.deviceConditionNote || '',
  };
}

function defaultCreateKindForBusinessTab(tab: BusinessTab): TaskKind {
  if (tab === 'installation') return 'installation';
  return 'repair';
}

function WeeklyReportQuickCard({ loading, report }: { loading: boolean; report: WeeklyReportQuick | null }) {
  const weekStart = toDateInput(startOfWeek(new Date()));
  const weekEnd = toDateInput(addDays(new Date(`${weekStart}T00:00:00`), 6));
  const status = report?.status ?? 'NONE';
  const rowCount = report?.rows?.length ?? 0;

  return (
    <aside className="grid gap-4 rounded-lg border border-[#d9e1ea] bg-white p-4 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#657386]">
          <CalendarDays size={14} />
          Báo cáo tuần
        </span>
          <h2 className="mt-1 text-lg font-medium text-[#142033]">
            {formatDate(weekStart)} - {formatDate(weekEnd)}
          </h2>
        </div>
        <span className={`task-badge ${status === 'APPROVED' ? 'good' : status === 'SUBMITTED' ? 'warn' : status === 'NEEDS_REVISION' ? 'danger' : 'neutral'}`}>
          {loading ? 'Đang tải' : weeklyReportStatusLabels[status]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-[#f8fafc] p-3">
          <span className="block text-xs font-medium text-[#657386]">Dòng báo cáo</span>
          <strong className="mt-1 block text-2xl leading-none text-[#142033]">{loading ? '-' : rowCount}</strong>
        </div>
        <div className="rounded-lg bg-[#f8fafc] p-3">
          <span className="block text-xs font-medium text-[#657386]">Trạng thái</span>
          <strong className="mt-1 block text-sm text-[#142033]">{loading ? 'Đang tải' : weeklyReportStatusLabels[status]}</strong>
        </div>
      </div>

      <Link className="primary-button justify-center" to={`/weekly-reports?weekStart=${weekStart}`}>
        <FileText size={16} />
        Mở báo cáo tuần
      </Link>
    </aside>
  );
}

function PriorityTaskRow({ task }: { task: EngineerTask }) {
  const href =
    task.kind === 'installation'
      ? `/installations/${task.id}/update?returnTo=/my-tasks`
      : task.kind === 'repair'
        ? `/repairs/${task.id}/update?returnTo=/my-tasks`
        : `/maintenance/${task.id}/update?returnTo=/my-tasks`;
  const reason = isOverdueTask(task)
    ? 'Quá hạn'
    : needsMachineProfile(task)
      ? 'Cần tạo hồ sơ máy'
      : isTodayTask(task)
        ? 'Hôm nay'
        : 'Cần xử lý';

  return (
    <Link className="grid min-w-0 gap-3 px-4 py-3 transition hover:bg-[#f8fafc] min-[760px]:grid-cols-[minmax(0,1fr)_auto] min-[760px]:items-center" to={href}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#657386]">
          <span>{taskKindLabel(task.kind)}</span>
          <span>{task.code}</span>
          <span className={reason === 'Quá hạn' ? 'font-medium text-[#a3342b]' : reason === 'Cần tạo hồ sơ máy' ? 'font-medium text-[#9b5a17]' : 'font-medium text-[#334155]'}>
            {reason}
          </span>
        </div>
        <strong className="mt-1 block truncate text-[15px] font-medium text-[#142033]">{taskTitle(task)}</strong>
        <span className="mt-1 block truncate text-[13px] text-[#657386]">
          {[task.machine?.machineCode || taskSerialText(task) || 'Chưa có mã máy', task.machine?.modelName || taskModelText(task) || 'Chưa có model', taskCustomer(task) || 'Chưa có khách hàng'].join(' - ')}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 min-[760px]:justify-end">
        <span className={`task-badge ${statusTone(task.status)}`}>{statusLabel(task.status)}</span>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#d9e1ea] bg-white px-2.5 text-xs font-semibold text-[#334155]">
          Cập nhật
          <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}

function taskPriorityScore(task: EngineerTask) {
  let score = 0;
  if (isOverdueTask(task)) score += 100;
  if (isTodayTask(task)) score += 50;
  if (needsMachineProfile(task)) score += 30;
  if (task.kind === 'repair' && task.priority === 'URGENT') score += 25;
  if (task.kind === 'repair' && task.priority === 'HIGH') score += 15;
  return score;
}

function createTicketHrefForTab(tab: BusinessTab) {
  const returnTo = encodeURIComponent('/my-tasks');

  if (tab === 'installation') {
    return `/installations/create?returnTo=${returnTo}`;
  }

  if (tab === 'maintenance') {
    return `/service-tickets/create?kind=maintenance&returnTo=${returnTo}`;
  }

  if (tab === 'warranty') {
    return `/service-tickets/create?kind=repair&warrantyStatus=IN_WARRANTY&returnTo=${returnTo}`;
  }

  return `/service-tickets/create?kind=repair&returnTo=${returnTo}`;
}

function createTicketLabelForTab(tab: BusinessTab) {
  if (tab === 'installation') return 'Tạo phiếu lắp đặt';
  if (tab === 'maintenance') return 'Tạo phiếu bảo trì';
  if (tab === 'warranty') return 'Tạo phiếu bảo hành';
  return 'Tạo phiếu sửa chữa';
}

import { ArrowRight, CalendarDays, Clock3, Download, FileText, FileUp, Loader2, MapPin, PhoneCall, Plus, Search, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages, getApiBaseUrl, getToken } from '../../api';
import { DateInput } from '../../components/DateInput';
import { MachineAccessoryEditor } from '../../components/MachineAccessoryEditor';
import { ModelInfoFields } from '../../components/ModelInfoFields';
import { GoogleMapsDirectionsButton, VietnamAddressSelects, buildFullVietnamAddress } from '../../components/VietnamAddressSelects';
import { isEndoscopyMachineModel } from '../../config/endoscopyAccessories';
import { isUltrasoundMachineModel } from '../../config/ultrasoundProbes';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { parseMachineAccessoriesInput } from '../../utils/machineAccessories';
import { machineDisplayName, machineProductName } from '../../utils/machineDisplayName';
import { AsyncEntityPicker, type PickerOption } from './components/AsyncEntityPicker';
import { CreateModelDevicePicker } from './components/CreateModelDevicePicker';
import { EngineerTaskRow } from './components/EngineerTaskRow';
import { StatusActionPicker, TodayCommandCenter, TodayDailyWorkCard, WeeklyReportQuickCard } from './components/EngineerTaskPanels';
import { InstallationHandoverForm } from './InstallationHandoverForm';
import { SummaryTile } from './SummaryTile';
import { attachmentOptionsByKind, installationStatusOptions, maintenanceStatusOptions, repairStatusOptions } from './constants';
import type {
  AttachmentType,
  BusinessTab,
  CreateTicketForm,
  DailyWorkNote,
  DailyWorkStatus,
  DailyWorkType,
  EngineerTask,
  InstallationDeviceItem,
  InstallationTask,
  KindFilter,
  MaintenanceTask,
  PickerCustomer,
  PickerMachine,
  RepairTask,
  QuickMachineModel,
  SelectOption,
  TaskAttachment,
  TaskFilter,
  TaskKind,
  WeeklyReportQuick,
  WeeklyReportStatus,
  WorkspaceTab,
} from './types';
import {
  addDays,
  attachmentTypeLabel,
  buildInstallationEditForm,
  canEngineerSeeMachine,
  canEngineerSeeModel,
  compareTasks,
  createTicketLabelForTab,
  createTicketTitle,
  customerPickerLabel,
  defaultCreateKindForBusinessTab,
  deviceConditionLabel,
  emptyCreateTicketForm,
  emptyInstallationDeviceItem,
  entityTypeForTask,
  formatDate,
  formatDailyWorkDate,
  formatFileSize,
  dayNumber,
  isOverdueTask,
  isTodayTask,
  isUpcomingTask,
  needsMachineProfile,
  matchesFilter,
  nextDefaultStatus,
  normalizeInstallationDeviceItems,
  quickModelLabel,
  reviewStatusLabel,
  reviewStatusTone,
  secondaryLabel,
  secondaryTone,
  formatDailyWorkTime,
  groupTasksByDate,
  isEngineerUser,
  installationExtraItems,
  isMachineEligibleForTicket,
  machinePickerEndpoint,
  machinePickerLabel,
  monthLabel,
  matchesBusinessTab,
  splitLines,
  startOfDay,
  startOfWeek,
  statusLabel,
  statusTone,
  taskAttention,
  taskActionLabel,
  taskActionTextClass,
  taskContactPhone,
  taskCustomer,
  taskDate,
  taskDateValue,
  taskDescription,
  taskIcon,
  taskKindLabel,
  taskLocation,
  taskModelText,
  taskPrimaryMachineName,
  taskPriorityScore,
  taskSerialText,
  taskTitle,
  taskUpdatePanelTitle,
  taskUpdateHref,
  toDateInput,
  warrantyStatusLabel,
  weeklyReportHrefForDailyWork,
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
  DRAFT: { label: 'Nháp', className: 'border-[#e5e5e5] bg-white text-[#666666]' },
  PENDING: { label: 'Chờ duyệt', className: 'border-[#efd8a8] bg-[#fffaeb] text-[#9b5a17]' },
  APPROVED: { label: 'Đã duyệt', className: 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]' },
  REJECTED: { label: 'Từ chối', className: 'border-[#fecdd3] bg-[#fff1f3] text-[#b5121b]' },
  CANCELLED: { label: 'Đã hủy', className: 'border-[#e5e5e5] bg-[#fafafa] text-[#666666]' },
};

type QuickCustomerForm = {
  address: string;
  contactPerson: string;
  district: string;
  name: string;
  phone: string;
  province: string;
  ward: string;
};

const emptyQuickCustomerForm = (user?: ApiUser): QuickCustomerForm => ({
  address: '',
  contactPerson: '',
  district: '',
  name: '',
  phone: '',
  province: user?.region?.name || '',
  ward: '',
});

const weeklyReportStatusLabels: Record<WeeklyReportStatus | 'NONE', string> = {
  NONE: 'Chưa có',
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã gửi',
  APPROVED: 'Đã duyệt',
  NEEDS_REVISION: 'Cần sửa',
};

const businessTabs: Array<{ value: BusinessTab; label: string }> = [
  { value: 'all', label: 'Tổng việc' },
  { value: 'repair', label: 'Sửa chữa' },
  { value: 'maintenance', label: 'Bảo trì' },
  { value: 'installation', label: 'Lắp đặt' },
  { value: 'warranty', label: 'Bảo hành' },
  { value: 'calendar', label: 'Lịch công việc' },
];

const drawerFieldClass = 'grid gap-[7px] font-semibold text-[#333333]';
const drawerInputClass = 'min-h-[42px] rounded-xl border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f] outline-none focus:border-[#2563eb] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]';
const drawerTextareaClass = `${drawerInputClass} min-h-28 resize-y py-2.5`;

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
  const [filter, setFilter] = useState<TaskFilter>('action');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('assigned');
  const [businessTab, setBusinessTab] = useState<BusinessTab>('all');
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
  const [quickCustomerForm, setQuickCustomerForm] = useState<QuickCustomerForm>(() => emptyQuickCustomerForm(user));
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [machineOptions, setMachineOptions] = useState<Array<PickerOption<PickerMachine>>>([]);
  const [machineModelOptions, setMachineModelOptions] = useState<QuickMachineModel[]>([]);
  const [customerOptions, setCustomerOptions] = useState<Array<PickerOption<PickerCustomer>>>([]);

  useEffect(() => {
    loadTasks();
    loadDailyWorkNotes();
    loadWeeklyReportQuick();
    loadCreateOptions();
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
    }).sort(compareTasks);
  }, [businessTab, filter, kindFilter, query, tasks]);

  const groupedFilteredTasks = useMemo(() => groupTasksByDate(filteredTasks), [filteredTasks]);

  const businessTabCounts = useMemo(
    () => ({
      all: tasks.length,
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
      action: tasks.filter((task) => matchesFilter(task, 'action')).length,
      open: tasks.filter((task) => matchesFilter(task, 'open')).length,
      progress: tasks.filter((task) => matchesFilter(task, 'progress')).length,
      done: tasks.filter((task) => matchesFilter(task, 'done')).length,
      today: tasks.filter(isTodayTask).length,
      overdue: tasks.filter(isOverdueTask).length,
      upcoming: tasks.filter(isUpcomingTask).length,
      review: tasks.filter((task) => task.reviewStatus === 'PENDING').length,
      revision: tasks.filter((task) => task.reviewStatus === 'NEEDS_REVISION').length,
      missingMachine: tasks.filter(needsMachineProfile).length,
    }),
    [tasks],
  );

  const priorityTasks = useMemo(() => {
    return tasks
      .filter((task) => task.reviewStatus === 'NEEDS_REVISION' || !['COMPLETED', 'CANCELLED', 'INSTALLED'].includes(task.status))
      .filter((task) => task.reviewStatus === 'NEEDS_REVISION' || isOverdueTask(task) || isTodayTask(task) || needsMachineProfile(task))
      .sort((a, b) => {
        const priorityA = taskPriorityScore(a);
        const priorityB = taskPriorityScore(b);
        if (priorityB !== priorityA) return priorityB - priorityA;
        return compareTasks(a, b);
      })
      .slice(0, 5);
  }, [tasks]);

  const todayDailyWorkNotes = useMemo(() => {
    const todayKey = toDateInput(new Date());
    return dailyWorkNotes
      .filter((note) => note.workDate?.slice(0, 10) === todayKey)
      .sort((left, right) => (left.startTime || '99:99').localeCompare(right.startTime || '99:99'));
  }, [dailyWorkNotes]);

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
        ...(repairs?.data ?? []).map((task) => ({ ...task, kind: 'repair' as const })),
        ...(maintenances?.data ?? []).map((task) => ({ ...task, kind: 'maintenance' as const })),
        ...(installations?.data ?? []).map((task) => ({ ...task, kind: 'installation' as const })),
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
      const [installedMachinesResult, stockMachinesResult, reservedMachinesResult, returnedMachinesResult, customersResult] = await Promise.all([
        apiFetch<Paginated<PickerMachine>>('/machines?limit=20&inventoryStatus=INSTALLED'),
        apiFetch<Paginated<PickerMachine>>('/machines?limit=20&inventoryStatus=IN_STOCK'),
        apiFetch<Paginated<PickerMachine>>('/machines?limit=20&inventoryStatus=RESERVED'),
        apiFetch<Paginated<PickerMachine>>('/machines?limit=20&inventoryStatus=RETURNED'),
        apiFetch<Paginated<PickerCustomer>>('/customers?limit=20'),
      ]);
      const modelsResult = await apiFetchAllPages<QuickMachineModel>('/machine-models');

      setMachineOptions(
        [...(installedMachinesResult?.data ?? []), ...(stockMachinesResult?.data ?? []), ...(reservedMachinesResult?.data ?? []), ...(returnedMachinesResult?.data ?? [])].filter((machine) => canEngineerSeeMachine(user, machine)).map((machine) => ({
          value: machine.id,
          label: machinePickerLabel(machine),
          row: machine,
        })),
      );
      setCustomerOptions(
        (customersResult?.data ?? []).map((customer) => ({
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
            machineSerialNumber: createForm.machineId ? undefined : createForm.serialNumber.trim() || undefined,
            machineCode: createForm.machineId ? undefined : createForm.machineCode.trim() || undefined,
            machineName: createForm.machineId ? undefined : createForm.deviceName.trim() || undefined,
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
      setSuccess('Đã tạo phiếu. Admin sẽ kiểm tra nếu cần.');
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

  function selectCreateCustomer(customerId: string, customer?: PickerCustomer) {
    updateCreateForm({
      customerId,
      usingDepartment: customer?.name || createForm.usingDepartment,
      representative: customer?.contactPerson || createForm.representative,
      address: customer?.fullAddress || customer?.address || createForm.address,
      contactPhone: customer?.contactPhone || customer?.phone || createForm.contactPhone,
    });
  }

  function updateInstallationEditForm(patch: Partial<CreateTicketForm>) {
    setInstallationEditForm((current) => ({ ...current, ...patch }));
  }

  function changeCreateKind(kind: TaskKind) {
    setCreateForm((current) => ({
      ...current,
      kind,
      machineId: '',
      machineCode: '',
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
      machineCode: '',
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
      name: machineProductName(model) || machineDisplayName(model) || model?.displayName || model?.name || model?.code || '',
    }));
  }

  function selectCreateMachine(machine: PickerMachine) {
    setCreateForm((current) => {
      return {
        ...current,
        machineId: machine.id,
        machineCode: machine.machineCode || current.machineCode,
        customerId: machine.customer?.id || current.customerId,
        modelName: machine.modelName || current.modelName,
        serialNumber: machine.serialNumber || current.serialNumber,
        deviceName: machine.name || current.deviceName,
      };
    });
  }

  async function handleQuickMachineCreate() {
    const serialNumber = quickMachineForm.serialNumber.trim();
    const selectedModel = machineModelOptions.find((model) => model.id === quickMachineForm.machineModelId);
    const modelName = quickMachineForm.modelName.trim() || selectedModel?.name?.trim() || selectedModel?.code?.trim() || '';
    const name = quickMachineForm.name.trim();
    const customerId = quickMachineForm.customerId || createForm.customerId;
    const inventoryStatus = createForm.kind === 'installation' ? 'IN_STOCK' : 'INSTALLED';

    if (!serialNumber || !selectedModel || !modelName) {
      setError('Vui lòng nhập Serial và chọn model chuẩn để tạo thiết bị nhanh.');
      return;
    }

    setCreatingMachine(true);
    setError('');
    setSuccess('');

    try {
      const machine = await apiFetch<PickerMachine>('/machines', {
        method: 'POST',
        body: JSON.stringify({
          serialNumber,
          machineModelId: selectedModel?.id,
          modelName: undefined,
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
          province: quickCustomerForm.province.trim() || user.region?.name || undefined,
          district: quickCustomerForm.district.trim() || undefined,
          ward: quickCustomerForm.ward.trim() || undefined,
          address: quickCustomerForm.address.trim() || undefined,
          fullAddress: buildFullVietnamAddress(quickCustomerForm) || undefined,
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
      setQuickCustomerForm(emptyQuickCustomerForm(user));
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
      setStatus(task.status === 'PENDING' ? 'INSTALLED' : task.status);
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
      setAttachments(response?.data ?? []);
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

  function focusTaskList(nextFilter: TaskFilter) {
    setWorkspaceTab('assigned');
    setBusinessTab('all');
    setKindFilter('all');
    setFilter(nextFilter);
  }

  return (
    <PageFrame>
      <PageTitle
        eyebrow="Kỹ sư"
        title="Việc của tôi"
        description="Việc được giao và cập nhật kết quả."
      />

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <SummaryTile
          active={filter === 'action' && businessTab === 'all'}
          description="Việc cần làm tiếp"
          label="Cần xử lý"
          onClick={() => focusTaskList('action')}
          tone={taskStats.action > 0 ? 'warn' : 'neutral'}
          value={taskStats.action}
        />
        <SummaryTile
          active={filter === 'revision'}
          description="Admin trả về"
          label="Cần bổ sung"
          onClick={() => focusTaskList('revision')}
          tone={taskStats.revision > 0 ? 'danger' : 'neutral'}
          value={taskStats.revision}
        />
        <SummaryTile
          active={filter === 'review'}
          description="Đã gửi, chờ duyệt"
          label="Chờ admin xác nhận"
          onClick={() => focusTaskList('review')}
          tone={taskStats.review > 0 ? 'warn' : 'neutral'}
          value={taskStats.review}
        />
        <SummaryTile
          active={filter === 'today'}
          description="Theo ngày hẹn"
          label="Hôm nay"
          onClick={() => focusTaskList('today')}
          value={taskStats.today}
        />
        <SummaryTile
          active={filter === 'overdue'}
          description="Cần ưu tiên"
          label="Quá hạn"
          onClick={() => focusTaskList('overdue')}
          tone={taskStats.overdue > 0 ? 'danger' : 'neutral'}
          value={taskStats.overdue}
        />
        <SummaryTile
          active={filter === 'progress'}
          description="Đang cập nhật"
          label="Đang xử lý"
          onClick={() => focusTaskList('progress')}
          value={taskStats.progress}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 min-[1180px]:grid-cols-[minmax(0,1fr)_340px]">
        <TodayCommandCenter
          createLabel={createTicketLabelForTab(businessTab)}
          onCreate={openCreateRequest}
          onFilter={focusTaskList}
          onOpen={openTask}
          stats={taskStats}
          tasks={priorityTasks}
        />
        <div className="grid gap-3.5">
          <TodayDailyWorkCard loading={loadingDailyWork} notes={todayDailyWorkNotes} />
          <WeeklyReportQuickCard loading={loadingWeeklyReport} report={weeklyReport} />
        </div>
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
              <>
                <div className="machine-picker create-span-6">
                <AsyncEntityPicker<PickerMachine>
                  className="engineer-picker"
                  disabled={loadingCreateOptions}
                  endpoint={machinePickerEndpoint('installation')}
                  formatOption={(machine) => ({
                    label: machinePickerLabel(machine),
                    row: machine,
                    value: machine.id,
                  })}
                  initialOptions={machineOptions.filter((option) => isMachineEligibleForTicket('installation', option.row))}
                  label="Luồng 1: Chọn máy đã có hồ sơ"
                  onChange={(value, machine) => {
                    updateCreateForm({ machineId: value });
                    if (machine) selectCreateMachine(machine);
                  }}
                  placeholder="Tìm mã máy, S/N hoặc model"
                  rowFilter={(machine) => canEngineerSeeMachine(user, machine) && isMachineEligibleForTicket('installation', machine)}
                  value={createForm.machineId}
                />
                <button className="task-secondary" onClick={() => setIsQuickMachineOpen((value) => !value)} type="button">
                  <Plus size={16} />
                  Add machine
                </button>
                </div>
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
                  label="Model máy lắp đặt"
                  onChange={(value, model) => {
                    updateCreateForm({
                      machineModelId: value,
                      modelName: model?.name || model?.displayName || '',
                      deviceName: machineProductName(model) || machineDisplayName(model) || model?.displayName || model?.name || '',
                    });
                  }}
                  placeholder="VD: X-CUBE 50, X-CUBE 70..."
                  required={!createForm.machineId}
                  rowFilter={(model) => canEngineerSeeModel(user, model)}
                  value={createForm.machineModelId}
                />
                <ModelInfoFields model={machineModelOptions.find((model) => model.id === createForm.machineModelId)} />
                </div>
                <div className="quick-machine-form create-span-6">
                  <div className="quick-customer-heading">
                    <strong>Luồng 2: Nhập máy mới</strong>
                    <span>Nếu máy chưa có hồ sơ, nhập S/N để hệ thống tạo máy và gắn vào phiếu.</span>
                  </div>
                  <label>
                    Tên máy
                    <input
                      disabled={Boolean(createForm.machineId)}
                      onChange={(event) => updateCreateForm({ deviceName: event.target.value })}
                      placeholder="VD: Máy xét nghiệm miễn dịch"
                      value={createForm.deviceName}
                    />
                  </label>
                  <label>
                    S/N máy mới
                    <input
                      disabled={Boolean(createForm.machineId)}
                      onChange={(event) => updateCreateForm({ serialNumber: event.target.value })}
                      placeholder="Nhập S/N nếu máy chưa có trong dữ liệu"
                      value={createForm.serialNumber}
                    />
                  </label>
                  <label>
                    Mã máy nội bộ
                    <input
                      disabled={Boolean(createForm.machineId)}
                      onChange={(event) => updateCreateForm({ machineCode: event.target.value })}
                      placeholder="Có thể để trống"
                      value={createForm.machineCode}
                    />
                  </label>
                  {createForm.machineId ? (
                    <button
                      className="task-secondary"
                      onClick={() => updateCreateForm({ machineId: '', machineCode: '', serialNumber: '', deviceName: '' })}
                      type="button"
                    >
                      Nhập máy mới thay vì chọn máy có sẵn
                    </button>
                  ) : null}
                </div>
              </>
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
                  Add machine
                </button>
              </div>
            )}

            {isQuickMachineOpen ? (
              <div className="quick-machine-form">
                {(() => {
                  const selectedQuickModel = machineModelOptions.find((model) => model.id === quickMachineForm.machineModelId);
                  const accessoryMode = isEndoscopyMachineModel(selectedQuickModel)
                    ? 'endoscopy'
                    : isUltrasoundMachineModel(selectedQuickModel)
                      ? 'probe'
                      : null;

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
                <ModelInfoFields model={selectedQuickModel} />
                <label>
                  Serial
                  <input
                    onChange={(event) => updateQuickMachineForm({ serialNumber: event.target.value })}
                    value={quickMachineForm.serialNumber}
                  />
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
                  Add customer
                </button>
                <div className="quick-machine-accessories">
                  {accessoryMode ? (
                    <MachineAccessoryEditor
                      compact
                      mode={accessoryMode}
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
                  onChange={(value, row) => selectCreateCustomer(value, row)}
                  placeholder="Tìm tên, mã khách hàng, tỉnh hoặc số điện thoại"
                  required
                  value={createForm.customerId}
                />
                <button className="task-secondary quick-customer-toggle" onClick={() => setIsQuickCustomerOpen((value) => !value)} type="button">
                  <Plus size={16} />
                  Add customer
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
                  onChange={(value, row) => {
                    selectCreateCustomer(value, row);
                    updateQuickMachineForm({ customerId: value });
                  }}
                  placeholder="Chọn trước khách hàng nếu cần tạo thiết bị nhanh"
                  value={createForm.customerId}
                />
                <button className="task-secondary quick-customer-toggle" onClick={() => setIsQuickCustomerOpen((value) => !value)} type="button">
                  <Plus size={16} />
                  Add customer
                </button>
              </div>
            )}

            {isQuickCustomerOpen ? (
              <div className="quick-customer-form">
                <div className="quick-customer-heading">
                  <strong>Add customer</strong>
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
                <div className="grid gap-2 rounded-[18px] border border-[#dbe6f3] bg-white px-4 py-3 text-sm">
                  <span className="font-bold text-[#333333]">Khu vực quản lý</span>
                  <strong className="text-[#1f1f1f]">{quickCustomerForm.province || user.region?.name || 'Chưa gán khu vực'}</strong>
                </div>
                <VietnamAddressSelects
                  fieldClassName="min-h-11 rounded-2xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_4px_rgba(24,24,27,0.10)]"
                  labelClassName="grid gap-2 text-sm font-semibold text-[#333333]"
                  onChange={(patch) => updateQuickCustomerForm(patch)}
                  value={quickCustomerForm}
                />
                <label>
                  Người liên hệ
                  <input onChange={(event) => updateQuickCustomerForm({ contactPerson: event.target.value })} value={quickCustomerForm.contactPerson} />
                </label>
                <label>
                  Số điện thoại
                  <input onChange={(event) => updateQuickCustomerForm({ phone: event.target.value })} value={quickCustomerForm.phone} />
                </label>
                <div className="create-wide-field flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#dbe6f3] bg-white px-4 py-3 text-sm font-semibold text-[#667985]">
                  <span className="min-w-0 flex-1 truncate">{buildFullVietnamAddress(quickCustomerForm) || 'Chọn đủ địa chỉ để mở Google Maps nhanh.'}</span>
                  {buildFullVietnamAddress(quickCustomerForm) ? <GoogleMapsDirectionsButton address={buildFullVietnamAddress(quickCustomerForm)} className="task-secondary" /> : null}
                </div>
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
                <DateInput label="Ngày báo lỗi" onChange={(value) => updateCreateForm({ workDate: value })} required value={createForm.workDate} />
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
                <CreateModelDevicePicker
                  loading={loadingCreateOptions}
                  machineModelOptions={machineModelOptions}
                  onChange={updateCreateForm}
                  user={user}
                  value={createForm.machineModelId}
                />
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
                <DateInput label="Ngày bảo trì" onChange={(value) => updateCreateForm({ workDate: value })} required value={createForm.workDate} />
                <DateInput label="Lịch tiếp theo" onChange={(value) => updateCreateForm({ nextDueDate: value })} value={createForm.nextDueDate} />
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
                <CreateModelDevicePicker
                  loading={loadingCreateOptions}
                  machineModelOptions={machineModelOptions}
                  onChange={updateCreateForm}
                  user={user}
                  value={createForm.machineModelId}
                />
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
                  machineModels={machineModelOptions}
                  removeDeviceItem={removeInstallationDeviceItem}
                  updateDeviceItem={updateInstallationDeviceItem}
                  updateForm={updateCreateForm}
                  user={user}
                />
                <DateInput label="Ngày lắp đặt" onChange={(value) => updateCreateForm({ workDate: value })} required value={createForm.workDate} />
                <DateInput label="Hạn bảo hành" onChange={(value) => updateCreateForm({ warrantyEndDate: value })} required value={createForm.warrantyEndDate} />
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
              Back
            </button>
          </form>
        </section>
      ) : (
        <section className="min-w-0 overflow-hidden rounded-lg border border-[#e5e5e5] bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
          <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-1 border-b border-[#eeeeee] bg-[#fafafa] p-2" aria-label="Nhóm công việc">
            {businessTabs.map((tab) => (
              <button
                className={[
                  'flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-lg border-0 px-3 text-left text-sm font-medium transition',
                  businessTab === tab.value
                    ? 'bg-white text-[#18181b] shadow-[0_1px_5px_rgba(24,24,27,0.08)]'
                    : 'bg-transparent text-[#333333] hover:bg-white/70',
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
                      ? 'border-[#e4e4e7] bg-[#f4f4f5] text-[#18181b]'
                      : 'border-[#e5e5e5] bg-white text-[#666666]',
                  ].join(' ')}
                >
                  {businessTabCounts[tab.value]}
                </strong>
              </button>
            ))}
          </div>

          <div className="grid min-w-0 gap-3 border-b border-[#eeeeee] p-3 min-[1180px]:grid-cols-[minmax(220px,1fr)_auto_minmax(180px,220px)] min-[1180px]:items-end">
            <div className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-[#d6d6d6] bg-white px-3 text-[#666666] focus-within:border-[#18181b] focus-within:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]">
              <Search size={17} />
              <input className="min-w-0 flex-1 border-0 text-[#1f1f1f] outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã phiếu, mã máy, serial, khách hàng" value={query} />
            </div>
            <div className="grid w-full grid-cols-2 gap-[3px] rounded-lg border border-[#e5e5e5] bg-[#f4f7fb] p-[3px] min-[560px]:inline-flex min-[560px]:w-auto">
              {[
                ['action', 'Cần xử lý'],
                ['revision', 'Cần bổ sung'],
                ['review', 'Chờ duyệt'],
                ['progress', 'Đang làm'],
                ['done', 'Hoàn tất'],
                ['all', 'Tất cả'],
              ].map(([value, label]) => (
                <button
                  className={[
                    'min-h-8 min-w-0 flex-1 rounded-md border-0 px-2 text-xs font-medium leading-tight min-[560px]:flex-none min-[560px]:px-3 min-[560px]:text-sm',
                    filter === value ? 'bg-white text-[#18181b] shadow-[0_1px_4px_rgba(24,24,27,0.08)]' : 'bg-transparent text-[#333333]',
                  ].join(' ')}
                  key={value}
                  onClick={() => setFilter(value as TaskFilter)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-[#333333]">
              <span>Loại công việc</span>
              <select className="h-10 w-full rounded-lg border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]" onChange={(event) => setKindFilter(event.target.value as KindFilter)} value={kindFilter}>
                {businessTab === 'all' ? (
                  <>
                    <option value="all">Tất cả loại việc</option>
                    <option value="repair">Sửa chữa</option>
                    <option value="maintenance">Bảo trì</option>
                    <option value="installation">Lắp đặt</option>
                  </>
                ) : businessTab === 'repair' ? (
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
              <div className="flex min-h-40 items-center justify-center gap-2 p-6 text-[#666666]">
                <Loader2 className="spin-icon" size={18} />
                Đang tải việc được giao...
              </div>
            ) : null}

            {!loading && businessTab === 'calendar' ? (
              <>
                {loadingDailyWork ? (
                  <div className="flex min-h-40 items-center justify-center gap-2 p-6 text-[#666666]">
                    <Loader2 className="spin-icon" size={18} />
                    Đang tải lịch công việc...
                  </div>
                ) : null}

                {!loadingDailyWork && filteredDailyWorkNotes.length === 0 ? (
                  <div className="grid min-h-40 place-items-center gap-2 p-6 text-center text-[#666666]">
                    <strong className="text-[#1f1f1f]">Chưa có lịch công việc phù hợp</strong>
                    <span className="text-sm">Lịch admin thêm cho bạn và ghi chú công việc cá nhân sẽ xuất hiện tại đây.</span>
                  </div>
                ) : null}

                {!loadingDailyWork
                  ? filteredDailyWorkNotes.map((note) => (
                      <article className="grid min-w-0 items-center gap-3.5 border-b border-[#eeeeee] p-4 last:border-b-0 min-[640px]:grid-cols-[66px_minmax(0,1fr)]" key={note.id}>
                        <div className="grid min-h-16 justify-items-center rounded-lg border border-l-4 bg-[#fffdfb] p-2" style={{ borderColor: note.color || '#18181b' }}>
                          <strong className="text-2xl leading-none text-[#1f1f1f]">{dayNumber(note.workDate)}</strong>
                          <span className="text-xs font-medium text-[#666666]">{monthLabel(note.workDate)}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666666]">
                            <span>{dailyWorkTypeLabels[note.type || 'WORK']}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[12px] font-semibold ${dailyWorkStatusMeta[note.status || 'APPROVED'].className}`}>
                              {dailyWorkStatusMeta[note.status || 'APPROVED'].label}
                            </span>
                            <span>{formatDailyWorkDate(note.workDate)}</span>
                            <span>{formatDailyWorkTime(note)}</span>
                          </div>
                          <h2 className="mt-1 text-[17px] font-medium text-[#1f1f1f] [overflow-wrap:anywhere]">{note.title}</h2>
                          <p className="mt-1.5 leading-6 text-[#333333] [overflow-wrap:anywhere]">{note.note || 'Chưa có ghi chú chi tiết.'}</p>
                          {note.rejectReason ? <p className="mt-2 rounded-lg border border-[#fecdd3] bg-[#fff1f3] px-3 py-2 text-sm text-[#b5121b]">Lý do từ chối: {note.rejectReason}</p> : null}
                          {note.status === 'REJECTED' || note.status === 'CANCELLED' ? null : (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Link className="secondary-button" to={weeklyReportHrefForDailyWork(note)}>
                                <FileText size={16} />
                                Báo cáo tuần
                              </Link>
                            </div>
                          )}
                        </div>
                      </article>
                    ))
                  : null}
              </>
            ) : null}

            {!loading && businessTab !== 'calendar' && filteredTasks.length === 0 ? (
              <div className="grid min-h-40 place-items-center gap-2 p-6 text-center text-[#666666]">
                <strong className="text-[#1f1f1f]">Chưa có công việc phù hợp</strong>
                <span className="text-sm">Thử đổi bộ lọc hoặc kiểm tra lại phiếu được admin phân công.</span>
              </div>
            ) : null}

            {businessTab !== 'calendar' ? groupedFilteredTasks.map((group) => (
              <section className="engineer-day-group" key={group.key}>
                <div className="engineer-day-group__head">
                  <div>
                    <span>Ngày hẹn</span>
                    <strong>{group.label}</strong>
                  </div>
                  <em>{group.items.length} phiếu</em>
                </div>
                <div className="grid">
                  {group.items.map((task) => (
                    <EngineerTaskRow key={`${task.kind}-${task.id}`} onOpen={openTask} task={task} />
                  ))}
                </div>
              </section>
            )) : null}
          </div>
        </section>
      )}

      {selectedTask ? (
        <div className="fixed inset-0 z-20 flex justify-end bg-[rgba(24,24,27,0.34)]" onClick={() => setSelectedTask(null)} role="presentation">
          <aside
            aria-modal="true"
            className="grid w-[680px] max-w-full grid-rows-[auto_auto_auto_1fr] overflow-y-auto bg-white p-6 font-sans shadow-[-24px_0_60px_rgba(15,23,42,0.16)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[12px] font-bold text-[#18181b]">{taskKindLabel(selectedTask.kind)}</span>
                <h2 className="mt-1 text-[clamp(22px,2.4vw,30px)] leading-[1.12] tracking-[-0.04em] text-[#1f1f1f] [text-wrap:balance]">{taskTitle(selectedTask)}</h2>
              </div>
              <button className="task-close h-[34px] w-[34px] rounded-lg border border-[#e5e5e5] bg-[#f4f7fb] text-[#333333]" onClick={() => setSelectedTask(null)} title="Đóng" type="button">
                <X size={16} />
              </button>
            </div>

            <div className="mt-[18px] grid grid-cols-2 gap-2.5 rounded-2xl border border-[#dbeafe] bg-[linear-gradient(135deg,rgba(239,246,255,0.94),rgba(240,253,244,0.78)),#ffffff] p-3 max-[760px]:grid-cols-1">
              <div className="grid min-w-0 gap-1 rounded-xl border border-[rgba(191,219,254,0.72)] bg-white/75 p-2.5">
                <span className="text-[11px] font-extrabold text-[#64748b]">Thiết bị</span>
                <strong className="text-[14px] leading-tight text-[#18181b] [overflow-wrap:anywhere]">{taskPrimaryMachineName(selectedTask)}</strong>
              </div>
              <div className="grid min-w-0 gap-1 rounded-xl border border-[rgba(191,219,254,0.72)] bg-white/75 p-2.5">
                <span className="text-[11px] font-extrabold text-[#64748b]">Ngày hẹn</span>
                <strong className="text-[14px] leading-tight text-[#18181b] [overflow-wrap:anywhere]">{taskDate(selectedTask)}</strong>
              </div>
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
              {selectedTask.reviewStatus && selectedTask.reviewStatus !== 'NOT_REQUIRED' ? (
                <div>
                  <dt>Kiểm duyệt admin</dt>
                  <dd>{reviewStatusLabel(selectedTask.reviewStatus)}</dd>
                </div>
              ) : null}
            </dl>

            {selectedTask.reviewNote ? (
              <div className="task-info-block">
                <h3>Phản hồi admin</h3>
                <p>{selectedTask.reviewNote}</p>
              </div>
            ) : null}

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
                {installationExtraItems(selectedTask).length ? (
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
                        {installationExtraItems(selectedTask).map((item, index) => (
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
              <section className="mt-5 grid gap-3.5 rounded-[18px] border border-[#bfdbfe] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_18px_42px_rgba(37,99,235,0.08)]">
                <div className="flex items-start justify-between max-[760px]:flex-col max-[760px]:gap-2.5">
                  <div>
                    <span className="text-[12px] font-bold text-[#18181b]">Kỹ sư cập nhật</span>
                    <h3 className="mt-[3px] text-[17px] text-[#1f1f1f]">{taskUpdatePanelTitle(selectedTask)}</h3>
                  </div>
                </div>
                <form className="grid content-start gap-3.5" onSubmit={handleSubmit}>
                <StatusActionPicker onChange={setStatus} task={selectedTask} value={status} />
                <DateInput className={drawerFieldClass} label="Ngày lắp đặt" onChange={setInstallationDate} value={installationDate} />
                <label className={drawerFieldClass}>
                  Ghi chú lắp đặt
                  <textarea className={drawerTextareaClass} onChange={(event) => setResultNote(event.target.value)} value={resultNote} />
                </label>
                <DateInput className={drawerFieldClass} label="Kết thúc bảo hành" onChange={(value) => updateInstallationEditForm({ warrantyEndDate: value })} required value={installationEditForm.warrantyEndDate} />
                <label className={`create-wide-field ${drawerFieldClass}`}>
                  Ghi chú bảo hành
                  <textarea
                    className={drawerTextareaClass}
                    onChange={(event) => updateInstallationEditForm({ description: event.target.value })}
                    value={installationEditForm.description}
                  />
                </label>
                <InstallationHandoverForm
                  addDeviceItem={addInstallationEditDeviceItem}
                  form={installationEditForm}
                  machineModels={machineModelOptions}
                  removeDeviceItem={removeInstallationEditDeviceItem}
                  updateDeviceItem={updateInstallationEditDeviceItem}
                  updateForm={updateInstallationEditForm}
                  user={user}
                />
                <div className="col-span-full mt-2 flex justify-end gap-2.5">
                  <button className="task-secondary" onClick={() => setSelectedTask(null)} type="button">
                    Đóng
                  </button>
                  <button className="task-primary" disabled={saving} type="submit">
                    {saving ? 'Đang lưu' : 'Lưu cập nhật'}
                  </button>
                </div>
              </form>
              </section>
            ) : (
              <section className="mt-5 grid gap-3.5 rounded-[18px] border border-[#bfdbfe] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_18px_42px_rgba(37,99,235,0.08)]">
                <div className="flex items-start justify-between max-[760px]:flex-col max-[760px]:gap-2.5">
                  <div>
                    <span className="text-[12px] font-bold text-[#18181b]">Kỹ sư cập nhật</span>
                    <h3 className="mt-[3px] text-[17px] text-[#1f1f1f]">{taskUpdatePanelTitle(selectedTask)}</h3>
                  </div>
                </div>
                <form className="grid grid-cols-2 content-start gap-3.5 max-[760px]:grid-cols-1" onSubmit={handleSubmit}>
              <StatusActionPicker onChange={setStatus} task={selectedTask} value={status} />
              <label className={`col-span-full ${drawerFieldClass}`}>
                Kết quả/Ghi chú kỹ thuật
                <textarea className={drawerTextareaClass} onChange={(event) => setResultNote(event.target.value)} value={resultNote} />
              </label>
              {selectedTask.kind === 'repair' ? (
                <label className={`col-span-full ${drawerFieldClass}`}>
                  Phản hồi khách hàng
                  <textarea className={drawerTextareaClass} onChange={(event) => setCustomerFeedback(event.target.value)} value={customerFeedback} />
                </label>
              ) : (
                <DateInput className={drawerFieldClass} label="Lịch bảo trì tiếp theo" onChange={setNextDueDate} value={nextDueDate} />
              )}
              <div className="col-span-full mt-2 flex justify-end gap-2.5">
                <button className="task-secondary" onClick={() => setSelectedTask(null)} type="button">
                  Đóng
                </button>
                <button className="task-primary" disabled={saving} type="submit">
                  {saving ? 'Đang lưu' : 'Lưu cập nhật'}
                </button>
              </div>
            </form>
              </section>
            )}

            <section className="mt-[22px] grid gap-3.5 rounded-[18px] border border-[#e4e4e7] bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[12px] font-bold text-[#18181b]">Tài liệu hiện trường</span>
                  <h3 className="mt-[3px] text-[17px] text-[#1f1f1f]">Ảnh và biên bản</h3>
                </div>
                <strong className="inline-flex h-[30px] min-w-[30px] items-center justify-center rounded-full border border-[#e4e4e7] bg-[#f4f4f5] px-2 text-[#18181b]">{attachments.length}</strong>
              </div>

              <div className="grid gap-2.5">
                {loadingAttachments ? (
                  <div className="flex min-h-[58px] items-center gap-2 rounded-lg border border-dashed border-[#d6d6d6] bg-[#fafafa] p-3.5 text-[#666666]">
                    <Loader2 className="spin-icon" size={16} />
                    Đang tải tài liệu...
                  </div>
                ) : null}

                {!loadingAttachments &&
                  attachments.map((attachment) => (
                    <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white p-3" key={attachment.id}>
                      <div className="grid min-w-0 gap-1">
                        <span className="text-[12px] font-bold text-[#18181b]">{attachmentTypeLabel(attachment.type)}</span>
                        <strong className="text-[#1f1f1f] [overflow-wrap:anywhere]">{attachment.title || attachment.originalName}</strong>
                        <small className="text-[#666666] [overflow-wrap:anywhere]">
                          {attachment.originalName} · {formatFileSize(attachment.size)}
                        </small>
                      </div>
                      <button className="task-secondary icon-button" onClick={() => downloadAttachment(attachment)} title="Tải xuống" type="button">
                        <Download size={16} />
                      </button>
                    </article>
                  ))}
              </div>

              <form className="grid grid-cols-2 gap-3 rounded-[14px] border border-[#e4e4e7] bg-[#f8fafc] p-3.5 max-[760px]:grid-cols-1" onSubmit={handleAttachmentUpload}>
                <label className={drawerFieldClass}>
                  Loại tài liệu
                  <select className={drawerInputClass} onChange={(event) => setAttachmentType(event.target.value as AttachmentType)} value={attachmentType}>
                    {attachmentOptionsByKind[selectedTask.kind].map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={drawerFieldClass}>
                  Tên hiển thị
                  <input className={drawerInputClass} onChange={(event) => setAttachmentTitle(event.target.value)} placeholder="VD: Ảnh serial trước sửa chữa" value={attachmentTitle} />
                </label>
                <label className={`col-span-full ${drawerFieldClass}`}>
                  Ghi chú
                  <textarea className={drawerTextareaClass} onChange={(event) => setAttachmentDescription(event.target.value)} placeholder="Ghi chú ngắn cho file nếu cần" value={attachmentDescription} />
                </label>
                <label className={`col-span-full ${drawerFieldClass}`}>
                  File ảnh/PDF
                  <input
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className={`${drawerInputClass} flex items-center px-2.5 py-2`}
                    key={fileInputKey}
                    onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)}
                    required
                    type="file"
                  />
                </label>
                <button className="task-primary justify-self-end gap-2 disabled:cursor-not-allowed disabled:opacity-70" disabled={uploadingAttachment || !attachmentFile} type="submit">
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

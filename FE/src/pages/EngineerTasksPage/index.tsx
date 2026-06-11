import { Download, FileUp, Loader2, Plus, Search, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiUser, Paginated, apiFetch, getApiBaseUrl, getToken } from '../../api';
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

export function EngineerTasksPage({ user }: { user: ApiUser }) {
  const [tasks, setTasks] = useState<EngineerTask[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [isQuickMachineOpen, setIsQuickMachineOpen] = useState(false);
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);
  const [quickMachineForm, setQuickMachineForm] = useState<QuickMachineForm>(() => emptyQuickMachineForm());
  const [quickCustomerForm, setQuickCustomerForm] = useState<QuickCustomerForm>(() => emptyQuickCustomerForm());
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [machineOptions, setMachineOptions] = useState<SelectOption[]>([]);
  const [machineModelOptions, setMachineModelOptions] = useState<QuickMachineModel[]>([]);
  const [customerOptions, setCustomerOptions] = useState<SelectOption[]>([]);

  useEffect(() => {
    loadTasks();
    loadCreateOptions();
  }, [user.id]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tasks.filter((task) => {
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
  }, [filter, kindFilter, query, tasks]);

  const taskStats = useMemo(
    () => ({
      open: tasks.filter((task) => matchesFilter(task, 'open')).length,
      progress: tasks.filter((task) => matchesFilter(task, 'progress')).length,
      done: tasks.filter((task) => matchesFilter(task, 'done')).length,
      today: tasks.filter(isTodayTask).length,
      overdue: tasks.filter(isOverdueTask).length,
      upcoming: tasks.filter(isUpcomingTask).length,
    }),
    [tasks],
  );

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

  async function loadCreateOptions() {
    setLoadingCreateOptions(true);

    try {
      const [machinesResult, customersResult] = await Promise.all([
        apiFetch<Paginated<PickerMachine>>('/machines?limit=20&inventoryStatus=INSTALLED'),
        apiFetch<Paginated<PickerCustomer>>('/customers?limit=20'),
      ]);
      const modelsResult = await apiFetch<Paginated<QuickMachineModel>>('/machine-models?limit=20');

      setMachineOptions(
        machinesResult.data.filter((machine) => canEngineerSeeMachine(user, machine)).map((machine) => ({
          value: machine.id,
          label: machinePickerLabel(machine),
        })),
      );
      setCustomerOptions(
        customersResult.data.map((customer) => ({
          value: customer.id,
          label: customerPickerLabel(customer),
        })),
      );
      setMachineModelOptions(modelsResult.data.filter((model) => canEngineerSeeModel(user, model)));
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
            machineId: createForm.machineId,
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
            machineId: createForm.machineId,
            engineerId: user.id,
            scheduledDate: createForm.workDate,
            nextDueDate: createForm.nextDueDate || undefined,
            checklist: splitLines(createForm.checklist),
          }),
        });
      } else {
        await apiFetch('/installations', {
          method: 'POST',
          body: JSON.stringify({
            machineId: createForm.machineId,
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
    const supportsProbes = isUltrasoundMachineModel(selectedModel);

    if (!serialNumber || !modelName) {
      setError('Vui lòng nhập Serial và Model/Tên thiết bị để tạo thiết bị nhanh.');
      return;
    }

    setCreatingMachine(true);
    setError('');
    setSuccess('');

    try {
      const machine = await apiFetch<TaskMachine & { id: string; name?: string | null }>('/machines', {
        method: 'POST',
        body: JSON.stringify({
          serialNumber,
          machineModelId: selectedModel?.id,
          modelName: selectedModel ? undefined : modelName,
          name: name || modelName,
          customerId: customerId || undefined,
          primaryEngineerId: isEngineerUser(user) ? user.id : undefined,
          inventoryStatus: 'IN_STOCK',
          status: 'ACTIVE',
          accessories: parseMachineAccessoriesInput(quickMachineForm.accessoriesText),
        }),
      });
      const option = {
        value: machine.id,
        label: [machine.machineCode, machine.serialNumber, machine.modelName || machine.name].filter(Boolean).join(' - '),
      };
      setMachineOptions((current) => [option, ...current.filter((item) => item.value !== option.value)]);
      setCreateForm((current) => ({
        ...current,
        machineId: machine.id,
        customerId: current.customerId || customerId,
        modelName: current.modelName || selectedModel?.code || modelName,
        serialNumber: current.serialNumber || serialNumber,
        deviceName: current.deviceName || name,
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
          ? `/installations/${selectedTask.id}/status`
          : selectedTask.kind === 'repair'
          ? `/repairs/${selectedTask.id}/status`
          : `/maintenance/${selectedTask.id}/status`;
      const payload =
        selectedTask.kind === 'installation'
          ? { status, installedAt: installationDate || undefined, note: resultNote }
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

      <section className="engineer-task-summary">
        <SummaryTile label="Hôm nay" value={taskStats.today} />
        <SummaryTile label="Quá hạn" value={taskStats.overdue} tone={taskStats.overdue > 0 ? 'danger' : 'neutral'} />
        <SummaryTile label="Sắp tới" value={taskStats.upcoming} />
        <SummaryTile label="Chờ xử lý" value={taskStats.open} />
        <SummaryTile label="Đang xử lý" value={taskStats.progress} />
        <SummaryTile label="Đã hoàn tất" value={taskStats.done} />
      </section>

      <div className="engineer-workspace-tabs" aria-label="Khu vực kỹ sư">
        <button className={workspaceTab === 'assigned' ? 'active' : ''} onClick={() => setWorkspaceTab('assigned')} type="button">
          Công việc được giao
        </button>
        <button className={workspaceTab === 'create' ? 'active' : ''} onClick={() => setWorkspaceTab('create')} type="button">
          Tạo phiếu gửi admin
        </button>
      </div>

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
            <select onChange={(event) => updateCreateForm({ kind: event.target.value as TaskKind })} value={createForm.kind}>
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

            <div className={createForm.kind === 'installation' ? 'machine-picker create-span-6' : 'machine-picker'}>
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
                  .map((option) => ({ ...option, row: { id: option.value } as PickerMachine }))
                  .filter((option) => isMachineEligibleForTicket(createForm.kind, option.row))}
                label="Thiết bị"
                onChange={(value, machine) => {
                  updateCreateForm({ machineId: value });
                  if (machine) selectCreateMachine(machine);
                }}
                placeholder="Tìm mã máy, S/N, model hoặc khách hàng"
                required
                rowFilter={(machine) => canEngineerSeeMachine(user, machine) && isMachineEligibleForTicket(createForm.kind, machine)}
                value={createForm.machineId}
              />
              <button className="task-secondary" onClick={() => setIsQuickMachineOpen((value) => !value)} type="button">
                <Plus size={16} />
                Thêm thiết bị
              </button>
            </div>

            {isQuickMachineOpen ? (
              <div className="quick-machine-form">
                {(() => {
                  const selectedQuickModel = machineModelOptions.find((model) => model.id === quickMachineForm.machineModelId);
                  const supportsProbes = isUltrasoundMachineModel(selectedQuickModel);

                  return (
                    <>
                <AsyncEntityPicker<QuickMachineModel>
                  disabled={loadingCreateOptions}
                  endpoint="/machine-models?limit=20"
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
                  initialOptions={customerOptions.map((option) => ({ ...option, row: { id: option.value, name: option.label } }))}
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
                  initialOptions={customerOptions.map((option) => ({ ...option, row: { id: option.value, name: option.label } }))}
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
            ) : null}

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
          </form>
        </section>
      ) : (
        <section className="engineer-task-panel">
          <div className="task-toolbar">
            <div className="task-search">
              <Search size={17} />
              <input onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã phiếu, mã máy, serial, khách hàng" value={query} />
            </div>
            <div className="task-tabs">
              {[
                ['open', 'Cần xử lý'],
                ['progress', 'Đang làm'],
                ['done', 'Hoàn tất'],
                ['all', 'Tất cả'],
              ].map(([value, label]) => (
                <button
                  className={filter === value ? 'active' : ''}
                  key={value}
                  onClick={() => setFilter(value as TaskFilter)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="task-filter-select">
              <span>Loại công việc</span>
              <select onChange={(event) => setKindFilter(event.target.value as KindFilter)} value={kindFilter}>
                <option value="all">Tất cả loại</option>
                <option value="repair">Sửa chữa</option>
                <option value="maintenance">Bảo trì</option>
                <option value="installation">Lắp đặt</option>
              </select>
            </label>
          </div>

          <div className="task-list">
            {loading ? (
              <div className="task-state">
                <Loader2 className="spin-icon" size={18} />
                Đang tải việc được giao...
              </div>
            ) : null}

            {!loading && filteredTasks.length === 0 ? (
              <div className="task-state empty">
                <strong>Chưa có công việc phù hợp</strong>
                <span>Thử đổi bộ lọc hoặc kiểm tra lại phiếu được admin phân công.</span>
              </div>
            ) : null}

            {filteredTasks.map((task) => (
              <article className="task-card" key={`${task.kind}-${task.id}`}>
                <div className="task-card-main">
                  <div className="task-icon">{taskIcon(task.kind)}</div>
                  <div>
                    <div className="task-card-meta">
                      <span>{taskKindLabel(task.kind)}</span>
                      <span>{task.code}</span>
                      {task.kind === 'repair' && task.createdBy?.fullName ? <span>Người tạo: {task.createdBy.fullName}</span> : null}
                      {isOverdueTask(task) ? <span className="overdue-text">Quá hạn</span> : null}
                    </div>
                    <h2>{taskTitle(task)}</h2>
                    <p>{taskDescription(task) || 'Chưa có mô tả chi tiết.'}</p>
                    <div className="task-machine-line">
                      <span>{task.machine?.machineCode || task.machine?.serialNumber || taskSerialText(task) || 'Chưa có mã máy'}</span>
                      <span>{task.machine?.modelName || taskModelText(task) || 'Chưa có model'}</span>
                      <span>{taskCustomer(task) || 'Chưa có khách hàng'}</span>
                    </div>
                  </div>
                </div>
                <div className="task-card-side">
                  <span className={`task-badge ${statusTone(task.status)}`}>{statusLabel(task.status)}</span>
                  <span className={`task-badge ${secondaryTone(task)}`}>{secondaryLabel(task)}</span>
                  <span className="task-date">{taskDate(task)}</span>
                  <button className="task-action" onClick={() => openTask(task)} type="button">
                    Cập nhật
                  </button>
                </div>
              </article>
            ))}
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
                  <select onChange={(event) => setStatus(event.target.value)} required value={status}>
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

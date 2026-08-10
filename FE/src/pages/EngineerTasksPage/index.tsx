import { ArrowRight, CalendarDays, Clock3, FileText, Loader2, MapPin, PhoneCall, Plus, Search, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages, getApiBaseUrl, getToken } from '../../api';
import { GoogleMapsDirectionsButton } from '../../components/VietnamAddressSelects';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { EngineerTaskRow } from './components/EngineerTaskRow';
import { TodayCommandCenter, TodayDailyWorkCard, WeeklyReportQuickCard } from './components/EngineerTaskPanels';
import { QuickWorkLogPanel } from './components/QuickWorkLogPanel';
import { TaskAttachmentsPanel } from './components/TaskAttachmentsPanel';
import { TaskUpdateFormPanel } from './components/TaskUpdateFormPanel';
import {
  attachmentOptionsByKind,
  businessTabs,
  dailyWorkStatusMeta,
  dailyWorkTypeLabels,
  drawerFieldClass,
  drawerInputClass,
  drawerTextareaClass,
  installationStatusOptions,
  maintenanceStatusOptions,
  repairStatusOptions,
  weeklyReportStatusLabels,
} from './constants';
import type {
  AttachmentType,
  BusinessTab,
  ComponentAccessoryOption,
  CreateTicketForm,
  DailyWorkNote,
  DailyWorkType,
  EngineerTask,
  InstallationDeviceItem,
  InstallationTask,
  KindFilter,
  MaintenanceTask,
  RepairTask,
  QuickMachineModel,
  TaskAttachment,
  TaskFilter,
  TaskKind,
  WorkOperationsResponse,
  WeeklyReportQuick,
  WorkspaceTab,
} from './types';
import {
  addDays,
  buildStructuredEngineerNote,
  buildInstallationEditForm,
  canEngineerSeeModel,
  completionBlockers,
  compareTasks,
  createTicketLabelForTab,
  defaultCreateKindForBusinessTab,
  deviceConditionLabel,
  emptyCreateTicketForm,
  emptyInstallationDeviceItem,
  engineerChecklistForTask,
  entityTypeForTask,
  formatDate,
  formatDailyWorkDate,
  dayNumber,
  isOverdueTask,
  isTodayTask,
  isUpcomingTask,
  needsMachineProfile,
  matchesFilter,
  normalizeInstallationDeviceItems,
  nextDefaultStatus,
  reviewStatusLabel,
  reviewStatusTone,
  secondaryLabel,
  secondaryTone,
  formatDailyWorkTime,
  groupTasksByDate,
  isEngineerUser,
  installationExtraItems,
  materialRowsToText,
  monthLabel,
  matchesBusinessTab,
  parseMaterialRows,
  parseWorkLogRows,
  profileCompletenessForTask,
  splitLines,
  sameMachineHistory,
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
  taskDescription,
  taskIcon,
  taskKindLabel,
  taskModelText,
  taskPrimaryMachineName,
  taskPriorityScore,
  taskSerialText,
  taskAddressForMap,
  taskTitle,
  taskUpdateHref,
  toDateInput,
  warrantyStatusLabel,
  weeklyReportHrefForDailyWork,
  workLogRowsToText,
} from './utils';
import './styles.css';

function dailyWorkTypeForQuickLog(kind: TaskKind): DailyWorkType {
  if (kind === 'repair') return 'REPAIR';
  if (kind === 'maintenance') return 'MAINTENANCE';
  return 'INSTALLATION';
}

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
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [status, setStatus] = useState('');
  const [resultNote, setResultNote] = useState('');
  const [customerFeedback, setCustomerFeedback] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [installationDate, setInstallationDate] = useState('');
  const [checkedChecklist, setCheckedChecklist] = useState<Record<string, boolean>>({});
  const [materialsText, setMaterialsText] = useState('');
  const [accessoryOptions, setAccessoryOptions] = useState<ComponentAccessoryOption[]>([]);
  const [loadingAccessoryOptions, setLoadingAccessoryOptions] = useState(false);
  const [workLogText, setWorkLogText] = useState('');
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTicketForm>(() => emptyCreateTicketForm());
  const [installationEditForm, setInstallationEditForm] = useState<CreateTicketForm>(() => emptyCreateTicketForm('installation'));
  const [machineModelOptions, setMachineModelOptions] = useState<QuickMachineModel[]>([]);

  useEffect(() => {
    loadTasks();
    loadDailyWorkNotes();
    loadWeeklyReportQuick();
    loadMachineModelOptions();
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

  const selectedChecklistLines = useMemo(() => (selectedTask ? engineerChecklistForTask(selectedTask) : []), [selectedTask]);
  const selectedCheckedChecklistLines = useMemo(
    () => selectedChecklistLines.filter((line) => checkedChecklist[line]),
    [checkedChecklist, selectedChecklistLines],
  );
  const selectedMachineHistory = useMemo(() => (selectedTask ? sameMachineHistory(selectedTask, tasks) : []), [selectedTask, tasks]);
  const selectedMapAddress = useMemo(() => (selectedTask ? taskAddressForMap(selectedTask) : ''), [selectedTask]);
  const selectedCompleteness = useMemo(
    () =>
      selectedTask
        ? profileCompletenessForTask(
            selectedTask,
            attachments,
            resultNote,
            selectedCheckedChecklistLines,
            nextDueDate,
            customerFeedback,
            installationEditForm.receiverRepresentative,
            installationEditForm.receiverPhone,
          )
        : null,
    [attachments, customerFeedback, installationEditForm.receiverPhone, installationEditForm.receiverRepresentative, nextDueDate, resultNote, selectedCheckedChecklistLines, selectedTask],
  );
  const selectedCompletionBlockers = useMemo(
    () => (selectedTask ? completionBlockers(selectedTask, selectedCompleteness, status) : []),
    [selectedCompleteness, selectedTask, status],
  );
  const todayTaskSummary = useMemo(() => {
    const todayTasks = tasks.filter(isTodayTask);
    return {
      total: todayTasks.length,
      done: todayTasks.filter((task) => ['COMPLETED', 'CANCELLED', 'INSTALLED'].includes(task.status)).length,
      open: todayTasks.filter((task) => !['COMPLETED', 'CANCELLED', 'INSTALLED'].includes(task.status)).length,
      items: todayTasks.sort(compareTasks).slice(0, 4),
    };
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

  async function loadMachineModelOptions() {
    try {
      const modelsResult = await apiFetchAllPages<QuickMachineModel>('/machine-models');
      setMachineModelOptions(modelsResult.filter((model) => canEngineerSeeModel(user, model)));
    } catch {
      setMachineModelOptions([]);
    }
  }

  async function handleCreateTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const noteSections = [
        createForm.description.trim(),
        createForm.usingDepartment.trim() ? `[Khách hàng/đơn vị]\n${createForm.usingDepartment.trim()}` : '',
        createForm.deviceName.trim() ? `[Máy/model/serial]\n${createForm.deviceName.trim()}` : '',
        createForm.contactPhone.trim() ? `[Liên hệ]\n${createForm.contactPhone.trim()}` : '',
        createForm.repairMethod.trim() ? `[Đề xuất/việc cần xử lý tiếp]\n${createForm.repairMethod.trim()}` : '',
      ].filter(Boolean);

      await apiFetch('/daily-work-notes', {
        method: 'POST',
        body: JSON.stringify({
          title: createForm.title.trim(),
          note: noteSections.join('\n\n'),
          workDate: createForm.workDate,
          type: dailyWorkTypeForQuickLog(createForm.kind),
        }),
      });

      setCreateForm(emptyCreateTicketForm());
      setSuccess('Đã lưu ghi nhận nhanh. Nội dung này sẽ vào lịch và báo cáo tuần của bạn.');
      setWorkspaceTab('assigned');
      await loadDailyWorkNotes();
      await loadWeeklyReportQuick();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được ghi nhận nhanh.');
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
    }));
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
    setWorkspaceTab('create');
  }

  function backToAssignedWork() {
    setWorkspaceTab('assigned');
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
    setAttachmentFiles([]);
    setFileInputKey((value) => value + 1);
    setCheckedChecklist({});
    setMaterialsText('');
    setAccessoryOptions([]);
    setWorkLogText('');
    loadAttachments(task);
    loadWorkOperations(task);
    loadAccessoryOptions(task);

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

  async function loadWorkOperations(task: EngineerTask) {
    try {
      const result = await apiFetch<WorkOperationsResponse>(`/work-operations/${task.kind}/${task.id}`);
      setMaterialsText(materialRowsToText(result.usedParts ?? []));
      setWorkLogText(workLogRowsToText(result.workLogs ?? []));
      if (result.checklistItems?.length) {
        const nextChecked: Record<string, boolean> = {};
        result.checklistItems.forEach((item) => {
          nextChecked[item.label] = item.status === 'DONE';
        });
        setCheckedChecklist(nextChecked);
      }
    } catch {
      // Work operation tables may not exist until the new migration is applied.
    }
  }

  async function loadAccessoryOptions(task: EngineerTask) {
    if (!['repair', 'maintenance'].includes(task.kind)) return;

    setLoadingAccessoryOptions(true);

    try {
      const params = new URLSearchParams({ limit: '100', status: 'ACTIVE' });
      const machineModelId = task.machine?.machineModel?.id;
      const modelSearch = task.machine?.machineModel?.code || task.machine?.machineModel?.name || taskModelText(task);

      if (machineModelId) {
        params.set('machineModelId', machineModelId);
      } else if (modelSearch) {
        params.set('search', modelSearch);
      }

      const result = await apiFetch<Paginated<ComponentAccessoryOption>>(`/component-accessories?${params.toString()}`);
      setAccessoryOptions(result.data ?? []);
    } catch {
      setAccessoryOptions([]);
    } finally {
      setLoadingAccessoryOptions(false);
    }
  }

  function appendAccessoryMaterial(accessoryId: string) {
    const accessory = accessoryOptions.find((item) => item.id === accessoryId);
    if (!accessory) return;

    const note = [
      accessory.code ? `Mã ${accessory.code}` : '',
      accessory.component?.name ? `Thành phần: ${accessory.component.name}` : '',
      accessory.component?.machineModel?.code ? `Model: ${accessory.component.machineModel.code}` : '',
    ].filter(Boolean).join('; ');
    const line = [accessory.name, '1', '', '', note].join(' | ');

    setMaterialsText((current) => [current.trim(), line].filter(Boolean).join('\n'));
  }

  async function syncWorkOperations(task: EngineerTask) {
    const checklistItems = engineerChecklistForTask(task).map((line, index) => ({
      label: line,
      status: checkedChecklist[line] ? 'DONE' : 'PENDING',
      sortOrder: index,
    }));
    await apiFetch(`/work-operations/${task.kind}/${task.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        workLogs: parseWorkLogRows(workLogText),
        usedParts: parseMaterialRows(materialsText),
        checklistItems,
      }),
    });
  }

  async function handleAttachmentUpload() {
    if (!selectedTask || !attachmentFiles.length) return;

    setUploadingAttachment(true);
    setError('');
    setSuccess('');

    try {
      for (const file of attachmentFiles) {
        const formData = new FormData();
        formData.append('entityType', entityTypeForTask(selectedTask.kind));
        formData.append('entityId', selectedTask.id);
        formData.append('type', attachmentType);
        if (attachmentTitle.trim()) formData.append('title', attachmentFiles.length > 1 ? `${attachmentTitle.trim()} - ${file.name}` : attachmentTitle.trim());
        if (attachmentDescription.trim()) formData.append('description', attachmentDescription.trim());
        formData.append('file', file);

        await apiFetch('/attachments', {
          method: 'POST',
          body: formData,
        });
      }
      setAttachmentTitle('');
      setAttachmentDescription('');
      setAttachmentFiles([]);
      setFileInputKey((value) => value + 1);
      setSuccess(`Đã tải ${attachmentFiles.length} tài liệu lên phiếu.`);
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

  async function viewAttachment(attachment: TaskAttachment) {
    setError('');

    try {
      const token = getToken();
      const response = await fetch(`${getApiBaseUrl()}${attachment.url}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error('Không mở được file. Vui lòng đăng nhập lại hoặc thử lại sau.');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không mở được tài liệu.');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask) return;

    setError('');
    setSuccess('');

    const blockers = completionBlockers(selectedTask, selectedCompleteness, status);
    if (blockers.length) {
      setError(`Chưa thể chuyển sang "${statusLabel(status)}". Vui lòng bổ sung: ${blockers.join(', ')}.`);
      return;
    }

    setSaving(true);

    try {
      const enrichedResultNote = buildStructuredEngineerNote(resultNote, selectedCheckedChecklistLines, materialsText, workLogText);
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
              note: enrichedResultNote,
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
          ? { status, resultNote: enrichedResultNote, customerFeedback }
          : { status, resultNote: enrichedResultNote, nextDueDate: nextDueDate || undefined };

      await apiFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await syncWorkOperations(selectedTask);

      setSuccess('Đã cập nhật trạng thái công việc.');
      setSelectedTask(null);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được công việc.');
    } finally {
      setSaving(false);
    }
  }

  async function createKnowledgeFromTask() {
    if (!selectedTask) return;

    setSavingKnowledge(true);
    setError('');
    setSuccess('');

    try {
      const structuredNote = buildStructuredEngineerNote(resultNote, selectedCheckedChecklistLines, materialsText, workLogText);
      const category = selectedTask.kind === 'repair' ? 'REPAIR' : selectedTask.kind === 'maintenance' ? 'MAINTENANCE' : 'INSTALLATION';
      const modelHint = taskModelText(selectedTask) || taskPrimaryMachineName(selectedTask);
      await apiFetch('/knowledge-articles', {
        method: 'POST',
        body: JSON.stringify({
          title: `Kinh nghiệm ${taskKindLabel(selectedTask.kind).toLowerCase()} - ${modelHint || selectedTask.code}`,
          summary: taskDescription(selectedTask) || resultNote || `Tạo từ phiếu ${selectedTask.code}`,
          content: structuredNote || taskDescription(selectedTask) || '',
          modelHint,
          ownerTeam: 'Kỹ thuật hiện trường',
          category,
          status: 'DRAFT',
          tags: [taskKindLabel(selectedTask.kind), selectedTask.machine?.productCategory, selectedTask.machine?.businessLine?.productIndustry?.name, modelHint].filter(Boolean),
          symptoms: selectedTask.kind === 'repair' ? splitLines(taskDescription(selectedTask) || taskTitle(selectedTask)) : [],
          steps: splitLines(workLogText || resultNote),
          checklist: selectedCheckedChecklistLines,
          note: `Tạo nhanh từ phiếu ${selectedTask.code}. Admin duyệt trước khi đưa vào knowledge base.`,
        }),
      });
      setSuccess('Đã tạo bài học kinh nghiệm dạng nháp để admin duyệt.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được bài học kinh nghiệm.');
    } finally {
      setSavingKnowledge(false);
    }
  }

  function toggleChecklistLine(line: string, checked: boolean) {
    setCheckedChecklist((current) => ({ ...current, [line]: checked }));
  }

  function focusTaskList(nextFilter: TaskFilter) {
    setWorkspaceTab('assigned');
    setBusinessTab('all');
    setKindFilter('all');
    setFilter(nextFilter);
  }

  return (
    <PageFrame>
      <section className="engineer-task-hero">
        <div className="engineer-task-hero__copy">
          <span>Kỹ sư hiện trường</span>
          <h1>Việc của tôi</h1>
          <p>Mở màn là thấy việc cần xử lý, phiếu tự tạo khẩn và lịch hôm nay.</p>
        </div>
        <div className="engineer-task-hero__actions">
          <button className="secondary-button" onClick={() => void loadTasks()} type="button">
            {loading ? <Loader2 className="spin-icon" size={16} /> : <Clock3 size={16} />}
            Làm mới
          </button>
          <button className="primary-button" onClick={openCreateRequest} type="button">
            <Plus size={16} />
            {createTicketLabelForTab(businessTab)}
          </button>
        </div>
      </section>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

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
        <QuickWorkLogPanel
          form={createForm}
          onBack={backToAssignedWork}
          onChange={updateCreateForm}
          onKindChange={changeCreateKind}
          onSubmit={handleCreateTicket}
          saving={saving}
        />
      ) : (
        <section className="engineer-task-panel">
          <div className="engineer-business-tabs" aria-label="Nhóm công việc">
            {businessTabs.map((tab) => (
              <button
                className={businessTab === tab.value ? 'active' : ''}
                key={tab.value}
                onClick={() => {
                  setBusinessTab(tab.value);
                  setKindFilter('all');
                }}
                type="button"
              >
                <span>{tab.label}</span>
                <strong>{businessTabCounts[tab.value]}</strong>
              </button>
            ))}
          </div>

          <div className="task-toolbar">
            <div className="task-search">
              <Search size={17} />
              <input onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã phiếu, mã máy, serial, khách hàng" value={query} />
            </div>
            <div className="task-toolbar__filters">
              <label className="task-filter-select task-status-select">
                <span>Trạng thái</span>
                <select onChange={(event) => setFilter(event.target.value as TaskFilter)} value={filter}>
                  <option value="action">Cần xử lý</option>
                  <option value="revision">Cần bổ sung</option>
                  <option value="review">Chờ duyệt</option>
                  <option value="progress">Đang làm</option>
                  <option value="done">Hoàn tất</option>
                  <option value="all">Tất cả</option>
                </select>
              </label>
              {businessTab === 'all' || businessTab === 'warranty' ? (
                <label className="task-filter-select">
                  <span>Loại công việc</span>
                  <select onChange={(event) => setKindFilter(event.target.value as KindFilter)} value={kindFilter}>
                    {businessTab === 'all' ? (
                      <>
                        <option value="all">Tất cả loại việc</option>
                        <option value="repair">Sửa chữa</option>
                        <option value="maintenance">Bảo trì</option>
                        <option value="installation">Lắp đặt</option>
                      </>
                    ) : (
                      <>
                        <option value="all">Tất cả bảo hành</option>
                        <option value="repair">Sửa chữa bảo hành</option>
                        <option value="maintenance">Bảo trì bảo hành</option>
                      </>
                    )}
                  </select>
                </label>
              ) : null}
            </div>
          </div>

          <div className="task-list">
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

            <div className="mt-[18px] grid grid-cols-2 gap-2.5 rounded-2xl border border-[#e4e4e7] bg-[#fafafa] p-3 max-[760px]:grid-cols-1">
              <div className="grid min-w-0 gap-1 rounded-xl border border-[#ededf0] bg-white p-2.5">
                <span className="text-[11px] font-extrabold text-[#64748b]">Thiết bị</span>
                <strong className="text-[14px] leading-tight text-[#18181b] [overflow-wrap:anywhere]">{taskPrimaryMachineName(selectedTask)}</strong>
              </div>
              <div className="grid min-w-0 gap-1 rounded-xl border border-[#ededf0] bg-white p-2.5">
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

            <section className="mt-5 grid gap-4 rounded-[18px] border border-[#e4e4e7] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-3 max-[760px]:flex-col">
                <div>
                  <span className="text-[12px] font-bold text-[#18181b]">Bàn làm việc kỹ sư</span>
                  <h3 className="mt-[3px] text-[17px] text-[#1f1f1f]">Checklist, vật tư, nhật ký và hồ sơ máy</h3>
                </div>
                {selectedCompleteness ? (
                  <div className="grid min-w-[140px] gap-1 rounded-xl border border-[#e4e4e7] bg-[#f8fafc] p-2.5 text-right max-[760px]:w-full max-[760px]:text-left">
                    <span className="text-[11px] font-extrabold text-[#64748b]">Độ đầy đủ hồ sơ</span>
                    <strong className="text-[22px] leading-none text-[#18181b]">{selectedCompleteness.percent}%</strong>
                  </div>
                ) : null}
              </div>

              {selectedCompleteness?.missing.length ? (
                <div className="flex flex-wrap gap-2">
                  {selectedCompleteness.missing.map((item) => (
                    <span className="rounded-full border border-[#fecdd3] bg-[#fff1f3] px-2.5 py-1 text-[12px] font-bold text-[#b5121b]" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-[#b9e8ca] bg-[#eefaf3] px-3 py-2 text-[13px] font-bold text-[#177245]">
                  Hồ sơ đã đủ thông tin chính để admin kiểm duyệt.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
                <div className="grid gap-2 rounded-[14px] border border-[#e4e4e7] bg-[#fafafa] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[14px] text-[#18181b]">Checklist theo loại việc</strong>
                    <span className="text-[12px] font-bold text-[#64748b]">{selectedCheckedChecklistLines.length}/{selectedChecklistLines.length}</span>
                  </div>
                  <div className="grid max-h-[250px] gap-2 overflow-auto pr-1">
                    {selectedChecklistLines.map((line) => (
                      <label className="grid grid-cols-[18px_minmax(0,1fr)] items-start gap-2 rounded-lg border border-[#ececec] bg-white p-2.5 text-[13px] font-semibold leading-snug text-[#333333]" key={line}>
                        <input checked={Boolean(checkedChecklist[line])} className="mt-[2px]" onChange={(event) => toggleChecklistLine(line, event.target.checked)} type="checkbox" />
                        <span>{line}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3">
                  <label className={drawerFieldClass}>
                    Linh kiện/vật tư sử dụng
                    {selectedTask.kind === 'repair' || selectedTask.kind === 'maintenance' ? (
                      <select
                        className={drawerInputClass}
                        disabled={loadingAccessoryOptions || accessoryOptions.length === 0}
                        onChange={(event) => {
                          appendAccessoryMaterial(event.target.value);
                          event.target.value = '';
                        }}
                        value=""
                      >
                        <option value="">
                          {loadingAccessoryOptions
                            ? 'Đang tải phụ kiện theo model...'
                            : accessoryOptions.length
                              ? 'Chọn phụ kiện từ danh mục'
                              : 'Chưa có phụ kiện theo model này'}
                        </option>
                        {accessoryOptions.map((accessory) => (
                          <option key={accessory.id} value={accessory.id}>
                            {[accessory.name, accessory.code, accessory.component?.name, accessory.component?.machineModel?.code].filter(Boolean).join(' - ')}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <textarea
                      className={drawerTextareaClass}
                      onChange={(event) => setMaterialsText(event.target.value)}
                      placeholder="Tên linh kiện | SL | Serial | Đơn giá | Ghi chú"
                      value={materialsText}
                    />
                  </label>
                  <label className={drawerFieldClass}>
                    Nhật ký xử lý theo bước
                    <textarea
                      className={drawerTextareaClass}
                      onChange={(event) => setWorkLogText(event.target.value)}
                      placeholder="09:00 - Kiểm tra nguồn&#10;09:20 - Xác định lỗi&#10;10:00 - Test lại và bàn giao"
                      value={workLogText}
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
                <div className="grid gap-2 rounded-[14px] border border-[#e4e4e7] bg-[#fafafa] p-3">
                  <strong className="text-[14px] text-[#18181b]">Hồ sơ máy mini</strong>
                  <dl className="grid gap-2 text-[13px]">
                    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
                      <dt className="font-bold text-[#64748b]">Máy</dt>
                      <dd className="[overflow-wrap:anywhere]">{taskPrimaryMachineName(selectedTask)}</dd>
                    </div>
                    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
                      <dt className="font-bold text-[#64748b]">Model/SN</dt>
                      <dd className="[overflow-wrap:anywhere]">{taskModelText(selectedTask) || '-'} / {taskSerialText(selectedTask) || selectedTask.machine?.serialNumber || '-'}</dd>
                    </div>
                    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
                      <dt className="font-bold text-[#64748b]">Gần đây</dt>
                      <dd>
                        {selectedMachineHistory.length ? (
                          <div className="grid gap-1.5">
                            {selectedMachineHistory.map((item) => (
                              <span className="rounded-lg border border-[#e4e4e7] bg-white px-2 py-1" key={`${item.kind}-${item.id}`}>
                                {taskDate(item)} · {taskKindLabel(item.kind)} · {statusLabel(item.status)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          'Chưa có lịch sử gần đây'
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="grid gap-2 rounded-[14px] border border-[#e4e4e7] bg-[#fafafa] p-3">
                  <strong className="text-[14px] text-[#18181b]">Tuyến đường và báo cáo ngày</strong>
                  <div className="grid gap-2 text-[13px] text-[#333333]">
                    <span className="inline-flex items-start gap-2">
                      <MapPin className="mt-[1px] shrink-0 text-[#64748b]" size={15} />
                      <span className="[overflow-wrap:anywhere]">{selectedMapAddress || 'Chưa có địa chỉ để mở bản đồ'}</span>
                    </span>
                    {selectedMapAddress ? <GoogleMapsDirectionsButton address={selectedMapAddress} className="task-secondary justify-self-start" /> : null}
                    <div className="grid grid-cols-3 gap-2">
                      <span className="rounded-lg border border-[#e4e4e7] bg-white p-2 text-center"><b>{todayTaskSummary.total}</b><br />việc hôm nay</span>
                      <span className="rounded-lg border border-[#b9e8ca] bg-white p-2 text-center"><b>{todayTaskSummary.done}</b><br />đã xong</span>
                      <span className="rounded-lg border border-[#efd8a8] bg-white p-2 text-center"><b>{todayTaskSummary.open}</b><br />còn lại</span>
                    </div>
                    {todayTaskSummary.items.length ? (
                      <div className="grid gap-1">
                        {todayTaskSummary.items.map((item) => (
                          <span className="text-[12px] font-semibold text-[#666666]" key={`${item.kind}-${item.id}`}>{taskDate(item)} · {taskTitle(item)}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 max-[760px]:flex-col">
                <Link className="task-secondary" to="/daily-work?tab=daily">
                  <FileText size={16} />
                  Báo cáo cuối ngày
                </Link>
                <button className="task-primary gap-2 disabled:cursor-not-allowed disabled:opacity-70" disabled={savingKnowledge} onClick={() => void createKnowledgeFromTask()} type="button">
                  <Plus size={16} />
                  {savingKnowledge ? 'Đang tạo' : 'Lưu thành kinh nghiệm'}
                </button>
              </div>
            </section>

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

            <TaskUpdateFormPanel
              addInstallationEditDeviceItem={addInstallationEditDeviceItem}
              completionBlockers={selectedCompletionBlockers}
              customerFeedback={customerFeedback}
              installationDate={installationDate}
              installationEditForm={installationEditForm}
              machineModelOptions={machineModelOptions}
              nextDueDate={nextDueDate}
              onClose={() => setSelectedTask(null)}
              onSubmit={handleSubmit}
              removeInstallationEditDeviceItem={removeInstallationEditDeviceItem}
              resultNote={resultNote}
              saving={saving}
              setCustomerFeedback={setCustomerFeedback}
              setInstallationDate={setInstallationDate}
              setNextDueDate={setNextDueDate}
              setResultNote={setResultNote}
              setStatus={setStatus}
              status={status}
              task={selectedTask}
              updateInstallationEditDeviceItem={updateInstallationEditDeviceItem}
              updateInstallationEditForm={updateInstallationEditForm}
              user={user}
            />

            <TaskAttachmentsPanel
              attachmentDescription={attachmentDescription}
              attachmentFiles={attachmentFiles}
              attachmentTitle={attachmentTitle}
              attachmentType={attachmentType}
              attachments={attachments}
              fileInputKey={fileInputKey}
              loadingAttachments={loadingAttachments}
              onDescriptionChange={setAttachmentDescription}
              onDownload={downloadAttachment}
              onFilesChange={setAttachmentFiles}
              onTitleChange={setAttachmentTitle}
              onTypeChange={setAttachmentType}
              onUpload={() => void handleAttachmentUpload()}
              onView={(attachment) => void viewAttachment(attachment)}
              task={selectedTask}
              uploadingAttachment={uploadingAttachment}
            />
          </aside>
        </div>
      ) : null}
    </PageFrame>
  );
}

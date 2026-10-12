import { CalendarDays, Clock3, FileText, Loader2, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages, getApiBaseUrl, getToken } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { EngineerTaskDrawer } from './components/EngineerTaskDrawer';
import { EngineerWorkspacePanel } from './components/EngineerWorkspacePanel';
import { attachmentOptionsByKind } from './constants';
import type {
  AttachmentType,
  BusinessTab,
  ComponentAccessoryOption,
  CreateTicketForm,
  DailyWorkNote,
  EngineerTask,
  InstallationTask,
  KindFilter,
  MaintenanceTask,
  RepairTask,
  TaskAttachment,
  TaskFilter,
  WorkOperationsResponse,
} from './types';
import {
  addDays,
  buildStructuredEngineerNote,
  buildInstallationEditForm,
  compareTasks,
  createTicketHrefForTab,
  createTicketLabelForTab,
  emptyCreateTicketForm,
  engineerChecklistForTask,
  entityTypeForTask,
  formatDailyWorkDate,
  isOverdueTask,
  isTodayTask,
  isUpcomingTask,
  needsMachineProfile,
  matchesFilter,
  groupTasksByDate,
  materialRowsToText,
  matchesBusinessTab,
  parseMaterialRows,
  parseWorkLogRows,
  profileCompletenessForTask,
  splitLines,
  sameMachineHistory,
  startOfDay,
  startOfWeek,
  taskCustomer,
  taskDescription,
  taskKindLabel,
  taskModelText,
  taskPrimaryMachineName,
  taskAddressForMap,
  taskTitle,
  toDateInput,
  workLogRowsToText,
} from './utils';
import './styles.css';

type EngineerDemoLoan = {
  id: string;
  code: string;
  ticketCode?: string | null;
  status: 'PLANNED' | 'HANDED_OVER' | 'OVERDUE' | 'RETURNED' | 'CANCELLED';
  handedOverAt?: string | null;
  customer?: { name?: string | null; hospitalName?: string | null } | null;
  machine?: { machineCode?: string | null; name?: string | null; modelName?: string | null; serialNumber?: string | null } | null;
  engineer?: { id: string } | null;
  assignments?: Array<{ engineer: { id: string } }>;
};

export function EngineerTasksPage({ user }: { user: ApiUser }) {
  const [tasks, setTasks] = useState<EngineerTask[]>([]);
  const [demoLoans, setDemoLoans] = useState<EngineerDemoLoan[]>([]);
  const [loadingDemos, setLoadingDemos] = useState(true);
  const [confirmingDemo, setConfirmingDemo] = useState('');
  const [dailyWorkNotes, setDailyWorkNotes] = useState<DailyWorkNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDailyWork, setLoadingDailyWork] = useState(true);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TaskFilter>('action');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [businessTab, setBusinessTab] = useState<BusinessTab>('all');
  const [selectedTask, setSelectedTask] = useState<EngineerTask | null>(null);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [attachmentType, setAttachmentType] = useState<AttachmentType>('MACHINE_PHOTO');
  const [attachmentTitle, setAttachmentTitle] = useState('');
  const [attachmentDescription, setAttachmentDescription] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [resultNote, setResultNote] = useState('');
  const [customerFeedback, setCustomerFeedback] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [checkedChecklist, setCheckedChecklist] = useState<Record<string, boolean>>({});
  const [materialsText, setMaterialsText] = useState('');
  const [accessoryOptions, setAccessoryOptions] = useState<ComponentAccessoryOption[]>([]);
  const [loadingAccessoryOptions, setLoadingAccessoryOptions] = useState(false);
  const [workLogText, setWorkLogText] = useState('');
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [installationEditForm, setInstallationEditForm] = useState<CreateTicketForm>(() => emptyCreateTicketForm('installation'));

  useEffect(() => {
    loadTasks();
    loadDemoLoans();
    loadDailyWorkNotes();
  }, [user.id]);

  const demoGroups = useMemo(() => {
    const groups = new Map<string, EngineerDemoLoan[]>();
    demoLoans.forEach((loan) => {
      const code = loan.ticketCode || loan.code;
      groups.set(code, [...(groups.get(code) ?? []), loan]);
    });
    return [...groups.entries()].map(([ticketCode, loans]) => ({ ticketCode, loans }));
  }, [demoLoans]);
  const monthlyDemoCount = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return new Set(demoLoans.filter((loan) => {
      const assigned = loan.engineer?.id === user.id || loan.assignments?.some((assignment) => assignment.engineer.id === user.id);
      return assigned && loan.handedOverAt && new Date(loan.handedOverAt) >= monthStart;
    }).map((loan) => loan.ticketCode || loan.code)).size;
  }, [demoLoans, user.id]);

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
        apiFetchAllPages<RepairTask>(`/repairs?engineerId=${encodeURIComponent(user.id)}`),
        apiFetchAllPages<MaintenanceTask>(`/maintenance?engineerId=${encodeURIComponent(user.id)}`),
        apiFetchAllPages<InstallationTask>(`/installations?installedById=${encodeURIComponent(user.id)}`),
      ]);

      setTasks([
        ...repairs.map((task) => ({ ...task, kind: 'repair' as const })),
        ...maintenances.map((task) => ({ ...task, kind: 'maintenance' as const })),
        ...installations.map((task) => ({ ...task, kind: 'installation' as const })),
      ].sort(compareTasks));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được việc được giao.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDemoLoans() {
    setLoadingDemos(true);
    try {
      setDemoLoans(await apiFetchAllPages<EngineerDemoLoan>('/demo-loans'));
    } catch {
      setDemoLoans([]);
    } finally {
      setLoadingDemos(false);
    }
  }

  async function confirmDemoHandover(group: { ticketCode: string; loans: EngineerDemoLoan[] }) {
    setConfirmingDemo(group.ticketCode);
    setError('');
    setSuccess('');
    try {
      await Promise.all(group.loans.filter((loan) => loan.status === 'PLANNED').map((loan) => apiFetch(`/demo-loans/${loan.id}/handover`, {
        method: 'POST',
        body: JSON.stringify({ occurredAt: new Date().toISOString() }),
      })));
      setSuccess(`Đã xác nhận bàn giao phiếu ${group.ticketCode}.`);
      await loadDemoLoans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xác nhận được bàn giao máy demo.');
    } finally {
      setConfirmingDemo('');
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
      setResultNote(task.note || '');
      setCustomerFeedback('');
      setNextDueDate('');
      setInstallationEditForm(buildInstallationEditForm(task));
      setError('');
      setSuccess('');
      return;
    }
    setResultNote(task.resultNote || '');
    setCustomerFeedback(task.kind === 'repair' ? task.customerFeedback || '' : '');
    setNextDueDate(task.kind === 'maintenance' && task.nextDueDate ? task.nextDueDate.slice(0, 10) : '');
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
      accessory.component?.name ? `Nhóm: ${accessory.component.name}` : '',
      accessory.machineModel?.code ? `Model: ${accessory.machineModel.code}` : '',
    ].filter(Boolean).join('; ');
    const line = [accessory.name, String(accessory.quantity || 1), '', String(accessory.salePrice || ''), note].join(' | ');

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

  async function saveSelectedWorkOperations() {
    if (!selectedTask) return;

    setSavingWorkspace(true);
    setError('');
    setSuccess('');

    try {
      await syncWorkOperations(selectedTask);
      setSuccess('Đã lưu checklist, vật tư và nhật ký xử lý.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được bàn làm việc kỹ sư.');
    } finally {
      setSavingWorkspace(false);
    }
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
        credentials: 'include',
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
        credentials: 'include',
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
          note: `Tạo từ phiếu ${selectedTask.code}. Chờ quản trị viên phê duyệt trước khi xuất bản trong thư viện kinh nghiệm.`,
        }),
      });
      setSuccess('Đã tạo bản nháp kinh nghiệm kỹ thuật, chờ quản trị viên phê duyệt.');
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
        </div>
        <div className="engineer-task-hero__actions">
          <button className="secondary-button" onClick={() => void loadTasks()} type="button">
            {loading ? <Loader2 className="spin-icon" size={16} /> : <Clock3 size={16} />}
            Làm mới
          </button>
          <Link className="primary-button" to={createTicketHrefForTab(businessTab)}>
            <Plus size={16} />
            {createTicketLabelForTab(businessTab)}
          </Link>
        </div>
      </section>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="engineer-focus-strip" aria-label="Lối tắt công việc">
        <button onClick={() => focusTaskList('today')} type="button">
          <strong>{taskStats.today}</strong>
          <span>Hôm nay</span>
        </button>
        <button onClick={() => focusTaskList('revision')} type="button">
          <strong>{taskStats.revision}</strong>
          <span>Cần bổ sung</span>
        </button>
        <button onClick={() => focusTaskList('overdue')} type="button">
          <strong>{taskStats.overdue}</strong>
          <span>Quá hạn</span>
        </button>
        <Link to="/daily-work">
          <CalendarDays size={16} />
          Lịch công tác
        </Link>
        <Link to={`/weekly-reports?weekStart=${toDateInput(startOfWeek(new Date()))}`}>
          <FileText size={16} />
          Báo cáo tuần
        </Link>
      </section>

      <section className="grid gap-4 rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07),0_12px_30px_rgba(24,24,27,0.05)]">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8f1d2c]">Phiếu demo được giao</span>
            <h2 className="mt-1 text-xl font-semibold text-[#202124]">Lịch demo và bàn giao thiết bị</h2>
          </div>
          <div className="rounded-xl bg-[#f7f5f2] px-4 py-2 text-sm text-[#667085]">Tháng này <strong className="ml-1 text-[#202124]">{monthlyDemoCount}</strong> lượt demo</div>
        </header>
        {loadingDemos ? <p className="text-sm text-[#667085]">Đang tải phiếu demo…</p> : null}
        {!loadingDemos && !demoGroups.length ? <p className="rounded-xl border border-dashed border-[#d8dce2] p-4 text-sm text-[#667085]">Chưa có phiếu demo được giao cho bạn.</p> : null}
        <div className="grid gap-2">
          {demoGroups.map((group) => {
            const assigned = group.loans.some((loan) => loan.engineer?.id === user.id || loan.assignments?.some((assignment) => assignment.engineer.id === user.id));
            if (!assigned) return null;
            const waiting = group.loans.filter((loan) => loan.status === 'PLANNED');
            const customer = group.loans.find((loan) => loan.customer)?.customer;
            return (
              <article className="grid gap-3 rounded-2xl bg-[#faf9f7] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={group.ticketCode}>
                <div className="grid gap-1">
                  <strong className="text-sm text-[#202124]">{group.ticketCode} · {customer?.hospitalName || customer?.name || 'Chưa gắn khách hàng'}</strong>
                  <span className="text-sm text-[#667085]">{group.loans.map((loan) => loan.machine?.machineCode || loan.machine?.modelName || loan.machine?.name || loan.machine?.serialNumber || 'Thiết bị').join(' · ')}</span>
                  <span className="text-xs text-[#667085]">{group.loans.length} thiết bị · {waiting.length ? 'Chờ xác nhận bàn giao' : 'Đã bàn giao'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className="secondary-button compact" to="/service-tickets?type=demo">Mở phiếu</Link>
                  {waiting.length ? <button className="primary-button compact" disabled={confirmingDemo === group.ticketCode} onClick={() => void confirmDemoHandover(group)} type="button">{confirmingDemo === group.ticketCode ? <Loader2 className="spin-icon" size={15} /> : null}Xác nhận bàn giao</button> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <EngineerWorkspacePanel
        businessTab={businessTab}
        businessTabCounts={businessTabCounts}
        filter={filter}
        groupedTasks={groupedFilteredTasks}
        kindFilter={kindFilter}
        loading={loading}
        loadingDailyWork={loadingDailyWork}
        notes={filteredDailyWorkNotes}
        onBusinessTabChange={(tab) => {
          setBusinessTab(tab);
          setKindFilter('all');
        }}
        onFilterChange={setFilter}
        onKindFilterChange={setKindFilter}
        onOpenTask={openTask}
        onQueryChange={setQuery}
        query={query}
      />

      {selectedTask ? (
        <EngineerTaskDrawer
          accessoryOptions={accessoryOptions}
          attachmentDescription={attachmentDescription}
          attachmentFiles={attachmentFiles}
          attachmentTitle={attachmentTitle}
          attachmentType={attachmentType}
          attachments={attachments}
          checkedChecklist={checkedChecklist}
          checkedChecklistLines={selectedCheckedChecklistLines}
          checklistLines={selectedChecklistLines}
          completeness={selectedCompleteness}
          fileInputKey={fileInputKey}
          loadingAccessoryOptions={loadingAccessoryOptions}
          loadingAttachments={loadingAttachments}
          mapAddress={selectedMapAddress}
          materialsText={materialsText}
          machineHistory={selectedMachineHistory}
          savingKnowledge={savingKnowledge}
          savingWorkspace={savingWorkspace}
          task={selectedTask}
          todaySummary={todayTaskSummary}
          uploadingAttachment={uploadingAttachment}
          workLogText={workLogText}
          onAppendAccessoryMaterial={appendAccessoryMaterial}
          onAttachmentDescriptionChange={setAttachmentDescription}
          onAttachmentDownload={downloadAttachment}
          onAttachmentFilesChange={setAttachmentFiles}
          onAttachmentTitleChange={setAttachmentTitle}
          onAttachmentTypeChange={setAttachmentType}
          onAttachmentUpload={() => void handleAttachmentUpload()}
          onAttachmentView={(attachment) => void viewAttachment(attachment)}
          onChecklistLineChange={toggleChecklistLine}
          onClose={() => setSelectedTask(null)}
          onCreateKnowledge={() => void createKnowledgeFromTask()}
          onMaterialsTextChange={setMaterialsText}
          onSaveWorkspace={() => void saveSelectedWorkOperations()}
          onWorkLogTextChange={setWorkLogText}
        />
      ) : null}
    </PageFrame>
  );
}

import { ClipboardCheck, PackageCheck, Wrench } from 'lucide-react';
import type { ApiUser } from '../../api';
import { displayLabel } from '../../utils/displayLabels';
import { machineModelOptionLabel } from '../../utils/machineDisplayName';
import type {
  AttachmentType,
  BusinessTab,
  DailyWorkNote,
  EngineerTask,
  InstallationDeviceItem,
  InstallationTask,
  PickerCustomer,
  PickerMachine,
  TaskFilter,
  TaskKind,
  TaskTone,
  CreateTicketForm,
  QuickMachineModel,
  TaskMachine,
} from './types';

export const todayValue = () => new Date().toISOString().slice(0, 10);

export function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function startOfWeek(value: Date) {
  const date = startOfDay(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

export function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function toDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDailyWorkDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
  }).format(date);
}

export function dayNumber(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return String(date.getDate()).padStart(2, '0');
}

export function monthLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '---';
  return `T${date.getMonth() + 1}`;
}

export function formatDailyWorkTime(note: DailyWorkNote) {
  const range = [note.startTime, note.endTime].filter(Boolean).join(' - ');
  return range || 'Cả ngày';
}

export function weeklyReportHrefForDailyWork(note: DailyWorkNote) {
  const weekStart = toDateInput(startOfWeek(new Date(note.workDate)));
  return `/weekly-reports?weekStart=${weekStart}`;
}

export function emptyInstallationDeviceItem(): InstallationDeviceItem {
  return {
    itemName: '',
    model: '',
    serialNumber: '',
    manufactureDate: '',
    quantity: 1,
    warrantyPeriod: '',
  };
}

export const emptyCreateTicketForm = (kind: TaskKind = 'repair'): CreateTicketForm => ({
  kind,
  title: '',
  description: '',
  machineId: '',
  machineCode: '',
  machineModelId: '',
  customerId: '',
  priority: 'NORMAL',
  maintenanceType: 'PERIODIC',
  workDate: todayValue(),
  nextDueDate: '',
  warrantyEndDate: '',
  checklist: '',
  accessories: '',
  usingDepartment: '',
  representative: '',
  address: '',
  contactPhone: '',
  deviceName: '',
  modelName: '',
  serialNumber: '',
  warrantyStatus: 'IN_WARRANTY',
  conditionAssessment: '',
  repairMethod: '',
  handoverInstallerName: '',
  handoverInstallerPosition: '',
  handoverVehicle: '',
  handoverDepartureDate: todayValue(),
  receiverInstallAddress: '',
  receiverRepresentative: '',
  receiverPosition: '',
  receiverPhone: '',
  installedDeviceItems: [emptyInstallationDeviceItem()],
  deviceCondition: 'NEW_100',
  deviceConditionNote: '',
});

export function compareTasks(a: EngineerTask, b: EngineerTask) {
  return taskSortDate(b).getTime() - taskSortDate(a).getTime();
}

function taskSortDate(task: EngineerTask) {
  const value = taskDateValue(task);
  return value ? new Date(value) : new Date(0);
}

export function taskDate(task: EngineerTask) {
  const value = taskDateValue(task);
  if (!value) return task.kind === 'repair' ? 'Chưa có ngày báo' : 'Chưa có lịch';
  return formatDate(value);
}

export function taskDateValue(task: EngineerTask) {
  if (task.kind === 'repair') return task.reportedAt;
  if (task.kind === 'maintenance') return task.scheduledDate;
  return task.installedAt;
}

export function taskTitle(task: EngineerTask) {
  if (task.kind === 'installation') return `Lắp đặt ${installationPrimaryName(task)}${installationExtraCount(task) ? ` + ${installationExtraCount(task)} thiết bị` : ''}`;
  return task.title;
}

export function taskDescription(task: EngineerTask) {
  if (task.kind === 'installation') return task.note || 'Kiểm tra serial, phụ kiện, tình trạng thiết bị và nghiệm thu lắp đặt.';
  return task.description;
}

export function taskCustomer(task: EngineerTask) {
  if (task.kind === 'installation') return task.customer?.name || task.machine?.customer?.name;
  if (task.kind === 'repair') return task.usingDepartment || task.machine?.customer?.name;
  if (task.kind === 'maintenance') return task.usingDepartment || task.machine?.customer?.name;
  return undefined;
}

export function taskModelText(task: EngineerTask) {
  if (task.kind === 'installation') return task.machine?.modelName || task.plannedMachineModel?.name || task.plannedModelName;
  if (task.kind === 'repair' || task.kind === 'maintenance') return task.modelName || task.deviceName;
  return undefined;
}

export function taskSerialText(task: EngineerTask) {
  if (task.kind === 'installation') return task.machine?.serialNumber;
  return task.kind === 'repair' || task.kind === 'maintenance' ? task.serialNumber : undefined;
}

export function needsMachineProfile(task: EngineerTask) {
  return (task.kind === 'repair' || task.kind === 'maintenance') && !task.machine;
}

export function createTicketTitle(kind: TaskKind) {
  if (kind === 'repair') return 'Phiếu sửa chữa tại chỗ';
  if (kind === 'maintenance') return 'Phiếu bảo trì';
  return 'Phiếu lắp đặt';
}

export function warrantyStatusLabel(value?: string | null) {
  if (value === 'IN_WARRANTY') return 'Còn bảo hành';
  if (value === 'OUT_OF_WARRANTY') return 'Hết bảo hành';
  return '-';
}

export function deviceConditionLabel(value?: string | null, note?: string | null) {
  if (value === 'NEW_100') return 'Mới 100%';
  if (value === 'OTHER') return note || 'Khác';
  return '-';
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN').format(date);
}

export function taskKindLabel(kind: TaskKind) {
  if (kind === 'repair') return 'Sửa chữa';
  if (kind === 'maintenance') return 'Bảo trì';
  return 'Lắp đặt';
}

export function entityTypeForTask(kind: TaskKind) {
  if (kind === 'repair') return 'Repair';
  if (kind === 'maintenance') return 'Maintenance';
  return 'MachineInstallation';
}

export function taskIcon(kind: TaskKind) {
  if (kind === 'repair') return <Wrench size={18} />;
  if (kind === 'maintenance') return <ClipboardCheck size={18} />;
  return <PackageCheck size={18} />;
}

export function matchesFilter(task: EngineerTask, filter: TaskFilter) {
  const isTerminal = ['COMPLETED', 'CANCELLED', 'INSTALLED'].includes(task.status);
  if (filter === 'all') return true;
  if (filter === 'action') return task.reviewStatus === 'NEEDS_REVISION' || (!isTerminal && task.reviewStatus !== 'PENDING');
  if (filter === 'today') return isTodayTask(task);
  if (filter === 'overdue') return isOverdueTask(task);
  if (filter === 'review') return task.reviewStatus === 'PENDING';
  if (filter === 'revision') return task.reviewStatus === 'NEEDS_REVISION';
  if (filter === 'done') return isTerminal;
  if (filter === 'progress') return ['IN_PROGRESS', 'WAITING_PARTS'].includes(task.status);
  return !isTerminal;
}

export function isTodayTask(task: EngineerTask) {
  const value = taskDateValue(task);
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export function isOverdueTask(task: EngineerTask) {
  const value = taskDateValue(task);
  if (!value || ['COMPLETED', 'CANCELLED', 'INSTALLED'].includes(task.status)) return false;
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export function isUpcomingTask(task: EngineerTask) {
  const value = taskDateValue(task);
  if (!value || ['COMPLETED', 'CANCELLED', 'INSTALLED'].includes(task.status)) return false;
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  return date >= today && date <= nextWeek;
}

export function nextDefaultStatus(task: EngineerTask) {
  if (task.status === 'ASSIGNED' || task.status === 'SCHEDULED' || task.status === 'OVERDUE') return 'IN_PROGRESS';
  if (task.kind === 'repair' && task.status === 'WAITING_PARTS') return 'IN_PROGRESS';
  return task.status === 'IN_PROGRESS' ? 'COMPLETED' : 'IN_PROGRESS';
}

export function statusLabel(value: string) {
  return displayLabel(value);
}

export function reviewStatusLabel(value?: string | null) {
  if (value === 'PENDING') return 'Chờ admin xác nhận';
  if (value === 'APPROVED') return 'Admin đã xác nhận';
  if (value === 'NEEDS_REVISION') return 'Cần bổ sung';
  return '';
}

export function reviewStatusTone(value?: string | null): TaskTone {
  if (value === 'APPROVED') return 'good';
  if (value === 'NEEDS_REVISION') return 'danger';
  if (value === 'PENDING') return 'warn';
  return 'neutral';
}

function priorityLabel(value: string) {
  return displayLabel(value);
}

function maintenanceTypeLabel(value: string) {
  return displayLabel(value);
}

export function statusTone(value: string): TaskTone {
  if (['COMPLETED', 'INSTALLED'].includes(value)) return 'good';
  if (['CANCELLED', 'OVERDUE', 'URGENT'].includes(value)) return 'danger';
  if (['IN_PROGRESS', 'WAITING_PARTS', 'ASSIGNED', 'SCHEDULED'].includes(value)) return 'warn';
  return 'neutral';
}

function priorityTone(value: string): TaskTone {
  if (value === 'URGENT') return 'danger';
  if (value === 'HIGH') return 'warn';
  if (value === 'LOW') return 'neutral';
  return 'good';
}

export function secondaryLabel(task: EngineerTask) {
  if (task.kind === 'repair') return priorityLabel(task.priority);
  if (task.kind === 'maintenance') return maintenanceTypeLabel(task.type);
  return `${task.accessories?.length || 0} phụ kiện`;
}

export function secondaryTone(task: EngineerTask): TaskTone {
  if (task.kind === 'repair') return priorityTone(task.priority);
  return 'neutral';
}

export function attachmentTypeLabel(value: AttachmentType) {
  const labels: Record<AttachmentType, string> = {
    ERROR_PHOTO: 'Ảnh lỗi',
    MACHINE_PHOTO: 'Ảnh thiết bị',
    HANDOVER_MINUTES: 'Biên bản bàn giao',
    MAINTENANCE_FORM: 'Phiếu bảo trì',
    PART_INVOICE: 'Chứng từ linh kiện',
    ACCEPTANCE_PDF: 'Biên bản nghiệm thu',
    OTHER: 'Tài liệu khác',
  };
  return labels[value] || value;
}

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function splitLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeInstallationDeviceItems(items: InstallationDeviceItem[]) {
  return items
    .map((item) => ({
      itemName: item.itemName.trim(),
      model: item.model.trim() || undefined,
      serialNumber: item.serialNumber.trim() || undefined,
      manufactureDate: item.manufactureDate || undefined,
      quantity: Number(item.quantity) || 1,
      warrantyPeriod: item.warrantyPeriod.trim() || undefined,
    }))
    .filter((item) => item.itemName);
}

export function canEngineerSeeModel(user: ApiUser, model: QuickMachineModel) {
  void user;
  void model;
  return true;
}

export function quickModelLabel(model: QuickMachineModel) {
  return machineModelOptionLabel(model) || model.code || model.displayName || model.name || 'Model';
}

export function canEngineerSeeMachine(user: ApiUser, machine: TaskMachine) {
  const expertiseGroup = user.engineerProfile?.expertiseGroup;
  if (!expertiseGroup) return true;
  const machineGroup = machine.businessLine?.productIndustry?.expertiseGroup ?? machine.businessLine?.expertiseGroup;
  return !machineGroup || machineGroup === expertiseGroup;
}

export function groupTasksByDate(tasks: EngineerTask[]) {
  const groups = new Map<string, EngineerTask[]>();

  tasks.forEach((task) => {
    const key = taskDateGroupKey(task);
    groups.set(key, [...(groups.get(key) ?? []), task]);
  });

  return Array.from(groups.entries())
    .sort(([left], [right]) => compareTaskGroupKeys(left, right))
    .map(([key, items]) => ({
      key,
      label: key === '__missing__' ? 'Chưa có ngày hẹn' : formatDate(key),
      items: items.sort(compareTasks),
    }));
}

function taskDateGroupKey(task: EngineerTask) {
  const value = taskDateValue(task);
  if (!value) return '__missing__';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '__missing__';
  return date.toISOString().slice(0, 10);
}

function compareTaskGroupKeys(left: string, right: string) {
  if (left === '__missing__') return 1;
  if (right === '__missing__') return -1;
  return right.localeCompare(left);
}

export function machinePickerLabel(machine: PickerMachine) {
  return [machine.machineCode, machine.serialNumber ? `S/N ${machine.serialNumber}` : '', machine.modelName || machine.name, machine.customer?.name]
    .filter(Boolean)
    .join(' - ');
}

export function machinePickerEndpoint(kind: TaskKind) {
  const inventoryStatus = kind === 'installation' ? 'IN_STOCK' : 'INSTALLED';
  return `/machines?limit=20&inventoryStatus=${inventoryStatus}`;
}

export function isMachineEligibleForTicket(kind: TaskKind, machine: PickerMachine) {
  if (!machine.inventoryStatus) return true;
  return kind === 'installation' ? machine.inventoryStatus === 'IN_STOCK' : machine.inventoryStatus === 'INSTALLED';
}

export function customerPickerLabel(customer: PickerCustomer) {
  return [customer.customerCode, customer.name, customer.province, customer.phone].filter(Boolean).join(' - ');
}

export function isEngineerUser(user: ApiUser) {
  return user.roleName === 'engineer' || user.role?.name === 'engineer' || user.role?.name === 'kỹ sư';
}

export function matchesBusinessTab(task: EngineerTask, tab: BusinessTab) {
  if (tab === 'all') {
    return true;
  }

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

export function buildInstallationEditForm(task: InstallationTask): CreateTicketForm {
  const installedAt = task.installedAt ? task.installedAt.slice(0, 10) : '';
  const warrantyStartDate = (task.warrantyStartDate || task.warrantyCard?.startDate)?.slice(0, 10) || installedAt;
  const warrantyEndDate = (task.warrantyEndDate || task.warrantyCard?.endDate)?.slice(0, 10) || '';
  const extraDeviceItems = installationExtraItems(task);
  const installedDeviceItems = extraDeviceItems.length
    ? extraDeviceItems.map((item) => ({
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
    description: task.warrantyNote || task.warrantyCard?.note || '',
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

export function defaultCreateKindForBusinessTab(tab: BusinessTab): TaskKind {
  if (tab === 'installation') return 'installation';
  if (tab === 'maintenance') return 'maintenance';
  return 'repair';
}

export function taskAttention(task: EngineerTask): { label: string; tone: TaskTone } {
  if (task.reviewStatus === 'NEEDS_REVISION') return { label: 'Bổ sung theo phản hồi admin', tone: 'danger' };
  if (isOverdueTask(task)) return { label: 'Quá hạn, xử lý trước', tone: 'danger' };
  if (needsMachineProfile(task)) return { label: 'Tạo hoặc bổ sung hồ sơ máy', tone: 'warn' };
  if (isTodayTask(task)) return { label: 'Việc hôm nay', tone: 'warn' };
  if (task.reviewStatus === 'PENDING') return { label: 'Đã gửi, chờ admin duyệt', tone: 'good' };
  if (['COMPLETED', 'CANCELLED', 'INSTALLED'].includes(task.status)) return { label: 'Đã hoàn tất', tone: 'neutral' };
  return { label: 'Cập nhật kết quả hiện trường', tone: 'neutral' };
}

export function taskUpdateHref(task: EngineerTask) {
  if (task.kind === 'installation') return `/installations/${task.id}/update?returnTo=/my-tasks`;
  if (task.kind === 'repair') return `/repairs/${task.id}/update?returnTo=/my-tasks`;
  if (task.kind === 'maintenance') return `/maintenance/${task.id}/update?returnTo=/my-tasks`;
  return '';
}

export function taskPrimaryMachineName(task: EngineerTask) {
  if (task.kind === 'installation') {
    return installationPrimaryName(task);
  }

  return task.deviceName || task.machine?.modelName || task.modelName || 'Chưa có tên thiết bị';
}

function installationPrimaryName(task: InstallationTask) {
  return (
    task.machine?.name ||
    task.machine?.modelName ||
    task.machine?.machineCode ||
    task.plannedMachineModel?.displayName ||
    task.plannedMachineModel?.name ||
    task.plannedModelName ||
    task.installedDeviceItems?.find((item) => item.itemName || item.model || item.serialNumber)?.itemName ||
    task.code ||
    'Chưa có tên thiết bị'
  );
}

function installationExtraCount(task: InstallationTask) {
  return installationExtraItems(task).filter((item) => item.itemName || item.model || item.serialNumber).length;
}

export function installationExtraItems(task: InstallationTask) {
  return (task.installedDeviceItems || []).filter((item) => !isInstallationMainMachineItem(task, item));
}

function isInstallationMainMachineItem(task: InstallationTask, item: InstallationDeviceItem) {
  const machineSerial = task.machine?.serialNumber?.trim().toLowerCase();
  const itemSerial = item.serialNumber?.trim().toLowerCase();
  if (machineSerial && itemSerial && machineSerial === itemSerial) return true;

  const itemName = item.itemName?.trim().toLowerCase();
  const itemModel = item.model?.trim().toLowerCase();
  const mainNames = [
    task.machine?.name,
    task.machine?.modelName,
    task.machine?.machineCode,
    task.plannedMachineModel?.displayName,
    task.plannedMachineModel?.name,
    task.plannedModelName,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  return !itemSerial && mainNames.some((value) => value && (value === itemName || value === itemModel));
}

export function taskContactPhone(task: EngineerTask) {
  if (task.kind === 'installation') return task.receiverPhone || '';
  return task.contactPhone || '';
}

export function taskLocation(task: EngineerTask) {
  if (task.kind === 'installation') return task.receiverInstallAddress || task.customer?.province || task.machine?.customer?.province || '';
  return task.address || task.machine?.customer?.province || '';
}

export function taskPriorityScore(task: EngineerTask) {
  let score = 0;
  if (task.reviewStatus === 'NEEDS_REVISION') score += 140;
  if (task.reviewStatus === 'PENDING') score += 10;
  if (isOverdueTask(task)) score += 100;
  if (isTodayTask(task)) score += 50;
  if (needsMachineProfile(task)) score += 30;
  if (task.kind === 'repair' && task.priority === 'URGENT') score += 25;
  if (task.kind === 'repair' && task.priority === 'HIGH') score += 15;
  return score;
}

export function taskActionLabel(task: EngineerTask) {
  if (task.reviewStatus === 'NEEDS_REVISION') return 'Cần bổ sung báo cáo';
  if (task.reviewStatus === 'PENDING') return 'Chờ admin xác nhận';
  if (isOverdueTask(task)) return 'Cần xử lý ngay';
  if (isTodayTask(task)) return 'Cần làm hôm nay';
  if (needsMachineProfile(task)) return 'Cần tạo hồ sơ máy';
  if (['ASSIGNED', 'SCHEDULED', 'PENDING'].includes(task.status)) return 'Cần bắt đầu';
  if (['IN_PROGRESS', 'WAITING_PARTS'].includes(task.status)) return 'Cần cập nhật kết quả';
  if (['COMPLETED', 'INSTALLED'].includes(task.status)) return 'Đã hoàn tất';
  return 'Theo dõi';
}

export function taskUpdatePanelTitle(task: EngineerTask) {
  if (task.kind === 'installation') return 'Hoàn thiện bàn giao và bảo hành';
  if (task.kind === 'maintenance') return 'Ghi nhận kết quả bảo trì';
  return 'Ghi nhận kết quả sửa chữa';
}

export function taskActionTextClass(task: EngineerTask) {
  if (task.reviewStatus === 'NEEDS_REVISION' || isOverdueTask(task)) return 'text-[#b5121b]';
  if (task.reviewStatus === 'PENDING' || needsMachineProfile(task)) return 'text-[#9b5a17]';
  if (['COMPLETED', 'INSTALLED'].includes(task.status)) return 'text-[#177245]';
  return 'text-[#18181b]';
}

export function createTicketHrefForTab(tab: BusinessTab) {
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

export function createTicketLabelForTab(tab: BusinessTab) {
  if (tab === 'installation') return 'Tạo phiếu lắp đặt';
  if (tab === 'maintenance') return 'Tạo phiếu bảo trì';
  if (tab === 'warranty') return 'Tạo phiếu bảo hành';
  return 'Tạo phiếu sửa chữa';
}

import { ClipboardCheck, PackageCheck, Wrench } from 'lucide-react';
import { displayLabel } from '../../utils/displayLabels';
import type { AttachmentType, EngineerTask, InstallationDeviceItem, TaskFilter, TaskKind, TaskTone, CreateTicketForm } from './types';

export const todayValue = () => new Date().toISOString().slice(0, 10);

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
  return taskSortDate(a).getTime() - taskSortDate(b).getTime();
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
  if (task.kind === 'installation') return `Lắp đặt ${task.machine?.modelName || task.plannedMachineModel?.name || task.plannedModelName || task.machine?.machineCode || task.code}`;
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
  if (filter === 'all') return true;
  if (filter === 'done') return ['COMPLETED', 'CANCELLED'].includes(task.status);
  if (filter === 'progress') return ['IN_PROGRESS', 'WAITING_PARTS'].includes(task.status);
  return !['COMPLETED', 'CANCELLED'].includes(task.status);
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
  if (!value || ['COMPLETED', 'CANCELLED'].includes(task.status)) return false;
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

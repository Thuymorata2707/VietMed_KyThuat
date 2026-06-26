import type { CustomerMachine, CustomerSummary, MachineHistory, OpenTaskItem, TimelineItem } from './types';

export const statusLabels: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng theo dõi',
  POTENTIAL: 'Tiềm năng',
  BLACKLISTED: 'Tạm khóa',
  INSTALLED: 'Đã lắp',
  IN_STOCK: 'Trong kho',
  REPAIRING: 'Đang sửa',
  MAINTENANCE: 'Bảo trì',
  PENDING: 'Chờ xử lý',
  ASSIGNED: 'Đã phân công',
  IN_PROGRESS: 'Đang thực hiện',
  WAITING_PARTS: 'Chờ linh kiện',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  SCHEDULED: 'Đã lên lịch',
  OVERDUE: 'Quá hạn',
  IMPORT: 'Nhập kho',
  SPLIT_ACCESSORY: 'Tách phụ kiện',
  RESERVE: 'Giữ máy',
  INSTALL: 'Giao/lắp máy',
  RETURN: 'Thu hồi',
  SELL: 'Bán',
  ADJUST_STATUS: 'Điều chỉnh',
  ACCESSORY_SPLIT: 'Đã tách phụ kiện',
  RESERVED: 'Đã giữ máy',
  RETURNED: 'Đã thu hồi',
  SOLD: 'Đã bán',
};

export const categoryLabels: Record<string, string> = {
  ULTRASOUND: 'Siêu âm',
  LAB_TESTING: 'Xét nghiệm',
  BIOCHEMISTRY: 'Sinh hóa',
  IMMUNOLOGY: 'Miễn dịch',
  HEMATOLOGY: 'Huyết học',
  X_RAY: 'X-quang',
  ENDOSCOPY: 'Nội soi',
  OTHER: 'Khác',
};

export function buildTimeline(machines: CustomerMachine[], customer?: CustomerSummary | null) {
  const seen = new Set<string>();
  const machineItems = machines.flatMap((machine) => [
    ...(machine.installations ?? []).map((item): TimelineItem => ({
      id: item.id,
      kind: 'installation',
      title: item.code ? `Lắp đặt ${item.code}` : 'Lắp đặt máy',
      machine,
      date: item.installedAt,
      status: item.status,
      note: item.warrantyCard?.endDate ? `Bảo hành đến ${formatDate(item.warrantyCard.endDate)}` : item.description,
      person: item.installedBy?.fullName,
    })),
    ...(machine.repairs ?? []).map((item): TimelineItem => ({
      id: item.id,
      kind: 'repair',
      title: item.title || item.code || 'Sửa chữa',
      machine,
      date: item.reportedAt || item.completedAt,
      status: item.status,
      note: item.resultNote || item.description,
      person: item.engineer?.fullName,
    })),
    ...(machine.maintenances ?? []).map((item): TimelineItem => ({
      id: item.id,
      kind: 'maintenance',
      title: item.title || item.code || 'Bảo trì',
      machine,
      date: item.scheduledDate || item.completedAt,
      status: item.status,
      note: item.resultNote || item.description,
      person: item.engineer?.fullName,
    })),
    ...(machine.inventoryMovements ?? []).map((item): TimelineItem => ({
      id: item.id,
      kind: 'inventory',
      title: item.code ? `Kho máy ${item.code}` : 'Biến động kho máy',
      machine,
      date: item.occurredAt,
      status: item.toStatus || item.type,
      note: [displayStatus(item.type), item.note, item.fromStatus && item.toStatus ? `${displayStatus(item.fromStatus)} -> ${displayStatus(item.toStatus)}` : ''].filter(Boolean).join(' - '),
      person: item.createdBy?.fullName,
    })),
  ]);
  const directItems: TimelineItem[] = [
    ...(customer?.directInstallations ?? []).map((item): TimelineItem => ({
      id: item.id,
      kind: 'installation',
      title: item.code ? `Lắp đặt ${item.code}` : 'Lắp đặt máy',
      machineLabel: directMachineLabel(item),
      date: item.installedAt,
      status: item.status,
      note: item.warrantyCard?.endDate ? `Bảo hành đến ${formatDate(item.warrantyCard.endDate)}` : item.description,
      person: item.installedBy?.fullName,
    })),
    ...(customer?.directRepairs ?? []).map((item): TimelineItem => ({
      id: item.id,
      kind: 'repair',
      title: item.title || item.code || 'Sửa chữa',
      machineLabel: directMachineLabel(item),
      date: item.reportedAt || item.completedAt,
      status: item.status,
      note: item.resultNote || item.description,
      person: item.engineer?.fullName,
    })),
    ...(customer?.directMaintenances ?? []).map((item): TimelineItem => ({
      id: item.id,
      kind: 'maintenance',
      title: item.title || item.code || 'Bảo trì',
      machineLabel: directMachineLabel(item),
      date: item.scheduledDate || item.completedAt,
      status: item.status,
      note: item.resultNote || item.description,
      person: item.engineer?.fullName,
    })),
  ];

  return [...machineItems, ...directItems]
    .filter((item) => {
      const key = `${item.kind}-${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 30);
}

export function buildOpenTasks(machines: CustomerMachine[], customer: CustomerSummary | null, isAdminProfile: boolean): OpenTaskItem[] {
  const returnTo = encodeURIComponent(isAdminProfile && customer ? `/customers/profile?customerId=${customer.id}` : '/my-customers');
  return buildTimeline(machines, customer)
    .filter((item) => item.kind !== 'inventory' && !isClosedStatus(item.status))
    .slice(0, 8)
    .map((item) => ({
      ...item,
      href:
        item.kind === 'installation'
          ? `/installations/${item.id}/update?returnTo=${returnTo}`
          : item.kind === 'maintenance'
            ? `/maintenance/${item.id}/update?returnTo=${returnTo}`
            : `/repairs/${item.id}/update?returnTo=${returnTo}`,
    }));
}

export function countUnique(items: Array<{ id: string }>) {
  return new Set(items.map((item) => item.id)).size;
}

export function taskKindLabel(kind: TimelineItem['kind']) {
  if (kind === 'installation') return 'Lắp đặt';
  if (kind === 'maintenance') return 'Bảo trì';
  if (kind === 'repair') return 'Sửa chữa';
  return 'Kho máy';
}

export function machineTitle(machine: CustomerMachine) {
  return [machine.machineCode, machine.modelName || machine.name].filter(Boolean).join(' - ') || machine.serialNumber || 'Máy chưa đặt tên';
}

export function displayStatus(status?: string | null) {
  if (!status) return '-';
  return statusLabels[status] || status;
}

export function normalizeAccessoryList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          return String(record.name || record.itemName || record.code || '');
        }
        return '';
      })
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split('\n').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
}

function isClosedStatus(status?: string | null) {
  return ['APPROVED', 'CANCELLED', 'COMPLETED', 'INSTALLED'].includes(status || '');
}

function directMachineLabel(item: MachineHistory) {
  return [
    item.machine?.machineCode,
    item.machine?.modelName || item.plannedMachineModel?.displayName || item.plannedMachineModel?.name || item.deviceName || item.modelName,
    item.machine?.serialNumber || item.serialNumber ? `S/N ${item.machine?.serialNumber || item.serialNumber}` : '',
    item.businessLine?.productIndustry?.name,
  ]
    .filter(Boolean)
    .join(' - ');
}

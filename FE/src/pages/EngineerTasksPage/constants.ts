import type { AttachmentOption, BusinessTab, DailyWorkStatus, DailyWorkType, TaskKind, WeeklyReportStatus } from './types';

export const repairStatusOptions = [
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'WAITING_PARTS', label: 'Chờ linh kiện' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'CANCELLED', label: 'Hủy' },
];

export const maintenanceStatusOptions = [
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'CANCELLED', label: 'Hủy' },
];

export const installationStatusOptions = [
  { value: 'PENDING', label: 'Chờ phê duyệt' },
  { value: 'INSTALLED', label: 'Đã lắp đặt' },
  { value: 'CANCELLED', label: 'Hủy' },
];

export const attachmentOptionsByKind: Record<TaskKind, AttachmentOption[]> = {
  repair: [
    { value: 'ERROR_PHOTO', label: 'Ảnh lỗi' },
    { value: 'MACHINE_PHOTO', label: 'Ảnh thiết bị' },
    { value: 'PART_INVOICE', label: 'Chứng từ linh kiện' },
    { value: 'ACCEPTANCE_PDF', label: 'Biên bản xác nhận' },
    { value: 'OTHER', label: 'Tài liệu khác' },
  ],
  maintenance: [
    { value: 'MAINTENANCE_FORM', label: 'Phiếu bảo trì' },
    { value: 'MACHINE_PHOTO', label: 'Ảnh thiết bị' },
    { value: 'ACCEPTANCE_PDF', label: 'Biên bản nghiệm thu' },
    { value: 'OTHER', label: 'Tài liệu khác' },
  ],
  installation: [
    { value: 'MACHINE_PHOTO', label: 'Ảnh lắp đặt' },
    { value: 'HANDOVER_MINUTES', label: 'Biên bản bàn giao' },
    { value: 'ACCEPTANCE_PDF', label: 'Biên bản nghiệm thu' },
    { value: 'OTHER', label: 'Tài liệu khác' },
  ],
};

export const dailyWorkTypeLabels: Record<DailyWorkType, string> = {
  WORK: 'Công việc',
  BUSINESS_TRIP: 'Công tác',
  LEAVE: 'Nghỉ phép',
  REPAIR: 'Sửa chữa',
  INSTALLATION: 'Lắp đặt',
  MAINTENANCE: 'Bảo trì',
  OTHER: 'Khác',
};

export const dailyWorkStatusMeta: Record<DailyWorkStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Nháp', className: 'border-[#e5e5e5] bg-white text-[#666666]' },
  PENDING: { label: 'Chờ phê duyệt', className: 'border-[#efd8a8] bg-[#fffaeb] text-[#9b5a17]' },
  APPROVED: { label: 'Đã phê duyệt', className: 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]' },
  REJECTED: { label: 'Từ chối', className: 'border-[#fecdd3] bg-[#fff1f3] text-[#b5121b]' },
  CANCELLED: { label: 'Đã hủy', className: 'border-[#e5e5e5] bg-[#fafafa] text-[#666666]' },
};

export const weeklyReportStatusLabels: Record<WeeklyReportStatus | 'NONE', string> = {
  NONE: 'Chưa có',
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã gửi',
  APPROVED: 'Đã phê duyệt',
  NEEDS_REVISION: 'Cần bổ sung',
};

export const businessTabs: Array<{ value: BusinessTab; label: string }> = [
  { value: 'all', label: 'Tổng việc' },
  { value: 'repair', label: 'Sửa chữa' },
  { value: 'maintenance', label: 'Bảo trì' },
  { value: 'installation', label: 'Lắp đặt' },
  { value: 'warranty', label: 'Bảo hành' },
  { value: 'calendar', label: 'Lịch công việc' },
];

export const drawerFieldClass = 'grid gap-[7px] font-semibold text-[#333333]';
export const drawerInputClass = 'min-h-[42px] rounded-xl border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]';
export const drawerTextareaClass = `${drawerInputClass} min-h-28 resize-y py-2.5`;

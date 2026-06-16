import type { AttachmentOption, TaskKind } from './types';

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
  { value: 'PENDING', label: 'Chờ duyệt' },
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

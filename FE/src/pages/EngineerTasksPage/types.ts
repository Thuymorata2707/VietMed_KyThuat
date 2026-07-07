import type { ApiUser } from '../../api';

export type TaskKind = 'repair' | 'maintenance' | 'installation';
export type TaskTone = 'good' | 'warn' | 'danger' | 'neutral';
export type TaskFilter = 'all' | 'action' | 'open' | 'progress' | 'today' | 'overdue' | 'review' | 'revision' | 'done';
export type KindFilter = 'all' | TaskKind;
export type WorkspaceTab = 'create' | 'assigned';
export type BusinessTab = 'all' | 'repair' | 'maintenance' | 'installation' | 'warranty' | 'calendar';
export type WorkReviewStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'NEEDS_REVISION';

export type DailyWorkType = 'WORK' | 'BUSINESS_TRIP' | 'LEAVE' | 'REPAIR' | 'INSTALLATION' | 'MAINTENANCE' | 'OTHER';
export type DailyWorkStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type DailyWorkNote = {
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

export type WeeklyReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'NEEDS_REVISION';

export type WeeklyReportQuick = {
  id: string;
  weekStart: string;
  status: WeeklyReportStatus;
  submittedAt?: string | null;
  rows?: Array<{ id: string }>;
};

export type WorkReviewFields = {
  reviewStatus?: WorkReviewStatus | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  reviewer?: {
    id?: string | null;
    fullName?: string | null;
    email?: string | null;
  } | null;
};

export type TaskMachine = {
  id?: string | null;
  machineCode?: string | null;
  serialNumber?: string | null;
  modelName?: string | null;
  name?: string | null;
  productCategory?: string | null;
  customer?: {
    name?: string | null;
    province?: string | null;
  } | null;
  businessLine?: {
    expertiseGroup?: 'IMAGING' | 'LAB_TESTING' | null;
    productIndustry?: {
      code?: string | null;
      name?: string | null;
      expertiseGroup?: 'IMAGING' | 'LAB_TESTING' | null;
    } | null;
  } | null;
};

export type PickerMachine = TaskMachine & {
  id: string;
  inventoryStatus?: string | null;
  name?: string | null;
  customer?: {
    id?: string | null;
    name?: string | null;
    province?: string | null;
  } | null;
};

export type PickerCustomer = {
  id: string;
  customerCode?: string | null;
  name: string;
  phone?: string | null;
  province?: string | null;
  fullAddress?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
};

export type RepairTask = WorkReviewFields & {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  reportedAt?: string | null;
  resultNote?: string | null;
  customerFeedback?: string | null;
  usingDepartment?: string | null;
  representative?: string | null;
  address?: string | null;
  contactPhone?: string | null;
  deviceName?: string | null;
  modelName?: string | null;
  serialNumber?: string | null;
  warrantyStatus?: string | null;
  conditionAssessment?: string | null;
  repairMethod?: string | null;
  engineer?: {
    id?: string | null;
    fullName?: string | null;
    email?: string | null;
  } | null;
  createdBy?: {
    fullName?: string | null;
    email?: string | null;
  } | null;
  machine?: TaskMachine | null;
  customer?: {
    name?: string | null;
    fullAddress?: string | null;
    address?: string | null;
    contactPerson?: string | null;
    contactPhone?: string | null;
    phone?: string | null;
  } | null;
};

export type MaintenanceTask = WorkReviewFields & {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  status: string;
  type: string;
  scheduledDate?: string | null;
  nextDueDate?: string | null;
  resultNote?: string | null;
  checklist?: string[];
  engineer?: {
    id?: string | null;
    fullName?: string | null;
    email?: string | null;
  } | null;
  usingDepartment?: string | null;
  representative?: string | null;
  address?: string | null;
  contactPhone?: string | null;
  deviceName?: string | null;
  modelName?: string | null;
  serialNumber?: string | null;
  machine?: TaskMachine | null;
  customer?: {
    name?: string | null;
    fullAddress?: string | null;
    address?: string | null;
    contactPerson?: string | null;
    contactPhone?: string | null;
    phone?: string | null;
  } | null;
};

export type QuickMachineModel = {
  id: string;
  code?: string | null;
  name?: string | null;
  displayName?: string | null;
  manufacturer?: string | null;
  countryOfOrigin?: string | null;
  productCategory?: string | null;
  businessLine?: {
    name?: string | null;
    countryOfOrigin?: string | null;
    productCategory?: string | null;
    expertiseGroup?: 'IMAGING' | 'LAB_TESTING' | null;
    productIndustry?: {
      name?: string | null;
      expertiseGroup?: 'IMAGING' | 'LAB_TESTING' | null;
    } | null;
  } | null;
};

export type InstallationDeviceItem = {
  itemName: string;
  model: string;
  serialNumber: string;
  manufactureDate: string;
  quantity: number;
  warrantyPeriod: string;
};

export type InstallationTask = WorkReviewFields & {
  id: string;
  code: string;
  status: string;
  installedAt?: string | null;
  plannedModelName?: string | null;
  plannedMachineModelId?: string | null;
  plannedMachineModel?: {
    id: string;
    code?: string | null;
    name?: string | null;
    displayName?: string | null;
    manufacturer?: string | null;
  } | null;
  accessories?: string[];
  note?: string | null;
  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;
  warrantyNote?: string | null;
  handoverInstallerName?: string | null;
  handoverInstallerPosition?: string | null;
  handoverVehicle?: string | null;
  handoverDepartureDate?: string | null;
  receiverInstallAddress?: string | null;
  receiverRepresentative?: string | null;
  receiverPosition?: string | null;
  receiverPhone?: string | null;
  installedDeviceItems?: InstallationDeviceItem[];
  deviceCondition?: string | null;
  deviceConditionNote?: string | null;
  installedBy?: {
    id?: string | null;
    fullName?: string | null;
    email?: string | null;
  } | null;
  warrantyCard?: {
    startDate?: string | null;
    endDate?: string | null;
    note?: string | null;
  } | null;
  machine?: TaskMachine | null;
  customer?: {
    name?: string | null;
    province?: string | null;
    fullAddress?: string | null;
    address?: string | null;
    district?: string | null;
    ward?: string | null;
    phone?: string | null;
    contactPerson?: string | null;
    contactPosition?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
  } | null;
};

export type EngineerTask =
  | (RepairTask & { kind: 'repair' })
  | (MaintenanceTask & { kind: 'maintenance' })
  | (InstallationTask & { kind: 'installation' });

export type AttachmentType =
  | 'ERROR_PHOTO'
  | 'MACHINE_PHOTO'
  | 'HANDOVER_MINUTES'
  | 'MAINTENANCE_FORM'
  | 'PART_INVOICE'
  | 'ACCEPTANCE_PDF'
  | 'OTHER';

export type TaskAttachment = {
  id: string;
  type: AttachmentType;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  title?: string | null;
  description?: string | null;
  createdAt: string;
};

export type AttachmentOption = {
  value: AttachmentType;
  label: string;
};

export type SelectOption = {
  value: string;
  label: string;
};

export type CreateTicketForm = {
  kind: TaskKind;
  title: string;
  description: string;
  machineId: string;
  machineCode: string;
  machineModelId: string;
  customerId: string;
  priority: string;
  maintenanceType: string;
  workDate: string;
  nextDueDate: string;
  warrantyEndDate: string;
  checklist: string;
  accessories: string;
  usingDepartment: string;
  representative: string;
  address: string;
  contactPhone: string;
  deviceName: string;
  modelName: string;
  serialNumber: string;
  warrantyStatus: string;
  conditionAssessment: string;
  repairMethod: string;
  handoverInstallerName: string;
  handoverInstallerPosition: string;
  handoverVehicle: string;
  handoverDepartureDate: string;
  receiverInstallAddress: string;
  receiverRepresentative: string;
  receiverPosition: string;
  receiverPhone: string;
  installedDeviceItems: InstallationDeviceItem[];
  deviceCondition: string;
  deviceConditionNote: string;
};

export type EngineerTasksPageProps = {
  user: ApiUser;
};

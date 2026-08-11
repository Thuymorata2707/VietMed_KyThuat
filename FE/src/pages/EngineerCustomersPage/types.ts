import type { ApiUser } from '../../api';
import type { RoleName } from '../../auth/roles';

export type UserSummary = {
  id: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
};

export type EngineerOption = UserSummary & {
  region?: { id: string; name: string } | null;
};

export type CustomerSummary = {
  id: string;
  customerCode?: string | null;
  name: string;
  hospitalName?: string | null;
  customerType?: string | null;
  status?: string | null;
  phone?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  province?: string | null;
  district?: string | null;
  address?: string | null;
  fullAddress?: string | null;
  region?: { id: string; name: string } | null;
  primaryEngineer?: UserSummary | null;
  directRepairs?: MachineHistory[];
  directMaintenances?: MachineHistory[];
  directInstallations?: MachineHistory[];
  _count?: {
    machines?: number;
    machineInstallations?: number;
  };
};

export type MachineHistory = {
  id: string;
  code?: string | null;
  title?: string | null;
  status?: string | null;
  type?: string | null;
  priority?: string | null;
  reportedAt?: string | null;
  scheduledDate?: string | null;
  installedAt?: string | null;
  completedAt?: string | null;
  resultNote?: string | null;
  description?: string | null;
  engineer?: UserSummary | null;
  installedBy?: UserSummary | null;
  warrantyCard?: { endDate?: string | null } | null;
  accessories?: unknown;
  machine?: DirectMachineRef | null;
  plannedMachineModel?: {
    code?: string | null;
    name?: string | null;
    displayName?: string | null;
  } | null;
  businessLine?: {
    name?: string | null;
    productIndustry?: {
      name?: string | null;
    } | null;
  } | null;
  deviceName?: string | null;
  modelName?: string | null;
  serialNumber?: string | null;
  workLogs?: WorkOperationLog[];
  usedParts?: WorkOperationPart[];
  checklistItems?: WorkOperationChecklist[];
};

export type WorkOperationLog = {
  id?: string;
  title?: string | null;
  note?: string | null;
  stepTime?: string | null;
};

export type WorkOperationPart = {
  id?: string;
  name?: string | null;
  quantity?: string | number | null;
  unit?: string | null;
  serialNumber?: string | null;
  status?: string | null;
  note?: string | null;
};

export type WorkOperationChecklist = {
  id?: string;
  label?: string | null;
  status?: string | null;
  note?: string | null;
};

export type DirectMachineRef = {
  id?: string | null;
  machineCode?: string | null;
  serialNumber?: string | null;
  modelName?: string | null;
};

export type MachineAccessory = {
  id: string;
  code?: string | null;
  name: string;
  serialNumber?: string | null;
  description?: string | null;
  note?: string | null;
  componentAccessory?: {
    code?: string | null;
    name?: string | null;
    component?: {
      code?: string | null;
      name?: string | null;
    } | null;
  } | null;
};

export type InventoryMovement = {
  id: string;
  code?: string | null;
  type?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  occurredAt?: string | null;
  note?: string | null;
  createdBy?: UserSummary | null;
};

export type CustomerMachine = {
  id: string;
  machineCode?: string | null;
  serialNumber?: string | null;
  name?: string | null;
  modelName?: string | null;
  manufacturer?: string | null;
  productCategory?: string | null;
  status?: string | null;
  inventoryStatus?: string | null;
  installDate?: string | null;
  warrantyEndDate?: string | null;
  primaryEngineer?: UserSummary | null;
  installedBy?: UserSummary | null;
  repairs?: MachineHistory[];
  maintenances?: MachineHistory[];
  installations?: MachineHistory[];
  inventoryMovements?: InventoryMovement[];
  accessories?: MachineAccessory[];
};

export type CustomerDetail = CustomerSummary & {
  machines?: CustomerMachine[];
};

export type EngineerCustomersPageProps = {
  currentRole: RoleName;
  user: ApiUser;
};

export type TimelineItem = {
  id: string;
  kind: 'installation' | 'repair' | 'maintenance' | 'inventory';
  title: string;
  code?: string | null;
  description?: string | null;
  machine?: CustomerMachine;
  machineLabel?: string;
  date?: string | null;
  status?: string | null;
  note?: string | null;
  person?: string | null;
  priority?: string | null;
  type?: string | null;
  reportedAt?: string | null;
  scheduledDate?: string | null;
  installedAt?: string | null;
  completedAt?: string | null;
  resultNote?: string | null;
  warrantyEndDate?: string | null;
  workLogs?: WorkOperationLog[];
  usedParts?: WorkOperationPart[];
  checklistItems?: WorkOperationChecklist[];
};

export type OpenTaskItem = TimelineItem & {
  href: string;
};

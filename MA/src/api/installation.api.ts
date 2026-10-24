import { apiClient } from './client';

export type Installation = {
  id: string; code?: string; status?: string; reviewStatus?: string | null; reviewNote?: string | null; customer?: { name?: string }; customerId?: string;
  machine?: { id?: string; machineCode?: string; serialNumber?: string; name?: string; manufacturer?: string; machineModel?: { id?: string; name?: string; manufacturer?: string } };
  installedBy?: { id?: string; fullName?: string };
  installedDeviceItems?: InstallationDeviceItem[];
  installedAt?: string; receiverInstallAddress?: string; receiverRepresentative?: string; receiverPosition?: string; receiverPhone?: string; note?: string;
  warrantyStartDate?: string; warrantyEndDate?: string; warrantyNote?: string; handoverInstallerName?: string; handoverInstallerPosition?: string; handoverVehicle?: string; handoverDepartureDate?: string; deviceCondition?: string; deviceConditionNote?: string; accessories?: string[];
};
export type InstallationDeviceItem = {
  itemName: string; model?: string; serialNumber?: string; quantity?: number; isInstalled?: boolean;
  sourceMachineId?: string; manufactureDate?: string; warrantyPeriod?: string; manufacturer?: string;
  productCategory?: string; isPrimary?: boolean; engineerIds?: string[];
  accessories?: { name?: string; serialNumber?: string; quantity?: number; note?: string }[];
};
export type InstallationMachineAccessory = { name: string; serialNumber?: string; quantity?: number; note?: string };
export type InstallationPayload = {
  customerId: string; machineId?: string; installedAt?: string; installedById?: string; receiverInstallAddress?: string; receiverRepresentative?: string; receiverPosition?: string; receiverPhone?: string; note?: string;
  machineModelId?: string; plannedModelName?: string; machineSerialNumber?: string;
  machineName?: string; machineCode?: string; manufacturer?: string; productCategory?: string; warrantyStartDate?: string; warrantyEndDate?: string; warrantyNote?: string; handoverInstallerName?: string; handoverInstallerPosition?: string; handoverVehicle?: string; handoverDepartureDate?: string; deviceCondition?: string; deviceConditionNote?: string; accessories?: string[];
  installedDeviceItems?: InstallationDeviceItem[];
  machineAccessories?: InstallationMachineAccessory[];
};
export type InstallationUpdatePayload = {
  status?: string; installedAt?: string; installedById?: string; receiverInstallAddress?: string; receiverRepresentative?: string; receiverPosition?: string; receiverPhone?: string; note?: string;
  machineModelId?: string; modelName?: string; machineSerialNumber?: string;
  machineId?: string; machineCode?: string; machineName?: string; manufacturer?: string; productCategory?: string; warrantyStartDate?: string; warrantyEndDate?: string; warrantyNote?: string; handoverInstallerName?: string; handoverInstallerPosition?: string; handoverVehicle?: string; handoverDepartureDate?: string; deviceCondition?: string; deviceConditionNote?: string; accessories?: string[];
  installedDeviceItems?: InstallationDeviceItem[];
  machineAccessories?: InstallationMachineAccessory[];
};

export const installationApi = {
  async list() {
    const { data } = await apiClient.get<Installation[] | { data: Installation[] }>('/installations', { params: { limit: 50, page: 1 } });
    return Array.isArray(data) ? data : data.data;
  },
  async get(id: string) { return (await apiClient.get<Installation>(`/installations/${id}`)).data; },
  async create(payload: InstallationPayload) { return (await apiClient.post<Installation>('/installations', payload)).data; },
  async update(id: string, payload: InstallationUpdatePayload) { return (await apiClient.patch<Installation>(`/installations/${id}`, payload)).data; },
};

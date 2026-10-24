import { ArrowLeft, Camera, ChevronDown, ChevronUp, ImagePlus, Loader2, Plus, Save, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages } from '../../api';
import { getRoleName } from '../../auth/roles';
import { DateInput } from '../../components/DateInput';
import { ModelInfoFields } from '../../components/ModelInfoFields';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { MachineAccessoryEditor } from '../../components/MachineAccessoryEditor';
import { UsedPartDraft, WorkAccessoryOption, WorkUsedPartsEditor } from '../../components/WorkUsedPartsEditor';
import { GoogleMapsDirectionsButton, VietnamAddressSelects, buildFullVietnamAddress } from '../../components/VietnamAddressSelects';
import { isEndoscopyMachineModel } from '../../config/endoscopyAccessories';
import { isUltrasoundMachineModel } from '../../config/ultrasoundProbes';
import { queryKeys } from '../../lib/queryKeys';
import { parseMachineAccessoriesInput, serializeMachineAccessories } from '../../utils/machineAccessories';
import { machineDisplayName, machineModelName, machineModelOptionLabel, machineProductName } from '../../utils/machineDisplayName';
import { isTechnicalUser } from '../../utils/technicalUsers';
import { fetchModelAccessories, normalizeUsedPartsPayload } from '../../utils/workParts';
import { attachmentOptionsByKind } from '../EngineerTasksPage/constants';
import type { AttachmentType } from '../EngineerTasksPage/types';
import { AsyncEntityPicker, type PickerOption } from '../EngineerTasksPage/components/AsyncEntityPicker';

type TicketKind = 'repair' | 'maintenance' | 'installation';
type CreateTicketStep = 'setup' | 'records';
type TicketScope = 'installation' | 'service';

type ProvinceOption = { id: string; name: string; code: string; branch?: { name: string } | null };
type CustomerOption = {
  id: string;
  customerCode?: string | null;
  name: string;
  phone?: string | null;
  contactPerson?: string | null;
  contactPosition?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contacts?: Array<{
    id: string;
    name: string;
    position?: string | null;
    phone?: string | null;
    email?: string | null;
    isPrimary: boolean;
  }>;
  province?: string | null;
  provinceRef?: ProvinceOption | null;
  address?: string | null;
  fullAddress?: string | null;
};
type EngineerOption = {
  id: string;
  fullName?: string | null;
  email: string;
  engineerProfile?: unknown;
  role?: { name?: string | null } | null;
  roleName?: string | null;
  status?: string | null;
};
type MachineModelOption = {
  id: string;
  code?: string | null;
  name: string;
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
type MachineOption = {
  id: string;
  machineCode?: string | null;
  serialNumber?: string | null;
  modelName?: string | null;
  name?: string | null;
  inventoryStatus?: string | null;
  customer?: CustomerOption | null;
  businessLine?: {
    expertiseGroup?: 'IMAGING' | 'LAB_TESTING' | null;
    productIndustry?: {
      expertiseGroup?: 'IMAGING' | 'LAB_TESTING' | null;
    } | null;
  } | null;
  machineModel?: MachineModelOption | null;
};

type TicketForm = {
  address: string;
  addressNote: string;
  installationAccessories: string;
  checklist: string;
  conditionAssessment: string;
  contactPhone: string;
  customerFeedback: string;
  customerId: string;
  customerContactId: string;
  description: string;
  deviceName: string;
  engineerId: string;
  engineerIds: string[];
  machineId: string;
  machineModelId: string;
  maintenanceType: string;
  modelName: string;
  nextDueDate: string;
  priority: string;
  preliminaryCause: string;
  repairMethod: string;
  receivedAccessories: string;
  repairCostInWords: string;
  repairCostItems: string;
  reportedAt: string;
  resultNote: string;
  representative: string;
  representativePosition: string;
  scheduledDate: string;
  serialNumber: string;
  title: string;
  totalRepairCost: string;
  usingDepartment: string;
  warrantyTerm: string;
  warrantyEndDate: string;
  warrantyStartDate: string;
  warrantyStatus: string;
  installedDeviceItems: InstallationDeviceItem[];
  handoverInstallerName: string;
  handoverInstallerPosition: string;
  handoverVehicle: string;
  handoverDepartureDate: string;
  receiverInstallAddress: string;
  receiverRepresentative: string;
  receiverPosition: string;
  receiverPhone: string;
  deviceCondition: string;
  deviceConditionNote: string;
};

type InstallationDeviceItem = {
  itemName: string;
  model: string;
  manufacturer?: string;
  productCategory?: string;
  isInstalled?: boolean;
  serialNumber: string;
  manufactureDate: string;
  quantity: number;
  sourceMachineId: string;
  warrantyPeriod: string;
  engineerIds: string[];
  accessoriesText?: string;
  accessoriesConfigured?: boolean;
};

type QuickCustomerForm = {
  address: string;
  addressNote: string;
  contactPerson: string;
  district: string;
  locality: string;
  name: string;
  phone: string;
  province: string;
  provinceId: string;
  ward: string;
};

type QuickMachineForm = {
  accessoriesText: string;
  customerId: string;
  machineModelId: string;
  modelName: string;
  name: string;
  serialNumber: string;
};

type CreateTicketOptions = {
  customers: CustomerOption[];
  engineers: EngineerOption[];
  machineModels: MachineModelOption[];
  provinces: ProvinceOption[];
};

type CreateAttachmentDraft = {
  description: string;
  files: File[];
  title: string;
  type: AttachmentType;
};

function defaultAttachmentType(kind: TicketKind): AttachmentType {
  if (kind === 'repair') return 'ERROR_PHOTO';
  if (kind === 'maintenance') return 'MAINTENANCE_FORM';
  return 'MACHINE_PHOTO';
}

const today = () => {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export function ServiceTicketCreatePage({ fixedKind, user }: { fixedKind?: TicketKind; user: ApiUser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialKind = fixedKind ?? normalizeKind(searchParams.get('kind'));
  const initialMachineId = searchParams.get('machineId') ?? '';
  const initialCustomerId = searchParams.get('customerId') ?? '';
  const initialWarrantyStatus = searchParams.get('warrantyStatus') ?? '';
  const initialTemplate = searchParams.get('template') ?? '';
  const returnTo = searchParams.get('returnTo') ?? '';
  const role = getRoleName(user);
  const [kind, setKind] = useState<TicketKind>(initialKind);
  const [currentStep, setCurrentStep] = useState<CreateTicketStep>('setup');
  const [form, setForm] = useState<TicketForm>(() => applyTicketTemplate(emptyTicketForm(user, initialKind), initialTemplate));
  const [usedParts, setUsedParts] = useState<UsedPartDraft[]>([]);
  const [attachmentDraft, setAttachmentDraft] = useState<CreateAttachmentDraft>(() => ({ description: '', files: [], title: '', type: defaultAttachmentType(initialKind) }));
  const [quickCustomerForm, setQuickCustomerForm] = useState<QuickCustomerForm>(() => emptyQuickCustomerForm(user));
  const [quickMachineForm, setQuickMachineForm] = useState<QuickMachineForm>(() => emptyQuickMachineForm());
  const [customerOptions, setCustomerOptions] = useState<Array<PickerOption<CustomerOption>>>([]);
  const [machineOptions, setMachineOptions] = useState<Array<PickerOption<MachineOption>>>([]);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [showQuickMachine, setShowQuickMachine] = useState(false);
  const [showPlannedInstallationMachine, setShowPlannedInstallationMachine] = useState(false);
  const [ticketPreviewCode, setTicketPreviewCode] = useState('');
  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>(() => [initialMachineId].filter(Boolean));
  const [quickMachinePreviewCode, setQuickMachinePreviewCode] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const scope = fixedKind === 'installation' || initialKind === 'installation' ? 'installation' : 'service';

  const optionsQuery = useQuery({
    queryKey: queryKeys.serviceTickets.createOptions,
    queryFn: async (): Promise<CreateTicketOptions> => {
      const [customersResult, modelsResult, provinces] = await Promise.all([
        apiFetch<Paginated<CustomerOption>>('/customers?limit=20'),
        apiFetchAllPages<MachineModelOption>('/machine-models'),
        apiFetchAllPages<ProvinceOption>('/provinces'),
      ]);

      if (role === 'engineer') {
        return {
          customers: customersResult.data,
          engineers: [{ id: user.id, email: user.email, fullName: user.fullName }],
          machineModels: modelsResult,
          provinces,
        };
      }

      const engineersResult = await apiFetch<Paginated<EngineerOption>>('/users?limit=100&status=ACTIVE');

      return {
        customers: customersResult.data,
        engineers: engineersResult.data.filter(isTechnicalUser),
        machineModels: modelsResult,
        provinces,
      };
    },
  });

  const machinesQuery = useQuery({
    queryKey: queryKeys.serviceTickets.machines(kind),
    queryFn: async () => {
      if (kind !== 'installation') {
        const result = await apiFetch<Paginated<MachineOption>>('/machines?limit=20&inventoryStatus=INSTALLED');
        return result.data.filter((machine) => canEngineerUseMachine(user, machine));
      }

      const result = await apiFetch<Paginated<MachineOption>>('/machines?limit=20&inventoryStatus=IN_STOCK');
      return result.data.filter((machine) => canEngineerUseMachine(user, machine));
    },
  });

  const customers = optionsQuery.data?.customers ?? [];
  const engineers = optionsQuery.data?.engineers ?? [];
  const provinces = optionsQuery.data?.provinces ?? [];
  const machineModels = optionsQuery.data?.machineModels ?? [];
  const machines = machinesQuery.data ?? [];
  const selectedCustomer = customerOptions.find((option) => option.value === form.customerId)?.row || customers.find((item) => item.id === form.customerId);
  const selectedCustomerContact = selectedCustomer?.contacts?.find((contact) => contact.id === form.customerContactId);

  useEffect(() => {
    setCustomerOptions((current) =>
      mergePickerOptions([
        ...current,
        ...customers.map((customer) => ({
          label: customerLabel(customer),
          row: customer,
          value: customer.id,
        })),
      ]),
    );
  }, [customers]);

  useEffect(() => {
    setMachineOptions((current) =>
      mergePickerOptions([
        ...current,
        ...machines.map((machine) => ({
          label: machineLabel(machine),
          row: machine,
          value: machine.id,
        })),
      ]),
    );
  }, [machines]);

  const visibleMachines = useMemo(
    () =>
      machines
        .filter((machine) => canEngineerUseMachine(user, machine))
        .filter((machine) => kind === 'installation' || !form.customerId || machine.customer?.id === form.customerId),
    [form.customerId, kind, machines, user],
  );
  const visibleMachineModels = useMemo(() => machineModels.filter((model) => canEngineerUseModel(user, model)), [machineModels, user]);
  const selectedMachine = useMemo(
    () => visibleMachines.find((machine) => machine.id === form.machineId) || machineOptions.find((option) => option.value === form.machineId)?.row,
    [form.machineId, machineOptions, visibleMachines],
  );
  const partsModelId = form.machineModelId || selectedMachine?.machineModel?.id || '';
  const accessoriesQuery = useQuery<WorkAccessoryOption[]>({
    queryKey: ['service-ticket-create', 'model-accessories', partsModelId],
    queryFn: () => fetchModelAccessories(partsModelId),
    enabled: kind !== 'installation' && Boolean(partsModelId),
  });
  const selectedPartsModel = visibleMachineModels.find((model) => model.id === partsModelId);
  const selectedPartsModelLabel = selectedPartsModel
    ? [selectedPartsModel.code, selectedPartsModel.displayName || selectedPartsModel.name].filter(Boolean).join(' · ')
    : form.modelName || selectedMachine?.modelName || '';
  const installationDeviceSummary = useMemo(
    () => buildInstallationDeviceSummary(form),
    [form],
  );
  const selectedModel = useMemo(
    () => visibleMachineModels.find((model) => model.id === quickMachineForm.machineModelId),
    [quickMachineForm.machineModelId, visibleMachineModels],
  );
  const quickMachineAccessoryMode = isEndoscopyMachineModel(selectedModel)
    ? 'endoscopy'
    : isUltrasoundMachineModel(selectedModel)
      ? 'probe'
      : null;
  const backHref = returnTo || (scope === 'installation' ? '/installations' : '/service-tickets');
  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      const name = quickCustomerForm.name.trim();
      const provinceId = quickCustomerForm.provinceId.trim();
      const selectedProvince = provinces.find((province) => province.id === provinceId);

      if (!name || !provinceId) {
        throw new Error('Vui lòng nhập tên khách hàng và chọn tỉnh/thành.');
      }

      return apiFetch<CustomerOption>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone: quickCustomerForm.phone.trim() || undefined,
          contactPerson: quickCustomerForm.contactPerson.trim() || undefined,
          contactPhone: quickCustomerForm.phone.trim() || undefined,
          province: selectedProvince?.name || quickCustomerForm.province.trim() || undefined,
          provinceId,
          district: quickCustomerForm.district.trim() || undefined,
          locality: quickCustomerForm.locality.trim() || undefined,
          ward: quickCustomerForm.ward.trim() || undefined,
          address: quickCustomerForm.address.trim() || undefined,
          fullAddress: [buildFullVietnamAddress(quickCustomerForm), quickCustomerForm.addressNote.trim()].filter(Boolean).join(' · ') || undefined,
          primaryEngineerId: role === 'engineer' ? user.id : undefined,
          status: 'ACTIVE',
        }),
      });
    },
    onSuccess: async (customer) => {
      rememberCustomerOption(customer);
      queryClient.setQueryData<CreateTicketOptions>(queryKeys.serviceTickets.createOptions, (current) =>
        current
          ? {
              ...current,
              customers: [customer, ...current.customers.filter((item) => item.id !== customer.id)],
            }
          : current,
      );
      setForm((current) => ({ ...current, customerId: customer.id }));
      setQuickCustomerForm(emptyQuickCustomerForm(user));
      setShowQuickCustomer(false);
      setSuccess('Đã thêm khách hàng.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['resources', '/customers'] }),
        queryClient.invalidateQueries({ queryKey: ['customers'] }),
      ]);
    },
  });

  const createMachineMutation = useMutation({
    mutationFn: async () => {
      const serialNumber = quickMachineForm.serialNumber.trim();
      const modelName = quickMachineForm.modelName.trim() || selectedModel?.name || selectedModel?.code || '';

      if (!serialNumber || !selectedModel || !modelName) {
        throw new Error('Vui lòng nhập Serial và chọn model chuẩn.');
      }

      return apiFetch<MachineOption>('/machines', {
        method: 'POST',
        body: JSON.stringify({
          serialNumber,
          machineModelId: selectedModel?.id,
          modelName: undefined,
          name: quickMachineForm.name.trim() || selectedModel?.displayName || modelName,
          customerId: kind === 'installation' ? undefined : form.customerId || undefined,
          inventoryStatus: kind === 'installation' ? 'IN_STOCK' : 'INSTALLED',
          status: 'ACTIVE',
          dataStatus: 'PENDING_REVIEW',
          createdSource: role === 'admin' ? 'ADMIN' : 'ENGINEER',
          primaryEngineerId: role === 'engineer' ? user.id : undefined,
          accessories: parseMachineAccessoriesInput(quickMachineForm.accessoriesText),
        }),
      });
    },
    onSuccess: async (machine) => {
      queryClient.setQueryData<MachineOption[]>(queryKeys.serviceTickets.machines(kind), (current) =>
        current ? [machine, ...current.filter((item) => item.id !== machine.id)] : [machine],
      );
      setForm((current) => {
        const machineName = machine.name || quickMachineForm.modelName;
        const machineModel = machine.modelName || quickMachineForm.modelName;
        const serialNumber = machine.serialNumber || quickMachineForm.serialNumber;
        if (kind === 'installation' && current.machineId) {
          const duplicate = current.installedDeviceItems.some(
            (item) => item.sourceMachineId === machine.id ||
              (serialNumber && item.serialNumber.trim().toUpperCase() === serialNumber.trim().toUpperCase()),
          );
          return {
            ...current,
            customerId: current.customerId || machine.customer?.id || '',
            installedDeviceItems: duplicate ? current.installedDeviceItems : [...current.installedDeviceItems, {
              itemName: machineName,
              model: machineModel,
              serialNumber,
              manufactureDate: '',
              quantity: 1,
              sourceMachineId: machine.id,
              warrantyPeriod: '',
              engineerIds: [],
            }],
          };
        }
        return {
          ...current,
          machineId: machine.id,
          customerId: current.customerId || machine.customer?.id || '',
          deviceName: current.deviceName || machineName,
          modelName: current.modelName || machineModel,
          serialNumber: current.serialNumber || serialNumber,
        };
      });
      setQuickMachineForm(emptyQuickMachineForm());
      setShowQuickMachine(false);
      setSuccess(kind === 'installation' && form.machineId ? 'Đã thêm máy.' : 'Đã lưu máy.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['service-tickets', 'machines'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.productCatalog.overview }),
      ]);
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: () => {
      if (currentStep !== 'records') {
        throw new Error('Hãy hoàn thành bước 2 trước khi tạo phiếu.');
      }
      if (kind === 'installation' || selectedMachineIds.length <= 1) {
        return createTicket(kind, form, visibleMachineModels, usedParts).then((created) => ({ created: [created], failures: [] as string[], failedMachineIds: [] as string[] }));
      }
      return createMultipleServiceTickets(kind, form, selectedMachineIds, [...machines, ...machineOptions.map((option) => option.row)], visibleMachineModels, usedParts);
    },
    onSuccess: async ({ created, failures, failedMachineIds }) => {
      const attachmentFailures = attachmentDraft.files.length
        ? await uploadCreatedAttachments(created, kind, attachmentDraft)
        : [];
      if (failures.length) {
        setSuccess(created.length ? `Đã tạo ${created.length}/${selectedMachineIds.length} phiếu theo máy.` : 'Chưa tạo được phiếu nào.');
        setFormError([`Không tạo được ${failures.length} phiếu: ${failures.join('; ')}`, attachmentFailures.length ? `Ảnh/tài liệu chưa tải lên được cho ${attachmentFailures.length} phiếu.` : ''].filter(Boolean).join(' '));
        setSelectedMachineIds(failedMachineIds);
        if (failedMachineIds[0] && !failedMachineIds.includes(form.machineId)) {
          const remainingMachine = [...machines, ...machineOptions.map((option) => option.row)].find((item) => item.id === failedMachineIds[0]);
          applyMachine(remainingMachine, failedMachineIds[0]);
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['service-tickets', 'board'] }),
          queryClient.invalidateQueries({ queryKey: ['work-assignments', 'dashboard'] }),
        ]);
        return;
      }
      setSuccess(role === 'admin' ? 'Đã tạo và phân công phiếu.' : 'Đã trình phiếu, chờ quản trị viên phê duyệt.');
      setFormError(attachmentFailures.length ? `Phiếu đã tạo nhưng chưa tải được tài liệu lên ${attachmentFailures.length} phiếu. Có thể bổ sung trong màn cập nhật phiếu.` : '');
      setForm(emptyTicketForm(user, kind));
      setSelectedMachineIds([]);
      setUsedParts([]);
      setAttachmentDraft({ description: '', files: [], title: '', type: defaultAttachmentType(kind) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['service-tickets', 'board'] }),
        queryClient.invalidateQueries({ queryKey: ['work-assignments', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] }),
      ]);
      window.setTimeout(() => navigate(backHref), attachmentFailures.length ? 2200 : 450);
    },
  });
  const loading = optionsQuery.isLoading || optionsQuery.isFetching || machinesQuery.isLoading || machinesQuery.isFetching;
  const saving = createTicketMutation.isPending;
  const creatingCustomer = createCustomerMutation.isPending;
  const creatingMachine = createMachineMutation.isPending;
  const mutationError = createCustomerMutation.error ?? createMachineMutation.error ?? createTicketMutation.error;
  const error =
    formError ||
    (optionsQuery.error instanceof Error ? optionsQuery.error.message : '') ||
    (machinesQuery.error instanceof Error ? machinesQuery.error.message : '') ||
    (mutationError instanceof Error ? mutationError.message : '');

  useEffect(() => {
    if (!optionsQuery.data) return;
    const initialCustomer = optionsQuery.data.customers.find((customer) => customer.id === initialCustomerId);
    if (initialCustomer && !form.customerId) {
      applyCustomer(initialCustomer);
    }
  }, [form.customerId, initialCustomerId, optionsQuery.data]);

  useEffect(() => {
    if (!machinesQuery.data) return;
    const initialMachine = machinesQuery.data.find((machine) => machine.id === initialMachineId);
    if (initialMachine && !form.machineId) {
      applyMachine(initialMachine);
    }
  }, [form.machineId, initialMachineId, machinesQuery.data]);

  useEffect(() => {
    if (!fixedKind) {
      setSearchParams(compactSearchParams({ kind, machineId: initialMachineId, customerId: initialCustomerId, returnTo, warrantyStatus: initialWarrantyStatus }));
    }
    setForm((current) => ({
      ...applyTicketTemplate(emptyTicketForm(user, kind), initialTemplate),
      customerId: current.customerId || initialCustomerId,
      engineerId: current.engineerId,
      machineId: '',
      warrantyStatus: initialWarrantyStatus || current.warrantyStatus,
    }));
    setSelectedMachineIds([initialMachineId].filter(Boolean));
  }, [fixedKind, initialCustomerId, initialMachineId, initialTemplate, initialWarrantyStatus, kind, returnTo]);

  useEffect(() => {
    let cancelled = false;
    const date = kind === 'repair' ? form.reportedAt : form.scheduledDate;
    const endpoint = kind === 'repair' ? '/repairs/next-code' : kind === 'maintenance' ? '/maintenance/next-code' : '/installations/next-code';
    const params = new URLSearchParams();
    if (date) params.set('date', date);

    void apiFetch<{ code?: string | null }>(`${endpoint}?${params.toString()}`)
      .then((result) => {
        if (!cancelled) setTicketPreviewCode(result.code || '');
      })
      .catch(() => {
        if (!cancelled) setTicketPreviewCode('');
      });

    return () => {
      cancelled = true;
    };
  }, [kind, form.reportedAt, form.scheduledDate]);

  useEffect(() => {
    let cancelled = false;
    const source = selectedModel?.code || selectedModel?.name || quickMachineForm.modelName || quickMachineForm.name || 'MAY';
    const params = new URLSearchParams({ source });

    void apiFetch<{ code?: string | null }>(`/machines/next-code?${params.toString()}`)
      .then((result) => {
        if (!cancelled) setQuickMachinePreviewCode(result.code || '');
      })
      .catch(() => {
        if (!cancelled) setQuickMachinePreviewCode('');
      });

    return () => {
      cancelled = true;
    };
  }, [selectedModel?.code, selectedModel?.name, quickMachineForm.modelName, quickMachineForm.name]);

  function updateForm(patch: Partial<TicketForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function updateInstallationDeviceItem(index: number, patch: Partial<InstallationDeviceItem>) {
    setForm((current) => ({
      ...current,
      installedDeviceItems: current.installedDeviceItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function loadInstallationDeviceAccessories(index: number, machineId: string) {
    void apiFetch<unknown[]>(`/machines/${machineId}/accessories`)
      .then((accessories) => {
        setForm((current) => ({
          ...current,
          installedDeviceItems: current.installedDeviceItems.map((item, itemIndex) =>
            itemIndex === index && item.sourceMachineId === machineId
              ? {
                  ...item,
                  accessoriesText: serializeMachineAccessories(accessories),
                  accessoriesConfigured: true,
                }
              : item,
          ),
        }));
      })
      .catch(() => setFormError('Không tải được phụ kiện của máy đã chọn.'));
  }

  function addInstallationDeviceItem() {
    setForm((current) => ({
      ...current,
      installedDeviceItems: [...current.installedDeviceItems, emptyInstallationDeviceItem()],
    }));
  }

  function removeInstallationDeviceItem(index: number) {
    setForm((current) => ({
      ...current,
      installedDeviceItems: current.installedDeviceItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function changeKind(nextKind: TicketKind) {
    setKind(nextKind);
    setCurrentStep('setup');
    setFormError('');
    setSuccess('');
    setAttachmentDraft((current) => ({ ...current, type: defaultAttachmentType(nextKind) }));
    setUsedParts([]);
  }

  function goToRecordsStep() {
    setFormError('');
    setSuccess('');
    if (role === 'admin' && !form.engineerIds.length) {
      setFormError('Vui lòng chọn ít nhất một kỹ sư nhận việc.');
      return;
    }
    setCurrentStep('records');
  }

  function goBackStep() {
    setFormError('');
    setSuccess('');
    setCurrentStep('setup');
  }

  function selectCustomer(customerId: string) {
    const customer = customers.find((item) => item.id === customerId) || customerOptions.find((item) => item.value === customerId)?.row;
    applyCustomer(customer, customerId);
  }

  function applyCustomer(customer?: CustomerOption, fallbackCustomerId = customer?.id ?? '') {
    const customerId = customer?.id || fallbackCustomerId;
    const customerChanged = customerId !== form.customerId;
    const primaryContact = customer?.contacts?.find((contact) => contact.isPrimary) || customer?.contacts?.[0];
    updateForm({
      customerId,
      customerContactId: primaryContact?.id || '',
      usingDepartment: customer?.name || form.usingDepartment,
      representative: primaryContact?.name || customer?.contactPerson || form.representative,
      representativePosition: primaryContact?.position || customer?.contactPosition || form.representativePosition,
      address: customer?.fullAddress || customer?.address || form.address,
      receiverInstallAddress: customer?.fullAddress || customer?.address || form.receiverInstallAddress,
      receiverRepresentative: primaryContact?.name || customer?.contactPerson || form.receiverRepresentative,
      receiverPosition: primaryContact?.position || customer?.contactPosition || form.receiverPosition,
      receiverPhone: primaryContact?.phone || customer?.contactPhone || customer?.phone || form.receiverPhone,
      contactPhone: primaryContact?.phone || customer?.contactPhone || customer?.phone || form.contactPhone,
      ...(customerChanged ? { machineId: '', machineModelId: '', deviceName: '', modelName: '', serialNumber: '' } : {}),
    });
    if (customerChanged) setSelectedMachineIds([]);
    setQuickMachineForm((current) => ({ ...current, customerId: customer?.id || fallbackCustomerId || current.customerId }));
  }

  function applyCustomerContact(contactId: string) {
    const customer = customerOptions.find((option) => option.value === form.customerId)?.row || customers.find((item) => item.id === form.customerId);
    const contact = customer?.contacts?.find((item) => item.id === contactId);
    if (!contact) return;
    updateForm({
      customerContactId: contact.id,
      representative: contact.name,
      representativePosition: contact.position || '',
      receiverRepresentative: contact.name,
      receiverPosition: contact.position || '',
      contactPhone: contact.phone || '',
      receiverPhone: contact.phone || '',
    });
  }

  function rememberCustomerOption(customer?: CustomerOption) {
    if (!customer) return;
    setCustomerOptions((current) =>
      mergePickerOptions([
        { label: customerLabel(customer), row: customer, value: customer.id },
        ...current,
      ]),
    );
  }

  function rememberMachineOption(machine?: MachineOption) {
    if (!machine) return;
    setMachineOptions((current) =>
      mergePickerOptions([
        { label: machineLabel(machine), row: machine, value: machine.id },
        ...current,
      ]),
    );
  }

  function applyMachine(machine?: MachineOption, fallbackMachineId = machine?.id ?? '') {
    if (!machine && !fallbackMachineId) {
      updateForm({
        machineId: '',
        deviceName: '',
        modelName: '',
        machineModelId: '',
        serialNumber: '',
      });
      return;
    }

    updateForm({
      machineId: machine?.id || fallbackMachineId,
      customerId: machine?.customer?.id || form.customerId,
      deviceName: machine?.name || form.deviceName,
      modelName: machine?.modelName || form.modelName,
      machineModelId: machine?.machineModel?.id || '',
      serialNumber: machine?.serialNumber || form.serialNumber,
    });
  }

  function removeSelectedMachine(machineId: string) {
    const nextIds = selectedMachineIds.filter((id) => id !== machineId);
    setSelectedMachineIds(nextIds);
    if (form.machineId === machineId) {
      const nextMachine = [...machines, ...machineOptions.map((option) => option.row)].find((item) => item.id === nextIds[0]);
      applyMachine(nextMachine, nextIds[0] || '');
    }
  }

  async function createCustomer() {
    setFormError('');
    setSuccess('');

    try {
      await createCustomerMutation.mutateAsync();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không tạo được khách hàng.');
    }
  }

  async function createMachine() {
    setFormError('');
    setSuccess('');

    try {
      await createMachineMutation.mutateAsync();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không tạo được thiết bị.');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setSuccess('');

    if (currentStep === 'setup') {
      goToRecordsStep();
      return;
    }

    if (kind === 'installation' && !form.customerId) {
      setFormError('Vui lòng chọn khách hàng ở bước 2 trước khi tạo phiếu lắp đặt.');
      return;
    }
    if (role === 'engineer') {
      if (!form.customerId) {
        setFormError('Vui lòng chọn khách hàng cho phiếu.');
        return;
      }
      if (kind !== 'installation' && (!form.machineId || !form.description.trim())) {
        setFormError('Phiếu sửa chữa/bảo trì cần có khách hàng, máy và mô tả công việc.');
        return;
      }
      if (kind !== 'installation' && !selectedMachineIds.length) {
        setFormError('Vui lòng chọn ít nhất một máy.');
        return;
      }
      if (kind === 'repair' && (!form.repairMethod.trim() || !form.resultNote.trim())) {
        setFormError('Vui lòng nhập phương pháp sửa chữa và kết quả xử lý trước khi trình phê duyệt.');
        return;
      }
      if (kind === 'maintenance' && (!splitLines(form.checklist).length || !form.resultNote.trim())) {
        setFormError('Vui lòng nhập checklist và kết quả bảo trì trước khi trình phê duyệt.');
        return;
      }
      if (kind === 'installation' && !form.machineId && !form.machineModelId) {
        setFormError('Vui lòng chọn máy hoặc khai báo model/thiết bị bàn giao trong phiếu lắp đặt.');
        return;
      }
      if (kind === 'installation') {
        const hasSerial = form.machineId
          ? Boolean(selectedMachine?.serialNumber?.trim())
          : Boolean(form.serialNumber.trim());
        if (!form.scheduledDate || !hasSerial || !form.receiverInstallAddress.trim() || !form.receiverRepresentative.trim() || !form.receiverPhone.trim() || !form.handoverInstallerName.trim()) {
          setFormError('Vui lòng điền ngày lắp đặt, S/N máy, địa chỉ, người nhận, số điện thoại và người lắp đặt.');
          return;
        }
      }
    }

    try {
      await createTicketMutation.mutateAsync();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không tạo được phiếu.');
    }
  }

  if (role !== 'admin' && role !== 'engineer') {
    return <PageFrame><Notice message="Chỉ quản trị viên và kỹ sư được phép lập phiếu sửa chữa, bảo trì hoặc lắp đặt." /></PageFrame>;
  }

  return (
    <PageFrame>
      <div className="flex flex-wrap items-start justify-between gap-4 font-sans">
        <PageTitle
          eyebrow="Phiếu dịch vụ"
          title="Tạo phiếu"
        />
        <button className="secondary-button" onClick={() => navigate(backHref)} type="button">
          <ArrowLeft size={17} />
          Quay lại
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}
      <ServiceCreateOperationalGuide currentStep={currentStep} kind={kind} isEngineer={role === 'engineer'} />

      <form className="grid min-w-0 gap-5 font-sans min-[1320px]:grid-cols-[minmax(0,1fr)_380px]" onSubmit={submit}>
        <section className="grid min-w-0 gap-5">
          {currentStep === 'setup' ? (
            <div className={panelClass}>
              <div className="mb-5 grid grid-cols-[34px_minmax(0,1fr)] gap-3 border-b border-[#e4e4e7] pb-4">
                <span className={stepBadgeClass}>1</span>
                <div>
                  <span className={eyebrowClass}>Loại phiếu</span>
                  <h2 className={sectionTitleClass}>{role === 'admin' ? 'Chọn nghiệp vụ và người phụ trách' : 'Chọn loại phiếu cần lập'}</h2>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className={labelClass}>
                  Mã phiếu
                  <input className={fieldClass} disabled value={ticketPreviewCode || 'Đang sinh mã...'} />
                </label>
                <label className={labelClass}>
                  Loại phiếu
                  <select className={fieldClass} disabled={Boolean(fixedKind)} onChange={(event) => changeKind(event.target.value as TicketKind)} value={kind}>
                    <option value="repair">Sửa chữa</option>
                    <option value="maintenance">Bảo trì</option>
                    <option value="installation">Lắp đặt</option>
                  </select>
                </label>
                {role === 'admin' ? <fieldset className={`${labelClass} md:col-span-2`}>
                  <legend>Kỹ sư tham gia <span className="text-[#9a1b2e]">*</span></legend>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {engineers.map((engineer) => {
                      const checked = form.engineerIds.includes(engineer.id);
                      return (
                        <label key={engineer.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-[#e4e4e7] bg-white px-3 py-2 text-sm font-medium">
                          <input
                            checked={checked}
                            disabled={loading}
                            onChange={() => {
                              const engineerIds = checked
                                ? form.engineerIds.filter((id) => id !== engineer.id)
                                : [...form.engineerIds, engineer.id];
                              updateForm({ engineerIds, engineerId: engineerIds[0] || '' });
                            }}
                            type="checkbox"
                          />
                          <span>{engineer.fullName || engineer.email}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset> : null}
              </div>
            </div>
          ) : null}

          {currentStep === 'records' ? (
            <div className="grid min-w-0 gap-5">
            <div className={panelClass}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-[#e4e4e7] pb-4">
                <div className="min-w-0">
                  <div>
                    <span className={eyebrowClass}>{role === 'admin' ? 'Thông tin phiếu' : 'Hồ sơ khách hàng'}</span>
                    <h2 className={sectionTitleClass}>{role === 'admin' ? 'Khách hàng, thiết bị và phân công' : 'Khách hàng và thiết bị'}</h2>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="secondary-button compact" onClick={() => setShowQuickCustomer((value) => !value)} type="button">
                    <Plus size={16} />
                    Tạo khách hàng
                    {showQuickCustomer ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  {kind === 'installation' ? (
                    <button
                      className="secondary-button compact"
                      onClick={() => {
                        if (!showPlannedInstallationMachine && form.machineId) {
                          updateForm({ machineId: '', deviceName: '', modelName: '', machineModelId: '', serialNumber: '' });
                        }
                        setShowPlannedInstallationMachine(!showPlannedInstallationMachine);
                      }}
                      type="button"
                    >
                      <Plus size={16} />
                      Khai báo máy chính
                      {showPlannedInstallationMachine ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  ) : (
                    <button className="secondary-button compact" onClick={() => setShowQuickMachine((value) => !value)} type="button">
                      <Plus size={16} />
                      Khai báo máy
                      {showQuickMachine ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <AsyncEntityPicker<CustomerOption>
                  className={labelClass}
                  disabled={loading}
                  endpoint="/customers?limit=20"
                  formatOption={(customer) => ({
                    label: customerLabel(customer),
                    row: customer,
                    value: customer.id,
                  })}
                  initialOptions={customerOptions}
                  inputClassName={fieldClass}
                  label="Khách hàng"
                  onChange={(value, customer) => {
                    rememberCustomerOption(customer);
                    applyCustomer(customer, value);
                  }}
                  placeholder="Tìm khách hàng"
                  required
                  value={form.customerId}
                />

                {selectedCustomer?.contacts?.length ? (
                    <label className={labelClass}>
                      Người liên hệ cho phiếu
                      <select className={fieldClass} onChange={(event) => applyCustomerContact(event.target.value)} value={form.customerContactId}>
                        {selectedCustomer.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.position ? ` · ${contact.position}` : ''}{contact.isPrimary ? ' (Chính)' : ''}</option>)}
                      </select>
                    </label>
                ) : null}

                {selectedCustomer ? (
                  <section aria-label="Thông tin khách hàng đã chọn" className="md:col-span-2 -mt-1 border-l-2 border-[#d9a3ab] bg-[#faf8f7] px-4 py-3">
                    <h3 className="mb-2 text-xs font-bold text-[#667085]">THÔNG TIN KHÁCH HÀNG</h3>
                    <dl className="grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                      <div className="min-w-0 py-1">
                        <dt className="text-xs font-medium text-[#667085]">Mã khách hàng</dt>
                        <dd className="mt-0.5 break-words font-semibold text-[#1f2937]">{selectedCustomer.customerCode || 'Chưa cập nhật'}</dd>
                      </div>
                      <div className="min-w-0 py-1">
                        <dt className="text-xs font-medium text-[#667085]">Người liên hệ</dt>
                        <dd className="mt-0.5 break-words font-semibold text-[#1f2937]">{selectedCustomerContact?.name || selectedCustomer.contactPerson || 'Chưa cập nhật'}</dd>
                      </div>
                      <div className="min-w-0 py-1">
                        <dt className="text-xs font-medium text-[#667085]">Số điện thoại</dt>
                        <dd className="mt-0.5 break-words font-semibold text-[#1f2937]">{selectedCustomerContact?.phone || selectedCustomer.contactPhone || selectedCustomer.phone || 'Chưa cập nhật'}</dd>
                      </div>
                      <div className="min-w-0 py-1">
                        <dt className="text-xs font-medium text-[#667085]">Email</dt>
                        <dd className="mt-0.5 break-words font-semibold text-[#1f2937]">{selectedCustomerContact?.email || selectedCustomer.contactEmail || 'Chưa cập nhật'}</dd>
                      </div>
                      <div className="min-w-0 py-1 sm:col-span-2 xl:col-span-4">
                        <dt className="text-xs font-medium text-[#667085]">Địa chỉ</dt>
                        <dd className="mt-0.5 break-words font-semibold text-[#1f2937]">{selectedCustomer.fullAddress || selectedCustomer.address || [selectedCustomer.provinceRef?.name, selectedCustomer.province].filter(Boolean).join(' · ') || 'Chưa cập nhật'}</dd>
                      </div>
                    </dl>
                  </section>
                ) : null}

                <AsyncEntityPicker<MachineOption>
                  className="md:col-span-2"
                  disabled={loading}
                  emptyMessage={kind === 'installation' ? 'Không tìm thấy máy có sẵn trong kho.' : form.customerId ? 'Khách hàng này chưa có máy đã lắp phù hợp để tạo phiếu.' : 'Chọn khách hàng trước để tìm máy đã lắp.'}
                  endpoint={machinePickerEndpoint(kind, form.customerId)}
                  formatOption={(machine) => ({
                    label: machineLabel(machine),
                    row: machine,
                    value: machine.id,
                  })}
                  initialOptions={machineOptions.filter((option) => !selectedMachineIds.includes(option.value) && machinePickerRowFilter(kind, form.customerId, user, option.row))}
                  inputClassName={fieldClass}
                  label={kind === 'installation' ? 'Máy chính từ kho' : selectedMachineIds.length ? 'Thêm thiết bị vào phiếu' : 'Chọn thiết bị'}
                  onChange={(value, machine) => {
                    rememberMachineOption(machine);
                    if (kind === 'installation') {
                      applyMachine(machine, value);
                      if (machine) setShowPlannedInstallationMachine(false);
                    } else if (machine) {
                      setSelectedMachineIds((current) => current.includes(machine.id) ? current : [...current, machine.id]);
                      if (!selectedMachineIds.length) applyMachine(machine, value);
                    }
                  }}
                  placeholder="Tìm máy"
                  rowFilter={(machine) => !selectedMachineIds.includes(machine.id) && machinePickerRowFilter(kind, form.customerId, user, machine)}
                  value={kind === 'installation' ? form.machineId : ''}
                />

                {kind !== 'installation' && !selectedMachineIds.length ? (
                  <p className="-mt-3 text-sm text-[#667085] md:col-span-2">Chưa có thiết bị nào trong phiếu.</p>
                ) : null}

                {kind !== 'installation' && selectedMachineIds.length ? (
                  <section aria-label="Máy đã chọn" className="md:col-span-2 -mt-1 border-t border-[#e8e8e8] pt-3">
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <h3 className="text-sm font-bold text-[#344054]">Máy đã chọn <span className="font-medium text-[#667085]">({selectedMachineIds.length})</span></h3>
                    </div>
                    <ol className="divide-y divide-[#eeeeee]">
                    {selectedMachineIds.map((machineId, index) => {
                      const machine = [...machines, ...machineOptions.map((option) => option.row)].find((item) => item.id === machineId);
                      return <li className="flex min-w-0 items-center gap-3 py-2" key={machineId}>
                        <span className="w-5 shrink-0 text-xs font-semibold text-[#98a2b3]">{index + 1}.</span>
                        <span className="min-w-0 flex-1 break-words text-sm font-semibold text-[#344054]">{machine ? machineLabel(machine) : machineId}</span>
                        <button aria-label={`Bỏ máy ${machine ? machineLabel(machine) : index + 1}`} className="shrink-0 px-2 py-1 text-xs font-bold text-[#b42318] hover:underline" onClick={() => removeSelectedMachine(machineId)} type="button">Bỏ</button>
                      </li>;
                    })}
                    </ol>
                  </section>
                ) : null}

                {kind === 'installation' && form.machineId ? (
                  <div className="md:col-span-2 -mt-3 flex justify-end">
                    <button className="text-xs font-bold text-[#475569] underline-offset-4 hover:underline" onClick={() => applyMachine()} type="button">
                      Bỏ chọn máy
                    </button>
                  </div>
                ) : null}
              </div>

              {kind === 'installation' && showPlannedInstallationMachine ? (
                <div className="mt-5 grid gap-4 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <strong className="text-sm text-[#172033]">Máy chính cần lắp</strong>
                  </div>
                  <ModelDeviceSelect form={form} models={visibleMachineModels} updateForm={updateForm} />
                  <label className={labelClass}>
                    Tên thiết bị dự kiến
                    <input className={fieldClass} onChange={(event) => updateForm({ deviceName: event.target.value })} placeholder="Tự điền theo model, có thể sửa" value={form.deviceName} />
                  </label>
                  <label className={labelClass}>
                    S/N (nếu đã biết)
                    <input className={fieldClass} onChange={(event) => updateForm({ serialNumber: event.target.value })} value={form.serialNumber} />
                  </label>
                </div>
              ) : null}

              {kind === 'installation' ? (
                <section className="mt-5 rounded-2xl border border-[#e4e4e7] bg-white p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-[#172033]">Thiết bị lắp thêm</h3>
                      {form.installedDeviceItems.length ? <span className="text-xs text-[#64748b]">{form.installedDeviceItems.length} thiết bị</span> : null}
                    </div>
                    <button className="secondary-button compact" onClick={addInstallationDeviceItem} type="button">
                      <Plus size={15} /> Thêm thiết bị
                    </button>
                  </div>
                  {form.installedDeviceItems.map((item, index) => (
                    <div className="mb-3 grid gap-3 rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-3 last:mb-0 md:grid-cols-2" key={index}>
                      <div className="flex items-center justify-between gap-2 md:col-span-2">
                        <strong className="text-sm">Thiết bị {index + 1}</strong>
                        <button className="text-xs font-semibold text-[#9a1b2e]" onClick={() => removeInstallationDeviceItem(index)} type="button">Xóa</button>
                      </div>
                      <details className="md:col-span-2" open={Boolean(item.sourceMachineId)}>
                        <summary className="w-fit cursor-pointer text-sm font-semibold text-[#52607a] hover:text-[#9a1b2e]">Chọn máy đã có trong kho</summary>
                        <div className="mt-3">
                      <AsyncEntityPicker<MachineOption>
                        endpoint={machinePickerEndpoint('installation', '')}
                        formatOption={(machine) => ({ label: machineLabel(machine), row: machine, value: machine.id })}
                        initialOptions={machineOptions.filter((option) => option.value !== form.machineId && !form.installedDeviceItems.some((other, otherIndex) => otherIndex !== index && other.sourceMachineId === option.value) && machinePickerRowFilter('installation', '', user, option.row))}
                        inputClassName={fieldClass}
                        label="Tìm theo mã máy hoặc S/N"
                        onChange={(value, machine) => updateInstallationDeviceItem(index, machine ? {
                          sourceMachineId: machine.id,
                          itemName: machine.name || machine.modelName || item.itemName,
                          model: machine.modelName || machine.machineModel?.name || item.model,
                          manufacturer: machine.machineModel?.manufacturer || item.manufacturer,
                          serialNumber: machine.serialNumber || item.serialNumber,
                          quantity: 1,
                        } : { sourceMachineId: value })}
                        placeholder="Tìm máy trong kho"
                        rowFilter={(machine) => machine.id !== form.machineId && !form.installedDeviceItems.some((other, otherIndex) => otherIndex !== index && other.sourceMachineId === machine.id) && machinePickerRowFilter('installation', '', user, machine)}
                        value={item.sourceMachineId || ''}
                      />
                        </div>
                      </details>
                      {!item.sourceMachineId ? <>
                      <label className={labelClass}>
                        Model
                        <select className={fieldClass} onChange={(event) => {
                          const model = visibleMachineModels.find((option) => option.id === event.target.value);
                          updateInstallationDeviceItem(index, {
                            model: model?.name || model?.displayName || model?.code || '',
                            itemName: machineProductName(model) || model?.displayName || model?.name || item.itemName,
                            manufacturer: model?.manufacturer || '',
                            productCategory: model?.productCategory || 'OTHER',
                          });
                        }} value={modelIdByName(visibleMachineModels, item.model)}>
                          <option value="">Chọn model</option>
                          {visibleMachineModels.map((model) => <option key={model.id} value={model.id}>{model.code || model.displayName || model.name}</option>)}
                        </select>
                      </label>
                      <label className={labelClass}>Tên thiết bị<input className={fieldClass} onChange={(event) => updateInstallationDeviceItem(index, { itemName: event.target.value })} value={item.itemName} /></label>
                      <label className={labelClass}>S/N nếu đã biết<input autoComplete="off" className={fieldClass} onChange={(event) => updateInstallationDeviceItem(index, { serialNumber: event.target.value })} value={item.serialNumber} /></label>
                      </> : null}
                    </div>
                  ))}
                </section>
              ) : null}

              {showQuickCustomer ? (
                <QuickCustomerPanel
                  creating={creatingCustomer}
                  form={quickCustomerForm}
                  onCreate={createCustomer}
                  provinces={provinces}
                  updateForm={(patch) => setQuickCustomerForm((current) => ({ ...current, ...patch }))}
                />
              ) : null}

              {showQuickMachine && kind !== 'installation' ? (
                <QuickMachinePanel
                  creating={creatingMachine}
                  customerName={customerNameForSummary(undefined, customers, form.customerId)}
                  hasTicketCustomer={Boolean(form.customerId)}
                  form={quickMachineForm}
                  kind={kind}
                  models={visibleMachineModels}
                  onCreate={createMachine}
                  selectedModel={selectedModel}
                  previewCode={quickMachinePreviewCode}
                  accessoryMode={quickMachineAccessoryMode}
                  updateForm={(patch) => setQuickMachineForm((current) => ({ ...current, ...patch }))}
                />
              ) : null}
            </div>
              {role === 'engineer' ? (
                <div className={panelClass}>
                  <div className="mb-5 grid grid-cols-[34px_minmax(0,1fr)] gap-3">
                    <span className={stepBadgeClass}>2</span>
                    <div>
                      <span className={eyebrowClass}>Chi tiết phiếu</span>
                      <h3 className={sectionTitleClass}>{kind === 'repair' ? 'Thông tin yêu cầu sửa chữa' : kind === 'maintenance' ? 'Kế hoạch bảo trì' : 'Thông tin lắp đặt'}</h3>
                    </div>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    {kind !== 'installation' ? (
                      <label className={wideLabelClass}>
                        Tiêu đề công việc
                        <input className={fieldClass} onChange={(event) => updateForm({ title: event.target.value })} value={form.title} />
                      </label>
                    ) : null}
                    {kind === 'repair' ? (
                      <RepairRequestFields form={form} models={visibleMachineModels} updateForm={updateForm} />
                    ) : kind === 'maintenance' ? (
                      <MaintenanceRequestFields form={form} models={visibleMachineModels} updateForm={updateForm} />
                    ) : (
                      <InstallationFields
                        addDeviceItem={addInstallationDeviceItem}
                        engineers={engineers}
                        form={form}
                        loadDeviceAccessories={loadInstallationDeviceAccessories}
                        machineOptions={machineOptions}
                        machines={visibleMachines}
                        models={visibleMachineModels}
                        removeDeviceItem={removeInstallationDeviceItem}
                        updateDeviceItem={updateInstallationDeviceItem}
                        updateForm={updateForm}
                        user={user}
                      />
                    )}
                  </div>
                  {kind !== 'installation' ? (
                    <div className="mt-5 border-t border-[#e8e8e8] pt-5">
                      <WorkUsedPartsEditor
                        accessories={accessoriesQuery.data || []}
                        items={usedParts}
                        loading={accessoriesQuery.isFetching}
                        modelLabel={selectedPartsModelLabel}
                        modelSelected={Boolean(partsModelId)}
                        onChange={setUsedParts}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside className="grid min-w-0 gap-4 self-start min-[1320px]:sticky min-[1320px]:top-5">
          <div className={sidePanelClass}>
            <span className={eyebrowClass}>Phiếu đang tạo</span>
            <h2 className={`${sectionTitleClass} mb-4`}>Tóm tắt</h2>
            <div className="grid gap-3 text-sm text-[#333333]">
              <SummaryRow label="Loại phiếu" value={ticketKindLabel(kind)} />
              <SummaryRow label="Mã phiếu" value={ticketPreviewCode || 'Đang sinh mã'} />
              {kind === 'installation' ? (
                <SummaryRow label="Thiết bị" value={installationDeviceSummary.summary || 'Chưa chọn'} />
              ) : (
                <div className="grid gap-2 border-b border-[#eeeeee] pb-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>Thiết bị</span><strong className="text-[#1f1f1f]">{selectedMachineIds.length ? `${selectedMachineIds.length} máy` : 'Chưa chọn'}</strong>
                  </div>
                  {selectedMachineIds.map((id, index) => {
                    const machine = [...visibleMachines, ...machineOptions.map((option) => option.row)].find((item) => item.id === id);
                    const shortName = machine ? [machine.serialNumber || machine.machineCode, machineModelName(machine)].filter(Boolean).join(' · ') : id;
                    return <div className="break-words rounded-lg bg-[#f8fafc] px-2.5 py-2 text-xs font-semibold leading-5 text-[#475467]" key={id}>Máy {index + 1}: {shortName}</div>;
                  })}
                </div>
              )}
              <SummaryRow label="Khách hàng" value={customerNameForSummary(selectedMachine, customers, form.customerId)} />
              <SummaryRow label="Kỹ sư tham gia" value={engineers.filter((engineer) => form.engineerIds.includes(engineer.id)).map((engineer) => engineer.fullName || engineer.email).join(', ') || 'Chưa phân công'} />
            </div>
          </div>

          {currentStep === 'records' && role === 'engineer' ? (
            <CreateAttachmentsPanel
              draft={attachmentDraft}
              kind={kind}
              onChange={setAttachmentDraft}
            />
          ) : null}

          <div className="rounded-[22px] border border-[#e4e4e7] bg-[#f4f4f5] p-3 shadow-[0_16px_40px_rgba(24,24,27,0.08)]">
            <div className="grid gap-2 sm:grid-cols-2 min-[1320px]:grid-cols-1">
              <button className="secondary-button" onClick={currentStep === 'setup' ? () => navigate(backHref) : goBackStep} type="button">
                {currentStep === 'setup' ? 'Hủy' : 'Quay lại bước trước'}
              </button>
              {currentStep === 'records' ? (
                <button className="primary-button" disabled={saving || loading} type="submit">
                  {saving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
      {saving ? 'Đang tạo' : role === 'admin' ? 'Tạo và phân công phiếu' : 'Trình phê duyệt'}
                </button>
              ) : (
                <button className="primary-button" disabled={loading} onClick={goToRecordsStep} type="button">
                  Tiếp tục · Bước 2
                </button>
              )}
            </div>
          </div>
        </aside>
      </form>
    </PageFrame>
  );
}

function RepairRequestFields({ form, models, updateForm }: { form: TicketForm; models: MachineModelOption[]; updateForm: (patch: Partial<TicketForm>) => void }) {
  const model = models.find((item) => item.id === form.machineModelId);
  const accessoryMode = isEndoscopyMachineModel(model) ? 'endoscopy' : isUltrasoundMachineModel(model) ? 'probe' : 'generic';
  return (
    <>
      <label className={labelClass}>
        Mức ưu tiên
        <select className={fieldClass} onChange={(event) => updateForm({ priority: event.target.value })} value={form.priority}>
          <option value="LOW">Thấp</option>
          <option value="NORMAL">Bình thường</option>
          <option value="HIGH">Cao</option>
          <option value="URGENT">Khẩn cấp</option>
        </select>
      </label>
      <DateInput className={labelClass} label="Ngày báo lỗi" onChange={(value) => updateForm({ reportedAt: value })} value={form.reportedAt} />
      <label className={labelClass}>
        Đơn vị sử dụng
        <input className={fieldClass} onChange={(event) => updateForm({ usingDepartment: event.target.value })} value={form.usingDepartment} />
      </label>
      <label className={labelClass}>
        Người đại diện
        <input className={fieldClass} onChange={(event) => updateForm({ representative: event.target.value })} value={form.representative} />
      </label>
      <label className={labelClass}>
        Chức vụ
        <input className={fieldClass} onChange={(event) => updateForm({ representativePosition: event.target.value })} value={form.representativePosition} />
      </label>
      <label className={labelClass}>
        Số điện thoại
        <input className={fieldClass} onChange={(event) => updateForm({ contactPhone: event.target.value })} value={form.contactPhone} />
      </label>
      <label className={labelClass}>
        Thời hạn bảo hành
        <select className={fieldClass} onChange={(event) => updateForm({ warrantyStatus: event.target.value })} value={form.warrantyStatus}>
          <option value="IN_WARRANTY">Còn bảo hành</option>
          <option value="OUT_OF_WARRANTY">Hết bảo hành</option>
        </select>
      </label>
      <label className={labelClass}>
        Thời hạn bảo hành
        <input className={fieldClass} onChange={(event) => updateForm({ warrantyTerm: event.target.value })} value={form.warrantyTerm} />
      </label>
      <label className={wideLabelClass}>
        Địa chỉ
        <input className={fieldClass} onChange={(event) => updateForm({ address: event.target.value })} value={form.address} />
      </label>
      <ModelDeviceSelect form={form} models={models} updateForm={updateForm} />
      <label className={labelClass}>
        S/N
        <input className={fieldClass} onChange={(event) => updateForm({ serialNumber: event.target.value })} value={form.serialNumber} />
      </label>
      <label className={wideLabelClass}>
        Mô tả lỗi
        <textarea className={textareaClass} onChange={(event) => updateForm({ description: event.target.value })} value={form.description} />
      </label>
      <label className={wideLabelClass}>
        Tình trạng lúc nhận
        <textarea className={textareaClass} onChange={(event) => updateForm({ conditionAssessment: event.target.value })} value={form.conditionAssessment} />
      </label>
      <div className="md:col-span-2">
        <MachineAccessoryEditor mode={accessoryMode} onChange={(receivedAccessories) => updateForm({ receivedAccessories })} value={form.receivedAccessories} />
      </div>
      <label className={wideLabelClass}>
        Nguyên nhân sơ bộ
        <textarea className={textareaClass} onChange={(event) => updateForm({ preliminaryCause: event.target.value })} value={form.preliminaryCause} />
      </label>
      <label className={wideLabelClass}>
        Phương pháp sửa chữa <span className="text-[#9a1b2e]">*</span>
        <textarea className={textareaClass} onChange={(event) => updateForm({ repairMethod: event.target.value })} value={form.repairMethod} />
      </label>
      <label className={wideLabelClass}>
        Hư hỏng, biện pháp khắc phục và chi phí
        <textarea className={textareaClass} onChange={(event) => updateForm({ repairCostItems: event.target.value })} value={form.repairCostItems} />
      </label>
      <label className={labelClass}>
        Tổng chi phí sửa chữa
        <input className={fieldClass} onChange={(event) => updateForm({ totalRepairCost: event.target.value })} value={form.totalRepairCost} />
      </label>
      <label className={labelClass}>
        Chi phí bằng chữ
        <input className={fieldClass} onChange={(event) => updateForm({ repairCostInWords: event.target.value })} value={form.repairCostInWords} />
      </label>
      <label className={wideLabelClass}>
        Kết quả xử lý <span className="text-[#9a1b2e]">*</span>
        <textarea className={textareaClass} onChange={(event) => updateForm({ resultNote: event.target.value })} value={form.resultNote} />
      </label>
      <label className={wideLabelClass}>
        Phản hồi khách hàng
        <textarea className={textareaClass} onChange={(event) => updateForm({ customerFeedback: event.target.value })} value={form.customerFeedback} />
      </label>
    </>
  );
}

function ServiceCreateOperationalGuide({ currentStep, kind, isEngineer }: { currentStep: CreateTicketStep; kind: TicketKind; isEngineer: boolean }) {
  const steps: Array<{ id: CreateTicketStep; number: string; title: string }> = [
    { id: 'setup', number: '1', title: ticketKindLabel(kind) },
    { id: 'records', number: '2', title: isEngineer ? 'Hồ sơ & nội dung công việc' : 'Khách hàng & thiết bị' },
  ];

  return (
    <section aria-label="Tiến độ tạo phiếu" className="grid gap-3 rounded-[24px] border border-[#e4e4e7] bg-white p-3 shadow-[0_8px_24px_rgba(24,24,27,0.04)] md:grid-cols-2">
      {steps.map((step) => {
        const isActive = step.id === currentStep;
        return (
          <div
            className={`grid min-h-[76px] grid-cols-[38px_minmax(0,1fr)] items-center gap-3 rounded-xl border p-3 ${
              isActive ? 'border-primary/30 bg-[#fbf0f1] text-[#821427]' : 'border-[#e7e2dc] bg-[#faf9f7] text-[#1f1f1f]'
            }`}
            key={step.id}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${isActive ? 'bg-primary text-white' : 'bg-white text-[#57534e] shadow-[inset_0_0_0_1px_#e7e2dc]'}`}>
              {step.number}
            </span>
            <div className="min-w-0">
              <strong className="block truncate text-sm font-extrabold">{step.title}</strong>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function MaintenanceRequestFields({ form, models, updateForm }: { form: TicketForm; models: MachineModelOption[]; updateForm: (patch: Partial<TicketForm>) => void }) {
  const model = models.find((item) => item.id === form.machineModelId);
  const accessoryMode = isEndoscopyMachineModel(model) ? 'endoscopy' : isUltrasoundMachineModel(model) ? 'probe' : 'generic';
  return (
    <>
      <label className={labelClass}>
        Loại bảo trì
        <select className={fieldClass} onChange={(event) => updateForm({ maintenanceType: event.target.value })} value={form.maintenanceType}>
          <option value="PERIODIC">Định kỳ</option>
          <option value="WARRANTY">Bảo hành</option>
          <option value="CONTRACT">Hợp đồng</option>
          <option value="INTERNAL">Nội bộ</option>
          <option value="OTHER">Khác</option>
        </select>
      </label>
      <DateInput className={labelClass} label="Ngày bảo trì" onChange={(value) => updateForm({ scheduledDate: value })} value={form.scheduledDate} />
      <DateInput className={labelClass} label="Lịch tiếp theo" onChange={(value) => updateForm({ nextDueDate: value })} value={form.nextDueDate} />
      <label className={labelClass}>
        Đơn vị sử dụng
        <input className={fieldClass} onChange={(event) => updateForm({ usingDepartment: event.target.value })} value={form.usingDepartment} />
      </label>
      <label className={labelClass}>
        Người đại diện
        <input className={fieldClass} onChange={(event) => updateForm({ representative: event.target.value })} value={form.representative} />
      </label>
      <label className={labelClass}>
        Số điện thoại
        <input className={fieldClass} onChange={(event) => updateForm({ contactPhone: event.target.value })} value={form.contactPhone} />
      </label>
      <label className={wideLabelClass}>
        Địa chỉ
        <input className={fieldClass} onChange={(event) => updateForm({ address: event.target.value })} value={form.address} />
      </label>
      <ModelDeviceSelect form={form} models={models} updateForm={updateForm} />
      <label className={labelClass}>
        S/N
        <input className={fieldClass} onChange={(event) => updateForm({ serialNumber: event.target.value })} value={form.serialNumber} />
      </label>
      <label className={wideLabelClass}>
        Checklist công việc <span className="text-[#9a1b2e]">*</span>
        <textarea className={textareaClass} onChange={(event) => updateForm({ checklist: event.target.value })} value={form.checklist} />
      </label>
      <div className="md:col-span-2">
        <MachineAccessoryEditor mode={accessoryMode} onChange={(receivedAccessories) => updateForm({ receivedAccessories })} value={form.receivedAccessories} />
      </div>
      <label className={wideLabelClass}>
        Ghi chú bảo trì
        <textarea className={textareaClass} onChange={(event) => updateForm({ description: event.target.value })} value={form.description} />
      </label>
      <label className={wideLabelClass}>
        Kết quả bảo trì <span className="text-[#9a1b2e]">*</span>
        <textarea className={textareaClass} onChange={(event) => updateForm({ resultNote: event.target.value })} value={form.resultNote} />
      </label>
    </>
  );
}

function ModelDeviceSelect({ form, models, updateForm }: { form: TicketForm; models: MachineModelOption[]; updateForm: (patch: Partial<TicketForm>) => void }) {
  const selectedModel = models.find((model) => model.id === form.machineModelId);

  return (
    <div className="grid gap-3 md:col-span-2">
      <label className={wideLabelClass}>
        Model
        <select
          className={fieldClass}
          onChange={(event) => {
            const model = models.find((option) => option.id === event.target.value);
            updateForm({
              machineId: '',
              machineModelId: event.target.value,
              modelName: model?.name || model?.displayName || model?.code || '',
              deviceName: machineProductName(model) || machineDisplayName(model) || model?.displayName || model?.name || model?.code || '',
            });
          }}
          value={form.machineModelId}
        >
          <option value="">Chọn model (không bắt buộc)</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.code || model.displayName || model.name}
            </option>
          ))}
        </select>
      </label>
      <ModelInfoFields model={selectedModel} />
    </div>
  );
}

function InstallationFields({
  addDeviceItem,
  engineers,
  form,
  loadDeviceAccessories,
  machineOptions,
  machines,
  models,
  removeDeviceItem,
  updateDeviceItem,
  updateForm,
  user,
}: {
  addDeviceItem: () => void;
  engineers: EngineerOption[];
  form: TicketForm;
  loadDeviceAccessories: (index: number, machineId: string) => void;
  machineOptions: Array<PickerOption<MachineOption>>;
  machines: MachineOption[];
  models: MachineModelOption[];
  removeDeviceItem: (index: number) => void;
  updateDeviceItem: (index: number, patch: Partial<InstallationDeviceItem>) => void;
  updateForm: (patch: Partial<TicketForm>) => void;
  user: ApiUser;
}) {
  const selectedMachine = machines.find((machine) => machine.id === form.machineId) || machineOptions.find((option) => option.value === form.machineId)?.row;
  const accessoryModel = models.find((model) => model.id === form.machineModelId) || selectedMachine?.machineModel;
  const extraMachineOptions = machineOptions.filter((option) => option.value !== form.machineId && machinePickerRowFilter('installation', '', user, option.row));

  return (
    <>
      <h3 className="text-base font-bold text-[#172033] md:col-span-2">Máy chính</h3>
      {form.machineId ? (
        <div className="rounded-2xl border border-[#dbeafe] bg-[#f8fbff] p-4 md:col-span-2">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#42638f]">Máy chính đã chọn</span>
          <div className="mt-2 grid gap-2 text-sm font-semibold text-[#172033] md:grid-cols-3">
            <span className="rounded-xl bg-white px-3 py-2">{selectedMachine?.machineCode || 'Chưa có mã máy'}</span>
            <span className="rounded-xl bg-white px-3 py-2">{selectedMachine?.modelName || selectedMachine?.name || form.modelName || 'Chưa có model'}</span>
            <span className="rounded-xl bg-white px-3 py-2">{selectedMachine?.serialNumber ? `S/N ${selectedMachine.serialNumber}` : 'Chưa có S/N'}</span>
          </div>
        </div>
      ) : (
        <>
          <ModelDeviceSelect form={form} models={models} updateForm={updateForm} />
          <label className={labelClass}>
            S/N máy chính
            <input className={fieldClass} onChange={(event) => updateForm({ serialNumber: event.target.value })} value={form.serialNumber} />
          </label>
        </>
      )}
      <div className="grid gap-3 rounded-2xl border border-[#e4e4e7] bg-[#faf9f7] p-4 md:col-span-2 md:grid-cols-2">
        <h3 className="text-base font-bold text-[#172033] md:col-span-2">Thời gian & bảo hành</h3>
        <DateInput className={labelClass} label="Ngày lắp đặt" onChange={(value) => updateForm({ scheduledDate: value, warrantyStartDate: value })} value={form.scheduledDate} />
        <DateInput className={labelClass} label="Bắt đầu bảo hành" onChange={(value) => updateForm({ warrantyStartDate: value })} value={form.warrantyStartDate} />
        <DateInput className={labelClass} label="Hạn bảo hành" onChange={(value) => updateForm({ warrantyEndDate: value })} value={form.warrantyEndDate} />
      </div>
      <div className="md:col-span-2">
        <MachineAccessoryEditor
          mode={isEndoscopyMachineModel(accessoryModel) ? 'endoscopy' : isUltrasoundMachineModel(accessoryModel) ? 'probe' : 'generic'}
          onChange={(installationAccessories) => updateForm({ installationAccessories })}
          value={form.installationAccessories}
        />
      </div>
      <div className="md:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#172033]">Thiết bị bàn giao thêm</h3>
            {form.installedDeviceItems.length ? (
              <span className="mt-1 inline-flex rounded-full bg-[#eef4fb] px-2.5 py-1 text-xs font-semibold text-[#42638f]">
                {form.installedDeviceItems.length} thiết bị ngoài máy chính
              </span>
            ) : null}
          </div>
          <button className="secondary-button compact" onClick={addDeviceItem} type="button">
            Thêm thiết bị
          </button>
        </div>
        <div className="grid gap-3">
          {form.installedDeviceItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-5 text-sm font-medium text-[#64748b]">
              Chưa có thiết bị kèm.
            </div>
          ) : null}
          {form.installedDeviceItems.map((item, index) => (
            <div className="rounded-[18px] border border-[#dbe6f3] bg-[#fbfdff] p-3" key={index}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <strong className="text-sm text-[#172033]">Thiết bị {index + 1}</strong>
                <button className="secondary-button compact" onClick={() => removeDeviceItem(index)} type="button">
                  Xóa
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <AsyncEntityPicker<MachineOption>
                  className="xl:col-span-3"
                  endpoint={machinePickerEndpoint('installation', '')}
                  formatOption={(machine) => ({
                    label: machineLabel(machine),
                    row: machine,
                    value: machine.id,
                  })}
                  initialOptions={extraMachineOptions}
                  inputClassName={fieldClass}
                  label="Chọn thiết bị có sẵn"
                  onChange={(value, machine) => {
                    updateDeviceItem(
                      index,
                      machine
                        ? {
                            sourceMachineId: machine.id,
                            itemName: machine.name || machine.modelName || '',
                            model: machine.modelName || machine.machineModel?.name || machine.name || '',
                            serialNumber: machine.serialNumber || '',
                            quantity: 1,
                          }
                        : { sourceMachineId: value },
                    );
                    if (machine) {
                      loadDeviceAccessories(index, machine.id);
                    }
                  }}
                  placeholder="Tìm máy"
                  rowFilter={(machine) => machine.id !== form.machineId && machinePickerRowFilter('installation', '', user, machine)}
                  value={item.sourceMachineId}
                />
                <label className={labelClass}>
                  Model
                  <select
                    className={fieldClass}
                    onChange={(event) => {
                      const model = models.find((option) => option.id === event.target.value);
                      updateDeviceItem(index, {
                        sourceMachineId: '',
                        itemName: machineProductName(model) || item.itemName,
                        model: machineModelName(model),
                      });
                    }}
                    value={modelIdByName(models, item.model)}
                  >
                    <option value="">Chọn model</option>
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {modelLabel(model)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Tên sản phẩm
                  <input className={fieldClass} onChange={(event) => updateDeviceItem(index, { itemName: event.target.value })} value={item.itemName} />
                </label>
                <label className={labelClass}>
                  S/N
                  <input className={fieldClass} onChange={(event) => updateDeviceItem(index, { serialNumber: event.target.value })} value={item.serialNumber} />
                </label>
                <DateInput className={labelClass} label="NSX" onChange={(value) => updateDeviceItem(index, { manufactureDate: value })} value={item.manufactureDate} />
                <label className={labelClass}>
                  Số lượng
                  <input className={fieldClass} min={1} onChange={(event) => updateDeviceItem(index, { quantity: Number(event.target.value) || 1 })} type="number" value={item.quantity} />
                </label>
                <label className={labelClass}>
                  Bảo hành
                  <input className={fieldClass} onChange={(event) => updateDeviceItem(index, { warrantyPeriod: event.target.value })} value={item.warrantyPeriod} />
                </label>
                <div className="md:col-span-2 xl:col-span-3">
                  <MachineAccessoryEditor
                    mode={isEndoscopyMachineModel({ name: item.model }) ? 'endoscopy' : isUltrasoundMachineModel({ name: item.model }) ? 'probe' : 'generic'}
                    onChange={(accessoriesText) => updateDeviceItem(index, { accessoriesText, accessoriesConfigured: true })}
                    value={item.accessoriesText || ''}
                  />
                </div>
                <fieldset className="grid gap-2 md:col-span-2 xl:col-span-3">
                  <legend className="text-xs font-bold text-[#475569]">Kỹ sư phụ trách máy này</legend>
                  <div className="flex flex-wrap gap-2">
                    {engineers.map((engineer) => {
                      const checked = item.engineerIds.includes(engineer.id);
                      return (
                        <label key={engineer.id} className="flex items-center gap-2 rounded-lg border border-[#e4e4e7] bg-white px-3 py-2 text-xs font-medium">
                          <input
                            checked={checked}
                            onChange={() => updateDeviceItem(index, {
                              engineerIds: checked ? item.engineerIds.filter((id) => id !== engineer.id) : [...item.engineerIds, engineer.id],
                            })}
                            type="checkbox"
                          />
                          {engineer.fullName || engineer.email}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 rounded-2xl border border-[#e4e4e7] bg-[#faf9f7] p-4 md:col-span-2 md:grid-cols-2">
        <h3 className="text-base font-bold text-[#172033] md:col-span-2">Thông tin bàn giao</h3>
        <label className={wideLabelClass}>
          Địa chỉ lắp đặt
          <input className={fieldClass} onChange={(event) => updateForm({ receiverInstallAddress: event.target.value })} required value={form.receiverInstallAddress} />
        </label>
        <label className={wideLabelClass}>
          Ghi chú địa chỉ
          <input className={fieldClass} onChange={(event) => updateForm({ addressNote: event.target.value })} value={form.addressNote} />
        </label>
        <label className={labelClass}>
          Người nhận
          <input className={fieldClass} onChange={(event) => updateForm({ receiverRepresentative: event.target.value })} required value={form.receiverRepresentative} />
        </label>
        <label className={labelClass}>
          Chức vụ người nhận
          <input className={fieldClass} onChange={(event) => updateForm({ receiverPosition: event.target.value })} value={form.receiverPosition} />
        </label>
        <label className={labelClass}>
          Điện thoại
          <input className={fieldClass} onChange={(event) => updateForm({ receiverPhone: event.target.value })} required value={form.receiverPhone} />
        </label>
        <label className={labelClass}>
          Người lắp đặt
          <input className={fieldClass} onChange={(event) => updateForm({ handoverInstallerName: event.target.value })} required value={form.handoverInstallerName} />
        </label>
        <label className={labelClass}>
          Chức vụ người lắp
          <input className={fieldClass} onChange={(event) => updateForm({ handoverInstallerPosition: event.target.value })} value={form.handoverInstallerPosition} />
        </label>
        <label className={labelClass}>
          Phương tiện
          <input className={fieldClass} onChange={(event) => updateForm({ handoverVehicle: event.target.value })} value={form.handoverVehicle} />
        </label>
        <DateInput className={labelClass} label="Ngày đi" onChange={(value) => updateForm({ handoverDepartureDate: value })} value={form.handoverDepartureDate} />
        <label className={labelClass}>
          Tình trạng máy
          <select className={fieldClass} onChange={(event) => updateForm({ deviceCondition: event.target.value })} value={form.deviceCondition}>
            <option value="NEW_100">Mới 100%</option>
            <option value="OTHER">Khác</option>
          </select>
        </label>
        {form.deviceCondition === 'OTHER' ? (
          <label className={wideLabelClass}>
            Chi tiết tình trạng
            <input className={fieldClass} onChange={(event) => updateForm({ deviceConditionNote: event.target.value })} value={form.deviceConditionNote} />
          </label>
        ) : null}
      </div>
      <label className={wideLabelClass}>
        Ghi chú lắp đặt
        <textarea className={textareaClass} onChange={(event) => updateForm({ description: event.target.value })} value={form.description} />
      </label>
    </>
  );
}

function QuickCustomerPanel({
  creating,
  form,
  onCreate,
  provinces,
  updateForm,
}: {
  creating: boolean;
  form: QuickCustomerForm;
  onCreate: () => void;
  provinces: ProvinceOption[];
  updateForm: (patch: Partial<QuickCustomerForm>) => void;
}) {
  return (
    <div className="mt-4 grid min-w-0 gap-5 rounded-[20px] border border-[#dbe6f3] bg-[#fbfdff] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] md:grid-cols-2">
      <label className={labelClass}>
        Tên khách hàng
        <input className={fieldClass} onChange={(event) => updateForm({ name: event.target.value })} value={form.name} />
      </label>
      <label className={labelClass}>
        Tỉnh/Thành
        <select
          className={fieldClass}
          onChange={(event) => {
            const province = provinces.find((item) => item.id === event.target.value);
            updateForm({ province: province?.name || '', provinceId: event.target.value, district: '', locality: '', ward: '' });
          }}
          required
          value={form.provinceId}
        >
          <option value="">Chọn tỉnh/thành</option>
          {provinces.map((province) => (
            <option key={province.id} value={province.id}>
              {[province.name, province.branch?.name || 'Chưa phân chi nhánh'].join(' · ')}
            </option>
          ))}
        </select>
      </label>
      <div className="grid min-w-0 gap-4 md:col-span-2 md:grid-cols-3">
        <VietnamAddressSelects
          fieldClassName={fieldClass}
          labelClassName={labelClass}
          onChange={(patch) => updateForm(patch)}
          showProvince={false}
          value={form}
        />
      </div>
      <label className={`${labelClass} md:col-span-2`}>
        Ghi chú địa chỉ
        <input className={fieldClass} onChange={(event) => updateForm({ addressNote: event.target.value })} value={form.addressNote} />
      </label>
      <label className={labelClass}>
        Người liên hệ
        <input className={fieldClass} onChange={(event) => updateForm({ contactPerson: event.target.value })} value={form.contactPerson} />
      </label>
      <label className={labelClass}>
        Số điện thoại
        <input className={fieldClass} onChange={(event) => updateForm({ phone: event.target.value })} value={form.phone} />
      </label>
      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#dbe6f3] bg-white px-4 py-3 text-sm font-semibold text-[#667985]">
        <span className="min-w-0 flex-1 truncate">{buildFullVietnamAddress(form) || 'Chưa có địa chỉ'}</span>
        {buildFullVietnamAddress(form) ? <GoogleMapsDirectionsButton address={buildFullVietnamAddress(form)} className="secondary-button compact" /> : null}
      </div>
      <div className="md:col-span-2">
        <button className="primary-button" disabled={creating} onClick={onCreate} type="button">
          {creating ? 'Đang tạo khách hàng' : 'Tạo khách hàng và chọn'}
        </button>
      </div>
    </div>
  );
}

function QuickMachinePanel({
  creating,
  customerName,
  form,
  hasTicketCustomer,
  kind,
  models,
  onCreate,
  previewCode,
  selectedModel,
  accessoryMode,
  updateForm,
}: {
  accessoryMode: 'probe' | 'endoscopy' | null;
  creating: boolean;
  customerName: string;
  form: QuickMachineForm;
  hasTicketCustomer: boolean;
  kind: TicketKind;
  models: MachineModelOption[];
  onCreate: () => void;
  previewCode: string;
  selectedModel?: MachineModelOption;
  updateForm: (patch: Partial<QuickMachineForm>) => void;
}) {
  return (
    <div className="mt-3 grid min-w-0 gap-3 overflow-hidden rounded-2xl border border-[#dbe6f3] bg-[#fbfdff] p-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <strong className="text-sm font-bold text-[#344054]">{kind === 'installation' ? 'Đăng ký thiết bị mới' : 'Đăng ký máy khách đang sử dụng'}</strong>
      </div>
      <label className={`${labelClass} md:col-span-2`}>
        Model
        <select
          className={fieldClass}
          onChange={(event) => {
            const model = models.find((item) => item.id === event.target.value);
            updateForm({
              machineModelId: event.target.value,
              modelName: model?.name || model?.code || '',
              name: machineProductName(model) || machineDisplayName(model) || model?.displayName || model?.name || model?.code || '',
            });
          }}
          value={form.machineModelId}
        >
          <option value="">Chọn model</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {modelLabel(model)}
            </option>
          ))}
        </select>
      </label>
      {selectedModel ? (
        <>
          <ModelInfoFields className="md:col-span-2" model={selectedModel} />
          <label className={labelClass}>
            Serial Number
            <input className={fieldClass} onChange={(event) => updateForm({ serialNumber: event.target.value })} value={form.serialNumber} />
          </label>
          <label className={labelClass}>
            Mã máy
            <input className={fieldClass} disabled value={previewCode || 'Đang sinh mã...'} />
          </label>
          <div className={`${labelClass} rounded-2xl border border-[#dbe6f3] bg-white px-3 py-2.5`}>
            Khách hàng
            <strong className="mt-1 block min-h-10 rounded-xl bg-[#f8fafc] px-3 py-2 text-sm text-[#172033]">
              {hasTicketCustomer ? customerName : 'Chưa chọn khách hàng'}
            </strong>
          </div>
          <div className="border-t border-[#dbe6f3] pt-4 md:col-span-2">
          <MachineAccessoryEditor compact mode={accessoryMode ?? 'generic'} onChange={(value) => updateForm({ accessoriesText: value })} value={form.accessoriesText} />
          </div>
          <div className="md:col-span-2">
            <button className="primary-button" disabled={creating} onClick={onCreate} type="button">
              {creating ? 'Đang tạo thiết bị' : 'Tạo thiết bị và chọn'}
            </button>
          </div>
        </>
      ) : (
        <p className="md:col-span-2 text-xs font-medium text-[#667085]">Chọn model để nhập số sê-ri và đăng ký máy.</p>
      )}
    </div>
  );
}

function ModelGridSelect({
  className = '',
  models,
  onChange,
  value,
}: {
  className?: string;
  models: MachineModelOption[];
  onChange: (modelId: string, model?: MachineModelOption) => void;
  value: string;
}) {
  const [query, setQuery] = useState('');
  const selectedModel = models.find((model) => model.id === value);
  const filteredModels = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return models;

    return models.filter((model) =>
      [model.code, model.name, model.displayName, model.manufacturer, model.businessLine?.name, model.businessLine?.productIndustry?.name]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(keyword)),
    );
  }, [models, query]);

  return (
    <div className={`grid min-w-0 gap-2 overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="grid min-w-[240px] flex-1 gap-2 text-sm font-semibold text-[#333333]">
          Model
          <input
            className={fieldClass}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm model"
            value={query}
          />
        </label>
      </div>
      <ModelInfoFields model={selectedModel} />

      <div className="min-w-0 overflow-hidden rounded-2xl border border-[#dbe6f3] bg-white">
        <div className="max-h-[260px] overflow-auto">
          {filteredModels.map((model) => {
            const active = model.id === value;
            return (
              <button
                className={[
                  'flex w-full min-w-0 items-center justify-between gap-3 border-b border-[#eef2f7] px-3 py-3 text-left transition last:border-b-0',
                  active ? 'bg-[#eff6ff]' : 'bg-white hover:bg-[#f8fafc]',
                ].filter(Boolean).join(' ')}
                key={model.id}
                onClick={() => onChange(model.id, model)}
                type="button"
              >
                <strong className="min-w-0 truncate text-sm text-[#172033]">{model.code || model.displayName || model.name}</strong>
                {active ? <span className="shrink-0 rounded-full bg-[#dbeafe] px-2 py-1 text-xs font-bold text-[#1d4ed8]">Đã chọn</span> : null}
              </button>
            );
          })}
          {!filteredModels.length ? (
            <div className="p-5 text-center text-sm font-semibold text-[#64748b]">
              Không có model phù hợp.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#eeeeee] pb-2 last:border-b-0 last:pb-0">
      <span>{label}</span>
      <strong className="text-right text-[#1f1f1f]">{value || '-'}</strong>
    </div>
  );
}

function CreateAttachmentsPanel({
  draft,
  kind,
  onChange,
}: {
  draft: CreateAttachmentDraft;
  kind: TicketKind;
  onChange: (draft: CreateAttachmentDraft) => void;
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = draft.files.map((file) => file.type.startsWith('image/') ? URL.createObjectURL(file) : '');
    setPreviewUrls(urls);
    return () => urls.filter(Boolean).forEach((url) => URL.revokeObjectURL(url));
  }, [draft.files]);

  function appendFiles(fileList: FileList | null) {
    if (!fileList) return;
    onChange({ ...draft, files: [...draft.files, ...Array.from(fileList)] });
  }

  const options = attachmentOptionsByKind[kind];
  const previewFile = previewIndex === null ? null : draft.files[previewIndex];

  return (
    <section className={sidePanelClass}>
      <div className="mb-4 border-b border-[#eeeeee] pb-3">
        <span className={eyebrowClass}>Tài liệu hiện trường</span>
        <h2 className={sectionTitleClass}>Ảnh và biên bản</h2>
      </div>
      <div className="grid gap-3">
        <label className={labelClass}>
          Loại tài liệu
          <select className={fieldClass} onChange={(event) => onChange({ ...draft, type: event.target.value as AttachmentType })} value={draft.type}>
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Tên hiển thị
          <input className={fieldClass} onChange={(event) => onChange({ ...draft, title: event.target.value })} value={draft.title} />
        </label>
        <label className={labelClass}>
          Ghi chú
          <textarea className={`${textareaClass} !min-h-20`} onChange={(event) => onChange({ ...draft, description: event.target.value })} value={draft.description} />
        </label>
        <div className="flex flex-wrap gap-2">
          <label className="secondary-button compact cursor-pointer">
            <Camera size={16} /> Chụp ảnh
            <input accept="image/*" capture="environment" className="sr-only" onChange={(event) => { appendFiles(event.currentTarget.files); event.currentTarget.value = ''; }} type="file" />
          </label>
          <label className="secondary-button compact cursor-pointer">
            <ImagePlus size={16} /> Tải ảnh/tài liệu
            <input accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="sr-only" multiple onChange={(event) => { appendFiles(event.currentTarget.files); event.currentTarget.value = ''; }} type="file" />
          </label>
        </div>
        {draft.files.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 min-[1320px]:grid-cols-2">
            {draft.files.map((file, index) => (
              <figure className="relative min-w-0 overflow-hidden rounded-xl border border-[#e4e7ec] bg-white" key={`${file.name}-${file.lastModified}-${index}`}>
                {file.type.startsWith('image/') ? (
                  <button className="block aspect-[4/3] w-full bg-[#f2f4f7]" onClick={() => setPreviewIndex(index)} title="Xem ảnh" type="button">
                    {previewUrls[index] ? <img alt={file.name} className="h-full w-full object-cover" src={previewUrls[index]} /> : null}
                  </button>
                ) : <div className="grid aspect-[4/3] place-items-center bg-[#f8fafc] px-2 text-center text-xs font-semibold text-[#475467]">{file.name}</div>}
                <figcaption className="truncate px-2 py-1.5 text-xs font-medium text-[#475467]" title={file.name}>{file.name}</figcaption>
                <button aria-label={`Xóa tệp ${file.name}`} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-[#b42318] shadow" onClick={() => onChange({ ...draft, files: draft.files.filter((_, fileIndex) => fileIndex !== index) })} title="Xóa tệp" type="button"><X size={15} /></button>
              </figure>
            ))}
          </div>
        ) : <p className="text-sm text-[#667085]">Chưa chọn ảnh hoặc tài liệu.</p>}
      </div>
      {previewFile && previewUrls[previewIndex ?? -1] ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4" onClick={() => setPreviewIndex(null)} role="presentation">
          <section aria-label={`Xem ảnh ${previewFile.name}`} aria-modal="true" className="relative grid max-h-[92vh] w-full max-w-5xl place-items-center rounded-2xl bg-white p-3 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog">
            <button aria-label="Đóng ảnh" className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white" onClick={() => setPreviewIndex(null)} type="button"><X size={20} /></button>
            <img alt={previewFile.name} className="max-h-[84vh] max-w-full object-contain" src={previewUrls[previewIndex ?? -1]} />
            <p className="mt-2 max-w-full truncate text-sm font-medium text-[#344054]">{previewFile.name}</p>
          </section>
        </div>
      ) : null}
    </section>
  );
}

const panelClass = 'rounded-[24px] border border-[#e4e4e7] bg-white/95 p-5 shadow-[0_8px_24px_rgba(24,24,27,0.05)] sm:p-6';
const sidePanelClass = 'rounded-[24px] border border-[#e4e4e7] bg-[#ffffff] p-5 shadow-[0_8px_24px_rgba(24,24,27,0.04)]';
const stepBadgeClass = 'flex h-8 w-8 items-center justify-center rounded-xl bg-[#18181b] text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(24,24,27,0.24)]';
const eyebrowClass = 'text-xs font-bold uppercase tracking-[0.16em] text-[#18181b]';
const sectionTitleClass = 'mt-1 text-lg font-bold leading-tight text-[#1f1f1f]';
const labelClass = 'grid min-w-0 content-start gap-2 font-sans text-sm font-semibold leading-snug text-[#333333]';
const wideLabelClass = `${labelClass} md:col-span-2`;
const fieldClass =
  'h-12 w-full min-w-0 rounded-2xl border border-[#ded8d8] bg-[#ffffff] px-4 font-sans text-sm font-semibold text-[#1f1f1f] outline-none transition placeholder:text-[#9aa6b5] focus:border-[#18181b] focus:bg-white focus:shadow-[0_0_0_4px_rgba(24,24,27,0.12)] disabled:cursor-not-allowed disabled:bg-[#fafafa] disabled:text-[#8a8a8a]';
const textareaClass =
  'min-h-32 w-full min-w-0 resize-y rounded-2xl border border-[#ded8d8] bg-[#ffffff] px-4 py-3 font-sans text-sm font-semibold leading-relaxed text-[#1f1f1f] outline-none transition placeholder:text-[#9aa6b5] focus:border-[#18181b] focus:bg-white focus:shadow-[0_0_0_4px_rgba(24,24,27,0.12)] disabled:cursor-not-allowed disabled:bg-[#fafafa] disabled:text-[#8a8a8a]';

function normalizeKind(value: string | null): TicketKind {
  if (value === 'maintenance' || value === 'installation') return value;
  return 'repair';
}

function emptyTicketForm(user: ApiUser, kind: TicketKind): TicketForm {
  const date = today();
  const selfAssignedEngineer = getRoleName(user) === 'engineer' ? [user.id] : [];
  return {
    address: '',
    addressNote: '',
    installationAccessories: '',
    checklist: '',
    conditionAssessment: '',
    contactPhone: '',
    customerFeedback: '',
    customerId: '',
    customerContactId: '',
    description: '',
    deviceName: '',
    engineerId: selfAssignedEngineer[0] || '',
    engineerIds: selfAssignedEngineer,
    machineId: '',
    machineModelId: '',
    maintenanceType: 'PERIODIC',
    modelName: '',
    nextDueDate: '',
    priority: 'NORMAL',
    preliminaryCause: '',
    repairMethod: '',
    receivedAccessories: '',
    repairCostInWords: '',
    repairCostItems: '',
    reportedAt: kind === 'repair' ? date : '',
    resultNote: '',
    representative: '',
    representativePosition: '',
    scheduledDate: kind !== 'repair' ? date : '',
    serialNumber: '',
    title: kind === 'repair' ? 'Phiếu sửa chữa' : kind === 'maintenance' ? 'Phiếu bảo trì' : '',
    totalRepairCost: '',
    usingDepartment: '',
    warrantyTerm: '',
    warrantyEndDate: '',
    warrantyStartDate: kind === 'installation' ? date : '',
    warrantyStatus: 'IN_WARRANTY',
    installedDeviceItems: kind === 'installation' ? [] : [emptyInstallationDeviceItem()],
    handoverInstallerName: getRoleName(user) === 'engineer' ? user.fullName || '' : '',
    handoverInstallerPosition: '',
    handoverVehicle: '',
    handoverDepartureDate: kind === 'installation' ? date : '',
    receiverInstallAddress: '',
    receiverRepresentative: '',
    receiverPosition: '',
    receiverPhone: '',
    deviceCondition: 'NEW_100',
    deviceConditionNote: '',
  };
}

function applyTicketTemplate(form: TicketForm, template: string): TicketForm {
  if (template !== 'receive-device') return form;

  return {
    ...form,
    title: form.title || 'Phiếu nhận thiết bị',
    description: form.description || 'Tiếp nhận thiết bị để kiểm tra/sửa chữa.',
  };
}

function emptyInstallationDeviceItem(): InstallationDeviceItem {
  return {
    itemName: '',
    model: '',
    serialNumber: '',
    manufactureDate: '',
    quantity: 1,
    isInstalled: false,
    sourceMachineId: '',
    warrantyPeriod: '',
    engineerIds: [],
    accessoriesText: '',
    accessoriesConfigured: false,
  };
}

function emptyQuickCustomerForm(_user: ApiUser): QuickCustomerForm {
  return {
    address: '',
    addressNote: '',
    contactPerson: '',
    district: '',
    locality: '',
    name: '',
    phone: '',
    province: '',
    provinceId: '',
    ward: '',
  };
}

function emptyQuickMachineForm(): QuickMachineForm {
  return {
    accessoriesText: '',
    customerId: '',
    machineModelId: '',
    modelName: '',
    name: '',
    serialNumber: '',
  };
}

type CreatedServiceTicket = { id?: string; code?: string };

async function createTicket(kind: TicketKind, form: TicketForm, visibleMachineModels: MachineModelOption[], usedParts: UsedPartDraft[]): Promise<CreatedServiceTicket> {
  if (kind === 'repair') {
    return apiFetch<CreatedServiceTicket>('/repairs', {
      method: 'POST',
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        machineId: form.machineId || undefined,
        customerId: form.customerId || undefined,
        engineerId: form.engineerId || undefined,
        engineerIds: form.engineerIds,
        priority: form.priority,
        reportedAt: form.reportedAt || undefined,
        usingDepartment: form.usingDepartment.trim() || undefined,
        representative: form.representative.trim() || undefined,
        representativePosition: form.representativePosition.trim() || undefined,
        address: form.address.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        deviceName: form.deviceName.trim() || undefined,
        modelName: form.modelName.trim() || undefined,
        serialNumber: form.serialNumber.trim() || undefined,
        warrantyStatus: form.warrantyStatus,
        warrantyTerm: form.warrantyTerm.trim() || undefined,
        receivedAccessories: form.receivedAccessories.trim() || undefined,
        preliminaryCause: form.preliminaryCause.trim() || undefined,
        conditionAssessment: form.conditionAssessment.trim() || undefined,
        repairMethod: form.repairMethod.trim() || undefined,
        resultNote: form.resultNote.trim() || undefined,
        customerFeedback: form.customerFeedback.trim() || undefined,
        repairCostItems: form.repairCostItems.trim() || undefined,
        totalRepairCost: form.totalRepairCost.trim() || undefined,
        repairCostInWords: form.repairCostInWords.trim() || undefined,
        usedParts: normalizeUsedPartsPayload(usedParts),
      }),
    });
  }

  if (kind === 'maintenance') {
    return apiFetch<CreatedServiceTicket>('/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        type: form.maintenanceType,
        machineId: form.machineId || undefined,
        customerId: form.customerId || undefined,
        engineerId: form.engineerId || undefined,
        engineerIds: form.engineerIds,
        scheduledDate: form.scheduledDate,
        nextDueDate: form.nextDueDate || undefined,
        checklist: splitLines(form.checklist),
        receivedAccessories: form.receivedAccessories.trim() || undefined,
        resultNote: form.resultNote.trim() || undefined,
        usingDepartment: form.usingDepartment.trim() || undefined,
        representative: form.representative.trim() || undefined,
        address: form.address.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        deviceName: form.deviceName.trim() || undefined,
        modelName: form.modelName.trim() || undefined,
        serialNumber: form.serialNumber.trim() || undefined,
        usedParts: normalizeUsedPartsPayload(usedParts),
      }),
    });
  }

  const primaryModel = visibleMachineModels.find((model) => model.id === form.machineModelId);
  const deviceSummary = buildInstallationDeviceSummary(form);

  return apiFetch<CreatedServiceTicket>('/installations', {
    method: 'POST',
    body: JSON.stringify({
      machineId: form.machineId || undefined,
      machineModelId: primaryModel?.id || form.machineModelId || undefined,
      machineSerialNumber: form.machineId ? undefined : form.serialNumber.trim() || undefined,
      machineName: form.machineId ? undefined : form.deviceName.trim() || undefined,
      plannedModelName:
        deviceSummary.primaryName ||
        machineProductName(primaryModel) ||
        visibleMachineModels.find((model) => model.id === form.machineModelId)?.name ||
        form.modelName.trim() ||
        undefined,
      customerId: form.customerId,
      installedById: form.engineerId || undefined,
      engineerIds: form.engineerIds,
      installedAt: form.scheduledDate,
      warrantyStartDate: form.warrantyStartDate || form.scheduledDate,
      ...(form.warrantyEndDate ? { warrantyEndDate: form.warrantyEndDate } : {}),
      note: [form.description.trim(), form.addressNote.trim() ? `Ghi chú địa chỉ: ${form.addressNote.trim()}` : ''].filter(Boolean).join('\n') || undefined,
      accessories: accessoryItemsAsLines(form.installationAccessories),
      handoverInstallerName: form.handoverInstallerName.trim() || undefined,
      handoverInstallerPosition: form.handoverInstallerPosition.trim() || undefined,
      handoverVehicle: form.handoverVehicle.trim() || undefined,
      handoverDepartureDate: form.handoverDepartureDate || undefined,
      receiverInstallAddress: form.receiverInstallAddress.trim() || undefined,
      receiverRepresentative: form.receiverRepresentative.trim() || undefined,
      receiverPosition: form.receiverPosition.trim() || undefined,
      receiverPhone: form.receiverPhone.trim() || undefined,
      deviceCondition: form.deviceCondition || undefined,
      deviceConditionNote: form.deviceConditionNote.trim() || undefined,
      warrantyNote: form.description.trim() || undefined,
      installedDeviceItems: normalizeInstallationDeviceItems(form.installedDeviceItems),
    }),
  });
}

async function createMultipleServiceTickets(
  kind: Exclude<TicketKind, 'installation'>,
  form: TicketForm,
  machineIds: string[],
  machines: MachineOption[],
  visibleMachineModels: MachineModelOption[],
  usedParts: UsedPartDraft[],
) {
  const created: CreatedServiceTicket[] = [];
  const failures: string[] = [];
  const failedMachineIds: string[] = [];
  for (const machineId of machineIds) {
    const machine = machines.find((item) => item.id === machineId);
    const machineForm = {
      ...form,
      machineId,
      deviceName: machine?.name || form.deviceName,
      modelName: machine?.modelName || machine?.machineModel?.name || form.modelName,
      serialNumber: machine?.serialNumber || form.serialNumber,
    };
    try {
      created.push(await createTicket(kind, machineForm, visibleMachineModels, usedParts));
    } catch (error) {
      const name = machine ? machineLabel(machine) : machineId;
      failedMachineIds.push(machineId);
      failures.push(`${name}: ${error instanceof Error ? error.message : 'lỗi không xác định'}`);
    }
  }
  return { created, failures, failedMachineIds };
}

async function uploadCreatedAttachments(
  tickets: CreatedServiceTicket[],
  kind: TicketKind,
  draft: CreateAttachmentDraft,
) {
  const entityType = kind === 'repair' ? 'Repair' : kind === 'maintenance' ? 'Maintenance' : 'MachineInstallation';
  const failures: string[] = [];
  for (const ticket of tickets) {
    if (!ticket.id) {
      failures.push(ticket.code || 'Phiếu vừa tạo');
      continue;
    }
    for (const file of draft.files) {
      const body = new FormData();
      body.append('entityType', entityType);
      body.append('entityId', ticket.id);
      body.append('type', draft.type);
      const title = draft.title.trim();
      if (title) body.append('title', draft.files.length > 1 ? `${title} - ${file.name}` : title);
      if (draft.description.trim()) body.append('description', draft.description.trim());
      body.append('file', file);
      try {
        await apiFetch('/attachments', { method: 'POST', body });
      } catch {
        failures.push(ticket.code || ticket.id);
        break;
      }
    }
  }
  return failures;
}

function accessoryItemsAsLines(value: string) {
  return parseMachineAccessoriesInput(value)
    .map((item) => [item.name || item.code, item.serialNumber ? `S/N ${item.serialNumber}` : '', item.quantity ? `SL ${item.quantity}` : '', item.description || ''].filter(Boolean).join(' | '))
    .filter(Boolean);
}

function normalizeInstallationDeviceItems(items: InstallationDeviceItem[]) {
  return items
    .map((item) => ({
      itemName: item.itemName.trim(),
      model: item.model.trim() || undefined,
      manufacturer: item.manufacturer?.trim() || undefined,
      productCategory: item.productCategory || undefined,
      serialNumber: item.serialNumber.trim() || undefined,
      manufactureDate: item.manufactureDate || undefined,
      quantity: Number(item.quantity) || 1,
      warrantyPeriod: item.warrantyPeriod.trim() || undefined,
      sourceMachineId: item.sourceMachineId || undefined,
      ...(item.engineerIds.length ? { engineerIds: item.engineerIds } : {}),
      ...(item.accessoriesConfigured
        ? { accessories: parseMachineAccessoriesInput(item.accessoriesText || '') }
        : {}),
    }))
    .filter((item) => item.itemName);
}

function buildInstallationDeviceSummary(form: TicketForm) {
  const primaryName = form.deviceName.trim() || form.modelName.trim();
  const primarySummary = [primaryName, form.serialNumber.trim() ? `S/N ${form.serialNumber.trim()}` : ''].filter(Boolean).join(' - ');
  const extraCount = form.installedDeviceItems.filter((item) => item.itemName.trim() || item.model.trim() || item.serialNumber.trim()).length;

  if (primaryName || form.serialNumber.trim()) {
    return {
      primaryName,
      summary: extraCount ? `${primarySummary || primaryName} + ${extraCount} thiết bị khác` : primarySummary || primaryName,
    };
  }

  return {
    primaryName: '',
    summary: extraCount ? `${extraCount} thiết bị bàn giao thêm, chưa chọn máy chính` : '',
  };
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function unpackList<T>(result: Paginated<T> | T[]) {
  return Array.isArray(result) ? result : result.data;
}

function compactSearchParams(params: Record<string, string>) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value));
}

function canEngineerUseMachine(user: ApiUser, machine: MachineOption) {
  const expertiseGroups = user.engineerProfile?.expertiseGroups?.length
    ? user.engineerProfile.expertiseGroups
    : user.engineerProfile?.expertiseGroup ? [user.engineerProfile.expertiseGroup] : [];
  if (getRoleName(user) !== 'engineer' || !expertiseGroups.length) return true;

  const machineGroup =
    machine.businessLine?.productIndustry?.expertiseGroup ??
    machine.businessLine?.expertiseGroup ??
    machine.machineModel?.businessLine?.productIndustry?.expertiseGroup ??
    machine.machineModel?.businessLine?.expertiseGroup;

  return !machineGroup || expertiseGroups.includes(machineGroup as 'IMAGING' | 'LAB_TESTING');
}

function machinePickerEndpoint(kind: TicketKind, customerId: string) {
  const params = new URLSearchParams({ limit: '20' });
  if (kind !== 'installation') {
    params.set('inventoryStatus', 'INSTALLED');
    if (customerId) params.set('customerId', customerId);
  }
  return `/machines?${params.toString()}`;
}

function machinePickerRowFilter(kind: TicketKind, customerId: string, user: ApiUser, machine: MachineOption) {
  if (!canEngineerUseMachine(user, machine)) return false;

  if (kind === 'installation') {
    return !['INSTALLED', 'SOLD'].includes(machine.inventoryStatus || '');
  }

  return machine.inventoryStatus === 'INSTALLED' && (!customerId || machine.customer?.id === customerId);
}

function canEngineerUseModel(user: ApiUser, model: MachineModelOption) {
  void user;
  void model;
  return true;
}

function ticketKindLabel(kind: TicketKind) {
  if (kind === 'maintenance') return 'Bảo trì';
  if (kind === 'installation') return 'Lắp đặt';
  return 'Sửa chữa';
}

function customerLabel(customer: CustomerOption) {
  return [customer.customerCode, customer.name, customer.province, customer.phone].filter(Boolean).join(' - ');
}

function mergePickerOptions<Row>(options: Array<PickerOption<Row>>) {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (!option.value || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function machineLabel(machine: MachineOption) {
  return [machine.machineCode, machine.serialNumber, machine.modelName || machine.name, machine.customer?.name].filter(Boolean).join(' - ');
}

function modelLabel(model: MachineModelOption) {
  return machineModelOptionLabel(model) || model.code || model.displayName || model.name;
}

function modelOrigin(model: MachineModelOption) {
  return model.countryOfOrigin || model.businessLine?.countryOfOrigin || '';
}

function modelIdByName(models: MachineModelOption[], value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  return models.find((model) =>
    [model.code, model.displayName, model.name, machineModelOptionLabel(model)]
      .filter(Boolean)
      .some((item) => String(item).trim().toLowerCase() === normalized),
  )?.id || '';
}

function customerNameForSummary(machine: MachineOption | undefined, customers: CustomerOption[], customerId: string) {
  return machine?.customer?.name || customers.find((customer) => customer.id === customerId)?.name || 'Chưa chọn';
}

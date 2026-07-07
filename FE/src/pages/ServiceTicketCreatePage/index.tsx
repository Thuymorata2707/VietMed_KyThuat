import { ArrowLeft, ChevronDown, ChevronUp, Loader2, Plus, Save } from 'lucide-react';
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
import { GoogleMapsDirectionsButton, VietnamAddressSelects, buildFullVietnamAddress } from '../../components/VietnamAddressSelects';
import { isEndoscopyMachineModel } from '../../config/endoscopyAccessories';
import { isUltrasoundMachineModel } from '../../config/ultrasoundProbes';
import { queryKeys } from '../../lib/queryKeys';
import { parseMachineAccessoriesInput } from '../../utils/machineAccessories';
import { machineDisplayName, machineModelName, machineModelOptionLabel, machineProductName } from '../../utils/machineDisplayName';
import { isTechnicalUser } from '../../utils/technicalUsers';
import { AsyncEntityPicker, type PickerOption } from '../EngineerTasksPage/components/AsyncEntityPicker';

type TicketKind = 'repair' | 'maintenance' | 'installation';
type TicketScope = 'installation' | 'service';

type Region = { id: string; name: string };
type CustomerOption = {
  id: string;
  customerCode?: string | null;
  name: string;
  phone?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  province?: string | null;
  address?: string | null;
  fullAddress?: string | null;
  region?: Region | null;
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
  checklist: string;
  conditionAssessment: string;
  contactPhone: string;
  customerFeedback: string;
  customerId: string;
  description: string;
  deviceName: string;
  engineerId: string;
  machineId: string;
  machineModelId: string;
  maintenanceType: string;
  modelName: string;
  nextDueDate: string;
  priority: string;
  repairMethod: string;
  reportedAt: string;
  representative: string;
  scheduledDate: string;
  serialNumber: string;
  title: string;
  usingDepartment: string;
  warrantyEndDate: string;
  warrantyStartDate: string;
  warrantyStatus: string;
  installedDeviceItems: InstallationDeviceItem[];
};

type InstallationDeviceItem = {
  itemName: string;
  model: string;
  serialNumber: string;
  manufactureDate: string;
  quantity: number;
  warrantyPeriod: string;
};

type QuickCustomerForm = {
  address: string;
  contactPerson: string;
  district: string;
  name: string;
  phone: string;
  province: string;
  regionId: string;
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
  regions: Region[];
};

const today = () => new Date().toISOString().slice(0, 10);

export function ServiceTicketCreatePage({ fixedKind, user }: { fixedKind?: TicketKind; user: ApiUser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialKind = fixedKind ?? normalizeKind(searchParams.get('kind'));
  const initialMachineId = searchParams.get('machineId') ?? '';
  const initialCustomerId = searchParams.get('customerId') ?? '';
  const initialWarrantyStatus = searchParams.get('warrantyStatus') ?? '';
  const returnTo = searchParams.get('returnTo') ?? '';
  const role = getRoleName(user);
  const [kind, setKind] = useState<TicketKind>(initialKind);
  const [form, setForm] = useState<TicketForm>(() => emptyTicketForm(user, initialKind));
  const [quickCustomerForm, setQuickCustomerForm] = useState<QuickCustomerForm>(() => emptyQuickCustomerForm(user));
  const [quickMachineForm, setQuickMachineForm] = useState<QuickMachineForm>(() => emptyQuickMachineForm());
  const [customerOptions, setCustomerOptions] = useState<Array<PickerOption<CustomerOption>>>([]);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [showQuickMachine, setShowQuickMachine] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const scope = fixedKind === 'installation' || initialKind === 'installation' ? 'installation' : 'service';

  const optionsQuery = useQuery({
    queryKey: queryKeys.serviceTickets.createOptions,
    queryFn: async (): Promise<CreateTicketOptions> => {
      const [customersResult, modelsResult] = await Promise.all([
        apiFetch<Paginated<CustomerOption>>('/customers?limit=20'),
        apiFetchAllPages<MachineModelOption>('/machine-models'),
      ]);

      if (role === 'engineer') {
        return {
          customers: customersResult.data,
          engineers: [{ id: user.id, email: user.email, fullName: user.fullName }],
          machineModels: modelsResult,
          regions: user.region?.id ? [{ id: user.region.id, name: user.region.name }] : [],
        };
      }

      const [engineersResult, regionsResult] = await Promise.all([
        apiFetch<Paginated<EngineerOption>>('/users?limit=100&status=ACTIVE'),
        apiFetch<Paginated<Region> | Region[]>('/regions?limit=100'),
      ]);

      return {
        customers: customersResult.data,
        engineers: engineersResult.data.filter(isTechnicalUser),
        machineModels: modelsResult,
        regions: unpackList(regionsResult),
      };
    },
  });

  const machinesQuery = useQuery({
    queryKey: queryKeys.serviceTickets.machines(kind),
    queryFn: async () => {
      if (kind !== 'installation') {
        const result = await apiFetch<Paginated<MachineOption>>('/machines?limit=100&inventoryStatus=INSTALLED');
        return result.data.filter((machine) => canEngineerUseMachine(user, machine));
      }

      const results = await Promise.all(
        ['IN_STOCK', 'RESERVED', 'RETURNED'].map((inventoryStatus) =>
          apiFetch<Paginated<MachineOption>>(`/machines?limit=100&inventoryStatus=${inventoryStatus}`),
        ),
      );
      return mergeMachines(results.flatMap((result) => result.data)).filter((machine) => canEngineerUseMachine(user, machine));
    },
  });

  const customers = optionsQuery.data?.customers ?? [];
  const engineers = optionsQuery.data?.engineers ?? [];
  const regions = optionsQuery.data?.regions ?? [];
  const machineModels = optionsQuery.data?.machineModels ?? [];
  const machines = machinesQuery.data ?? [];

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

  const visibleMachines = useMemo(
    () =>
      machines
        .filter((machine) => canEngineerUseMachine(user, machine))
        .filter((machine) => kind === 'installation' || !form.customerId || machine.customer?.id === form.customerId),
    [form.customerId, kind, machines, user],
  );
  const visibleMachineModels = useMemo(() => machineModels.filter((model) => canEngineerUseModel(user, model)), [machineModels, user]);
  const selectedMachine = useMemo(() => visibleMachines.find((machine) => machine.id === form.machineId), [form.machineId, visibleMachines]);
  const installationDeviceSummary = useMemo(
    () => buildInstallationDeviceSummary(form, visibleMachineModels),
    [form, visibleMachineModels],
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
      const regionId = quickCustomerForm.regionId.trim();
      const selectedRegion = regions.find((region) => region.id === regionId);

      if (!name || !regionId) {
        throw new Error('Vui lòng nhập tên khách hàng và chọn khu vực.');
      }

      return apiFetch<CustomerOption>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone: quickCustomerForm.phone.trim() || undefined,
          contactPerson: quickCustomerForm.contactPerson.trim() || undefined,
          contactPhone: quickCustomerForm.phone.trim() || undefined,
          province: quickCustomerForm.province.trim() || selectedRegion?.name || undefined,
          district: quickCustomerForm.district.trim() || undefined,
          ward: quickCustomerForm.ward.trim() || undefined,
          address: quickCustomerForm.address.trim() || undefined,
          fullAddress: buildFullVietnamAddress(quickCustomerForm) || undefined,
          regionId,
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
      setSuccess('Đã tạo khách hàng và chọn vào phiếu.');
      await queryClient.invalidateQueries({ queryKey: ['resources', '/customers'] });
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
      setForm((current) => ({
        ...current,
        machineId: machine.id,
        customerId: current.customerId || machine.customer?.id || '',
        deviceName: current.deviceName || machine.name || quickMachineForm.modelName,
        modelName: current.modelName || machine.modelName || quickMachineForm.modelName,
        serialNumber: current.serialNumber || machine.serialNumber || quickMachineForm.serialNumber,
      }));
      setQuickMachineForm(emptyQuickMachineForm());
      setShowQuickMachine(false);
      setSuccess('Đã tạo thiết bị và chọn vào phiếu.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['service-tickets', 'machines'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.productCatalog.overview }),
      ]);
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: () => createTicket(kind, form, visibleMachineModels),
    onSuccess: async () => {
      setSuccess(role === 'engineer' ? 'Đã tạo phiếu. Admin sẽ kiểm tra thông tin máy nếu cần.' : 'Đã tạo phiếu.');
      setForm(emptyTicketForm(user, kind));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['service-tickets', 'board'] }),
        queryClient.invalidateQueries({ queryKey: ['work-assignments', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] }),
      ]);
      window.setTimeout(() => navigate(backHref), 450);
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
      ...emptyTicketForm(user, kind),
      customerId: current.customerId || initialCustomerId,
      engineerId: current.engineerId,
      machineId: '',
      warrantyStatus: initialWarrantyStatus || current.warrantyStatus,
    }));
  }, [fixedKind, initialCustomerId, initialMachineId, initialWarrantyStatus, kind, returnTo]);

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

  function addInstallationDeviceItem() {
    setForm((current) => ({
      ...current,
      installedDeviceItems: [...current.installedDeviceItems, emptyInstallationDeviceItem()],
    }));
  }

  function removeInstallationDeviceItem(index: number) {
    setForm((current) => ({
      ...current,
      installedDeviceItems:
        current.installedDeviceItems.length === 1
          ? [emptyInstallationDeviceItem()]
          : current.installedDeviceItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function selectMachine(machineId: string) {
    const machine = machines.find((item) => item.id === machineId);
    applyMachine(machine, machineId);
  }

  function selectCustomer(customerId: string) {
    const customer = customers.find((item) => item.id === customerId) || customerOptions.find((item) => item.value === customerId)?.row;
    applyCustomer(customer, customerId);
  }

  function applyCustomer(customer?: CustomerOption, fallbackCustomerId = customer?.id ?? '') {
    updateForm({
      customerId: customer?.id || fallbackCustomerId,
      usingDepartment: customer?.name || form.usingDepartment,
      representative: customer?.contactPerson || form.representative,
      address: customer?.fullAddress || customer?.address || form.address,
      contactPhone: customer?.contactPhone || customer?.phone || form.contactPhone,
    });
    setQuickMachineForm((current) => ({ ...current, customerId: customer?.id || fallbackCustomerId || current.customerId }));
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

  function applyMachine(machine?: MachineOption, fallbackMachineId = machine?.id ?? '') {
    updateForm({
      machineId: machine?.id || fallbackMachineId,
      customerId: machine?.customer?.id || form.customerId,
      deviceName: machine?.name || form.deviceName,
      modelName: machine?.modelName || form.modelName,
      machineModelId: machine?.machineModel?.id || '',
      serialNumber: machine?.serialNumber || form.serialNumber,
    });
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

    try {
      await createTicketMutation.mutateAsync();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không tạo được phiếu.');
    }
  }

  return (
    <PageFrame>
      <div className="flex flex-wrap items-start justify-between gap-4 font-sans">
        <PageTitle
          eyebrow="Phiếu dịch vụ"
          title="Tạo phiếu"
          description="Tạo phiếu nghiệp vụ, dữ liệu mới sẽ chờ admin kiểm tra."
        />
        <button className="secondary-button" onClick={() => navigate(backHref)} type="button">
          <ArrowLeft size={17} />
          Quay lại
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      {role === 'engineer' ? (
        <div className="rounded-lg border border-[#efd8a8] bg-[#fffbeb] px-4 py-3 text-sm font-semibold leading-relaxed text-[#92400e]">
          Phiếu mới sẽ được lưu để admin kiểm tra và phân công khi cần.
        </div>
      ) : null}

      <form className="grid min-w-0 gap-5 font-sans min-[1320px]:grid-cols-[minmax(0,1fr)_380px]" onSubmit={submit}>
        <section className="grid min-w-0 gap-5">
          <div className={panelClass}>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[#e4e4e7] pb-4">
              <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-3">
                <span className={stepBadgeClass}>1</span>
                <div>
                  <span className={eyebrowClass}>Thông tin phiếu</span>
                  <h2 className={sectionTitleClass}>Chọn nghiệp vụ và người phụ trách</h2>
                  <p className={sectionDescriptionClass}>Chọn loại phiếu, thiết bị và kỹ sư.</p>
                </div>
              </div>
              <label className="grid min-w-[220px] max-sm:min-w-0 max-sm:w-full gap-2 text-sm font-semibold text-[#333333]">
                Loại phiếu
                <select className={fieldClass} onChange={(event) => setKind(event.target.value as TicketKind)} value={kind}>
                  {scope === 'installation' ? (
                    <option value="installation">Lắp đặt</option>
                  ) : (
                    <>
                      <option value="repair">Sửa chữa</option>
                      <option value="maintenance">Bảo trì</option>
                    </>
                  )}
                </select>
              </label>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {kind !== 'installation' ? (
                <label className={wideLabelClass}>
                  Tiêu đề
                  <input className={fieldClass} onChange={(event) => updateForm({ title: event.target.value })} required value={form.title} />
                </label>
              ) : null}

              {kind !== 'installation' ? (
                <label className={wideLabelClass}>
                  Thiết bị có sẵn
                  <select className={fieldClass} disabled={loading} onChange={(event) => selectMachine(event.target.value)} value={form.machineId}>
                    <option value="">Không bắt buộc</option>
                    {visibleMachines.map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machineLabel(machine)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {kind === 'installation' ? (
                <label className={wideLabelClass}>
                  Máy đã có hồ sơ
                  <select className={fieldClass} disabled={loading} onChange={(event) => selectMachine(event.target.value)} value={form.machineId}>
                    <option value="">Không bắt buộc, chọn máy nếu đã có trong dữ liệu</option>
                    {visibleMachines.map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machineLabel(machine)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {kind !== 'installation' ? (
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
                  placeholder="Tìm tên, mã khách hàng, tỉnh hoặc số điện thoại"
                  value={form.customerId}
                />
              ) : null}

              {kind === 'installation' ? (
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
                  placeholder="Tìm tên, mã khách hàng, tỉnh hoặc số điện thoại"
                  required
                  value={form.customerId}
                />
              ) : null}

              <label className={labelClass}>
                Kỹ sư phụ trách
                <select className={fieldClass} disabled={loading || role === 'engineer'} onChange={(event) => updateForm({ engineerId: event.target.value })} required={kind === 'installation'} value={form.engineerId}>
                  <option value="">Chưa phân công</option>
                  {engineers.map((engineer) => (
                    <option key={engineer.id} value={engineer.id}>
                      {engineer.fullName || engineer.email}
                    </option>
                  ))}
                </select>
              </label>

              {kind === 'repair' ? (
                <RepairFields form={form} models={visibleMachineModels} updateForm={updateForm} />
              ) : kind === 'maintenance' ? (
                <MaintenanceFields form={form} models={visibleMachineModels} updateForm={updateForm} />
              ) : (
                <InstallationFields
                  addDeviceItem={addInstallationDeviceItem}
                  form={form}
                  models={visibleMachineModels}
                  removeDeviceItem={removeInstallationDeviceItem}
                  updateDeviceItem={updateInstallationDeviceItem}
                  updateForm={updateForm}
                />
              )}
            </div>
          </div>

          <div className={panelClass}>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[#e4e4e7] pb-4">
              <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-3">
                <span className={stepBadgeClass}>2</span>
                <div>
                  <span className={eyebrowClass}>Dữ liệu chưa có</span>
                  <h2 className={sectionTitleClass}>Tạo nhanh khi cần</h2>
                  <p className={sectionDescriptionClass}>Tạo nhanh khi không tìm thấy dữ liệu.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="secondary-button" onClick={() => setShowQuickCustomer((value) => !value)} type="button">
                  <Plus size={16} />
                  Khách hàng
                  {showQuickCustomer ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                <button className="secondary-button" onClick={() => setShowQuickMachine((value) => !value)} type="button">
                  <Plus size={16} />
                  Thiết bị
                  {showQuickMachine ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              </div>
            </div>

            {showQuickCustomer ? (
              <QuickCustomerPanel
                creating={creatingCustomer}
                form={quickCustomerForm}
                isEngineer={role === 'engineer'}
                onCreate={createCustomer}
                regions={regions}
                updateForm={(patch) => setQuickCustomerForm((current) => ({ ...current, ...patch }))}
              />
            ) : null}

            {showQuickMachine ? (
              <QuickMachinePanel
                creating={creatingMachine}
                customerName={customerNameForSummary(undefined, customers, form.customerId)}
                hasTicketCustomer={Boolean(form.customerId)}
                form={quickMachineForm}
                kind={kind}
                models={visibleMachineModels}
                onCreate={createMachine}
                selectedModel={selectedModel}
                supportsAccessories={Boolean(quickMachineAccessoryMode)}
                accessoryMode={quickMachineAccessoryMode}
                updateForm={(patch) => setQuickMachineForm((current) => ({ ...current, ...patch }))}
              />
            ) : null}
          </div>
        </section>

        <aside className="grid min-w-0 gap-4 self-start min-[1320px]:sticky min-[1320px]:top-5">
          <div className={sidePanelClass}>
            <span className={eyebrowClass}>Kiểm tra</span>
            <h2 className={`${sectionTitleClass} mb-4`}>Tóm tắt</h2>
            <div className="grid gap-3 text-sm text-[#333333]">
              <SummaryRow label="Loại phiếu" value={ticketKindLabel(kind)} />
              <SummaryRow label="Thiết bị" value={kind === 'installation' ? installationDeviceSummary.summary || 'Chưa chọn' : selectedMachine ? machineLabel(selectedMachine) : 'Chưa chọn'} />
              <SummaryRow label="Khách hàng" value={customerNameForSummary(selectedMachine, customers, form.customerId)} />
              <SummaryRow label="Kỹ sư" value={engineers.find((engineer) => engineer.id === form.engineerId)?.fullName || 'Chưa phân công'} />
            </div>
          </div>

          <div className="rounded-[22px] border border-[#e4e4e7] bg-[#f4f4f5] p-3 shadow-[0_16px_40px_rgba(24,24,27,0.08)]">
            <div className="grid gap-2 sm:grid-cols-2 min-[1320px]:grid-cols-1">
            <button className="secondary-button" onClick={() => navigate(backHref)} type="button">
              Hủy
            </button>
            <button className="primary-button" disabled={saving || loading} type="submit">
              {saving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
              {saving ? 'Đang tạo' : 'Tạo phiếu'}
            </button>
            </div>
          </div>
        </aside>
      </form>
    </PageFrame>
  );
}

function RepairFields({ form, models, updateForm }: { form: TicketForm; models: MachineModelOption[]; updateForm: (patch: Partial<TicketForm>) => void }) {
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
        Kiểm tra tình trạng thiết bị
        <textarea className={textareaClass} onChange={(event) => updateForm({ conditionAssessment: event.target.value })} value={form.conditionAssessment} />
      </label>
      <label className={wideLabelClass}>
        Phương pháp sửa chữa
        <textarea className={textareaClass} onChange={(event) => updateForm({ repairMethod: event.target.value })} value={form.repairMethod} />
      </label>
    </>
  );
}

function MaintenanceFields({ form, models, updateForm }: { form: TicketForm; models: MachineModelOption[]; updateForm: (patch: Partial<TicketForm>) => void }) {
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
      <DateInput className={labelClass} label="Ngày bảo trì" onChange={(value) => updateForm({ scheduledDate: value })} required value={form.scheduledDate} />
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
        Checklist
        <textarea className={textareaClass} onChange={(event) => updateForm({ checklist: event.target.value })} placeholder="Mỗi dòng là một hạng mục kiểm tra" value={form.checklist} />
      </label>
      <label className={wideLabelClass}>
        Ghi chú
        <textarea className={textareaClass} onChange={(event) => updateForm({ description: event.target.value })} value={form.description} />
      </label>
    </>
  );
}

function ModelDeviceSelect({ form, models, updateForm }: { form: TicketForm; models: MachineModelOption[]; updateForm: (patch: Partial<TicketForm>) => void }) {
  const selectedModel = models.find((model) => model.id === form.machineModelId);

  return (
    <div className="grid gap-3 md:col-span-2">
      <label className={wideLabelClass}>
        Model / tên thiết bị
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
          <option value="">Không bắt buộc, chọn model nếu chưa chọn thiết bị có sẵn</option>
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
  form,
  models,
  removeDeviceItem,
  updateDeviceItem,
  updateForm,
}: {
  addDeviceItem: () => void;
  form: TicketForm;
  models: MachineModelOption[];
  removeDeviceItem: (index: number) => void;
  updateDeviceItem: (index: number, patch: Partial<InstallationDeviceItem>) => void;
  updateForm: (patch: Partial<TicketForm>) => void;
}) {
  return (
    <>
      <DateInput className={labelClass} label="Ngày lắp đặt" onChange={(value) => updateForm({ scheduledDate: value, warrantyStartDate: value })} required value={form.scheduledDate} />
      <DateInput className={labelClass} label="Bắt đầu bảo hành" onChange={(value) => updateForm({ warrantyStartDate: value })} value={form.warrantyStartDate} />
      <DateInput className={labelClass} label="Kết thúc bảo hành" onChange={(value) => updateForm({ warrantyEndDate: value })} required value={form.warrantyEndDate} />
      <ModelDeviceSelect form={form} models={models} updateForm={updateForm} />
      <label className={labelClass}>
        S/N máy chính
        <input className={fieldClass} disabled={Boolean(form.machineId)} onChange={(event) => updateForm({ serialNumber: event.target.value })} value={form.serialNumber} />
      </label>
      <div className="md:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#172033]">Thiết bị bàn giao thêm</h3>
            <p className="mt-1 text-xs font-medium text-[#64748b]">Chỉ thêm thiết bị/phụ kiện bàn giao kèm, không nhập lại máy chính.</p>
          </div>
          <button className="secondary-button compact" onClick={addDeviceItem} type="button">
            Thêm dòng
          </button>
        </div>
        <div className="grid gap-3">
          {form.installedDeviceItems.map((item, index) => (
            <div className="rounded-[18px] border border-[#dbe6f3] bg-[#fbfdff] p-3" key={index}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <strong className="text-sm text-[#172033]">Thiết bị {index + 1}</strong>
                <button className="secondary-button compact" onClick={() => removeDeviceItem(index)} type="button">
                  Xóa
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className={labelClass}>
                  Model
                  <select
                    className={fieldClass}
                    onChange={(event) => {
                      const model = models.find((option) => option.id === event.target.value);
                      updateDeviceItem(index, {
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
                  <input className={fieldClass} onChange={(event) => updateDeviceItem(index, { warrantyPeriod: event.target.value })} placeholder="VD: 12 tháng" value={item.warrantyPeriod} />
                </label>
              </div>
            </div>
          ))}
        </div>
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
  isEngineer,
  onCreate,
  regions,
  updateForm,
}: {
  creating: boolean;
  form: QuickCustomerForm;
  isEngineer: boolean;
  onCreate: () => void;
  regions: Region[];
  updateForm: (patch: Partial<QuickCustomerForm>) => void;
}) {
  return (
    <div className="mb-4 grid min-w-0 gap-4 rounded-[20px] border border-[#dbe6f3] bg-[#fbfdff] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] md:grid-cols-2">
      <label className={labelClass}>
        Tên khách hàng
        <input className={fieldClass} onChange={(event) => updateForm({ name: event.target.value })} value={form.name} />
      </label>
      {isEngineer ? (
        <div className="grid min-w-0 gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm">
          <span className="font-bold text-[#333333]">Tỉnh/Thành / Khu vực</span>
          <strong className="text-[#1f1f1f]">{regions[0]?.name || 'Theo khu vực tài khoản'}</strong>
        </div>
      ) : (
        <label className={labelClass}>
          Tỉnh/Thành / Khu vực
          <select
            className={fieldClass}
            onChange={(event) => {
              const region = regions.find((item) => item.id === event.target.value);
              updateForm({ province: region?.name || '', regionId: event.target.value });
            }}
            value={form.regionId}
          >
            <option value="">Chọn tỉnh/khu vực</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <VietnamAddressSelects
        fieldClassName={fieldClass}
        labelClassName={labelClass}
        onChange={(patch) => updateForm(patch)}
        value={form}
      />
      <label className={labelClass}>
        Người liên hệ
        <input className={fieldClass} onChange={(event) => updateForm({ contactPerson: event.target.value })} value={form.contactPerson} />
      </label>
      <label className={labelClass}>
        Số điện thoại
        <input className={fieldClass} onChange={(event) => updateForm({ phone: event.target.value })} value={form.phone} />
      </label>
      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#dbe6f3] bg-white px-4 py-3 text-sm font-semibold text-[#667985]">
        <span className="min-w-0 flex-1 truncate">{buildFullVietnamAddress(form) || 'Chọn đủ địa chỉ để mở Google Maps nhanh.'}</span>
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
  selectedModel,
  accessoryMode,
  supportsAccessories,
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
  selectedModel?: MachineModelOption;
  supportsAccessories: boolean;
  updateForm: (patch: Partial<QuickMachineForm>) => void;
}) {
  return (
    <div className="grid min-w-0 gap-4 overflow-hidden rounded-[20px] border border-[#dbe6f3] bg-[#fbfdff] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] md:grid-cols-2">
      <div className="md:col-span-2">
        <span className="rounded-full border border-[#c7d2fe] bg-white px-2.5 py-1 text-xs font-bold text-[#334155]">
          {kind === 'installation' ? 'Thêm thiết bị mới' : 'Thêm thiết bị khách đang dùng'}
        </span>
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
          <div className={`${labelClass} rounded-2xl border border-[#dbe6f3] bg-white px-3 py-2.5`}>
            Khách hàng của phiếu
            <strong className="mt-1 block min-h-10 rounded-xl bg-[#f8fafc] px-3 py-2 text-sm text-[#172033]">
              {hasTicketCustomer ? customerName : 'Chưa chọn khách hàng'}
            </strong>
            <span className="mt-1 text-xs font-semibold text-[#64748b]">
              {kind === 'installation' ? 'Máy sẽ gắn khách hàng sau khi duyệt lắp đặt.' : 'Thiết bị dùng theo khách hàng đã chọn trên phiếu.'}
            </span>
          </div>
          <div className="md:col-span-2">
            {supportsAccessories ? (
              <MachineAccessoryEditor compact mode={accessoryMode ?? 'probe'} onChange={(value) => updateForm({ accessoriesText: value })} value={form.accessoriesText} />
            ) : (
              <label className={labelClass}>
                Phụ kiện đi kèm
                <textarea className={textareaClass} onChange={(event) => updateForm({ accessoriesText: event.target.value })} placeholder="Mỗi dòng: Phụ kiện | S/N" value={form.accessoriesText} />
              </label>
            )}
          </div>
          <div className="md:col-span-2">
            <button className="primary-button" disabled={creating} onClick={onCreate} type="button">
              {creating ? 'Đang tạo thiết bị' : 'Tạo thiết bị và chọn'}
            </button>
          </div>
        </>
      ) : (
        <div className="md:col-span-2 rounded-2xl border border-dashed border-[#cbd5e1] bg-white px-4 py-5 text-sm font-semibold text-[#64748b]">
          Chọn model trước, hệ thống sẽ hiện thông tin model và các trường nhập thiết bị.
        </div>
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
          Model / tên thiết bị
          <input
            className={fieldClass}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm model, hãng, ngành hàng"
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

const panelClass = 'rounded-[24px] border border-[#e4e4e7] bg-white/95 p-5 shadow-[0_8px_24px_rgba(24,24,27,0.05)] sm:p-6';
const sidePanelClass = 'rounded-[24px] border border-[#e4e4e7] bg-[#ffffff] p-5 shadow-[0_8px_24px_rgba(24,24,27,0.04)]';
const stepBadgeClass = 'flex h-8 w-8 items-center justify-center rounded-xl bg-[#18181b] text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(24,24,27,0.24)]';
const eyebrowClass = 'text-xs font-bold uppercase tracking-[0.16em] text-[#18181b]';
const sectionTitleClass = 'mt-1 text-lg font-bold leading-tight text-[#1f1f1f]';
const sectionDescriptionClass = 'mt-1 text-xs font-medium leading-5 text-[#8a8f99]';
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
  return {
    address: '',
    checklist: '',
    conditionAssessment: '',
    contactPhone: '',
    customerFeedback: '',
    customerId: '',
    description: '',
    deviceName: '',
    engineerId: getRoleName(user) === 'engineer' ? user.id : '',
    machineId: '',
    machineModelId: '',
    maintenanceType: 'PERIODIC',
    modelName: '',
    nextDueDate: '',
    priority: 'NORMAL',
    repairMethod: '',
    reportedAt: kind === 'repair' ? date : '',
    representative: '',
    scheduledDate: kind !== 'repair' ? date : '',
    serialNumber: '',
    title: '',
    usingDepartment: '',
    warrantyEndDate: '',
    warrantyStartDate: kind === 'installation' ? date : '',
    warrantyStatus: 'IN_WARRANTY',
    installedDeviceItems: [emptyInstallationDeviceItem()],
  };
}

function emptyInstallationDeviceItem(): InstallationDeviceItem {
  return {
    itemName: '',
    model: '',
    serialNumber: '',
    manufactureDate: '',
    quantity: 1,
    warrantyPeriod: '',
  };
}

function emptyQuickCustomerForm(user: ApiUser): QuickCustomerForm {
  return {
    address: '',
    contactPerson: '',
    district: '',
    name: '',
    phone: '',
    province: user.region?.name || '',
    regionId: user.regionId || user.region?.id || '',
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

async function createTicket(kind: TicketKind, form: TicketForm, visibleMachineModels: MachineModelOption[]) {
  if (kind === 'repair') {
    return apiFetch('/repairs', {
      method: 'POST',
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        machineId: form.machineId || undefined,
        customerId: form.customerId || undefined,
        engineerId: form.engineerId || undefined,
        priority: form.priority,
        reportedAt: form.reportedAt || undefined,
        usingDepartment: form.usingDepartment.trim() || undefined,
        representative: form.representative.trim() || undefined,
        address: form.address.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        deviceName: form.deviceName.trim() || undefined,
        modelName: form.modelName.trim() || undefined,
        serialNumber: form.serialNumber.trim() || undefined,
        warrantyStatus: form.warrantyStatus,
        conditionAssessment: form.conditionAssessment.trim() || undefined,
        repairMethod: form.repairMethod.trim() || undefined,
      }),
    });
  }

  if (kind === 'maintenance') {
    return apiFetch('/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        type: form.maintenanceType,
        machineId: form.machineId || undefined,
        customerId: form.customerId || undefined,
        engineerId: form.engineerId || undefined,
        scheduledDate: form.scheduledDate,
        nextDueDate: form.nextDueDate || undefined,
        checklist: splitLines(form.checklist),
        usingDepartment: form.usingDepartment.trim() || undefined,
        representative: form.representative.trim() || undefined,
        address: form.address.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        deviceName: form.deviceName.trim() || undefined,
        modelName: form.modelName.trim() || undefined,
        serialNumber: form.serialNumber.trim() || undefined,
      }),
    });
  }

  const primaryModel = visibleMachineModels.find((model) => model.id === form.machineModelId);
  const deviceSummary = buildInstallationDeviceSummary(form, visibleMachineModels);

  return apiFetch('/installations', {
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
      installedById: form.engineerId,
      installedAt: form.scheduledDate,
      warrantyStartDate: form.warrantyStartDate || form.scheduledDate,
      warrantyEndDate: form.warrantyEndDate,
      note: form.description.trim() || undefined,
      installedDeviceItems: normalizeInstallationDeviceItems(form.installedDeviceItems),
    }),
  });
}

function normalizeInstallationDeviceItems(items: InstallationDeviceItem[]) {
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

function buildInstallationDeviceSummary(form: TicketForm, models: MachineModelOption[]) {
  const primaryName = form.deviceName.trim() || form.modelName.trim();
  const primarySummary = [primaryName, form.serialNumber.trim() ? `S/N ${form.serialNumber.trim()}` : ''].filter(Boolean).join(' - ');
  const extraCount = form.installedDeviceItems.filter((item) => item.itemName.trim() || item.model.trim() || item.serialNumber.trim()).length;

  if (primaryName || form.serialNumber.trim()) {
    return {
      primaryName,
      summary: extraCount ? `${primarySummary || primaryName} + ${extraCount} thiết bị khác` : primarySummary || primaryName,
    };
  }

  const devices = form.installedDeviceItems
    .map((item) => {
      const model = models.find((candidate) => candidate.id === modelIdByName(models, item.model));
      const modelName = model ? modelLabel(model) : item.model.trim();
      const productName = item.itemName.trim() || machineProductName(model);
      const displayName = productName || modelName;

      return {
        name: displayName,
        serialNumber: item.serialNumber.trim(),
      };
    })
    .filter((item) => item.name || item.serialNumber);

  const primary = devices[0];
  const fallbackPrimaryName = primary?.name || '';
  const fallbackPrimarySummary = [fallbackPrimaryName, primary?.serialNumber ? `S/N ${primary.serialNumber}` : ''].filter(Boolean).join(' - ');

  return {
    primaryName: fallbackPrimaryName,
    summary: fallbackPrimarySummary || fallbackPrimaryName,
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
  const expertiseGroup = user.engineerProfile?.expertiseGroup;
  if (getRoleName(user) !== 'engineer' || !expertiseGroup) return true;

  const machineGroup =
    machine.businessLine?.productIndustry?.expertiseGroup ??
    machine.businessLine?.expertiseGroup ??
    machine.machineModel?.businessLine?.productIndustry?.expertiseGroup ??
    machine.machineModel?.businessLine?.expertiseGroup;

  return !machineGroup || machineGroup === expertiseGroup;
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

function mergeMachines(machines: MachineOption[]) {
  const seen = new Set<string>();
  return machines.filter((machine) => {
    if (!machine.id || seen.has(machine.id)) return false;
    seen.add(machine.id);
    return true;
  });
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

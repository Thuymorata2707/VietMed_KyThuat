import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiUser, apiFetch, apiFetchAllPages } from '../../api';
import { DateInput } from '../../components/DateInput';
import { MachineAccessoryEditor } from '../../components/MachineAccessoryEditor';
import { isEndoscopyMachineModel } from '../../config/endoscopyAccessories';
import { isUltrasoundMachineModel } from '../../config/ultrasoundProbes';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { VietnamAddressSelects } from '../../components/VietnamAddressSelects';
import { AsyncEntityPicker, type PickerOption } from '../EngineerTasksPage/components/AsyncEntityPicker';
import { getRoleName } from '../../auth/roles';
import { displayLabel } from '../../utils/displayLabels';
import { parseMachineAccessoriesInput, serializeMachineAccessories } from '../../utils/machineAccessories';
import { isTechnicalUser, technicalUserName } from '../../utils/technicalUsers';

type DemoCreateStep = 'records' | 'handover';

type CustomerOption = {
  id: string;
  customerCode?: string | null;
  name: string;
  hospitalName?: string | null;
  phone?: string | null;
  contactPerson?: string | null;
  contactPosition?: string | null;
  contactPhone?: string | null;
  province?: string | null;
  address?: string | null;
  fullAddress?: string | null;
};

type EngineerOption = {
  id: string;
  email: string;
  fullName?: string | null;
  engineerProfile?: unknown;
  role?: { name?: string | null } | null;
  roleName?: string | null;
  status?: string | null;
};

type ProvinceOption = {
  id: string;
  name: string;
  code: string;
  branch?: { name: string } | null;
};

type MachineOption = {
  id: string;
  machineCode?: string | null;
  serialNumber?: string | null;
  modelName?: string | null;
  name?: string | null;
  inventoryStatus?: string | null;
  status?: string | null;
  demoCategory?: 'DEMO_UNIT' | 'DEMO_STOCK' | 'DEMO_USED' | null;
  demoPreparationStatus?: string | null;
  customer?: CustomerOption | null;
};

type MachineModelOption = {
  id: string;
  code: string;
  name: string;
  displayName?: string | null;
  manufacturer?: string | null;
  productCategory?: string | null;
  businessLine?: { name?: string | null; productCategory?: string | null } | null;
  components?: Array<{
    accessories?: MachineModelAccessoryOption[];
    ComponentAccessory?: MachineModelAccessoryOption[];
  }>;
};

type MachineModelAccessoryOption = {
  id: string;
  code: string;
  name: string;
  quantity?: number | null;
  requiresSerial?: boolean;
};

type DemoLoanForm = {
  customerId: string;
  machineUse: '' | 'DEMO_UNIT' | 'NEW_STOCK' | 'DEMO_USED';
  engineerIds: string[];
  expectedReturnAt: string;
  handoverAddress: string;
  handoverCondition: string;
  handoverNote: string;
  handoverAccessoriesText: string;
  machineId: string;
  plannedHandoverAt: string;
  purpose: string;
  receiverName: string;
  receiverPhone: string;
  receiverPosition: string;
};

type QuickCustomerForm = {
  address: string;
  contactPerson: string;
  customerType: string;
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
  machineCode: string;
  machineModelId: string;
  name: string;
  serialNumber: string;
};

type DemoLoanOptions = {
  customers: CustomerOption[];
  engineers: EngineerOption[];
  machineModels: MachineModelOption[];
  machines: MachineOption[];
  provinces: ProvinceOption[];
};
type SelectedDemoMachine = { machineId: string; machineUse: DemoLoanForm['machineUse'] };

const panelClass = 'grid min-w-0 gap-5 rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.07),0_12px_30px_rgba(24,24,27,0.05)]';
const fieldClass = 'h-12 w-full min-w-0 rounded-2xl border border-[#cbd5e1] bg-white px-3 text-sm font-semibold text-[#172033] outline-none transition focus:border-[#2563eb] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)] disabled:bg-[#f8fafc] disabled:text-[#94a3b8]';
const textAreaClass = 'min-h-[104px] w-full min-w-0 rounded-2xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm font-semibold leading-6 text-[#172033] outline-none transition focus:border-[#2563eb] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]';
const labelClass = 'grid min-w-0 gap-2 text-sm font-semibold text-[#334155]';

export function DemoLoanCreatePage({ user }: { user: ApiUser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/service-tickets';
  const [form, setForm] = useState<DemoLoanForm>(() => emptyDemoLoanForm());
  const [selectedDemoMachines, setSelectedDemoMachines] = useState<SelectedDemoMachine[]>([]);
  const [customerOptions, setCustomerOptions] = useState<Array<PickerOption<CustomerOption>>>([]);
  const [machineOptions, setMachineOptions] = useState<Array<PickerOption<MachineOption>>>([]);
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickMachineOpen, setQuickMachineOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState<QuickCustomerForm>(emptyQuickCustomerForm);
  const [quickMachineForm, setQuickMachineForm] = useState<QuickMachineForm>(emptyQuickMachineForm());
  const [quickMachinePreviewCode, setQuickMachinePreviewCode] = useState('');
  const [currentStep, setCurrentStep] = useState<DemoCreateStep>('records');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const role = getRoleName(user);
  const isEngineer = role === 'engineer';

  const optionsQuery = useQuery({
    queryKey: ['demo-loans', 'create-options'],
    queryFn: async (): Promise<DemoLoanOptions> => {
      const [customers, engineers, machineModels, inStockMachines, returnedMachines, provinces] = await Promise.all([
        apiFetchAllPages<CustomerOption>('/customers'),
        apiFetchAllPages<EngineerOption>('/users?status=ACTIVE'),
        apiFetchAllPages<MachineModelOption>('/machine-models'),
        apiFetchAllPages<MachineOption>('/machines?inventoryStatus=IN_STOCK'),
        apiFetchAllPages<MachineOption>('/machines?inventoryStatus=RETURNED'),
        apiFetchAllPages<ProvinceOption>('/provinces'),
      ]);

      return {
        customers,
        engineers: engineers.filter(isTechnicalUser),
        machineModels,
        machines: mergeMachines([...inStockMachines, ...returnedMachines]),
        provinces,
      };
    },
  });

  const customers = optionsQuery.data?.customers ?? [];
  const engineers = optionsQuery.data?.engineers ?? [];
  const machineModels = optionsQuery.data?.machineModels ?? [];
  const selectedQuickMachineModel = machineModels.find((model) => model.id === quickMachineForm.machineModelId);

  useEffect(() => {
    let cancelled = false;
    const source = selectedQuickMachineModel?.code || selectedQuickMachineModel?.name || quickMachineForm.name || 'MAY';
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
  }, [selectedQuickMachineModel?.code, selectedQuickMachineModel?.name, quickMachineForm.name]);
  const machines = optionsQuery.data?.machines ?? [];
  const provinces = optionsQuery.data?.provinces ?? [];
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === form.customerId) || customerOptions.find((item) => item.value === form.customerId)?.row,
    [customerOptions, customers, form.customerId],
  );
  const selectedDemoMachineRows = selectedDemoMachines.map((item) => ({
    ...item,
    machine: machines.find((machine) => machine.id === item.machineId) || machineOptions.find((option) => option.value === item.machineId)?.row,
  }));

  useEffect(() => {
    if (!isEngineer) return;
    updateForm({ engineerIds: [user.id] });
  }, [isEngineer, user.id]);

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

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/demo-loans/batch', {
        method: 'POST',
        body: JSON.stringify({
          ...(({ engineerIds: _engineerIds, ...payload }) => payload)(form),
          engineerId: form.engineerIds[0],
          participantEngineerIds: form.engineerIds.slice(1),
          machines: selectedDemoMachines,
          machineId: undefined,
          machineUse: undefined,
          handoverAccessories: accessoryItemsAsLines(form.handoverAccessoriesText),
          handoverAccessoriesText: undefined,
        }),
      }),
    onSuccess: async () => {
      setSuccess(`Đã tạo ${selectedDemoMachines.length} phiếu demo và giữ máy khỏi kho.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['demo-loans'] }),
        queryClient.invalidateQueries({ queryKey: ['service-tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['product-catalog'] }),
      ]);
      window.setTimeout(() => navigate(returnTo), 450);
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      const name = quickCustomerForm.name.trim();
      const provinceId = quickCustomerForm.provinceId.trim();
      const selectedProvince = provinces.find((province) => province.id === provinceId);
      if (!name) throw new Error('Vui lòng nhập tên khách hàng.');
      if (!provinceId) throw new Error('Vui lòng chọn tỉnh/thành của khách hàng.');

      return apiFetch<CustomerOption>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          address: quickCustomerForm.address.trim(),
          contactPerson: quickCustomerForm.contactPerson.trim(),
          contactPhone: quickCustomerForm.phone.trim(),
          customerType: quickCustomerForm.customerType,
          district: quickCustomerForm.district.trim(),
          locality: quickCustomerForm.locality.trim(),
          name,
          phone: quickCustomerForm.phone.trim(),
          primaryEngineerId: isEngineer ? user.id : form.engineerIds[0] || undefined,
          province: selectedProvince?.name,
          provinceId,
          status: 'ACTIVE',
          ward: quickCustomerForm.ward.trim(),
        }),
      });
    },
    onSuccess: (customer) => {
      rememberCustomerOption(customer);
      applyCustomer(customer);
      setQuickCustomerForm(emptyQuickCustomerForm());
      setQuickCustomerOpen(false);
      setSuccess('Đã tạo hồ sơ khách hàng.');
      void queryClient.invalidateQueries({ queryKey: ['demo-loans', 'create-options'] });
    },
  });

  const createMachineMutation = useMutation({
    mutationFn: async () => {
      const serialNumber = quickMachineForm.serialNumber.trim();
      if (!quickMachineForm.machineModelId || !serialNumber) {
        throw new Error('Vui lòng chọn model và nhập serial máy.');
      }

      return apiFetch<MachineOption>('/machines', {
        method: 'POST',
        body: JSON.stringify({
          inventoryStatus: 'IN_STOCK',
          machineCode: undefined,
          machineModelId: quickMachineForm.machineModelId,
          name: quickMachineForm.name.trim() || undefined,
          primaryEngineerId: isEngineer ? user.id : form.engineerIds[0] || undefined,
          serialNumber,
          status: 'ACTIVE',
          warehouseImportDate: dateInputValue(new Date()),
          accessories: parseMachineAccessoriesInput(quickMachineForm.accessoriesText),
        }),
      });
    },
    onSuccess: (machine) => {
      rememberMachineOption(machine);
      setSelectedDemoMachines((current) => [...current, { machineId: machine.id, machineUse: machineUseFor(machine) }]);
      setQuickMachineForm(emptyQuickMachineForm());
      setQuickMachineOpen(false);
      setSuccess('Đã tạo hồ sơ máy demo.');
      void queryClient.invalidateQueries({ queryKey: ['demo-loans', 'create-options'] });
    },
  });

  function updateForm(patch: Partial<DemoLoanForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function applyCustomer(customer?: CustomerOption, fallbackCustomerId = customer?.id ?? '') {
    updateForm({
      customerId: customer?.id || fallbackCustomerId,
      handoverAddress: customer?.fullAddress || customer?.address || form.handoverAddress,
      receiverName: customer?.contactPerson || form.receiverName,
      receiverPhone: customer?.contactPhone || customer?.phone || form.receiverPhone,
      receiverPosition: customer?.contactPosition || form.receiverPosition,
    });
  }

  function rememberCustomerOption(customer?: CustomerOption) {
    if (!customer) return;
    setCustomerOptions((current) =>
      mergePickerOptions([{ label: customerLabel(customer), row: customer, value: customer.id }, ...current]),
    );
  }

  function rememberMachineOption(machine?: MachineOption) {
    if (!machine) return;
    setMachineOptions((current) =>
      mergePickerOptions([{ label: machineLabel(machine), row: machine, value: machine.id }, ...current]),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setSuccess('');

    if (!selectedDemoMachines.length || selectedDemoMachines.some((item) => !item.machineUse) || !form.customerId || !form.engineerIds.length || !form.plannedHandoverAt || !form.expectedReturnAt) {
      setFormError('Vui lòng thêm máy, chọn loại máy, khách hàng, kỹ sư và thời gian demo.');
      return;
    }

    try {
      await createMutation.mutateAsync();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không tạo được phiếu demo.');
    }
  }

  function goToHandoverStep() {
    setFormError('');
    if (!selectedDemoMachines.length || selectedDemoMachines.some((item) => !item.machineUse) || !form.customerId || !form.engineerIds.length) {
      setFormError('Vui lòng thêm máy, chọn loại máy, khách hàng và kỹ sư trước khi tiếp tục.');
      return;
    }
    setCurrentStep('handover');
  }

  const loading = optionsQuery.isLoading || optionsQuery.isFetching;
  const error =
    formError ||
    (optionsQuery.error instanceof Error ? optionsQuery.error.message : '') ||
    (createCustomerMutation.error instanceof Error ? createCustomerMutation.error.message : '') ||
    (createMachineMutation.error instanceof Error ? createMachineMutation.error.message : '') ||
    (createMutation.error instanceof Error ? createMutation.error.message : '');

  return (
    <PageFrame>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Phiếu demo"
          title="Tạo phiếu bàn giao máy dùng thử"
        />
        <button className="secondary-button w-fit flex-none" onClick={() => navigate(returnTo)} type="button">
          <ArrowLeft size={17} />
          Quay lại
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <DemoCreateStepper currentStep={currentStep} />

      <form className="grid gap-5 min-[1240px]:grid-cols-[minmax(0,1fr)_360px]" onSubmit={submit}>
        <div className="grid gap-5">
          {currentStep === 'records' ? (
          <section className={panelClass}>
            <div>
              <span className="text-xs font-bold uppercase text-[#3e8375]">Bước 1</span>
              <h2 className="mt-1 text-lg font-semibold text-[#202124]">Chọn hồ sơ khách hàng và máy</h2>
            </div>

            <div className="grid items-start gap-x-5 gap-y-4 md:grid-cols-2">
              <div className="order-1 grid min-w-0 content-start">
                <AsyncEntityPicker<CustomerOption>
                  className="min-w-0 text-sm font-semibold text-[#334155]"
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
                <button className="secondary-button compact mt-2 h-10 justify-self-start" onClick={() => setQuickCustomerOpen((current) => !current)} type="button">
                  <Plus size={15} />
                  Tạo hồ sơ khách hàng
                </button>
              </div>

              <div className="order-2 grid min-w-0 gap-2 md:col-span-2">
                <span className="text-sm font-semibold text-[#334155]">Kỹ sư thực hiện</span>
                {isEngineer ? (
                  <div className="rounded-2xl border border-[#cbd5e1] bg-[#f8fafc] p-2">
                    <label className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-medium text-[#334155]">
                      <input checked readOnly type="checkbox" />
                      <span className="truncate">{user.fullName || user.email}</span>
                    </label>
                  </div>
                ) : (
                  <div aria-label="Kỹ sư thực hiện" className="grid max-h-36 gap-1 overflow-y-auto rounded-2xl border border-[#cbd5e1] bg-white p-2 sm:grid-cols-2 lg:grid-cols-4">
                    {engineers.map((engineer) => (
                      <label className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-medium text-[#334155] hover:bg-[#f8fafc]" key={engineer.id}>
                        <input checked={form.engineerIds.includes(engineer.id)} disabled={loading} onChange={(event) => updateForm({ engineerIds: event.target.checked ? [...form.engineerIds, engineer.id] : form.engineerIds.filter((id) => id !== engineer.id) })} type="checkbox" />
                        <span className="truncate">{technicalUserName(engineer)}</span>
                      </label>
                    ))}
                    {engineers.length === 0 ? <span className="px-2 py-1 text-xs font-medium text-[#64748b]">Chưa có kỹ sư trong phạm vi.</span> : null}
                  </div>
                )}
              </div>

              <div className="order-4 grid min-w-0 content-start md:col-span-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-3">
                <AsyncEntityPicker<MachineOption>
                  disabled={loading}
                  className="min-w-0 text-sm font-semibold text-[#334155]"
                  endpoint="/machines?limit=20"
                  formatOption={(machine) => ({
                    label: machineLabel(machine),
                    row: machine,
                    value: machine.id,
                  })}
                  initialOptions={machineOptions}
                  inputClassName={fieldClass}
                  label="Thêm máy demo"
                  onChange={(value, machine) => {
                    rememberMachineOption(machine);
                    if (machine && !selectedDemoMachines.some((item) => item.machineId === machine.id)) {
                      setSelectedDemoMachines((current) => [...current, { machineId: machine.id, machineUse: machineUseFor(machine) }]);
                    }
                  }}
                  placeholder="Tìm mã máy, serial, model"
                  rowFilter={isEligibleDemoMachine}
                  value=""
                />
                <button className="secondary-button compact mt-2 h-12 justify-self-start md:mt-0" onClick={() => setQuickMachineOpen((current) => !current)} type="button">
                  <Plus size={15} />
                  Tạo hồ sơ máy
                </button>
              </div>

              <section className="order-5 grid min-w-0 gap-2 md:col-span-2" aria-label="Máy được chọn để demo">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[#334155]">Thiết bị trong phiếu</h3>
                  <span className="text-xs font-semibold text-[#64748b]">{selectedDemoMachines.length} máy</span>
                </div>
                {selectedDemoMachineRows.length ? (
                  <div className="grid gap-2">
                    {selectedDemoMachineRows.map(({ machineId, machineUse, machine }, index) => (
                      <div className="grid min-w-0 items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-3 md:grid-cols-[minmax(0,1fr)_260px_auto]" key={machineId}>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[#172033]">{machine ? machineLabel(machine) : machineId}</div>
                          <div className="mt-1 text-xs text-[#64748b]">Thiết bị {index + 1}</div>
                        </div>
                        {machine?.demoCategory === 'DEMO_UNIT' || machine?.demoCategory === 'DEMO_USED' ? (
                          <div className={`${fieldClass} flex items-center`}>{machineUseLabel(machineUse)}</div>
                        ) : (
                          <select aria-label={`Loại máy demo ${index + 1}`} className={fieldClass} onChange={(event) => setSelectedDemoMachines((current) => current.map((item) => item.machineId === machineId ? { ...item, machineUse: event.target.value as DemoLoanForm['machineUse'] } : item))} value={machineUse}>
                            <option value="">Chọn loại máy</option>
                            <option value="DEMO_UNIT">Máy demo chuyên dụng</option>
                            <option value="NEW_STOCK">Máy mới mang đi demo</option>
                          </select>
                        )}
                        <button aria-label={`Bỏ máy ${index + 1}`} className="secondary-button compact" onClick={() => setSelectedDemoMachines((current) => current.filter((item) => item.machineId !== machineId))} type="button">Bỏ</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#cbd5e1] px-4 py-5 text-sm text-[#64748b]">Chưa thêm máy demo</div>
                )}
              </section>

              {quickMachineOpen ? (
                <QuickMachinePanel
                  className="order-6"
                  form={quickMachineForm}
                  loading={createMachineMutation.isPending}
                  machineModels={machineModels}
                  previewCode={quickMachinePreviewCode}
                  onChange={(patch) => setQuickMachineForm((current) => ({ ...current, ...patch }))}
                  onSubmit={() => createMachineMutation.mutate()}
                />
              ) : null}

              {quickCustomerOpen ? (
                <QuickCustomerPanel
                  className="order-7"
                  form={quickCustomerForm}
                  loading={createCustomerMutation.isPending}
                  onChange={(patch) => setQuickCustomerForm((current) => ({ ...current, ...patch }))}
                  onSubmit={() => createCustomerMutation.mutate()}
                  provinces={provinces}
                />
              ) : null}

              <div className="order-8 flex flex-wrap justify-end gap-2 md:col-span-2">
                <button className="secondary-button" onClick={() => navigate(returnTo)} type="button">
                  Hủy
                </button>
                <button className="primary-button" onClick={goToHandoverStep} type="button">
                  Tiếp tục bàn giao
                </button>
              </div>
            </div>
          </section>
          ) : null}

          {currentStep === 'handover' ? (
          <section className={panelClass}>
            <div>
              <span className="text-xs font-bold uppercase text-[#3e8375]">Bước 2</span>
              <h2 className="mt-1 text-lg font-semibold text-[#202124]">Thông tin bàn giao</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <DateInput label="Ngày bàn giao" onChange={(value) => updateForm({ plannedHandoverAt: value })} required value={form.plannedHandoverAt} />
              <DateInput label="Hạn thu hồi" onChange={(value) => updateForm({ expectedReturnAt: value })} required value={form.expectedReturnAt} />

              <label className={labelClass}>
                Người nhận
                <input className={fieldClass} onChange={(event) => updateForm({ receiverName: event.target.value })} value={form.receiverName} />
              </label>

              <label className={labelClass}>
                Chức vụ
                <input className={fieldClass} onChange={(event) => updateForm({ receiverPosition: event.target.value })} value={form.receiverPosition} />
              </label>

              <label className={labelClass}>
                SĐT người nhận
                <input className={fieldClass} onChange={(event) => updateForm({ receiverPhone: event.target.value })} value={form.receiverPhone} />
              </label>

              <label className={labelClass}>
                Địa điểm bàn giao
                <input className={fieldClass} onChange={(event) => updateForm({ handoverAddress: event.target.value })} value={form.handoverAddress} />
              </label>

              <label className={`${labelClass} md:col-span-2`}>
                Mục đích demo
                <textarea className={textAreaClass} onChange={(event) => updateForm({ purpose: event.target.value })} value={form.purpose} />
              </label>
              <label className={labelClass}>
                Tình trạng khi bàn giao
                <textarea className={textAreaClass} onChange={(event) => updateForm({ handoverCondition: event.target.value })} value={form.handoverCondition} />
              </label>
              <div className="md:col-span-2">
                <MachineAccessoryEditor mode="generic" onChange={(handoverAccessoriesText) => updateForm({ handoverAccessoriesText })} value={form.handoverAccessoriesText} />
              </div>
              <label className={labelClass}>
                Ghi chú bàn giao
                <textarea className={textAreaClass} onChange={(event) => updateForm({ handoverNote: event.target.value })} value={form.handoverNote} />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="secondary-button" onClick={() => navigate(returnTo)} type="button">
                Hủy
              </button>
              <button className="secondary-button" onClick={() => setCurrentStep('records')} type="button">
                Quay lại hồ sơ
              </button>
              <button className="primary-button" disabled={createMutation.isPending || loading} type="submit">
                {createMutation.isPending ? <Loader2 className="spin-icon" size={16} /> : <Plus size={16} />}
                Tạo phiếu demo
              </button>
            </div>
          </section>
          ) : null}

        </div>

        <aside className="grid content-start gap-4">
          <section className={panelClass}>
            <h2 className="text-lg font-semibold text-[#202124]">Tóm tắt</h2>
            <SummaryField label="Thiết bị" value={selectedDemoMachines.length ? `${selectedDemoMachines.length} máy đã chọn` : 'Chưa chọn'} />
            <SummaryField label="Khách hàng" value={selectedCustomer ? customerLabel(selectedCustomer) : 'Chưa chọn'} />
            <SummaryField label="Thời gian demo" value={`${formatDate(form.plannedHandoverAt)} - ${formatDate(form.expectedReturnAt)}`} />
          </section>
        </aside>
      </form>
    </PageFrame>
  );
}

function DemoCreateStepper({ currentStep }: { currentStep: DemoCreateStep }) {
  const steps: Array<{ key: DemoCreateStep; label: string }> = [
    { key: 'records', label: 'Hồ sơ' },
    { key: 'handover', label: 'Bàn giao' },
  ];
  const currentIndex = steps.findIndex((step) => step.key === currentStep);

  return (
    <section className="grid gap-2 rounded-[24px] bg-[#f6f8f7] p-3 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.06)] md:grid-cols-2">
      {steps.map((step, index) => {
        const active = step.key === currentStep;
        const done = index < currentIndex;
        return (
          <div className={`grid gap-1 rounded-[18px] px-4 py-3 ${active ? 'bg-white shadow-[0_10px_24px_rgba(24,24,27,0.08)]' : done ? 'bg-[#eefaf3]' : 'bg-transparent'}`} key={step.key}>
            <span className={`text-xs font-bold uppercase ${active || done ? 'text-[#2f6f63]' : 'text-[#8a94a6]'}`}>Bước {index + 1}</span>
            <strong className="text-sm text-[#202124]">{step.label}</strong>
          </div>
        );
      })}
    </section>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-2xl bg-[#f6f8f7] px-3 py-2.5">
      <span className="text-xs font-semibold text-[#667085]">{label}</span>
      <strong className="break-words text-sm font-semibold text-[#202124]">{value || '-'}</strong>
    </div>
  );
}

function QuickCustomerPanel({
  className,
  form,
  loading,
  onChange,
  onSubmit,
  provinces,
}: {
  className?: string;
  form: QuickCustomerForm;
  loading: boolean;
  onChange: (patch: Partial<QuickCustomerForm>) => void;
  onSubmit: () => void;
  provinces: ProvinceOption[];
}) {
  return (
    <div className={`grid gap-3 rounded-[22px] border border-[#dbeafe] bg-[#f8fbff] p-4 md:col-span-2 ${className || ''}`}>
      <div>
        <span className="text-xs font-bold uppercase text-[#2563eb]">Tạo tại phiếu</span>
        <h3 className="mt-1 text-base font-semibold text-[#172033]">Khách hàng chưa có hồ sơ</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={labelClass}>
          Tên khách hàng
          <input className={fieldClass} onChange={(event) => onChange({ name: event.target.value })} value={form.name} />
        </label>
        <label className={labelClass}>
          Loại khách hàng
          <select className={fieldClass} onChange={(event) => onChange({ customerType: event.target.value })} value={form.customerType}>
            <option value="HOSPITAL">Bệnh viện</option>
            <option value="CLINIC">Phòng khám</option>
            <option value="LAB">Phòng xét nghiệm</option>
            <option value="DISTRIBUTOR">Nhà phân phối</option>
            <option value="COMPANY">Công ty</option>
            <option value="OTHER">Khác</option>
          </select>
        </label>
        <label className={labelClass}>
          Số điện thoại
          <input className={fieldClass} onChange={(event) => onChange({ phone: event.target.value })} value={form.phone} />
        </label>
        <label className={labelClass}>
          Người liên hệ
          <input className={fieldClass} onChange={(event) => onChange({ contactPerson: event.target.value })} value={form.contactPerson} />
        </label>
        <label className={labelClass}>
          Tỉnh/Thành
          <select
            className={fieldClass}
            onChange={(event) => {
              const province = provinces.find((item) => item.id === event.target.value);
              onChange({ province: province?.name || '', provinceId: event.target.value, district: '', locality: '', ward: '' });
            }}
            value={form.provinceId}
          >
            <option value="">Chọn tỉnh/thành</option>
            {provinces.map((province) => (
              <option key={province.id} value={province.id}>
                {province.name}{province.branch?.name ? ` · ${province.branch.name}` : ''}
              </option>
            ))}
          </select>
        </label>
        <VietnamAddressSelects
          fieldClassName={fieldClass}
          labelClassName={labelClass}
          onChange={onChange}
          showProvince={false}
          value={form}
        />
      </div>
      <button className="primary-button justify-self-start" disabled={loading} onClick={onSubmit} type="button">
        {loading ? <Loader2 className="spin-icon" size={16} /> : <Plus size={16} />}
        Lưu khách hàng
      </button>
    </div>
  );
}

function QuickMachinePanel({
  className,
  form,
  loading,
  machineModels,
  previewCode,
  onChange,
  onSubmit,
}: {
  className?: string;
  form: QuickMachineForm;
  loading: boolean;
  machineModels: MachineModelOption[];
  previewCode: string;
  onChange: (patch: Partial<QuickMachineForm>) => void;
  onSubmit: () => void;
}) {
  return (
    <div className={`grid gap-3 rounded-[22px] border border-[#dbeafe] bg-[#f8fbff] p-4 md:col-span-2 ${className || ''}`}>
      <div>
        <span className="text-xs font-bold uppercase text-[#2563eb]">Tạo tại phiếu</span>
        <h3 className="mt-1 text-base font-semibold text-[#172033]">Máy chưa có hồ sơ</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className={`${labelClass} md:col-span-3`}>
          Model
          <select
            className={fieldClass}
            onChange={(event) => {
              const model = machineModels.find((item) => item.id === event.target.value);
              onChange({
                machineModelId: event.target.value,
                accessoriesText: serializeMachineAccessories(getModelAccessoryTemplates(model).map((accessory) => ({
                  componentAccessoryId: accessory.id,
                  code: accessory.code,
                  name: accessory.name,
                  quantity: accessory.quantity ?? 1,
                }))),
              });
            }}
            value={form.machineModelId}
          >
            <option value="">Chọn model</option>
            {machineModels.map((model) => (
              <option key={model.id} value={model.id}>
                {machineModelLabel(model)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Serial
          <input className={fieldClass} onChange={(event) => onChange({ serialNumber: event.target.value })} value={form.serialNumber} />
        </label>
        <label className={labelClass}>
          Mã máy (ước tính)
          <input className={fieldClass} disabled placeholder="Đang sinh mã..." value={form.machineCode || previewCode || 'Đang sinh mã...'} />
        </label>
        <label className={`${labelClass} md:col-span-3`}>
          Tên máy
          <input className={fieldClass} onChange={(event) => onChange({ name: event.target.value })} value={form.name} />
        </label>
        <div className="md:col-span-3">
          <MachineAccessoryEditor
            mode={machineAccessoryMode(form.machineModelId ? machineModels.find((item) => item.id === form.machineModelId) : undefined)}
            onChange={(accessoriesText) => onChange({ accessoriesText })}
            templates={getModelAccessoryTemplates(form.machineModelId ? machineModels.find((item) => item.id === form.machineModelId) : undefined)}
            value={form.accessoriesText}
          />
        </div>
      </div>
      <button className="primary-button justify-self-start" disabled={loading} onClick={onSubmit} type="button">
        {loading ? <Loader2 className="spin-icon" size={16} /> : <Plus size={16} />}
        Lưu máy demo
      </button>
    </div>
  );
}

function emptyDemoLoanForm(): DemoLoanForm {
  const planned = new Date();
  const expected = new Date();
  expected.setDate(expected.getDate() + 7);
  return {
    customerId: '',
    machineUse: '',
    engineerIds: [],
    expectedReturnAt: dateInputValue(expected),
    handoverAddress: '',
    handoverCondition: 'Máy hoạt động bình thường khi bàn giao.',
    handoverNote: '',
    handoverAccessoriesText: '',
    machineId: '',
    plannedHandoverAt: dateInputValue(planned),
    purpose: '',
    receiverName: '',
    receiverPhone: '',
    receiverPosition: '',
  };
}

function accessoryItemsAsLines(value: string) {
  return parseMachineAccessoriesInput(value)
    .map((item) => [item.name || item.code, item.serialNumber ? `S/N ${item.serialNumber}` : '', item.quantity ? `SL ${item.quantity}` : '', item.description || ''].filter(Boolean).join(' | '))
    .filter(Boolean);
}

function dateInputValue(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function emptyQuickCustomerForm(): QuickCustomerForm {
  return {
    address: '',
    contactPerson: '',
    customerType: 'HOSPITAL',
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
    machineCode: '',
    machineModelId: '',
    name: '',
    serialNumber: '',
  };
}

function machineLabel(machine: MachineOption) {
  return [machine.machineCode, machine.name || machine.modelName, machine.serialNumber ? `S/N ${machine.serialNumber}` : '', machine.demoCategory ? machineCategoryLabel(machine.demoCategory) : '', machine.inventoryStatus ? displayLabel(machine.inventoryStatus) : '']
    .filter(Boolean)
    .join(' - ');
}

function machineUseFor(machine: MachineOption): DemoLoanForm['machineUse'] {
  if (machine.demoCategory === 'DEMO_UNIT') return 'DEMO_UNIT';
  if (machine.demoCategory === 'DEMO_USED') return 'DEMO_USED';
  if (machine.demoCategory === 'DEMO_STOCK') return 'NEW_STOCK';
  return '';
}

function machineUseLabel(value: DemoLoanForm['machineUse']) {
  if (value === 'DEMO_UNIT') return 'Máy demo chuyên dụng';
  if (value === 'DEMO_USED') return 'Đã qua demo';
  if (value === 'NEW_STOCK') return 'Máy mới mang đi demo';
  return 'Chưa phân loại';
}

function isEligibleDemoMachine(machine: MachineOption) {
  if (machine.demoPreparationStatus === 'REQUIRED') return false;
  if (machine.inventoryStatus === 'IN_STOCK' && machine.status === 'ACTIVE') {
    return true;
  }
  return (
    machine.inventoryStatus === 'RETURNED' &&
    machine.status === 'REPAIRING'
  );
}

function machineCategoryLabel(value: NonNullable<MachineOption['demoCategory']>) {
  if (value === 'DEMO_UNIT') return 'Máy demo';
  if (value === 'DEMO_USED') return 'Đã qua demo';
  return 'Máy mới đang demo';
}

function customerLabel(customer: CustomerOption) {
  return [customer.customerCode, customer.name || customer.hospitalName, customer.province, customer.phone].filter(Boolean).join(' - ');
}

function machineModelLabel(model: MachineModelOption) {
  return [model.code, model.name, model.manufacturer, model.businessLine?.name].filter(Boolean).join(' - ');
}

function getModelAccessoryTemplates(model?: MachineModelOption) {
  return model?.components?.flatMap((component) => component.accessories ?? component.ComponentAccessory ?? []) ?? [];
}

function machineAccessoryMode(model?: MachineModelOption): 'probe' | 'endoscopy' | 'generic' {
  if (isEndoscopyMachineModel(model)) return 'endoscopy';
  if (isUltrasoundMachineModel(model)) return 'probe';
  return 'generic';
}

function mergeMachines(machines: MachineOption[]) {
  const byId = new Map<string, MachineOption>();
  machines.forEach((machine) => byId.set(machine.id, machine));
  return Array.from(byId.values()).sort((left, right) => machineLabel(left).localeCompare(machineLabel(right), 'vi'));
}

function mergePickerOptions<T>(options: Array<PickerOption<T>>) {
  const byValue = new Map<string, PickerOption<T>>();
  options.forEach((option) => byValue.set(option.value, option));
  return Array.from(byValue.values());
}

function formatDate(value: string) {
  if (!value) return 'Chưa chọn';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

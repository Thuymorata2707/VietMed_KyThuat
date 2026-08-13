import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages } from '../../api';
import { DateInput } from '../../components/DateInput';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { AsyncEntityPicker, type PickerOption } from '../EngineerTasksPage/components/AsyncEntityPicker';
import { getRoleName } from '../../auth/roles';
import { displayLabel } from '../../utils/displayLabels';
import { isTechnicalUser, technicalUserName } from '../../utils/technicalUsers';

type DemoCreateStep = 'records' | 'handover' | 'review';

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

type RegionOption = {
  id: string;
  name: string;
};

type MachineOption = {
  id: string;
  machineCode?: string | null;
  serialNumber?: string | null;
  modelName?: string | null;
  name?: string | null;
  inventoryStatus?: string | null;
  customer?: CustomerOption | null;
};

type MachineModelOption = {
  id: string;
  code: string;
  name: string;
  manufacturer?: string | null;
  businessLine?: { name?: string | null } | null;
};

type DemoLoanForm = {
  customerId: string;
  engineerId: string;
  expectedReturnAt: string;
  handoverAddress: string;
  handoverCondition: string;
  handoverNote: string;
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
  hospitalName: string;
  name: string;
  phone: string;
  province: string;
  regionId: string;
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
  regions: RegionOption[];
};

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
  const [customerOptions, setCustomerOptions] = useState<Array<PickerOption<CustomerOption>>>([]);
  const [machineOptions, setMachineOptions] = useState<Array<PickerOption<MachineOption>>>([]);
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickMachineOpen, setQuickMachineOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState<QuickCustomerForm>(() => emptyQuickCustomerForm(user));
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
      const [customersResult, engineersResult, machineModels, inStockResult, returnedResult, regionsResult] = await Promise.all([
        apiFetch<Paginated<CustomerOption>>('/customers?limit=50'),
        apiFetch<Paginated<EngineerOption> | EngineerOption[]>('/users?limit=100&status=ACTIVE'),
        apiFetchAllPages<MachineModelOption>('/machine-models'),
        apiFetch<Paginated<MachineOption>>('/machines?limit=100&inventoryStatus=IN_STOCK'),
        apiFetch<Paginated<MachineOption>>('/machines?limit=100&inventoryStatus=RETURNED'),
        apiFetch<Paginated<RegionOption> | RegionOption[]>('/regions?limit=100'),
      ]);

      return {
        customers: customersResult.data,
        engineers: unpackList(engineersResult).filter(isTechnicalUser),
        machineModels,
        machines: mergeMachines([...inStockResult.data, ...returnedResult.data]),
        regions: unpackList(regionsResult),
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
  const regions = optionsQuery.data?.regions ?? [];
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === form.customerId) || customerOptions.find((item) => item.value === form.customerId)?.row,
    [customerOptions, customers, form.customerId],
  );
  const selectedMachine = useMemo(
    () => machines.find((machine) => machine.id === form.machineId) || machineOptions.find((item) => item.value === form.machineId)?.row,
    [form.machineId, machineOptions, machines],
  );

  useEffect(() => {
    if (!isEngineer) return;
    updateForm({ engineerId: user.id });
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
      apiFetch('/demo-loans', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: async () => {
      setSuccess('Đã tạo phiếu demo và giữ máy khỏi kho.');
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
      const regionId = quickCustomerForm.regionId.trim();
      const selectedRegion = regions.find((region) => region.id === regionId);
      if (!name) throw new Error('Vui lòng nhập tên khách hàng.');
      if (!regionId) throw new Error('Vui lòng chọn khu vực của khách hàng.');

      return apiFetch<CustomerOption>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          address: quickCustomerForm.address.trim(),
          contactPerson: quickCustomerForm.contactPerson.trim(),
          contactPhone: quickCustomerForm.phone.trim(),
          customerType: quickCustomerForm.customerType,
          district: quickCustomerForm.district.trim(),
          hospitalName: quickCustomerForm.hospitalName.trim(),
          name,
          phone: quickCustomerForm.phone.trim(),
          primaryEngineerId: isEngineer ? user.id : form.engineerId || undefined,
          province: quickCustomerForm.province.trim() || selectedRegion?.name || undefined,
          regionId,
          status: 'ACTIVE',
          ward: quickCustomerForm.ward.trim(),
        }),
      });
    },
    onSuccess: (customer) => {
      rememberCustomerOption(customer);
      applyCustomer(customer);
      setQuickCustomerForm(emptyQuickCustomerForm(user));
      setQuickCustomerOpen(false);
      setSuccess('Đã tạo nhanh khách hàng.');
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
          primaryEngineerId: isEngineer ? user.id : form.engineerId || undefined,
          serialNumber,
          status: 'ACTIVE',
          warehouseImportDate: new Date().toISOString().slice(0, 10),
          accessories: quickMachineForm.accessoriesText
            .split('\n')
            .map((line) => {
              const [name = '', serialNumber = ''] = line.split('|').map((part) => part.trim());
              return { name, serialNumber };
            })
            .filter((item) => item.name),
        }),
      });
    },
    onSuccess: (machine) => {
      rememberMachineOption(machine);
      updateForm({ machineId: machine.id });
      setQuickMachineForm(emptyQuickMachineForm());
      setQuickMachineOpen(false);
      setSuccess('Đã tạo nhanh máy demo.');
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

    if (!form.machineId || !form.customerId || !form.engineerId || !form.plannedHandoverAt || !form.expectedReturnAt) {
      setFormError('Vui lòng chọn máy, khách hàng, kỹ sư, ngày bàn giao và hạn thu hồi.');
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
    if (!form.machineId || !form.customerId || !form.engineerId) {
      setFormError('Vui lòng chọn hoặc tạo đủ máy, khách hàng và kỹ sư trước khi nhập nội dung bàn giao.');
      return;
    }
    setCurrentStep('handover');
  }

  function goToReviewStep() {
    setFormError('');
    if (!form.plannedHandoverAt || !form.expectedReturnAt) {
      setFormError('Vui lòng nhập ngày bàn giao và hạn thu hồi.');
      return;
    }
    setCurrentStep('review');
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
          description="Bàn giao & thu hồi demo."
        />
        <button className="secondary-button" onClick={() => navigate(returnTo)} type="button">
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
              <p className="mt-1 text-sm font-medium leading-6 text-[#667085]">Nếu chưa có dữ liệu, tạo nhanh ngay tại phiếu.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <AsyncEntityPicker<MachineOption>
                  className={labelClass}
                  disabled={loading}
                  endpoint="/machines?limit=20"
                  formatOption={(machine) => ({
                    label: machineLabel(machine),
                    row: machine,
                    value: machine.id,
                  })}
                  initialOptions={machineOptions}
                  inputClassName={fieldClass}
                  label="Máy demo"
                  onChange={(value, machine) => {
                    rememberMachineOption(machine);
                    updateForm({ machineId: machine?.id || value });
                  }}
                  placeholder="Tìm mã máy, serial, model"
                  required
                  rowFilter={(machine) => machine.inventoryStatus === 'IN_STOCK' || machine.inventoryStatus === 'RETURNED'}
                  value={form.machineId}
                />
                <button className="secondary-button compact justify-self-start" onClick={() => setQuickMachineOpen((current) => !current)} type="button">
                  <Plus size={15} />
                  Chưa có máy
                </button>
              </div>

              <div className="grid gap-2">
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
                <button className="secondary-button compact justify-self-start" onClick={() => setQuickCustomerOpen((current) => !current)} type="button">
                  <Plus size={15} />
                  Chưa có khách hàng
                </button>
              </div>

              {quickMachineOpen ? (
                <QuickMachinePanel
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
                  form={quickCustomerForm}
                  loading={createCustomerMutation.isPending}
                  onChange={(patch) => setQuickCustomerForm((current) => ({ ...current, ...patch }))}
                  onSubmit={() => createCustomerMutation.mutate()}
                  regions={regions}
                />
              ) : null}

              {isEngineer ? (
                <SummaryField label="Kỹ sư bàn giao" value={user.fullName || user.email} />
              ) : (
                <label className={labelClass}>
                  Kỹ sư bàn giao
                  <select className={fieldClass} disabled={loading} onChange={(event) => updateForm({ engineerId: event.target.value })} required value={form.engineerId}>
                    <option value="">Chọn kỹ sư</option>
                    {engineers.map((engineer) => (
                      <option key={engineer.id} value={engineer.id}>
                        {technicalUserName(engineer)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
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
              <p className="mt-1 text-sm font-medium leading-6 text-[#667085]">Nhập thời gian, người nhận và tình trạng máy khi bàn giao.</p>
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
              <button className="primary-button" onClick={goToReviewStep} type="button">
                Kiểm tra phiếu
              </button>
            </div>
          </section>
          ) : null}

          {currentStep === 'review' ? (
          <section className={panelClass}>
            <div>
              <span className="text-xs font-bold uppercase text-[#3e8375]">Bước 3</span>
              <h2 className="mt-1 text-lg font-semibold text-[#202124]">Kiểm tra trước khi tạo phiếu demo</h2>
              <p className="mt-1 text-sm font-medium leading-6 text-[#667085]">Kiểm tra trước khi lưu.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <SummaryField label="Máy demo" value={selectedMachine ? machineLabel(selectedMachine) : 'Chưa chọn'} />
              <SummaryField label="Khách hàng" value={selectedCustomer ? customerLabel(selectedCustomer) : 'Chưa chọn'} />
              <SummaryField label="Kỹ sư" value={engineers.find((engineer) => engineer.id === form.engineerId)?.fullName || user.fullName || user.email} />
              <SummaryField label="Thời gian" value={`${formatDate(form.plannedHandoverAt)} - ${formatDate(form.expectedReturnAt)}`} />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="secondary-button" onClick={() => setCurrentStep('handover')} type="button">
                Quay lại bàn giao
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
            <SummaryField label="Máy" value={selectedMachine ? machineLabel(selectedMachine) : 'Chưa chọn'} />
            <SummaryField label="Khách hàng" value={selectedCustomer ? customerLabel(selectedCustomer) : 'Chưa chọn'} />
            <SummaryField label="Thời gian demo" value={`${formatDate(form.plannedHandoverAt)} - ${formatDate(form.expectedReturnAt)}`} />
          </section>
        </aside>
      </form>
    </PageFrame>
  );
}

function DemoCreateStepper({ currentStep }: { currentStep: DemoCreateStep }) {
  const steps: Array<{ key: DemoCreateStep; label: string; sub: string }> = [
    { key: 'records', label: 'Hồ sơ', sub: 'Khách hàng & máy' },
    { key: 'handover', label: 'Bàn giao', sub: 'Ngày, người nhận, tình trạng' },
    { key: 'review', label: 'Xác nhận', sub: 'Kiểm tra trước khi lưu' },
  ];
  const currentIndex = steps.findIndex((step) => step.key === currentStep);

  return (
    <section className="grid gap-2 rounded-[24px] bg-[#f6f8f7] p-3 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.06)] md:grid-cols-3">
      {steps.map((step, index) => {
        const active = step.key === currentStep;
        const done = index < currentIndex;
        return (
          <div className={`grid gap-1 rounded-[18px] px-4 py-3 ${active ? 'bg-white shadow-[0_10px_24px_rgba(24,24,27,0.08)]' : done ? 'bg-[#eefaf3]' : 'bg-transparent'}`} key={step.key}>
            <span className={`text-xs font-bold uppercase ${active || done ? 'text-[#2f6f63]' : 'text-[#8a94a6]'}`}>Bước {index + 1}</span>
            <strong className="text-sm text-[#202124]">{step.label}</strong>
            <span className="text-xs font-medium text-[#667085]">{step.sub}</span>
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
  form,
  loading,
  onChange,
  onSubmit,
  regions,
}: {
  form: QuickCustomerForm;
  loading: boolean;
  onChange: (patch: Partial<QuickCustomerForm>) => void;
  onSubmit: () => void;
  regions: RegionOption[];
}) {
  return (
    <div className="grid gap-3 rounded-[22px] border border-[#dbeafe] bg-[#f8fbff] p-4 md:col-span-2">
      <div>
        <span className="text-xs font-bold uppercase text-[#2563eb]">Tạo nhanh</span>
        <h3 className="mt-1 text-base font-semibold text-[#172033]">Khách hàng chưa có hồ sơ</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={labelClass}>
          Tên khách hàng
          <input className={fieldClass} onChange={(event) => onChange({ name: event.target.value })} value={form.name} />
        </label>
        <label className={labelClass}>
          Tên bệnh viện/đơn vị
          <input className={fieldClass} onChange={(event) => onChange({ hospitalName: event.target.value })} value={form.hospitalName} />
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
          Khu vực
          <select
            className={fieldClass}
            onChange={(event) => {
              const region = regions.find((item) => item.id === event.target.value);
              onChange({ province: region?.name || form.province, regionId: event.target.value });
            }}
            value={form.regionId}
          >
            <option value="">Chọn khu vực</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Tỉnh/Thành
          <input className={fieldClass} onChange={(event) => onChange({ province: event.target.value })} value={form.province} />
        </label>
        <label className={labelClass}>
          Quận/Huyện
          <input className={fieldClass} onChange={(event) => onChange({ district: event.target.value })} value={form.district} />
        </label>
        <label className={labelClass}>
          Phường/Xã
          <input className={fieldClass} onChange={(event) => onChange({ ward: event.target.value })} value={form.ward} />
        </label>
        <label className={`${labelClass} md:col-span-2`}>
          Địa chỉ
          <input className={fieldClass} onChange={(event) => onChange({ address: event.target.value })} value={form.address} />
        </label>
      </div>
      <button className="primary-button justify-self-start" disabled={loading} onClick={onSubmit} type="button">
        {loading ? <Loader2 className="spin-icon" size={16} /> : <Plus size={16} />}
        Lưu khách hàng
      </button>
    </div>
  );
}

function QuickMachinePanel({
  form,
  loading,
  machineModels,
  previewCode,
  onChange,
  onSubmit,
}: {
  form: QuickMachineForm;
  loading: boolean;
  machineModels: MachineModelOption[];
  previewCode: string;
  onChange: (patch: Partial<QuickMachineForm>) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-[22px] border border-[#dbeafe] bg-[#f8fbff] p-4 md:col-span-2">
      <div>
        <span className="text-xs font-bold uppercase text-[#2563eb]">Tạo nhanh</span>
        <h3 className="mt-1 text-base font-semibold text-[#172033]">Máy chưa có hồ sơ</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className={`${labelClass} md:col-span-3`}>
          Model
          <select className={fieldClass} onChange={(event) => onChange({ machineModelId: event.target.value })} value={form.machineModelId}>
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
          Mã máy
          <input className={fieldClass} disabled placeholder="Đang sinh mã..." value={form.machineCode || previewCode || 'Đang sinh mã...'} />
        </label>
        <label className={`${labelClass} md:col-span-3`}>
          Tên máy
          <input className={fieldClass} onChange={(event) => onChange({ name: event.target.value })} placeholder="Để trống sẽ lấy theo model" value={form.name} />
        </label>
        <label className={`${labelClass} md:col-span-3`}>
          Phụ kiện
          <textarea className={textAreaClass} onChange={(event) => onChange({ accessoriesText: event.target.value })} placeholder="Mỗi dòng: Tên phụ kiện | Serial phụ kiện" value={form.accessoriesText} />
        </label>
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
    engineerId: '',
    expectedReturnAt: expected.toISOString().slice(0, 10),
    handoverAddress: '',
    handoverCondition: 'Máy hoạt động bình thường khi bàn giao.',
    handoverNote: '',
    machineId: '',
    plannedHandoverAt: planned.toISOString().slice(0, 10),
    purpose: '',
    receiverName: '',
    receiverPhone: '',
    receiverPosition: '',
  };
}

function emptyQuickCustomerForm(user?: ApiUser): QuickCustomerForm {
  return {
    address: '',
    contactPerson: '',
    customerType: 'HOSPITAL',
    district: '',
    hospitalName: '',
    name: '',
    phone: '',
    province: user?.region?.name || '',
    regionId: user?.regionId || user?.region?.id || '',
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
  return [machine.machineCode, machine.name || machine.modelName, machine.serialNumber ? `S/N ${machine.serialNumber}` : '', machine.inventoryStatus ? displayLabel(machine.inventoryStatus) : '']
    .filter(Boolean)
    .join(' - ');
}

function customerLabel(customer: CustomerOption) {
  return [customer.customerCode, customer.hospitalName || customer.name, customer.province, customer.phone].filter(Boolean).join(' - ');
}

function machineModelLabel(model: MachineModelOption) {
  return [model.code, model.name, model.manufacturer, model.businessLine?.name].filter(Boolean).join(' - ');
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

function unpackList<T>(result: Paginated<T> | T[]) {
  return Array.isArray(result) ? result : result.data ?? [];
}

function formatDate(value: string) {
  if (!value) return 'Chưa chọn';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

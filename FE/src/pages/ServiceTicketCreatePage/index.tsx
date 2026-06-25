import { ArrowLeft, ChevronDown, ChevronUp, Loader2, Plus, Save } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages } from '../../api';
import { getRoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { MachineAccessoryEditor } from '../../components/MachineAccessoryEditor';
import { isEndoscopyMachineModel } from '../../config/endoscopyAccessories';
import { isUltrasoundMachineModel } from '../../config/ultrasoundProbes';
import { parseMachineAccessoriesInput } from '../../utils/machineAccessories';

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
};
type MachineModelOption = {
  id: string;
  code?: string | null;
  name: string;
  displayName?: string | null;
  manufacturer?: string | null;
  productCategory?: string | null;
  businessLine?: {
    productCategory?: string | null;
    expertiseGroup?: 'IMAGING' | 'LAB_TESTING' | null;
    productIndustry?: {
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
};

type QuickCustomerForm = {
  address: string;
  contactPerson: string;
  name: string;
  phone: string;
  province: string;
  regionId: string;
};

type QuickMachineForm = {
  accessoriesText: string;
  customerId: string;
  machineModelId: string;
  modelName: string;
  name: string;
  serialNumber: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export function ServiceTicketCreatePage({ fixedKind, user }: { fixedKind?: TicketKind; user: ApiUser }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialKind = fixedKind ?? normalizeKind(searchParams.get('kind'));
  const initialMachineId = searchParams.get('machineId') ?? '';
  const initialCustomerId = searchParams.get('customerId') ?? '';
  const initialWarrantyStatus = searchParams.get('warrantyStatus') ?? '';
  const returnTo = searchParams.get('returnTo') ?? '';
  const role = getRoleName(user);
  const [kind, setKind] = useState<TicketKind>(initialKind);
  const [form, setForm] = useState<TicketForm>(() => emptyTicketForm(user, initialKind));
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [engineers, setEngineers] = useState<EngineerOption[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [machineModels, setMachineModels] = useState<MachineModelOption[]>([]);
  const [quickCustomerForm, setQuickCustomerForm] = useState<QuickCustomerForm>(() => emptyQuickCustomerForm(user));
  const [quickMachineForm, setQuickMachineForm] = useState<QuickMachineForm>(() => emptyQuickMachineForm());
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [showQuickMachine, setShowQuickMachine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [creatingMachine, setCreatingMachine] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const scope = fixedKind === 'installation' || initialKind === 'installation' ? 'installation' : 'service';

  const visibleMachines = useMemo(
    () =>
      machines
        .filter((machine) => canEngineerUseMachine(user, machine))
        .filter((machine) => kind === 'installation' || !form.customerId || machine.customer?.id === form.customerId),
    [form.customerId, kind, machines, user],
  );
  const visibleMachineModels = useMemo(() => machineModels.filter((model) => canEngineerUseModel(user, model)), [machineModels, user]);
  const selectedMachine = useMemo(() => visibleMachines.find((machine) => machine.id === form.machineId), [form.machineId, visibleMachines]);
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

  useEffect(() => {
    loadOptions();
  }, []);

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
    loadMachines(kind).catch((err) => {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách thiết bị.');
    });
  }, [fixedKind, initialCustomerId, initialMachineId, initialWarrantyStatus, kind, returnTo]);

  async function loadOptions() {
    setLoading(true);
    setError('');

    try {
      const [customersResult, modelsResult] = await Promise.all([
        apiFetch<Paginated<CustomerOption>>('/customers?limit=100'),
        apiFetchAllPages<MachineModelOption>('/machine-models'),
      ]);

      setCustomers(customersResult.data);
      setMachineModels(modelsResult);
      const initialCustomer = customersResult.data.find((customer) => customer.id === initialCustomerId);
      if (initialCustomer) {
        applyCustomer(initialCustomer);
      }

      if (role === 'engineer') {
        setEngineers([{ id: user.id, email: user.email, fullName: user.fullName }]);
        setRegions(user.region?.id ? [{ id: user.region.id, name: user.region.name }] : []);
      } else {
        const [engineersResult, regionsResult] = await Promise.all([
          apiFetch<Paginated<EngineerOption>>('/users?limit=100&roleName=engineer'),
          apiFetch<Paginated<Region> | Region[]>('/regions?limit=100'),
        ]);
        setEngineers(engineersResult.data);
        setRegions(unpackList(regionsResult));
      }

      await loadMachines(kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu tạo phiếu.');
    } finally {
      setLoading(false);
    }
  }

  async function loadMachines(nextKind: TicketKind) {
    const inventoryStatus = nextKind === 'installation' ? 'IN_STOCK' : 'INSTALLED';
    const result = await apiFetch<Paginated<MachineOption>>(`/machines?limit=100&inventoryStatus=${inventoryStatus}`);
    const availableMachines = result.data.filter((machine) => canEngineerUseMachine(user, machine));
    setMachines(availableMachines);
    const initialMachine = availableMachines.find((machine) => machine.id === initialMachineId);
    if (initialMachine) {
      applyMachine(initialMachine);
    }
  }

  function updateForm(patch: Partial<TicketForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function selectMachine(machineId: string) {
    const machine = machines.find((item) => item.id === machineId);
    applyMachine(machine, machineId);
  }

  function selectCustomer(customerId: string) {
    const customer = customers.find((item) => item.id === customerId);
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

  function applyMachine(machine?: MachineOption, fallbackMachineId = machine?.id ?? '') {
    updateForm({
      machineId: machine?.id || fallbackMachineId,
      customerId: machine?.customer?.id || form.customerId,
      deviceName: machine?.name || form.deviceName,
      modelName: machine?.modelName || form.modelName,
      serialNumber: machine?.serialNumber || form.serialNumber,
    });
  }

  async function createCustomer() {
    const name = quickCustomerForm.name.trim();
    const regionId = quickCustomerForm.regionId.trim();

    if (!name || !regionId) {
      setError('Vui lòng nhập tên khách hàng và chọn khu vực.');
      return;
    }

    setCreatingCustomer(true);
    setError('');
    setSuccess('');

    try {
      const customer = await apiFetch<CustomerOption>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone: quickCustomerForm.phone.trim() || undefined,
          contactPerson: quickCustomerForm.contactPerson.trim() || undefined,
          contactPhone: quickCustomerForm.phone.trim() || undefined,
          province: quickCustomerForm.province.trim() || undefined,
          address: quickCustomerForm.address.trim() || undefined,
          regionId,
          status: 'ACTIVE',
        }),
      });

      setCustomers((current) => [customer, ...current.filter((item) => item.id !== customer.id)]);
      setForm((current) => ({ ...current, customerId: customer.id }));
      setQuickMachineForm((current) => ({ ...current, customerId: customer.id }));
      setQuickCustomerForm(emptyQuickCustomerForm(user));
      setShowQuickCustomer(false);
      setSuccess('Đã tạo khách hàng và chọn vào phiếu.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được khách hàng.');
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function createMachine() {
    const serialNumber = quickMachineForm.serialNumber.trim();
    const modelName = quickMachineForm.modelName.trim() || selectedModel?.name || selectedModel?.code || '';

    if (!serialNumber || !modelName) {
      setError('Vui lòng nhập Serial và chọn model hoặc nhập tên model tạm.');
      return;
    }

    setCreatingMachine(true);
    setError('');
    setSuccess('');

    try {
      const machine = await apiFetch<MachineOption>('/machines', {
        method: 'POST',
        body: JSON.stringify({
          serialNumber,
          machineModelId: selectedModel?.id,
          modelName: selectedModel ? undefined : modelName,
          name: quickMachineForm.name.trim() || selectedModel?.displayName || modelName,
          customerId: quickMachineForm.customerId || form.customerId || undefined,
          inventoryStatus: kind === 'installation' ? 'IN_STOCK' : 'INSTALLED',
          status: 'ACTIVE',
          dataStatus: 'PENDING_REVIEW',
          createdSource: role === 'admin' ? 'ADMIN' : 'ENGINEER',
          primaryEngineerId: role === 'engineer' ? user.id : undefined,
          accessories: parseMachineAccessoriesInput(quickMachineForm.accessoriesText),
        }),
      });

      setMachines((current) => [machine, ...current.filter((item) => item.id !== machine.id)]);
      setForm((current) => ({
        ...current,
        machineId: machine.id,
        customerId: current.customerId || quickMachineForm.customerId || machine.customer?.id || '',
        deviceName: current.deviceName || machine.name || modelName,
        modelName: current.modelName || machine.modelName || modelName,
        serialNumber: current.serialNumber || serialNumber,
      }));
      setQuickMachineForm(emptyQuickMachineForm());
      setShowQuickMachine(false);
      setSuccess('Đã tạo thiết bị và chọn vào phiếu.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được thiết bị.');
    } finally {
      setCreatingMachine(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (kind === 'repair') {
        await apiFetch('/repairs', {
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
      } else if (kind === 'maintenance') {
        await apiFetch('/maintenance', {
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
      } else {
        await apiFetch('/installations', {
          method: 'POST',
          body: JSON.stringify({
            machineId: form.machineId || undefined,
            machineModelId: form.machineModelId || undefined,
            plannedModelName: visibleMachineModels.find((model) => model.id === form.machineModelId)?.name || form.modelName.trim() || undefined,
            customerId: form.customerId,
            installedById: form.engineerId,
            installedAt: form.scheduledDate,
            warrantyStartDate: form.warrantyStartDate || form.scheduledDate,
            warrantyEndDate: form.warrantyEndDate,
            note: form.description.trim() || undefined,
          }),
        });
      }

      setSuccess(role === 'engineer' ? 'Đã tạo phiếu. Admin sẽ kiểm tra thông tin máy nếu cần.' : 'Đã tạo phiếu.');
      setForm(emptyTicketForm(user, kind));
      window.setTimeout(() => navigate(backHref), 450);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được phiếu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageFrame>
      <div className="flex flex-wrap items-start justify-between gap-4 font-sans">
        <PageTitle
          eyebrow="Phiếu dịch vụ"
          title="Tạo phiếu"
          description="Tạo phiếu từ đúng mục nghiệp vụ. Dữ liệu khách hàng hoặc thiết bị do kỹ sư tạo nhanh sẽ chờ admin kiểm tra trước khi xác nhận chính thức."
        />
        <button className="secondary-button" onClick={() => navigate(backHref)} type="button">
          <ArrowLeft size={17} />
          Quay lại danh sách
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      {role === 'engineer' ? (
        <div className="rounded-lg border border-[#efd8a8] bg-[#fffbeb] px-4 py-3 text-sm font-semibold leading-relaxed text-[#92400e]">
          Phiếu mới sẽ được lưu để admin kiểm tra và phân công khi cần.
        </div>
      ) : null}

      <form className="grid min-w-0 gap-4 font-sans min-[1320px]:grid-cols-[minmax(0,1fr)_360px]" onSubmit={submit}>
        <section className="grid min-w-0 gap-4">
          <div className={panelClass}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#eeeeee] pb-4">
              <div>
                <span className="text-xs font-medium text-[#d71920]">Bước 1</span>
                <h2 className="mt-1 text-lg font-medium text-[#1f1f1f]">Thông tin phiếu</h2>
                <p className="mt-1 text-sm text-[#666666]">Chọn đúng loại phiếu, thiết bị và kỹ sư phụ trách trước khi nhập chi tiết.</p>
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

            <div className="grid gap-4 md:grid-cols-2">
              {kind !== 'installation' ? (
                <label className={wideLabelClass}>
                  Tiêu đề
                  <input className={fieldClass} onChange={(event) => updateForm({ title: event.target.value })} required value={form.title} />
                </label>
              ) : null}

              {kind === 'installation' ? (
                <label className={wideLabelClass}>
                  Model dự kiến
                  <select
                    className={fieldClass}
                    disabled={loading}
                    onChange={(event) => {
                      const model = visibleMachineModels.find((item) => item.id === event.target.value);
                      updateForm({
                        machineModelId: event.target.value,
                        modelName: model?.name || model?.displayName || '',
                      });
                    }}
                    required
                    value={form.machineModelId}
                  >
                    <option value="">Chọn model cần lắp</option>
                    {visibleMachineModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {modelLabel(model)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
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
              )}

              {kind !== 'installation' ? (
                <label className={labelClass}>
                  Khách hàng
                  <select className={fieldClass} disabled={loading} onChange={(event) => selectCustomer(event.target.value)} value={form.customerId}>
                    <option value="">Tất cả khách hàng</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customerLabel(customer)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {kind === 'installation' ? (
                <label className={labelClass}>
                  Khách hàng
                  <select className={fieldClass} disabled={loading} onChange={(event) => selectCustomer(event.target.value)} required value={form.customerId}>
                    <option value="">Chọn khách hàng</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customerLabel(customer)}
                      </option>
                    ))}
                  </select>
                </label>
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
                <RepairFields form={form} updateForm={updateForm} />
              ) : kind === 'maintenance' ? (
                <MaintenanceFields form={form} updateForm={updateForm} />
              ) : (
                <InstallationFields form={form} updateForm={updateForm} />
              )}
            </div>
          </div>

          <div className={panelClass}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#eeeeee] pb-4">
              <div>
                <span className="text-xs font-medium text-[#d71920]">Bước 2</span>
                <h2 className="text-lg font-medium text-[#1f1f1f]">Dữ liệu chưa có</h2>
                <p className="mt-1 text-sm text-[#666666]">Chỉ mở phần này khi tìm không thấy khách hàng hoặc thiết bị trong danh sách.</p>
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
                customers={customers}
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

        <aside className="grid min-w-0 gap-4 self-start">
          <div className={panelClass}>
            <span className="text-xs font-medium text-[#d71920]">Kiểm tra</span>
            <h2 className="mb-4 mt-1 text-lg font-medium text-[#1f1f1f]">Tóm tắt</h2>
            <div className="grid gap-3 text-sm text-[#333333]">
              <SummaryRow label="Loại phiếu" value={ticketKindLabel(kind)} />
              <SummaryRow label="Thiết bị" value={selectedMachine ? machineLabel(selectedMachine) : 'Chưa chọn'} />
              <SummaryRow label="Khách hàng" value={customerNameForSummary(selectedMachine, customers, form.customerId)} />
              <SummaryRow label="Kỹ sư" value={engineers.find((engineer) => engineer.id === form.engineerId)?.fullName || 'Chưa phân công'} />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button className="secondary-button" onClick={() => navigate(backHref)} type="button">
              Hủy
            </button>
            <button className="primary-button" disabled={saving || loading} type="submit">
              {saving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
              Tạo phiếu
            </button>
          </div>
        </aside>
      </form>
    </PageFrame>
  );
}

function RepairFields({ form, updateForm }: { form: TicketForm; updateForm: (patch: Partial<TicketForm>) => void }) {
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
      <label className={labelClass}>
        Ngày báo lỗi
        <input className={fieldClass} onChange={(event) => updateForm({ reportedAt: event.target.value })} type="date" value={form.reportedAt} />
      </label>
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

function MaintenanceFields({ form, updateForm }: { form: TicketForm; updateForm: (patch: Partial<TicketForm>) => void }) {
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
      <label className={labelClass}>
        Ngày bảo trì
        <input className={fieldClass} onChange={(event) => updateForm({ scheduledDate: event.target.value })} required type="date" value={form.scheduledDate} />
      </label>
      <label className={labelClass}>
        Lịch tiếp theo
        <input className={fieldClass} onChange={(event) => updateForm({ nextDueDate: event.target.value })} type="date" value={form.nextDueDate} />
      </label>
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
      <label className={labelClass}>
        Tên thiết bị
        <input className={fieldClass} onChange={(event) => updateForm({ deviceName: event.target.value })} value={form.deviceName} />
      </label>
      <label className={labelClass}>
        Model
        <input className={fieldClass} onChange={(event) => updateForm({ modelName: event.target.value })} value={form.modelName} />
      </label>
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

function InstallationFields({ form, updateForm }: { form: TicketForm; updateForm: (patch: Partial<TicketForm>) => void }) {
  return (
    <>
      <label className={labelClass}>
        Ngày lắp đặt
        <input className={fieldClass} onChange={(event) => updateForm({ scheduledDate: event.target.value, warrantyStartDate: event.target.value })} required type="date" value={form.scheduledDate} />
      </label>
      <label className={labelClass}>
        Bắt đầu bảo hành
        <input className={fieldClass} onChange={(event) => updateForm({ warrantyStartDate: event.target.value })} type="date" value={form.warrantyStartDate} />
      </label>
      <label className={labelClass}>
        Kết thúc bảo hành
        <input className={fieldClass} onChange={(event) => updateForm({ warrantyEndDate: event.target.value })} required type="date" value={form.warrantyEndDate} />
      </label>
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
    <div className="mb-4 grid gap-4 rounded-lg border border-[#eeeeee] bg-[#f8fbfd] p-4 md:grid-cols-2">
      <label className={labelClass}>
        Tên khách hàng
        <input className={fieldClass} onChange={(event) => updateForm({ name: event.target.value })} value={form.name} />
      </label>
      {isEngineer ? (
        <div className="grid min-w-0 gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm">
          <span className="font-bold text-[#333333]">Khu vực</span>
          <strong className="text-[#1f1f1f]">{regions[0]?.name || 'Theo khu vực tài khoản'}</strong>
        </div>
      ) : (
        <label className={labelClass}>
          Khu vực
          <select className={fieldClass} onChange={(event) => updateForm({ regionId: event.target.value })} value={form.regionId}>
            <option value="">Chọn khu vực</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={labelClass}>
        Tỉnh/Thành
        <input className={fieldClass} onChange={(event) => updateForm({ province: event.target.value })} value={form.province} />
      </label>
      <label className={labelClass}>
        Người liên hệ
        <input className={fieldClass} onChange={(event) => updateForm({ contactPerson: event.target.value })} value={form.contactPerson} />
      </label>
      <label className={labelClass}>
        Số điện thoại
        <input className={fieldClass} onChange={(event) => updateForm({ phone: event.target.value })} value={form.phone} />
      </label>
      <label className={wideLabelClass}>
        Địa chỉ
        <input className={fieldClass} onChange={(event) => updateForm({ address: event.target.value })} value={form.address} />
      </label>
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
  customers,
  form,
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
  customers: CustomerOption[];
  form: QuickMachineForm;
  kind: TicketKind;
  models: MachineModelOption[];
  onCreate: () => void;
  selectedModel?: MachineModelOption;
  supportsAccessories: boolean;
  updateForm: (patch: Partial<QuickMachineForm>) => void;
}) {
  return (
    <div className="grid gap-4 rounded-lg border border-[#eeeeee] bg-[#f8fbfd] p-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <span className="rounded-full border border-[#e5e5e5] bg-white px-2.5 py-1 text-xs font-medium text-[#333333]">
          {kind === 'installation' ? 'Tạo máy trong kho' : 'Tạo máy đã lắp'}
        </span>
      </div>
      <label className={wideLabelClass}>
        Model sản phẩm
        <select
          className={fieldClass}
          onChange={(event) => {
            const model = models.find((item) => item.id === event.target.value);
            updateForm({
              machineModelId: event.target.value,
              modelName: model?.name || model?.code || form.modelName,
              name: form.name || model?.displayName || model?.name || '',
            });
          }}
          value={form.machineModelId}
        >
          <option value="">Chọn model chuẩn hoặc nhập model tạm bên dưới</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {[model.code, model.name, model.manufacturer].filter(Boolean).join(' - ')}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Serial Number
        <input className={fieldClass} onChange={(event) => updateForm({ serialNumber: event.target.value })} value={form.serialNumber} />
      </label>
      <label className={labelClass}>
        Model/Tên máy tạm
        <input className={fieldClass} onChange={(event) => updateForm({ modelName: event.target.value })} value={form.modelName} />
      </label>
      <label className={labelClass}>
        Tên thiết bị
        <input className={fieldClass} onChange={(event) => updateForm({ name: event.target.value })} value={form.name} />
      </label>
      <label className={labelClass}>
        Khách hàng
        <select className={fieldClass} onChange={(event) => updateForm({ customerId: event.target.value })} value={form.customerId}>
          <option value="">Không chọn</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customerLabel(customer)}
            </option>
          ))}
        </select>
      </label>
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
      {selectedModel ? <input readOnly className="hidden" value={selectedModel.id} /> : null}
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

const panelClass = 'rounded-lg border border-[#e5e5e5] bg-white p-5 shadow-[0_1px_2px_rgba(20,32,51,0.04)]';
const labelClass = 'grid min-w-0 content-start gap-2 font-sans text-sm font-medium leading-snug text-[#333333]';
const wideLabelClass = `${labelClass} md:col-span-2`;
const fieldClass =
  'h-11 w-full min-w-0 rounded-lg border border-[#d6d6d6] bg-white px-3 font-sans text-sm font-medium text-[#1f1f1f] outline-none transition placeholder:text-[#9aa6b5] focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)] disabled:cursor-not-allowed disabled:bg-[#fafafa] disabled:text-[#8a8a8a]';
const textareaClass =
  'min-h-28 w-full min-w-0 resize-y rounded-lg border border-[#d6d6d6] bg-white px-3 py-2.5 font-sans text-sm font-medium leading-relaxed text-[#1f1f1f] outline-none transition placeholder:text-[#9aa6b5] focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)] disabled:cursor-not-allowed disabled:bg-[#fafafa] disabled:text-[#8a8a8a]';

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
  };
}

function emptyQuickCustomerForm(user: ApiUser): QuickCustomerForm {
  return {
    address: '',
    contactPerson: '',
    name: '',
    phone: '',
    province: '',
    regionId: user.regionId || user.region?.id || '',
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
  const expertiseGroup = user.engineerProfile?.expertiseGroup;
  if (getRoleName(user) !== 'engineer' || !expertiseGroup) return true;

  const modelGroup = model.businessLine?.productIndustry?.expertiseGroup ?? model.businessLine?.expertiseGroup;
  return !modelGroup || modelGroup === expertiseGroup;
}

function ticketKindLabel(kind: TicketKind) {
  if (kind === 'maintenance') return 'Bảo trì';
  if (kind === 'installation') return 'Lắp đặt';
  return 'Sửa chữa';
}

function customerLabel(customer: CustomerOption) {
  return [customer.customerCode, customer.name, customer.province, customer.phone].filter(Boolean).join(' - ');
}

function machineLabel(machine: MachineOption) {
  return [machine.machineCode, machine.serialNumber, machine.modelName || machine.name, machine.customer?.name].filter(Boolean).join(' - ');
}

function modelLabel(model: MachineModelOption) {
  return [model.code, model.displayName || model.name, model.manufacturer].filter(Boolean).join(' - ');
}

function customerNameForSummary(machine: MachineOption | undefined, customers: CustomerOption[], customerId: string) {
  return machine?.customer?.name || customers.find((customer) => customer.id === customerId)?.name || 'Chưa chọn';
}

import { ArrowRight, Building2, CalendarClock, ChevronLeft, ClipboardList, Phone, Search, Stethoscope, UserRound, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';

type UserSummary = {
  id: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
};

type EngineerOption = UserSummary & {
  region?: { id: string; name: string } | null;
};

type CustomerSummary = {
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

type MachineHistory = {
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
};

type DirectMachineRef = {
  id?: string | null;
  machineCode?: string | null;
  serialNumber?: string | null;
  modelName?: string | null;
};

type MachineAccessory = {
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

type InventoryMovement = {
  id: string;
  code?: string | null;
  type?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  occurredAt?: string | null;
  note?: string | null;
  createdBy?: UserSummary | null;
};

type CustomerMachine = {
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

type CustomerDetail = CustomerSummary & {
  machines?: CustomerMachine[];
};

type EngineerCustomersPageProps = {
  currentRole: RoleName;
  user: ApiUser;
};

type TimelineItem = {
  id: string;
  kind: 'installation' | 'repair' | 'maintenance' | 'inventory';
  title: string;
  machine?: CustomerMachine;
  machineLabel?: string;
  date?: string | null;
  status?: string | null;
  note?: string | null;
  person?: string | null;
};

type OpenTaskItem = TimelineItem & {
  href: string;
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng theo dõi',
  POTENTIAL: 'Tiềm năng',
  BLACKLISTED: 'Tạm khóa',
  INSTALLED: 'Đã lắp',
  IN_STOCK: 'Trong kho',
  REPAIRING: 'Đang sửa',
  MAINTENANCE: 'Bảo trì',
  PENDING: 'Chờ xử lý',
  ASSIGNED: 'Đã phân công',
  IN_PROGRESS: 'Đang thực hiện',
  WAITING_PARTS: 'Chờ linh kiện',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  SCHEDULED: 'Đã lên lịch',
  OVERDUE: 'Quá hạn',
  IMPORT: 'Nhập kho',
  SPLIT_ACCESSORY: 'Tách phụ kiện',
  RESERVE: 'Giữ máy',
  INSTALL: 'Giao/lắp máy',
  RETURN: 'Thu hồi',
  SELL: 'Bán',
  ADJUST_STATUS: 'Điều chỉnh',
  ACCESSORY_SPLIT: 'Đã tách phụ kiện',
  RESERVED: 'Đã giữ máy',
  RETURNED: 'Đã thu hồi',
  SOLD: 'Đã bán',
};

const categoryLabels: Record<string, string> = {
  ULTRASOUND: 'Siêu âm',
  LAB_TESTING: 'Xét nghiệm',
  BIOCHEMISTRY: 'Sinh hóa',
  IMMUNOLOGY: 'Miễn dịch',
  HEMATOLOGY: 'Huyết học',
  X_RAY: 'X-quang',
  ENDOSCOPY: 'Nội soi',
  OTHER: 'Khác',
};

export function EngineerCustomersPage({ currentRole, user }: EngineerCustomersPageProps) {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [engineers, setEngineers] = useState<EngineerOption[]>([]);
  const [selectedEngineerId, setSelectedEngineerId] = useState('');
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadCustomers();
  }, [currentRole, selectedEngineerId, user.id]);

  useEffect(() => {
    if (currentRole === 'engineer') return;
    void loadEngineers();
  }, [currentRole]);

  useEffect(() => {
    if (!selectedCustomerId) {
      setDetail(null);
      return;
    }

    void loadCustomerDetail(selectedCustomerId);
  }, [selectedCustomerId]);

  async function loadCustomers() {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ limit: '100' });
      if (currentRole === 'engineer') {
        params.set('primaryEngineerId', user.id);
      } else if (selectedEngineerId) {
        params.set('primaryEngineerId', selectedEngineerId);
      }
      const query = `/customers?${params.toString()}`;
      const result = await apiFetch<Paginated<CustomerSummary>>(query);
      const requestedCustomerId = searchParams.get('customerId') || '';
      setCustomers(result.data);
      setSelectedCustomerId((current) => {
        const nextId = requestedCustomerId || current;
        return result.data.some((customer) => customer.id === nextId) ? nextId : result.data[0]?.id || '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách khách hàng.');
    } finally {
      setLoading(false);
    }
  }

  async function loadEngineers() {
    try {
      const result = await apiFetch<Paginated<EngineerOption>>('/users?limit=100&roleName=engineer&status=ACTIVE');
      setEngineers(result.data);
    } catch {
      setEngineers([]);
    }
  }

  async function loadCustomerDetail(customerId: string) {
    setDetailLoading(true);

    try {
      setDetail(await apiFetch<CustomerDetail>(`/customers/${customerId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được chi tiết khách hàng.');
    } finally {
      setDetailLoading(false);
    }
  }

  const visibleCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return customers;

    return customers.filter((customer) =>
      [
        customer.customerCode,
        customer.name,
        customer.hospitalName,
        customer.province,
        customer.phone,
        customer.primaryEngineer?.fullName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [customers, search]);

  const selectedCustomer = detail ?? customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  const machines = detail?.machines ?? [];
  const isAdminProfile = location.pathname.startsWith('/customers/profile');
  const timeline = useMemo(() => buildTimeline(machines, selectedCustomer), [machines, selectedCustomer]);
  const openTasks = useMemo(() => buildOpenTasks(machines, selectedCustomer, isAdminProfile), [isAdminProfile, machines, selectedCustomer]);
  const totalRepairs = countUnique([
    ...machines.flatMap((machine) => machine.repairs ?? []),
    ...(selectedCustomer?.directRepairs ?? []),
  ]);
  const totalMaintenances = countUnique([
    ...machines.flatMap((machine) => machine.maintenances ?? []),
    ...(selectedCustomer?.directMaintenances ?? []),
  ]);
  const totalAccessories = machines.reduce((total, machine) => total + (machine.accessories?.length ?? 0), 0);

  return (
    <section className="grid gap-5 p-6 max-sm:p-4">
      <div className="grid gap-4 rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[#d71920]">Chăm sóc khách hàng</span>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-[#1f1f1f]">{isAdminProfile ? 'Hồ sơ khách hàng' : 'Khách hàng phụ trách'}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#666666]">
              {isAdminProfile
                ? 'Xem người phụ trách, máy đã lắp, lịch sử sửa chữa, bảo trì và phụ kiện liên quan của từng khách hàng.'
                : 'Theo dõi máy đang lắp, lịch sử sửa chữa và các lần bảo trì của từng khách hàng trong một màn hình.'}
            </p>
          </div>
          <Link className="secondary-button" to="/">
            <ChevronLeft size={16} />
            Tổng quan
          </Link>
        </div>

        {isAdminProfile ? (
          <label className="grid max-w-sm gap-1.5 text-sm font-medium text-[#333333]">
            Lọc theo kỹ sư quản lý
            <select
              className="h-11 rounded-lg border border-[#d6d6d6] bg-white px-3 text-sm font-medium text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]"
              onChange={(event) => {
                setSelectedEngineerId(event.target.value);
                setSelectedCustomerId('');
              }}
              value={selectedEngineerId}
            >
              <option value="">Tất cả kỹ sư</option>
              {engineers.map((engineer) => (
                <option key={engineer.id} value={engineer.id}>
                  {[engineer.fullName || engineer.email, engineer.region?.name].filter(Boolean).join(' - ')}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid gap-3 md:grid-cols-5">
          <Metric icon={<Building2 size={18} />} label="Khách đang theo dõi" value={customers.length} />
          <Metric icon={<Stethoscope size={18} />} label="Máy tại khách chọn" value={machines.length} />
          <Metric icon={<Wrench size={18} />} label="Lượt sửa chữa" value={totalRepairs} />
          <Metric icon={<CalendarClock size={18} />} label="Lượt bảo trì" value={totalMaintenances} />
          <Metric icon={<ClipboardList size={18} />} label="Phụ kiện/linh kiện" value={totalAccessories} />
        </div>
      </div>

      {error ? <div className="rounded-lg border border-[#ffd5d8] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#b51219]">{error}</div> : null}

      <div className="grid min-h-[620px] gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="grid content-start gap-3 rounded-xl border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8a8a]" size={16} />
            <input
              className="h-11 w-full rounded-lg border border-[#e5e5e5] bg-[#fafafa] pl-9 pr-3 text-sm font-medium text-[#1f1f1f] outline-none transition placeholder:text-[#8a8a8a] focus:border-[#d71920] focus:bg-white"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm khách hàng, mã, tỉnh..."
              value={search}
            />
          </label>

          <div className="grid max-h-[560px] gap-2 overflow-y-auto pr-1">
            {loading ? (
              <EmptyState title="Đang tải danh sách..." />
            ) : visibleCustomers.length ? (
              visibleCustomers.map((customer) => {
                const isActive = customer.id === selectedCustomerId;
                return (
                  <button
                    className={`grid gap-2 rounded-lg border p-3 text-left transition ${
                      isActive
                        ? 'border-[#f5c7cb] bg-[#fff7f7] shadow-[inset_3px_0_0_#d71920]'
                        : 'border-[#eeeeee] bg-white hover:border-[#f5c7cb] hover:bg-[#fffafa]'
                    }`}
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <strong className="line-clamp-2 text-sm leading-5 text-[#1f1f1f]">{customer.hospitalName || customer.name}</strong>
                      <span className="shrink-0 rounded-md bg-[#f2f2f2] px-2 py-1 text-[11px] font-semibold text-[#555555]">{customer._count?.machines ?? 0} máy</span>
                    </div>
                    <span className="text-xs font-medium text-[#666666]">{[customer.customerCode, customer.province].filter(Boolean).join(' - ') || 'Chưa có mã/tỉnh'}</span>
                    <span className="text-xs text-[#8a8a8a]">{customer.primaryEngineer?.fullName ? `Phụ trách: ${customer.primaryEngineer.fullName}` : 'Chưa gán kỹ sư phụ trách'}</span>
                  </button>
                );
              })
            ) : (
              <EmptyState title="Chưa có khách hàng phù hợp" />
            )}
          </div>
        </aside>

        <main className="min-w-0">
          {selectedCustomer ? (
            <CustomerDetailView customer={selectedCustomer} detailLoading={detailLoading} isAdminProfile={isAdminProfile} machines={machines} openTasks={openTasks} timeline={timeline} />
          ) : (
            <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-[#d7d7d7] bg-white p-8 text-center">
              <EmptyState title="Chọn một khách hàng để xem chi tiết" />
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

function CustomerDetailView({
  customer,
  detailLoading,
  isAdminProfile,
  machines,
  openTasks,
  timeline,
}: {
  customer: CustomerSummary;
  detailLoading: boolean;
  isAdminProfile: boolean;
  machines: CustomerMachine[];
  openTasks: OpenTaskItem[];
  timeline: TimelineItem[];
}) {
  const returnTo = encodeURIComponent(isAdminProfile ? `/customers/profile?customerId=${customer.id}` : '/my-customers');
  const accessories = machines.flatMap((machine) =>
    (machine.accessories ?? []).map((accessory) => ({ ...accessory, machine })),
  );
  const installationAccessories = machines.flatMap((machine) =>
    (machine.installations ?? []).flatMap((installation) =>
      normalizeAccessoryList(installation.accessories).map((name) => ({
        id: `${installation.id}-${name}`,
        name,
        machine,
        installedAt: installation.installedAt,
        code: installation.code,
      })),
    ),
  );

  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[#666666]">{customer.customerCode || customer.region?.name || 'Khách hàng'}</span>
            <h2 className="mt-1 text-xl font-semibold text-[#1f1f1f]">{customer.hospitalName || customer.name}</h2>
            <p className="mt-1 text-sm leading-6 text-[#666666]">{customer.fullAddress || [customer.address, customer.district, customer.province].filter(Boolean).join(', ') || 'Chưa có địa chỉ'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="primary-button" to={`/service-tickets/create?kind=repair&customerId=${customer.id}&returnTo=${returnTo}`}>
              <Wrench size={16} />
              Tạo sửa chữa
            </Link>
            <Link className="secondary-button" to={`/service-tickets/create?kind=maintenance&customerId=${customer.id}&returnTo=${returnTo}`}>
              <CalendarClock size={16} />
              Tạo bảo trì
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <InfoTile icon={<UserRound size={17} />} label="Kỹ sư phụ trách" value={customer.primaryEngineer?.fullName || 'Chưa gán'} hint={customer.primaryEngineer?.phone || customer.primaryEngineer?.email || ''} />
          <InfoTile icon={<Phone size={17} />} label="Liên hệ" value={customer.contactPerson || customer.phone || 'Chưa có'} hint={customer.contactPhone || customer.phone || ''} />
          <InfoTile icon={<ClipboardList size={17} />} label="Trạng thái khách hàng" value={displayStatus(customer.status)} hint={categoryLabels[customer.customerType || ''] || customer.customerType || ''} />
        </div>
      </div>

      <section className="grid content-start gap-3 rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
        <PanelTitle title="Việc đang mở" subtitle="Các phiếu cần xử lý, đang làm hoặc chờ xác nhận của khách hàng này" />
        {detailLoading ? (
          <EmptyState title="Đang tải việc đang mở..." />
        ) : openTasks.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {openTasks.map((task) => (
              <div className="grid gap-3 rounded-lg border border-[#eeeeee] bg-[#fbfdff] p-3" key={`${task.kind}-${task.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-[#d71920]">{taskKindLabel(task.kind)}</span>
                    <strong className="mt-1 block text-sm text-[#1f1f1f]">{task.title}</strong>
                  </div>
                  <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[#555555]">{displayStatus(task.status)}</span>
                </div>
                <span className="text-xs leading-5 text-[#666666]">
                  {[formatDate(task.date), task.machine ? machineTitle(task.machine) : task.machineLabel, task.person].filter(Boolean).join(' - ') || 'Chưa có thông tin máy/kỹ sư'}
                </span>
                {task.note ? <p className="line-clamp-2 text-xs leading-5 text-[#666666]">{task.note}</p> : null}
                <Link className="secondary-button justify-center" to={task.href}>
                  Cập nhật phiếu
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Không có việc đang mở cho khách hàng này" />
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <section className="grid content-start gap-3 rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
          <PanelTitle title="Máy đang quản lý" subtitle={`${machines.length} máy gắn với khách hàng này`} />
          {detailLoading ? (
            <EmptyState title="Đang tải máy..." />
          ) : machines.length ? (
            <div className="grid gap-3">
              {machines.map((machine) => (
                <MachineCard customerId={customer.id} key={machine.id} machine={machine} returnTo={returnTo} />
              ))}
            </div>
          ) : (
            <EmptyState title="Khách hàng này chưa có máy trong dữ liệu" />
          )}
        </section>

        <section className="grid content-start gap-3 rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
          <PanelTitle title="Lịch sử công việc" subtitle="Lắp đặt, sửa chữa và bảo trì gần nhất" />
          {detailLoading ? (
            <EmptyState title="Đang tải lịch sử..." />
          ) : timeline.length ? (
            <div className="grid gap-3">
              {timeline.map((item) => (
                <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 rounded-lg border border-[#eeeeee] bg-[#fbfdff] p-3" key={`${item.kind}-${item.id}`}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#d71920] shadow-[inset_0_0_0_1px_#eeeeee]">
                    {item.kind === 'repair' ? <Wrench size={16} /> : item.kind === 'maintenance' ? <CalendarClock size={16} /> : item.kind === 'inventory' ? <ClipboardList size={16} /> : <Stethoscope size={16} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm text-[#1f1f1f]">{item.title}</strong>
                      <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[#555555]">{displayStatus(item.status)}</span>
                    </div>
                    <span className="mt-1 block text-xs text-[#666666]">
                      {[formatDate(item.date), item.machine ? machineTitle(item.machine) : item.machineLabel, item.person].filter(Boolean).join(' - ')}
                    </span>
                    {item.note ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#666666]">{item.note}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có lịch sử công việc" />
          )}
        </section>
      </div>

      <section className="grid content-start gap-3 rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
        <PanelTitle title="Linh kiện và phụ kiện liên quan" subtitle="Phụ kiện đang gắn trên máy, phụ kiện bàn giao khi lắp đặt và ghi chú kho gần nhất" />
        {detailLoading ? (
          <EmptyState title="Đang tải phụ kiện..." />
        ) : accessories.length || installationAccessories.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accessories.map((accessory) => (
              <div className="grid gap-2 rounded-lg border border-[#eeeeee] bg-[#fbfdff] p-3" key={accessory.id}>
                <span className="text-xs font-semibold text-[#d71920]">{accessory.componentAccessory?.component?.name || accessory.componentAccessory?.name || accessory.code || 'Phụ kiện máy'}</span>
                <strong className="text-sm text-[#1f1f1f]">{accessory.name}</strong>
                <span className="text-xs leading-5 text-[#666666]">{[machineTitle(accessory.machine), accessory.serialNumber ? `S/N ${accessory.serialNumber}` : '', accessory.note || accessory.description].filter(Boolean).join(' - ')}</span>
              </div>
            ))}
            {installationAccessories.map((item) => (
              <div className="grid gap-2 rounded-lg border border-[#eeeeee] bg-[#fffafa] p-3" key={item.id}>
                <span className="text-xs font-semibold text-[#d71920]">Phụ kiện bàn giao</span>
                <strong className="text-sm text-[#1f1f1f]">{item.name}</strong>
                <span className="text-xs leading-5 text-[#666666]">{[machineTitle(item.machine), item.code, formatDate(item.installedAt)].filter(Boolean).join(' - ')}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Chưa ghi nhận phụ kiện hoặc linh kiện thay thế riêng cho khách hàng này" />
        )}
      </section>
    </div>
  );
}

function MachineCard({ customerId, machine, returnTo }: { customerId: string; machine: CustomerMachine; returnTo: string }) {
  return (
    <article className="grid gap-3 rounded-lg border border-[#eeeeee] bg-[#fbfdff] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="block text-sm text-[#1f1f1f]">{machineTitle(machine)}</strong>
          <span className="mt-1 block text-xs text-[#666666]">{[categoryLabels[machine.productCategory || ''], machine.manufacturer, machine.serialNumber ? `S/N ${machine.serialNumber}` : ''].filter(Boolean).join(' - ') || 'Chưa đủ thông tin máy'}</span>
        </div>
        <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-[#333333]">{displayStatus(machine.inventoryStatus || machine.status)}</span>
      </div>
      <div className="grid gap-2 text-xs text-[#666666] sm:grid-cols-3">
        <span>Lắp đặt: <b className="font-semibold text-[#333333]">{formatDate(machine.installDate) || '-'}</b></span>
        <span>Bảo hành: <b className="font-semibold text-[#333333]">{formatDate(machine.warrantyEndDate) || '-'}</b></span>
        <span>Kỹ sư máy: <b className="font-semibold text-[#333333]">{machine.primaryEngineer?.fullName || machine.installedBy?.fullName || '-'}</b></span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className="secondary-button" to={`/technical-machines/${machine.id}`}>
          Xem máy
          <ArrowRight size={15} />
        </Link>
        <Link className="secondary-button" to={`/service-tickets/create?kind=repair&machineId=${machine.id}&customerId=${customerId}&returnTo=${returnTo}`}>
          Sửa chữa
        </Link>
        <Link className="secondary-button" to={`/service-tickets/create?kind=maintenance&machineId=${machine.id}&customerId=${customerId}&returnTo=${returnTo}`}>
          Bảo trì
        </Link>
      </div>
    </article>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="grid grid-cols-[38px_minmax(0,1fr)] items-center gap-3 rounded-lg border border-[#eeeeee] bg-[#fbfdff] p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#d71920] shadow-[inset_0_0_0_1px_#eeeeee]">{icon}</div>
      <div>
        <strong className="block text-lg leading-tight text-[#1f1f1f]">{value}</strong>
        <span className="text-xs font-medium text-[#666666]">{label}</span>
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 rounded-lg border border-[#eeeeee] bg-[#fbfdff] p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#d71920] shadow-[inset_0_0_0_1px_#eeeeee]">{icon}</div>
      <div className="min-w-0">
        <span className="text-xs font-medium text-[#666666]">{label}</span>
        <strong className="block truncate text-sm text-[#1f1f1f]">{value}</strong>
        {hint ? <span className="block truncate text-xs text-[#8a8a8a]">{hint}</span> : null}
      </div>
    </div>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-[#1f1f1f]">{title}</h3>
      <p className="mt-1 text-sm text-[#666666]">{subtitle}</p>
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return <div className="rounded-lg border border-dashed border-[#dddddd] bg-[#fafafa] px-4 py-6 text-center text-sm font-medium text-[#666666]">{title}</div>;
}

function buildTimeline(machines: CustomerMachine[], customer?: CustomerSummary | null) {
  const seen = new Set<string>();
  const machineItems = machines
    .flatMap((machine) => [
      ...(machine.installations ?? []).map((item): TimelineItem => ({
        id: item.id,
        kind: 'installation',
        title: item.code ? `Lắp đặt ${item.code}` : 'Lắp đặt máy',
        machine,
        date: item.installedAt,
        status: item.status,
        note: item.warrantyCard?.endDate ? `Bảo hành đến ${formatDate(item.warrantyCard.endDate)}` : item.description,
        person: item.installedBy?.fullName,
      })),
      ...(machine.repairs ?? []).map((item): TimelineItem => ({
        id: item.id,
        kind: 'repair',
        title: item.title || item.code || 'Sửa chữa',
        machine,
        date: item.reportedAt || item.completedAt,
        status: item.status,
        note: item.resultNote || item.description,
        person: item.engineer?.fullName,
      })),
      ...(machine.maintenances ?? []).map((item): TimelineItem => ({
        id: item.id,
        kind: 'maintenance',
        title: item.title || item.code || 'Bảo trì',
        machine,
        date: item.scheduledDate || item.completedAt,
        status: item.status,
        note: item.resultNote || item.description,
        person: item.engineer?.fullName,
      })),
      ...(machine.inventoryMovements ?? []).map((item): TimelineItem => ({
        id: item.id,
        kind: 'inventory',
        title: item.code ? `Kho máy ${item.code}` : 'Biến động kho máy',
        machine,
        date: item.occurredAt,
        status: item.toStatus || item.type,
        note: [displayStatus(item.type), item.note, item.fromStatus && item.toStatus ? `${displayStatus(item.fromStatus)} -> ${displayStatus(item.toStatus)}` : ''].filter(Boolean).join(' - '),
        person: item.createdBy?.fullName,
      })),
    ]);
  const directItems: TimelineItem[] = [
    ...(customer?.directInstallations ?? []).map((item): TimelineItem => ({
      id: item.id,
      kind: 'installation',
      title: item.code ? `Lắp đặt ${item.code}` : 'Lắp đặt máy',
      machineLabel: directMachineLabel(item),
      date: item.installedAt,
      status: item.status,
      note: item.warrantyCard?.endDate ? `Bảo hành đến ${formatDate(item.warrantyCard.endDate)}` : item.description,
      person: item.installedBy?.fullName,
    })),
    ...(customer?.directRepairs ?? []).map((item): TimelineItem => ({
      id: item.id,
      kind: 'repair',
      title: item.title || item.code || 'Sửa chữa',
      machineLabel: directMachineLabel(item),
      date: item.reportedAt || item.completedAt,
      status: item.status,
      note: item.resultNote || item.description,
      person: item.engineer?.fullName,
    })),
    ...(customer?.directMaintenances ?? []).map((item): TimelineItem => ({
      id: item.id,
      kind: 'maintenance',
      title: item.title || item.code || 'Bảo trì',
      machineLabel: directMachineLabel(item),
      date: item.scheduledDate || item.completedAt,
      status: item.status,
      note: item.resultNote || item.description,
      person: item.engineer?.fullName,
    })),
  ];

  return [...machineItems, ...directItems]
    .filter((item) => {
      const key = `${item.kind}-${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 30);
}

function buildOpenTasks(machines: CustomerMachine[], customer: CustomerSummary | null, isAdminProfile: boolean): OpenTaskItem[] {
  const returnTo = encodeURIComponent(isAdminProfile && customer ? `/customers/profile?customerId=${customer.id}` : '/my-customers');
  return buildTimeline(machines, customer)
    .filter((item) => item.kind !== 'inventory' && !isClosedStatus(item.status))
    .slice(0, 8)
    .map((item) => ({
      ...item,
      href:
        item.kind === 'installation'
          ? `/installations/${item.id}/update?returnTo=${returnTo}`
          : item.kind === 'maintenance'
            ? `/maintenance/${item.id}/update?returnTo=${returnTo}`
            : `/repairs/${item.id}/update?returnTo=${returnTo}`,
    }));
}

function countUnique(items: Array<{ id: string }>) {
  return new Set(items.map((item) => item.id)).size;
}

function isClosedStatus(status?: string | null) {
  return ['APPROVED', 'CANCELLED', 'COMPLETED', 'INSTALLED'].includes(status || '');
}

function taskKindLabel(kind: TimelineItem['kind']) {
  if (kind === 'installation') return 'Lắp đặt';
  if (kind === 'maintenance') return 'Bảo trì';
  if (kind === 'repair') return 'Sửa chữa';
  return 'Kho máy';
}

function directMachineLabel(item: MachineHistory) {
  return [
    item.machine?.machineCode,
    item.machine?.modelName || item.plannedMachineModel?.displayName || item.plannedMachineModel?.name || item.deviceName || item.modelName,
    item.machine?.serialNumber || item.serialNumber ? `S/N ${item.machine?.serialNumber || item.serialNumber}` : '',
    item.businessLine?.productIndustry?.name,
  ]
    .filter(Boolean)
    .join(' - ');
}

function machineTitle(machine: CustomerMachine) {
  return [machine.machineCode, machine.modelName || machine.name].filter(Boolean).join(' - ') || machine.serialNumber || 'Máy chưa đặt tên';
}

function displayStatus(status?: string | null) {
  if (!status) return '-';
  return statusLabels[status] || status;
}

function normalizeAccessoryList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          return String(record.name || record.itemName || record.code || '');
        }
        return '';
      })
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split('\n').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
}

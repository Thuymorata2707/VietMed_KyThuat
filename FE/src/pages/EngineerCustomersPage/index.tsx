import { ArrowRight, Building2, CalendarClock, ChevronLeft, ClipboardList, Phone, Search, Stethoscope, UserRound, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';

type UserSummary = {
  id: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
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
  kind: 'installation' | 'repair' | 'maintenance';
  title: string;
  machine: CustomerMachine;
  date?: string | null;
  status?: string | null;
  note?: string | null;
  person?: string | null;
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
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadCustomers();
  }, [currentRole, user.id]);

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
      const query = currentRole === 'engineer'
        ? `/customers?limit=100&primaryEngineerId=${encodeURIComponent(user.id)}`
        : '/customers?limit=100';
      const result = await apiFetch<Paginated<CustomerSummary>>(query);
      setCustomers(result.data);
      setSelectedCustomerId((current) => current || result.data[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách khách hàng.');
    } finally {
      setLoading(false);
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
  const timeline = useMemo(() => buildTimeline(machines), [machines]);
  const totalRepairs = machines.reduce((total, machine) => total + (machine.repairs?.length ?? 0), 0);
  const totalMaintenances = machines.reduce((total, machine) => total + (machine.maintenances?.length ?? 0), 0);

  return (
    <section className="grid gap-5 p-6 max-sm:p-4">
      <div className="grid gap-4 rounded-xl border border-[#e5e5e5] bg-white p-5 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[#d71920]">Chăm sóc khách hàng</span>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-[#1f1f1f]">Khách hàng phụ trách</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#666666]">
              Theo dõi máy đang lắp, lịch sử sửa chữa và các lần bảo trì của từng khách hàng trong một màn hình.
            </p>
          </div>
          <Link className="secondary-button" to="/">
            <ChevronLeft size={16} />
            Tổng quan
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Metric icon={<Building2 size={18} />} label="Khách đang theo dõi" value={customers.length} />
          <Metric icon={<Stethoscope size={18} />} label="Máy tại khách chọn" value={machines.length} />
          <Metric icon={<Wrench size={18} />} label="Lượt sửa chữa" value={totalRepairs} />
          <Metric icon={<CalendarClock size={18} />} label="Lượt bảo trì" value={totalMaintenances} />
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
            <CustomerDetailView customer={selectedCustomer} detailLoading={detailLoading} machines={machines} timeline={timeline} />
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
  machines,
  timeline,
}: {
  customer: CustomerSummary;
  detailLoading: boolean;
  machines: CustomerMachine[];
  timeline: TimelineItem[];
}) {
  const returnTo = encodeURIComponent('/my-customers');

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
                    {item.kind === 'repair' ? <Wrench size={16} /> : item.kind === 'maintenance' ? <CalendarClock size={16} /> : <Stethoscope size={16} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm text-[#1f1f1f]">{item.title}</strong>
                      <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[#555555]">{displayStatus(item.status)}</span>
                    </div>
                    <span className="mt-1 block text-xs text-[#666666]">
                      {[formatDate(item.date), machineTitle(item.machine), item.person].filter(Boolean).join(' - ')}
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

function buildTimeline(machines: CustomerMachine[]) {
  return machines
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
    ])
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 30);
}

function machineTitle(machine: CustomerMachine) {
  return [machine.machineCode, machine.modelName || machine.name].filter(Boolean).join(' - ') || machine.serialNumber || 'Máy chưa đặt tên';
}

function displayStatus(status?: string | null) {
  if (!status) return '-';
  return statusLabels[status] || status;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
}

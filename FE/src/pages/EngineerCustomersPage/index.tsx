import { Building2, CalendarClock, ChevronLeft, ClipboardList, Search, Stethoscope, Wrench } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Paginated, apiFetch } from '../../api';
import { Button } from '../../components/ui/button';
import { CustomerDetailView, EmptyState, Metric } from './components';
import type { CustomerDetail, CustomerSummary, EngineerCustomersPageProps, EngineerOption } from './types';
import { buildOpenTasks, buildTimeline, countUnique } from './utils';

const CUSTOMER_LIST_PAGE_SIZE = 50;

export function EngineerCustomersPage({ currentRole, user }: EngineerCustomersPageProps) {
  const [selectedEngineerId, setSelectedEngineerId] = useState('');
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(CUSTOMER_LIST_PAGE_SIZE);
  const isAdminProfile = location.pathname.startsWith('/customers/profile');
  const requestedCustomerId = searchParams.get('customerId') || '';

  const customersQuery = useQuery({
    queryKey: ['customers', 'profile-list', currentRole, selectedEngineerId, user.id, debouncedSearch, visibleLimit],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(visibleLimit) });
      if (currentRole === 'engineer') {
        params.set('primaryEngineerId', user.id);
      } else if (selectedEngineerId) {
        params.set('primaryEngineerId', selectedEngineerId);
      }
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
      }

      return apiFetch<Paginated<CustomerSummary>>(`/customers?${params.toString()}`);
    },
  });

  const engineersQuery = useQuery({
    enabled: currentRole !== 'engineer',
    queryKey: ['users', 'engineers', 'active'],
    queryFn: async () => {
      const result = await apiFetch<Paginated<EngineerOption>>('/users?limit=100&roleName=engineer&status=ACTIVE');
      return result.data;
    },
  });

  const customerDetailQuery = useQuery({
    enabled: Boolean(selectedCustomerId),
    queryKey: ['customers', 'profile-detail', selectedCustomerId],
    queryFn: () => apiFetch<CustomerDetail>(`/customers/${selectedCustomerId}`),
  });

  const customers = customersQuery.data?.data ?? [];
  const totalCustomers = customersQuery.data?.meta.total ?? customers.length;
  const engineers = engineersQuery.data ?? [];
  const detail = customerDetailQuery.data ?? null;
  const loading = customersQuery.isLoading;
  const detailLoading = customerDetailQuery.isFetching;
  const error = errorMessage(customersQuery.error) || errorMessage(engineersQuery.error) || errorMessage(customerDetailQuery.error);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setSelectedCustomerId((current) => {
      if (requestedCustomerId) return requestedCustomerId;
      return customers.some((customer) => customer.id === current) ? current : customers[0]?.id || '';
    });
  }, [customers, requestedCustomerId]);

  const renderedCustomers = customers;
  const hiddenCustomerCount = Math.max(0, totalCustomers - renderedCustomers.length);

  const selectedCustomer = detail ?? customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  const machines = detail?.machines ?? [];
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

  useEffect(() => {
    setVisibleLimit(CUSTOMER_LIST_PAGE_SIZE);
  }, [search, selectedEngineerId]);

  return (
    <section className="grid min-w-0 gap-5 overflow-x-hidden p-6 max-sm:p-4">
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
          <Button asChild variant="secondary">
            <Link to="/">
              <ChevronLeft size={16} />
              Tổng quan
            </Link>
          </Button>
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
          <Metric icon={<Building2 size={18} />} label="Khách đang theo dõi" value={totalCustomers} />
          <Metric icon={<Stethoscope size={18} />} label="Máy tại khách chọn" value={machines.length} />
          <Metric icon={<Wrench size={18} />} label="Lượt sửa chữa" value={totalRepairs} />
          <Metric icon={<CalendarClock size={18} />} label="Lượt bảo trì" value={totalMaintenances} />
          <Metric icon={<ClipboardList size={18} />} label="Phụ kiện/linh kiện" value={totalAccessories} />
        </div>
      </div>

      {error ? <div className="rounded-lg border border-[#ffd5d8] bg-[#fff5f5] px-4 py-3 text-sm font-medium text-[#b51219]">{error}</div> : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <aside className="grid min-w-0 content-start gap-3 rounded-xl border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8a8a]" size={16} />
            <input
              className="h-11 w-full rounded-lg border border-[#e5e5e5] bg-[#fafafa] pl-9 pr-3 text-sm font-medium text-[#1f1f1f] outline-none transition placeholder:text-[#8a8a8a] focus:border-[#d71920] focus:bg-white"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm khách hàng, mã, tỉnh..."
              value={search}
            />
          </label>

          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[#666666]">
            <span>{totalCustomers} khách phù hợp</span>
            {hiddenCustomerCount ? <span>Đang hiển thị {renderedCustomers.length}</span> : null}
          </div>

          <div className="grid max-h-[calc(100dvh-360px)] min-h-[260px] min-w-0 gap-2 overflow-y-auto pr-1">
            {loading ? (
              <EmptyState title="Đang tải danh sách..." />
            ) : renderedCustomers.length ? (
              renderedCustomers.map((customer) => {
                const isActive = customer.id === selectedCustomerId;
                return (
                  <button
                    className={`grid min-w-0 gap-2 rounded-lg border p-3 text-left transition ${
                      isActive
                        ? 'border-[#f5c7cb] bg-[#fff7f7] shadow-[inset_3px_0_0_#d71920]'
                        : 'border-[#eeeeee] bg-white hover:border-[#f5c7cb] hover:bg-[#fffafa]'
                    }`}
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <strong className="line-clamp-2 min-w-0 [overflow-wrap:anywhere] text-sm leading-5 text-[#1f1f1f]">{customer.hospitalName || customer.name}</strong>
                      <span className="shrink-0 rounded-md bg-[#f2f2f2] px-2 py-1 text-[11px] font-semibold text-[#555555]">{customer._count?.machines ?? 0} máy</span>
                    </div>
                    <span className="min-w-0 [overflow-wrap:anywhere] text-xs font-medium text-[#666666]">{[customer.customerCode, customer.province].filter(Boolean).join(' - ') || 'Chưa có mã/tỉnh'}</span>
                    <span className="min-w-0 [overflow-wrap:anywhere] text-xs text-[#8a8a8a]">{customer.primaryEngineer?.fullName ? `Phụ trách: ${customer.primaryEngineer.fullName}` : 'Chưa gán kỹ sư phụ trách'}</span>
                  </button>
                );
              })
            ) : (
              <EmptyState title="Chưa có khách hàng phù hợp" />
            )}
          </div>

          {hiddenCustomerCount ? (
            <button
              className="h-10 rounded-lg border border-[#e5e5e5] bg-[#fafafa] text-sm font-semibold text-[#333333] transition hover:border-[#f5c7cb] hover:bg-white hover:text-[#d71920]"
              onClick={() => setVisibleLimit((current) => current + CUSTOMER_LIST_PAGE_SIZE)}
              type="button"
            >
              Xem thêm {Math.min(CUSTOMER_LIST_PAGE_SIZE, hiddenCustomerCount)} khách
            </button>
          ) : null}
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '';
}

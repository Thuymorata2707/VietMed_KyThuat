import { ArrowRight, Building2, CalendarClock, ChevronLeft, ClipboardList, Search, Stethoscope, Wrench } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Paginated, apiFetch } from '../../api';
import { Button } from '../../components/ui/button';
import { CustomerDetailView, EmptyState, Metric } from './components';
import type { CustomerDetail, CustomerSummary, EngineerCustomersPageProps, EngineerOption } from './types';
import { buildOpenTasks, buildTimeline, countUnique } from './utils';

const CUSTOMER_LIST_PAGE_SIZE = 50;

export function EngineerCustomersPage({ currentRole, user }: EngineerCustomersPageProps) {
  const [selectedEngineerId, setSelectedEngineerId] = useState('');
  const [searchParams] = useSearchParams();
  const params = useParams();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const isAdminProfile = location.pathname.startsWith('/customers/profile');
  const requestedCustomerId = params.customerId || searchParams.get('customerId') || '';
  const isDetailPage = Boolean(requestedCustomerId);
  const listHref = isAdminProfile ? '/customers/profile' : '/my-customers';

  const customersQuery = useQuery({
    queryKey: ['customers', 'profile-list', currentRole, selectedEngineerId, user.id, debouncedSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(CUSTOMER_LIST_PAGE_SIZE), page: String(page) });
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
    enabled: isDetailPage,
    queryKey: ['customers', 'profile-detail', requestedCustomerId],
    queryFn: () => apiFetch<CustomerDetail>(`/customers/${requestedCustomerId}`),
  });

  const customers = customersQuery.data?.data ?? [];
  const customerMeta = customersQuery.data?.meta;
  const totalCustomers = customerMeta?.total ?? customers.length;
  const totalPages = Math.max(1, customerMeta?.totalPages ?? 1);
  const engineers = engineersQuery.data ?? [];
  const detail = customerDetailQuery.data ?? null;
  const loading = customersQuery.isLoading;
  const detailLoading = customerDetailQuery.isFetching;
  const error = errorMessage(customersQuery.error) || errorMessage(engineersQuery.error) || errorMessage(customerDetailQuery.error);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const renderedCustomers = customers;
  const firstVisibleCustomer = totalCustomers ? (page - 1) * CUSTOMER_LIST_PAGE_SIZE + 1 : 0;
  const lastVisibleCustomer = Math.min(totalCustomers, page * CUSTOMER_LIST_PAGE_SIZE);

  const selectedCustomer = detail ?? null;
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
    setPage(1);
  }, [search, selectedEngineerId]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <section className="grid min-w-0 gap-5 overflow-x-hidden p-6 max-sm:p-4">
      <div className="grid gap-4 rounded-[28px] border border-[#e4e4e7] bg-white/95 p-5 shadow-[0_12px_30px_rgba(24,24,27,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#18181b]">Chăm sóc khách hàng</span>
            <h1 className="mt-1 text-2xl font-extrabold tracking-normal text-[#1f1f1f]">
              {isDetailPage ? (selectedCustomer?.hospitalName || selectedCustomer?.name || 'Hồ sơ khách hàng') : isAdminProfile ? 'Hồ sơ khách hàng' : 'Khách hàng phụ trách'}
            </h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#666666]">
              {isDetailPage ? 'Thông tin máy, việc mở và lịch sử được tách riêng để dễ đọc.' : isAdminProfile ? 'Tra cứu khách hàng, mở hồ sơ khi cần xem chi tiết.' : 'Danh sách khách đang phụ trách, mở hồ sơ để xem máy và phiếu liên quan.'}
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link to={isDetailPage ? listHref : '/'}>
              <ChevronLeft size={16} />
              {isDetailPage ? 'Quay lại danh sách' : 'Tổng quan'}
            </Link>
          </Button>
        </div>

        {isAdminProfile && !isDetailPage ? (
          <label className="grid max-w-sm gap-1.5 text-sm font-bold text-[#333333]">
            Lọc theo kỹ sư quản lý
            <select
              className="h-12 rounded-2xl border border-[#ded8d8] bg-[#ffffff] px-4 text-sm font-semibold text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_4px_rgba(24,24,27,0.12)]"
              onChange={(event) => {
                setSelectedEngineerId(event.target.value);
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

        {isDetailPage ? (
          <div className="grid gap-3 md:grid-cols-4">
            <Metric icon={<Stethoscope size={18} />} label="Máy tại khách" value={machines.length} />
            <Metric icon={<Wrench size={18} />} label="Lượt sửa chữa" value={totalRepairs} />
            <Metric icon={<CalendarClock size={18} />} label="Lượt bảo trì" value={totalMaintenances} />
            <Metric icon={<ClipboardList size={18} />} label="Phụ kiện/linh kiện" value={totalAccessories} />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <Metric icon={<Building2 size={18} />} label="Khách đang theo dõi" value={totalCustomers} />
            <Metric icon={<Stethoscope size={18} />} label="Đang hiển thị" value={renderedCustomers.length} />
            <Metric icon={<ClipboardList size={18} />} label="Trang hiện tại" value={page} />
          </div>
        )}
      </div>

      {error ? <div className="rounded-2xl border border-[#fecdd3] bg-[#fff1f3] px-4 py-3 text-sm font-bold text-[#b5121b]">{error}</div> : null}

      {isDetailPage ? (
        <main className="min-w-0">
          {selectedCustomer ? (
            <CustomerDetailView customer={selectedCustomer} detailLoading={detailLoading} isAdminProfile={isAdminProfile} machines={machines} openTasks={openTasks} timeline={timeline} />
          ) : (
            <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-[#d7d7d7] bg-white p-8 text-center">
              <EmptyState title={detailLoading ? 'Đang tải hồ sơ khách hàng...' : 'Không tìm thấy hồ sơ khách hàng'} />
            </div>
          )}
        </main>
      ) : (
        <section className="grid min-w-0 content-start gap-4 rounded-[26px] border border-[#e4e4e7] bg-white p-4 shadow-[0_8px_24px_rgba(24,24,27,0.04)]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8a8a]" size={16} />
            <input
              className="h-12 w-full rounded-2xl border border-[#ded8d8] bg-[#ffffff] pl-9 pr-3 text-sm font-semibold text-[#1f1f1f] outline-none transition placeholder:text-[#8a8a8a] focus:border-[#18181b] focus:bg-white focus:shadow-[0_0_0_4px_rgba(24,24,27,0.12)]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm khách hàng, mã, tỉnh..."
              value={search}
            />
          </label>

          <div className="grid gap-2 rounded-2xl border border-[#e4e4e7] bg-[#fafafa] px-3 py-2 text-xs font-bold text-[#666666]">
            <div className="flex items-center justify-between gap-3">
              <span>{totalCustomers} khách phù hợp</span>
              <span>Trang {page}/{totalPages}</span>
            </div>
            <span className="text-[#8a8a8a]">
              {totalCustomers ? `Đang hiển thị ${firstVisibleCustomer}-${lastVisibleCustomer}` : 'Không có khách phù hợp'}
            </span>
          </div>

          <div className="grid min-h-[260px] min-w-0 content-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              <EmptyState title="Đang tải danh sách..." />
            ) : renderedCustomers.length ? (
              renderedCustomers.map((customer) => (
                <CustomerListCard customer={customer} href={isAdminProfile ? `/customers/profile/${customer.id}` : `/my-customers/${customer.id}`} key={customer.id} />
              ))
            ) : (
              <EmptyState title="Chưa có khách hàng phù hợp" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              className="h-10 rounded-2xl border border-[#ded8d8] bg-white text-sm font-bold text-[#333333] transition hover:border-[#e4e4e7] hover:text-[#18181b] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={page <= 1 || customersQuery.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Trước
            </button>
            <button
              className="h-10 rounded-2xl border border-[#ded8d8] bg-white text-sm font-bold text-[#333333] transition hover:border-[#e4e4e7] hover:text-[#18181b] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={page >= totalPages || customersQuery.isFetching}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              type="button"
            >
              Sau
            </button>
          </div>
        </section>
      )}
    </section>
  );
}

function CustomerListCard({ customer, href }: { customer: CustomerSummary; href: string }) {
  return (
    <article className="grid min-w-0 gap-4 rounded-[20px] border border-[#eeeeee] bg-white p-4 transition hover:-translate-y-px hover:border-[#d4d4d8] hover:shadow-[0_16px_34px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-bold text-[#71717a]">{customer.customerCode || customer.province || 'Khách hàng'}</span>
          <h2 className="mt-1 line-clamp-2 text-lg font-extrabold leading-tight text-[#18181b] [overflow-wrap:anywhere]">{customer.hospitalName || customer.name}</h2>
        </div>
        <span className="shrink-0 rounded-lg border border-[#e4e4e7] bg-[#fafafa] px-2.5 py-1 text-xs font-bold text-[#333333]">{customer._count?.machines ?? 0} máy</span>
      </div>

      <div className="grid gap-1.5 text-sm text-[#52525b]">
        <span className="line-clamp-1">{customer.fullAddress || [customer.address, customer.district, customer.province].filter(Boolean).join(', ') || 'Chưa có địa chỉ'}</span>
        <span>{customer.primaryEngineer?.fullName ? `Kỹ sư: ${customer.primaryEngineer.fullName}` : 'Chưa gán kỹ sư'}</span>
        <span>{customer.contactPerson || customer.contactPhone || customer.phone || 'Chưa có liên hệ'}</span>
      </div>

      <Button asChild className="justify-center">
        <Link to={href}>
          Mở hồ sơ
          <ArrowRight size={16} />
        </Link>
      </Button>
    </article>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '';
}

import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api';
import { CustomerDetailView, EmptyState } from './components';
import type { CustomerDetail } from './types';
import { buildOpenTasks, buildTimeline } from './utils';

export function EngineerCustomersPage() {
  const { customerId = '' } = useParams();
  const customerQuery = useQuery({
    enabled: Boolean(customerId),
    queryKey: ['customers', 'profile-detail', customerId],
    queryFn: () => apiFetch<CustomerDetail>(`/customers/${customerId}`),
  });

  const customer = customerQuery.data ?? null;
  const machines = customer?.machines ?? [];
  const timeline = useMemo(() => buildTimeline(machines, customer), [machines, customer]);
  const openTasks = useMemo(() => buildOpenTasks(machines, customer), [machines, customer]);
  const error = customerQuery.error instanceof Error ? customerQuery.error.message : '';

  return (
    <section className="grid min-w-0 gap-5 overflow-x-hidden p-6 max-sm:p-4">
      {error ? <div className="rounded-2xl border border-[#fecdd3] bg-[#fff1f3] px-4 py-3 text-sm font-bold text-[#b5121b]">{error}</div> : null}
      <main className="min-w-0">
        {customer ? (
          <CustomerDetailView customer={customer} detailLoading={customerQuery.isFetching} machines={machines} openTasks={openTasks} timeline={timeline} />
        ) : (
          <div className="grid min-h-[320px] place-items-center rounded-xl border border-dashed border-[#d7d7d7] bg-white p-8 text-center">
            <EmptyState title={customerQuery.isFetching ? 'Đang tải hồ sơ khách hàng...' : 'Không tìm thấy hồ sơ khách hàng'} />
          </div>
        )}
      </main>
    </section>
  );
}

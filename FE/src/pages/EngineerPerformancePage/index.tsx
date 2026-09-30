import { Download, FileText, Loader2, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';
import { DateInput } from '../../components/DateInput';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { queryKeys } from '../../lib/queryKeys';
import { exportReportXlsx } from '../../utils/xlsxExport';

type EngineerPerformancePageProps = { currentRole: RoleName; user: ApiUser };

type EngineerWorkSummary = {
  engineer?: { id: string; email?: string | null; fullName?: string | null } | null;
  range: { from: string; to: string };
  totals: {
    installations: number;
    repairs: number;
    maintenances: number;
    applicationSupport: number;
    activities: number;
    customers: number;
    machines: number;
  };
  customers: Array<{
    id?: string;
    code?: string | null;
    name: string;
    province?: string | null;
    installationCount: number;
    repairCount: number;
    maintenanceCount: number;
    machineCount: number;
  }>;
  activities: Array<{
    id: string;
    kind: 'installation' | 'repair' | 'maintenance' | 'applicationSupport';
    code: string;
    date: string;
    status: string;
    title: string;
    result?: string | null;
    customer: { id?: string; name: string; province?: string | null };
    machine: { id?: string; code?: string | null; serialNumber?: string | null; modelName?: string | null; name?: string | null };
  }>;
};

type AssignedCustomer = {
  id: string;
  customerCode?: string | null;
  name: string;
  shortName?: string | null;
  province?: string | null;
  locality?: string | null;
  ward?: string | null;
  address?: string | null;
  fullAddress?: string | null;
  phone?: string | null;
  contactPerson?: string | null;
  _count?: { machines?: number };
};

const defaultTo = toDateInput(new Date());
const defaultFrom = toDateInput(addDays(new Date(), -60));

export function EngineerPerformancePage({ currentRole, user }: EngineerPerformancePageProps) {
  const isAdmin = currentRole === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const [engineerId, setEngineerId] = useState(() => searchParams.get('engineerId') || searchParams.get('userId') || (isAdmin ? '' : user.id));
  const [from, setFrom] = useState(() => searchParams.get('from') || defaultFrom);
  const [to, setTo] = useState(() => searchParams.get('to') || defaultTo);
  const [customerPage, setCustomerPage] = useState(1);
  const customerPageSize = 20;

  const engineersQuery = useQuery({
    enabled: isAdmin,
    queryKey: queryKeys.engineerPerformance.engineers,
    queryFn: async () => {
      const result = await apiFetch<Paginated<ApiUser>>('/users?limit=100&status=ACTIVE');
      return (result?.data ?? []).filter((item) => item.role?.name === 'engineer' || item.engineerProfile);
    },
  });
  const engineers = engineersQuery.data ?? [];

  useEffect(() => {
    if (isAdmin) setEngineerId((current) => current || engineers[0]?.id || '');
  }, [engineers, isAdmin]);

  const summaryParams = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    if (isAdmin && engineerId) params.set('userId', engineerId);
    return params.toString();
  }, [engineerId, from, isAdmin, to]);

  const summaryQuery = useQuery({
    enabled: Boolean(engineerId),
    queryKey: queryKeys.engineerPerformance.summary(summaryParams),
    queryFn: async () => apiFetch<EngineerWorkSummary>(`/weekly-reports/summary?${summaryParams}`),
  });

  const customerParams = new URLSearchParams({
    limit: String(customerPageSize),
    page: String(customerPage),
    primaryEngineerId: engineerId,
  }).toString();
  const assignedCustomersQuery = useQuery({
    enabled: Boolean(engineerId),
    queryKey: ['engineer-performance', 'assigned-customers', customerParams],
    queryFn: () => apiFetch<Paginated<AssignedCustomer>>(`/customers?${customerParams}`),
  });

  const summary = summaryQuery.data;
  const customerData = assignedCustomersQuery.data;
  const assignedCustomers = customerData?.data ?? [];
  const totalAssignedCustomers = customerData?.meta?.total ?? assignedCustomers.length;
  const totalCustomerPages = Math.max(1, customerData?.meta?.totalPages ?? 1);
  const loading = summaryQuery.isLoading || summaryQuery.isFetching || engineersQuery.isFetching || assignedCustomersQuery.isLoading;
  const error = [engineersQuery.error, summaryQuery.error, assignedCustomersQuery.error]
    .find((value) => value instanceof Error) as Error | undefined;
  const selectedEngineerName = engineers.find((engineer) => engineer.id === engineerId)?.fullName || summary?.engineer?.fullName || summary?.engineer?.email || user.fullName || user.email;
  const activities = useMemo(() => [...(summary?.activities ?? [])].sort((first, second) => second.date.localeCompare(first.date)), [summary]);

  useEffect(() => {
    setCustomerPage(1);
  }, [engineerId]);

  useEffect(() => {
    const next = new URLSearchParams({ from, to });
    if (isAdmin && engineerId) next.set('engineerId', engineerId);
    setSearchParams(next, { replace: true });
  }, [engineerId, from, isAdmin, setSearchParams, to]);

  function exportActivities() {
    if (!summary) return;
    exportReportXlsx({
      columns: ['Ngày hoàn tất', 'Loại việc', 'Mã phiếu', 'Khách hàng', 'Máy/model', 'Nội dung', 'Kết quả'],
      filename: `hieu-suat-ky-su-${from}-${to}.xlsx`,
      rows: activities.map((activity) => [
        formatDate(activity.date),
        activityKindLabel(activity.kind),
        activity.code,
        activity.customer.name,
        machineSummaryLabel(activity.machine),
        activity.title,
        activity.result || '',
      ]),
      sheetName: 'Hieu suat',
      subtitle: `${formatDate(from)} - ${formatDate(to)} · ${selectedEngineerName}`,
      title: 'HIỆU SUẤT KỸ SƯ',
    });
  }

  return (
    <PageFrame>
      <PageTitle
        eyebrow="Năng suất thực hiện"
        title="Hiệu suất kỹ sư"
        description="Theo dõi khối lượng công việc đã hoàn tất trong kỳ và danh sách khách hàng kỹ sư đang phụ trách."
      />

      <section className="grid gap-3 rounded-2xl border border-[#e5e5e5] bg-white p-4 md:grid-cols-4">
        {isAdmin ? (
          <label className="grid gap-1.5 text-sm font-semibold text-[#333333]">
            Kỹ sư
            <select className={fieldClass} onChange={(event) => setEngineerId(event.target.value)} value={engineerId}>
              <option value="">Chọn kỹ sư</option>
              {engineers.map((engineer) => <option key={engineer.id} value={engineer.id}>{engineer.fullName || engineer.email}</option>)}
            </select>
          </label>
        ) : (
          <div className="grid content-end gap-1.5 text-sm">
            <span className="font-semibold text-[#666666]">Kỹ sư</span>
            <strong className="flex min-h-11 items-center rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-3">{user.fullName || user.email}</strong>
          </div>
        )}
        <DateInput className="grid gap-1.5 text-sm font-semibold text-[#333333]" label="Từ ngày" onChange={setFrom} value={from} />
        <DateInput className="grid gap-1.5 text-sm font-semibold text-[#333333]" label="Đến ngày" onChange={setTo} value={to} />
        <div className="flex flex-wrap items-end gap-2">
          <button className="secondary-button" disabled={loading} onClick={() => { void summaryQuery.refetch(); void assignedCustomersQuery.refetch(); }} type="button">
            {loading ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
            Cập nhật
          </button>
          <button className="secondary-button" disabled={!activities.length} onClick={exportActivities} type="button"><Download size={16} />Xuất Excel</button>
        </div>
      </section>

      {error ? <Notice message={error.message} /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="Tổng việc hoàn tất" value={summary?.totals.activities ?? 0} hint={`${formatDate(from)} – ${formatDate(to)}`} />
        <Metric label="Máy đã lắp" value={summary?.totals.installations ?? 0} hint="Máy lắp hoàn tất trong kỳ" />
        <Metric label="Sửa chữa hoàn tất" value={summary?.totals.repairs ?? 0} hint="Phiếu sửa chữa đã xử lý" />
        <Metric label="Bảo trì hoàn tất" value={summary?.totals.maintenances ?? 0} hint="Lịch bảo trì đã thực hiện" />
        <Metric label="Khách đang phụ trách" value={totalAssignedCustomers} hint="Phân công hiện tại" />
        <Metric label="Khách có việc trong kỳ" value={summary?.totals.customers ?? 0} hint={`${summary?.totals.machines ?? 0} máy có hoạt động`} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white">
        <div className="border-b border-[#eeeeee] px-4 py-3">
          <h2 className="font-semibold text-[#1f1f1f]">Khách hàng đang phụ trách</h2>
          <p className="mt-1 text-xs text-[#666666]">Danh sách phân công hiện tại; số máy tính theo hồ sơ máy của từng khách.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-[#fafafa] text-xs font-semibold text-[#666666]"><tr>{['Mã khách', 'Khách hàng', 'Địa chỉ', 'Liên hệ', 'Số máy'].map((label) => <th className="border-b border-[#eeeeee] px-4 py-3" key={label}>{label}</th>)}</tr></thead>
            <tbody>
              {assignedCustomers.map((customer) => (
                <tr className="border-b border-[#f1f1f1] last:border-0 hover:bg-[#fafafa]" key={customer.id}>
                  <td className="px-4 py-3 text-[#666666]">{customer.customerCode || '—'}</td>
                  <td className="px-4 py-3 font-semibold"><Link className="hover:text-[#991b2b]" to={`/customers/${customer.id}`}>{customer.shortName || customer.name}</Link></td>
                  <td className="px-4 py-3 text-[#666666]">{customer.fullAddress || [customer.address, customer.locality, customer.ward, customer.province].filter(Boolean).join(', ') || 'Chưa có địa chỉ'}</td>
                  <td className="px-4 py-3">{customer.contactPerson || customer.phone || '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{customer._count?.machines ?? 0}</td>
                </tr>
              ))}
              {!loading && !assignedCustomers.length ? <tr><td className="px-4 py-8 text-center text-[#666666]" colSpan={5}>Kỹ sư chưa được phân công khách hàng.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[#eeeeee] px-4 py-3 text-sm text-[#666666]">
          <span>{totalAssignedCustomers} khách hàng · Trang {customerPage}/{totalCustomerPages}</span>
          <div className="flex gap-2">
            <button className="secondary-button compact" disabled={customerPage <= 1 || assignedCustomersQuery.isFetching} onClick={() => setCustomerPage((page) => Math.max(1, page - 1))} type="button">Trước</button>
            <button className="secondary-button compact" disabled={customerPage >= totalCustomerPages || assignedCustomersQuery.isFetching} onClick={() => setCustomerPage((page) => Math.min(totalCustomerPages, page + 1))} type="button">Sau</button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eeeeee] px-4 py-3">
          <div><h2 className="font-semibold text-[#1f1f1f]">Công việc hoàn tất trong kỳ</h2><p className="mt-1 text-xs text-[#666666]">{activities.length} lượt · gồm cả khách ngoài danh sách phân công nếu có</p></div>
          <Link className="secondary-button compact" to={buildTechnicalReportHref(from, to, isAdmin ? engineerId : user.id, isAdmin)}><FileText size={15} />Phân tích kỹ thuật</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-[#fafafa] text-xs font-semibold text-[#666666]"><tr>{['Ngày hoàn tất', 'Loại việc', 'Mã phiếu', 'Khách hàng', 'Máy/model', 'Kết quả'].map((label) => <th className="border-b border-[#eeeeee] px-4 py-3" key={label}>{label}</th>)}</tr></thead>
            <tbody>
              {activities.map((activity) => (
                <tr className="border-b border-[#f1f1f1] last:border-0 hover:bg-[#fafafa]" key={`${activity.kind}-${activity.id}`}>
                  <td className="px-4 py-3">{formatDate(activity.date)}</td>
                  <td className="px-4 py-3">{activityKindLabel(activity.kind)}</td>
                  <td className="px-4 py-3 font-semibold">{activity.code}</td>
                  <td className="px-4 py-3">{activity.customer.id ? <Link className="hover:text-[#991b2b]" to={`/customers/${activity.customer.id}`}>{activity.customer.name}</Link> : activity.customer.name}</td>
                  <td className="px-4 py-3">{machineSummaryLabel(activity.machine)}</td>
                  <td className="px-4 py-3 text-[#666666]">{activity.result || activity.title || '—'}</td>
                </tr>
              ))}
              {!loading && !activities.length ? <tr><td className="px-4 py-8 text-center text-[#666666]" colSpan={6}>Không có công việc hoàn tất trong kỳ này.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </PageFrame>
  );
}

function Metric({ hint, label, value }: { hint: string; label: string; value: number }) {
  return <article className="rounded-2xl border border-[#e5e5e5] bg-white p-4"><span className="text-sm font-semibold text-[#666666]">{label}</span><strong className="mt-2 block text-3xl tabular-nums text-[#1f1f1f]">{value}</strong><span className="mt-1 block text-xs text-[#8a8a8a]">{hint}</span></article>;
}

function activityKindLabel(kind: EngineerWorkSummary['activities'][number]['kind']) {
  if (kind === 'installation') return 'Lắp đặt';
  if (kind === 'repair') return 'Sửa chữa';
  if (kind === 'maintenance') return 'Bảo trì';
  return 'Hỗ trợ ứng dụng';
}

function machineSummaryLabel(machine: EngineerWorkSummary['activities'][number]['machine']) {
  return [machine.code, machine.serialNumber, machine.modelName || machine.name].filter(Boolean).join(' · ') || 'Chưa gắn máy';
}

function buildTechnicalReportHref(from: string, to: string, engineerId: string, includeEngineerId: boolean) {
  const params = new URLSearchParams({ from, to });
  if (includeEngineerId && engineerId) params.set('engineerId', engineerId);
  return `/technical-statistics?${params.toString()}`;
}

function addDays(value: Date, days: number) { const date = new Date(value); date.setDate(date.getDate() + days); return date; }
function toDateInput(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function formatDate(value: string) { const date = new Date(`${value.slice(0, 10)}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN').format(date); }

const fieldClass = 'min-h-11 rounded-xl border border-[#ded8d8] bg-white px-3 text-sm font-semibold text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.10)]';

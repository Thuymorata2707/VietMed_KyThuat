import { Building2, ChevronRight, Loader2, MapPinned, RefreshCw, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Paginated, apiFetch, apiFetchAllPages } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { queryKeys } from '../../lib/queryKeys';

type Branch = {
  id: string;
  code: string;
  name: string;
  _count?: { provinces: number };
};

type Province = {
  id: string;
  name: string;
  branchId?: string | null;
  branch?: Branch | null;
};

type Customer = {
  id: string;
  name: string;
  customerCode?: string | null;
  province?: string | null;
  phone?: string | null;
  _count?: { machines?: number };
};

export function AdminRegionsPage() {
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedProvinceId, setSelectedProvinceId] = useState('');

  const branchesQuery = useQuery({
    queryKey: ['territories', 'branches'],
    queryFn: () => apiFetch<Branch[]>('/branches'),
  });
  const provincesQuery = useQuery({
    queryKey: ['territories', 'provinces'],
    queryFn: () => apiFetch<Province[]>('/provinces'),
  });

  const branches = branchesQuery.data ?? [];
  const provinces = provincesQuery.data ?? [];
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? null;
  const selectedProvince = provinces.find((province) => province.id === selectedProvinceId) ?? null;
  const branchProvinces = useMemo(
    () => provinces.filter((province) => province.branchId === selectedBranchId),
    [provinces, selectedBranchId],
  );
  const unassignedProvinces = provinces.filter((province) => !province.branchId);

  const customersQuery = useQuery({
    enabled: Boolean(selectedProvince),
    queryKey: queryKeys.regions.customers(selectedProvinceId),
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100', provinceId: selectedProvince!.id, province: selectedProvince!.name });
      return apiFetchAllPages<Customer>(`/customers?${params.toString()}`);
    },
  });

  const assignProvinceMutation = useMutation({
    mutationFn: ({ provinceId, branchId }: { provinceId: string; branchId: string | null }) =>
      apiFetch<Province>(`/provinces/${provinceId}/branch`, {
        method: 'PATCH',
        body: JSON.stringify({ branchId }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['territories'] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const error = [branchesQuery.error, provincesQuery.error, customersQuery.error, assignProvinceMutation.error]
    .find((value) => value instanceof Error);

  return (
    <PageFrame>
      <div className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PageTitle eyebrow="Quản trị dữ liệu" title="Chi nhánh & địa bàn" />
          <button
            className="secondary-button"
            disabled={branchesQuery.isFetching || provincesQuery.isFetching}
            onClick={() => void Promise.all([branchesQuery.refetch(), provincesQuery.refetch()])}
            type="button"
          >
            {branchesQuery.isFetching || provincesQuery.isFetching ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
            Làm mới
          </button>
        </div>

        {error instanceof Error ? <Notice message={error.message} /> : null}

        <section className="grid gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-[#202124]">Chi nhánh VietMed</h2>
            <span className="text-sm text-[#667085]">{branches.length} chi nhánh</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {branches.map((branch) => {
              const count = provinces.filter((province) => province.branchId === branch.id).length;
              const active = selectedBranchId === branch.id;
              return (
                <button
                  aria-pressed={active}
                  className={`flex min-h-24 items-center justify-between gap-4 rounded-2xl border bg-white p-4 text-left transition ${active ? 'border-[#1f2937] shadow-[inset_3px_0_0_#1f2937,0_8px_24px_rgba(15,23,42,.06)]' : 'border-[#e5e7eb] hover:border-[#9ca3af]'}`}
                  key={branch.id}
                  onClick={() => {
                    setSelectedBranchId(branch.id);
                    setSelectedProvinceId('');
                  }}
                  type="button"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f3f4f6] text-[#374151]"><Building2 size={20} /></span>
                    <span className="min-w-0">
                      <strong className="block truncate text-base text-[#202124]">{branch.name}</strong>
                      <span className="mt-1 block text-sm text-[#667085]">{count} tỉnh/thành được giao</span>
                    </span>
                  </span>
                  <ChevronRight className="shrink-0 text-[#98a2b3]" size={18} />
                </button>
              );
            })}
          </div>
        </section>

        {selectedBranch ? (
          <section className="grid gap-4 rounded-2xl border border-[#e5e7eb] bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#eef0f3] pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Địa bàn chi nhánh</span>
                <h2 className="mt-1 text-xl font-semibold text-[#202124]">{selectedBranch.name}</h2>
              </div>
              <label className="grid min-w-[230px] gap-1.5 text-sm font-medium text-[#344054]">
                Thêm tỉnh/thành vào chi nhánh
                <select
                  className="min-h-10 rounded-lg border border-[#d0d5dd] bg-white px-3"
                  disabled={assignProvinceMutation.isPending || unassignedProvinces.length === 0}
                  onChange={(event) => {
                    if (event.target.value) assignProvinceMutation.mutate({ provinceId: event.target.value, branchId: selectedBranch.id });
                  }}
                  value=""
                >
                  <option value="">{unassignedProvinces.length ? 'Chọn tỉnh/thành chưa phân công' : 'Đã phân công hết tỉnh/thành'}</option>
                  {unassignedProvinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
                </select>
              </label>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.4fr)]">
              <div className="grid content-start gap-2">
                <h3 className="text-sm font-semibold text-[#344054]">Tỉnh/thành quản lý</h3>
                {!branchProvinces.length ? (
                  <p className="rounded-xl border border-dashed border-[#d0d5dd] p-4 text-sm text-[#667085]">Chưa phân công tỉnh/thành cho chi nhánh này.</p>
                ) : branchProvinces.map((province) => (
                  <div className="flex items-center gap-2" key={province.id}>
                    <button
                      className={`flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${selectedProvinceId === province.id ? 'border-[#344054] bg-[#f8fafc] font-semibold text-[#202124]' : 'border-[#eaecf0] hover:bg-[#fafafa]'}`}
                      onClick={() => setSelectedProvinceId(province.id)}
                      type="button"
                    >
                      <span className="flex min-w-0 items-center gap-2"><MapPinned className="shrink-0 text-[#667085]" size={16} /><span className="truncate">{province.name}</span></span>
                    </button>
                    <button
                      aria-label={`Bỏ phân công ${province.name} khỏi ${selectedBranch.name}`}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[#667085] transition hover:bg-[#f2f4f7] hover:text-[#344054] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#344054]"
                      disabled={assignProvinceMutation.isPending}
                      onClick={() => assignProvinceMutation.mutate({ provinceId: province.id, branchId: null })}
                      type="button"
                    ><X aria-hidden="true" size={17} strokeWidth={2} /></button>
                  </div>
                ))}
              </div>

              <div className="grid content-start gap-2 rounded-xl bg-[#f8f9fa] p-3 sm:p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#344054]">Khách hàng{selectedProvince ? ` · ${selectedProvince.name}` : ''}</h3>
                  {selectedProvince ? <span className="text-xs text-[#667085]">{customersQuery.data?.length ?? 0} khách hàng</span> : null}
                </div>
                {!selectedProvince ? <p className="py-8 text-center"><span className="rounded-md bg-[#eef2f6] px-2 py-1 text-xs font-semibold text-[#475467]">Chưa chọn khu vực</span></p> : null}
                {selectedProvince && customersQuery.isFetching ? <p className="py-8 text-center text-sm text-[#667085]">Đang tải khách hàng…</p> : null}
                {selectedProvince && !customersQuery.isFetching && !customersQuery.data?.length ? <p className="py-8 text-center text-sm text-[#667085]">Chưa có khách hàng thuộc tỉnh/thành này.</p> : null}
                {selectedProvince && !customersQuery.isFetching ? customersQuery.data?.map((customer) => (
                  <Link className="flex items-center justify-between gap-3 rounded-xl border border-[#eaecf0] bg-white p-3 transition hover:border-[#cbd5e1] hover:bg-[#fcfcfd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#344054]" key={customer.id} to={`/customers/${customer.id}`}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Building2 className="shrink-0 text-[#667085]" size={17} />
                      <div className="min-w-0">
                        <strong className="block truncate text-sm text-[#202124]">{customer.name}</strong>
                        <span className="mt-0.5 block truncate text-xs text-[#667085]">{[customer.customerCode, customer.phone].filter(Boolean).join(' · ') || 'Chưa có thông tin liên hệ'}</span>
                      </div>
                    </div>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-[#667085]">{customer._count?.machines ?? 0} máy <ChevronRight size={16} /></span>
                  </Link>
                )) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-3 rounded-2xl border border-[#e5e7eb] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#202124]">Chưa phân công chi nhánh</h2>
            </div>
            <span className="text-sm text-[#667085]">{unassignedProvinces.length} tỉnh/thành</span>
          </div>
          {unassignedProvinces.length ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {unassignedProvinces.map((province) => (
                <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-[#eaecf0] px-3 py-2.5" key={province.id}>
                  <span className="truncate text-sm font-medium text-[#344054]">{province.name}</span>
                  <select
                    aria-label={`Gán ${province.name} cho chi nhánh`}
                    className="max-w-[145px] rounded-lg border border-[#d0d5dd] bg-white px-2 py-1.5 text-xs"
                    disabled={assignProvinceMutation.isPending}
                    onChange={(event) => assignProvinceMutation.mutate({ provinceId: province.id, branchId: event.target.value || null })}
                    value=""
                  >
                    <option value="">Gán chi nhánh</option>
                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[#667085]">Tất cả tỉnh/thành đã được phân công.</p>}
        </section>
      </div>
    </PageFrame>
  );
}

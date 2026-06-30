import { Building2, Loader2, MapPinned, PackageSearch, Plus, RefreshCw, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { Paginated, apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { vietnamProvinceOptions } from '../../config/vietnamProvinces';
import { queryKeys } from '../../lib/queryKeys';

type Region = {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
};

type CustomerSummary = {
  id: string;
  name: string;
  customerCode?: string | null;
  phone?: string | null;
  address?: string | null;
  fullAddress?: string | null;
  _count?: {
    machines?: number;
  };
};

type CustomerMachine = {
  id: string;
  machineCode?: string | null;
  serialNumber?: string | null;
  modelName?: string | null;
  name?: string | null;
  manufacturer?: string | null;
  status?: string | null;
  inventoryStatus?: string | null;
  installDate?: string | null;
  warrantyEndDate?: string | null;
};

type CustomerDetail = CustomerSummary & {
  machines?: CustomerMachine[];
};

const emptyForm = {
  name: '',
  code: '',
};

export function AdminRegionsPage() {
  const queryClient = useQueryClient();
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const regionsQuery = useQuery({
    queryKey: queryKeys.regions.list,
    queryFn: () => apiFetch<Region[]>('/regions'),
  });

  const customersQuery = useQuery({
    enabled: Boolean(selectedRegion?.id),
    queryKey: queryKeys.regions.customers(selectedRegion?.id ?? ''),
    queryFn: async () => {
      const result = await apiFetch<Paginated<CustomerSummary>>(`/customers?regionId=${selectedRegion?.id ?? ''}&limit=100`);
      return result.data;
    },
  });

  const customerDetailQuery = useQuery({
    enabled: Boolean(selectedCustomerId),
    queryKey: queryKeys.regions.customerDetail(selectedCustomerId),
    queryFn: () => apiFetch<CustomerDetail>(`/customers/${selectedCustomerId}`),
  });

  const createRegionMutation = useMutation({
    mutationFn: () => apiFetch<Region>('/regions', {
      method: 'POST',
      body: JSON.stringify({
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
      }),
    }),
    onSuccess: async () => {
      setSuccess('Đã tạo khu vực mới.');
      closeModal();
      await queryClient.invalidateQueries({ queryKey: queryKeys.regions.list });
    },
  });

  const regions = regionsQuery.data ?? [];
  const customers = customersQuery.data ?? [];
  const selectedCustomer = customerDetailQuery.data ?? null;
  const loading = regionsQuery.isLoading || regionsQuery.isFetching;
  const loadingCustomers = customersQuery.isLoading || customersQuery.isFetching;
  const loadingCustomerDetail = customerDetailQuery.isLoading || customerDetailQuery.isFetching;
  const saving = createRegionMutation.isPending;
  const error =
    formError ||
    (regionsQuery.error instanceof Error ? regionsQuery.error.message : '') ||
    (customersQuery.error instanceof Error ? customersQuery.error.message : '') ||
    (customerDetailQuery.error instanceof Error ? customerDetailQuery.error.message : '') ||
    (createRegionMutation.error instanceof Error ? createRegionMutation.error.message : '');

  const filteredRegions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return regions;
    return regions.filter((region) =>
      [region.name, region.code].join(' ').toLowerCase().includes(keyword),
    );
  }, [query, regions]);
  const existingRegionCodes = useMemo(() => new Set(regions.map((region) => region.code.toUpperCase())), [regions]);

  function selectRegion(region: Region) {
    setSelectedRegion(region);
    setSelectedCustomerId('');
    setFormError('');
  }

  function selectCustomer(customer: CustomerSummary) {
    setSelectedCustomerId(customer.id);
    setFormError('');
  }

  function openCreateModal() {
    setForm(emptyForm);
    setFormError('');
    setSuccess('');
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setForm(emptyForm);
  }

  function closeRegionDetail() {
    setSelectedRegion(null);
    setSelectedCustomerId('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setSuccess('');

    if (!form.name || !form.code) {
      setFormError('Vui lòng chọn tỉnh/thành.');
      return;
    }

    try {
      await createRegionMutation.mutateAsync();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không tạo được khu vực');
    }
  }

  return (
    <PageFrame>
      <div className="flex items-start justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
        <PageTitle
          eyebrow="Admin"
          title="Khu vực"
          description="Quản lý vùng phụ trách dùng cho scope dữ liệu của manager và kỹ sư."
        />
        <button className="secondary-button" disabled={loading} onClick={() => void regionsQuery.refetch()} type="button">
          {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
          {loading ? 'Đang tải' : 'Làm mới'}
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="overflow-hidden rounded-lg border border-[#e5e5e5] bg-white">
        <div className="list-toolbar">
          <input onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc mã khu vực" value={query} />
          <button className="primary-button compact" onClick={openCreateModal} type="button">
            <Plus size={17} />
            Thêm khu vực
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th className="border-b border-[#eeeeee] px-3.5 py-[13px] text-left text-xs font-medium text-[#666666]">Khu vực</th>
                <th className="border-b border-[#eeeeee] px-3.5 py-[13px] text-left text-xs font-medium text-[#666666]">Mã</th>
                <th className="border-b border-[#eeeeee] px-3.5 py-[13px] text-left text-xs font-medium text-[#666666]">Ngày tạo</th>
                <th className="border-b border-[#eeeeee] px-3.5 py-[13px] text-left text-xs font-medium text-[#666666]">Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegions.map((region) => (
                <tr
                  className={`cursor-pointer hover:bg-[#f8fbfd] ${selectedRegion?.id === region.id ? 'bg-[#f8fbfd] shadow-[inset_3px_0_0_#d71920]' : ''}`}
                  key={region.id}
                  onClick={() => selectRegion(region)}
                >
                  <td className="border-b border-[#eeeeee] px-3.5 py-[13px]">
                    <div className="flex items-center gap-2 text-[#1f1f1f]">
                      <MapPinned size={17} />
                      <strong>{region.name}</strong>
                    </div>
                  </td>
                  <td className="border-b border-[#eeeeee] px-3.5 py-[13px]">{region.code}</td>
                  <td className="border-b border-[#eeeeee] px-3.5 py-[13px]">{formatDate(region.createdAt)}</td>
                  <td className="border-b border-[#eeeeee] px-3.5 py-[13px]">{formatDate(region.updatedAt)}</td>
                </tr>
              ))}
              {loading ? (
                <tr>
                  <td colSpan={4}>
                    <div className="table-state">
                      <Loader2 className="spin-icon" size={18} />
                      Đang tải khu vực...
                    </div>
                  </td>
                </tr>
              ) : null}
              {!loading && filteredRegions.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="table-state empty-state">
                      <strong>Không có khu vực phù hợp</strong>
                      <span>Thử đổi từ khóa tìm kiếm hoặc tạo khu vực mới.</span>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRegion ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={closeRegionDetail} role="presentation">
          <aside aria-modal="true" className="grid h-screen w-[min(92vw,1100px)] max-w-[1100px] grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden bg-white p-[18px] shadow-[-18px_0_40px_rgba(20,32,51,0.18)] max-sm:w-screen max-sm:p-3.5" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="flex items-center justify-between gap-3.5 max-sm:flex-col max-sm:items-stretch">
              <div className="grid gap-1">
                <span className="text-xs leading-snug text-[#666666]">Khách hàng theo khu vực</span>
                <h2>{selectedRegion.name}</h2>
              </div>
              <div className="flex items-center gap-2 max-sm:justify-between">
                <button className="secondary-button compact" disabled={loadingCustomers} onClick={() => void customersQuery.refetch()} type="button">
                  {loadingCustomers ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
                  Refresh
                </button>
                <button className="icon-button" onClick={closeRegionDetail} title="Close" type="button">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="grid min-h-0 grid-cols-[minmax(260px,360px)_minmax(0,1fr)] gap-3.5 max-sm:grid-cols-1 max-sm:overflow-y-auto">
              <div className="grid content-start gap-2.5 overflow-y-auto">
                {loadingCustomers ? (
                  <div className="table-state">
                    <Loader2 className="spin-icon" size={18} />
                    Đang tải khách hàng...
                  </div>
                ) : null}

                {!loadingCustomers && customers.length === 0 ? (
                  <div className="table-state empty-state">
                    <strong>Chưa có khách hàng trong khu vực này</strong>
                    <span>Khách hàng sẽ xuất hiện khi hồ sơ được gán vào khu vực.</span>
                  </div>
                ) : null}

                {customers.map((customer) => (
                  <button
                    className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-[#eeeeee] bg-white p-3 text-left text-[#1f1f1f] hover:border-[#f5c7cb] hover:shadow-[inset_3px_0_0_#d71920] ${selectedCustomer?.id === customer.id ? 'border-[#f5c7cb] shadow-[inset_3px_0_0_#d71920]' : ''}`}
                    key={customer.id}
                    onClick={() => selectCustomer(customer)}
                    type="button"
                  >
                    <Building2 size={18} />
                    <span className="grid min-w-0 gap-0.5">
                      <strong className="overflow-hidden text-ellipsis whitespace-nowrap">{customer.name}</strong>
                      <small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-snug text-[#666666]">
                        {[customer.customerCode, customer.phone, customer.fullAddress || customer.address].filter(Boolean).join(' - ') ||
                          'Chưa có thông tin liên hệ'}
                      </small>
                    </span>
                    <em className="whitespace-nowrap text-xs not-italic font-medium leading-snug text-[#666666]">{customer._count?.machines ?? 0} máy</em>
                  </button>
                ))}
              </div>

              <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden rounded-lg border border-[#eeeeee] bg-[#f8fbfd] p-3.5">
                {loadingCustomerDetail ? (
                  <div className="table-state">
                    <Loader2 className="spin-icon" size={18} />
                    Đang tải máy đã mua...
                  </div>
                ) : null}

                {!loadingCustomerDetail && !selectedCustomer ? (
                  <div className="grid min-h-[220px] content-center justify-items-center gap-2 text-center text-[#666666]">
                    <PackageSearch size={24} />
                    <strong>Chọn khách hàng để xem máy đã mua</strong>
                    <span className="text-xs leading-snug">Một khách hàng có thể có nhiều máy, mỗi máy sẽ hiển thị thành một khối riêng.</span>
                  </div>
                ) : null}

                {!loadingCustomerDetail && selectedCustomer ? (
                  <>
                    <div className="grid gap-1">
                      <span className="text-xs leading-snug text-[#666666]">Máy của khách hàng</span>
                      <h3>{selectedCustomer.name}</h3>
                    </div>

                    {selectedCustomer.machines?.length ? (
                      <div className="grid content-start gap-2.5 overflow-y-auto">
                        {selectedCustomer.machines.map((machine) => (
                          <article className="grid min-w-0 gap-3 rounded-lg border border-[#eeeeee] bg-white p-[13px]" key={machine.id}>
                            <div className="grid min-w-0 gap-1">
                              <strong className="overflow-hidden text-ellipsis whitespace-nowrap">{machine.machineCode || machine.serialNumber || machine.name || 'Máy chưa có mã'}</strong>
                              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-snug text-[#666666]">{[machine.modelName, machine.manufacturer].filter(Boolean).join(' - ') || 'Chưa có model'}</span>
                            </div>
                            <dl className="m-0 grid grid-cols-5 gap-2 max-sm:grid-cols-1">
                              <div>
                                <dt className="text-xs leading-snug text-[#666666]">Serial</dt>
                                <dd className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-[#1f1f1f]">{machine.serialNumber || '-'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs leading-snug text-[#666666]">Trạng thái</dt>
                                <dd className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-[#1f1f1f]">{machine.status || '-'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs leading-snug text-[#666666]">Kho</dt>
                                <dd className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-[#1f1f1f]">{machine.inventoryStatus || '-'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs leading-snug text-[#666666]">Ngày lắp</dt>
                                <dd className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-[#1f1f1f]">{machine.installDate ? formatDate(machine.installDate) : '-'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs leading-snug text-[#666666]">BH đến</dt>
                                <dd className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-[#1f1f1f]">{machine.warrantyEndDate ? formatDate(machine.warrantyEndDate) : '-'}</dd>
                              </div>
                            </dl>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="grid min-h-[220px] content-center justify-items-center gap-2 text-center text-[#666666]">
                        <PackageSearch size={24} />
                        <strong>Khách hàng này chưa có máy</strong>
                        <span className="text-xs leading-snug">Khi máy được bán/lắp đặt và gán khách hàng, danh sách sẽ hiện ở đây.</span>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="crud-modal-backdrop" role="presentation">
          <section aria-modal="true" className="crud-modal" role="dialog">
            <div className="form-panel-heading">
              <div>
                <span>Thêm</span>
                <h2>Khu vực phụ trách</h2>
              </div>
              <button className="icon-button" onClick={closeModal} title="Close" type="button">
                <X size={16} />
              </button>
            </div>

            <form className="grid gap-[18px]" onSubmit={handleSubmit}>
              <label className="grid gap-[7px] font-medium text-[#333333]">
                Tỉnh/Thành
                <select
                  className="min-h-10 rounded-lg border border-[#d6d6d6] px-3 text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]"
                  onChange={(event) => {
                    const province = vietnamProvinceOptions.find((item) => item.code === event.target.value);
                    setForm(province ? { name: province.name, code: province.code } : emptyForm);
                  }}
                  required
                  value={form.code}
                >
                  <option value="">Chọn tỉnh/thành</option>
                  {vietnamProvinceOptions.map((province) => {
                    const exists = existingRegionCodes.has(province.code);
                    return (
                      <option disabled={exists} key={province.code} value={province.code}>
                        {province.name} ({province.code}){exists ? ' - đã có' : ''}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="grid gap-[7px] font-medium text-[#333333]">
                Mã tỉnh
                <input
                  className="min-h-10 rounded-lg border border-[#d6d6d6] bg-[#f8fbfd] px-3 text-[#1f1f1f] outline-none"
                  readOnly
                  required
                  value={form.code}
                />
                <span className="text-xs font-medium text-[#666666]">Mã tự sinh từ viết tắt tỉnh/thành để tránh nhập sai.</span>
              </label>
              <div className="modal-actions">
                <button className="secondary-button" onClick={closeModal} type="button">
                  Hủy
                </button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? 'Đang lưu' : 'Lưu khu vực'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </PageFrame>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN').format(new Date(value));
}

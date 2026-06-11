import { Building2, Loader2, MapPinned, PackageSearch, Plus, RefreshCw, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Paginated, apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';

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
  const [regions, setRegions] = useState<Region[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingCustomerDetail, setLoadingCustomerDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadRegions();
  }, []);

  const filteredRegions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return regions;
    return regions.filter((region) =>
      [region.name, region.code].join(' ').toLowerCase().includes(keyword),
    );
  }, [query, regions]);

  async function loadRegions() {
    setLoading(true);
    setError('');

    try {
      const nextRegions = await apiFetch<Region[]>('/regions');
      setRegions(nextRegions);
      setSelectedRegion((current) => {
        if (!current) return current;
        return nextRegions.find((region) => region.id === current.id) ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được khu vực');
    } finally {
      setLoading(false);
    }
  }

  async function selectRegion(region: Region) {
    setSelectedRegion(region);
    setSelectedCustomer(null);
    setLoadingCustomers(true);
    setError('');

    try {
      const result = await apiFetch<Paginated<CustomerSummary>>(`/customers?regionId=${region.id}&limit=100`);
      setCustomers(result.data);
    } catch (err) {
      setCustomers([]);
      setError(err instanceof Error ? err.message : 'Không tải được khách hàng của khu vực');
    } finally {
      setLoadingCustomers(false);
    }
  }

  async function selectCustomer(customer: CustomerSummary) {
    setLoadingCustomerDetail(true);
    setError('');

    try {
      setSelectedCustomer(await apiFetch<CustomerDetail>(`/customers/${customer.id}`));
    } catch (err) {
      setSelectedCustomer(null);
      setError(err instanceof Error ? err.message : 'Không tải được máy của khách hàng');
    } finally {
      setLoadingCustomerDetail(false);
    }
  }

  function openCreateModal() {
    setForm(emptyForm);
    setError('');
    setSuccess('');
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setForm(emptyForm);
  }

  function closeRegionDetail() {
    setSelectedRegion(null);
    setSelectedCustomer(null);
    setCustomers([]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiFetch<Region>('/regions', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
        }),
      });
      setSuccess('Đã tạo khu vực mới.');
      closeModal();
      await loadRegions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được khu vực');
    } finally {
      setSaving(false);
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
        <button className="secondary-button" disabled={loading} onClick={loadRegions} type="button">
          {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
          {loading ? 'Đang tải' : 'Tải lại'}
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="overflow-hidden rounded-lg border border-[#e3eaf2] bg-white">
        <div className="list-toolbar">
          <input onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc mã khu vực" value={query} />
          <button className="primary-button compact" onClick={openCreateModal} type="button">
            <Plus size={17} />
            Tạo khu vực
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th className="border-b border-[#eef2f7] px-3.5 py-[13px] text-left text-xs font-semibold uppercase text-[#657384]">Khu vực</th>
                <th className="border-b border-[#eef2f7] px-3.5 py-[13px] text-left text-xs font-semibold uppercase text-[#657384]">Mã</th>
                <th className="border-b border-[#eef2f7] px-3.5 py-[13px] text-left text-xs font-semibold uppercase text-[#657384]">Ngày tạo</th>
                <th className="border-b border-[#eef2f7] px-3.5 py-[13px] text-left text-xs font-semibold uppercase text-[#657384]">Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegions.map((region) => (
                <tr
                  className={`cursor-pointer hover:bg-[#f8fbfd] ${selectedRegion?.id === region.id ? 'bg-[#f8fbfd] shadow-[inset_3px_0_0_#c92a1f]' : ''}`}
                  key={region.id}
                  onClick={() => void selectRegion(region)}
                >
                  <td className="border-b border-[#eef2f7] px-3.5 py-[13px]">
                    <div className="flex items-center gap-2 text-[#17202a]">
                      <MapPinned size={17} />
                      <strong>{region.name}</strong>
                    </div>
                  </td>
                  <td className="border-b border-[#eef2f7] px-3.5 py-[13px]">{region.code}</td>
                  <td className="border-b border-[#eef2f7] px-3.5 py-[13px]">{formatDate(region.createdAt)}</td>
                  <td className="border-b border-[#eef2f7] px-3.5 py-[13px]">{formatDate(region.updatedAt)}</td>
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
          <aside aria-modal="true" className="grid h-screen w-[min(92vw,1100px)] max-w-[1100px] grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden bg-white p-[18px] shadow-[-18px_0_40px_rgba(15,23,42,0.18)] max-sm:w-screen max-sm:p-3.5" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="flex items-center justify-between gap-3.5 max-sm:flex-col max-sm:items-stretch">
              <div className="grid gap-1">
                <span className="text-xs leading-snug text-[#657384]">Khách hàng theo khu vực</span>
                <h2>{selectedRegion.name}</h2>
              </div>
              <div className="flex items-center gap-2 max-sm:justify-between">
                <button className="secondary-button compact" disabled={loadingCustomers} onClick={() => void selectRegion(selectedRegion)} type="button">
                  {loadingCustomers ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
                  Tải khách
                </button>
                <button className="icon-button" onClick={closeRegionDetail} title="Đóng" type="button">
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
                    className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-[#eef2f7] bg-white p-3 text-left text-[#17202a] hover:border-[#f0b7b1] hover:shadow-[inset_3px_0_0_#c92a1f] ${selectedCustomer?.id === customer.id ? 'border-[#f0b7b1] shadow-[inset_3px_0_0_#c92a1f]' : ''}`}
                    key={customer.id}
                    onClick={() => void selectCustomer(customer)}
                    type="button"
                  >
                    <Building2 size={18} />
                    <span className="grid min-w-0 gap-0.5">
                      <strong className="overflow-hidden text-ellipsis whitespace-nowrap">{customer.name}</strong>
                      <small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-snug text-[#657384]">
                        {[customer.customerCode, customer.phone, customer.fullAddress || customer.address].filter(Boolean).join(' - ') ||
                          'Chưa có thông tin liên hệ'}
                      </small>
                    </span>
                    <em className="whitespace-nowrap text-xs not-italic font-bold leading-snug text-[#657384]">{customer._count?.machines ?? 0} máy</em>
                  </button>
                ))}
              </div>

              <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden rounded-lg border border-[#eef2f7] bg-[#f8fbfd] p-3.5">
                {loadingCustomerDetail ? (
                  <div className="table-state">
                    <Loader2 className="spin-icon" size={18} />
                    Đang tải máy đã mua...
                  </div>
                ) : null}

                {!loadingCustomerDetail && !selectedCustomer ? (
                  <div className="grid min-h-[220px] content-center justify-items-center gap-2 text-center text-[#657384]">
                    <PackageSearch size={24} />
                    <strong>Chọn khách hàng để xem máy đã mua</strong>
                    <span className="text-xs leading-snug">Một khách hàng có thể có nhiều máy, mỗi máy sẽ hiển thị thành một khối riêng.</span>
                  </div>
                ) : null}

                {!loadingCustomerDetail && selectedCustomer ? (
                  <>
                    <div className="grid gap-1">
                      <span className="text-xs leading-snug text-[#657384]">Máy của khách hàng</span>
                      <h3>{selectedCustomer.name}</h3>
                    </div>

                    {selectedCustomer.machines?.length ? (
                      <div className="grid content-start gap-2.5 overflow-y-auto">
                        {selectedCustomer.machines.map((machine) => (
                          <article className="grid min-w-0 gap-3 rounded-lg border border-[#eef2f7] bg-white p-[13px]" key={machine.id}>
                            <div className="grid min-w-0 gap-1">
                              <strong className="overflow-hidden text-ellipsis whitespace-nowrap">{machine.machineCode || machine.serialNumber || machine.name || 'Máy chưa có mã'}</strong>
                              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-snug text-[#657384]">{[machine.modelName, machine.manufacturer].filter(Boolean).join(' - ') || 'Chưa có model'}</span>
                            </div>
                            <dl className="m-0 grid grid-cols-5 gap-2 max-sm:grid-cols-1">
                              <div>
                                <dt className="text-xs leading-snug text-[#657384]">Serial</dt>
                                <dd className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-[#17202a]">{machine.serialNumber || '-'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs leading-snug text-[#657384]">Trạng thái</dt>
                                <dd className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-[#17202a]">{machine.status || '-'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs leading-snug text-[#657384]">Kho</dt>
                                <dd className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-[#17202a]">{machine.inventoryStatus || '-'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs leading-snug text-[#657384]">Ngày lắp</dt>
                                <dd className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-[#17202a]">{machine.installDate ? formatDate(machine.installDate) : '-'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs leading-snug text-[#657384]">BH đến</dt>
                                <dd className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-[#17202a]">{machine.warrantyEndDate ? formatDate(machine.warrantyEndDate) : '-'}</dd>
                              </div>
                            </dl>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="grid min-h-[220px] content-center justify-items-center gap-2 text-center text-[#657384]">
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
                <span>Tạo mới</span>
                <h2>Khu vực phụ trách</h2>
              </div>
              <button className="icon-button" onClick={closeModal} title="Đóng" type="button">
                <X size={16} />
              </button>
            </div>

            <form className="grid gap-[18px]" onSubmit={handleSubmit}>
              <label className="grid gap-[7px] font-medium text-[#405064]">
                Tên khu vực
                <input
                  className="min-h-10 rounded-lg border border-[#ced8e3] px-3 text-[#17202a] outline-none focus:border-[#c92a1f] focus:shadow-[0_0_0_3px_rgba(201,42,31,0.1)]"
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                  value={form.name}
                />
              </label>
              <label className="grid gap-[7px] font-medium text-[#405064]">
                Mã khu vực
                <input
                  className="min-h-10 rounded-lg border border-[#ced8e3] px-3 text-[#17202a] outline-none focus:border-[#c92a1f] focus:shadow-[0_0_0_3px_rgba(201,42,31,0.1)]"
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                  required
                  value={form.code}
                />
              </label>
              <div className="modal-actions">
                <button className="secondary-button" onClick={closeModal} type="button">
                  Hủy
                </button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? 'Đang lưu' : 'Tạo khu vực'}
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

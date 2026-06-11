import { Building2, Loader2, MapPinned, PackageSearch, Plus, RefreshCw, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Paginated, apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import './styles.css';

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
      <div className="admin-regions-heading">
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

      <section className="admin-regions-list">
        <div className="list-toolbar">
          <input onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc mã khu vực" value={query} />
          <button className="primary-button compact" onClick={openCreateModal} type="button">
            <Plus size={17} />
            Tạo khu vực
          </button>
        </div>

        <div className="regions-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Khu vực</th>
                <th>Mã</th>
                <th>Ngày tạo</th>
                <th>Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegions.map((region) => (
                <tr
                  className={selectedRegion?.id === region.id ? 'region-row active' : 'region-row'}
                  key={region.id}
                  onClick={() => void selectRegion(region)}
                >
                  <td>
                    <div className="region-name">
                      <MapPinned size={17} />
                      <strong>{region.name}</strong>
                    </div>
                  </td>
                  <td>{region.code}</td>
                  <td>{formatDate(region.createdAt)}</td>
                  <td>{formatDate(region.updatedAt)}</td>
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
        <div className="region-detail-backdrop" onClick={closeRegionDetail} role="presentation">
          <aside aria-modal="true" className="region-detail-drawer" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="region-drilldown-heading">
              <div>
                <span>Khách hàng theo khu vực</span>
                <h2>{selectedRegion.name}</h2>
              </div>
              <div className="region-detail-actions">
                <button className="secondary-button compact" disabled={loadingCustomers} onClick={() => void selectRegion(selectedRegion)} type="button">
                  {loadingCustomers ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
                  Tải khách
                </button>
                <button className="icon-button" onClick={closeRegionDetail} title="Đóng" type="button">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="region-customer-layout">
              <div className="region-customer-list">
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
                    className={selectedCustomer?.id === customer.id ? 'region-customer-card active' : 'region-customer-card'}
                    key={customer.id}
                    onClick={() => void selectCustomer(customer)}
                    type="button"
                  >
                    <Building2 size={18} />
                    <span>
                      <strong>{customer.name}</strong>
                      <small>
                        {[customer.customerCode, customer.phone, customer.fullAddress || customer.address].filter(Boolean).join(' - ') ||
                          'Chưa có thông tin liên hệ'}
                      </small>
                    </span>
                    <em>{customer._count?.machines ?? 0} máy</em>
                  </button>
                ))}
              </div>

              <div className="customer-machine-blog">
                {loadingCustomerDetail ? (
                  <div className="table-state">
                    <Loader2 className="spin-icon" size={18} />
                    Đang tải máy đã mua...
                  </div>
                ) : null}

                {!loadingCustomerDetail && !selectedCustomer ? (
                  <div className="machine-blog-empty">
                    <PackageSearch size={24} />
                    <strong>Chọn khách hàng để xem máy đã mua</strong>
                    <span>Một khách hàng có thể có nhiều máy, mỗi máy sẽ hiển thị thành một khối riêng.</span>
                  </div>
                ) : null}

                {!loadingCustomerDetail && selectedCustomer ? (
                  <>
                    <div className="machine-blog-title">
                      <span>Máy của khách hàng</span>
                      <h3>{selectedCustomer.name}</h3>
                    </div>

                    {selectedCustomer.machines?.length ? (
                      <div className="machine-blog-list">
                        {selectedCustomer.machines.map((machine) => (
                          <article className="machine-blog-card" key={machine.id}>
                            <div>
                              <strong>{machine.machineCode || machine.serialNumber || machine.name || 'Máy chưa có mã'}</strong>
                              <span>{[machine.modelName, machine.manufacturer].filter(Boolean).join(' - ') || 'Chưa có model'}</span>
                            </div>
                            <dl>
                              <div>
                                <dt>Serial</dt>
                                <dd>{machine.serialNumber || '-'}</dd>
                              </div>
                              <div>
                                <dt>Trạng thái</dt>
                                <dd>{machine.status || '-'}</dd>
                              </div>
                              <div>
                                <dt>Kho</dt>
                                <dd>{machine.inventoryStatus || '-'}</dd>
                              </div>
                              <div>
                                <dt>Ngày lắp</dt>
                                <dd>{machine.installDate ? formatDate(machine.installDate) : '-'}</dd>
                              </div>
                              <div>
                                <dt>BH đến</dt>
                                <dd>{machine.warrantyEndDate ? formatDate(machine.warrantyEndDate) : '-'}</dd>
                              </div>
                            </dl>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="machine-blog-empty">
                        <PackageSearch size={24} />
                        <strong>Khách hàng này chưa có máy</strong>
                        <span>Khi máy được bán/lắp đặt và gán khách hàng, danh sách sẽ hiện ở đây.</span>
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

            <form className="admin-region-form" onSubmit={handleSubmit}>
              <label>
                Tên khu vực
                <input
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                  value={form.name}
                />
              </label>
              <label>
                Mã khu vực
                <input
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

import { Loader2, MapPinned, Plus, RefreshCw, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api';
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

const emptyForm = {
  name: '',
  code: '',
};

export function AdminRegionsPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
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
      setRegions(await apiFetch<Region[]>('/regions'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được khu vực');
    } finally {
      setLoading(false);
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
                <tr key={region.id}>
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

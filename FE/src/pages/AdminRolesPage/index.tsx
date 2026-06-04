import { Loader2, Plus, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import './styles.css';

type Role = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadRoles();
  }, []);

  const filteredRoles = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return roles;
    return roles.filter((role) => role.name.toLowerCase().includes(keyword));
  }, [query, roles]);

  async function loadRoles() {
    setLoading(true);
    setError('');

    try {
      setRoles(await apiFetch<Role[]>('/roles'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được vai trò');
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setName('');
    setError('');
    setSuccess('');
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setName('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiFetch<Role>('/roles', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      setSuccess('Đã tạo vai trò mới.');
      closeModal();
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được vai trò');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageFrame>
      <div className="admin-roles-heading">
        <PageTitle
          eyebrow="Admin"
          title="Vai trò"
          description="Quản lý danh sách role dùng cho phân quyền backend và điều hướng giao diện."
        />
        <button className="secondary-button" disabled={loading} onClick={loadRoles} type="button">
          {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
          {loading ? 'Đang tải' : 'Tải lại'}
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="admin-roles-list">
        <div className="list-toolbar">
          <input onChange={(event) => setQuery(event.target.value)} placeholder="Tìm vai trò" value={query} />
          <button className="primary-button compact" onClick={openCreateModal} type="button">
            <Plus size={17} />
            Tạo vai trò
          </button>
        </div>

        <div className="roles-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vai trò</th>
                <th>Ngày tạo</th>
                <th>Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoles.map((role) => (
                <tr key={role.id}>
                  <td>
                    <div className="role-name">
                      <ShieldCheck size={17} />
                      <strong>{role.name}</strong>
                    </div>
                  </td>
                  <td>{formatDate(role.createdAt)}</td>
                  <td>{formatDate(role.updatedAt)}</td>
                </tr>
              ))}
              {loading ? (
                <tr>
                  <td colSpan={3}>
                    <div className="table-state">
                      <Loader2 className="spin-icon" size={18} />
                      Đang tải vai trò...
                    </div>
                  </td>
                </tr>
              ) : null}
              {!loading && filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={3}>
                    <div className="table-state empty-state">
                      <strong>Không có vai trò phù hợp</strong>
                      <span>Thử đổi từ khóa tìm kiếm hoặc tạo vai trò mới.</span>
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
                <h2>Vai trò hệ thống</h2>
              </div>
              <button className="icon-button" onClick={closeModal} title="Đóng" type="button">
                <X size={16} />
              </button>
            </div>

            <form className="admin-role-form" onSubmit={handleSubmit}>
              <label>
                Tên vai trò
                <input onChange={(event) => setName(event.target.value)} required value={name} />
              </label>
              <div className="modal-actions">
                <button className="secondary-button" onClick={closeModal} type="button">
                  Hủy
                </button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? 'Đang lưu' : 'Tạo vai trò'}
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

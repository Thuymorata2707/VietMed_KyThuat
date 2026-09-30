import { Loader2, Plus, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { queryKeys } from '../../lib/queryKeys';

type Role = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export function AdminRolesPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [name, setName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const rolesQuery = useQuery({
    queryKey: queryKeys.roles.list,
    queryFn: () => apiFetch<Role[]>('/roles'),
  });

  const createRoleMutation = useMutation({
    mutationFn: () => apiFetch<Role>('/roles', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim() }),
    }),
    onSuccess: async () => {
      setSuccess('Đã tạo vai trò mới.');
      closeModal();
      await queryClient.invalidateQueries({ queryKey: queryKeys.roles.list });
    },
  });

  const roles = rolesQuery.data ?? [];
  const loading = rolesQuery.isLoading || rolesQuery.isFetching;
  const saving = createRoleMutation.isPending;
  const error = formError || (rolesQuery.error instanceof Error ? rolesQuery.error.message : '') || (createRoleMutation.error instanceof Error ? createRoleMutation.error.message : '');

  const filteredRoles = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return roles;
    return roles.filter((role) => role.name.toLowerCase().includes(keyword));
  }, [query, roles]);
  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / pageSize));
  const pagedRoles = filteredRoles.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  function openCreateModal() {
    setName('');
    setFormError('');
    setSuccess('');
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setName('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setSuccess('');

    try {
      await createRoleMutation.mutateAsync();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không tạo được vai trò');
    }
  }

  return (
    <PageFrame>
      <div className="flex items-start justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
        <PageTitle
          eyebrow="Quản trị hệ thống"
          title="Vai trò"
          description="Phân quyền."
        />
        <button className="secondary-button" disabled={loading} onClick={() => void rolesQuery.refetch()} type="button">
          {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
          {loading ? 'Đang tải' : 'Làm mới dữ liệu'}
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="overflow-hidden rounded-lg border border-[#e5e5e5] bg-white">
        <div className="list-toolbar">
          <input onChange={(event) => setQuery(event.target.value)} placeholder="Tìm vai trò" value={query} />
          <button className="primary-button compact" onClick={openCreateModal} type="button">
            <Plus size={17} />
            Add Role
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                <th className="border-b border-[#eeeeee] px-3.5 py-[13px] text-left text-xs font-medium text-[#666666]">Vai trò</th>
                <th className="border-b border-[#eeeeee] px-3.5 py-[13px] text-left text-xs font-medium text-[#666666]">Ngày tạo</th>
                <th className="border-b border-[#eeeeee] px-3.5 py-[13px] text-left text-xs font-medium text-[#666666]">Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {pagedRoles.map((role) => (
                <tr key={role.id}>
                  <td className="border-b border-[#eeeeee] px-3.5 py-[13px]">
                    <div className="flex items-center gap-2 text-[#1f1f1f]">
                      <ShieldCheck size={17} />
                      <strong>{role.name}</strong>
                    </div>
                  </td>
                  <td className="border-b border-[#eeeeee] px-3.5 py-[13px]">{formatDate(role.createdAt)}</td>
                  <td className="border-b border-[#eeeeee] px-3.5 py-[13px]">{formatDate(role.updatedAt)}</td>
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
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <TablePager
          disabled={loading}
          page={Math.min(page, totalPages)}
          pageSize={pageSize}
          total={filteredRoles.length}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </section>

      {isModalOpen ? (
        <div className="crud-modal-backdrop" role="presentation">
          <section aria-modal="true" className="crud-modal" role="dialog">
            <div className="form-panel-heading">
              <div>
                <span>Add</span>
                <h2>Vai trò hệ thống</h2>
              </div>
              <button className="icon-button" onClick={closeModal} title="Close" type="button">
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
                  Cancel
                </button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? 'Đang lưu' : 'Lưu vai trò'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </PageFrame>
  );
}

function TablePager({
  disabled,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
}: {
  disabled: boolean;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeeee] bg-[#fafafa] px-4 py-3 text-sm font-medium text-[#666666]">
      <span>{total ? `${first}-${last}/${total} vai trò` : '0 vai trò'}</span>
      <div className="flex items-center gap-2">
        <button className="secondary-button compact" disabled={disabled || page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} type="button">
          Trước
        </button>
        <span>Trang {page}/{totalPages}</span>
        <button className="secondary-button compact" disabled={disabled || page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))} type="button">
          Sau
        </button>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN').format(new Date(value));
}

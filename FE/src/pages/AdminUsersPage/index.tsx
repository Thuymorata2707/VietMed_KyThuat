import { Edit3, ImageOff, Loader2, Power, PowerOff, RefreshCw, Trash2, UserPlus, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Paginated, apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { initials } from '../../utils/format';

type UserStatus = 'ACTIVE' | 'INACTIVE';

type Role = {
  id: string;
  name: string;
};

type Region = {
  id: string;
  name: string;
  code: string;
};

type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  status: UserStatus;
  role?: Role | null;
  region?: Region | null;
  engineerProfile?: {
    employeeCode?: string | null;
    dateOfBirth?: string | null;
    position?: string | null;
    department?: string | null;
    workStartDate?: string | null;
    specialties?: string[];
    certificateNo?: string | null;
    photoUrl?: string | null;
    note?: string | null;
  } | null;
  createdAt: string;
};

type UserFormState = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  employeeCode: string;
  dateOfBirth: string;
  position: string;
  department: string;
  workStartDate: string;
  specialties: string;
  certificateNo: string;
  photoUrl: string;
  profileNote: string;
  roleId: string;
  regionId: string;
  status: UserStatus;
};

const emptyForm: UserFormState = {
  email: '',
  password: '',
  fullName: '',
  phone: '',
  employeeCode: '',
  dateOfBirth: '',
  position: '',
  department: '',
  workStartDate: '',
  specialties: '',
  certificateNo: '',
  photoUrl: '',
  profileNote: '',
  roleId: '',
  regionId: '',
  status: 'ACTIVE',
};

const pageSizeOptions = [10, 20, 50, 100];

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return users;

    return users.filter((user) =>
      [
        user.fullName,
        user.email,
        user.phone,
        user.role?.name,
        user.region?.name,
        user.status,
        user.engineerProfile?.employeeCode,
        user.engineerProfile?.position,
        user.engineerProfile?.department,
        user.engineerProfile?.specialties?.join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );
  }, [query, users]);

  const selectedRole = roles.find((role) => role.id === form.roleId);
  const shouldShowEngineerProfile = isEngineerRole(selectedRole?.name) || Boolean(editingUser?.engineerProfile);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const visibleUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [usersResult, rolesResult, regionsResult] = await Promise.all([
        apiFetch<Paginated<AdminUser> | AdminUser[]>('/users?limit=100'),
        apiFetch<Role[]>('/roles'),
        apiFetch<Region[]>('/regions'),
      ]);

      setUsers(unpack(usersResult));
      setRoles(rolesResult);
      setRegions(regionsResult);
      setForm((current) => ({
        ...current,
        roleId: current.roleId || rolesResult[0]?.id || '',
        regionId: current.regionId || regionsResult[0]?.id || '',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu nhân sự');
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setEditingUser(null);
    setForm({
      ...emptyForm,
      roleId: roles[0]?.id || '',
      regionId: regions[0]?.id || '',
    });
    setIsFormOpen(true);
    setError('');
    setSuccess('');
  }

  function handleSearchChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function handlePageSizeChange(value: string) {
    setPageSize(Number(value));
    setPage(1);
  }

  function startEdit(user: AdminUser) {
    const profile = user.engineerProfile;
    setEditingUser(user);
    setForm({
      email: user.email,
      password: '',
      fullName: user.fullName,
      phone: user.phone || '',
      employeeCode: profile?.employeeCode || '',
      dateOfBirth: toDateInput(profile?.dateOfBirth),
      position: profile?.position || '',
      department: profile?.department || '',
      workStartDate: toDateInput(profile?.workStartDate),
      specialties: profile?.specialties?.join('\n') || '',
      certificateNo: profile?.certificateNo || '',
      photoUrl: profile?.photoUrl || '',
      profileNote: profile?.note || '',
      roleId: user.role?.id ?? roles[0]?.id ?? '',
      regionId: user.region?.id ?? regions[0]?.id ?? '',
      status: user.status,
    });
    setIsFormOpen(true);
    setError('');
    setSuccess('');
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingUser(null);
    setForm({
      ...emptyForm,
      roleId: roles[0]?.id || '',
      regionId: regions[0]?.id || '',
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = buildPayload(form, Boolean(editingUser));

      if (editingUser) {
        const savedUser = await apiFetch<AdminUser>(`/users/${editingUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        await saveEngineerProfileIfNeeded(savedUser.id);
        setSuccess('Đã cập nhật tài khoản.');
      } else {
        const savedUser = await apiFetch<AdminUser>('/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        await saveEngineerProfileIfNeeded(savedUser.id);
        setSuccess('Đã tạo tài khoản mới.');
      }

      await loadData();
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được tài khoản');
    } finally {
      setSaving(false);
    }
  }

  async function saveEngineerProfileIfNeeded(userId: string) {
    const role = roles.find((item) => item.id === form.roleId);
    if (!isEngineerRole(role?.name)) return;

    await apiFetch(`/engineer-profiles/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(buildEngineerProfilePayload(form)),
    });
  }

  async function setUserStatus(user: AdminUser, status: UserStatus) {
    setError('');
    setSuccess('');

    try {
      await apiFetch<AdminUser>(`/users/${user.id}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`, {
        method: 'PATCH',
      });
      setSuccess(status === 'ACTIVE' ? 'Đã kích hoạt tài khoản.' : 'Đã vô hiệu hóa tài khoản.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đổi được trạng thái tài khoản');
    }
  }

  async function removeUser() {
    if (!deletingUser) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiFetch(`/users/${deletingUser.id}`, { method: 'DELETE' });
      setSuccess('Đã xóa nhân sự.');
      setDeletingUser(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được nhân sự');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageFrame>
      <div className="flex items-start justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
        <PageTitle
          eyebrow="Admin"
          title="Quản lý nhân sự"
          description="Tạo tài khoản, phân quyền, gán khu vực phụ trách và kiểm soát trạng thái người dùng."
        />
        <button className="secondary-button" disabled={loading} onClick={loadData} type="button">
          {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
          {loading ? 'Đang tải' : 'Tải lại'}
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#dfe7ef] bg-white">
          <div className="list-toolbar">
            <input
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Tìm tên, email, vai trò, khu vực"
              value={query}
            />
            <button className="primary-button compact" onClick={startCreate} type="button">
              <UserPlus size={17} />
              Tạo mới
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-[#edf1f6] px-3.5 py-[13px] text-left text-xs font-semibold uppercase text-[#657384]">Nhân sự</th>
                  <th className="border-b border-[#edf1f6] px-3.5 py-[13px] text-left text-xs font-semibold uppercase text-[#657384]">Vai trò</th>
                  <th className="border-b border-[#edf1f6] px-3.5 py-[13px] text-left text-xs font-semibold uppercase text-[#657384]">Khu vực</th>
                  <th className="border-b border-[#edf1f6] px-3.5 py-[13px] text-left text-xs font-semibold uppercase text-[#657384]">Trạng thái</th>
                  <th className="sticky right-0 z-[2] border-b border-[#edf1f6] bg-white px-3.5 py-[13px] text-left text-xs font-semibold uppercase text-[#657384]"></th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="border-b border-[#edf1f6] px-3.5 py-[13px]">
                      <div className="flex min-w-0 items-center gap-[11px]">
                        <UserPhoto name={user.fullName || user.email} photoUrl={user.engineerProfile?.photoUrl} />
                        <div className="min-w-0">
                          <strong className="block font-semibold">{user.fullName}</strong>
                          <span className="mt-1 block text-[#657384]">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-[#edf1f6] px-3.5 py-[13px]">{user.role?.name ?? 'Chưa gán'}</td>
                    <td className="border-b border-[#edf1f6] px-3.5 py-[13px]">{user.region?.name ?? 'Chưa gán'}</td>
                    <td className="border-b border-[#edf1f6] px-3.5 py-[13px]">
                      <span className={`inline-flex min-h-7 items-center gap-[7px] whitespace-nowrap rounded-full border px-2.5 py-[7px] text-xs font-semibold leading-none before:h-[7px] before:w-[7px] before:rounded-full before:content-[''] ${
                        user.status === 'ACTIVE'
                          ? 'border-[#abefc6] bg-[#ecfdf3] text-[#027a48] before:bg-[#12b76a]'
                          : 'border-[#fecdd3] bg-[#fff1f3] text-[#b42318] before:bg-[#f04438]'
                      }`}>
                        {user.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm khóa'}
                      </span>
                    </td>
                    <td className="sticky right-0 z-[1] border-b border-[#edf1f6] bg-white px-3.5 py-[13px]">
                      <div className="flex justify-end gap-1.5">
                        <button className="icon-button" onClick={() => startEdit(user)} title="Sửa" type="button">
                          <Edit3 size={16} />
                        </button>
                        {user.status === 'ACTIVE' ? (
                          <button
                            className="icon-button danger"
                            onClick={() => setUserStatus(user, 'INACTIVE')}
                            title="Vô hiệu hóa"
                            type="button"
                          >
                            <PowerOff size={16} />
                          </button>
                        ) : (
                          <button
                            className="icon-button"
                            onClick={() => setUserStatus(user, 'ACTIVE')}
                            title="Kích hoạt"
                            type="button"
                          >
                            <Power size={16} />
                          </button>
                        )}
                        <button
                          className="icon-button danger"
                          onClick={() => setDeletingUser(user)}
                          title="Xóa nhân sự"
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {loading ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="table-state">
                        <Loader2 className="spin-icon" size={18} />
                        Đang tải dữ liệu nhân sự...
                      </div>
                    </td>
                  </tr>
                ) : null}
                {!loading && filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="table-state empty-state">
                        <strong>Không có tài khoản phù hợp</strong>
                        <span>Thử đổi từ khóa tìm kiếm hoặc tạo tài khoản mới.</span>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <div>
              <span>
                Trang {Math.min(page, totalPages)}/{totalPages} - {filteredUsers.length} tài khoản
              </span>
            </div>

            <div className="pagination-controls">
              <label>
                Dòng/trang
                <select onChange={(event) => handlePageSizeChange(event.target.value)} value={pageSize}>
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary-button"
                disabled={loading || page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                Trước
              </button>
              <button
                className="secondary-button"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                type="button"
              >
                Sau
              </button>
            </div>
          </div>
      </section>

      {isFormOpen ? (
        <div className="crud-modal-backdrop" role="presentation">
          <section aria-modal="true" className="crud-modal" role="dialog">
            <div className="form-panel-heading">
              <div>
                <span>{editingUser ? 'Cập nhật' : 'Tạo mới'}</span>
                <h2>{editingUser ? editingUser.fullName : 'Tài khoản nhân sự'}</h2>
              </div>
              <button className="icon-button" onClick={closeForm} title="Đóng" type="button">
                <X size={16} />
              </button>
            </div>

            <form className="grid gap-[18px] [&_input]:min-h-10 [&_input]:rounded-lg [&_input]:border [&_input]:border-[#ced8e3] [&_input]:px-3 [&_input]:text-[#17202a] [&_input]:outline-none [&_input:focus]:border-[#c92a1f] [&_input:focus]:shadow-[0_0_0_3px_rgba(201,42,31,0.1)] [&_label]:grid [&_label]:gap-[7px] [&_label]:font-medium [&_label]:text-[#405064] [&_select]:min-h-10 [&_select]:rounded-lg [&_select]:border [&_select]:border-[#ced8e3] [&_select]:bg-white [&_select]:px-3 [&_select]:text-[#17202a] [&_select]:outline-none [&_select:focus]:border-[#c92a1f] [&_select:focus]:shadow-[0_0_0_3px_rgba(201,42,31,0.1)] [&_textarea]:min-h-[86px] [&_textarea]:resize-y [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#ced8e3] [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:text-[#17202a] [&_textarea]:outline-none [&_textarea:focus]:border-[#c92a1f] [&_textarea:focus]:shadow-[0_0_0_3px_rgba(201,42,31,0.1)]" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label>
                  Họ tên
                  <input
                    onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                    required
                    value={form.fullName}
                  />
                </label>

                <label>
                  Email
                  <input
                    autoComplete="email"
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    required
                    type="email"
                    value={form.email}
                  />
                </label>

                <label>
                  Mật khẩu
                  <input
                    autoComplete="new-password"
                    minLength={6}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder={editingUser ? 'Để trống nếu không đổi' : 'Tối thiểu 6 ký tự'}
                    required={!editingUser}
                    type="password"
                    value={form.password}
                  />
                </label>

                <label>
                  Số điện thoại
                  <input
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    value={form.phone}
                  />
                </label>

                <label>
                  Vai trò
                  <select
                    onChange={(event) => setForm((current) => ({ ...current, roleId: event.target.value }))}
                    required
                    value={form.roleId}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Khu vực
                  <select
                    onChange={(event) => setForm((current) => ({ ...current, regionId: event.target.value }))}
                    required
                    value={form.regionId}
                  >
                    {regions.map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name} ({region.code})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Trạng thái
                  <select
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as UserStatus }))}
                    value={form.status}
                  >
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="INACTIVE">Tạm khóa</option>
                  </select>
                </label>

                {shouldShowEngineerProfile ? (
                  <div className="col-span-full grid gap-3.5 rounded-lg border border-[#edf1f6] bg-[#f8fbfd] p-3.5">
                    <div className="grid gap-1">
                      <span className="text-sm font-semibold text-[#17202a]">Hồ sơ kỹ sư</span>
                      <p className="leading-snug text-[#657384]">Thông tin chuyên môn dùng cho phân công lắp đặt, bảo trì và sửa chữa.</p>
                    </div>

                    <div className="form-grid compact-grid">
                      <label>
                        Mã nhân viên
                        <input
                          onChange={(event) => setForm((current) => ({ ...current, employeeCode: event.target.value }))}
                          value={form.employeeCode}
                        />
                      </label>

                      <label>
                        Chức vụ
                        <input
                          onChange={(event) => setForm((current) => ({ ...current, position: event.target.value }))}
                          value={form.position}
                        />
                      </label>

                      <label>
                        Phòng ban
                        <input
                          onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                          value={form.department}
                        />
                      </label>

                      <label>
                        Số chứng chỉ
                        <input
                          onChange={(event) => setForm((current) => ({ ...current, certificateNo: event.target.value }))}
                          value={form.certificateNo}
                        />
                      </label>

                      <label>
                        Ngày sinh
                        <input
                          onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))}
                          type="date"
                          value={form.dateOfBirth}
                        />
                      </label>

                      <label>
                        Ngày bắt đầu làm
                        <input
                          onChange={(event) => setForm((current) => ({ ...current, workStartDate: event.target.value }))}
                          type="date"
                          value={form.workStartDate}
                        />
                      </label>

                      <label className="wide-field">
                        Ảnh kỹ sư
                        <input
                          onChange={(event) => setForm((current) => ({ ...current, photoUrl: event.target.value }))}
                          placeholder="https://..."
                          type="url"
                          value={form.photoUrl}
                        />
                        {form.photoUrl ? (
                          <span className="mt-0.5 block overflow-hidden rounded-lg border border-[#dfe7ef] bg-[#f4f7fb]">
                            <img alt="" className="aspect-video w-full object-cover" src={form.photoUrl} />
                          </span>
                        ) : null}
                      </label>

                      <label className="wide-field">
                        Chuyên môn
                        <textarea
                          onChange={(event) => setForm((current) => ({ ...current, specialties: event.target.value }))}
                          placeholder="Mỗi dòng là một chuyên môn"
                          value={form.specialties}
                        />
                      </label>

                      <label className="wide-field">
                        Ghi chú hồ sơ
                        <textarea
                          onChange={(event) => setForm((current) => ({ ...current, profileNote: event.target.value }))}
                          value={form.profileNote}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="modal-actions">
                <button className="secondary-button" onClick={closeForm} type="button">
                  Hủy
                </button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? 'Đang lưu' : editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {deletingUser ? (
        <div className="crud-modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-modal" role="dialog">
            <div>
              <span className="confirm-eyebrow">Xác nhận xóa nhân sự</span>
              <h2>{deletingUser.fullName || deletingUser.email}</h2>
              <p>
                Tài khoản sẽ bị xóa khỏi hệ thống. Các phiếu và máy đã liên kết sẽ được giữ lại nhưng bỏ tham chiếu
                tới nhân sự này nếu backend cho phép.
              </p>
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setDeletingUser(null)} type="button">
                Hủy
              </button>
              <button className="danger-button" disabled={saving} onClick={removeUser} type="button">
                {saving ? 'Đang xóa' : 'Xóa nhân sự'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </PageFrame>
  );
}

function buildPayload(form: UserFormState, isEditing: boolean) {
  const payload: Partial<
    Omit<
      UserFormState,
      | 'employeeCode'
      | 'dateOfBirth'
      | 'position'
      | 'department'
      | 'workStartDate'
      | 'specialties'
      | 'certificateNo'
      | 'photoUrl'
      | 'profileNote'
    >
  > = {
    email: form.email.trim(),
    fullName: form.fullName.trim(),
    phone: form.phone.trim() || '',
    roleId: form.roleId,
    regionId: form.regionId,
    status: form.status,
  };

  if (!isEditing || form.password.trim()) {
    payload.password = form.password;
  }

  return payload;
}

function unpack<T>(result: Paginated<T> | T[]) {
  return Array.isArray(result) ? result : result.data ?? [];
}

function buildEngineerProfilePayload(form: UserFormState) {
  return {
    employeeCode: form.employeeCode.trim() || null,
    dateOfBirth: form.dateOfBirth || null,
    position: form.position.trim() || null,
    department: form.department.trim() || null,
    workStartDate: form.workStartDate || null,
    specialties: form.specialties
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
    certificateNo: form.certificateNo.trim() || null,
    photoUrl: form.photoUrl.trim() || null,
    note: form.profileNote.trim() || null,
  };
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function isEngineerRole(roleName?: string) {
  const normalized = roleName?.toLowerCase().trim();
  return normalized === 'engineer' || normalized === 'kỹ sư' || normalized === 'ky su';
}

function UserPhoto({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const [hasError, setHasError] = useState(false);

  if (photoUrl) {
    return (
      <span className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#dfe7ef] bg-[#f4f7fb] text-xs font-semibold text-[#c92a1f]">
        {hasError ? <ImageOff size={18} /> : <img alt="" className="h-full w-full object-cover" onError={() => setHasError(true)} src={photoUrl} />}
      </span>
    );
  }

  return <span className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#dfe7ef] bg-[#f4f7fb] text-xs font-semibold text-[#c92a1f]">{initials(name)}</span>;
}

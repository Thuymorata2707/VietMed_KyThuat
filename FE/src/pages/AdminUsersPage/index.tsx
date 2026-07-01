import { ArrowLeft, Briefcase, Edit3, History, ImageOff, Loader2, MapPin, Power, PowerOff, RefreshCw, Save, Search, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dispatch, FormEvent, ReactNode, SetStateAction, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Paginated, apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { queryKeys } from '../../lib/queryKeys';
import { initials } from '../../utils/format';

type UserStatus = 'ACTIVE' | 'INACTIVE';
type ExpertiseGroup = 'IMAGING' | 'LAB_TESTING';

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
    expertiseGroup?: ExpertiseGroup | null;
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

type AdminUsersBootstrap = {
  users: AdminUser[];
  roles: Role[];
  regions: Region[];
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
  expertiseGroup: '' | ExpertiseGroup;
  isTechnicalStaff: boolean;
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
  expertiseGroup: '',
  isTechnicalStaff: false,
  roleId: '',
  regionId: '',
  status: 'ACTIVE',
};

const pageSizeOptions = [10, 20, 50, 100];
const expertiseGroupOptions: Array<{ label: string; value: ExpertiseGroup }> = [
  { label: 'Chẩn đoán hình ảnh', value: 'IMAGING' },
  { label: 'Xét nghiệm', value: 'LAB_TESTING' },
];

export function AdminUsersPage({ formMode }: { formMode?: 'create' | 'edit' }) {
  const navigate = useNavigate();
  const { userId = '' } = useParams();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const isFormPage = Boolean(formMode);

  const usersQuery = useQuery({
    queryKey: queryKeys.adminUsers.bootstrap,
    queryFn: async (): Promise<AdminUsersBootstrap> => {
      const [usersResult, rolesResult, regionsResult] = await Promise.all([
        apiFetch<Paginated<AdminUser> | AdminUser[]>('/users?limit=100'),
        apiFetch<Role[]>('/roles'),
        apiFetch<Region[]>('/regions'),
      ]);

      return {
        users: unpack(usersResult),
        roles: rolesResult,
        regions: regionsResult,
      };
    },
  });

  const users = usersQuery.data?.users ?? [];
  const roles = usersQuery.data?.roles ?? [];
  const regions = usersQuery.data?.regions ?? [];

  useEffect(() => {
    if (!usersQuery.data) return;

    if (formMode === 'edit') {
      const nextEditingUser = users.find((item) => item.id === userId) ?? null;
      setEditingUser(nextEditingUser);
      if (nextEditingUser) {
        setForm(formFromUser(nextEditingUser, roles, regions));
        setFormError('');
      } else {
        setFormError('Không tìm thấy nhân sự cần chỉnh sửa.');
      }
    } else if (formMode === 'create') {
      setEditingUser(null);
      setForm(buildEmptyForm(roles, regions));
      setFormError('');
    } else {
      setForm((current) => ({
        ...current,
        roleId: current.roleId || roles[0]?.id || '',
        regionId: current.regionId || regions[0]?.id || '',
      }));
    }
  }, [formMode, regions, roles, userId, users, usersQuery.data]);

  const saveUserMutation = useMutation({
    mutationFn: async ({ currentEditingUser, currentForm }: { currentEditingUser: AdminUser | null; currentForm: UserFormState }) => {
      const payload = buildPayload(currentForm, Boolean(currentEditingUser));
      const savedUser = currentEditingUser
        ? await apiFetch<AdminUser>(`/users/${currentEditingUser.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiFetch<AdminUser>('/users', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      await syncEngineerProfile(savedUser.id, currentEditingUser, currentForm);
      return { isEditing: Boolean(currentEditingUser) };
    },
    onSuccess: async ({ isEditing }) => {
      setSuccess(isEditing ? 'Đã cập nhật tài khoản.' : 'Đã tạo tài khoản mới.');
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.bootstrap });
      if (isFormPage) {
        navigate('/users');
      } else {
        closeForm();
      }
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, user }: { user: AdminUser; status: UserStatus }) => {
      await apiFetch<AdminUser>(`/users/${user.id}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`, {
        method: 'PATCH',
      });
      return status;
    },
    onSuccess: async (status) => {
      setSuccess(status === 'ACTIVE' ? 'Đã kích hoạt tài khoản.' : 'Đã vô hiệu hóa tài khoản.');
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.bootstrap });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userIdToDelete: string) => apiFetch(`/users/${userIdToDelete}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setSuccess('Đã xóa nhân sự.');
      setDeletingUser(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.bootstrap });
    },
  });

  const loading = usersQuery.isLoading || usersQuery.isFetching;
  const saving = saveUserMutation.isPending || deleteUserMutation.isPending;
  const mutationError = saveUserMutation.error ?? statusMutation.error ?? deleteUserMutation.error;
  const error = formError || (usersQuery.error instanceof Error ? usersQuery.error.message : '') || (mutationError instanceof Error ? mutationError.message : '');

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

  const userStats = useMemo(() => {
    const technical = users.filter(isTechnicalUser).length;
    const admins = users.filter((user) => isAdminRole(user.role?.name)).length;
    const active = users.filter((user) => user.status === 'ACTIVE').length;

    return {
      active,
      admins,
      inactive: users.length - active,
      technical,
      total: users.length,
    };
  }, [users]);

  const selectedRole = roles.find((role) => role.id === form.roleId);
  const roleIsEngineer = isEngineerRole(selectedRole?.name);
  const shouldShowEngineerProfile = roleIsEngineer || form.isTechnicalStaff;
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const visibleUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  function handleSearchChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function handlePageSizeChange(value: string) {
    setPageSize(Number(value));
    setPage(1);
  }

  function closeForm() {
    setEditingUser(null);
    setForm(buildEmptyForm(roles, regions));
    navigate('/users');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setSuccess('');

    try {
      await saveUserMutation.mutateAsync({ currentEditingUser: editingUser, currentForm: form });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không lưu được tài khoản');
    }
  }

  async function syncEngineerProfile(userIdToSync: string, currentEditingUser: AdminUser | null, currentForm: UserFormState) {
    const role = roles.find((item) => item.id === currentForm.roleId);
    const shouldKeepEngineerProfile = isEngineerRole(role?.name) || currentForm.isTechnicalStaff;

    if (!shouldKeepEngineerProfile) {
      if (currentEditingUser?.engineerProfile) {
        await apiFetch(`/engineer-profiles/${userIdToSync}`, { method: 'DELETE' });
      }
      return;
    }

    await apiFetch(`/engineer-profiles/${userIdToSync}`, {
      method: 'PUT',
      body: JSON.stringify(buildEngineerProfilePayload(currentForm)),
    });
  }

  async function setUserStatus(user: AdminUser, status: UserStatus) {
    setFormError('');
    setSuccess('');

    try {
      await statusMutation.mutateAsync({ status, user });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không đổi được trạng thái tài khoản');
    }
  }

  async function removeUser() {
    if (!deletingUser) return;
    setFormError('');
    setSuccess('');

    try {
      await deleteUserMutation.mutateAsync(deletingUser.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không xóa được nhân sự');
    }
  }

  if (isFormPage) {
    return (
      <PageFrame>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageTitle
            eyebrow="Admin"
            title={formMode === 'edit' ? 'Sửa nhân sự' : 'Thêm nhân sự'}
            description="Tài khoản, quyền và hồ sơ kỹ thuật."
          />
          <button className="secondary-button" onClick={closeForm} type="button">
            <ArrowLeft size={17} />
            Quay lại
          </button>
        </div>

        {error ? <Notice message={error} /> : null}
        {success ? <div className="success-notice">{success}</div> : null}

        <section className="crud-form-page">
          <div className="form-panel-heading">
            <div>
              <span>{editingUser ? 'Edit' : 'Add'}</span>
              <h2>{editingUser ? editingUser.fullName : 'Tài khoản nhân sự'}</h2>
            </div>
          </div>

          {loading ? (
            <div className="table-state">
              <Loader2 className="spin-icon" size={18} />
              Đang tải biểu mẫu...
            </div>
          ) : (
            <UserForm
              editingUser={editingUser}
              form={form}
              onCancel={closeForm}
              onChange={setForm}
              onSubmit={handleSubmit}
              regions={regions}
              roles={roles}
              saving={saving}
              shouldShowEngineerProfile={shouldShowEngineerProfile}
            />
          )}
        </section>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <div className="flex items-start justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
        <PageTitle
          eyebrow="Admin"
          title="Nhân sự"
          description="Quản lý tài khoản, quyền truy cập và hồ sơ kỹ sư."
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Link className="secondary-button" to="/audit-logs">
            <History size={17} />
            Audit log
          </Link>
          <button
            className="secondary-button"
            disabled={loading}
            onClick={() => {
              setFormError('');
              setSuccess('');
              void usersQuery.refetch();
            }}
            type="button"
          >
            {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
            {loading ? 'Loading' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="user-metrics-grid">
        <UserMetricCard icon={<Users size={18} />} label="Tổng nhân sự" value={userStats.total} />
        <UserMetricCard icon={<ShieldCheck size={18} />} label="Đang hoạt động" value={userStats.active} />
        <UserMetricCard icon={<Briefcase size={18} />} label="Kỹ thuật" value={userStats.technical} />
        <UserMetricCard icon={<MapPin size={18} />} label="Admin" value={userStats.admins} note={userStats.inactive ? `${userStats.inactive} tạm khóa` : 'Ổn định'} />
      </section>

      <section className="user-directory-panel">
          <div className="user-directory-toolbar">
            <label className="user-search-field">
              <Search size={18} />
              <input
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Tìm tên, email, vai trò, khu vực"
                value={query}
              />
            </label>
            <Link className="primary-button compact" to="/users/new">
              <UserPlus size={17} />
              Add nhân sự
            </Link>
          </div>

          {loading ? (
            <div className="table-state">
              <Loader2 className="spin-icon" size={18} />
              Đang tải dữ liệu nhân sự...
            </div>
          ) : null}

          {!loading && filteredUsers.length === 0 ? (
            <div className="table-state empty-state">
              <strong>Không có tài khoản phù hợp</strong>
              <span>Thử đổi từ khóa tìm kiếm hoặc tạo tài khoản mới.</span>
            </div>
          ) : null}

          {!loading && visibleUsers.length ? (
            <div className="user-card-list">
              {visibleUsers.map((user) => (
                <UserCard
                  key={user.id}
                  onDelete={() => setDeletingUser(user)}
                  onToggleStatus={() => setUserStatus(user, user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
                  user={user}
                />
              ))}
            </div>
          ) : null}

          <div className="pagination-bar">
            <div>
              <span>
                Trang {Math.min(page, totalPages)}/{totalPages} - {filteredUsers.length} nhân sự
              </span>
            </div>

            <div className="pagination-controls">
              <label>
                Hiển thị
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

      {deletingUser ? (
        <div className="crud-modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-modal" role="dialog">
            <div>
              <span className="confirm-eyebrow">Delete</span>
              <h2>{deletingUser.fullName || deletingUser.email}</h2>
              <p>Delete this account if backend allows.</p>
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setDeletingUser(null)} type="button">
                Cancel
              </button>
              <button className="danger-button" disabled={saving} onClick={removeUser} type="button">
                {saving ? 'Deleting' : 'Delete'}
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
      | 'expertiseGroup'
      | 'isTechnicalStaff'
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

function UserForm({
  editingUser,
  form,
  onCancel,
  onChange,
  onSubmit,
  regions,
  roles,
  saving,
  shouldShowEngineerProfile,
}: {
  editingUser: AdminUser | null;
  form: UserFormState;
  onCancel: () => void;
  onChange: Dispatch<SetStateAction<UserFormState>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  regions: Region[];
  roles: Role[];
  saving: boolean;
  shouldShowEngineerProfile: boolean;
}) {
  const selectedRole = roles.find((role) => role.id === form.roleId);
  const roleIsEngineer = isEngineerRole(selectedRole?.name);

  return (
    <form className="user-form-page-grid" onSubmit={onSubmit}>
      <div className="form-grid">
        <label>
          Họ tên
          <input
            onChange={(event) => onChange((current) => ({ ...current, fullName: event.target.value }))}
            required
            value={form.fullName}
          />
        </label>

        <label>
          Email
          <input
            autoComplete="email"
            onChange={(event) => onChange((current) => ({ ...current, email: event.target.value }))}
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
            onChange={(event) => onChange((current) => ({ ...current, password: event.target.value }))}
            placeholder={editingUser ? 'Để trống nếu không đổi' : 'Tối thiểu 6 ký tự'}
            required={!editingUser}
            type="password"
            value={form.password}
          />
        </label>

        <label>
          Số điện thoại
          <input onChange={(event) => onChange((current) => ({ ...current, phone: event.target.value }))} value={form.phone} />
        </label>

        <label>
          Vai trò
          <select
            onChange={(event) =>
              onChange((current) => {
                const nextRole = roles.find((role) => role.id === event.target.value);
                return {
                  ...current,
                  roleId: event.target.value,
                  isTechnicalStaff: isEngineerRole(nextRole?.name) ? true : current.isTechnicalStaff,
                };
              })
            }
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

        <label className="wide-field engineer-toggle-card">
          <span className="engineer-toggle-card__control">
            <input
              checked={roleIsEngineer || form.isTechnicalStaff}
              disabled={roleIsEngineer}
              onChange={(event) => onChange((current) => ({ ...current, isTechnicalStaff: event.target.checked }))}
              type="checkbox"
            />
            <span>
              Kiêm kỹ sư kỹ thuật
              <span className="mt-1 block text-xs font-normal leading-5 text-[#667085]">
                Cho phép nhân sự xuất hiện trong danh sách kỹ sư.
              </span>
            </span>
          </span>
        </label>

        <label>
          Khu vực
          <select onChange={(event) => onChange((current) => ({ ...current, regionId: event.target.value }))} required value={form.regionId}>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name} ({region.code})
              </option>
            ))}
          </select>
        </label>

        <label>
          Trạng thái
          <select onChange={(event) => onChange((current) => ({ ...current, status: event.target.value as UserStatus }))} value={form.status}>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Tạm khóa</option>
          </select>
        </label>

        {shouldShowEngineerProfile ? (
          <div className="engineer-profile-section">
            <div className="engineer-profile-heading">
              <span>Hồ sơ kỹ sư</span>
              <p>Dùng cho phân công và báo cáo kỹ thuật.</p>
            </div>

            <div className="form-grid compact-grid">
              <label>
                Nhóm chuyên môn
                <select onChange={(event) => onChange((current) => ({ ...current, expertiseGroup: event.target.value as UserFormState['expertiseGroup'] }))} value={form.expertiseGroup}>
                  <option value="">Chưa chọn</option>
                  {expertiseGroupOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Mã nhân viên
                <input onChange={(event) => onChange((current) => ({ ...current, employeeCode: event.target.value }))} value={form.employeeCode} />
              </label>

              <label>
                Chức vụ
                <input onChange={(event) => onChange((current) => ({ ...current, position: event.target.value }))} value={form.position} />
              </label>

              <label>
                Phòng ban
                <input onChange={(event) => onChange((current) => ({ ...current, department: event.target.value }))} value={form.department} />
              </label>

              <label>
                Số chứng chỉ
                <input onChange={(event) => onChange((current) => ({ ...current, certificateNo: event.target.value }))} value={form.certificateNo} />
              </label>

              <label>
                Ngày sinh
                <input onChange={(event) => onChange((current) => ({ ...current, dateOfBirth: event.target.value }))} type="date" value={form.dateOfBirth} />
              </label>

              <label>
                Ngày bắt đầu làm
                <input onChange={(event) => onChange((current) => ({ ...current, workStartDate: event.target.value }))} type="date" value={form.workStartDate} />
              </label>

              <label className="wide-field">
                Ảnh kỹ sư
                <input
                  onChange={(event) => onChange((current) => ({ ...current, photoUrl: event.target.value }))}
                  placeholder="https://..."
                  type="url"
                  value={form.photoUrl}
                />
                {form.photoUrl ? (
                  <span className="engineer-photo-preview">
                    <img alt="" src={form.photoUrl} />
                  </span>
                ) : null}
              </label>

              <label className="wide-field">
                Chuyên môn
                <textarea
                  onChange={(event) => onChange((current) => ({ ...current, specialties: event.target.value }))}
                  placeholder="Mỗi dòng là một chuyên môn"
                  value={form.specialties}
                />
              </label>

              <label className="wide-field">
                Ghi chú hồ sơ
                <textarea onChange={(event) => onChange((current) => ({ ...current, profileNote: event.target.value }))} value={form.profileNote} />
              </label>
            </div>
          </div>
        ) : null}
      </div>

      <div className="modal-actions">
        <button className="secondary-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button" disabled={saving} type="submit">
          {saving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
          {saving ? 'Saving' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function buildEmptyForm(roles: Role[], regions: Region[]): UserFormState {
  return {
    ...emptyForm,
    roleId: roles[0]?.id || '',
    regionId: regions[0]?.id || '',
  };
}

function formFromUser(user: AdminUser, roles: Role[], regions: Region[]): UserFormState {
  const profile = user.engineerProfile;

  return {
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
    expertiseGroup: profile?.expertiseGroup ?? '',
    isTechnicalStaff: Boolean(profile) || isEngineerRole(user.role?.name),
    roleId: user.role?.id ?? roles[0]?.id ?? '',
    regionId: user.region?.id ?? regions[0]?.id ?? '',
    status: user.status,
  };
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
    expertiseGroup: form.expertiseGroup || null,
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

function isAdminRole(roleName?: string) {
  const normalized = roleName?.toLowerCase().trim();
  return normalized === 'admin' || normalized === 'quản trị viên' || normalized === 'quan tri vien';
}

function isTechnicalUser(user: AdminUser) {
  return Boolean(user.engineerProfile) || isEngineerRole(user.role?.name);
}

function expertiseGroupLabel(value?: ExpertiseGroup | null) {
  return expertiseGroupOptions.find((option) => option.value === value)?.label ?? 'Chưa chọn nhóm';
}

function roleTone(roleName?: string | null) {
  if (isAdminRole(roleName ?? undefined)) return 'admin';
  if (isEngineerRole(roleName ?? undefined)) return 'engineer';
  return 'default';
}

function UserMetricCard({ icon, label, note, value }: { icon: ReactNode; label: string; note?: string; value: number }) {
  return (
    <article className="user-metric-card">
      <span className="user-metric-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {note ? <small>{note}</small> : null}
      </div>
    </article>
  );
}

function UserCard({ onDelete, onToggleStatus, user }: { onDelete: () => void; onToggleStatus: () => void; user: AdminUser }) {
  const profile = user.engineerProfile;
  const isTechnical = isTechnicalUser(user);

  return (
    <article className="user-card">
      <div className="user-card-main">
        <UserPhoto name={user.fullName || user.email} photoUrl={profile?.photoUrl} />
        <div className="min-w-0">
          <div className="user-card-title-row">
            <h2>{user.fullName || 'Chưa có tên'}</h2>
            <span className={`user-status-pill ${user.status === 'ACTIVE' ? 'is-active' : 'is-inactive'}`}>
              {user.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm khóa'}
            </span>
          </div>
          <p>{user.email}</p>
          <div className="user-card-chips">
            <span className={`user-role-chip is-${roleTone(user.role?.name)}`}>{user.role?.name ?? 'Chưa gán vai trò'}</span>
            {isTechnical ? <span className="user-role-chip is-technical">Kỹ thuật</span> : null}
            <span>{user.region ? `${user.region.name} (${user.region.code})` : 'Chưa gán khu vực'}</span>
          </div>
        </div>
      </div>

      <dl className="user-card-details">
        <div>
          <dt>Điện thoại</dt>
          <dd>{user.phone || '-'}</dd>
        </div>
        <div>
          <dt>Mã NV</dt>
          <dd>{profile?.employeeCode || '-'}</dd>
        </div>
        <div>
          <dt>Chuyên môn</dt>
          <dd>{isTechnical ? expertiseGroupLabel(profile?.expertiseGroup) : '-'}</dd>
        </div>
        <div>
          <dt>Phòng ban</dt>
          <dd>{profile?.department || profile?.position || '-'}</dd>
        </div>
      </dl>

      <div className="user-card-actions">
        <Link className="icon-button" to={`/users/${user.id}/edit`} title="Edit">
          <Edit3 size={16} />
        </Link>
        <button
          className={user.status === 'ACTIVE' ? 'icon-button danger' : 'icon-button'}
          onClick={onToggleStatus}
          title={user.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'}
          type="button"
        >
          {user.status === 'ACTIVE' ? <PowerOff size={16} /> : <Power size={16} />}
        </button>
        <button className="icon-button danger" onClick={onDelete} title="Delete" type="button">
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

function UserPhoto({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const [hasError, setHasError] = useState(false);

  if (photoUrl) {
    return (
      <span className="user-photo">
        {hasError ? <ImageOff size={18} /> : <img alt="" className="h-full w-full object-cover" onError={() => setHasError(true)} src={photoUrl} />}
      </span>
    );
  }

  return <span className="user-photo">{initials(name)}</span>;
}

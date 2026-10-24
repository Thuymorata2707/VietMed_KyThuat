import { ArrowLeft, Edit3, History, ImageOff, Loader2, Power, PowerOff, RefreshCw, Save, Search, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { DateInput } from '../../components/DateInput';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { queryKeys } from '../../lib/queryKeys';
import { initials } from '../../utils/format';

type UserStatus = 'ACTIVE' | 'INACTIVE';
type ExpertiseGroup = 'IMAGING' | 'LAB_TESTING';

type Role = {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};

type Region = {
  id: string;
  name: string;
  code: string;
};

type AdminUser = {
  id: string;
  email: string;
  username?: string | null;
  fullName: string;
  phone?: string | null;
  status: UserStatus;
  role?: Role | null;
  region?: Region | null;
  engineerProfile?: {
    employeeCode?: string | null;
    expertiseGroup?: ExpertiseGroup | null;
    expertiseGroups?: ExpertiseGroup[];
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

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorEmail?: string | null;
  createdAt: string;
  actor?: {
    fullName?: string | null;
    email?: string | null;
  } | null;
};

type PeopleSection = 'people' | 'roles' | 'audit';

type UserFormState = {
  email: string;
  username: string;
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
  expertiseGroups: ExpertiseGroup[];
  isTechnicalStaff: boolean;
  roleId: string;
  regionId: string;
  status: UserStatus;
};

const emptyForm: UserFormState = {
  email: '',
  username: '',
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
  expertiseGroups: [],
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

export function AdminUsersPage({ formMode, user }: { formMode?: 'create' | 'edit'; user: ApiUser }) {
  const navigate = useNavigate();
  const { userId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const activeSection = normalizePeopleSection(searchParams.get('tab'));

  const usersQuery = useQuery({
    enabled: isFormPage || activeSection !== 'audit',
    queryKey: [...queryKeys.adminUsers.bootstrap, formMode === 'create' ? 'form-create' : 'list', userId],
    queryFn: async (): Promise<AdminUsersBootstrap> => {
      const [usersResult, rolesResult, regionsResult] = await Promise.all([
        formMode === 'create'
          ? Promise.resolve([] as AdminUser[])
          : apiFetch<Paginated<AdminUser> | AdminUser[]>('/users?limit=100'),
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
  const accountRegionId = user.region?.id ?? user.regionId ?? '';
  const manageableRegions = useMemo(
    () => regions.filter((region) => region.id === accountRegionId),
    [accountRegionId, regions],
  );

  const auditLogsQuery = useQuery({
    enabled: !isFormPage && activeSection === 'audit',
    queryKey: ['admin-users', 'audit-logs', 'latest'],
    queryFn: async () => unpack(await apiFetch<Paginated<AuditLog> | AuditLog[]>('/audit-logs?limit=20')),
  });

  useEffect(() => {
    if (!usersQuery.data) return;

    if (formMode === 'edit') {
      const nextEditingUser = users.find((item) => item.id === userId) ?? null;
      setEditingUser(nextEditingUser);
      if (nextEditingUser) {
        setForm(formFromUser(nextEditingUser, roles, manageableRegions));
        setFormError('');
      } else {
        setFormError('Không tìm thấy nhân sự cần chỉnh sửa.');
      }
    } else if (formMode === 'create') {
      setEditingUser(null);
      setForm(buildEmptyForm(roles, manageableRegions));
      setFormError('');
    } else {
      setForm((current) => ({
        ...current,
        roleId: current.roleId || roles[0]?.id || '',
        regionId: current.regionId || manageableRegions[0]?.id || '',
      }));
    }
  }, [formMode, manageableRegions, roles, userId, users, usersQuery.data]);

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
        user.username,
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

  function switchSection(section: PeopleSection) {
    const nextParams = new URLSearchParams(searchParams);
    if (section === 'people') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', section);
    }
    setSearchParams(nextParams, { replace: true });
  }

  async function refreshCurrentSection() {
    setFormError('');
    setSuccess('');

    if (activeSection === 'audit') {
      await auditLogsQuery.refetch();
      return;
    }

    await usersQuery.refetch();
  }

  function closeForm() {
    setEditingUser(null);
    setForm(buildEmptyForm(roles, manageableRegions));
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
            eyebrow="Quản trị hệ thống"
            title={formMode === 'edit' ? 'Sửa nhân sự' : 'Thêm nhân sự'}
          />
          <button className="secondary-button" onClick={closeForm} type="button">
            <ArrowLeft size={17} />
            Quay lại
          </button>
        </div>

        {error ? <Notice message={error} /> : null}
        {!accountRegionId ? <Notice message="Tài khoản chưa được gán khu vực quản lý. Hãy liên hệ quản trị hệ thống trước khi tạo hoặc sửa nhân sự." /> : null}
        {success ? <div className="success-notice">{success}</div> : null}

        <section className="crud-form-page">
          <div className="form-panel-heading">
            <div>
              <span>{editingUser ? 'Sửa' : 'Thêm'}</span>
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
              regions={manageableRegions}
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
      <section className="people-workspace">
        <div className="people-workspace-header">
          <div>
            <span className="people-eyebrow">Dữ liệu nền</span>
            <h1>Nhân sự</h1>
          </div>
          <div className="people-header-actions">
            <button
              className="secondary-button compact"
              disabled={loading || auditLogsQuery.isFetching}
              onClick={() => void refreshCurrentSection()}
              type="button"
            >
              {loading || auditLogsQuery.isFetching ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
              Làm mới
            </button>
            {activeSection === 'people' ? (
              <Link className="primary-button compact" to="/users/new">
                <UserPlus size={17} />
                Thêm nhân sự
              </Link>
            ) : null}
          </div>
        </div>

        <div className="people-summary-strip">
          <MiniStat label="Tổng" value={userStats.total} />
          <MiniStat label="Hoạt động" value={userStats.active} />
          <MiniStat label="Kỹ thuật" value={userStats.technical} />
          <MiniStat label="Quản trị viên" value={userStats.admins} />
          <MiniStat label="Tạm khóa" value={userStats.inactive} />
        </div>

        <div className="people-tabbar" role="tablist" aria-label="Quản lý nhân sự">
          <button className={activeSection === 'people' ? 'is-active' : ''} onClick={() => switchSection('people')} type="button">
            <Users size={17} />
            Nhân sự
          </button>
          <button className={activeSection === 'roles' ? 'is-active' : ''} onClick={() => switchSection('roles')} type="button">
            <ShieldCheck size={17} />
            Vai trò
          </button>
          <button className={activeSection === 'audit' ? 'is-active' : ''} onClick={() => switchSection('audit')} type="button">
            <History size={17} />
            Audit log
          </button>
        </div>
      </section>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      {activeSection === 'people' ? (
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
            <span className="people-result-pill">{filteredUsers.length} nhân sự</span>
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
                Trang {Math.min(page, totalPages)}/{totalPages}
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
      ) : null}

      {activeSection === 'roles' ? <RolesInsidePeoplePanel roles={roles} users={users} /> : null}

      {activeSection === 'audit' ? (
        <AuditInsidePeoplePanel
          logs={auditLogsQuery.data ?? []}
          loading={auditLogsQuery.isLoading || auditLogsQuery.isFetching}
          error={auditLogsQuery.error instanceof Error ? auditLogsQuery.error.message : ''}
        />
      ) : null}

      {deletingUser ? (
        <div className="crud-modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-modal" role="dialog">
            <div>
              <span className="confirm-eyebrow">Xóa</span>
              <h2>{deletingUser.fullName || deletingUser.email}</h2>
              <p>Xác nhận xóa nhân sự?</p>
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setDeletingUser(null)} type="button">
                Hủy
              </button>
              <button className="danger-button" disabled={saving} onClick={removeUser} type="button">
                {saving ? 'Đang xóa' : 'Xóa'}
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
      | 'expertiseGroups'
      | 'isTechnicalStaff'
    >
  > = {
    email: form.email.trim(),
    username: form.username.trim() || undefined,
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
          Tên đăng nhập
          <input
            autoComplete="username"
            onChange={(event) => onChange((current) => ({ ...current, username: event.target.value }))}
            placeholder="VD: nguyenvana"
            value={form.username}
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
            </span>
          </span>
        </label>

        <label>
          Khu vực
          <select disabled={regions.length <= 1} onChange={(event) => onChange((current) => ({ ...current, regionId: event.target.value }))} required value={form.regionId}>
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
            </div>

            <div className="form-grid compact-grid">
              <fieldset className="grid gap-2 rounded-xl border border-[#e5e7eb] bg-white p-3">
                <legend className="px-1 text-sm font-medium">Nhóm chuyên môn</legend>
                <div className="flex flex-wrap gap-3">
                  {expertiseGroupOptions.map((option) => (
                    <label className="!flex !items-center !gap-2 text-sm" key={option.value}>
                      <input
                        className="!h-4 !min-h-4 !w-4 !p-0 accent-[#177245]"
                        checked={form.expertiseGroups.includes(option.value)}
                        onChange={(event) => onChange((current) => ({
                          ...current,
                          expertiseGroups: event.target.checked
                            ? [...new Set([...current.expertiseGroups, option.value])]
                            : current.expertiseGroups.filter((group) => group !== option.value),
                        }))}
                        type="checkbox"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

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

              <DateInput className="[&>button]:h-11 [&>button]:rounded-xl [&>button]:border-[#d8d4ce] [&>button]:px-3.5 [&>button]:shadow-none" label="Ngày sinh" onChange={(value) => onChange((current) => ({ ...current, dateOfBirth: value }))} value={form.dateOfBirth} />

              <DateInput className="[&>button]:h-11 [&>button]:rounded-xl [&>button]:border-[#d8d4ce] [&>button]:px-3.5 [&>button]:shadow-none" label="Ngày bắt đầu làm" onChange={(value) => onChange((current) => ({ ...current, workStartDate: value }))} value={form.workStartDate} />

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
                  placeholder="Chuyên môn"
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
          Hủy
        </button>
        <button className="primary-button" disabled={saving} type="submit">
          {saving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
          {saving ? 'Đang lưu' : 'Lưu'}
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
  const allowedRegionId =
    regions.find((region) => region.id === user.region?.id)?.id ??
    regions[0]?.id ??
    '';

  return {
    email: user.email,
    username: user.username || '',
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
    expertiseGroups: profile?.expertiseGroups?.length
      ? profile.expertiseGroups
      : profile?.expertiseGroup ? [profile.expertiseGroup] : [],
    isTechnicalStaff: Boolean(profile) || isEngineerRole(user.role?.name),
    roleId: user.role?.id ?? roles[0]?.id ?? '',
    regionId: allowedRegionId,
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
    expertiseGroups: form.expertiseGroups,
    note: form.profileNote.trim() || null,
  };
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN').format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatAuditAction(action: string) {
  return action
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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

function expertiseGroupLabel(values?: ExpertiseGroup[] | ExpertiseGroup | null) {
  const groups = Array.isArray(values) ? values : values ? [values] : [];
  return groups.length
    ? groups.map((value) => expertiseGroupOptions.find((option) => option.value === value)?.label).filter(Boolean).join(' · ')
    : 'Chưa chọn nhóm';
}

function roleTone(roleName?: string | null) {
  if (isAdminRole(roleName ?? undefined)) return 'admin';
  if (isEngineerRole(roleName ?? undefined)) return 'engineer';
  return 'default';
}

function normalizePeopleSection(value: string | null): PeopleSection {
  if (value === 'roles' || value === 'audit') return value;
  return 'people';
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <strong>{value}</strong>
      {label}
    </span>
  );
}

function RolesInsidePeoplePanel({ roles, users }: { roles: Role[]; users: AdminUser[] }) {
  return (
    <section className="people-subpanel">
      <div className="people-subpanel-heading">
        <div>
          <span>Phân quyền</span>
          <h2>Vai trò hệ thống</h2>
        </div>
        <Link className="primary-button compact" to="/roles">
          <ShieldCheck size={17} />
          Sửa vai trò
        </Link>
      </div>

      <div className="people-simple-table">
        <table>
          <thead>
            <tr>
              <th>Vai trò</th>
              <th>Nhân sự</th>
              <th>Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => {
              const roleUsers = users.filter((user) => user.role?.id === role.id).length;

              return (
                <tr key={role.id}>
                  <td>
                    <div className="people-table-title">
                      <ShieldCheck size={17} />
                      <strong>{role.name}</strong>
                    </div>
                  </td>
                  <td>{roleUsers}</td>
                  <td>{role.updatedAt ? formatDate(role.updatedAt) : '-'}</td>
                </tr>
              );
            })}
            {!roles.length ? (
              <tr>
                <td colSpan={3}>
                  <div className="table-state empty-state">
                    <strong>Chưa có vai trò</strong>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AuditInsidePeoplePanel({ error, loading, logs }: { error: string; loading: boolean; logs: AuditLog[] }) {
  return (
    <section className="people-subpanel">
      <div className="people-subpanel-heading">
        <div>
          <span>Nhật ký</span>
          <h2>Audit log gần nhất</h2>
        </div>
        <Link className="secondary-button compact" to="/audit-logs">
          <History size={17} />
          Xem đầy đủ
        </Link>
      </div>

      {error ? <Notice message={error} /> : null}

      <div className="people-simple-table">
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Người thao tác</th>
              <th>Hành động</th>
              <th>Dữ liệu</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{formatDateTime(log.createdAt)}</td>
                <td>{log.actor?.fullName || log.actorEmail || log.actor?.email || '-'}</td>
                <td>
                  <span className="people-action-pill">{formatAuditAction(log.action)}</span>
                </td>
                <td>{[log.entityType, log.entityId].filter(Boolean).join(' / ') || '-'}</td>
              </tr>
            ))}
            {loading ? (
              <tr>
                <td colSpan={4}>
                  <div className="table-state">
                    <Loader2 className="spin-icon" size={18} />
                    Đang tải audit log...
                  </div>
                </td>
              </tr>
            ) : null}
            {!loading && !logs.length ? (
              <tr>
                <td colSpan={4}>
                  <div className="table-state empty-state">
                    <strong>Chưa có nhật ký</strong>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
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
          {user.username ? <p className="text-xs font-semibold text-[#667085]">Tên đăng nhập: {user.username}</p> : null}
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
          <dd>{isTechnical ? expertiseGroupLabel(profile?.expertiseGroups?.length ? profile.expertiseGroups : profile?.expertiseGroup) : '-'}</dd>
        </div>
        <div>
          <dt>Phòng ban</dt>
          <dd>{profile?.department || profile?.position || '-'}</dd>
        </div>
      </dl>

      <div className="user-card-actions">
        <Link className="icon-button" to={`/users/${user.id}/edit`} title="Sửa">
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
        <button className="icon-button danger" onClick={onDelete} title="Xóa" type="button">
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

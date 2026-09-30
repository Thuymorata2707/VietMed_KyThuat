import { Camera, ImageOff, Loader2, Save, ShieldCheck, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { ApiUser, apiFetch } from '../../api';
import { getRoleName, roleLabel } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { DateInput } from '../../components/DateInput';
import { PageFrame } from '../../components/PageFrame';
import { initials } from '../../utils/format';

type AccountSettingsPageProps = {
  user: ApiUser;
  onUserUpdated: (user: ApiUser) => void;
};

type AccountFormState = {
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
  expertiseGroups: Array<'IMAGING' | 'LAB_TESTING'>;
  specialties: string;
  certificateNo: string;
  photoUrl: string;
  profileNote: string;
};

export function AccountSettingsPage({ user, onUserUpdated }: AccountSettingsPageProps) {
  const [form, setForm] = useState<AccountFormState>(() => toFormState(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [photoFailed, setPhotoFailed] = useState(false);
  const role = getRoleName(user);
  const canEditEngineerProfile = role === 'engineer' || role === 'admin' || Boolean(user.engineerProfile);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updatedUser = await apiFetch<ApiUser>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(buildPayload(form, canEditEngineerProfile)),
      });

      onUserUpdated(updatedUser);
      setForm(toFormState(updatedUser));
      setSuccess('Đã cập nhật thông tin tài khoản.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được thông tin tài khoản');
    } finally {
      setSaving(false);
    }
  }

  function updateField<Key extends keyof AccountFormState>(key: Key, value: AccountFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'photoUrl') {
      setPhotoFailed(false);
    }
  }

  return (
    <PageFrame>
      <section className="relative flex items-stretch justify-between gap-[18px] overflow-hidden rounded-[30px] border border-[#e4e4e7] bg-[#f4f4f5] p-6 text-[#1f1f1f] shadow-[0_12px_30px_rgba(24,24,27,0.06)] max-[760px]:grid">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_9%_18%,rgba(37,99,235,0.12),transparent_30%),radial-gradient(circle_at_92%_16%,rgba(255,255,255,0.96),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.9),rgba(239,246,255,0.78))]" />
        <div className="relative flex min-w-0 items-center gap-[18px] max-[760px]:grid max-[760px]:items-start">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[28px] border border-white bg-white text-[28px] font-semibold text-[#18181b] shadow-[0_18px_42px_rgba(24,24,27,0.14)]">
            {form.photoUrl && !photoFailed ? (
              <img alt="" className="h-full w-full object-cover" onError={() => setPhotoFailed(true)} src={form.photoUrl} />
            ) : form.photoUrl && photoFailed ? (
              <ImageOff size={30} />
            ) : (
              initials(form.fullName || form.email)
            )}
          </div>
          <div>
            <span className="mb-2 inline-flex rounded-full border border-[#e4e4e7] bg-white px-3 py-1 text-xs font-semibold text-[#18181b]">Account settings</span>
            <h1 className="mb-2.5 text-[clamp(28px,4vw,46px)] font-semibold leading-none tracking-[-0.03em] text-[#171717]">{form.fullName || user.email}</h1>
          </div>
        </div>

        <div className="relative grid min-w-60 self-center rounded-2xl border border-white bg-white/82 p-4 shadow-[0_14px_34px_rgba(24,24,27,0.10)]">
          <span className="text-sm font-semibold text-[#777777]">{roleLabel(role)}</span>
          <strong className="text-lg text-[#1f1f1f]">{user.region?.name || 'Chưa gán khu vực'}</strong>
          <small className="text-[#666666]">{user.email}</small>
        </div>
      </section>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <form className="grid grid-cols-[minmax(260px,300px)_minmax(0,1fr)] items-start gap-x-5 gap-y-4 max-[1120px]:grid-cols-1" onSubmit={handleSubmit}>
        <aside className="sticky top-[88px] grid gap-4 rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-[0_1px_2px_rgba(24,24,27,0.04)] max-[1120px]:static">
          <div className="grid grid-cols-[38px_minmax(0,1fr)] items-start gap-3">
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-[#f4f4f5] text-[#18181b]">
              <ShieldCheck size={18} />
            </span>
            <div>
              <strong className="block text-[#1f1f1f]">Quyền truy cập</strong>
            </div>
          </div>

          <dl className="m-0 grid border-t border-[#eeeeee] pt-2">
            <div className="flex justify-between gap-3 border-b border-[#eeeeee] py-[11px]">
              <dt className="font-semibold text-[#666666]">Vai trò</dt>
              <dd className="m-0 text-right font-medium text-[#1f1f1f]">{roleLabel(role)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-[#eeeeee] py-[11px]">
              <dt className="font-semibold text-[#666666]">Khu vực</dt>
              <dd className="m-0 text-right font-medium text-[#1f1f1f]">{user.region?.name || 'Chưa gán'}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-[#eeeeee] py-[11px]">
              <dt className="font-semibold text-[#666666]">Trạng thái</dt>
              <dd className="m-0 text-right font-medium text-[#1f1f1f]">{user.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm khóa'}</dd>
            </div>
          </dl>

          <label className="grid gap-2 font-medium text-[#333333] [&_svg]:text-[#18181b]">
            <Camera size={17} />
            URL ảnh đại diện
            <input
              className="min-h-[42px] w-full rounded-lg border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]"
              onChange={(event) => updateField('photoUrl', event.target.value)}
              placeholder="https://..."
              type="url"
              value={form.photoUrl}
            />
          </label>
        </aside>

        <section className="col-start-2 grid gap-5 rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-[0_1px_2px_rgba(24,24,27,0.04)] max-[1120px]:col-auto">
          <div className="grid gap-3">
            <div className="grid grid-cols-[38px_minmax(0,1fr)] items-start gap-3 border-b border-[#eeeeee] pb-3">
              <UserRound className="h-[38px] w-[38px] rounded-[10px] border border-[#eeeeee] bg-[#fafafa] p-[9px] text-[#18181b]" size={18} />
              <div>
                <h2 className="text-[#1f1f1f]">Thông tin cá nhân</h2>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-4 max-[760px]:grid-cols-1 [&_input]:min-h-[44px] [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-[#d6d6d6] [&_input]:bg-white [&_input]:px-3.5 [&_input]:text-[#1f1f1f] [&_input]:outline-none [&_input:focus]:border-[#18181b] [&_input:focus]:shadow-[0_0_0_3px_rgba(24,24,27,0.12)] [&_label]:grid [&_label]:min-w-0 [&_label]:gap-2 [&_label]:text-[13px] [&_label]:font-medium [&_label]:text-[#333333]">
              <label>
                Họ và tên
                <input
                  onChange={(event) => updateField('fullName', event.target.value)}
                  required
                  value={form.fullName}
                />
              </label>

              <label>
                Tên đăng nhập
                <input
                  onChange={(event) => updateField('username', event.target.value)}
                  placeholder="nguyenvana"
                  value={form.username}
                />
              </label>

              <label>
                Email đăng nhập
                <input
                  onChange={(event) => updateField('email', event.target.value)}
                  required
                  type="email"
                  value={form.email}
                />
              </label>

              <label>
                Số điện thoại
                <input onChange={(event) => updateField('phone', event.target.value)} value={form.phone} />
              </label>

              <label>
                Đổi mật khẩu
                <input
                  autoComplete="new-password"
                  minLength={6}
                  onChange={(event) => updateField('password', event.target.value)}
                  placeholder="Bỏ trống nếu không đổi"
                  type="password"
                  value={form.password}
                />
              </label>
            </div>
          </div>

          {canEditEngineerProfile ? (
            <div className="grid gap-4 border-t border-[#e9eef5] pt-4">
              <div className="grid grid-cols-[38px_minmax(0,1fr)] items-start gap-3 border-b border-[#eeeeee] pb-3">
                <UserRound className="h-[38px] w-[38px] rounded-[10px] border border-[#eeeeee] bg-[#fafafa] p-[9px] text-[#18181b]" size={18} />
                <div>
                  <h2 className="text-[#1f1f1f]">Hồ sơ kỹ sư</h2>
                </div>
              </div>

              <div className="grid grid-cols-2 items-start gap-x-4 gap-y-4 max-[760px]:grid-cols-1 [&_input]:min-h-[44px] [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-[#d6d6d6] [&_input]:bg-white [&_input]:px-3.5 [&_input]:text-[#1f1f1f] [&_input]:outline-none [&_input:focus]:border-[#18181b] [&_input:focus]:shadow-[0_0_0_3px_rgba(24,24,27,0.12)] [&_label]:grid [&_label]:min-w-0 [&_label]:gap-2 [&_label]:text-[13px] [&_label]:font-medium [&_label]:text-[#333333] [&_select]:min-h-[44px] [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-[#d6d6d6] [&_select]:bg-white [&_select]:px-3.5 [&_select]:text-[#1f1f1f] [&_select]:outline-none [&_select:focus]:border-[#18181b] [&_select:focus]:shadow-[0_0_0_3px_rgba(24,24,27,0.12)] [&_textarea]:min-h-28 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-[#d6d6d6] [&_textarea]:bg-white [&_textarea]:px-3.5 [&_textarea]:py-3 [&_textarea]:text-[#1f1f1f] [&_textarea]:outline-none [&_textarea:focus]:border-[#18181b] [&_textarea:focus]:shadow-[0_0_0_3px_rgba(24,24,27,0.12)] [&_fieldset]:min-w-0 [&_fieldset]:rounded-xl [&_fieldset]:border-[#d6d6d6] [&_fieldset]:px-4 [&_fieldset]:py-3">
                <label>
                  Mã nhân sự
                  <input onChange={(event) => updateField('employeeCode', event.target.value)} value={form.employeeCode} />
                </label>

                <label>
                  Chức danh
                  <input onChange={(event) => updateField('position', event.target.value)} value={form.position} />
                </label>

                <label>
                  Phòng ban
                  <input onChange={(event) => updateField('department', event.target.value)} value={form.department} />
                </label>

                <label>
                  Số chứng chỉ
                  <input onChange={(event) => updateField('certificateNo', event.target.value)} value={form.certificateNo} />
                </label>

                <fieldset className="col-span-full grid grid-cols-2 gap-x-4 gap-y-2 bg-[#fafafa] max-[760px]:grid-cols-1">
                  <legend className="px-1">Nhóm chuyên môn</legend>
                  {[
                    { label: 'Chẩn đoán hình ảnh', value: 'IMAGING' as const },
                    { label: 'Xét nghiệm', value: 'LAB_TESTING' as const },
                  ].map((option) => (
                    <label className="!flex min-h-8 grid-cols-[18px_1fr] !items-center !gap-2" key={option.value}>
                      <input
                        className="!h-4 !min-h-4 !w-4 !p-0 accent-[#177245]"
                        checked={form.expertiseGroups.includes(option.value)}
                        onChange={(event) => updateField(
                          'expertiseGroups',
                          event.target.checked
                            ? [...new Set([...form.expertiseGroups, option.value])]
                            : form.expertiseGroups.filter((group) => group !== option.value),
                        )}
                        type="checkbox"
                      />
                      {option.label}
                    </label>
                  ))}
                </fieldset>

                <DateInput className="[&>button]:h-11 [&>button]:rounded-xl [&>button]:border-[#d6d6d6] [&>button]:px-3.5 [&>button]:shadow-none" label="Ngày sinh" onChange={(value) => updateField('dateOfBirth', value)} value={form.dateOfBirth} />

                <DateInput className="[&>button]:h-11 [&>button]:rounded-xl [&>button]:border-[#d6d6d6] [&>button]:px-3.5 [&>button]:shadow-none" label="Ngày bắt đầu làm" onChange={(value) => updateField('workStartDate', value)} value={form.workStartDate} />

                <label className="col-span-full">
                  Chuyên môn
                  <textarea
                    onChange={(event) => updateField('specialties', event.target.value)}
                    placeholder="Chuyên môn"
                    value={form.specialties}
                  />
                </label>

                <label className="col-span-full">
                  Ghi chú hồ sơ
                  <textarea onChange={(event) => updateField('profileNote', event.target.value)} value={form.profileNote} />
                </label>
              </div>
            </div>
          ) : null}
        </section>

        <div className="col-span-full flex items-center justify-between gap-4 rounded-2xl border border-[#e5e5e5] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(24,24,27,0.04)] max-[760px]:grid max-[760px]:items-stretch">
          <span className="text-[#666666]">Cập nhật ngay trên tài khoản hiện tại.</span>
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? <Loader2 className="spin-icon" size={18} /> : <Save size={18} />}
            {saving ? 'Đang lưu' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </PageFrame>
  );
}

function toFormState(user: ApiUser): AccountFormState {
  const profile = user.engineerProfile;

  return {
    email: user.email,
    username: user.username || '',
    password: '',
    fullName: user.fullName || '',
    phone: user.phone || '',
    employeeCode: profile?.employeeCode || '',
    dateOfBirth: toDateInput(profile?.dateOfBirth),
    position: profile?.position || '',
    department: profile?.department || '',
    workStartDate: toDateInput(profile?.workStartDate),
    expertiseGroups: profile?.expertiseGroups?.length
      ? profile.expertiseGroups
      : profile?.expertiseGroup ? [profile.expertiseGroup] : [],
    specialties: profile?.specialties?.join('\n') || '',
    certificateNo: profile?.certificateNo || '',
    photoUrl: profile?.photoUrl || '',
    profileNote: profile?.note || '',
  };
}

function buildPayload(form: AccountFormState, includeEngineerProfile: boolean) {
  return {
    email: form.email.trim(),
    username: form.username.trim() || null,
    fullName: form.fullName.trim(),
    phone: form.phone.trim() || null,
    password: form.password.trim() || undefined,
    engineerProfile: includeEngineerProfile
      ? {
          employeeCode: form.employeeCode.trim() || null,
          dateOfBirth: form.dateOfBirth || null,
          position: form.position.trim() || null,
          department: form.department.trim() || null,
          workStartDate: form.workStartDate || null,
          expertiseGroups: form.expertiseGroups,
          specialties: form.specialties
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
          certificateNo: form.certificateNo.trim() || null,
          photoUrl: form.photoUrl.trim() || null,
          note: form.profileNote.trim() || null,
        }
      : undefined,
  };
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

import { Activity, CalendarDays, CheckCircle2, ChevronRight, ShieldCheck, Wrench } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiUser, login } from '../../api';
import { getRoleName, homePathForRole } from '../../auth/roles';
import { Brand } from '../../components/Brand';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';

type LoginPageProps = {
  onLogin: (user: ApiUser) => void;
};

export function LoginPage({ onLogin }: LoginPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const loginMutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (signedInUser) => {
      queryClient.setQueryData(queryKeys.auth.me, signedInUser);
      onLogin(signedInUser);
      navigate(homePathForRole(getRoleName(signedInUser)));
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    loginMutation.mutate();
  }

  return (
    <main className="grid min-h-screen place-items-center overflow-hidden bg-[#f3f5f7] px-6 py-7 max-sm:px-4 max-sm:py-4">
      <section className="grid min-h-[calc(100vh-56px)] w-full max-w-[1440px] grid-cols-[minmax(390px,0.82fr)_minmax(0,1.18fr)] overflow-hidden rounded-[18px] border border-[#dde3ea] bg-white shadow-[0_28px_90px_rgba(28,39,56,0.13)] max-[980px]:min-h-[calc(100vh-32px)] max-[980px]:grid-cols-1">
        <div className="relative grid content-between gap-8 bg-white px-12 py-10 max-[980px]:px-8 max-[620px]:px-5 max-[620px]:py-6">
          <div className="flex items-center justify-between gap-4">
            <Brand size="large" />
            <span className="inline-flex min-h-8 items-center rounded-lg border border-[#b9dfc9] bg-[#edf8f2] px-2.5 text-[12px] font-semibold text-[#1b7a4c]">
              Online
            </span>
          </div>

          <div className="grid max-w-[480px] content-center gap-7 self-center justify-self-center py-10 max-[980px]:w-full max-[980px]:max-w-[560px] max-[620px]:py-6">
            <div className="grid gap-3">
              <span className="text-[12px] font-bold text-[#c91f2d]">VietMed Technical Service</span>
              <h1 className="max-w-[420px] text-[40px] font-bold leading-[1.06] text-[#18212f] max-sm:text-[32px]">
                Đăng nhập hệ thống kỹ thuật
              </h1>
              <p className="max-w-[430px] text-[15px] leading-7 text-[#647084]">
                Quản lý thiết bị, lịch việc và phiếu dịch vụ trong cùng một không gian làm việc.
              </p>
            </div>

            <form className="grid gap-4" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-[13px] font-semibold text-[#303a4b]">
                Email
                <input
                  className="min-h-[50px] rounded-lg border border-[#cfd7e2] bg-[#fbfcfd] px-4 text-[#18212f] outline-none transition placeholder:text-[#98a3b4] hover:border-[#b9c4d2] focus:border-[#c91f2d] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,31,45,0.14)]"
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@vietmed.com.vn"
                  type="email"
                  value={email}
                />
              </label>
              <label className="grid gap-2 text-[13px] font-semibold text-[#303a4b]">
                Mật khẩu
                <input
                  className="min-h-[50px] rounded-lg border border-[#cfd7e2] bg-[#fbfcfd] px-4 text-[#18212f] outline-none transition placeholder:text-[#98a3b4] hover:border-[#b9c4d2] focus:border-[#c91f2d] focus:bg-white focus:shadow-[0_0_0_3px_rgba(201,31,45,0.14)]"
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nhập mật khẩu"
                  type="password"
                  value={password}
                />
              </label>
              {error ? (
                <p className="rounded-lg border border-[#f1c4c9] bg-[#fff3f4] px-3.5 py-3 text-[14px] font-semibold leading-5 text-[#a81524]">
                  {error}
                </p>
              ) : null}
              <button
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-lg bg-[linear-gradient(180deg,#d9303c,#c91f2d)] px-[18px] font-semibold text-white shadow-[0_14px_30px_rgba(201,31,45,0.20),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:-translate-y-px hover:bg-[#a81524] disabled:hover:translate-y-0"
                disabled={loginMutation.isPending}
                type="submit"
              >
                {loginMutation.isPending ? 'Đang đăng nhập' : 'Đăng nhập'}
                <ChevronRight size={18} />
              </button>
            </form>

            <div className="grid gap-2 border-t border-[#e9edf2] pt-5 text-[13px] leading-5 text-[#647084]">
              <span className="inline-flex items-center gap-2 font-semibold text-[#303a4b]">
                <ShieldCheck size={16} />
                Truy cập dành cho nhân sự được phân quyền
              </span>
              <span>Dữ liệu vận hành được bảo vệ theo vai trò tài khoản.</span>
            </div>
          </div>

          <span className="text-[12px] font-medium text-[#8b96a8]">VietMed Ky Thuat · Internal workspace</span>
        </div>

        <aside className="relative overflow-hidden bg-[#18212f] p-8 text-white max-[980px]:min-h-[520px] max-[620px]:p-4">
          <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="relative grid h-full content-center gap-6">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-lg border border-white/12 bg-white/8 px-3 py-2 text-[12px] font-semibold text-white/72">
                Bảng vận hành
              </span>
              <span className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/8 px-3 py-2 text-[12px] font-semibold text-white/80">
                <Activity size={15} />
                24 phiên đang mở
              </span>
            </div>

            <div className="grid gap-4 rounded-[14px] border border-white/14 bg-white/[0.08] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.22)] backdrop-blur-md">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <span className="text-[12px] font-semibold text-white/58">Tổng quan hôm nay</span>
                  <h2 className="mt-1 text-[30px] font-bold leading-tight text-white max-sm:text-[26px]">
                    Thiết bị và phiếu kỹ thuật
                  </h2>
                </div>
                <span className="rounded-lg bg-[#edf8f2] px-2.5 py-1.5 text-[12px] font-bold text-[#1b7a4c]">
                  Ổn định
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 max-[620px]:grid-cols-1">
                <VisualMetric icon={<Wrench size={17} />} label="Phiếu mở" value="18" />
                <VisualMetric icon={<CalendarDays size={17} />} label="Lịch hôm nay" value="09" />
                <VisualMetric icon={<CheckCircle2 size={17} />} label="Đã xử lý" value="37" />
              </div>

              <div className="grid gap-2.5 pt-2">
                <VisualTask code="VM-2408" name="Bảo trì máy siêu âm" status="Đang xử lý" />
                <VisualTask code="VM-2412" name="Kiểm tra bàn giao thiết bị" status="Chờ duyệt" />
                <VisualTask code="VM-2418" name="Cập nhật hồ sơ khách hàng" status="Hoàn tất" muted />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_0.72fr] gap-4 max-[620px]:grid-cols-1">
              <div className="rounded-[14px] border border-white/12 bg-white/[0.07] p-4">
                <span className="text-[12px] font-semibold text-white/56">Tỷ lệ sẵn sàng</span>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <strong className="text-[42px] leading-none">92%</strong>
                  <span className="text-[12px] font-semibold text-white/60">+4.8%</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/12">
                  <span className="block h-full w-[92%] rounded-full bg-[#b9dfc9]" />
                </div>
              </div>
              <div className="rounded-[14px] border border-white/12 bg-white/[0.07] p-4">
                <span className="text-[12px] font-semibold text-white/56">Phạm vi</span>
                <div className="mt-4 grid gap-2 text-[13px] font-semibold text-white/78">
                  <span>Hà Nội</span>
                  <span>Đà Nẵng</span>
                  <span>TP. Hồ Chí Minh</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function VisualMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="grid min-h-[104px] gap-3 rounded-lg border border-white/10 bg-white/[0.08] p-3.5">
      <div className="flex items-center justify-between gap-3 text-white/72">
        <span className="text-[12px] font-semibold">{label}</span>
        {icon}
      </div>
      <strong className="text-[34px] leading-none text-white">{value}</strong>
    </div>
  );
}

function VisualTask({
  code,
  name,
  status,
  muted = false,
}: {
  code: string;
  name: string;
  status: string;
  muted?: boolean;
}) {
  return (
    <div className={`grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-white/10 px-3.5 py-3 max-sm:grid-cols-1 ${muted ? 'bg-white/[0.045] text-white/58' : 'bg-white/[0.08] text-white/82'}`}>
      <span className="text-[12px] font-bold">{code}</span>
      <span className="min-w-0 truncate text-[13px] font-semibold">{name}</span>
      <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-bold">{status}</span>
    </div>
  );
}

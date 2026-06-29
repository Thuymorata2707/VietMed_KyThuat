import { ChevronRight, ClipboardCheck, PackageSearch, ShieldCheck, Wrench } from 'lucide-react';
import { FormEvent, ReactNode, useState } from 'react';
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
      <section className="grid min-h-[calc(100vh-56px)] w-full max-w-[1360px] grid-cols-[minmax(390px,0.9fr)_minmax(0,1.1fr)] overflow-hidden rounded-[18px] border border-[#dde3ea] bg-white shadow-[0_28px_90px_rgba(28,39,56,0.13)] max-[980px]:min-h-[calc(100vh-32px)] max-[980px]:grid-cols-1">
        <div className="relative grid content-between gap-8 bg-white px-12 py-10 max-[980px]:px-8 max-[620px]:px-5 max-[620px]:py-6">
          <div className="flex items-center justify-between gap-4">
            <Brand size="large" />
            <span className="inline-flex min-h-8 items-center rounded-lg border border-[#b9dfc9] bg-[#edf8f2] px-2.5 text-[12px] font-semibold text-[#1b7a4c]">
              Online
            </span>
          </div>

          <div className="grid max-w-[480px] content-center gap-7 self-center justify-self-center py-10 max-[980px]:w-full max-[980px]:max-w-[560px] max-[620px]:py-6">
            <div className="grid gap-3">
              <span className="text-[12px] font-bold text-[#c91f2d]">VietMed Kỹ Thuật</span>
              <h1 className="max-w-[420px] text-[40px] font-bold leading-[1.06] text-[#18212f] max-sm:text-[32px]">
                Đăng nhập hệ thống kỹ thuật
              </h1>
              <p className="max-w-[430px] text-[15px] leading-7 text-[#647084]">
                Truy cập không gian quản lý thiết bị, lịch việc và phiếu dịch vụ nội bộ.
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

        <aside className="relative overflow-hidden bg-[#18212f] p-8 text-white max-[980px]:min-h-[420px] max-[620px]:p-5">
          <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="absolute inset-x-0 top-0 h-px bg-white/18" />
          <div className="absolute inset-y-0 left-0 w-px bg-white/12" />

          <div className="relative grid h-full content-center gap-8">
            <div className="max-w-[620px]">
              <span className="inline-flex rounded-lg border border-white/12 bg-white/8 px-3 py-2 text-[12px] font-semibold text-white/68">
                Không gian vận hành kỹ thuật
              </span>
              <h2 className="mt-5 max-w-[560px] text-[44px] font-bold leading-[1.04] text-white max-[980px]:text-[36px] max-sm:text-[30px]">
                Một nơi để theo dõi thiết bị và công việc kỹ thuật.
              </h2>
              <p className="mt-4 max-w-[520px] text-[15px] leading-7 text-white/66">
                Truy cập hồ sơ máy, phiếu dịch vụ và lịch bảo trì theo đúng phân quyền.
              </p>
            </div>

            <div className="grid max-w-[620px] grid-cols-3 gap-3 max-[620px]:grid-cols-1">
              <LoginFeature icon={<PackageSearch size={18} />} label="Hồ sơ thiết bị" />
              <LoginFeature icon={<Wrench size={18} />} label="Phiếu kỹ thuật" />
              <LoginFeature icon={<ClipboardCheck size={18} />} label="Lịch bảo trì" />
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function LoginFeature({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex min-h-[74px] items-center gap-3 rounded-lg border border-white/10 bg-white/[0.08] px-4 text-white/82 backdrop-blur-md">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
        {icon}
      </span>
      <span className="text-[13px] font-semibold">{label}</span>
    </div>
  );
}

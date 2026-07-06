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
    <main className="grid min-h-screen place-items-center overflow-hidden bg-[#fafafa] px-6 py-7 max-sm:px-4 max-sm:py-4">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(14,165,233,0.07),transparent_34%),radial-gradient(circle_at_88%_14%,rgba(191,219,254,0.62),transparent_31%),linear-gradient(135deg,#fafafa,#fafafa_58%,#f4f4f5)]" />
      <section className="relative grid min-h-[calc(100vh-56px)] w-full max-w-[1360px] grid-cols-[minmax(390px,0.9fr)_minmax(0,1.1fr)] overflow-hidden rounded-[28px] border border-[#e4e4e7] bg-white/90 shadow-[0_30px_90px_rgba(24,24,27,0.13)] backdrop-blur-xl max-[980px]:min-h-[calc(100vh-32px)] max-[980px]:grid-cols-1">
        <div className="relative grid content-between gap-8 bg-white/92 px-12 py-10 max-[980px]:px-8 max-[620px]:px-5 max-[620px]:py-6">
          <div className="flex items-center justify-between gap-4">
            <Brand size="large" />
            <span className="inline-flex min-h-8 items-center rounded-xl border border-[#b9e8ca] bg-[#eefaf3] px-2.5 text-[12px] font-bold text-[#177245]">
              Online
            </span>
          </div>

          <div className="grid max-w-[480px] content-center gap-7 self-center justify-self-center py-10 max-[980px]:w-full max-[980px]:max-w-[560px] max-[620px]:py-6">
            <div className="grid gap-3">
              <span className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[#18181b]">VietMed Kỹ Thuật</span>
              <h1 className="max-w-[420px] text-[42px] font-extrabold leading-[1.04] text-[#1f1f1f] max-sm:text-[32px]">
                Đăng nhập hệ thống kỹ thuật
              </h1>
              <p className="max-w-[430px] text-[15px] leading-7 text-[#666666]">
                Quản lý thiết bị, lịch việc và phiếu dịch vụ.
              </p>
            </div>

            <form className="grid gap-4 rounded-[24px] border border-[#e4e4e7] bg-[#ffffff] p-4 shadow-[0_8px_24px_rgba(24,24,27,0.05)]" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-[13px] font-bold text-[#333333]">
                Email
                <input
                  className="min-h-[52px] rounded-2xl border border-[#ded8d8] bg-[#ffffff] px-4 text-sm font-semibold text-[#1f1f1f] outline-none transition placeholder:text-[#98a3b4] hover:border-[#e4e4e7] focus:border-[#18181b] focus:bg-white focus:shadow-[0_0_0_4px_rgba(24,24,27,0.12)]"
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@vietmed.com.vn"
                  type="email"
                  value={email}
                />
              </label>
              <label className="grid gap-2 text-[13px] font-bold text-[#333333]">
                Mật khẩu
                <input
                  className="min-h-[52px] rounded-2xl border border-[#ded8d8] bg-[#ffffff] px-4 text-sm font-semibold text-[#1f1f1f] outline-none transition placeholder:text-[#98a3b4] hover:border-[#e4e4e7] focus:border-[#18181b] focus:bg-white focus:shadow-[0_0_0_4px_rgba(24,24,27,0.12)]"
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nhập mật khẩu"
                  type="password"
                  value={password}
                />
              </label>
              {error ? (
                <p className="rounded-2xl border border-[#fecdd3] bg-[#fff1f3] px-3.5 py-3 text-[14px] font-bold leading-5 text-[#b5121b]">
                  {error}
                </p>
              ) : null}
              <button
                className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(180deg,#18181b,#18181b)] px-[18px] font-bold text-white shadow-[0_18px_34px_rgba(24,24,27,0.24),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:-translate-y-px hover:bg-[#09090b] disabled:hover:translate-y-0"
                disabled={loginMutation.isPending}
                type="submit"
              >
                {loginMutation.isPending ? 'Đang đăng nhập' : 'Đăng nhập'}
                <ChevronRight size={18} />
              </button>
            </form>

            <div className="grid gap-2 border-t border-[#e4e4e7] pt-5 text-[13px] leading-5 text-[#666666]">
                <span className="inline-flex items-center gap-2 font-bold text-[#333333]">
                  <ShieldCheck size={16} />
                  Dành cho nhân sự được phân quyền
                </span>
                <span>Dữ liệu bảo vệ theo vai trò.</span>
            </div>
          </div>

          <span className="text-[12px] font-semibold text-[#8a8a8a]">VietMed Ky Thuat · Internal workspace</span>
        </div>

        <aside className="relative overflow-hidden bg-[#f4f4f5] p-8 text-[#1f1f1f] max-[980px]:min-h-[420px] max-[620px]:p-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(37,99,235,0.11),transparent_28%),radial-gradient(circle_at_82%_78%,rgba(228,228,231,0.50),transparent_36%),linear-gradient(135deg,#fafafa,#f4f4f5_48%,#fafafa)]" />
          <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(24,24,27,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(24,24,27,0.045)_1px,transparent_1px)] [background-size:34px_34px]" />
          <div className="absolute inset-x-0 top-0 h-px bg-[#e4e4e7]" />
          <div className="absolute inset-y-0 left-0 w-px bg-[#e4e4e7]" />

          <div className="relative grid h-full content-center gap-8">
            <div className="max-w-[620px]">
              <span className="inline-flex rounded-xl border border-[#e4e4e7] bg-white/75 px-3 py-2 text-[12px] font-bold text-[#18181b] backdrop-blur">
                Không gian vận hành kỹ thuật
              </span>
              <h2 className="mt-5 max-w-[560px] text-[46px] font-extrabold leading-[1.03] text-[#1f1f1f] max-[980px]:text-[36px] max-sm:text-[30px]">
                Theo dõi thiết bị và công việc kỹ thuật.
              </h2>
              <p className="mt-4 max-w-[520px] text-[15px] font-semibold leading-7 text-[#666666]">
                Hồ sơ máy, phiếu dịch vụ và lịch bảo trì.
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
    <div className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-[#e4e4e7] bg-white/78 px-4 text-[#333333] shadow-[0_14px_34px_rgba(24,24,27,0.08)] backdrop-blur-md">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f4f4f5] text-[#18181b]">
        {icon}
      </span>
      <span className="text-[13px] font-bold">{label}</span>
    </div>
  );
}

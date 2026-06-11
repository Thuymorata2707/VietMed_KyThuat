import { ChevronRight } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiUser, login } from '../../api';
import { getRoleName, homePathForRole } from '../../auth/roles';
import { Brand } from '../../components/Brand';

type LoginPageProps = {
  onLogin: (user: ApiUser) => void;
};

export function LoginPage({ onLogin }: LoginPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const signedInUser = await login(email, password);
      onLogin(signedInUser);
      navigate(homePathForRole(getRoleName(signedInUser)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef2f6] p-[22px] max-[980px]:p-3.5">
      <section className="grid min-h-[calc(100vh-44px)] w-[min(100%,1460px)] max-w-[1460px] grid-cols-[minmax(420px,0.95fr)_minmax(520px,1.05fr)] overflow-hidden rounded-[28px] border border-[#dfe7ef] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)] max-[980px]:min-h-[calc(100vh-28px)] max-[980px]:grid-cols-1">
        <div className="grid w-full max-w-[520px] content-center gap-6 justify-self-center bg-white p-12 max-[980px]:max-w-[620px] max-[980px]:px-6 max-[980px]:py-9">
          <div>
            <Brand compact size="large" />
          </div>
          <div className="grid gap-2">
            <span className="text-[13px] font-semibold uppercase text-[#c92a1f]">VietMed service</span>
            <h1 className="text-[38px] font-bold leading-[1.12] text-[#17202a] max-[560px]:text-[28px]">Đăng nhập</h1>
            <p className="leading-relaxed text-[#657384]">Truy cập hệ thống điều phối kỹ thuật và dịch vụ sau bán hàng.</p>
          </div>

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-2 font-medium text-[#405064]">
              Email
              <input className="min-h-12 rounded-xl border border-[#e2e8f0] bg-white px-[18px] text-[#17202a] outline-none focus:border-[#e6aaa5] focus:shadow-[0_0_0_4px_rgba(201,42,31,0.08)]" autoComplete="email" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
            </label>
            <label className="grid gap-2 font-medium text-[#405064]">
              Mật khẩu
              <input
                className="min-h-12 rounded-xl border border-[#e2e8f0] bg-white px-[18px] text-[#17202a] outline-none focus:border-[#e6aaa5] focus:shadow-[0_0_0_4px_rgba(201,42,31,0.08)]"
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            {error ? <p className="rounded-lg border border-[#fecdd3] bg-[#fff1f3] px-3 py-2.5 font-medium text-[#b42318]">{error}</p> : null}
            <button className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-[#d83a30] px-[18px] font-semibold text-white shadow-[0_10px_22px_rgba(201,42,31,0.14)] hover:bg-[#c92a1f]" disabled={submitting} type="submit">
              {submitting ? 'Đang đăng nhập' : 'Đăng nhập'}
              <ChevronRight size={18} />
            </button>
          </form>
          <p className="mt-1 text-[13px] leading-relaxed text-[#657384]">Truy cập dành cho nhân sự VietMed được phân quyền.</p>
        </div>

        <aside className="relative grid overflow-hidden bg-[linear-gradient(145deg,rgba(217,45,32,0.9)_0%,rgba(180,35,24,0.86)_50%,rgba(104,31,27,0.88)_100%)] p-7 before:absolute before:inset-0 before:bg-[linear-gradient(120deg,rgba(255,255,255,0.2),transparent_48%)] before:opacity-85 after:absolute after:right-[-190px] after:top-[-130px] after:h-[520px] after:w-[520px] after:rounded-full after:border after:border-white/10 max-[980px]:min-h-[420px] max-[980px]:p-6 max-[560px]:min-h-[340px] max-[560px]:p-3.5">
          <div className="relative z-[1] grid min-h-full w-full content-center rounded-3xl border border-white/15 bg-white/5 p-14 text-white shadow-[0_28px_70px_rgba(74,16,13,0.22)] after:absolute after:bottom-14 after:left-14 after:h-px after:w-28 after:bg-white/10 after:content-[''] max-[980px]:min-h-[372px] max-[980px]:p-8 max-[980px]:after:bottom-8 max-[980px]:after:left-8 max-[560px]:min-h-[312px] max-[560px]:rounded-[18px] max-[560px]:px-5 max-[560px]:py-6 max-[560px]:after:bottom-6 max-[560px]:after:left-5 max-[560px]:after:w-[84px]">
            <div className="grid max-w-[560px] gap-4">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-white/70">VietMed Technical Service</span>
              <h2 className="max-w-[560px] text-[46px] font-semibold leading-[1.08] text-white max-[980px]:text-4xl max-[560px]:text-[30px]">Hệ thống quản lý kỹ thuật nội bộ</h2>
              <p className="max-w-[500px] text-base leading-relaxed text-white/70">Theo dõi thiết bị, lịch bảo trì, phiếu sửa chữa và phân công kỹ sư trong một không gian làm việc rõ ràng.</p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

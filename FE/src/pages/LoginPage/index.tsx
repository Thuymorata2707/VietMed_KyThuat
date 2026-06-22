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
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6f9] p-[22px] max-[980px]:p-3.5">
      <section className="grid min-h-[calc(100vh-44px)] w-[min(100%,1460px)] max-w-[1460px] grid-cols-[minmax(420px,0.92fr)_minmax(520px,1.08fr)] overflow-hidden rounded-2xl border border-[#d9e1ea] bg-white shadow-[0_24px_70px_rgba(20,32,51,0.12)] max-[980px]:min-h-[calc(100vh-28px)] max-[980px]:grid-cols-1">
        <div className="grid w-full max-w-[520px] content-center gap-6 justify-self-center bg-white p-12 max-[980px]:max-w-[620px] max-[980px]:px-6 max-[980px]:py-9">
          <div>
            <Brand compact size="large" />
          </div>
          <div className="grid gap-2">
            <span className="text-[12px] font-medium text-[#c83f34]">VietMed service</span>
            <h1 className="text-[34px] font-medium leading-[1.14] text-[#142033] max-[560px]:text-[28px]">Đăng nhập</h1>
            <p className="text-[15px] leading-6 text-[#657386]">Truy cập hệ thống điều phối kỹ thuật và dịch vụ sau bán hàng.</p>
          </div>

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-[13px] font-medium text-[#334155]">
              Email
              <input className="min-h-12 rounded-lg border border-[#cbd5e1] bg-white px-[15px] text-[#142033] outline-none placeholder:text-[#7b8797] focus:border-[#c83f34] focus:shadow-[0_0_0_4px_rgba(200,63,52,0.10)]" autoComplete="email" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
            </label>
            <label className="grid gap-2 text-[13px] font-medium text-[#334155]">
              Mật khẩu
              <input
                className="min-h-12 rounded-lg border border-[#cbd5e1] bg-white px-[15px] text-[#142033] outline-none placeholder:text-[#7b8797] focus:border-[#c83f34] focus:shadow-[0_0_0_4px_rgba(200,63,52,0.10)]"
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            {error ? <p className="rounded-lg border border-[#fecdd3] bg-[#fff1f3] px-3 py-2.5 font-medium text-[#a3342b]">{error}</p> : null}
            <button className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg bg-[#c83f34] px-[18px] font-medium text-white shadow-[0_10px_22px_rgba(180,35,24,0.16)] hover:bg-[#a3342b]" disabled={submitting} type="submit">
              {submitting ? 'Đang đăng nhập' : 'Đăng nhập'}
              <ChevronRight size={18} />
            </button>
          </form>
          <p className="mt-1 text-[13px] leading-6 text-[#657386]">Truy cập dành cho nhân sự VietMed được phân quyền.</p>
        </div>

        <aside className="relative grid overflow-hidden bg-[#202939] p-7 max-[980px]:min-h-[420px] max-[980px]:p-6 max-[560px]:min-h-[340px] max-[560px]:p-3.5">
          <div className="relative z-[1] grid min-h-full w-full content-center rounded-lg border border-white/10 bg-[#263244] p-14 text-white shadow-[0_28px_70px_rgba(20,32,51,0.24)] max-[980px]:min-h-[372px] max-[980px]:p-8 max-[560px]:min-h-[312px] max-[560px]:px-5 max-[560px]:py-6">
            <div className="grid max-w-[620px] gap-5">
              <span className="text-[12px] font-medium text-white/65">VietMed Technical Service</span>
              <h2 className="max-w-[580px] text-[40px] font-medium leading-[1.12] text-white max-[980px]:text-4xl max-[560px]:text-[30px]">Quản lý thiết bị, lịch việc và phân công kỹ thuật</h2>
              <p className="max-w-[540px] text-[15px] leading-7 text-white/72">Một không gian làm việc rõ ràng cho kỹ sư hiện trường, điều phối và admin: biết việc nào cần làm, ai phụ trách và dữ liệu nào cần xác nhận.</p>
              <div className="grid grid-cols-3 gap-3 pt-3 max-[560px]:grid-cols-1">
                <span className="rounded-lg border border-white/10 bg-white/8 px-3 py-3 text-sm font-semibold text-white/82">Ticket dịch vụ</span>
                <span className="rounded-lg border border-white/10 bg-white/8 px-3 py-3 text-sm font-semibold text-white/82">Lịch bảo trì</span>
                <span className="rounded-lg border border-white/10 bg-white/8 px-3 py-3 text-sm font-semibold text-white/82">Kho thiết bị</span>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

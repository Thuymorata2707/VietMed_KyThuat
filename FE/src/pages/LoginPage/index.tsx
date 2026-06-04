import { ChevronRight } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiUser, login } from '../../api';
import { getRoleName, homePathForRole } from '../../auth/roles';
import { Brand } from '../../components/Brand';
import './styles.css';

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
    <main className="login-page">
      <section className="login-shell">
        <div className="login-panel">
          <div className="login-brand">
            <Brand compact size="large" />
          </div>
          <div className="login-copy">
            <span>VietMed service</span>
            <h1>Đăng nhập</h1>
            <p>Truy cập hệ thống điều phối kỹ thuật và dịch vụ sau bán hàng.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              Email
              <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
            </label>
            <label>
              Mật khẩu
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? 'Đang đăng nhập' : 'Đăng nhập'}
              <ChevronRight size={18} />
            </button>
          </form>
          <p className="login-footnote">Truy cập dành cho nhân sự VietMed được phân quyền.</p>
        </div>

        <aside className="login-hero">
          <div className="hero-card">
            <div className="hero-copy">
              <span>VietMed Technical Service</span>
              <h2>Hệ thống quản lý kỹ thuật nội bộ</h2>
              <p>Theo dõi thiết bị, lịch bảo trì, phiếu sửa chữa và phân công kỹ sư trong một không gian làm việc rõ ràng.</p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  History,
  Loader2,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Users,
  Wrench,
} from 'lucide-react';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';
import { AdminShortcut } from '../../components/AdminShortcut';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { StatusPanel } from '../../components/StatusPanel';
import './styles.css';

type Summary = Record<string, number>;

const dashboardHeroImage = 'https://www.alpinion.com/uploadImage/product/202403/1709107396000000006.png';

export function DashboardPage({ role }: { role: RoleName }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    void loadSummary();
  }, []);

  async function loadSummary() {
    setLoading(true);
    setError('');

    try {
      setSummary(await apiFetch<Summary>('/dashboard/summary'));
      setLastUpdatedAt(new Date().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dashboard');
    } finally {
      setLoading(false);
    }
  }

  const activeMachines = summary?.activeMachines ?? 0;
  const totalMachines = summary?.totalMachines ?? 0;
  const healthScore = totalMachines > 0 ? Math.round((activeMachines / totalMachines) * 100) : 0;

  const heroSignals = useMemo(
    () => [
      {
        label: 'Khách hàng hoạt động',
        value: summary?.activeCustomers ?? 0,
      },
      {
        label: 'Sửa chữa đang xử lý',
        value: summary?.inProgressRepairs ?? 0,
      },
      {
        label: 'Bảo trì quá hạn',
        value: summary?.overdueMaintenances ?? 0,
      },
    ],
    [summary],
  );

  const cards = useMemo(
    () => [
      {
        label: 'Khách hàng',
        value: summary?.totalCustomers,
        detail: `${summary?.activeCustomers ?? 0} đang hoạt động`,
        icon: <Building2 />,
        tone: 'neutral' as const,
      },
      {
        label: 'Thiết bị',
        value: summary?.totalMachines,
        detail: `${summary?.machinesInstalledInventory ?? 0} đã lắp`,
        icon: <Stethoscope />,
        tone: 'good' as const,
      },
      {
        label: 'Sửa chữa',
        value: summary?.totalRepairs,
        detail: `${summary?.inProgressRepairs ?? 0} đang xử lý`,
        icon: <Wrench />,
        tone: (summary?.inProgressRepairs ?? 0) > 0 ? ('warn' as const) : ('neutral' as const),
      },
      {
        label: 'Bảo trì',
        value: summary?.totalMaintenances,
        detail: `${summary?.overdueMaintenances ?? 0} quá hạn`,
        icon: <ClipboardCheck />,
        tone: (summary?.overdueMaintenances ?? 0) > 0 ? ('danger' as const) : ('good' as const),
      },
    ],
    [summary],
  );

  const attentionItems = [
    {
      label: 'Bảo trì quá hạn',
      value: summary?.overdueMaintenances,
      detail: 'Cần kiểm tra lịch và phân công xử lý',
      tone: (summary?.overdueMaintenances ?? 0) > 0 ? 'danger' : 'good',
    },
    {
      label: 'Sửa chữa chờ nhận',
      value: summary?.pendingRepairs,
      detail: 'Phiếu mới cần điều phối kỹ sư',
      tone: (summary?.pendingRepairs ?? 0) > 0 ? 'warn' : 'good',
    },
    {
      label: 'Máy đang sửa',
      value: summary?.machinesRepairing,
      detail: 'Theo dõi tiến độ và phản hồi khách hàng',
      tone: (summary?.machinesRepairing ?? 0) > 0 ? 'warn' : 'good',
    },
    {
      label: 'Thiết bị chờ xác nhận',
      value: summary?.pendingReviewMachines,
      detail: 'Dữ liệu kỹ sư tạo cần admin kiểm tra',
      tone: (summary?.pendingReviewMachines ?? 0) > 0 ? 'warn' : 'good',
    },
  ];

  return (
    <PageFrame>
      <div className="dashboard-heading">
        <PageTitle
          eyebrow={role === 'admin' ? 'Admin console' : 'Trung tâm điều hành'}
          title={role === 'admin' ? 'Tổng quan quản trị' : 'Tổng quan kỹ thuật'}
          description={
            role === 'admin'
              ? 'Theo dõi vận hành kỹ thuật, dữ liệu nền, nhân sự và các luồng công việc cần xử lý.'
              : 'Các chỉ số chính về khách hàng, thiết bị, sửa chữa và bảo trì từ backend.'
          }
        />
        <button className="secondary-button dashboard-refresh" disabled={loading} onClick={loadSummary} type="button">
          {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
          {loading ? 'Đang tải' : 'Tải lại'}
        </button>
      </div>

      {error ? <Notice message={error} /> : null}

      <div className="dashboard-hero-shell">
        <section className="dashboard-hero">
          <div className="hero-copy">
            <div className="hero-kicker">
              <CalendarDays size={16} />
              Trung tâm điều hành
            </div>
            <h2>Vận hành thiết bị y tế theo một bảng điều khiển rõ ràng.</h2>
            <p>
              Theo dõi tình trạng máy, lịch bảo trì, phiếu sửa chữa và phân công kỹ sư trong một bố cục tập trung, dễ quét và dễ ra quyết định.
            </p>
            <div className="hero-actions">
              <Link className="primary-link" to="/service-tickets">
                Sửa chữa / Bảo trì
                <ArrowUpRight size={16} />
              </Link>
              <Link className="secondary-link" to="/machines">
                Xem thiết bị
              </Link>
            </div>
            <div className="hero-meta">
              <span>
                <strong>{loading ? '-' : `${healthScore}%`}</strong>
                Sức khỏe đội máy
              </span>
              <span>
                <strong>{lastUpdatedAt ?? '-'}</strong>
                Cập nhật gần nhất
              </span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-visual-frame">
              <img alt="Thiết bị y tế" src={dashboardHeroImage} />
            </div>
            <div className="hero-visual-summary">
              {heroSignals.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{loading ? '-' : item.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-strip">
            <div>
              <span>Sửa chữa chờ nhận</span>
              <strong>{loading ? '-' : summary?.pendingRepairs ?? 0}</strong>
            </div>
            <div>
              <span>Bảo trì sắp tới</span>
              <strong>{loading ? '-' : summary?.upcomingMaintenances ?? 0}</strong>
            </div>
            <div>
              <span>Máy hoạt động</span>
              <strong>{loading ? '-' : summary?.activeMachines ?? 0}</strong>
            </div>
          </div>
        </section>

        <aside className="dashboard-side">
          <section className="health-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Health score</span>
                <h2>Tình trạng đội máy</h2>
              </div>
              <CheckCircle2 size={20} />
            </div>
            <div className="health-score">
              <strong>{loading ? '-' : `${healthScore}%`}</strong>
              <span>{activeMachines}/{totalMachines} thiết bị đang hoạt động</span>
            </div>
            <div className="health-track">
              <span style={{ width: `${healthScore}%` }} />
            </div>
            <div className="health-breakdown">
              <span>Bảo trì: {summary?.machinesInMaintenance ?? 0}</span>
              <span>Đang sửa: {summary?.machinesRepairing ?? 0}</span>
              <span>Ngưng: {summary?.inactiveMachines ?? 0}</span>
            </div>
          </section>

          <section className="quick-list-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Ưu tiên xử lý</span>
                <h2>Việc cần chú ý</h2>
              </div>
              <span className={attentionItems.some((item) => item.tone !== 'good') ? 'panel-badge warn' : 'panel-badge good'}>
                {attentionItems.some((item) => item.tone !== 'good') ? 'Cần theo dõi' : 'Ổn định'}
              </span>
            </div>
            <div className="attention-list">
              {attentionItems.map((item) => (
                <AttentionRow detail={item.detail} key={item.label} label={item.label} loading={loading} tone={item.tone} value={item.value} />
              ))}
            </div>
          </section>
        </aside>
      </div>

      <div className="metric-grid">
        {cards.map((card) => (
          <MetricCard detail={card.detail} icon={card.icon} key={card.label} label={card.label} loading={loading} tone={card.tone} value={card.value} />
        ))}
      </div>

      <div className="dashboard-main-grid">
        <StatusPanel
          title="Trạng thái thiết bị"
          items={[
            ['Hoạt động', summary?.activeMachines],
            ['Bảo trì', summary?.machinesInMaintenance],
            ['Đang sửa', summary?.machinesRepairing],
            ['Ngưng hoạt động', summary?.inactiveMachines],
          ]}
        />
        <StatusPanel
          title="Luồng công việc"
          items={[
            ['Sửa chữa chờ nhận', summary?.pendingRepairs],
            ['Sửa chữa đang xử lý', summary?.inProgressRepairs],
            ['Bảo trì sắp tới', summary?.upcomingMaintenances],
            ['Bảo trì quá hạn', summary?.overdueMaintenances],
          ]}
        />
      </div>

      {role === 'admin' ? (
        <section className="admin-command">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Quản trị hệ thống</span>
              <h2>Thao tác nhanh</h2>
            </div>
          </div>
          <div className="admin-grid">
            <AdminShortcut to="/users" icon={<Users size={19} />} title="Nhân sự" detail="Tài khoản, vai trò, khu vực và trạng thái." />
            <AdminShortcut to="/machines" icon={<Stethoscope size={19} />} title="Cần xác nhận" detail={`${summary?.pendingReviewMachines ?? 0} thiết bị kỹ sư tạo cần kiểm tra.`} />
            <AdminShortcut to="/roles" icon={<ShieldCheck size={19} />} title="Vai trò" detail="Role dùng cho phân quyền backend." />
            <AdminShortcut to="/regions" icon={<MapPinned size={19} />} title="Khu vực" detail="Scope dữ liệu cho manager và kỹ sư." />
            <AdminShortcut to="/audit-logs" icon={<History size={19} />} title="Audit log" detail="Theo dõi thay đổi quan trọng." />
          </div>
        </section>
      ) : null}
    </PageFrame>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  loading,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value?: number;
  detail: string;
  loading: boolean;
  tone: 'neutral' | 'good' | 'warn' | 'danger';
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{loading ? '-' : value ?? '-'}</strong>
      <small>{detail}</small>
    </article>
  );
}

function AttentionRow({
  label,
  value,
  detail,
  tone,
  loading,
}: {
  label: string;
  value?: number;
  detail: string;
  tone: string;
  loading: boolean;
}) {
  const isGood = tone === 'good';

  return (
    <div className="attention-row">
      <div className={isGood ? 'attention-icon good' : 'attention-icon warn'}>
        {isGood ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      </div>
      <div className="attention-copy">
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <b>{loading ? '-' : value ?? 0}</b>
    </div>
  );
}

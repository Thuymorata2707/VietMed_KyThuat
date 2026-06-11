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
      <div className="flex items-start justify-between gap-4 max-[860px]:flex-col">
        <PageTitle
          eyebrow={role === 'admin' ? 'Admin console' : 'Trung tâm điều hành'}
          title={role === 'admin' ? 'Tổng quan quản trị' : 'Tổng quan kỹ thuật'}
          description={
            role === 'admin'
              ? 'Theo dõi vận hành kỹ thuật, dữ liệu nền, nhân sự và các luồng công việc cần xử lý.'
              : 'Các chỉ số chính về khách hàng, thiết bị, sửa chữa và bảo trì từ backend.'
          }
        />
        <button className="secondary-button shrink-0 max-[860px]:self-start" disabled={loading} onClick={loadSummary} type="button">
          {loading ? <Loader2 className="spin-icon" size={17} /> : <RefreshCw size={17} />}
          {loading ? 'Đang tải' : 'Tải lại'}
        </button>
      </div>

      {error ? <Notice message={error} /> : null}

      <div className="grid grid-cols-[minmax(0,1.38fr)_minmax(360px,0.62fr)] gap-4 max-[1180px]:grid-cols-2 max-[860px]:grid-cols-1">
        <section className="relative grid grid-cols-[minmax(0,1.04fr)_minmax(320px,0.96fr)] overflow-hidden rounded-lg border border-[#e3eaf2] bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(255,250,249,0.98)_54%,rgba(246,248,252,0.98)_100%)] text-[#17202a] shadow-[0_12px_30px_rgba(15,23,42,0.06)] before:absolute before:inset-0 before:bg-[linear-gradient(90deg,rgba(201,42,31,0.08),transparent_34%)] after:absolute after:inset-0 after:bg-[linear-gradient(rgba(148,163,184,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.1)_1px,transparent_1px)] after:bg-[length:42px_42px] after:bg-[-1px_-1px] after:opacity-70 max-[1180px]:col-span-full max-[1180px]:grid-cols-2 max-[860px]:grid-cols-1">
          <div className="relative z-[1] grid content-center gap-3.5 px-[30px] py-8 pr-[22px] max-[860px]:px-[18px]">
            <div className="inline-flex min-h-[30px] w-fit items-center gap-2 rounded-full border border-[#f3c3be] bg-[#fff5f4] px-[11px] text-xs font-semibold text-[#c92a1f]">
              <CalendarDays size={16} />
              Trung tâm điều hành
            </div>
            <h2 className="max-w-[560px] text-[31px] font-bold leading-[1.14] text-[#111827] max-[860px]:text-[27px] max-sm:text-2xl">Vận hành thiết bị y tế theo một bảng điều khiển rõ ràng.</h2>
            <p className="max-w-[560px] text-sm leading-relaxed text-[#657384]">
              Theo dõi tình trạng máy, lịch bảo trì, phiếu sửa chữa và phân công kỹ sư trong một bố cục tập trung, dễ quét và dễ ra quyết định.
            </p>
            <div className="flex flex-wrap gap-2.5 max-sm:flex-col">
              <Link className="inline-flex min-h-10 min-w-[164px] items-center justify-center gap-2 rounded-lg bg-[#c92a1f] px-3.5 font-semibold text-white shadow-[0_10px_22px_rgba(201,42,31,0.22)] hover:-translate-y-px hover:bg-[#a61f17] max-sm:w-full" to="/service-tickets">
                Sửa chữa / Bảo trì
                <ArrowUpRight size={16} />
              </Link>
              <Link className="inline-flex min-h-10 min-w-[132px] items-center justify-center gap-2 rounded-lg border border-[#e3eaf2] bg-white px-3.5 font-semibold text-[#405064] hover:-translate-y-px hover:border-[#f3c3be] hover:text-[#c92a1f] max-sm:w-full" to="/machines">
                Xem thiết bị
              </Link>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2.5 max-[860px]:grid-cols-1">
              <span className="grid min-h-[72px] gap-1 rounded-lg border border-[#eef2f7] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] text-[#657384]">
                <strong className="text-base font-bold text-[#17202a]">{loading ? '-' : `${healthScore}%`}</strong>
                Sức khỏe đội máy
              </span>
              <span className="grid min-h-[72px] gap-1 rounded-lg border border-[#eef2f7] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] text-[#657384]">
                <strong className="text-[13px] font-bold leading-snug text-[#17202a]">{lastUpdatedAt ?? '-'}</strong>
                Cập nhật gần nhất
              </span>
            </div>
          </div>

          <div className="relative z-[1] grid content-center gap-3.5 bg-white/60 py-[18px] pr-[18px] max-[1180px]:p-[18px]">
            <div className="flex min-h-80 items-end justify-center overflow-hidden rounded-lg border border-[#eef2f7] bg-[linear-gradient(180deg,#ffffff,#f8fafc)] px-3.5 pt-4 max-[1180px]:min-h-[280px] max-[860px]:min-h-60">
              <img alt="Thiết bị y tế" className="max-h-[360px] max-w-[116%] translate-y-[18px] scale-[1.08] object-contain drop-shadow-[0_26px_28px_rgba(15,23,42,0.16)]" src={dashboardHeroImage} />
            </div>
            <div className="grid grid-cols-3 gap-2.5 pr-0.5 max-[860px]:grid-cols-1">
              {heroSignals.map((item) => (
                <div className="grid min-h-[78px] gap-1 rounded-lg border border-[#eef2f7] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]" key={item.label}>
                  <span className="text-xs text-[#657384]">{item.label}</span>
                  <strong className="text-2xl font-bold text-[#17202a]">{loading ? '-' : item.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-[1] col-span-full grid grid-cols-3 bg-white/75 max-[860px]:grid-cols-1">
            <div className="grid min-h-[86px] content-center gap-1 border-t border-[#eef2f7] px-[18px] py-3.5">
              <span className="text-xs text-[#657384]">Sửa chữa chờ nhận</span>
              <strong className="text-[22px] font-bold text-[#17202a]">{loading ? '-' : summary?.pendingRepairs ?? 0}</strong>
            </div>
            <div className="grid min-h-[86px] content-center gap-1 border-l border-t border-[#eef2f7] px-[18px] py-3.5 max-[860px]:border-l-0">
              <span className="text-xs text-[#657384]">Bảo trì sắp tới</span>
              <strong className="text-[22px] font-bold text-[#17202a]">{loading ? '-' : summary?.upcomingMaintenances ?? 0}</strong>
            </div>
            <div className="grid min-h-[86px] content-center gap-1 border-l border-t border-[#eef2f7] px-[18px] py-3.5 max-[860px]:border-l-0">
              <span className="text-xs text-[#657384]">Máy hoạt động</span>
              <strong className="text-[22px] font-bold text-[#17202a]">{loading ? '-' : summary?.activeMachines ?? 0}</strong>
            </div>
          </div>
        </section>

        <aside className="grid gap-4 max-[1180px]:col-span-full max-[1180px]:grid-cols-2 max-[860px]:grid-cols-1">
          <section className="rounded-lg border border-[#e3eaf2] bg-white p-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-px hover:border-[#d7e0eb] hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-extrabold uppercase text-[#657384]">Health score</span>
                <h2 className="mt-1 text-lg font-bold">Tình trạng đội máy</h2>
              </div>
              <CheckCircle2 size={20} />
            </div>
            <div className="mt-[18px] grid gap-1">
              <strong className="text-4xl leading-none">{loading ? '-' : `${healthScore}%`}</strong>
              <span className="text-[13px] text-[#657384]">{activeMachines}/{totalMachines} thiết bị đang hoạt động</span>
            </div>
            <div className="mt-3.5 h-2.5 overflow-hidden rounded-full bg-[#edf1f6]">
              <span className="block h-full rounded-full bg-[linear-gradient(90deg,#027a48,#2ecc71)]" style={{ width: `${healthScore}%` }} />
            </div>
            <div className="mt-3.5 flex flex-wrap gap-x-3.5 gap-y-2.5 text-[#405064]">
              <span>Bảo trì: {summary?.machinesInMaintenance ?? 0}</span>
              <span>Đang sửa: {summary?.machinesRepairing ?? 0}</span>
              <span>Ngưng: {summary?.inactiveMachines ?? 0}</span>
            </div>
          </section>

          <section className="rounded-lg border border-[#e3eaf2] bg-white p-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-px hover:border-[#d7e0eb] hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-extrabold uppercase text-[#657384]">Ưu tiên xử lý</span>
                <h2 className="mt-1 text-lg font-bold">Việc cần chú ý</h2>
              </div>
              <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-bold ${attentionItems.some((item) => item.tone !== 'good') ? 'bg-[#fff7ed] text-[#b54708]' : 'bg-[#ecfdf3] text-[#027a48]'}`}>
                {attentionItems.some((item) => item.tone !== 'good') ? 'Cần theo dõi' : 'Ổn định'}
              </span>
            </div>
            <div className="mt-[18px] grid gap-2.5">
              {attentionItems.map((item) => (
                <AttentionRow detail={item.detail} key={item.label} label={item.label} loading={loading} tone={item.tone} value={item.value} />
              ))}
            </div>
          </section>
        </aside>
      </div>

      <div className="grid grid-cols-4 gap-3 max-[1180px]:grid-cols-2 max-[860px]:grid-cols-1">
        {cards.map((card) => (
          <MetricCard detail={card.detail} icon={card.icon} key={card.label} label={card.label} loading={loading} tone={card.tone} value={card.value} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 max-[1180px]:grid-cols-2 max-[860px]:grid-cols-1">
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
        <section className="grid gap-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-extrabold uppercase text-[#657384]">Quản trị hệ thống</span>
              <h2 className="mt-1 text-lg font-bold">Thao tác nhanh</h2>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 max-[1180px]:grid-cols-2 max-[860px]:grid-cols-1">
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
    <article className={`relative grid min-h-[148px] gap-2 rounded-lg border border-[#e3eaf2] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-l-lg hover:-translate-y-px hover:border-[#d7e0eb] hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)] ${metricToneClass(tone).bar}`}>
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${metricToneClass(tone).icon}`}>{icon}</div>
      <span className="text-[13px] font-semibold text-[#657384]">{label}</span>
      <strong className="text-3xl leading-none text-[#17202a]">{loading ? '-' : value ?? '-'}</strong>
      <small className="leading-snug text-[#657384]">{detail}</small>
    </article>
  );
}

function metricToneClass(tone: 'neutral' | 'good' | 'warn' | 'danger') {
  if (tone === 'good') return { bar: 'before:bg-[#027a48]', icon: 'bg-[#ecfdf3] text-[#027a48]' };
  if (tone === 'warn') return { bar: 'before:bg-[#b54708]', icon: 'bg-[#fff7ed] text-[#b54708]' };
  if (tone === 'danger') return { bar: 'before:bg-[#b42318]', icon: 'bg-[#fff1f3] text-[#b42318]' };
  return { bar: 'before:bg-[#c92a1f]', icon: 'bg-[#fff5f4] text-[#c92a1f]' };
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
    <div className="grid min-h-16 grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#e5ebf2] bg-white px-[13px] py-3 transition hover:-translate-y-px hover:border-[#d7e0eb] hover:bg-[#fbfdff] max-sm:grid-cols-[36px_minmax(0,1fr)]">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${isGood ? 'bg-[#ecfdf3] text-[#027a48]' : 'bg-[#fff7ed] text-[#b54708]'}`}>
        {isGood ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      </div>
      <div className="grid min-w-0 gap-1">
        <strong className="text-sm text-[#17202a]">{label}</strong>
        <span className="text-[13px] leading-snug text-[#657384]">{detail}</span>
      </div>
      <b className="text-lg font-bold text-[#405064] max-sm:col-start-2 max-sm:justify-self-start">{loading ? '-' : value ?? 0}</b>
    </div>
  );
}

import { ArrowLeft, BarChart3, ClipboardCheck, FileText, Loader2, RefreshCw, SlidersHorizontal, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiUser, apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { queryKeys } from '../../lib/queryKeys';

type EngineerOption = {
  id: string;
  email: string;
  fullName?: string | null;
  region?: { id: string; name: string } | null;
  engineerProfile?: {
    expertiseGroup?: ExpertiseGroup | null;
  } | null;
};

type ProductIndustryOption = {
  id: string;
  name: string;
  code?: string | null;
  expertiseGroup?: ExpertiseGroup | null;
};

type ExpertiseGroup = 'IMAGING' | 'LAB_TESTING';

type EngineerStat = {
  engineerId: string;
  engineerName: string;
  total: number;
  repair: number;
  maintenance: number;
  installation: number;
  completed: number;
  open: number;
  waitingReview: number;
  overdue: number;
  customers: number;
  machines: number;
  completionRate: number;
};

type IndustryStat = {
  productIndustryId: string;
  productIndustryName: string;
  total: number;
  repair: number;
  maintenance: number;
  installation: number;
  completed: number;
  open: number;
};

type TrendItem = {
  date: string;
  repair: number;
  maintenance: number;
  installation: number;
  total: number;
};

type TechnicalStatistics = {
  period: {
    month: string;
    start: string;
    end: string;
  };
  filters: {
    engineers: EngineerOption[];
    productIndustries: ProductIndustryOption[];
  };
  summary: {
    total: number;
    completed: number;
    open: number;
    waitingReview: number;
    overdue: number;
    customers: number;
    machines: number;
    completionRate: number;
  };
  typeCounts: {
    repair: number;
    maintenance: number;
    installation: number;
  };
  byEngineer: EngineerStat[];
  byIndustry: IndustryStat[];
  trend: TrendItem[];
};

const workTypeOptions = [
  { label: 'Tất cả việc', value: '' },
  { label: 'Sửa chữa', value: 'repair' },
  { label: 'Bảo trì', value: 'maintenance' },
  { label: 'Lắp đặt', value: 'installation' },
];

type TechnicalStatisticsPageProps = {
  currentRole: RoleName;
  user: ApiUser;
};

const currentMonthStart = startOfMonth(new Date());
const currentMonthEnd = endOfMonth(new Date());

export function TechnicalStatisticsPage({ currentRole, user }: TechnicalStatisticsPageProps) {
  const [searchParams] = useSearchParams();
  const isAdmin = currentRole === 'admin';
  const returnTo = searchParams.get('returnTo') || '';
  const initialMonth = searchParams.get('month');
  const [from, setFrom] = useState(() => searchParams.get('from') || monthStartFromParam(initialMonth) || toDateInput(currentMonthStart));
  const [to, setTo] = useState(() => searchParams.get('to') || monthEndFromParam(initialMonth) || toDateInput(currentMonthEnd));
  const [weekStart, setWeekStart] = useState(() => searchParams.get('weekStart') || toDateInput(startOfWeek(new Date(`${searchParams.get('from') || monthStartFromParam(initialMonth) || toDateInput(currentMonthStart)}T00:00:00`))));
  const [engineerId, setEngineerId] = useState(() => (isAdmin ? searchParams.get('engineerId') || '' : user.id));
  const [productIndustryId, setProductIndustryId] = useState(() => searchParams.get('productIndustryId') || '');
  const [workType, setWorkType] = useState(() => normalizeWorkType(searchParams.get('workType')));

  const requestParams = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    const effectiveEngineerId = isAdmin ? engineerId : user.id;
    if (effectiveEngineerId) params.set('engineerId', effectiveEngineerId);
    if (productIndustryId) params.set('productIndustryId', productIndustryId);
    if (workType) params.set('workType', workType);
    return params.toString();
  }, [engineerId, from, isAdmin, productIndustryId, to, user.id, workType]);

  const statisticsQuery = useQuery({
    queryKey: queryKeys.technicalStatistics.overview(requestParams),
    queryFn: () => apiFetch<TechnicalStatistics>(`/dashboard/technical-statistics?${requestParams}`),
  });

  const data = statisticsQuery.data ?? null;
  const loading = statisticsQuery.isLoading || statisticsQuery.isFetching;
  const error = statisticsQuery.error instanceof Error ? statisticsQuery.error.message : '';

  const selectedEngineer = useMemo(
    () => (isAdmin ? data?.filters.engineers.find((engineer) => engineer.id === engineerId) : null),
    [data, engineerId, isAdmin],
  );
  const selectedExpertiseGroup = isAdmin
    ? selectedEngineer?.engineerProfile?.expertiseGroup || null
    : user.engineerProfile?.expertiseGroup || null;
  const isIndustryLocked = Boolean((isAdmin ? engineerId : user.id) && selectedExpertiseGroup);
  const lockedIndustryOptions = useMemo(
    () => (data?.filters.productIndustries ?? []).filter((industry) => industry.expertiseGroup === selectedExpertiseGroup),
    [data, selectedExpertiseGroup],
  );
  const industrySelectLabel = isIndustryLocked
    ? `Theo nhóm ${expertiseGroupLabel(selectedExpertiseGroup)}${lockedIndustryOptions.length ? ` (${lockedIndustryOptions.map((industry) => industry.name).join(', ')})` : ''}`
    : 'Tất cả ngành hàng';

  useEffect(() => {
    if (isIndustryLocked && productIndustryId) {
      setProductIndustryId('');
    }
  }, [isIndustryLocked, productIndustryId]);

  const maxEngineerTotal = useMemo(() => Math.max(...(data?.byEngineer ?? []).map((item) => item.total), 1), [data]);
  const maxIndustryTotal = useMemo(() => Math.max(...(data?.byIndustry ?? []).map((item) => item.total), 1), [data]);
  const maxTrendTotal = useMemo(() => Math.max(...(data?.trend ?? []).map((item) => item.total), 1), [data]);
  const weeklyReportHref = buildWeeklyReportHref(weekStart, isAdmin ? engineerId : user.id);

  return (
    <PageFrame>
      <div className="grid gap-4 min-[960px]:flex min-[960px]:items-start min-[960px]:justify-between">
        <PageTitle
          eyebrow="Báo cáo kỹ thuật"
          title="Thống kê kỹ thuật"
          description={isAdmin ? 'Theo dõi sửa chữa, bảo trì và lắp đặt theo khoảng ngày, kỹ sư và ngành hàng.' : 'Báo cáo kỹ thuật chi tiết theo khoảng ngày của kỹ sư đang đăng nhập.'}
        />
        <div className="flex flex-wrap gap-2">
          {returnTo ? (
            <Link className="secondary-button" to={returnTo}>
              <ArrowLeft size={16} />
              Back
            </Link>
          ) : null}
          <button className="secondary-button" disabled={loading} onClick={() => void statisticsQuery.refetch()} type="button">
            {loading ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
            Làm mới
          </button>
          <Link
            aria-disabled={isAdmin && !engineerId}
            className={`secondary-button ${isAdmin && !engineerId ? 'pointer-events-none opacity-60' : ''}`}
            to={weeklyReportHref}
          >
            <FileText size={16} />
            Báo cáo tuần
          </Link>
        </div>
      </div>

      <section className="operation-filter-panel">
        <div className="grid gap-3 min-[1180px]:grid-cols-[150px_150px_150px_minmax(190px,1fr)_minmax(190px,1fr)_170px]">
          <label className="operation-filter-field">
            <span>Từ ngày</span>
            <input className="h-[42px] rounded-lg border border-[#d6d6d6] bg-white px-3 text-sm font-medium text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]" onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
          </label>
          <label className="operation-filter-field">
            <span>Đến ngày</span>
            <input className="h-[42px] rounded-lg border border-[#d6d6d6] bg-white px-3 text-sm font-medium text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]" onChange={(event) => setTo(event.target.value)} type="date" value={to} />
          </label>
          <label className="operation-filter-field">
            <span>Tuần báo cáo</span>
            <input className="h-[42px] rounded-lg border border-[#d6d6d6] bg-white px-3 text-sm font-medium text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]" onChange={(event) => setWeekStart(toDateInput(startOfWeek(new Date(`${event.target.value}T00:00:00`))))} type="date" value={weekStart} />
          </label>
          <label className="operation-filter-field">
            <span>Kỹ sư</span>
            {isAdmin ? (
              <select onChange={(event) => setEngineerId(event.target.value)} value={engineerId}>
                <option value="">Tất cả kỹ sư</option>
                {(data?.filters.engineers ?? []).map((engineer) => (
                  <option key={engineer.id} value={engineer.id}>
                    {[engineer.fullName || engineer.email, engineer.region?.name].filter(Boolean).join(' - ')}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid min-h-[42px] content-center rounded-lg border border-[#d6d6d6] bg-[#fafafa] px-3 text-sm font-semibold text-[#1f1f1f]">
                {user.fullName || user.email}
              </div>
            )}
          </label>
          <label className="operation-filter-field">
            <span>Ngành hàng</span>
            <select disabled={isIndustryLocked} onChange={(event) => setProductIndustryId(event.target.value)} value={isIndustryLocked ? '' : productIndustryId}>
              <option value="">{industrySelectLabel}</option>
              {(data?.filters.productIndustries ?? []).map((industry) => (
                <option key={industry.id} value={industry.id}>
                  {industry.name}
                </option>
              ))}
            </select>
            {isIndustryLocked ? <small>Tự khóa theo nhóm chuyên môn của kỹ sư đã chọn.</small> : null}
          </label>
          <label className="operation-filter-field">
            <span>Loại việc</span>
            <select onChange={(event) => setWorkType(event.target.value)} value={workType}>
              {workTypeOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? <Notice message={error} /> : null}

      {loading && !data ? (
        <section className="grid min-h-[360px] place-items-center rounded-lg border border-[#e5e5e5] bg-white p-8 text-sm font-semibold text-[#666666]">
          <Loader2 className="spin-icon" size={22} />
          Đang tải thống kê
        </section>
      ) : null}

      {data ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={<BarChart3 size={18} />} label="Tổng việc" value={data.summary.total} hint={`${formatDay(from)} - ${formatDay(to)}`} />
            <StatCard icon={<ClipboardCheck size={18} />} label="Hoàn tất" value={data.summary.completed} hint={`${data.summary.completionRate}% tỷ lệ hoàn tất`} />
            <StatCard icon={<SlidersHorizontal size={18} />} label="Đang mở" value={data.summary.open} hint={`${data.summary.waitingReview} việc chờ xác nhận`} />
            <StatCard icon={<Users size={18} />} label="Khách hàng / máy" value={`${data.summary.customers}/${data.summary.machines}`} hint={`${data.summary.overdue} việc cần chú ý`} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
            <Panel title="Theo kỹ sư" subtitle="Số việc trong tháng, tách theo sửa chữa, bảo trì và lắp đặt">
              {data.byEngineer.length ? (
                <div className="grid gap-4">
                  {data.byEngineer.slice(0, 10).map((item) => (
                    <StackedBarRow
                      installation={item.installation}
                      key={item.engineerId}
                      label={item.engineerName}
                      maintenance={item.maintenance}
                      max={maxEngineerTotal}
                      repair={item.repair}
                      total={item.total}
                    />
                  ))}
                </div>
              ) : (
                <EmptyPanel text="Chưa có dữ liệu kỹ sư trong kỳ này." />
              )}
            </Panel>

            <Panel title="Cơ cấu loại việc" subtitle="Tỷ trọng sửa chữa, bảo trì, lắp đặt">
              <DonutChart counts={data.typeCounts} />
            </Panel>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Panel title="Theo ngành hàng" subtitle="Ngành hàng phát sinh nhiều việc nhất">
              {data.byIndustry.length ? (
                <div className="grid gap-3">
                  {data.byIndustry.map((item) => (
                    <SimpleBarRow key={item.productIndustryId} label={item.productIndustryName} max={maxIndustryTotal} value={item.total} />
                  ))}
                </div>
              ) : (
                <EmptyPanel text="Chưa có dữ liệu ngành hàng." />
              )}
            </Panel>

            <Panel title="Xu hướng trong tháng" subtitle="Khối lượng việc theo từng ngày">
              <TrendBars max={maxTrendTotal} trend={data.trend} />
            </Panel>
          </section>

          <section className="overflow-hidden rounded-lg border border-[#e5e5e5] bg-white shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
            <div className="border-b border-[#eeeeee] bg-[#fafafa] px-4 py-3">
              <h2 className="text-base font-semibold text-[#1f1f1f]">Bảng hiệu suất kỹ sư</h2>
              <p className="mt-1 text-sm text-[#666666]">Dùng để so sánh khối lượng việc, khách hàng phục vụ và tỷ lệ hoàn tất.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead className="bg-white text-xs font-semibold text-[#666666]">
                  <tr>
                    {['Kỹ sư', 'Tổng', 'Sửa chữa', 'Bảo trì', 'Lắp đặt', 'Hoàn tất', 'Đang mở', 'Chờ xác nhận', 'Khách hàng', 'Máy', 'Tỷ lệ'].map((header) => (
                      <th className="border-b border-[#eeeeee] px-4 py-3" key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.byEngineer.map((item) => (
                    <tr className="border-b border-[#f1f1f1] last:border-b-0" key={item.engineerId}>
                      <td className="px-4 py-3 font-semibold text-[#1f1f1f]">{item.engineerName}</td>
                      <td className="px-4 py-3">{item.total}</td>
                      <td className="px-4 py-3">{item.repair}</td>
                      <td className="px-4 py-3">{item.maintenance}</td>
                      <td className="px-4 py-3">{item.installation}</td>
                      <td className="px-4 py-3">{item.completed}</td>
                      <td className="px-4 py-3">{item.open}</td>
                      <td className="px-4 py-3">{item.waitingReview}</td>
                      <td className="px-4 py-3">{item.customers}</td>
                      <td className="px-4 py-3">{item.machines}</td>
                      <td className="px-4 py-3 font-semibold text-[#177245]">{item.completionRate}%</td>
                    </tr>
                  ))}
                  {data.byEngineer.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-[#666666]" colSpan={11}>Chưa có dữ liệu trong kỳ này.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </PageFrame>
  );
}

function StatCard({ hint, icon, label, value }: { hint: string; icon: ReactNode; label: string; value: number | string }) {
  return (
    <article className="grid grid-cols-[42px_minmax(0,1fr)] gap-3 rounded-lg border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
      <div className="flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-[#f5c7cb] bg-[#fff5f5] text-[#d71920]">{icon}</div>
      <div>
        <span className="text-xs font-semibold text-[#666666]">{label}</span>
        <strong className="block text-2xl leading-tight text-[#1f1f1f]">{value}</strong>
        <span className="text-xs text-[#8a8a8a]">{hint}</span>
      </div>
    </article>
  );
}

function Panel({ children, subtitle, title }: { children: ReactNode; subtitle: string; title: string }) {
  return (
    <section className="grid content-start gap-4 rounded-lg border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_2px_rgba(20,32,51,0.04)]">
      <div>
        <h2 className="text-base font-semibold text-[#1f1f1f]">{title}</h2>
        <p className="mt-1 line-clamp-1 text-xs font-medium text-[#8a8f99]">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function StackedBarRow({ installation, label, maintenance, max, repair, total }: { installation: number; label: string; maintenance: number; max: number; repair: number; total: number }) {
  const width = Math.max((total / max) * 100, total ? 5 : 0);
  const repairWidth = total ? (repair / total) * 100 : 0;
  const maintenanceWidth = total ? (maintenance / total) * 100 : 0;
  const installationWidth = total ? (installation / total) * 100 : 0;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-semibold text-[#1f1f1f]">{label}</span>
        <span className="font-semibold text-[#666666]">{total}</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-[#f2f2f2]">
        <div className="flex h-full overflow-hidden rounded-full" style={{ width: `${width}%` }}>
          <span className="bg-[#d71920]" style={{ width: `${repairWidth}%` }} />
          <span className="bg-[#9b5a17]" style={{ width: `${maintenanceWidth}%` }} />
          <span className="bg-[#177245]" style={{ width: `${installationWidth}%` }} />
        </div>
      </div>
    </div>
  );
}

function SimpleBarRow({ label, max, value }: { label: string; max: number; value: number }) {
  const width = Math.max((value / max) * 100, value ? 5 : 0);
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-[#1f1f1f]">{label}</span>
        <span className="font-semibold text-[#666666]">{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[#f2f2f2]">
        <span className="block h-full rounded-full bg-[#d71920]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function DonutChart({ counts }: { counts: TechnicalStatistics['typeCounts'] }) {
  const total = counts.repair + counts.maintenance + counts.installation;
  const repairEnd = total ? (counts.repair / total) * 100 : 0;
  const maintenanceEnd = total ? repairEnd + (counts.maintenance / total) * 100 : 0;
  const background = total
    ? `conic-gradient(#d71920 0 ${repairEnd}%, #9b5a17 ${repairEnd}% ${maintenanceEnd}%, #177245 ${maintenanceEnd}% 100%)`
    : '#f2f2f2';

  return (
    <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
      <div className="relative mx-auto h-[170px] w-[170px] rounded-full" style={{ background }}>
        <div className="absolute inset-[28px] grid place-items-center rounded-full bg-white text-center">
          <strong className="text-2xl text-[#1f1f1f]">{total}</strong>
          <span className="text-xs font-semibold text-[#666666]">tổng việc</span>
        </div>
      </div>
      <div className="grid gap-2 text-sm">
        <Legend color="#d71920" label="Sửa chữa" value={counts.repair} />
        <Legend color="#9b5a17" label="Bảo trì" value={counts.maintenance} />
        <Legend color="#177245" label="Lắp đặt" value={counts.installation} />
      </div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-[#fafafa] px-3 py-2">
      <span className="inline-flex items-center gap-2 text-[#333333]">
        <i className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function TrendBars({ max, trend }: { max: number; trend: TrendItem[] }) {
  const compactTrend = trend.filter((_, index) => index % Math.ceil(trend.length / 16) === 0 || trend.length <= 16);
  return (
    <div className="flex min-h-[220px] items-end gap-2 overflow-x-auto rounded-lg bg-[#fafafa] px-3 pt-4 pb-3">
      {compactTrend.map((item) => {
        const height = Math.max((item.total / max) * 170, item.total ? 8 : 2);
        return (
          <div className="grid min-w-8 justify-items-center gap-2" key={item.date} title={`${formatDay(item.date)}: ${item.total} việc`}>
            <div className="flex h-[170px] items-end">
              <span className="block w-5 rounded-t-md bg-[#d71920]" style={{ height }} />
            </div>
            <span className="text-[11px] font-semibold text-[#666666]">{new Date(item.date).getDate()}</span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="grid min-h-[160px] place-items-center rounded-lg border border-dashed border-[#dddddd] bg-[#fafafa] p-6 text-center text-sm font-semibold text-[#666666]">{text}</div>;
}

function normalizeWorkType(value: string | null) {
  return workTypeOptions.some((option) => option.value === value) ? value || '' : '';
}

function expertiseGroupLabel(value?: ExpertiseGroup | null) {
  if (value === 'IMAGING') return 'Chẩn đoán hình ảnh';
  if (value === 'LAB_TESTING') return 'Xét nghiệm';
  return 'chuyên môn';
}

function buildWeeklyReportHref(weekStart: string, engineerId: string) {
  const params = new URLSearchParams({ weekStart });
  if (engineerId) params.set('userId', engineerId);
  return `/weekly-reports?${params.toString()}`;
}

function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthStartFromParam(month: string | null) {
  return /^\d{4}-\d{2}$/.test(month || '') ? `${month}-01` : '';
}

function monthEndFromParam(month: string | null) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) return '';
  const [year, monthIndex] = month!.split('-').map(Number);
  return toDateInput(new Date(year, monthIndex, 0));
}

function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

import { BarChart3, ClipboardCheck, Loader2, RefreshCw, SlidersHorizontal, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';

type EngineerOption = {
  id: string;
  email: string;
  fullName?: string | null;
  region?: { id: string; name: string } | null;
};

type ProductIndustryOption = {
  id: string;
  name: string;
  code?: string | null;
};

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

export function TechnicalStatisticsPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [engineerId, setEngineerId] = useState('');
  const [productIndustryId, setProductIndustryId] = useState('');
  const [workType, setWorkType] = useState('');
  const [data, setData] = useState<TechnicalStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadStatistics();
  }, [month, engineerId, productIndustryId, workType]);

  async function loadStatistics() {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ month });
      if (engineerId) params.set('engineerId', engineerId);
      if (productIndustryId) params.set('productIndustryId', productIndustryId);
      if (workType) params.set('workType', workType);
      setData(await apiFetch<TechnicalStatistics>(`/dashboard/technical-statistics?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được thống kê kỹ thuật.');
    } finally {
      setLoading(false);
    }
  }

  const maxEngineerTotal = useMemo(() => Math.max(...(data?.byEngineer ?? []).map((item) => item.total), 1), [data]);
  const maxIndustryTotal = useMemo(() => Math.max(...(data?.byIndustry ?? []).map((item) => item.total), 1), [data]);
  const maxTrendTotal = useMemo(() => Math.max(...(data?.trend ?? []).map((item) => item.total), 1), [data]);

  return (
    <PageFrame>
      <div className="grid gap-4 min-[960px]:flex min-[960px]:items-start min-[960px]:justify-between">
        <PageTitle
          eyebrow="Báo cáo kỹ thuật"
          title="Thống kê kỹ thuật"
          description="Theo dõi sửa chữa, bảo trì và lắp đặt theo tháng, kỹ sư và ngành hàng."
        />
        <button className="secondary-button" disabled={loading} onClick={() => void loadStatistics()} type="button">
          {loading ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
          Làm mới
        </button>
      </div>

      <section className="operation-filter-panel">
        <div className="grid gap-3 min-[1040px]:grid-cols-[180px_minmax(190px,1fr)_minmax(190px,1fr)_180px]">
          <label className="operation-filter-field">
            <span>Tháng</span>
            <input className="h-[42px] rounded-lg border border-[#d6d6d6] bg-white px-3 text-sm font-medium text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]" onChange={(event) => setMonth(event.target.value)} type="month" value={month} />
          </label>
          <label className="operation-filter-field">
            <span>Kỹ sư</span>
            <select onChange={(event) => setEngineerId(event.target.value)} value={engineerId}>
              <option value="">Tất cả kỹ sư</option>
              {(data?.filters.engineers ?? []).map((engineer) => (
                <option key={engineer.id} value={engineer.id}>
                  {[engineer.fullName || engineer.email, engineer.region?.name].filter(Boolean).join(' - ')}
                </option>
              ))}
            </select>
          </label>
          <label className="operation-filter-field">
            <span>Ngành hàng</span>
            <select onChange={(event) => setProductIndustryId(event.target.value)} value={productIndustryId}>
              <option value="">Tất cả ngành hàng</option>
              {(data?.filters.productIndustries ?? []).map((industry) => (
                <option key={industry.id} value={industry.id}>
                  {industry.name}
                </option>
              ))}
            </select>
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
            <StatCard icon={<BarChart3 size={18} />} label="Tổng việc" value={data.summary.total} hint={`Tháng ${data.period.month}`} />
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
        <p className="mt-1 text-sm text-[#666666]">{subtitle}</p>
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

function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

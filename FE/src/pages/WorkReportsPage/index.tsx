import { CalendarDays, ClipboardCheck, FileBarChart2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiUser } from '../../api';
import { RoleName } from '../../auth/roles';
import { PageFrame } from '../../components/PageFrame';
import { DailyReportsPage } from '../DailyReportsPage';
import { DailyWorkCalendarPage } from '../DailyWorkCalendarPage';
import { WeeklyReportsPage } from '../WeeklyReportsPage';

type WorkReportsPageProps = {
  currentRole: RoleName;
  initialTab?: WorkReportTab;
  user: ApiUser;
};

type WorkReportTab = 'calendar' | 'daily' | 'weekly';

const tabs: Array<{ value: WorkReportTab; label: string; description: string; icon: ReactNode }> = [
  {
    value: 'calendar',
    label: 'Lịch công việc',
    description: 'Lên lịch tuần/ngày, công tác, nghỉ phép',
    icon: <CalendarDays size={17} />,
  },
  {
    value: 'daily',
    label: 'Xác nhận cuối ngày',
    description: 'Tự gom việc hôm nay rồi gửi admin',
    icon: <ClipboardCheck size={17} />,
  },
  {
    value: 'weekly',
    label: 'Báo cáo tuần',
    description: 'Gom lịch và phiếu hoàn thành trong tuần',
    icon: <FileBarChart2 size={17} />,
  },
];

export function WorkReportsPage({ currentRole, initialTab = 'calendar', user }: WorkReportsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = normalizeTab(searchParams.get('tab') || initialTab);

  function selectTab(tab: WorkReportTab) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  }

  return (
    <>
      <PageFrame>
        <section className="grid gap-4 rounded-[24px] border border-[#e4e4e7] bg-white p-4 shadow-[0_8px_24px_rgba(24,24,27,0.05)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#64748b]">Công việc & báo cáo</span>
              <h1 className="mt-1 text-[clamp(24px,2.6vw,34px)] font-bold leading-tight tracking-[-0.03em] text-[#18181b]">Lịch & báo cáo kỹ thuật</h1>
              <p className="mt-1 max-w-[760px] text-sm leading-6 text-[#666666]">
                Một luồng duy nhất: lập lịch, xác nhận cuối ngày, rồi tổng hợp thành báo cáo tuần.
              </p>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            {tabs.map((tab) => {
              const active = tab.value === currentTab;
              return (
                <button
                  className={`grid min-h-[86px] gap-1 rounded-[16px] border p-3 text-left transition ${
                    active
                      ? 'border-[#18181b] bg-[#18181b] text-white shadow-[0_14px_30px_rgba(24,24,27,0.18)]'
                      : 'border-[#e4e4e7] bg-[#fafafa] text-[#333333] hover:border-[#c7c7cc] hover:bg-white'
                  }`}
                  key={tab.value}
                  onClick={() => selectTab(tab.value)}
                  type="button"
                >
                  <span className="inline-flex items-center gap-2 text-sm font-extrabold">
                    {tab.icon}
                    {tab.label}
                  </span>
                  <span className={`text-xs font-semibold leading-5 ${active ? 'text-white/74' : 'text-[#666666]'}`}>{tab.description}</span>
                </button>
              );
            })}
          </div>
        </section>
      </PageFrame>

      {currentTab === 'calendar' ? <DailyWorkCalendarPage currentRole={currentRole} user={user} /> : null}
      {currentTab === 'daily' ? <DailyReportsPage currentRole={currentRole} user={user} /> : null}
      {currentTab === 'weekly' ? <WeeklyReportsPage currentRole={currentRole} user={user} /> : null}
    </>
  );
}

function normalizeTab(value: string): WorkReportTab {
  if (value === 'daily' || value === 'weekly' || value === 'calendar') return value;
  return 'calendar';
}

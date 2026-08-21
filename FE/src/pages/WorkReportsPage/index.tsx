import { CalendarDays, ClipboardCheck, FileBarChart2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
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
    description: 'Lịch tuần/ngày',
    icon: <CalendarDays size={17} />,
  },
  {
    value: 'daily',
    label: 'Xác nhận cuối ngày',
    description: 'Việc hôm nay',
    icon: <ClipboardCheck size={17} />,
  },
  {
    value: 'weekly',
    label: 'Báo cáo tuần',
    description: 'Tổng hợp tuần',
    icon: <FileBarChart2 size={17} />,
  },
];

export function WorkReportsPage({ currentRole, initialTab = 'calendar', user }: WorkReportsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentTab, setCurrentTab] = useState<WorkReportTab>(() => normalizeTab(searchParams.get('tab') || initialTab));

  useEffect(() => {
    setCurrentTab(normalizeTab(searchParams.get('tab') || initialTab));
  }, [initialTab]);

  function selectTab(tab: WorkReportTab) {
    setCurrentTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  }

  return (
    <>
      <PageFrame>
        <section className="rounded-[18px] border border-[#e4e4e7] bg-white p-3 shadow-[0_8px_24px_rgba(24,24,27,0.05)]">
            <div className="grid gap-2 rounded-[14px] bg-[#f7f8fa] p-1 md:grid-cols-3">
              {tabs.map((tab) => {
                const active = tab.value === currentTab;
                return (
                  <button
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[11px] px-3 text-sm font-bold transition ${
                      active
                        ? 'bg-[#18181b] text-white shadow-[0_8px_18px_rgba(24,24,27,0.16)]'
                        : 'text-[#667085] hover:bg-white hover:text-[#18181b]'
                    }`}
                    key={tab.value}
                    onClick={() => selectTab(tab.value)}
                    type="button"
                  >
                    {tab.icon}
                    {tab.label}
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

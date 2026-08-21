import { FileText, Loader2, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { businessTabs, dailyWorkStatusMeta, dailyWorkTypeLabels } from '../constants';
import type { BusinessTab, DailyWorkNote, EngineerTask, KindFilter, TaskFilter } from '../types';
import { dayNumber, formatDailyWorkDate, formatDailyWorkTime, monthLabel, taskDate, weeklyReportHrefForDailyWork } from '../utils';
import { EngineerTaskRow } from './EngineerTaskRow';

type TaskGroup = {
  key: string;
  label: string;
  items: EngineerTask[];
};

type EngineerWorkspacePanelProps = {
  businessTab: BusinessTab;
  businessTabCounts: Record<BusinessTab, number>;
  filter: TaskFilter;
  groupedTasks: TaskGroup[];
  kindFilter: KindFilter;
  loading: boolean;
  loadingDailyWork: boolean;
  notes: DailyWorkNote[];
  onBusinessTabChange: (tab: BusinessTab) => void;
  onFilterChange: (filter: TaskFilter) => void;
  onKindFilterChange: (filter: KindFilter) => void;
  onOpenTask: (task: EngineerTask) => void;
  onQueryChange: (query: string) => void;
  query: string;
};

export function EngineerWorkspacePanel({
  businessTab,
  businessTabCounts,
  filter,
  groupedTasks,
  kindFilter,
  loading,
  loadingDailyWork,
  notes,
  onBusinessTabChange,
  onFilterChange,
  onKindFilterChange,
  onOpenTask,
  onQueryChange,
  query,
}: EngineerWorkspacePanelProps) {
  return (
    <section className="engineer-task-panel">
      <BusinessTabBar activeTab={businessTab} counts={businessTabCounts} onChange={onBusinessTabChange} />

      <TaskToolbar
        businessTab={businessTab}
        filter={filter}
        kindFilter={kindFilter}
        onFilterChange={onFilterChange}
        onKindFilterChange={onKindFilterChange}
        onQueryChange={onQueryChange}
        query={query}
      />

      <div className="task-list">
        {loading ? <TaskLoadingState label="Đang tải việc được giao..." /> : null}

        {!loading && businessTab === 'calendar' ? (
          <DailyWorkNotesList loading={loadingDailyWork} notes={notes} />
        ) : null}

        {!loading && businessTab !== 'calendar' && groupedTasks.length === 0 ? (
          <TaskEmptyState title="Chưa có công việc phù hợp" />
        ) : null}

        {businessTab !== 'calendar'
          ? groupedTasks.map((group) => (
              <section className="engineer-day-group" key={group.key}>
                <div className="engineer-day-group__head">
                  <div>
                    <span>Ngày hẹn</span>
                    <strong>{group.label}</strong>
                  </div>
                  <em>{group.items.length} phiếu</em>
                </div>
                <div className="grid">
                  {group.items.map((task) => (
                    <EngineerTaskRow key={`${task.kind}-${task.id}`} onOpen={onOpenTask} task={task} />
                  ))}
                </div>
              </section>
            ))
          : null}
      </div>
    </section>
  );
}

function BusinessTabBar({
  activeTab,
  counts,
  onChange,
}: {
  activeTab: BusinessTab;
  counts: Record<BusinessTab, number>;
  onChange: (tab: BusinessTab) => void;
}) {
  return (
    <div className="engineer-business-tabs" aria-label="Nhóm công việc">
      {businessTabs.map((tab) => (
        <button className={activeTab === tab.value ? 'active' : ''} key={tab.value} onClick={() => onChange(tab.value)} type="button">
          <span>{tab.label}</span>
          <strong>{counts[tab.value]}</strong>
        </button>
      ))}
    </div>
  );
}

function TaskToolbar({
  businessTab,
  filter,
  kindFilter,
  onFilterChange,
  onKindFilterChange,
  onQueryChange,
  query,
}: {
  businessTab: BusinessTab;
  filter: TaskFilter;
  kindFilter: KindFilter;
  onFilterChange: (filter: TaskFilter) => void;
  onKindFilterChange: (filter: KindFilter) => void;
  onQueryChange: (query: string) => void;
  query: string;
}) {
  return (
    <div className="task-toolbar">
      <div className="task-search">
        <Search size={17} />
        <input onChange={(event) => onQueryChange(event.target.value)} placeholder="Tìm mã phiếu, mã máy, serial, khách hàng" value={query} />
      </div>
      <div className="task-toolbar__filters">
        <label className="task-filter-select task-status-select">
          <span>Trạng thái</span>
          <select onChange={(event) => onFilterChange(event.target.value as TaskFilter)} value={filter}>
            <option value="action">Cần xử lý</option>
            <option value="revision">Cần bổ sung</option>
            <option value="review">Chờ duyệt</option>
            <option value="progress">Đang làm</option>
            <option value="done">Hoàn tất</option>
            <option value="all">Tất cả</option>
          </select>
        </label>
        {businessTab === 'all' || businessTab === 'warranty' ? (
          <label className="task-filter-select">
            <span>Loại công việc</span>
            <select onChange={(event) => onKindFilterChange(event.target.value as KindFilter)} value={kindFilter}>
              {businessTab === 'all' ? (
                <>
                  <option value="all">Tất cả loại việc</option>
                  <option value="repair">Sửa chữa</option>
                  <option value="maintenance">Bảo trì</option>
                  <option value="installation">Lắp đặt</option>
                </>
              ) : (
                <>
                  <option value="all">Tất cả bảo hành</option>
                  <option value="repair">Sửa chữa bảo hành</option>
                  <option value="maintenance">Bảo trì bảo hành</option>
                </>
              )}
            </select>
          </label>
        ) : null}
      </div>
    </div>
  );
}

function DailyWorkNotesList({ loading, notes }: { loading: boolean; notes: DailyWorkNote[] }) {
  if (loading) {
    return <TaskLoadingState label="Đang tải lịch công việc..." />;
  }

  if (notes.length === 0) {
    return <TaskEmptyState title="Chưa có lịch công việc phù hợp" />;
  }

  return (
    <>
      {notes.map((note) => (
        <DailyWorkNoteCard key={note.id} note={note} />
      ))}
    </>
  );
}

function DailyWorkNoteCard({ note }: { note: DailyWorkNote }) {
  const status = dailyWorkStatusMeta[note.status || 'APPROVED'];

  return (
    <article className="grid min-w-0 items-center gap-3.5 border-b border-[#eeeeee] p-4 last:border-b-0 min-[640px]:grid-cols-[66px_minmax(0,1fr)]">
      <div className="grid min-h-16 justify-items-center rounded-lg border border-l-4 bg-[#fffdfb] p-2" style={{ borderColor: note.color || '#18181b' }}>
        <strong className="text-2xl leading-none text-[#1f1f1f]">{dayNumber(note.workDate)}</strong>
        <span className="text-xs font-medium text-[#666666]">{monthLabel(note.workDate)}</span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#666666]">
          <span>{dailyWorkTypeLabels[note.type || 'WORK']}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[12px] font-semibold ${status.className}`}>{status.label}</span>
          <span>{formatDailyWorkDate(note.workDate)}</span>
          <span>{formatDailyWorkTime(note)}</span>
        </div>
        <h2 className="mt-1 text-[17px] font-medium text-[#1f1f1f] [overflow-wrap:anywhere]">{note.title}</h2>
        <p className="mt-1.5 leading-6 text-[#333333] [overflow-wrap:anywhere]">{note.note || 'Chưa có ghi chú chi tiết.'}</p>
        {note.rejectReason ? <p className="mt-2 rounded-lg border border-[#fecdd3] bg-[#fff1f3] px-3 py-2 text-sm text-[#b5121b]">Lý do từ chối: {note.rejectReason}</p> : null}
        {note.status === 'REJECTED' || note.status === 'CANCELLED' ? null : (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="secondary-button" to={weeklyReportHrefForDailyWork(note)}>
              <FileText size={16} />
              Báo cáo tuần
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}

function TaskLoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 p-6 text-[#666666]">
      <Loader2 className="spin-icon" size={18} />
      {label}
    </div>
  );
}

function TaskEmptyState({ title }: { title: string }) {
  return (
    <div className="grid min-h-40 place-items-center gap-2 p-6 text-center text-[#666666]">
      <strong className="text-[#1f1f1f]">{title}</strong>
    </div>
  );
}

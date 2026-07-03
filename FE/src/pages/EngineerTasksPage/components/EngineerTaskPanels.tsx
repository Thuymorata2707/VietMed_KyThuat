import { ArrowRight, CalendarDays, Clock3, FileText, MapPin, PhoneCall, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { installationStatusOptions, maintenanceStatusOptions, repairStatusOptions } from '../constants';
import type { DailyWorkNote, EngineerTask, TaskFilter, TaskKind, TaskTone, WeeklyReportQuick, WeeklyReportStatus } from '../types';
import {
  addDays,
  formatDailyWorkTime,
  formatDate,
  needsMachineProfile,
  statusLabel,
  statusTone,
  taskActionLabel,
  taskAttention,
  taskContactPhone,
  taskCustomer,
  taskKindLabel,
  taskLocation,
  taskModelText,
  taskSerialText,
  taskTitle,
  taskUpdateHref,
  toDateInput,
  startOfWeek,
} from '../utils';

const weeklyReportStatusLabels: Record<WeeklyReportStatus | 'NONE', string> = {
  NONE: 'Chưa có',
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã gửi',
  APPROVED: 'Đã duyệt',
  NEEDS_REVISION: 'Cần sửa',
};

export function WeeklyReportQuickCard({ loading, report }: { loading: boolean; report: WeeklyReportQuick | null }) {
  const weekStart = toDateInput(startOfWeek(new Date()));
  const weekEnd = toDateInput(addDays(new Date(`${weekStart}T00:00:00`), 6));
  const status = report?.status ?? 'NONE';
  const rowCount = report?.rows?.length ?? 0;

  return (
    <aside className="grid gap-4 rounded-lg border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#666666]">
            <CalendarDays size={14} />
            Báo cáo tuần
          </span>
          <h2 className="mt-1 text-lg font-medium text-[#1f1f1f]">
            {formatDate(weekStart)} - {formatDate(weekEnd)}
          </h2>
        </div>
        <span className={`task-badge ${status === 'APPROVED' ? 'good' : status === 'SUBMITTED' ? 'warn' : status === 'NEEDS_REVISION' ? 'danger' : 'neutral'}`}>
          {loading ? 'Đang tải' : weeklyReportStatusLabels[status]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-[#fafafa] p-3">
          <span className="block text-xs font-medium text-[#666666]">Dòng báo cáo</span>
          <strong className="mt-1 block text-2xl leading-none text-[#1f1f1f]">{loading ? '-' : rowCount}</strong>
        </div>
        <div className="rounded-lg bg-[#fafafa] p-3">
          <span className="block text-xs font-medium text-[#666666]">Trạng thái</span>
          <strong className="mt-1 block text-sm text-[#1f1f1f]">{loading ? 'Đang tải' : weeklyReportStatusLabels[status]}</strong>
        </div>
      </div>

      <Link className="primary-button justify-center" to={`/weekly-reports?weekStart=${weekStart}`}>
        <FileText size={16} />
        Mở báo cáo tuần
      </Link>
    </aside>
  );
}

export function TodayCommandCenter({
  onCreate,
  onFilter,
  onOpen,
  stats,
  tasks,
}: {
  onCreate: () => void;
  onFilter: (filter: TaskFilter) => void;
  onOpen: (task: EngineerTask) => void;
  stats: {
    overdue: number;
    revision: number;
    missingMachine: number;
    today: number;
  };
  tasks: EngineerTask[];
}) {
  return (
    <section className="grid gap-3.5 rounded-[18px] border border-[#dbeafe] bg-[radial-gradient(circle_at_8%_12%,rgba(37,99,235,0.11),transparent_32%),linear-gradient(135deg,#ffffff_0%,#f7fbff_48%,#f4fbf8_100%)] p-4 shadow-[0_18px_50px_rgba(37,99,235,0.08)]">
      <div className="flex items-start justify-between gap-3.5">
        <div>
          <span className="block text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#2563eb]">Bảng việc hôm nay</span>
          <h2 className="mt-1.5 text-[clamp(22px,3vw,34px)] font-[760] leading-[1.08] tracking-[-0.04em] text-[#18181b] [text-wrap:balance]">Mở app là biết việc cần làm trước.</h2>
        </div>
        <button className="secondary-button flex-none" onClick={onCreate} type="button">
          <Plus size={16} />
          Tạo phiếu
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 min-[1180px]:grid-cols-4" aria-label="Bộ lọc nhanh">
        <button className="flex min-h-[58px] cursor-pointer items-center justify-between rounded-[14px] border border-[#fecdd3] bg-white/75 px-3 py-2.5 text-[#18181b] transition duration-200 ease-out hover:-translate-y-px hover:bg-white hover:shadow-[0_12px_28px_rgba(37,99,235,0.11)]" onClick={() => onFilter('revision')} type="button">
          <span className="text-[12px] font-bold text-[#52525b]">Cần bổ sung</span>
          <strong className="text-2xl leading-none text-[#18181b] [font-variant-numeric:tabular-nums]">{stats.revision}</strong>
        </button>
        <button className="flex min-h-[58px] cursor-pointer items-center justify-between rounded-[14px] border border-[#fecdd3] bg-white/75 px-3 py-2.5 text-[#18181b] transition duration-200 ease-out hover:-translate-y-px hover:bg-white hover:shadow-[0_12px_28px_rgba(37,99,235,0.11)]" onClick={() => onFilter('overdue')} type="button">
          <span className="text-[12px] font-bold text-[#52525b]">Quá hạn</span>
          <strong className="text-2xl leading-none text-[#18181b] [font-variant-numeric:tabular-nums]">{stats.overdue}</strong>
        </button>
        <button className="flex min-h-[58px] cursor-pointer items-center justify-between rounded-[14px] border border-[rgba(191,219,254,0.88)] bg-white/75 px-3 py-2.5 text-[#18181b] transition duration-200 ease-out hover:-translate-y-px hover:bg-white hover:shadow-[0_12px_28px_rgba(37,99,235,0.11)]" onClick={() => onFilter('today')} type="button">
          <span className="text-[12px] font-bold text-[#52525b]">Hôm nay</span>
          <strong className="text-2xl leading-none text-[#18181b] [font-variant-numeric:tabular-nums]">{stats.today}</strong>
        </button>
        <button className="flex min-h-[58px] cursor-pointer items-center justify-between rounded-[14px] border border-[#cdeedb] bg-white/75 px-3 py-2.5 text-[#18181b] transition duration-200 ease-out hover:-translate-y-px hover:bg-white hover:shadow-[0_12px_28px_rgba(37,99,235,0.11)]" onClick={() => onFilter('action')} type="button">
          <span className="text-[12px] font-bold text-[#52525b]">Thiếu hồ sơ máy</span>
          <strong className="text-2xl leading-none text-[#18181b] [font-variant-numeric:tabular-nums]">{stats.missingMachine}</strong>
        </button>
      </div>

      <div className="grid gap-2.5">
        {tasks.length ? (
          tasks.map((task) => <PriorityTaskCard key={`${task.kind}-${task.id}`} onOpen={onOpen} task={task} />)
        ) : (
          <div className="grid min-h-32 place-items-center gap-1 rounded-2xl border border-dashed border-[#bfdbfe] bg-white/70 p-[18px] text-center text-[#52525b]">
            <strong className="text-[#18181b]">Không có việc gấp.</strong>
            <span>Các phiếu quá hạn, phiếu hôm nay hoặc phiếu cần bổ sung sẽ hiện ở đây.</span>
          </div>
        )}
      </div>
    </section>
  );
}

export function TodayDailyWorkCard({ loading, notes }: { loading: boolean; notes: DailyWorkNote[] }) {
  return (
    <aside className="grid gap-3 rounded-[18px] border border-[#e4e4e7] bg-white p-3.5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-[#52525b]">
          <Clock3 size={14} />
          Lịch hôm nay
        </span>
        <strong className="min-w-8 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2 py-1 text-center text-[#1d4ed8]">{loading ? '-' : notes.length}</strong>
      </div>
      <div className="grid gap-2">
        {loading ? <div className="text-[12px] text-[#71717a]">Đang tải lịch...</div> : null}
        {!loading && notes.length === 0 ? <div className="text-[12px] text-[#71717a]">Hôm nay chưa có lịch riêng.</div> : null}
        {!loading
          ? notes.slice(0, 4).map((note) => (
              <article className="grid gap-[3px] border-l-[3px] border-[#60a5fa] pl-2.5" key={note.id}>
                <span className="text-[12px] text-[#71717a]">{formatDailyWorkTime(note)}</span>
                <strong className="text-[14px] leading-[1.35] text-[#18181b]">{note.title}</strong>
              </article>
            ))
          : null}
      </div>
      <Link className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[#2563eb] no-underline" to="/daily-work">
        Mở lịch công tác
        <ArrowRight size={14} />
      </Link>
    </aside>
  );
}

function PriorityTaskCard({ onOpen, task }: { onOpen: (task: EngineerTask) => void; task: EngineerTask }) {
  const actionHref = taskUpdateHref(task);
  const attention = taskAttention(task);
  const phone = taskContactPhone(task);
  const location = taskLocation(task);
  const model = task.machine?.modelName || taskModelText(task) || 'Chưa có model';
  const serial = task.machine?.serialNumber || taskSerialText(task) || task.machine?.machineCode || '';
  const customer = taskCustomer(task) || 'Chưa có khách hàng';

  return (
    <article className={priorityTaskCardClass(attention.tone)}>
      <button className="grid min-w-0 cursor-pointer gap-2 border-0 bg-transparent p-0 text-left text-inherit" onClick={() => onOpen(task)} type="button">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#71717a]">
          <span>{taskKindLabel(task.kind)}</span>
          <span>{task.code}</span>
          <strong className={priorityTaskHeadlineClass(attention.tone)}>{taskActionLabel(task)}</strong>
        </div>
        <h3 className="text-[17px] font-[760] leading-[1.25] tracking-[-0.02em] text-[#18181b]">{taskTitle(task)}</h3>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#71717a]">
          <span className="max-w-full overflow-hidden truncate rounded-full bg-[#f4f4f5] px-2 py-[5px] text-[#3f3f46]">{model}</span>
          <span className="max-w-full overflow-hidden truncate rounded-full bg-[#f4f4f5] px-2 py-[5px] text-[#3f3f46]">{customer}</span>
          {serial ? <span className="max-w-full overflow-hidden truncate rounded-full bg-[#f4f4f5] px-2 py-[5px] text-[#3f3f46]">S/N {serial}</span> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#71717a]">
          <span className={`task-badge ${statusTone(task.status)}`}>{statusLabel(task.status)}</span>
          {location ? (
            <small className="inline-flex min-w-0 items-center gap-1 text-[#71717a]">
              <MapPin size={13} />
              {location}
            </small>
          ) : null}
        </div>
      </button>

      <div className="grid items-center gap-2.5">
        <span className={`engineer-next-step ${attention.tone}`}>{attention.label}</span>
        <div className="flex flex-wrap gap-2">
          {phone ? (
            <a className="task-secondary icon-button" href={`tel:${phone}`} title={`Gọi ${phone}`}>
              <PhoneCall size={15} />
            </a>
          ) : null}
          <button className="task-secondary" onClick={() => onOpen(task)} type="button">
            Xem phiếu
          </button>
          {actionHref ? (
            <Link className="task-action" to={actionHref}>
              Cập nhật
              <ArrowRight size={15} />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function StatusActionPicker({
  onChange,
  task,
  value,
}: {
  onChange: (status: string) => void;
  task: EngineerTask;
  value: string;
}) {
  const actions = statusActionOptions(task);

  return (
    <div className="col-span-full grid gap-3 rounded-2xl border border-[#e4e4e7] bg-white/80 p-3">
      <div className="flex items-center justify-between gap-2.5">
        <span className="text-[12px] font-extrabold text-[#52525b]">Chọn bước xử lý</span>
        <strong className="rounded-full border border-[#e4e4e7] bg-[#f4f4f5] px-2.5 py-1.5 text-[12px] text-[#18181b]">{statusLabel(value)}</strong>
      </div>
      <div className="grid grid-cols-2 gap-2.5 max-[760px]:grid-cols-1">
        {actions.map((action) => (
          <button
            className={statusActionCardClass(action.tone, action.value === value)}
            key={action.value}
            onClick={() => onChange(action.value)}
            type="button"
          >
            <strong className="text-[14px] leading-[1.2]">{action.label}</strong>
            <span className="text-[12px] leading-[1.4] text-[#71717a]">{action.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function priorityTaskCardClass(tone: TaskTone) {
  return [
    'grid gap-3 rounded-2xl border bg-white/85 p-3 transition duration-200 ease-out hover:-translate-y-px hover:bg-white hover:shadow-[0_16px_34px_rgba(37,99,235,0.1)] min-[1180px]:grid-cols-[minmax(0,1fr)_minmax(210px,0.36fr)] min-[1180px]:items-center',
    tone === 'danger' ? 'border-[#fecdd3]' : '',
    tone === 'warn' ? 'border-[#fed7aa]' : '',
    tone === 'good' ? 'border-[#bbf7d0]' : '',
    tone === 'neutral' ? 'border-[#e4e4e7]' : '',
  ].filter(Boolean).join(' ');
}

function priorityTaskHeadlineClass(tone: TaskTone) {
  if (tone === 'danger') return 'font-extrabold text-[#b91c1c]';
  if (tone === 'warn') return 'font-extrabold text-[#b45309]';
  return 'font-extrabold text-[#2563eb]';
}

function statusActionCardClass(tone: string, active: boolean) {
  const base = 'grid min-h-[86px] cursor-pointer gap-[5px] rounded-[14px] border bg-white p-3 text-left text-[#18181b] transition duration-200 ease-out hover:-translate-y-px hover:border-[#bfdbfe] hover:shadow-[0_12px_28px_rgba(37,99,235,0.1)]';
  if (!active) return `${base} border-[#e4e4e7]`;
  if (tone === 'good') return `${base} border-[#86efac] shadow-[0_0_0_3px_rgba(34,197,94,0.13)] before:h-[7px] before:w-[7px] before:justify-self-end before:rounded-full before:bg-[#16a34a] before:content-['']`;
  if (tone === 'warn') return `${base} border-[#fed7aa] shadow-[0_0_0_3px_rgba(245,158,11,0.13)] before:h-[7px] before:w-[7px] before:justify-self-end before:rounded-full before:bg-[#d97706] before:content-['']`;
  if (tone === 'danger') return `${base} border-[#fecdd3] shadow-[0_0_0_3px_rgba(244,63,94,0.12)] before:h-[7px] before:w-[7px] before:justify-self-end before:rounded-full before:bg-[#e11d48] before:content-['']`;
  return `${base} border-[#2563eb] shadow-[0_0_0_3px_rgba(37,99,235,0.12)] before:h-[7px] before:w-[7px] before:justify-self-end before:rounded-full before:bg-[#2563eb] before:content-['']`;
}

function statusActionOptions(task: EngineerTask) {
  if (task.kind === 'installation') {
    return installationStatusOptions.map((option) => ({
      ...option,
      label:
        option.value === 'INSTALLED'
          ? 'Đã bàn giao'
          : option.value === 'PENDING'
            ? 'Giữ chờ duyệt'
            : 'Hủy phiếu',
      description:
        option.value === 'INSTALLED'
          ? 'Hoàn tất thông tin bàn giao, bảo hành và gửi admin kiểm tra.'
          : option.value === 'PENDING'
            ? 'Giữ phiếu ở trạng thái chờ nếu chưa đủ thông tin.'
            : 'Dùng khi phiếu không còn thực hiện.',
      tone: option.value === 'INSTALLED' ? 'good' : option.value === 'CANCELLED' ? 'danger' : 'warn',
    }));
  }

  const sourceOptions = task.kind === 'repair' ? repairStatusOptions : maintenanceStatusOptions;
  return sourceOptions.map((option) => ({
    ...option,
    label: statusActionTitle(task.kind, option.value),
    description: statusActionDescription(task.kind, option.value),
    tone: statusActionTone(option.value),
  }));
}

function statusActionTitle(kind: TaskKind, value: string) {
  if (value === 'IN_PROGRESS') return kind === 'maintenance' ? 'Bắt đầu bảo trì' : 'Bắt đầu xử lý';
  if (value === 'WAITING_PARTS') return 'Chờ linh kiện';
  if (value === 'COMPLETED') return 'Hoàn thành';
  if (value === 'CANCELLED') return 'Hủy phiếu';
  return statusLabel(value);
}

function statusActionDescription(kind: TaskKind, value: string) {
  if (value === 'IN_PROGRESS') {
    return kind === 'maintenance' ? 'Đánh dấu phiếu đang được bảo trì tại hiện trường.' : 'Đánh dấu máy đang được kiểm tra hoặc sửa chữa.';
  }
  if (value === 'WAITING_PARTS') return 'Tạm dừng vì cần vật tư, linh kiện hoặc xác nhận thêm.';
  if (value === 'COMPLETED') return 'Nhập kết quả đầy đủ rồi gửi admin kiểm tra.';
  if (value === 'CANCELLED') return 'Dùng khi phiếu không tiếp tục thực hiện.';
  return 'Cập nhật trạng thái phiếu.';
}

function statusActionTone(value: string) {
  if (value === 'COMPLETED' || value === 'INSTALLED') return 'good';
  if (value === 'CANCELLED') return 'danger';
  if (value === 'WAITING_PARTS' || value === 'PENDING') return 'warn';
  return 'neutral';
}

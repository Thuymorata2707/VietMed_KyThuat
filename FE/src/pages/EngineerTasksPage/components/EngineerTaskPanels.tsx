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

      <div className="grid gap-2">
        <Link className="task-action justify-center" to={`/weekly-reports?weekStart=${weekStart}`}>
          <FileText size={16} />
          Mở báo cáo tuần
        </Link>
        <Link className="secondary-button justify-center" to="/my-reports">
          Xem báo cáo của tôi
        </Link>
      </div>
    </aside>
  );
}

export function TodayCommandCenter({
  createLabel = 'Tạo phiếu',
  onCreate,
  onFilter,
  onOpen,
  stats,
  tasks,
}: {
  createLabel?: string;
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
  const quickFilters = [
    { filter: 'revision' as TaskFilter, label: 'Cần bổ sung', value: stats.revision },
    { filter: 'overdue' as TaskFilter, label: 'Quá hạn', value: stats.overdue },
    { filter: 'today' as TaskFilter, label: 'Hôm nay', value: stats.today },
    { filter: 'action' as TaskFilter, label: 'Thiếu hồ sơ', value: stats.missingMachine },
  ];

  return (
    <section className="today-command-center">
      <div className="today-command-center__head">
        <div>
          <span>Ưu tiên hôm nay</span>
          <h2>Việc cần xử lý trước</h2>
        </div>
        <button className="secondary-button flex-none" onClick={onCreate} type="button">
          <Plus size={16} />
          {createLabel}
        </button>
      </div>

      <div className="today-command-center__filters" aria-label="Bộ lọc nhanh">
        {quickFilters.map((item) => (
          <button className="today-command-center__filter" key={item.filter} onClick={() => onFilter(item.filter)} type="button">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="today-command-center__list">
        {tasks.length ? (
          tasks.map((task) => <PriorityTaskCard key={`${task.kind}-${task.id}`} onOpen={onOpen} task={task} />)
        ) : (
          <div className="grid min-h-32 place-items-center gap-1 rounded-2xl border border-dashed border-[#e4e4e7] bg-white p-[18px] text-center text-[#52525b]">
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
        <strong className="min-w-8 rounded-full border border-[#e4e4e7] bg-[#f4f4f5] px-2 py-1 text-center text-[#18181b]">{loading ? '-' : notes.length}</strong>
      </div>
      <div className="grid gap-2">
        {loading ? <div className="text-[12px] text-[#71717a]">Đang tải lịch...</div> : null}
        {!loading && notes.length === 0 ? <div className="text-[12px] text-[#71717a]">Hôm nay chưa có lịch riêng.</div> : null}
        {!loading
          ? notes.slice(0, 4).map((note) => (
              <article className="grid gap-[3px] border-l-[3px] border-[#18181b] pl-2.5" key={note.id}>
                <span className="text-[12px] text-[#71717a]">{formatDailyWorkTime(note)}</span>
                <strong className="text-[14px] leading-[1.35] text-[#18181b]">{note.title}</strong>
              </article>
            ))
          : null}
      </div>
      <Link className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[#18181b] no-underline" to="/daily-work">
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

      <div className="grid min-w-0 content-center gap-2.5 min-[1180px]:w-[260px] min-[1180px]:justify-self-end">
        <span className={`engineer-next-step ${attention.tone} w-full min-w-0 whitespace-normal px-3 py-2 text-center leading-snug`}>{attention.label}</span>
        <div className={`grid min-w-0 gap-2 ${phone ? 'grid-cols-[auto_minmax(0,1fr)] min-[1180px]:grid-cols-[auto_1fr_1fr]' : 'grid-cols-2'}`}>
          {phone ? (
            <a className="task-secondary icon-button h-10 w-10 shrink-0 p-0" href={`tel:${phone}`} title={`Gọi ${phone}`}>
              <PhoneCall size={15} />
            </a>
          ) : null}
          <button className="task-secondary min-w-0 px-3" onClick={() => onOpen(task)} type="button">
            Xem phiếu
          </button>
          {actionHref ? (
            <Link className="task-action min-w-0 px-3" to={actionHref}>
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
  void tone;
  return [
    'grid gap-3 rounded-2xl border border-[#e4e4e7] bg-white p-3 transition duration-200 ease-out hover:-translate-y-px hover:border-[#18181b] hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] min-[1180px]:grid-cols-[minmax(0,1fr)_260px] min-[1180px]:items-center',
  ].filter(Boolean).join(' ');
}

function priorityTaskHeadlineClass(tone: TaskTone) {
  if (tone === 'danger') return 'font-extrabold text-[#b4232f]';
  return 'font-extrabold text-[#18181b]';
}

function statusActionCardClass(tone: string, active: boolean) {
  const base = 'grid min-h-[86px] cursor-pointer gap-[5px] rounded-[14px] border bg-white p-3 text-left text-[#18181b] transition duration-200 ease-out hover:-translate-y-px hover:border-[#18181b] hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]';
  if (!active) return `${base} border-[#e4e4e7]`;
  if (tone === 'danger') return `${base} border-[#b4232f] shadow-[0_0_0_3px_rgba(180,35,47,0.10)] before:h-[7px] before:w-[7px] before:justify-self-end before:rounded-full before:bg-[#b4232f] before:content-['']`;
  return `${base} border-[#18181b] shadow-[0_0_0_3px_rgba(24,24,27,0.08)] before:h-[7px] before:w-[7px] before:justify-self-end before:rounded-full before:bg-[#18181b] before:content-['']`;
}

function isTransitionAllowed(kind: TaskKind, currentStatus: string, nextStatus: string) {
  if (currentStatus === nextStatus) return true;

  const repairTransitions: Record<string, string[]> = {
    PENDING: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    ASSIGNED: ['IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED'],
    IN_PROGRESS: ['WAITING_PARTS', 'COMPLETED', 'CANCELLED'],
    WAITING_PARTS: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };
  const maintenanceTransitions: Record<string, string[]> = {
    SCHEDULED: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED'],
    ASSIGNED: ['IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    OVERDUE: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };
  const installationTransitions: Record<string, string[]> = {
    PENDING: ['INSTALLED', 'CANCELLED'],
    INSTALLED: [],
    CANCELLED: [],
  };

  const transitions =
    kind === 'installation'
      ? installationTransitions
      : kind === 'repair'
        ? repairTransitions
        : maintenanceTransitions;
  return (transitions[currentStatus] ?? []).includes(nextStatus);
}

function statusActionOptions(task: EngineerTask) {
  if (task.kind === 'installation') {
    return installationStatusOptions
      .filter((option) => isTransitionAllowed(task.kind, task.status, option.value))
      .map((option) => ({
        ...option,
        label:
          option.value === 'INSTALLED'
            ? 'Đã bàn giao'
            : option.value === 'PENDING'
              ? 'Giữ chờ duyệt'
              : 'Hủy phiếu',
        description:
          option.value === 'INSTALLED'
            ? 'Hoàn tất thông tin bàn giao, bảo hành và ghi nhận lắp đặt ngay.'
            : option.value === 'PENDING'
              ? 'Giữ phiếu ở trạng thái chờ nếu chưa đủ thông tin.'
              : 'Dùng khi phiếu không còn thực hiện.',
        tone: option.value === 'INSTALLED' ? 'good' : option.value === 'CANCELLED' ? 'danger' : 'warn',
      }));
  }

  const sourceOptions = task.kind === 'repair' ? repairStatusOptions : maintenanceStatusOptions;
  return sourceOptions
    .filter((option) => isTransitionAllowed(task.kind, task.status, option.value))
    .map((option) => ({
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
  if (value === 'COMPLETED') return 'Nhập kết quả đầy đủ và ghi nhận hoàn thành ngay.';
  if (value === 'CANCELLED') return 'Dùng khi phiếu không tiếp tục thực hiện.';
  return 'Cập nhật trạng thái phiếu.';
}

function statusActionTone(value: string) {
  if (value === 'COMPLETED' || value === 'INSTALLED') return 'good';
  if (value === 'CANCELLED') return 'danger';
  if (value === 'WAITING_PARTS' || value === 'PENDING') return 'warn';
  return 'neutral';
}

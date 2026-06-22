import { BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, Trash2, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';

type DailyWorkCalendarPageProps = {
  currentRole: RoleName;
  user: ApiUser;
};

type DailyWorkNote = {
  id: string;
  title: string;
  note?: string | null;
  workDate: string;
  startTime?: string | null;
  endTime?: string | null;
  color?: string | null;
  type?: DailyWorkType;
  status?: DailyWorkStatus;
  rejectReason?: string | null;
  reviewer?: Pick<ApiUser, 'id' | 'email' | 'fullName'> | null;
  user?: ApiUser;
};

type DailyWorkType = 'WORK' | 'BUSINESS_TRIP' | 'LEAVE' | 'REPAIR' | 'INSTALLATION' | 'MAINTENANCE' | 'OTHER';
type DailyWorkStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

type NoteForm = {
  title: string;
  note: string;
  workDate: string;
  startTime: string;
  endTime: string;
  color: string;
  type: DailyWorkType;
};

const colorOptions = [
  { label: 'Đỏ', value: '#c83f34' },
  { label: 'Xanh lá', value: '#177245' },
  { label: 'Xanh dương', value: '#2f5f98' },
  { label: 'Vàng', value: '#9b5a17' },
];

const scheduleTypeOptions = [
  { label: 'Công tác', type: 'BUSINESS_TRIP', title: 'Công tác', color: '#2f5f98', note: 'Đăng ký lịch công tác.' },
  { label: 'Nghỉ phép', type: 'LEAVE', title: 'Nghỉ phép', color: '#9b5a17', note: 'Đăng ký nghỉ phép.' },
  { label: 'Sửa chữa', type: 'REPAIR', title: 'Sửa chữa', color: '#c83f34', note: 'Lịch sửa chữa tại khách hàng.' },
  { label: 'Lắp đặt', type: 'INSTALLATION', title: 'Lắp đặt', color: '#177245', note: 'Lịch lắp đặt/bàn giao thiết bị.' },
  { label: 'Bảo trì', type: 'MAINTENANCE', title: 'Bảo trì/Bảo dưỡng', color: '#7a5af8', note: 'Lịch bảo trì hoặc bảo dưỡng định kỳ.' },
] satisfies Array<{
  label: string;
  type: DailyWorkType;
  title: string;
  color: string;
  note: string;
}>;

const workTypeLabels: Record<DailyWorkType, string> = {
  WORK: 'Công việc',
  BUSINESS_TRIP: 'Công tác',
  LEAVE: 'Nghỉ phép',
  REPAIR: 'Sửa chữa',
  INSTALLATION: 'Lắp đặt',
  MAINTENANCE: 'Bảo trì',
  OTHER: 'Khác',
};

const statusMeta: Record<DailyWorkStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Nháp', className: 'border-[#d9e1ea] bg-white text-[#657386]' },
  PENDING: { label: 'Chờ duyệt', className: 'border-[#efd8a8] bg-[#fffaeb] text-[#9b5a17]' },
  APPROVED: { label: 'Đã duyệt', className: 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]' },
  REJECTED: { label: 'Từ chối', className: 'border-[#f4c9c4] bg-[#fff6f4] text-[#a3342b]' },
  CANCELLED: { label: 'Đã hủy', className: 'border-[#d9e1ea] bg-[#f8fafc] text-[#657386]' },
};

const workTypeOptions: Array<{ value: DailyWorkType; label: string }> = [
  { value: 'WORK', label: 'Công việc chung' },
  { value: 'BUSINESS_TRIP', label: 'Công tác' },
  { value: 'LEAVE', label: 'Nghỉ phép' },
  { value: 'REPAIR', label: 'Sửa chữa' },
  { value: 'INSTALLATION', label: 'Lắp đặt' },
  { value: 'MAINTENANCE', label: 'Bảo trì/Bảo dưỡng' },
  { value: 'OTHER', label: 'Khác' },
];

const weekdayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function DailyWorkCalendarPage({ currentRole, user }: DailyWorkCalendarPageProps) {
  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));
  const [notes, setNotes] = useState<DailyWorkNote[]>([]);
  const [engineers, setEngineers] = useState<ApiUser[]>([]);
  const [selectedEngineerId, setSelectedEngineerId] = useState(currentRole === 'admin' ? '' : user.id);
  const [selectedDayDate, setSelectedDayDate] = useState('');
  const [editingNote, setEditingNote] = useState<DailyWorkNote | null>(null);
  const [form, setForm] = useState<NoteForm>(() => emptyForm(toDateInput(new Date())));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const isAdmin = currentRole === 'admin';
  const canEditExisting = !isAdmin;
  const canCreate = !isAdmin || Boolean(selectedEngineerId);

  useEffect(() => {
    if (!isAdmin) return;
    loadEngineers();
  }, [isAdmin]);

  useEffect(() => {
    loadNotes();
  }, [viewDate, selectedEngineerId, isAdmin]);

  const calendarDays = useMemo(() => buildCalendarDays(viewDate), [viewDate]);
  const notesByDate = useMemo(() => {
    return notes.reduce<Record<string, DailyWorkNote[]>>((map, note) => {
      const key = toDateInput(note.workDate);
      map[key] = [...(map[key] || []), note];
      return map;
    }, {});
  }, [notes]);

  async function loadEngineers() {
    try {
      const result = await apiFetch<Paginated<ApiUser>>('/users?limit=100&roleName=engineer&status=ACTIVE');
      setEngineers(result.data);
      setSelectedEngineerId((current) => current || result.data[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách kỹ sư.');
    }
  }

  async function loadNotes() {
    if (isAdmin && !selectedEngineerId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const from = toDateInput(startOfMonth(viewDate));
    const to = toDateInput(endOfMonth(viewDate));
    const query = new URLSearchParams({ from, to });
    if (isAdmin && selectedEngineerId) query.set('userId', selectedEngineerId);

    try {
      const result = await apiFetch<DailyWorkNote[]>(`/daily-work-notes?${query.toString()}`);
      setNotes(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được lịch công việc.');
    } finally {
      setLoading(false);
    }
  }

  function openCreate(date: Date) {
    if (!canCreate) return;
    setEditingNote(null);
    setForm(emptyForm(toDateInput(date)));
    setIsModalOpen(true);
    setSelectedDayDate('');
    setError('');
    setSuccess('');
  }

  function applySchedulePreset(preset: (typeof scheduleTypeOptions)[number]) {
    setForm((current) => ({
      ...current,
      title: current.title || preset.title,
      note: current.note || preset.note,
      color: preset.color,
      type: preset.type,
    }));
  }

  function openEdit(note: DailyWorkNote) {
    if (!canEditExisting) {
      setSelectedDayDate(toDateInput(note.workDate));
      return;
    }
    setEditingNote(note);
    setForm({
      title: note.title,
      note: note.note || '',
      workDate: toDateInput(note.workDate),
      startTime: note.startTime || '',
      endTime: note.endTime || '',
      color: note.color || colorOptions[0].value,
      type: note.type || 'WORK',
    });
    setIsModalOpen(true);
    setSelectedDayDate('');
    setError('');
    setSuccess('');
  }

  function openDay(date: Date) {
    if (isAdmin) {
      setSelectedDayDate(toDateInput(date));
      setError('');
      setSuccess('');
      return;
    }

    openCreate(date);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        title: form.title.trim(),
        note: form.note.trim() || null,
        workDate: form.workDate,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        color: form.color,
        type: form.type,
        userId: isAdmin ? selectedEngineerId : undefined,
      };

      if (editingNote) {
        await apiFetch(`/daily-work-notes/${editingNote.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setSuccess('Đã cập nhật ghi chú công việc.');
      } else {
        await apiFetch('/daily-work-notes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess(isAdmin ? 'Đã thêm việc cho kỹ sư.' : 'Đã thêm ghi chú công việc.');
      }

      setIsModalOpen(false);
      setSelectedDayDate('');
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được ghi chú.');
    } finally {
      setSaving(false);
    }
  }

  async function removeNote() {
    if (!editingNote) return;
    setSaving(true);
    setError('');

    try {
      await apiFetch(`/daily-work-notes/${editingNote.id}`, { method: 'DELETE' });
      setSuccess('Đã xóa ghi chú công việc.');
      setIsModalOpen(false);
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được ghi chú.');
    } finally {
      setSaving(false);
    }
  }

  async function reviewNote(note: DailyWorkNote, status: Extract<DailyWorkStatus, 'APPROVED' | 'REJECTED'>) {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiFetch(`/daily-work-notes/${note.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      setSuccess(status === 'APPROVED' ? 'Đã duyệt lịch công việc.' : 'Đã từ chối lịch công việc.');
      await loadNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được trạng thái lịch.');
    } finally {
      setSaving(false);
    }
  }

  const selectedEngineer = engineers.find((engineer) => engineer.id === selectedEngineerId);
  const selectedDayNotes = selectedDayDate ? notesByDate[selectedDayDate] || [] : [];

  return (
    <PageFrame>
      <section className="flex min-w-0 items-end justify-between gap-[18px] rounded-[18px] bg-[linear-gradient(135deg,#142033_0%,#202939_56%,#a3342b_120%)] p-6 text-white max-[1180px]:grid max-[1180px]:items-stretch">
        <div className="min-w-0">
          <span className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-[#ffd9d5]"><CalendarDays size={15} /> Lịch kỹ sư</span>
          <h1 className="mb-2.5 text-[clamp(30px,4vw,46px)] font-medium leading-none">{isAdmin ? selectedEngineer?.fullName || 'Theo dõi kỹ sư' : 'Lịch làm việc của tôi'}</h1>
          <p className="text-white/80">{isAdmin ? 'Admin theo dõi lịch công tác, nghỉ phép và việc phát sinh của kỹ sư.' : 'Đăng ký công tác, nghỉ phép và ghi chú lịch sửa chữa, lắp đặt, bảo trì.'}</p>
        </div>
        {isAdmin ? (
          <label className="grid min-w-0 gap-2 font-medium text-white/80 min-[1180px]:min-w-[min(360px,100%)]">
            Chọn kỹ sư
            <select
              className="min-h-11 rounded-[10px] border border-white/35 bg-white/95 px-3 text-[#142033]"
              onChange={(event) => {
                setSelectedEngineerId(event.target.value);
                setSelectedDayDate('');
              }}
              value={selectedEngineerId}
            >
              {engineers.map((engineer) => (
                <option key={engineer.id} value={engineer.id}>
                  {engineer.fullName || engineer.email}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="grid gap-3 md:grid-cols-5">
        {scheduleTypeOptions.map((option) => (
          <button
            className="grid min-h-[76px] gap-2 rounded-[14px] border border-[#d9e1ea] bg-white p-3 text-left shadow-[0_1px_2px_rgba(20,32,51,0.04)] transition hover:-translate-y-px hover:border-[#b8cbe1]"
            key={option.label}
            onClick={() => {
              openCreate(new Date());
              setTimeout(() => applySchedulePreset(option), 0);
            }}
            type="button"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ backgroundColor: option.color }}>
              <BriefcaseBusiness size={16} />
            </span>
            <strong className="text-sm text-[#142033]">{option.label}</strong>
          </button>
        ))}
      </section>

      <section className="min-w-0 overflow-hidden rounded-[14px] border border-[#d9e1ea] bg-white shadow-[0_1px_2px_rgba(20,32,51,0.04)] max-[1180px]:overflow-x-auto">
        <div className="flex min-w-0 items-center justify-between gap-4 border-b border-[#e8edf3] p-4 max-[1180px]:grid max-[1180px]:items-stretch">
          <div className="min-w-0">
            <strong className="block text-xl capitalize text-[#142033]">{monthLabel(viewDate)}</strong>
            <span className="mt-1 block text-[#657386]">{loading ? 'Đang tải lịch...' : `${notes.length} ghi chú trong tháng`}</span>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <button className="secondary-button" onClick={() => setViewDate(addMonths(viewDate, -1))} type="button">
              <ChevronLeft size={17} />
              Tháng trước
            </button>
            <button className="secondary-button" onClick={() => setViewDate(startOfMonth(new Date()))} type="button">
              Hôm nay
            </button>
            <button className="secondary-button" onClick={() => setViewDate(addMonths(viewDate, 1))} type="button">
              Tháng sau
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 max-[1180px]:min-w-[760px]">
          {weekdayLabels.map((label) => (
            <span className="border-b border-[#e8edf3] bg-[#f8fbfd] p-[11px] text-center text-xs font-medium text-[#657386]" key={label}>{label}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 max-[1180px]:min-w-[760px]">
          {calendarDays.map((day) => {
            const key = toDateInput(day.date);
            const dayNotes = notesByDate[key] || [];
            return (
              <button
                className={[
                  'group relative grid min-h-[132px] gap-2 border-0 border-b border-r border-[#e8edf3] bg-white p-2.5 text-left text-[#142033] hover:bg-[#fffdfb] max-[900px]:min-h-[116px]',
                  day.date.getDay() === 6 ? 'border-r-0' : '',
                  day.inMonth ? '' : 'bg-[#fbfcfe] text-[#9aa6b5]',
                  isSameDate(day.date, new Date()) ? 'shadow-[inset_0_0_0_2px_#c83f34]' : '',
                ].filter(Boolean).join(' ')}
                key={key}
                onClick={() => openDay(day.date)}
                type="button"
              >
                <span className="font-bold">{day.date.getDate()}</span>
                <div className="grid content-start gap-1">
                  {dayNotes.slice(0, 3).map((note) => (
                    <span
                      className="grid gap-0.5 overflow-hidden rounded-md border-l-[3px] bg-white px-[7px] py-[5px] text-xs leading-snug text-[#142033] shadow-[0_1px_3px_rgba(20,32,51,0.08)]"
                      key={note.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(note);
                      }}
                      style={{ borderColor: note.color || colorOptions[0].value }}
                    >
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{note.startTime ? `${note.startTime} ` : ''}{note.title}</span>
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[#657386]">
                        {workTypeLabels[note.type || 'WORK']} · {statusMeta[note.status || 'APPROVED'].label}
                      </span>
                    </span>
                  ))}
                  {dayNotes.length > 3 ? <small className="text-[#657386]">+{dayNotes.length - 3} việc khác</small> : null}
                </div>
                {canCreate ? <Plus className="absolute right-2.5 top-2.5 text-[#c83f34] opacity-0 group-hover:opacity-100" size={15} /> : null}
              </button>
            );
          })}
        </div>
      </section>

      {selectedDayDate ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/30 p-5 backdrop-blur-[3px]" onClick={() => setSelectedDayDate('')} role="presentation">
          <section aria-modal="true" className="grid w-full max-w-[720px] gap-4 rounded-[14px] border border-[#d9e1ea] bg-white p-5 shadow-[0_24px_70px_rgba(20,32,51,0.2)]" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="block text-xs font-medium text-[#c83f34]">Công việc trong ngày</span>
                <h2 className="mt-1 text-[#142033]">{formatDateTitle(selectedDayDate)}</h2>
                <p className="mt-1 text-sm text-[#657386]">{selectedEngineer?.fullName || selectedEngineer?.email || 'Kỹ sư'}</p>
              </div>
              <button className="icon-button" onClick={() => setSelectedDayDate('')} type="button">
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-2">
              {selectedDayNotes.map((note) => (
                <article className="rounded-lg border border-[#e8edf3] bg-[#f8fbfd] p-3" key={note.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <strong className="text-[#142033]">{note.title}</strong>
                      <span className="rounded-full border border-[#d9e1ea] bg-white px-2.5 py-1 text-xs font-medium text-[#657386]">
                        {workTypeLabels[note.type || 'WORK']}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusMeta[note.status || 'APPROVED'].className}`}>
                        {statusMeta[note.status || 'APPROVED'].label}
                      </span>
                    </div>
                    <span className="rounded-full border border-[#d9e1ea] bg-white px-2.5 py-1 text-xs font-medium text-[#657386]">
                      {[note.startTime, note.endTime].filter(Boolean).join(' - ') || 'Cả ngày'}
                    </span>
                  </div>
                  {note.note ? <p className="mt-2 text-sm leading-relaxed text-[#334155]">{note.note}</p> : null}
                  {note.rejectReason ? <p className="mt-2 rounded-lg border border-[#f4c9c4] bg-white px-3 py-2 text-sm text-[#a3342b]">Lý do: {note.rejectReason}</p> : null}
                  {isAdmin && note.status === 'PENDING' ? (
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button className="secondary-button" disabled={saving} onClick={() => reviewNote(note, 'REJECTED')} type="button">
                        Từ chối
                      </button>
                      <button className="primary-button" disabled={saving} onClick={() => reviewNote(note, 'APPROVED')} type="button">
                        Duyệt lịch
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}

              {selectedDayNotes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fbfd] p-6 text-center text-sm text-[#657386]">
                  Ngày này chưa có công việc nào.
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-[#e8edf3] pt-4">
              <button className="secondary-button" onClick={() => setSelectedDayDate('')} type="button">Đóng</button>
              <button className="primary-button" disabled={!selectedEngineerId} onClick={() => openCreate(dateFromInput(selectedDayDate))} type="button">
                <Plus size={16} />
                Thêm việc cho kỹ sư
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/30 p-5 backdrop-blur-[3px]" role="presentation">
          <section aria-modal="true" className="grid w-full max-w-[720px] gap-[18px] rounded-[14px] border border-[#d9e1ea] bg-white p-5 shadow-[0_24px_70px_rgba(20,32,51,0.2)]" role="dialog">
            <div className="flex items-start justify-between">
              <div>
                <span className="block text-xs font-medium text-[#c83f34]">{editingNote ? 'Sửa ghi chú' : isAdmin ? 'Thêm việc cho kỹ sư' : 'Thêm ghi chú'}</span>
                <h2 className="mt-1 text-[#142033]">{formatDateTitle(form.workDate)}</h2>
                {isAdmin ? <p className="mt-1 text-sm text-[#657386]">{selectedEngineer?.fullName || selectedEngineer?.email}</p> : null}
              </div>
              <button className="icon-button" onClick={() => setIsModalOpen(false)} type="button">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 rounded-lg border border-[#e8edf3] bg-[#f8fafc] p-2">
              {scheduleTypeOptions.map((option) => (
                <button
                  className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-[#d9e1ea] bg-white px-2.5 text-xs font-semibold text-[#334155] hover:border-[#b8cbe1]"
                  key={option.label}
                  onClick={() => applySchedulePreset(option)}
                  type="button"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color }} />
                  {option.label}
                </button>
              ))}
            </div>
            <form className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1 [&_input]:min-h-[42px] [&_input]:rounded-lg [&_input]:border [&_input]:border-[#cbd5e1] [&_input]:px-3 [&_input]:text-[#142033] [&_input]:outline-none [&_input:focus]:border-[#c83f34] [&_input:focus]:shadow-[0_0_0_3px_rgba(200,63,52,0.12)] [&_label]:grid [&_label]:gap-2 [&_label]:font-medium [&_label]:text-[#334155] [&_select]:min-h-[42px] [&_select]:rounded-lg [&_select]:border [&_select]:border-[#cbd5e1] [&_select]:px-3 [&_select]:text-[#142033] [&_select]:outline-none [&_select:focus]:border-[#c83f34] [&_select:focus]:shadow-[0_0_0_3px_rgba(200,63,52,0.12)] [&_textarea]:min-h-[110px] [&_textarea]:resize-y [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#cbd5e1] [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:text-[#142033] [&_textarea]:outline-none [&_textarea:focus]:border-[#c83f34] [&_textarea:focus]:shadow-[0_0_0_3px_rgba(200,63,52,0.12)]" onSubmit={handleSubmit}>
              <label>
                Loại lịch
                <select onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as DailyWorkType }))} value={form.type}>
                  {workTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Tiêu đề công việc
                <input onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required value={form.title} />
              </label>
              <label>
                Ngày
                <input onChange={(event) => setForm((current) => ({ ...current, workDate: event.target.value }))} required type="date" value={form.workDate} />
              </label>
              <label>
                Bắt đầu
                <input onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} type="time" value={form.startTime} />
              </label>
              <label>
                Kết thúc
                <input onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} type="time" value={form.endTime} />
              </label>
              <label>
                Màu
                <select onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} value={form.color}>
                  {colorOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="col-span-full max-sm:col-auto">
                Ghi chú
                <textarea onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} value={form.note} />
              </label>
              <div className="col-span-full flex justify-end gap-2.5 border-t border-[#e8edf3] pt-3.5">
                {editingNote && canEditExisting ? (
                  <button className="danger-button" disabled={saving} onClick={removeNote} type="button">
                    <Trash2 size={16} />
                    Xóa
                  </button>
                ) : null}
                <button className="secondary-button" onClick={() => setIsModalOpen(false)} type="button">Hủy</button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? <Loader2 className="spin-icon" size={16} /> : null}
                  {saving ? 'Đang lưu' : 'Lưu ghi chú'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </PageFrame>
  );
}

function emptyForm(workDate: string): NoteForm {
  return {
    title: '',
    note: '',
    workDate,
    startTime: '',
    endTime: '',
    color: colorOptions[0].value,
    type: 'WORK',
  };
}

function buildCalendarDays(date: Date) {
  const start = startOfMonth(date);
  const firstDay = start.getDay();
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - firstDay);

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + index);
    return {
      date: current,
      inMonth: current.getMonth() === date.getMonth(),
    };
  });
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function toDateInput(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromInput(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isSameDate(left: Date, right: Date) {
  return toDateInput(left) === toDateInput(right);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
}

function formatDateTitle(value: string) {
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

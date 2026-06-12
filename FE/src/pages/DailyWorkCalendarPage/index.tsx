import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2, X } from 'lucide-react';
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
  user?: ApiUser;
};

type NoteForm = {
  title: string;
  note: string;
  workDate: string;
  startTime: string;
  endTime: string;
  color: string;
};

const colorOptions = [
  { label: 'Đỏ', value: '#c92a1f' },
  { label: 'Xanh lá', value: '#027a48' },
  { label: 'Xanh dương', value: '#175cd3' },
  { label: 'Vàng', value: '#b54708' },
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

  const selectedEngineer = engineers.find((engineer) => engineer.id === selectedEngineerId);
  const selectedDayNotes = selectedDayDate ? notesByDate[selectedDayDate] || [] : [];

  return (
    <PageFrame>
      <section className="flex items-end justify-between gap-[18px] rounded-[18px] bg-[linear-gradient(135deg,#17202a_0%,#253142_56%,#a61f17_120%)] p-6 text-white max-[900px]:grid max-[900px]:items-stretch">
        <div>
          <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.08em] text-[#ffd9d5]">Lịch công việc</span>
          <h1 className="mb-2.5 text-[clamp(30px,4vw,46px)] font-bold leading-none">{isAdmin ? selectedEngineer?.fullName || 'Theo dõi kỹ sư' : 'Công việc hàng ngày của tôi'}</h1>
          <p className="text-white/80">{isAdmin ? 'Admin chọn kỹ sư để xem lịch công việc cá nhân.' : 'Ghi lại kế hoạch, việc phát sinh và ghi chú theo ngày.'}</p>
        </div>
        {isAdmin ? (
          <label className="grid min-w-[min(360px,100%)] gap-2 font-bold text-white/80">
            Chọn kỹ sư
            <select
              className="min-h-11 rounded-[10px] border border-white/35 bg-white/95 px-3 text-[#17202a]"
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

      <section className="overflow-hidden rounded-[14px] border border-[#dfe7ef] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] max-sm:overflow-x-auto">
        <div className="flex items-center justify-between gap-4 border-b border-[#edf1f6] p-4 max-[900px]:grid max-[900px]:items-stretch">
          <div>
            <strong className="block text-xl capitalize text-[#17202a]">{monthLabel(viewDate)}</strong>
            <span className="mt-1 block text-[#657384]">{loading ? 'Đang tải lịch...' : `${notes.length} ghi chú trong tháng`}</span>
          </div>
          <div className="flex flex-wrap gap-2">
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

        <div className="grid grid-cols-7 max-sm:min-w-[760px]">
          {weekdayLabels.map((label) => (
            <span className="border-b border-[#edf1f6] bg-[#f8fbfd] p-[11px] text-center text-xs font-extrabold text-[#657384]" key={label}>{label}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 max-sm:min-w-[760px]">
          {calendarDays.map((day) => {
            const key = toDateInput(day.date);
            const dayNotes = notesByDate[key] || [];
            return (
              <button
                className={[
                  'group relative grid min-h-[132px] gap-2 border-0 border-b border-r border-[#edf1f6] bg-white p-2.5 text-left text-[#17202a] hover:bg-[#fffdfb] max-[900px]:min-h-[116px]',
                  day.date.getDay() === 6 ? 'border-r-0' : '',
                  day.inMonth ? '' : 'bg-[#fbfcfe] text-[#9aa6b5]',
                  isSameDate(day.date, new Date()) ? 'shadow-[inset_0_0_0_2px_#c92a1f]' : '',
                ].filter(Boolean).join(' ')}
                key={key}
                onClick={() => openDay(day.date)}
                type="button"
              >
                <span className="font-extrabold">{day.date.getDate()}</span>
                <div className="grid content-start gap-1">
                  {dayNotes.slice(0, 3).map((note) => (
                    <span
                      className="overflow-hidden text-ellipsis whitespace-nowrap rounded-md border-l-[3px] bg-white px-[7px] py-[5px] text-xs leading-snug text-[#17202a] shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
                      key={note.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(note);
                      }}
                      style={{ borderColor: note.color || colorOptions[0].value }}
                    >
                      {note.startTime ? `${note.startTime} ` : ''}{note.title}
                    </span>
                  ))}
                  {dayNotes.length > 3 ? <small className="text-[#657384]">+{dayNotes.length - 3} việc khác</small> : null}
                </div>
                {canCreate ? <Plus className="absolute right-2.5 top-2.5 text-[#c92a1f] opacity-0 group-hover:opacity-100" size={15} /> : null}
              </button>
            );
          })}
        </div>
      </section>

      {selectedDayDate ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/30 p-5 backdrop-blur-[3px]" onClick={() => setSelectedDayDate('')} role="presentation">
          <section aria-modal="true" className="grid w-full max-w-[720px] gap-4 rounded-[14px] border border-[#dfe7ef] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.2)]" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="block text-xs font-extrabold uppercase text-[#c92a1f]">Công việc trong ngày</span>
                <h2 className="mt-1 text-[#17202a]">{formatDateTitle(selectedDayDate)}</h2>
                <p className="mt-1 text-sm text-[#657384]">{selectedEngineer?.fullName || selectedEngineer?.email || 'Kỹ sư'}</p>
              </div>
              <button className="icon-button" onClick={() => setSelectedDayDate('')} type="button">
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-2">
              {selectedDayNotes.map((note) => (
                <article className="rounded-lg border border-[#edf1f6] bg-[#f8fbfd] p-3" key={note.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-[#17202a]">{note.title}</strong>
                    <span className="rounded-full border border-[#dfe7ef] bg-white px-2.5 py-1 text-xs font-bold text-[#657384]">
                      {[note.startTime, note.endTime].filter(Boolean).join(' - ') || 'Cả ngày'}
                    </span>
                  </div>
                  {note.note ? <p className="mt-2 text-sm leading-relaxed text-[#405064]">{note.note}</p> : null}
                </article>
              ))}

              {selectedDayNotes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#ced8e3] bg-[#f8fbfd] p-6 text-center text-sm text-[#657384]">
                  Ngày này chưa có công việc nào.
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-[#edf1f6] pt-4">
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
          <section aria-modal="true" className="grid w-full max-w-[720px] gap-[18px] rounded-[14px] border border-[#dfe7ef] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.2)]" role="dialog">
            <div className="flex items-start justify-between">
              <div>
                <span className="block text-xs font-extrabold uppercase text-[#c92a1f]">{editingNote ? 'Sửa ghi chú' : isAdmin ? 'Thêm việc cho kỹ sư' : 'Thêm ghi chú'}</span>
                <h2 className="mt-1 text-[#17202a]">{formatDateTitle(form.workDate)}</h2>
                {isAdmin ? <p className="mt-1 text-sm text-[#657384]">{selectedEngineer?.fullName || selectedEngineer?.email}</p> : null}
              </div>
              <button className="icon-button" onClick={() => setIsModalOpen(false)} type="button">
                <X size={16} />
              </button>
            </div>
            <form className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1 [&_input]:min-h-[42px] [&_input]:rounded-lg [&_input]:border [&_input]:border-[#ced8e3] [&_input]:px-3 [&_input]:text-[#17202a] [&_input]:outline-none [&_input:focus]:border-[#c92a1f] [&_input:focus]:shadow-[0_0_0_3px_rgba(201,42,31,0.1)] [&_label]:grid [&_label]:gap-2 [&_label]:font-bold [&_label]:text-[#405064] [&_select]:min-h-[42px] [&_select]:rounded-lg [&_select]:border [&_select]:border-[#ced8e3] [&_select]:px-3 [&_select]:text-[#17202a] [&_select]:outline-none [&_select:focus]:border-[#c92a1f] [&_select:focus]:shadow-[0_0_0_3px_rgba(201,42,31,0.1)] [&_textarea]:min-h-[110px] [&_textarea]:resize-y [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#ced8e3] [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:text-[#17202a] [&_textarea]:outline-none [&_textarea:focus]:border-[#c92a1f] [&_textarea:focus]:shadow-[0_0_0_3px_rgba(201,42,31,0.1)]" onSubmit={handleSubmit}>
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
              <div className="col-span-full flex justify-end gap-2.5 border-t border-[#edf1f6] pt-3.5">
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

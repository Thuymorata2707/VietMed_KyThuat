import { BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, Trash2, X } from 'lucide-react';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { queryKeys } from '../../lib/queryKeys';

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

type DailyWorkPayload = {
  title: string;
  note: string | null;
  workDate: string;
  startTime: string | null;
  endTime: string | null;
  color: string;
  type: DailyWorkType;
  userId?: string;
};

const colorOptions = [
  { label: 'Đỏ', value: '#d71920' },
  { label: 'Xanh lá', value: '#177245' },
  { label: 'Xanh dương', value: '#2563eb' },
  { label: 'Vàng', value: '#9b5a17' },
];

const scheduleTypeOptions = [
  { label: 'Công tác', type: 'BUSINESS_TRIP', title: 'Công tác', color: '#d71920', note: 'Đăng ký lịch công tác.' },
  { label: 'Nghỉ phép', type: 'LEAVE', title: 'Nghỉ phép', color: '#9b5a17', note: 'Đăng ký nghỉ phép.' },
  { label: 'Sửa chữa', type: 'REPAIR', title: 'Sửa chữa', color: '#d71920', note: 'Lịch sửa chữa tại khách hàng.' },
  { label: 'Lắp đặt', type: 'INSTALLATION', title: 'Lắp đặt', color: '#177245', note: 'Lịch lắp đặt/bàn giao thiết bị.' },
  { label: 'Bảo trì', type: 'MAINTENANCE', title: 'Bảo trì/Bảo dưỡng', color: '#9b5a17', note: 'Lịch bảo trì hoặc bảo dưỡng định kỳ.' },
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
  DRAFT: { label: 'Nháp', className: 'border-[#e5e5e5] bg-white text-[#666666]' },
  PENDING: { label: 'Chờ duyệt', className: 'border-[#efd8a8] bg-[#fffaeb] text-[#9b5a17]' },
  APPROVED: { label: 'Đã duyệt', className: 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]' },
  REJECTED: { label: 'Từ chối', className: 'border-[#f5c7cb] bg-[#fff5f5] text-[#b5121b]' },
  CANCELLED: { label: 'Đã hủy', className: 'border-[#e5e5e5] bg-[#fafafa] text-[#666666]' },
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
  const queryClient = useQueryClient();
  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));
  const [selectedEngineerId, setSelectedEngineerId] = useState(currentRole === 'admin' ? '' : user.id);
  const [selectedDayDate, setSelectedDayDate] = useState('');
  const [editingNote, setEditingNote] = useState<DailyWorkNote | null>(null);
  const [form, setForm] = useState<NoteForm>(() => emptyForm(toDateInput(new Date())));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const isAdmin = currentRole === 'admin';
  const canEditExisting = !isAdmin;
  const canCreate = !isAdmin || Boolean(selectedEngineerId);

  const engineersQuery = useQuery({
    enabled: isAdmin,
    queryKey: queryKeys.dailyWork.engineers,
    queryFn: async () => {
      const result = await apiFetch<Paginated<ApiUser>>('/users?limit=100&roleName=engineer&status=ACTIVE');
      return result.data;
    },
  });

  const engineers = engineersQuery.data ?? [];

  useEffect(() => {
    if (!isAdmin) return;
    setSelectedEngineerId((current) => current || engineers[0]?.id || '');
  }, [engineers, isAdmin]);

  const notesParams = useMemo(() => {
    const from = toDateInput(startOfMonth(viewDate));
    const to = toDateInput(endOfMonth(viewDate));
    const params = new URLSearchParams({ from, to });
    if (isAdmin && selectedEngineerId) params.set('userId', selectedEngineerId);
    return params.toString();
  }, [isAdmin, selectedEngineerId, viewDate]);

  const notesQuery = useQuery({
    enabled: !isAdmin || Boolean(selectedEngineerId),
    queryKey: queryKeys.dailyWork.notes(notesParams),
    queryFn: () => apiFetch<DailyWorkNote[]>(`/daily-work-notes?${notesParams}`),
  });

  const notes = notesQuery.data ?? [];
  const loading = notesQuery.isLoading || notesQuery.isFetching || engineersQuery.isFetching;

  const saveNoteMutation = useMutation({
    mutationFn: async ({ noteId, payload }: { noteId?: string; payload: DailyWorkPayload }) => {
      return noteId
        ? apiFetch(`/daily-work-notes/${noteId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : apiFetch('/daily-work-notes', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
    },
    onSuccess: async (_result, variables) => {
      setSuccess(variables.noteId ? 'Đã cập nhật ghi chú công việc.' : isAdmin ? 'Đã thêm việc cho kỹ sư.' : 'Đã thêm ghi chú công việc.');
      setIsModalOpen(false);
      setSelectedDayDate('');
      await invalidateDailyWorkData(queryClient);
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => apiFetch(`/daily-work-notes/${noteId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setSuccess('Đã xóa ghi chú công việc.');
      setIsModalOpen(false);
      await invalidateDailyWorkData(queryClient);
    },
  });

  const reviewNoteMutation = useMutation({
    mutationFn: ({ note, status }: { note: DailyWorkNote; status: Extract<DailyWorkStatus, 'APPROVED' | 'REJECTED'> }) =>
      apiFetch(`/daily-work-notes/${note.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }).then(() => status),
    onSuccess: async (status) => {
      setSuccess(status === 'APPROVED' ? 'Đã duyệt lịch công việc.' : 'Đã từ chối lịch công việc.');
      await invalidateDailyWorkData(queryClient);
    },
  });

  const saving = saveNoteMutation.isPending || deleteNoteMutation.isPending || reviewNoteMutation.isPending;
  const mutationError = saveNoteMutation.error ?? deleteNoteMutation.error ?? reviewNoteMutation.error;
  const error =
    formError ||
    (engineersQuery.error instanceof Error ? engineersQuery.error.message : '') ||
    (notesQuery.error instanceof Error ? notesQuery.error.message : '') ||
    (mutationError instanceof Error ? mutationError.message : '');

  const calendarDays = useMemo(() => buildCalendarDays(viewDate), [viewDate]);
  const notesByDate = useMemo(() => {
    return notes.reduce<Record<string, DailyWorkNote[]>>((map, note) => {
      const key = toDateInput(note.workDate);
      map[key] = [...(map[key] || []), note];
      return map;
    }, {});
  }, [notes]);

  function openCreate(date: Date) {
    if (!canCreate) return;
    setEditingNote(null);
    setForm(emptyForm(toDateInput(date)));
    setIsModalOpen(true);
    setSelectedDayDate('');
    setFormError('');
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
    setFormError('');
    setSuccess('');
  }

  function openDay(date: Date) {
    if (isAdmin) {
      setSelectedDayDate(toDateInput(date));
      setFormError('');
      setSuccess('');
      return;
    }

    openCreate(date);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setSuccess('');

    try {
      const payload: DailyWorkPayload = {
        title: form.title.trim(),
        note: form.note.trim() || null,
        workDate: form.workDate,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        color: form.color,
        type: form.type,
        userId: isAdmin ? selectedEngineerId : undefined,
      };

      await saveNoteMutation.mutateAsync({ noteId: editingNote?.id, payload });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không lưu được ghi chú.');
    }
  }

  async function removeNote() {
    if (!editingNote) return;
    setFormError('');

    try {
      await deleteNoteMutation.mutateAsync(editingNote.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không xóa được ghi chú.');
    }
  }

  async function reviewNote(note: DailyWorkNote, status: Extract<DailyWorkStatus, 'APPROVED' | 'REJECTED'>) {
    setFormError('');
    setSuccess('');

    try {
      await reviewNoteMutation.mutateAsync({ note, status });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không cập nhật được trạng thái lịch.');
    }
  }

  const selectedEngineer = engineers.find((engineer) => engineer.id === selectedEngineerId);
  const selectedDayNotes = selectedDayDate ? notesByDate[selectedDayDate] || [] : [];

  return (
    <PageFrame>
      <section className="relative flex min-w-0 items-end justify-between gap-[18px] overflow-hidden rounded-[28px] border border-[#f0d7d9] bg-[#fffafa] p-6 text-[#1f1f1f] shadow-[0_22px_60px_rgba(120,20,28,0.08)] max-[1180px]:grid max-[1180px]:items-stretch">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(215,25,32,0.12),transparent_30%),radial-gradient(circle_at_86%_8%,rgba(255,214,220,0.55),transparent_28%),linear-gradient(135deg,#fffafa,#ffffff_55%,#f8fbfd)]" />
        <div className="relative z-10 min-w-0">
          <span className="relative mb-2 inline-flex items-center gap-2 rounded-xl border border-[#f0d7d9] bg-white/75 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#d71920]"><CalendarDays size={15} /> Lịch kỹ sư</span>
          <h1 className="relative mb-2.5 text-[clamp(30px,4vw,46px)] font-extrabold leading-none">{isAdmin ? selectedEngineer?.fullName || 'Theo dõi kỹ sư' : 'Lịch làm việc của tôi'}</h1>
          <p className="relative max-w-3xl text-sm font-semibold leading-6 text-[#666666]">{isAdmin ? 'Xem lịch công tác, nghỉ phép và việc trong ngày của kỹ sư.' : 'Đăng ký lịch đi công tác, nghỉ phép và ghi chú việc trong ngày.'}</p>
        </div>
        {isAdmin ? (
          <label className="relative z-10 grid min-w-0 gap-2 text-sm font-bold text-[#333333] min-[1180px]:min-w-[min(360px,100%)]">
            Chọn kỹ sư
            <select
              className="min-h-12 rounded-2xl border border-[#ded8d8] bg-white/95 px-4 text-sm font-semibold text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_4px_rgba(215,25,32,0.12)]"
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
            className="grid min-h-[76px] gap-2 rounded-[14px] border border-[#e5e5e5] bg-white p-3 text-left shadow-[0_1px_2px_rgba(20,32,51,0.04)] transition hover:-translate-y-px hover:border-[#b8cbe1]"
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
            <strong className="text-sm text-[#1f1f1f]">{option.label}</strong>
          </button>
        ))}
      </section>

      <section className="min-w-0 overflow-hidden rounded-[14px] border border-[#e5e5e5] bg-white shadow-[0_1px_2px_rgba(20,32,51,0.04)] max-[1180px]:overflow-x-auto">
        <div className="flex min-w-0 items-center justify-between gap-4 border-b border-[#eeeeee] p-4 max-[1180px]:grid max-[1180px]:items-stretch">
          <div className="min-w-0">
            <strong className="block text-xl capitalize text-[#1f1f1f]">{monthLabel(viewDate)}</strong>
            <span className="mt-1 block text-[#666666]">{loading ? 'Đang tải lịch...' : `${notes.length} ghi chú trong tháng`}</span>
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
            <span className="border-b border-[#eeeeee] bg-[#f8fbfd] p-[11px] text-center text-xs font-medium text-[#666666]" key={label}>{label}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 max-[1180px]:min-w-[760px]">
          {calendarDays.map((day) => {
            const key = toDateInput(day.date);
            const dayNotes = notesByDate[key] || [];
            return (
              <button
                className={[
                  'group relative grid min-h-[132px] gap-2 border-0 border-b border-r border-[#eeeeee] bg-white p-2.5 text-left text-[#1f1f1f] hover:bg-[#fffdfb] max-[900px]:min-h-[116px]',
                  day.date.getDay() === 6 ? 'border-r-0' : '',
                  day.inMonth ? '' : 'bg-[#ffffff] text-[#9aa6b5]',
                  isSameDate(day.date, new Date()) ? 'shadow-[inset_0_0_0_2px_#d71920]' : '',
                ].filter(Boolean).join(' ')}
                key={key}
                onClick={() => openDay(day.date)}
                type="button"
              >
                <span className="font-bold">{day.date.getDate()}</span>
                <div className="grid content-start gap-1">
                  {dayNotes.slice(0, 3).map((note) => (
                    <span
                      className="grid gap-0.5 overflow-hidden rounded-md border-l-[3px] bg-white px-[7px] py-[5px] text-xs leading-snug text-[#1f1f1f] shadow-[0_1px_3px_rgba(20,32,51,0.08)]"
                      key={note.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(note);
                      }}
                      style={{ borderColor: note.color || colorOptions[0].value }}
                    >
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{note.startTime ? `${note.startTime} ` : ''}{note.title}</span>
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[#666666]">
                        {workTypeLabels[note.type || 'WORK']} · {statusMeta[note.status || 'APPROVED'].label}
                      </span>
                    </span>
                  ))}
                  {dayNotes.length > 3 ? <small className="text-[#666666]">+{dayNotes.length - 3} việc khác</small> : null}
                </div>
                {canCreate ? <Plus className="absolute right-2.5 top-2.5 text-[#d71920] opacity-0 group-hover:opacity-100" size={15} /> : null}
              </button>
            );
          })}
        </div>
      </section>

      {selectedDayDate ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/30 p-5 backdrop-blur-[3px]" onClick={() => setSelectedDayDate('')} role="presentation">
          <section aria-modal="true" className="grid w-full max-w-[720px] gap-4 rounded-[14px] border border-[#e5e5e5] bg-white p-5 shadow-[0_24px_70px_rgba(20,32,51,0.2)]" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="block text-xs font-medium text-[#d71920]">Công việc trong ngày</span>
                <h2 className="mt-1 text-[#1f1f1f]">{formatDateTitle(selectedDayDate)}</h2>
                <p className="mt-1 text-sm text-[#666666]">{selectedEngineer?.fullName || selectedEngineer?.email || 'Kỹ sư'}</p>
              </div>
              <button className="icon-button" onClick={() => setSelectedDayDate('')} type="button">
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-2">
              {selectedDayNotes.map((note) => (
                <article className="rounded-lg border border-[#eeeeee] bg-[#f8fbfd] p-3" key={note.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <strong className="text-[#1f1f1f]">{note.title}</strong>
                      <span className="rounded-full border border-[#e5e5e5] bg-white px-2.5 py-1 text-xs font-medium text-[#666666]">
                        {workTypeLabels[note.type || 'WORK']}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusMeta[note.status || 'APPROVED'].className}`}>
                        {statusMeta[note.status || 'APPROVED'].label}
                      </span>
                    </div>
                    <span className="rounded-full border border-[#e5e5e5] bg-white px-2.5 py-1 text-xs font-medium text-[#666666]">
                      {[note.startTime, note.endTime].filter(Boolean).join(' - ') || 'Cả ngày'}
                    </span>
                  </div>
                  {note.note ? <p className="mt-2 text-sm leading-relaxed text-[#333333]">{note.note}</p> : null}
                  {note.rejectReason ? <p className="mt-2 rounded-lg border border-[#f5c7cb] bg-white px-3 py-2 text-sm text-[#b5121b]">Lý do: {note.rejectReason}</p> : null}
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
                <div className="rounded-lg border border-dashed border-[#d6d6d6] bg-[#f8fbfd] p-6 text-center text-sm text-[#666666]">
                  Ngày này chưa có công việc nào.
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-[#eeeeee] pt-4">
              <button className="secondary-button" onClick={() => setSelectedDayDate('')} type="button">Close</button>
              <button className="primary-button" disabled={!selectedEngineerId} onClick={() => openCreate(dateFromInput(selectedDayDate))} type="button">
                <Plus size={16} />
                Add task
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/30 p-5 backdrop-blur-[3px]" role="presentation">
          <section aria-modal="true" className="grid w-full max-w-[720px] gap-[18px] rounded-[14px] border border-[#e5e5e5] bg-white p-5 shadow-[0_24px_70px_rgba(20,32,51,0.2)]" role="dialog">
            <div className="flex items-start justify-between">
              <div>
                <span className="block text-xs font-medium text-[#d71920]">{editingNote ? 'Edit note' : isAdmin ? 'Add task' : 'Add note'}</span>
                <h2 className="mt-1 text-[#1f1f1f]">{formatDateTitle(form.workDate)}</h2>
                {isAdmin ? <p className="mt-1 text-sm text-[#666666]">{selectedEngineer?.fullName || selectedEngineer?.email}</p> : null}
              </div>
              <button className="icon-button" onClick={() => setIsModalOpen(false)} type="button">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 rounded-lg border border-[#eeeeee] bg-[#fafafa] p-2">
              {scheduleTypeOptions.map((option) => (
                <button
                  className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-2.5 text-xs font-semibold text-[#333333] hover:border-[#b8cbe1]"
                  key={option.label}
                  onClick={() => applySchedulePreset(option)}
                  type="button"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color }} />
                  {option.label}
                </button>
              ))}
            </div>
            <form className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1 [&_input]:min-h-[42px] [&_input]:rounded-lg [&_input]:border [&_input]:border-[#d6d6d6] [&_input]:px-3 [&_input]:text-[#1f1f1f] [&_input]:outline-none [&_input:focus]:border-[#d71920] [&_input:focus]:shadow-[0_0_0_3px_rgba(215,25,32,0.12)] [&_label]:grid [&_label]:gap-2 [&_label]:font-medium [&_label]:text-[#333333] [&_select]:min-h-[42px] [&_select]:rounded-lg [&_select]:border [&_select]:border-[#d6d6d6] [&_select]:px-3 [&_select]:text-[#1f1f1f] [&_select]:outline-none [&_select:focus]:border-[#d71920] [&_select:focus]:shadow-[0_0_0_3px_rgba(215,25,32,0.12)] [&_textarea]:min-h-[110px] [&_textarea]:resize-y [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#d6d6d6] [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:text-[#1f1f1f] [&_textarea]:outline-none [&_textarea:focus]:border-[#d71920] [&_textarea:focus]:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]" onSubmit={handleSubmit}>
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
              <div className="col-span-full flex justify-end gap-2.5 border-t border-[#eeeeee] pt-3.5">
                {editingNote && canEditExisting ? (
                  <button className="danger-button" disabled={saving} onClick={removeNote} type="button">
                    <Trash2 size={16} />
                    Delete
                  </button>
                ) : null}
                <button className="secondary-button" onClick={() => setIsModalOpen(false)} type="button">Cancel</button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? <Loader2 className="spin-icon" size={16} /> : null}
                  {saving ? 'Saving' : 'Save'}
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

async function invalidateDailyWorkData(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['daily-work', 'notes'] }),
    queryClient.invalidateQueries({ queryKey: ['weekly-reports', 'daily-rows'] }),
  ]);
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

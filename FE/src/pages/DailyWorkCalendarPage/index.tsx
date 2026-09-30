import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, Trash2, Umbrella } from 'lucide-react';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useState } from 'react';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { DateInput } from '../../components/DateInput';
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

type DailyWorkType = 'WORK' | 'BUSINESS_TRIP' | 'LEAVE' | 'UNPAID_LEAVE' | 'REPAIR' | 'INSTALLATION' | 'MAINTENANCE' | 'OTHER';
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
  { label: 'Đỏ', value: '#18181b' },
  { label: 'Xanh lá', value: '#177245' },
  { label: 'Xanh dương', value: '#2563eb' },
  { label: 'Vàng', value: '#9b5a17' },
];

const scheduleTypeOptions = [
  { label: 'Văn phòng', type: 'WORK', title: 'Làm việc tại văn phòng', color: '#2563eb' },
  { label: 'Công tác', type: 'BUSINESS_TRIP', title: 'Công tác', color: '#18181b' },
  { label: 'Nghỉ phép', type: 'LEAVE', title: 'Nghỉ phép', color: '#9b5a17' },
  { label: 'Nghỉ không phép', type: 'UNPAID_LEAVE', title: 'Nghỉ không phép', color: '#b5121b' },
  { label: 'Sửa chữa', type: 'REPAIR', title: 'Sửa chữa', color: '#18181b' },
  { label: 'Lắp đặt', type: 'INSTALLATION', title: 'Lắp đặt', color: '#177245' },
  { label: 'Bảo trì', type: 'MAINTENANCE', title: 'Bảo trì/Bảo dưỡng', color: '#9b5a17' },
] satisfies Array<{
  label: string;
  type: DailyWorkType;
  title: string;
  color: string;
}>;

const workTypeLabels: Record<DailyWorkType, string> = {
  WORK: 'Làm việc tại văn phòng',
  BUSINESS_TRIP: 'Công tác',
  LEAVE: 'Nghỉ phép',
  UNPAID_LEAVE: 'Nghỉ không phép',
  REPAIR: 'Sửa chữa',
  INSTALLATION: 'Lắp đặt',
  MAINTENANCE: 'Bảo trì',
  OTHER: 'Khác',
};

const statusMeta: Record<DailyWorkStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Nháp', className: 'border-[#e5e5e5] bg-white text-[#666666]' },
  PENDING: { label: 'Chờ phê duyệt', className: 'border-[#efd8a8] bg-[#fffaeb] text-[#9b5a17]' },
  APPROVED: { label: 'Đã phê duyệt', className: 'border-[#b9e8ca] bg-[#eefaf3] text-[#177245]' },
  REJECTED: { label: 'Từ chối', className: 'border-[#fecdd3] bg-[#fff1f3] text-[#b5121b]' },
  CANCELLED: { label: 'Đã hủy', className: 'border-[#e5e5e5] bg-[#fafafa] text-[#666666]' },
};

const weekdayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function DailyWorkCalendarPage({ currentRole, user }: DailyWorkCalendarPageProps) {
  const queryClient = useQueryClient();
  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));
  const [selectedEngineerId, setSelectedEngineerId] = useState(currentRole === 'admin' ? '' : user.id);
  const [selectedDayDate, setSelectedDayDate] = useState('');
  const [editingNote, setEditingNote] = useState<DailyWorkNote | null>(null);
  const [form, setForm] = useState<NoteForm>(() => emptyForm(toDateInput(new Date())));
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const isAdmin = currentRole === 'admin';
  const canEditExisting = !isAdmin;
  const canCreate = !isAdmin || Boolean(selectedEngineerId);

  const engineersQuery = useQuery({
    enabled: isAdmin,
    queryKey: queryKeys.dailyWork.engineers,
    queryFn: async () => {
      const result = await apiFetch<Paginated<ApiUser>>('/users?limit=100&status=ACTIVE');
      return result?.data ?? [];
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

  const yearNotesParams = useMemo(() => {
    const year = viewDate.getFullYear();
    const params = new URLSearchParams({ from: `${year}-01-01`, to: `${year}-12-31` });
    if (isAdmin && selectedEngineerId) params.set('userId', selectedEngineerId);
    return params.toString();
  }, [isAdmin, selectedEngineerId, viewDate]);

  const yearNotesQuery = useQuery({
    enabled: !isAdmin || Boolean(selectedEngineerId),
    queryKey: queryKeys.dailyWork.notes(yearNotesParams),
    queryFn: () => apiFetch<DailyWorkNote[]>(`/daily-work-notes?${yearNotesParams}`),
  });

  const notes = notesQuery.data ?? [];
  const yearNotes = yearNotesQuery.data ?? [];
  const loading = notesQuery.isLoading || notesQuery.isFetching || yearNotesQuery.isFetching || engineersQuery.isFetching;

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
      setEditingNote(null);
      setForm(emptyForm(variables.payload.workDate));
      setSelectedDayDate('');
      await invalidateDailyWorkData(queryClient);
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => apiFetch(`/daily-work-notes/${noteId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setSuccess('Đã xóa ghi chú công việc.');
      setEditingNote(null);
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
      setSuccess(status === 'APPROVED' ? 'Đã phê duyệt lịch công việc.' : 'Đã từ chối lịch công việc.');
      await invalidateDailyWorkData(queryClient);
    },
  });

  const calendarDays = useMemo(() => buildCalendarDays(viewDate), [viewDate]);
  const notesByDate = useMemo(() => {
    return notes.reduce<Record<string, DailyWorkNote[]>>((map, note) => {
      const key = toDateInput(note.workDate);
      map[key] = [...(map[key] || []), note];
      return map;
    }, {});
  }, [notes]);

  const bulkOfficeMutation = useMutation({
    mutationFn: async () => {
      const monthWorkDays = calendarDays
        .filter((day) => day.inMonth && day.date.getDay() !== 0)
        .map((day) => toDateInput(day.date))
        .filter((dateKey) => !(notesByDate[dateKey] || []).some(isActiveSchedule));

      await Promise.all(
        monthWorkDays.map((workDate) =>
          apiFetch('/daily-work-notes', {
            method: 'POST',
            body: JSON.stringify({
              color: '#2563eb',
              endTime: null,
              note: null,
              startTime: null,
              title: 'Làm việc tại văn phòng',
              type: 'WORK',
              userId: isAdmin ? selectedEngineerId : undefined,
              workDate,
            }),
          }),
        ),
      );

      return monthWorkDays.length;
    },
    onSuccess: async (createdCount) => {
      setSuccess(createdCount ? `Đã tạo ${createdCount} ngày làm việc văn phòng.` : 'Tháng này đã có lịch.');
      await invalidateDailyWorkData(queryClient);
    },
  });

  const saving = saveNoteMutation.isPending || deleteNoteMutation.isPending || reviewNoteMutation.isPending || bulkOfficeMutation.isPending;
  const mutationError = saveNoteMutation.error ?? deleteNoteMutation.error ?? reviewNoteMutation.error ?? bulkOfficeMutation.error;
  const error =
    formError ||
    (engineersQuery.error instanceof Error ? engineersQuery.error.message : '') ||
    (notesQuery.error instanceof Error ? notesQuery.error.message : '') ||
    (yearNotesQuery.error instanceof Error ? yearNotesQuery.error.message : '') ||
    (mutationError instanceof Error ? mutationError.message : '');

  useEffect(() => {
    setSelectedDayDate((current) => current || form.workDate);
  }, [form.workDate]);

  function openCreate(date: Date) {
    if (!canCreate) return;
    const dateKey = toDateInput(date);
    setEditingNote(null);
    setForm(emptyForm(dateKey));
    setSelectedDayDate(dateKey);
    setFormError('');
    setSuccess('');
  }

  function applySchedulePreset(preset: (typeof scheduleTypeOptions)[number]) {
    const dayNotes = notesByDate[form.workDate] || [];
    if (!isLeaveType(preset.type) && hasActiveLeave(dayNotes, editingNote?.id)) {
      setFormError('Ngày đã đăng ký nghỉ, không thêm lịch khác.');
      return;
    }
    setFormError('');
    setForm((current) => ({
      ...current,
      title: shouldReplacePresetTitle(current.title) ? preset.title : current.title,
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
    setSelectedDayDate(toDateInput(note.workDate));
    setFormError('');
    setSuccess('');
  }

  function openDay(date: Date) {
    openCreate(date);
  }

  async function createOfficeMonth() {
    setFormError('');
    setSuccess('');

    try {
      await bulkOfficeMutation.mutateAsync();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không tạo được lịch văn phòng tháng.');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setSuccess('');

    try {
      const dayNotes = notesByDate[form.workDate] || [];
      const hasLeaveConflict = isLeaveType(form.type)
        ? hasActiveWork(dayNotes, editingNote?.id)
        : hasActiveLeave(dayNotes, editingNote?.id);

      if (hasLeaveConflict) {
        setFormError('Ngày đã đăng ký nghỉ thì không thêm lịch khác.');
        return;
      }

      const payload: DailyWorkPayload = {
        title: form.title.trim() || workTypeLabels[form.type],
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

  async function removeNote(noteToDelete = editingNote) {
    if (!noteToDelete) return;
    setFormError('');

    try {
      await deleteNoteMutation.mutateAsync(noteToDelete.id);
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
  const leaveSummary = useMemo(() => buildLeaveSummary(viewDate, notes, yearNotes), [notes, viewDate, yearNotes]);

  return (
    <PageFrame>
      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="grid gap-3 rounded-[18px] border border-[#e5e5e5] bg-white p-4 shadow-[0_8px_22px_rgba(24,24,27,0.05)]">
        <div className="grid gap-3 min-[1180px]:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)_auto] min-[1180px]:items-center">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 text-xs font-extrabold text-[#64748b]">
              <CalendarDays size={15} />
              Lịch kỹ sư
            </span>
            <h2 className="mt-1 truncate text-2xl font-extrabold leading-tight text-[#18181b]">
              {isAdmin ? selectedEngineer?.fullName || 'Theo dõi kỹ sư' : 'Lịch làm việc của tôi'}
            </h2>
          </div>

          <LeaveCompactSummary leaveSummary={leaveSummary} />

          {isAdmin ? (
            <label className="grid min-w-0 gap-1.5 text-sm font-bold text-[#333333] min-[1180px]:min-w-[300px]">
              Chọn nhân sự
              <select
                className="min-h-11 rounded-[14px] border border-[#ded8d8] bg-[#fafafa] px-3 text-sm font-semibold text-[#1f1f1f] outline-none focus:border-[#18181b] focus:bg-white focus:shadow-[0_0_0_4px_rgba(24,24,27,0.12)]"
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
        </div>

      </section>

      <div className="grid gap-4 min-[1180px]:grid-cols-[minmax(0,1fr)_410px] min-[1180px]:items-start">
        <section className="min-w-0 overflow-hidden rounded-[18px] border border-[#e5e5e5] bg-white shadow-[0_10px_26px_rgba(24,24,27,0.05)]">
          <div className="flex min-w-0 items-center justify-between gap-4 border-b border-[#eeeeee] p-4 max-[1180px]:grid max-[1180px]:items-stretch">
            <div className="min-w-0">
              <strong className="block text-xl capitalize text-[#1f1f1f]">{monthLabel(viewDate)}</strong>
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              <button className="secondary-button compact" disabled={saving || !canCreate} onClick={() => void createOfficeMonth()} type="button">
                {bulkOfficeMutation.isPending ? <Loader2 className="spin-icon" size={16} /> : <Plus size={16} />}
                Tạo văn phòng tháng
              </button>
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

          <MonthWorkBoard
            calendarDays={calendarDays}
            notesByDate={notesByDate}
            onEdit={openEdit}
            onSelectDay={openDay}
            selectedDate={selectedDayDate || form.workDate}
          />
        </section>

        <DailyWorkSidePanel
          canCreate={canCreate}
          canEditExisting={canEditExisting}
          editingNote={editingNote}
          form={form}
          notes={notesByDate[selectedDayDate || form.workDate] || []}
          onCancelEdit={() => {
            setEditingNote(null);
            setForm(emptyForm(form.workDate));
            setFormError('');
          }}
          onChange={setForm}
          onDelete={() => void removeNote()}
          onDeleteNote={(note) => void removeNote(note)}
          onEdit={openEdit}
          onPreset={applySchedulePreset}
          onReview={reviewNote}
          onSelectDate={(dateKey) => {
            setSelectedDayDate(dateKey);
            setEditingNote(null);
          }}
          onSubmit={handleSubmit}
          saving={saving}
          selectedDate={selectedDayDate || form.workDate}
          showReviewActions={isAdmin}
        />
      </div>

    </PageFrame>
  );
}

function emptyForm(workDate: string): NoteForm {
  return {
    title: 'Làm việc tại văn phòng',
    note: '',
    workDate,
    startTime: '',
    endTime: '',
    color: '#2563eb',
    type: 'WORK',
  };
}

function shouldReplacePresetTitle(title: string) {
  const normalized = title.trim();
  if (!normalized) return true;
  return scheduleTypeOptions.some((option) => option.title === normalized) || Object.values(workTypeLabels).includes(normalized);
}

function MonthWorkBoard({
  calendarDays,
  notesByDate,
  onEdit,
  onSelectDay,
  selectedDate,
}: {
  calendarDays: Array<{ date: Date; inMonth: boolean }>;
  notesByDate: Record<string, DailyWorkNote[]>;
  onEdit: (note: DailyWorkNote) => void;
  onSelectDay: (date: Date) => void;
  selectedDate: string;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7">
          {weekdayLabels.map((label) => (
            <span className="border-b border-[#eeeeee] bg-[#fafafa] p-[11px] text-center text-xs font-bold text-[#667085]" key={label}>{label}</span>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map((day) => {
            const dateKey = toDateInput(day.date);
            const dayNotes = notesByDate[dateKey] || [];
            const activeNotes = dayNotes.filter(isActiveSchedule);
            const primaryNote = activeNotes[0];
            const selected = selectedDate === dateKey;
            const today = isSameDate(day.date, new Date());

            return (
              <button
                className={[
                  'grid min-h-[92px] content-start gap-2 border-0 border-b border-r border-[#eeeeee] bg-white p-2.5 text-left transition hover:bg-[#fafafa]',
                  day.date.getDay() === 6 ? 'border-r-0' : '',
                  day.inMonth ? '' : 'bg-[#fbfbfb] text-[#a1a8b3]',
                  selected ? 'shadow-[inset_0_0_0_2px_#18181b]' : '',
                ].filter(Boolean).join(' ')}
                key={dateKey}
                onClick={() => onSelectDay(day.date)}
                type="button"
              >
                <span className="flex items-center justify-between gap-2">
                  <strong className={today ? 'grid h-7 w-7 place-items-center rounded-full bg-[#18181b] text-sm text-white' : 'text-sm text-[#18181b]'}>
                    {day.date.getDate()}
                  </strong>
                  {activeNotes.length ? <em className="not-italic rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[11px] font-bold text-[#667085]">{activeNotes.length}</em> : null}
                </span>

                {primaryNote ? (
                  <span className="grid gap-1">
                    <span className="flex items-center gap-1.5">
                      {activeNotes.slice(0, 4).map((note) => (
                        <span className="h-2 w-2 rounded-full" key={note.id} style={{ backgroundColor: note.color || colorOptions[0].value }} />
                      ))}
                    </span>
                    <span
                      className="truncate text-xs font-bold text-[#333333]"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(primaryNote);
                      }}
                    >
                      {workTypeLabels[primaryNote.type || 'WORK']}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-[#a1a8b3]">{day.date.getDay() === 0 ? 'CN' : ''}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DailyWorkSidePanel({
  canCreate,
  canEditExisting,
  editingNote,
  form,
  notes,
  onCancelEdit,
  onChange,
  onDelete,
  onDeleteNote,
  onEdit,
  onPreset,
  onReview,
  onSelectDate,
  onSubmit,
  saving,
  selectedDate,
  showReviewActions,
}: {
  canCreate: boolean;
  canEditExisting: boolean;
  editingNote: DailyWorkNote | null;
  form: NoteForm;
  notes: DailyWorkNote[];
  onCancelEdit: () => void;
  onChange: Dispatch<SetStateAction<NoteForm>>;
  onDelete: () => void;
  onDeleteNote: (note: DailyWorkNote) => void;
  onEdit: (note: DailyWorkNote) => void;
  onPreset: (preset: (typeof scheduleTypeOptions)[number]) => void;
  onReview: (note: DailyWorkNote, status: Extract<DailyWorkStatus, 'APPROVED' | 'REJECTED'>) => void;
  onSelectDate: (dateKey: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  selectedDate: string;
  showReviewActions: boolean;
}) {
  const isEditing = Boolean(editingNote);

  return (
    <aside className="order-first grid gap-3 rounded-[18px] border border-[#e5e5e5] bg-white p-4 shadow-[0_10px_26px_rgba(24,24,27,0.05)] min-[1180px]:sticky min-[1180px]:top-4 min-[1180px]:order-last">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-extrabold text-[#64748b]">Ngày đang chọn</span>
          <h2 className="mt-1 text-xl font-extrabold text-[#18181b]">{formatDateTitle(selectedDate)}</h2>
        </div>
        {isEditing ? (
          <button className="secondary-button compact" onClick={onCancelEdit} type="button">
            Hủy sửa
          </button>
        ) : null}
      </div>

      <div className="grid gap-2 rounded-[14px] bg-[#fafafa] p-2">
        {notes.length ? notes.map((note) => (
          <article className="grid gap-2 rounded-[12px] bg-white p-3 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.06)]" key={note.id}>
            <div className="grid gap-2">
              <div className="flex items-start justify-between gap-2">
                <button className="grid min-w-0 flex-1 gap-1 text-left" onClick={() => onEdit(note)} type="button">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: note.color || colorOptions[0].value }} />
                    <strong className="truncate text-sm text-[#18181b]">{note.title}</strong>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusMeta[note.status || 'APPROVED'].className}`}>
                      {statusMeta[note.status || 'APPROVED'].label}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-[#667085]">
                    {workTypeLabels[note.type || 'WORK']} · {[note.startTime, note.endTime].filter(Boolean).join(' - ') || 'Cả ngày'}
                  </span>
                </button>
                {canEditExisting ? (
                  <div className="flex shrink-0 gap-1">
                    <button className="secondary-button compact !min-h-8 !px-2.5 text-xs" disabled={saving} onClick={() => onEdit(note)} type="button">
                      Sửa
                    </button>
                    <button className="danger-button compact !min-h-8 !px-2.5 text-xs" disabled={saving} onClick={() => onDeleteNote(note)} type="button">
                      Xóa
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            {showReviewActions && note.status === 'PENDING' ? (
              <div className="flex justify-end gap-2">
                <button className="secondary-button compact" disabled={saving} onClick={() => onReview(note, 'REJECTED')} type="button">Từ chối</button>
                <button className="primary-button compact" disabled={saving} onClick={() => onReview(note, 'APPROVED')} type="button">Duyệt</button>
              </div>
            ) : null}
          </article>
        )) : (
          <div className="rounded-[12px] border border-dashed border-[#d6d6d6] bg-white p-4 text-center text-sm font-semibold text-[#667085]">
            Chưa có lịch.
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {scheduleTypeOptions.map((option) => (
          <button
            className={[
              'inline-flex min-h-10 items-center gap-2 rounded-[12px] border px-3 text-sm font-semibold transition',
              form.type === option.type ? 'border-[#18181b] bg-[#18181b] text-white' : 'border-[#e5e5e5] bg-[#fafafa] text-[#333333] hover:border-[#b8cbe1] hover:bg-white',
            ].join(' ')}
            key={option.label}
            onClick={() => onPreset(option)}
            type="button"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color }} />
            {option.label}
          </button>
        ))}
      </div>

      <form className="grid gap-3 [&_input]:min-h-[42px] [&_input]:rounded-lg [&_input]:border [&_input]:border-[#d6d6d6] [&_input]:px-3 [&_input]:text-[#1f1f1f] [&_input]:outline-none [&_input:focus]:border-[#18181b] [&_input:focus]:shadow-[0_0_0_3px_rgba(24,24,27,0.12)] [&_label]:grid [&_label]:gap-2 [&_label]:text-sm [&_label]:font-bold [&_label]:text-[#333333] [&_select]:min-h-[42px] [&_select]:rounded-lg [&_select]:border [&_select]:border-[#d6d6d6] [&_select]:px-3 [&_select]:text-[#1f1f1f] [&_select]:outline-none [&_select:focus]:border-[#18181b] [&_select:focus]:shadow-[0_0_0_3px_rgba(24,24,27,0.12)] [&_textarea]:min-h-[92px] [&_textarea]:resize-y [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#d6d6d6] [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:text-[#1f1f1f] [&_textarea]:outline-none [&_textarea:focus]:border-[#18181b] [&_textarea:focus]:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]" onSubmit={onSubmit}>
        <DateInput
          label="Ngày"
          onChange={(value) => {
            onChange((current) => ({ ...current, workDate: value }));
            if (value) onSelectDate(value);
          }}
          required
          value={form.workDate}
        />

        <label>
          Nội dung
          <input onChange={(event) => onChange((current) => ({ ...current, title: event.target.value }))} placeholder={workTypeLabels[form.type]} value={form.title} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label>
            Bắt đầu
            <input onChange={(event) => onChange((current) => ({ ...current, startTime: event.target.value }))} type="time" value={form.startTime} />
          </label>
          <label>
            Kết thúc
            <input onChange={(event) => onChange((current) => ({ ...current, endTime: event.target.value }))} type="time" value={form.endTime} />
          </label>
        </div>

        <label>
          Ghi chú
          <textarea onChange={(event) => onChange((current) => ({ ...current, note: event.target.value }))} value={form.note} />
        </label>

        <div className="grid gap-2 border-t border-[#eeeeee] pt-3">
          <button className="primary-button justify-center" disabled={!canCreate || saving} type="submit">
            {saving ? <Loader2 className="spin-icon" size={16} /> : <Plus size={16} />}
            {saving ? 'Đang lưu' : isEditing ? 'Cập nhật' : 'Lưu lịch'}
          </button>
          {isEditing && canEditExisting ? (
            <button className="danger-button justify-center" disabled={saving} onClick={onDelete} type="button">
              <Trash2 size={16} />
              Xóa lịch
            </button>
          ) : null}
        </div>
      </form>
    </aside>
  );
}

function LeaveCompactSummary({ leaveSummary }: { leaveSummary: ReturnType<typeof buildLeaveSummary> }) {
  const items = [
    {
      label: 'Phép tháng',
      value: `${formatWorkCount(leaveSummary.monthlyLeaveUsed)}/1`,
    },
    {
      label: 'Phép năm',
      value: `${formatWorkCount(leaveSummary.yearlyLeaveUsed)}/12`,
    },
    {
      label: 'Công tháng',
      value: formatWorkCount(leaveSummary.actualWork),
    },
  ];

  return (
    <div className="grid gap-2 rounded-[14px] bg-[#fafafa] p-2 sm:grid-cols-3">
      {items.map((item) => (
        <div className="grid min-w-0 gap-1 rounded-[12px] bg-white px-3 py-2 shadow-[inset_0_0_0_1px_rgba(24,24,27,0.06)]" key={item.label}>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#64748b]">
            <Umbrella size={13} />
            {item.label}
          </span>
          <span className="flex items-end justify-between gap-2">
            <strong className="text-xl leading-none text-[#18181b]">{item.value}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

function buildLeaveSummary(viewDate: Date, monthNotes: DailyWorkNote[], yearNotes: DailyWorkNote[]) {
  const standardWork = countStandardWork(startOfMonth(viewDate), endOfMonth(viewDate));
  const approvedMonthlyLeaveNotes = monthNotes.filter(isCountableLeave);
  const approvedYearlyLeaveNotes = yearNotes.filter(isCountableLeave);
  const approvedMonthlyUnpaidLeaveNotes = monthNotes.filter(isCountableUnpaidLeave);
  const monthlyLeaveUsed = sumLeaveDays(approvedMonthlyLeaveNotes);
  const yearlyLeaveUsed = sumLeaveDays(approvedYearlyLeaveNotes);
  const monthlyUnpaidLeaveUsed = sumLeaveDays(approvedMonthlyUnpaidLeaveNotes);
  const accruedLeave = Math.min(viewDate.getMonth() + 1, 12);
  const yearlyLeaveRemaining = Math.max(12 - yearlyLeaveUsed, 0);
  const monthlyLeaveRemaining = Math.max(1 - monthlyLeaveUsed, 0);
  const actualWork = Math.max(standardWork - monthlyLeaveUsed - monthlyUnpaidLeaveUsed, 0);

  return {
    accruedLeave,
    actualWork,
    monthlyLeaveRemaining,
    monthlyLeaveUsed,
    monthlyUnpaidLeaveUsed,
    standardWork,
    yearlyLeaveRemaining,
    yearlyLeaveUsed,
  };
}

function isCountableLeave(note: DailyWorkNote) {
  return note.type === 'LEAVE' && note.status !== 'REJECTED' && note.status !== 'CANCELLED';
}

function isCountableUnpaidLeave(note: DailyWorkNote) {
  return note.type === 'UNPAID_LEAVE' && note.status !== 'REJECTED' && note.status !== 'CANCELLED';
}

function sumLeaveDays(notes: DailyWorkNote[]) {
  return notes.reduce((total, note) => total + countLeaveValue(note), 0);
}

function countLeaveValue(note: DailyWorkNote) {
  const date = dateFromInput(toDateInput(note.workDate));
  const workValue = workDayValue(date);
  if (!note.startTime || !note.endTime || workValue === 0) return workValue;

  const timedValue = timeRangeWorkValue(date, note.startTime, note.endTime);
  return Math.min(workValue, timedValue || workValue);
}

function countStandardWork(from: Date, to: Date) {
  let total = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    total += workDayValue(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

function workDayValue(date: Date) {
  const weekday = date.getDay();
  if (weekday === 0) return 0;
  return 1;
}

function timeRangeWorkValue(date: Date, startTime: string, endTime: string) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null || end <= start) return 0;

  const weekday = date.getDay();
  const morning = overlapMinutes(start, end, 8 * 60, 12 * 60);
  const afternoon = overlapMinutes(start, end, 13 * 60, 17 * 60);
  return (morning + afternoon) / (8 * 60);
}

function parseTimeToMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function overlapMinutes(start: number, end: number, rangeStart: number, rangeEnd: number) {
  return Math.max(0, Math.min(end, rangeEnd) - Math.max(start, rangeStart));
}

function formatWorkCount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function isLeaveType(type: DailyWorkType) {
  return type === 'LEAVE' || type === 'UNPAID_LEAVE';
}

function isActiveSchedule(note: DailyWorkNote) {
  return note.status !== 'REJECTED' && note.status !== 'CANCELLED';
}

function hasActiveLeave(notes: DailyWorkNote[], excludeId?: string) {
  return notes.some((note) => note.id !== excludeId && isActiveSchedule(note) && isLeaveType(note.type || 'WORK'));
}

function hasActiveWork(notes: DailyWorkNote[], excludeId?: string) {
  return notes.some((note) => note.id !== excludeId && isActiveSchedule(note));
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

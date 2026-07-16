import { CalendarCheck, ChevronLeft, ChevronRight, Download, Loader2, Plus, Save, Send, Sparkles, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { DateInput } from '../../components/DateInput';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { queryKeys } from '../../lib/queryKeys';

type WeeklyReportsPageProps = {
  currentRole: RoleName;
  user: ApiUser;
};

type WeeklyReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'NEEDS_REVISION';

type WeeklyReportRow = {
  id?: string;
  workDate: string;
  customer: string;
  machine: string;
  content: string;
  result: string;
  pending: string;
  proposal: string;
  sortOrder?: number;
};

type WeeklyReport = {
  id: string;
  userId: string;
  weekStart: string;
  status: WeeklyReportStatus;
  note?: string | null;
  reviewNote?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  user?: { fullName?: string | null; email?: string | null } | null;
  reviewer?: { fullName?: string | null; email?: string | null } | null;
  rows: Array<WeeklyReportRow & { id: string }>;
};

type DailyWorkStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type DailyWorkType = 'WORK' | 'BUSINESS_TRIP' | 'LEAVE' | 'REPAIR' | 'INSTALLATION' | 'MAINTENANCE' | 'OTHER';

type DailyWorkRowsResponse = {
  counts: {
    total: number;
    byType: Partial<Record<DailyWorkType, number>>;
    byStatus: Partial<Record<DailyWorkStatus, number>>;
  };
  rows: Array<WeeklyReportRow & {
    sourceId: string;
    sourceType: 'DailyWorkNote';
  }>;
};

type TicketRowsResponse = {
  counts: {
    total: number;
    installations: number;
    repairs: number;
    maintenances: number;
  };
  rows: Array<WeeklyReportRow & {
    sourceId: string;
    sourceType: 'MachineInstallation' | 'Repair' | 'Maintenance';
  }>;
};

const statusLabels: Record<WeeklyReportStatus, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã gửi',
  APPROVED: 'Đã duyệt',
  NEEDS_REVISION: 'Cần sửa',
};

const dailyWorkTypeLabels: Record<DailyWorkType, string> = {
  WORK: 'Công việc',
  BUSINESS_TRIP: 'Công tác',
  LEAVE: 'Nghỉ phép',
  REPAIR: 'Sửa chữa',
  INSTALLATION: 'Lắp đặt',
  MAINTENANCE: 'Bảo trì',
  OTHER: 'Khác',
};

export function WeeklyReportsPage({ currentRole, user }: WeeklyReportsPageProps) {
  const isAdmin = currentRole === 'admin';
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialWeekStart = searchParams.get('weekStart') || toDateInput(startOfWeek(new Date()));
  const initialEngineerId = searchParams.get('engineerId') || searchParams.get('userId') || '';
  const [weekStart, setWeekStart] = useState(() => initialWeekStart);
  const [selectedEngineerId, setSelectedEngineerId] = useState(isAdmin ? initialEngineerId : user.id);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [rows, setRows] = useState<WeeklyReportRow[]>(() => defaultRows(weekStart));
  const [note, setNote] = useState('');
  const [reviewNoteDraft, setReviewNoteDraft] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const engineersQuery = useQuery({
    enabled: isAdmin,
    queryKey: queryKeys.weeklyReports.engineers,
    queryFn: async () => {
      const result = await apiFetch<Paginated<ApiUser>>('/users?limit=100&roleName=engineer&status=ACTIVE');
      return result?.data ?? [];
    },
  });

  const engineers = engineersQuery.data ?? [];

  useEffect(() => {
    if (!isAdmin) return;
    setSelectedEngineerId((current) => current || engineers[0]?.id || '');
  }, [engineers, isAdmin]);

  const reportParams = useMemo(() => {
    const params = new URLSearchParams({ weekStart });
    if (isAdmin && selectedEngineerId) params.set('userId', selectedEngineerId);
    return params.toString();
  }, [isAdmin, selectedEngineerId, weekStart]);

  const reportQuery = useQuery({
    enabled: !isAdmin || Boolean(selectedEngineerId),
    queryKey: queryKeys.weeklyReports.report(reportParams),
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const result = await apiFetch<WeeklyReport | null>(`/weekly-reports?${reportParams}`);
      return result ?? null;
    },
  });

  const dailyWorkRowsQuery = useQuery({
    enabled: !isAdmin || Boolean(selectedEngineerId),
    queryKey: queryKeys.weeklyReports.dailyRows(reportParams),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const result = await apiFetch<DailyWorkRowsResponse | null>(`/weekly-reports/daily-work-rows?${reportParams}`);
      return result ?? null;
    },
  });

  const ticketRowsQuery = useQuery({
    enabled: !isAdmin || Boolean(selectedEngineerId),
    queryKey: queryKeys.weeklyReports.ticketRows(reportParams),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const result = await apiFetch<TicketRowsResponse | null>(`/weekly-reports/ticket-rows?${reportParams}`);
      return result ?? null;
    },
  });

  useEffect(() => {
    if (!reportQuery.isSuccess) return;
    const nextReport = reportQuery.data ?? null;
    setReport(nextReport);
    setNote(nextReport?.note ?? '');
    setReviewNoteDraft(nextReport?.reviewNote ?? '');
    setRows(buildWeekRows(weekStart, nextReport?.rows ?? []));
  }, [reportQuery.data, reportQuery.isSuccess, weekStart]);

  const dailyWorkRows = dailyWorkRowsQuery.data ?? null;
  const ticketRows = ticketRowsQuery.data ?? null;
  const loading = reportQuery.isLoading || reportQuery.isFetching || engineersQuery.isFetching;
  const loadingDailyWorkRows = dailyWorkRowsQuery.isLoading || dailyWorkRowsQuery.isFetching;
  const loadingTicketRows = ticketRowsQuery.isLoading || ticketRowsQuery.isFetching;

  useEffect(() => {
    if (isAdmin && !selectedEngineerId) return;
    const next = new URLSearchParams({ weekStart });
    if (isAdmin && selectedEngineerId) next.set('userId', selectedEngineerId);
    setSearchParams(next, { replace: true });
  }, [isAdmin, selectedEngineerId, setSearchParams, weekStart]);

  const reportStatus = report?.status ?? 'DRAFT';
  const canSubmit = !isAdmin && Boolean(report?.id) && rows.some(rowHasReportData);
  const canEdit = !isAdmin && (reportStatus === 'DRAFT' || reportStatus === 'NEEDS_REVISION');
  const canReview = isAdmin && report?.status === 'SUBMITTED';

  const saveReportMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        weekStart,
        userId: isAdmin ? selectedEngineerId : undefined,
        note: note.trim() || null,
        rows: rows.map((row, index) => ({ ...row, sortOrder: index })),
      };
      return report?.id
        ? apiFetch<WeeklyReport>(`/weekly-reports/${report.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : apiFetch<WeeklyReport>('/weekly-reports', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
    },
    onSuccess: async (saved) => {
      setReport(saved);
      setRows(buildWeekRows(weekStart, saved.rows));
      setNote(saved.note ?? '');
      setSuccess('Đã lưu nháp báo cáo tuần.');
      await queryClient.invalidateQueries({ queryKey: ['weekly-reports', 'report'] });
    },
  });

  const submitReportMutation = useMutation({
    mutationFn: (reportId: string) => apiFetch<WeeklyReport>(`/weekly-reports/${reportId}/submit`, { method: 'POST' }),
    onSuccess: async (submitted) => {
      setReport(submitted);
      setSuccess('Đã gửi báo cáo tuần cho admin.');
      await queryClient.invalidateQueries({ queryKey: ['weekly-reports', 'report'] });
    },
  });

  const reviewReportMutation = useMutation({
    mutationFn: ({ reportId, reviewNote, status }: { reportId: string; reviewNote: string; status: Extract<WeeklyReportStatus, 'APPROVED' | 'NEEDS_REVISION'> }) =>
      apiFetch<WeeklyReport>(`/weekly-reports/${reportId}/review`, {
        method: 'POST',
        body: JSON.stringify({ status, reviewNote: reviewNote || null }),
      }),
    onSuccess: async (reviewed) => {
      setReport(reviewed);
      setReviewNoteDraft(reviewed.reviewNote ?? '');
      setSuccess(reviewed.status === 'APPROVED' ? 'Đã duyệt báo cáo tuần.' : 'Đã gửi yêu cầu sửa báo cáo.');
      await queryClient.invalidateQueries({ queryKey: ['weekly-reports', 'report'] });
    },
  });

  const saving = saveReportMutation.isPending || submitReportMutation.isPending || reviewReportMutation.isPending;
  const mutationError = saveReportMutation.error ?? submitReportMutation.error ?? reviewReportMutation.error;
  const error =
    formError ||
    (engineersQuery.error instanceof Error ? engineersQuery.error.message : '') ||
    (reportQuery.error instanceof Error ? reportQuery.error.message : '') ||
    (dailyWorkRowsQuery.error instanceof Error ? dailyWorkRowsQuery.error.message : '') ||
    (ticketRowsQuery.error instanceof Error ? ticketRowsQuery.error.message : '') ||
    (mutationError instanceof Error ? mutationError.message : '');

  function updateRow(index: number, patch: Partial<WeeklyReportRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [...current, emptyRow(addDays(new Date(`${weekStart}T00:00:00`), current.length).toISOString())]);
  }

  function removeRow(index: number) {
    setRows((current) => (current.length <= 1 ? defaultRows(weekStart) : current.filter((_, rowIndex) => rowIndex !== index)));
  }

  function importDailyWorkRows() {
    if (!dailyWorkRows?.rows.length) return;
    mergeImportedRows(dailyWorkRows.rows);
    setSuccess('Đã đưa lịch trong tuần vào báo cáo nháp và giữ nguyên đủ các ngày trong tuần.');
  }

  function importTicketRows() {
    if (!ticketRows?.rows.length) return;
    mergeImportedRows(ticketRows.rows);
    setSuccess('Đã đưa phiếu hoàn thành trong tuần vào báo cáo nháp.');
  }

  function mergeImportedRows(imported: WeeklyReportRow[]) {
    setRows((current) => {
      const weekRows = buildWeekRows(weekStart, current);
      const existingKeys = new Set(weekRows.filter(rowHasReportData).map(rowKey));
      const importedRows = imported
        .map(normalizeRow)
        .filter((row) => !existingKeys.has(rowKey(row)));
      const importedDates = new Set(importedRows.map((row) => row.workDate));
      const rowsWithoutDuplicateEmptyDates = weekRows.filter((row) => rowHasReportData(row) || !importedDates.has(row.workDate));
      const nextRows = [...rowsWithoutDuplicateEmptyDates, ...importedRows].sort((a, b) => {
        const dateCompare = a.workDate.localeCompare(b.workDate);
        if (dateCompare !== 0) return dateCompare;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      });
      return buildWeekRows(weekStart, nextRows);
    });
  }

  async function saveReport() {
    setFormError('');
    setSuccess('');

    try {
      await saveReportMutation.mutateAsync();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không lưu được báo cáo tuần.');
    }
  }

  async function submitReport() {
    if (!report?.id) return;
    setFormError('');
    setSuccess('');

    try {
      await submitReportMutation.mutateAsync(report.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không gửi được báo cáo tuần.');
    }
  }

  async function reviewReport(status: Extract<WeeklyReportStatus, 'APPROVED' | 'NEEDS_REVISION'>) {
    if (!report?.id) return;
    const reviewNote = reviewNoteDraft.trim();

    if (status === 'NEEDS_REVISION' && !reviewNote) {
      setFormError('Vui lòng nhập nội dung cần sửa.');
      return;
    }

    setFormError('');
    setSuccess('');

    try {
      await reviewReportMutation.mutateAsync({ reportId: report.id, reviewNote, status });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không cập nhật được báo cáo tuần.');
    }
  }

  function exportCsv() {
    const lines = [
      ['Ngày', 'Khách hàng', 'Máy', 'Nội dung', 'Kết quả', 'Tồn đọng', 'Đề xuất'],
      ...rows
        .filter((row) => [row.customer, row.machine, row.content, row.result, row.pending, row.proposal].some((value) => value.trim()))
        .map((row) => [formatDate(row.workDate), row.customer, row.machine, row.content, row.result, row.pending, row.proposal]),
    ];
    const csv = `\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bao-cao-tuan-${weekStart}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const selectedEngineer = engineers.find((engineer) => engineer.id === selectedEngineerId);
  const weekEnd = useMemo(() => toDateInput(addDays(new Date(`${weekStart}T00:00:00`), 5)), [weekStart]);
  const currentWeekStart = useMemo(() => toDateInput(startOfWeek(new Date())), []);

  return (
    <PageFrame>
      <PageTitle
        eyebrow="Kỹ sư"
        title="Báo cáo tuần"
        description="Tổng hợp tuần."
      />

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="grid min-w-0 gap-4 rounded-lg border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-xs font-medium text-[#18181b]">Tuần báo cáo</span>
            <h2 className="mt-1 text-xl text-[#1f1f1f]">
              {formatDate(weekStart)} - {formatDate(weekEnd)}
            </h2>
            <p className="mt-1 text-sm text-[#666666]">
              {isAdmin ? selectedEngineer?.fullName || selectedEngineer?.email || 'Chọn kỹ sư' : user.fullName || user.email}
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <button className="secondary-button" onClick={() => setWeekStart(toDateInput(addDays(new Date(`${weekStart}T00:00:00`), -7)))} type="button">
              <ChevronLeft size={16} />
              Tuần trước
            </button>
            <DateInput className="min-w-[160px]" onChange={(value) => setWeekStart(value ? toDateInput(startOfWeek(new Date(`${value}T00:00:00`))) : '')} value={weekStart} />
            <button className="secondary-button" onClick={() => setWeekStart(currentWeekStart)} type="button">
              Tuần này
            </button>
            <button className="secondary-button" onClick={() => setWeekStart(toDateInput(addDays(new Date(`${weekStart}T00:00:00`), 7)))} type="button">
              Tuần sau
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-[#eeeeee] pt-4">
          {isAdmin ? (
            <label className="grid min-w-[280px] gap-1.5 text-sm font-medium text-[#333333]">
              Kỹ sư
              <select
                className="min-h-10 rounded-lg border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f]"
                onChange={(event) => setSelectedEngineerId(event.target.value)}
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
          <div className="ml-auto flex min-w-0 flex-wrap gap-2 max-[760px]:ml-0">
            <span className="inline-flex min-h-10 items-center rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 text-sm font-medium text-[#333333]">
              {statusLabels[reportStatus]}
            </span>
            <button className="secondary-button" onClick={exportCsv} type="button">
              <Download size={16} />
              Xuất CSV
            </button>
            {!isAdmin ? (
              <>
                <button className="secondary-button" disabled={saving || !canEdit} onClick={saveReport} type="button">
                  {saving ? <Loader2 className="spin-icon" size={16} /> : <Save size={16} />}
                  {saving ? 'Saving' : 'Save Draft'}
                </button>
                <button className="primary-button" disabled={saving || !canSubmit} onClick={submitReport} type="button">
                  <Send size={16} />
                  Gửi admin
                </button>
              </>
            ) : null}
            {canReview ? (
              <button className="primary-button" disabled={saving} onClick={() => reviewReport('APPROVED')} type="button">
                <Send size={16} />
                Duyệt báo cáo
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {(report?.reviewNote || canReview) ? (
        <section className="grid gap-4 rounded-lg border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-[#18181b]">Phản hồi báo cáo</span>
              <h2 className="mt-1 text-lg font-semibold text-[#1f1f1f]">
                {canReview ? 'Kiểm duyệt báo cáo tuần' : 'Ý kiến từ admin'}
              </h2>
              {report?.reviewedAt ? (
                <p className="mt-1 text-sm text-[#666666]">
                  {report.reviewer?.fullName || report.reviewer?.email || 'Admin'} · {formatDate(report.reviewedAt)}
                </p>
              ) : null}
            </div>
            {report?.status === 'NEEDS_REVISION' ? (
              <span className="rounded-lg border border-[#efd8a8] bg-[#fffaeb] px-3 py-2 text-sm font-medium text-[#9b5a17]">
                Cần kỹ sư chỉnh lại
              </span>
            ) : null}
            {report?.status === 'APPROVED' ? (
              <span className="rounded-lg border border-[#b9e8ca] bg-[#eefaf3] px-3 py-2 text-sm font-medium text-[#177245]">
                Đã hoàn tất duyệt
              </span>
            ) : null}
          </div>

          {canReview ? (
            <label className="grid gap-2 text-sm font-medium text-[#333333]">
              Nội dung cần chỉnh nếu trả báo cáo
              <textarea
                className="min-h-24 rounded-lg border border-[#d6d6d6] px-3 py-2.5 text-[#1f1f1f] outline-none focus:border-[#18181b]"
                onChange={(event) => setReviewNoteDraft(event.target.value)}
                placeholder="Ví dụ: bổ sung kết quả sửa chữa tại khách hàng A và ghi rõ tồn đọng còn lại."
                value={reviewNoteDraft}
              />
            </label>
          ) : report?.reviewNote ? (
            <div className="rounded-lg border border-[#eeeeee] bg-[#fafafa] p-3 text-sm leading-6 text-[#333333]">
              {report.reviewNote}
            </div>
          ) : null}

          {canReview ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button className="secondary-button" disabled={saving} onClick={() => reviewReport('NEEDS_REVISION')} type="button">
                Yêu cầu sửa
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4 rounded-lg border border-[#e5e5e5] bg-[#ffffff] p-4 shadow-[0_1px_2px_rgba(24,24,27,0.04)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#f4f4f5] text-[#18181b]">
              <CalendarCheck size={18} />
            </span>
            <div>
              <span className="text-xs font-semibold text-[#18181b]">Dữ liệu trong tuần</span>
              <h2 className="text-lg font-semibold text-[#1f1f1f]">Tự lập báo cáo từ lịch và phiếu hoàn thành</h2>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 font-medium text-[#333333]">
              {loadingDailyWorkRows ? 'Đang tải lịch...' : `${dailyWorkRows?.counts.total ?? 0} lịch`}
            </span>
            <span className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 font-medium text-[#333333]">
              {loadingTicketRows ? 'Đang tải phiếu...' : `${ticketRows?.counts.total ?? 0} phiếu hoàn thành`}
            </span>
            <span className="rounded-lg border border-[#b9e8ca] bg-[#eefaf3] px-3 py-2 font-medium text-[#177245]">
              Đã duyệt: {dailyWorkRows?.counts.byStatus.APPROVED ?? 0}
            </span>
            <span className="rounded-lg border border-[#efd8a8] bg-[#fffaeb] px-3 py-2 font-medium text-[#9b5a17]">
              Chờ duyệt: {dailyWorkRows?.counts.byStatus.PENDING ?? 0}
            </span>
            <span className="rounded-lg border border-[#eeeeee] bg-white px-3 py-2 text-[#666666]">
              Lắp đặt: {ticketRows?.counts.installations ?? 0}
            </span>
            <span className="rounded-lg border border-[#eeeeee] bg-white px-3 py-2 text-[#666666]">
              Sửa chữa: {ticketRows?.counts.repairs ?? 0}
            </span>
            <span className="rounded-lg border border-[#eeeeee] bg-white px-3 py-2 text-[#666666]">
              Bảo trì: {ticketRows?.counts.maintenances ?? 0}
            </span>
            {Object.entries(dailyWorkRows?.counts.byType ?? {}).slice(0, 4).map(([type, count]) => (
              <span className="rounded-lg border border-[#eeeeee] bg-white px-3 py-2 text-[#666666]" key={type}>
                {dailyWorkTypeLabels[type as DailyWorkType] || type}: {count}
              </span>
            ))}
          </div>
          <p className="mt-3 max-w-[760px] text-sm leading-6 text-[#666666]">Rà tồn đọng trước khi gửi.</p>
        </div>
        {!isAdmin ? (
          <div className="grid gap-2">
            <button className="secondary-button justify-center" disabled={saving || !canEdit || !dailyWorkRows?.rows.length} onClick={importDailyWorkRows} type="button">
              <CalendarCheck size={16} />
              Lấy từ lịch tuần, giữ đủ ngày
            </button>
            <button className="primary-button justify-center" disabled={saving || !canEdit || !ticketRows?.rows.length} onClick={importTicketRows} type="button">
              <Sparkles size={16} />
              Lấy từ phiếu hoàn thành
            </button>
          </div>
        ) : null}
      </section>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#e5e5e5] bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
        {loading ? (
          <div className="grid min-h-36 place-items-center text-[#666666]">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="spin-icon" size={18} />
              Đang tải báo cáo...
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[#fafafa] text-xs text-[#666666]">
                  <th className="w-[128px] border-b border-[#eeeeee] p-3">Ngày</th>
                  <th className="w-[170px] border-b border-[#eeeeee] p-3">Khách hàng</th>
                  <th className="w-[150px] border-b border-[#eeeeee] p-3">Máy</th>
                  <th className="border-b border-[#eeeeee] p-3">Nội dung</th>
                  <th className="border-b border-[#eeeeee] p-3">Kết quả</th>
                  <th className="border-b border-[#eeeeee] p-3">Tồn đọng</th>
                  <th className="border-b border-[#eeeeee] p-3">Đề xuất</th>
                  <th className="w-[54px] border-b border-[#eeeeee] p-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr className="align-top" key={`${row.id || 'new'}-${index}`}>
                    <td className="border-b border-[#eeeeee] p-2">
                      <DateInput className="min-w-[150px]" disabled={!canEdit || isAdmin} onChange={(value) => updateRow(index, { workDate: value })} value={toDateInput(new Date(row.workDate))} />
                    </td>
                    <td className="border-b border-[#eeeeee] p-2">
                      <textarea className="weekly-cell" disabled={!canEdit || isAdmin} onChange={(event) => updateRow(index, { customer: event.target.value })} value={row.customer} />
                    </td>
                    <td className="border-b border-[#eeeeee] p-2">
                      <textarea className="weekly-cell" disabled={!canEdit || isAdmin} onChange={(event) => updateRow(index, { machine: event.target.value })} value={row.machine} />
                    </td>
                    <td className="border-b border-[#eeeeee] p-2">
                      <textarea className="weekly-cell min-h-[72px]" disabled={!canEdit || isAdmin} onChange={(event) => updateRow(index, { content: event.target.value })} value={row.content} />
                    </td>
                    <td className="border-b border-[#eeeeee] p-2">
                      <textarea className="weekly-cell min-h-[72px]" disabled={!canEdit || isAdmin} onChange={(event) => updateRow(index, { result: event.target.value })} value={row.result} />
                    </td>
                    <td className="border-b border-[#eeeeee] p-2">
                      <textarea className="weekly-cell min-h-[72px]" disabled={!canEdit || isAdmin} onChange={(event) => updateRow(index, { pending: event.target.value })} value={row.pending} />
                    </td>
                    <td className="border-b border-[#eeeeee] p-2">
                      <textarea className="weekly-cell min-h-[72px]" disabled={!canEdit || isAdmin} onChange={(event) => updateRow(index, { proposal: event.target.value })} value={row.proposal} />
                    </td>
                    <td className="border-b border-[#eeeeee] p-2">
                      {!isAdmin ? (
                        <button className="icon-button" disabled={!canEdit} onClick={() => removeRow(index)} title="Delete row" type="button">
                          <Trash2 size={15} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!isAdmin ? (
        <div className="flex min-w-0 flex-wrap justify-between gap-3">
          <button className="secondary-button" disabled={!canEdit} onClick={addRow} type="button">
            <Plus size={16} />
            Add row
          </button>
          <label className="grid min-w-[min(520px,100%)] gap-2 text-sm font-medium text-[#333333]">
            Ghi chú chung
            <textarea
              className="min-h-20 rounded-lg border border-[#d6d6d6] px-3 py-2.5 text-[#1f1f1f] outline-none focus:border-[#18181b]"
              disabled={!canEdit}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </label>
        </div>
      ) : null}
    </PageFrame>
  );
}

function defaultRows(weekStart: string): WeeklyReportRow[] {
  const start = new Date(`${weekStart}T00:00:00`);
  return Array.from({ length: 6 }, (_, index) => emptyRow(addDays(start, index).toISOString()));
}

function buildWeekRows(weekStart: string, savedRows: Array<WeeklyReportRow & { id?: string }>) {
  const normalizedRows = savedRows.map(normalizeRow);
  const savedDates = new Set(normalizedRows.map((row) => row.workDate));
  const missingDefaultRows = defaultRows(weekStart).filter((row) => !savedDates.has(row.workDate));

  return [...normalizedRows, ...missingDefaultRows].sort((a, b) => {
    const dateCompare = a.workDate.localeCompare(b.workDate);
    if (dateCompare !== 0) return dateCompare;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

function emptyRow(workDate: string): WeeklyReportRow {
  return {
    workDate: toDateInput(new Date(workDate)),
    customer: '',
    machine: '',
    content: '',
    result: '',
    pending: '',
    proposal: '',
  };
}

function normalizeRow(row: WeeklyReportRow & { id?: string }): WeeklyReportRow {
  return {
    id: row.id,
    workDate: toDateInput(new Date(row.workDate)),
    customer: row.customer ?? '',
    machine: row.machine ?? '',
    content: row.content ?? '',
    result: row.result ?? '',
    pending: row.pending ?? '',
    proposal: row.proposal ?? '',
    sortOrder: row.sortOrder,
  };
}

function rowHasReportData(row: WeeklyReportRow) {
  return [row.customer, row.machine, row.content, row.result, row.pending, row.proposal].some((value) => value.trim());
}

function rowKey(row: WeeklyReportRow) {
  return [row.workDate, row.customer.trim(), row.machine.trim(), row.content.trim()].join('|');
}

function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function toDateInput(value: Date) {
  if (Number.isNaN(value.getTime())) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN').format(date);
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

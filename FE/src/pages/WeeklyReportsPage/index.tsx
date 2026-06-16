import { ChevronLeft, ChevronRight, Download, Loader2, Plus, Save, Send, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';

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
  submittedAt?: string | null;
  user?: { fullName?: string | null; email?: string | null } | null;
  rows: Array<WeeklyReportRow & { id: string }>;
};

const statusLabels: Record<WeeklyReportStatus, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã gửi',
  APPROVED: 'Đã duyệt',
  NEEDS_REVISION: 'Cần sửa',
};

export function WeeklyReportsPage({ currentRole, user }: WeeklyReportsPageProps) {
  const isAdmin = currentRole === 'admin';
  const [weekStart, setWeekStart] = useState(() => toDateInput(startOfWeek(new Date())));
  const [selectedEngineerId, setSelectedEngineerId] = useState(isAdmin ? '' : user.id);
  const [engineers, setEngineers] = useState<ApiUser[]>([]);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [rows, setRows] = useState<WeeklyReportRow[]>(() => defaultRows(weekStart));
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    void loadEngineers();
  }, [isAdmin]);

  useEffect(() => {
    void loadReport();
  }, [weekStart, selectedEngineerId, isAdmin]);

  const reportStatus = report?.status ?? 'DRAFT';
  const canSubmit = !isAdmin && Boolean(report?.id) && rows.some(rowHasReportData);
  const canEdit = !isAdmin && (reportStatus === 'DRAFT' || reportStatus === 'NEEDS_REVISION');

  async function loadEngineers() {
    try {
      const result = await apiFetch<Paginated<ApiUser>>('/users?limit=100&roleName=engineer&status=ACTIVE');
      setEngineers(result.data);
      setSelectedEngineerId((current) => current || result.data[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách kỹ sư.');
    }
  }

  async function loadReport() {
    if (isAdmin && !selectedEngineerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    const query = new URLSearchParams({ weekStart });
    if (isAdmin && selectedEngineerId) query.set('userId', selectedEngineerId);

    try {
      const result = await apiFetch<WeeklyReport | null | undefined>(`/weekly-reports?${query.toString()}`);
      setReport(result ?? null);
      setNote(result?.note ?? '');
      setRows(buildWeekRows(weekStart, result?.rows ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được báo cáo tuần.');
      setReport(null);
      setRows(defaultRows(weekStart));
    } finally {
      setLoading(false);
    }
  }

  function updateRow(index: number, patch: Partial<WeeklyReportRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [...current, emptyRow(addDays(new Date(`${weekStart}T00:00:00`), current.length).toISOString())]);
  }

  function removeRow(index: number) {
    setRows((current) => (current.length <= 1 ? defaultRows(weekStart) : current.filter((_, rowIndex) => rowIndex !== index)));
  }

  async function saveReport() {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        weekStart,
        userId: isAdmin ? selectedEngineerId : undefined,
        note: note.trim() || null,
        rows: rows.map((row, index) => ({ ...row, sortOrder: index })),
      };
      const saved = report?.id
        ? await apiFetch<WeeklyReport>(`/weekly-reports/${report.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiFetch<WeeklyReport>('/weekly-reports', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setReport(saved);
      setRows(buildWeekRows(weekStart, saved.rows));
      setNote(saved.note ?? '');
      setSuccess('Đã lưu nháp báo cáo tuần.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được báo cáo tuần.');
    } finally {
      setSaving(false);
    }
  }

  async function submitReport() {
    if (!report?.id) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const submitted = await apiFetch<WeeklyReport>(`/weekly-reports/${report.id}/submit`, { method: 'POST' });
      setReport(submitted);
      setSuccess('Đã gửi báo cáo tuần cho admin.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gửi được báo cáo tuần.');
    } finally {
      setSaving(false);
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
  const weekEnd = useMemo(() => toDateInput(addDays(new Date(`${weekStart}T00:00:00`), 6)), [weekStart]);

  return (
    <PageFrame>
      <PageTitle
        eyebrow="Kỹ sư"
        title="Báo cáo tuần"
        description="Nhập báo cáo dạng bảng theo từng đầu việc trong tuần, lưu nháp và gửi admin theo dõi."
      />

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="grid min-w-0 gap-4 rounded-lg border border-[#dfe7ef] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-xs font-extrabold uppercase text-[#c92a1f]">Tuần báo cáo</span>
            <h2 className="mt-1 text-xl text-[#17202a]">
              {formatDate(weekStart)} - {formatDate(weekEnd)}
            </h2>
            <p className="mt-1 text-sm text-[#657384]">
              {isAdmin ? selectedEngineer?.fullName || selectedEngineer?.email || 'Chọn kỹ sư' : user.fullName || user.email}
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <button className="secondary-button" onClick={() => setWeekStart(toDateInput(addDays(new Date(`${weekStart}T00:00:00`), -7)))} type="button">
              <ChevronLeft size={16} />
              Tuần trước
            </button>
            <input
              className="min-h-10 rounded-lg border border-[#ced8e3] px-3 text-[#17202a]"
              onChange={(event) => setWeekStart(toDateInput(startOfWeek(new Date(`${event.target.value}T00:00:00`))))}
              type="date"
              value={weekStart}
            />
            <button className="secondary-button" onClick={() => setWeekStart(toDateInput(addDays(new Date(`${weekStart}T00:00:00`), 7)))} type="button">
              Tuần sau
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-[#edf1f6] pt-4">
          {isAdmin ? (
            <label className="grid min-w-[280px] gap-1.5 text-sm font-bold text-[#405064]">
              Kỹ sư
              <select
                className="min-h-10 rounded-lg border border-[#ced8e3] bg-white px-3 text-[#17202a]"
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
            <span className="inline-flex min-h-10 items-center rounded-lg border border-[#dfe7ef] bg-[#f8fafc] px-3 text-sm font-bold text-[#405064]">
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
                  Lưu nháp
                </button>
                <button className="primary-button" disabled={saving || !canSubmit} onClick={submitReport} type="button">
                  <Send size={16} />
                  Gửi admin
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#dfe7ef] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {loading ? (
          <div className="grid min-h-36 place-items-center text-[#657384]">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="spin-icon" size={18} />
              Đang tải báo cáo...
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[#f8fafc] text-xs uppercase text-[#657384]">
                  <th className="w-[128px] border-b border-[#edf1f6] p-3">Ngày</th>
                  <th className="w-[170px] border-b border-[#edf1f6] p-3">Khách hàng</th>
                  <th className="w-[150px] border-b border-[#edf1f6] p-3">Máy</th>
                  <th className="border-b border-[#edf1f6] p-3">Nội dung</th>
                  <th className="border-b border-[#edf1f6] p-3">Kết quả</th>
                  <th className="border-b border-[#edf1f6] p-3">Tồn đọng</th>
                  <th className="border-b border-[#edf1f6] p-3">Đề xuất</th>
                  <th className="w-[54px] border-b border-[#edf1f6] p-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr className="align-top" key={`${row.id || 'new'}-${index}`}>
                    <td className="border-b border-[#edf1f6] p-2">
                      <input className="weekly-cell" disabled={!canEdit || isAdmin} onChange={(event) => updateRow(index, { workDate: event.target.value })} type="date" value={toDateInput(new Date(row.workDate))} />
                    </td>
                    <td className="border-b border-[#edf1f6] p-2">
                      <textarea className="weekly-cell" disabled={!canEdit || isAdmin} onChange={(event) => updateRow(index, { customer: event.target.value })} value={row.customer} />
                    </td>
                    <td className="border-b border-[#edf1f6] p-2">
                      <textarea className="weekly-cell" disabled={!canEdit || isAdmin} onChange={(event) => updateRow(index, { machine: event.target.value })} value={row.machine} />
                    </td>
                    <td className="border-b border-[#edf1f6] p-2">
                      <textarea className="weekly-cell min-h-[72px]" disabled={!canEdit || isAdmin} onChange={(event) => updateRow(index, { content: event.target.value })} value={row.content} />
                    </td>
                    <td className="border-b border-[#edf1f6] p-2">
                      <textarea className="weekly-cell min-h-[72px]" disabled={!canEdit || isAdmin} onChange={(event) => updateRow(index, { result: event.target.value })} value={row.result} />
                    </td>
                    <td className="border-b border-[#edf1f6] p-2">
                      <textarea className="weekly-cell min-h-[72px]" disabled={!canEdit || isAdmin} onChange={(event) => updateRow(index, { pending: event.target.value })} value={row.pending} />
                    </td>
                    <td className="border-b border-[#edf1f6] p-2">
                      <textarea className="weekly-cell min-h-[72px]" disabled={!canEdit || isAdmin} onChange={(event) => updateRow(index, { proposal: event.target.value })} value={row.proposal} />
                    </td>
                    <td className="border-b border-[#edf1f6] p-2">
                      {!isAdmin ? (
                        <button className="icon-button" disabled={!canEdit} onClick={() => removeRow(index)} title="Xóa dòng" type="button">
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
            Thêm dòng
          </button>
          <label className="grid min-w-[min(520px,100%)] gap-2 text-sm font-bold text-[#405064]">
            Ghi chú chung
            <textarea
              className="min-h-20 rounded-lg border border-[#ced8e3] px-3 py-2.5 text-[#17202a] outline-none focus:border-[#c92a1f]"
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
  return Array.from({ length: 5 }, (_, index) => emptyRow(addDays(start, index).toISOString()));
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

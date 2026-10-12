import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Loader2, Save, Send, Sparkles } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { RoleName } from '../../auth/roles';
import { DateInput } from '../../components/DateInput';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { queryKeys } from '../../lib/queryKeys';

type DailyReportsPageProps = {
  currentRole: RoleName;
  user: ApiUser;
};

type DailyReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'NEEDS_REVISION';

type DailyReport = {
  id: string;
  userId: string;
  reportDate: string;
  status: DailyReportStatus;
  summary?: string | null;
  pending?: string | null;
  proposal?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  user?: { fullName?: string | null; email?: string | null } | null;
  reviewer?: { fullName?: string | null; email?: string | null } | null;
};

type SuggestedDailyReport = {
  reportDate: string;
  summary: string;
  pending: string;
  proposal: string;
  counts: {
    dailyNotes: number;
    repairs: number;
    maintenances: number;
    installations: number;
  };
};

type DailyReportResponse = {
  report: DailyReport | null;
  suggested: SuggestedDailyReport;
};

const statusLabels: Record<DailyReportStatus, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã chốt',
  APPROVED: 'Đã phê duyệt',
  NEEDS_REVISION: 'Cần sửa',
};

const medicalEngineerTemplate = [
  '1. Lịch trình và khách hàng:',
  '- Thời gian đến/rời điểm làm việc:',
  '- Khoa/phòng sử dụng, người tiếp nhận:',
  '',
  '2. Thiết bị y tế xử lý:',
  '- Tên máy/model/serial:',
  '- Tình trạng ban đầu/cảnh báo lỗi:',
  '',
  '3. Công việc kỹ thuật:',
  '- Sửa chữa/bảo trì/lắp đặt/đào tạo:',
  '- Các bước kiểm tra, đo kiểm, hiệu chuẩn:',
  '- Linh kiện/vật tư sử dụng, serial nếu có:',
  '',
  '4. Kết quả và bàn giao:',
  '- Test chức năng/an toàn điện/chạy thử:',
  '- Ảnh trước/sau, biên bản, chữ ký:',
  '- Hướng dẫn người dùng và lưu ý vận hành:',
].join('\n');

const pendingTemplate = [
  '- Thiết bị/khách hàng còn tồn đọng:',
  '- Nguyên nhân chưa hoàn tất:',
  '- Linh kiện cần chờ hoặc báo giá cần theo dõi:',
  '- Lịch hẹn lại/dự kiến xử lý tiếp:',
].join('\n');

const proposalTemplate = [
  '- Hỗ trợ cần từ bộ phận điều phối, quản trị hoặc kho:',
  '- Vật tư/linh kiện cần chuẩn bị:',
  '- Rủi ro cần cảnh báo cho khách hàng:',
  '- Bài học kinh nghiệm cần lưu vào thư viện kinh nghiệm kỹ thuật:',
].join('\n');

export function DailyReportsPage({ currentRole, user }: DailyReportsPageProps) {
  const isAdmin = currentRole === 'admin';
  const queryClient = useQueryClient();
  const [reportDate, setReportDate] = useState(() => toDateInput(new Date()));
  const [selectedEngineerId, setSelectedEngineerId] = useState(isAdmin ? '' : user.id);
  const [summary, setSummary] = useState('');
  const [pending, setPending] = useState('');
  const [proposal, setProposal] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const engineersQuery = useQuery({
    enabled: isAdmin,
    queryKey: queryKeys.dailyReports.engineers,
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
    const params = new URLSearchParams({ date: reportDate });
    if (isAdmin && selectedEngineerId) params.set('userId', selectedEngineerId);
    return params.toString();
  }, [isAdmin, reportDate, selectedEngineerId]);

  const reportQuery = useQuery({
    enabled: !isAdmin || Boolean(selectedEngineerId),
    queryKey: queryKeys.dailyReports.report(reportParams),
    queryFn: async () => apiFetch<DailyReportResponse>(`/daily-reports?${reportParams}`),
    refetchOnWindowFocus: true,
  });

  const report = reportQuery.data?.report ?? null;
  const suggested = reportQuery.data?.suggested ?? null;
  const reportStatus = report?.status ?? 'DRAFT';
  const canEdit = !isAdmin && (reportStatus === 'DRAFT' || reportStatus === 'NEEDS_REVISION');
  const hasReportContent = Boolean(summary.trim() || pending.trim() || proposal.trim());
  const canSubmit = canEdit && !reportQuery.isFetching && hasReportContent;

  useEffect(() => {
    if (!reportQuery.isSuccess) return;
    setSummary(report?.summary ?? suggested?.summary ?? '');
    setPending(report?.pending ?? suggested?.pending ?? '');
    setProposal(report?.proposal ?? suggested?.proposal ?? '');
  }, [report, reportQuery.isSuccess, suggested]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<DailyReport>('/daily-reports', {
        method: 'POST',
        body: JSON.stringify({
          userId: isAdmin ? selectedEngineerId : undefined,
          reportDate,
          summary,
          pending,
          proposal,
        }),
      }),
    onSuccess: async () => {
      setSuccess('Đã lưu nháp.');
      await queryClient.invalidateQueries({ queryKey: ['daily-reports', 'report'] });
      await queryClient.invalidateQueries({ queryKey: ['weekly-reports', 'report'] });
    },
  });

  const submitMutation = useMutation({
    mutationFn: (reportId: string) => apiFetch<DailyReport>(`/daily-reports/${reportId}/submit`, { method: 'POST' }),
    onSuccess: async (submitted) => {
      setSuccess('Đã chốt báo cáo ngày.');
      await queryClient.invalidateQueries({ queryKey: ['daily-reports', 'report'] });
      await queryClient.invalidateQueries({ queryKey: ['weekly-reports', 'report'] });
      setSummary(submitted.summary ?? '');
      setPending(submitted.pending ?? '');
      setProposal(submitted.proposal ?? '');
    },
  });

  const saving = saveMutation.isPending || submitMutation.isPending;
  const mutationError = saveMutation.error ?? submitMutation.error;
  const error =
    formError ||
    (engineersQuery.error instanceof Error ? engineersQuery.error.message : '') ||
    (reportQuery.error instanceof Error ? reportQuery.error.message : '') ||
    (mutationError instanceof Error ? mutationError.message : '');

  function useSuggested() {
    setSummary(suggested?.summary ?? '');
    setPending(suggested?.pending ?? '');
    setProposal(suggested?.proposal ?? '');
    setSuccess('Đã thêm dữ liệu gợi ý.');
  }

  function useMedicalEngineerTemplate() {
    setSummary((current) => current.trim() || medicalEngineerTemplate);
    setPending((current) => current.trim() || pendingTemplate);
    setProposal((current) => current.trim() || proposalTemplate);
    setSuccess('Đã áp dụng mẫu báo cáo.');
  }

  async function saveReport() {
    setFormError('');
    setSuccess('');
    try {
      await saveMutation.mutateAsync();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không lưu được báo cáo ngày.');
    }
  }

  async function submitReport() {
    setFormError('');
    setSuccess('');
    try {
      const saved = await saveMutation.mutateAsync();
      await submitMutation.mutateAsync(saved.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không chốt được báo cáo ngày.');
    }
  }

  return (
    <PageFrame>
      <PageTitle eyebrow="Kỹ sư thiết bị y tế" meta="Nháp" title="Báo cáo ngày" />

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      <section className="grid gap-4 rounded-lg border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-xs font-medium text-[#18181b]">Ngày báo cáo</span>
            <h2 className="mt-1 text-xl text-[#1f1f1f]">{formatDate(reportDate)}</h2>
            <span className="mt-1 inline-flex w-fit items-center rounded-md bg-[#eef2f6] px-2 py-1 text-xs font-semibold text-[#475467]">{isAdmin ? selectedEngineerName(engineers, selectedEngineerId) : user.fullName || user.email}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="secondary-button" onClick={() => setReportDate(toDateInput(addDays(new Date(`${reportDate}T00:00:00`), -1)))} type="button">
              <ChevronLeft size={16} />
              Hôm trước
            </button>
            <DateInput className="min-w-[150px]" onChange={(value) => setReportDate(value || toDateInput(new Date()))} value={reportDate} />
            <button className="secondary-button" onClick={() => setReportDate(toDateInput(new Date()))} type="button">
              Hôm nay
            </button>
            <button className="secondary-button" onClick={() => setReportDate(toDateInput(addDays(new Date(`${reportDate}T00:00:00`), 1)))} type="button">
              Hôm sau
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-[#eeeeee] pt-4">
          {isAdmin ? (
            <label className="grid min-w-[280px] gap-1.5 text-sm font-medium text-[#333333]">
              Kỹ sư
              <select className="min-h-10 rounded-lg border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f]" onChange={(event) => setSelectedEngineerId(event.target.value)} value={selectedEngineerId}>
                {engineers.map((engineer) => (
                  <option key={engineer.id} value={engineer.id}>{engineer.fullName || engineer.email}</option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="ml-auto flex flex-wrap gap-2 max-[760px]:ml-0">
            <span className="inline-flex min-h-10 items-center rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 text-sm font-medium text-[#333333]">{statusLabels[reportStatus]}</span>
            {!isAdmin ? (
              <>
                <button className="secondary-button" disabled={saving} onClick={useMedicalEngineerTemplate} type="button">
                  <ClipboardCheck size={16} />
                  Mẫu kỹ sư y tế
                </button>
                <button className="secondary-button" disabled={saving || !suggested} onClick={useSuggested} type="button">
                  <Sparkles size={16} />
                  Lấy gợi ý
                </button>
                <button className="primary-button" disabled={saving || !canEdit} onClick={saveReport} type="button">
                  {saving ? <Loader2 className="spin-icon" size={16} /> : <Save size={16} />}
                  Lưu nháp & cập nhật tuần
                </button>
                <button className="primary-button" disabled={saving || !canSubmit} onClick={submitReport} type="button">
                  {saving ? <Loader2 className="spin-icon" size={16} /> : <Send size={16} />}
                  Chốt báo cáo
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-[#e5e5e5] bg-[#ffffff] p-4 shadow-[0_1px_2px_rgba(24,24,27,0.04)] md:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#f4f4f5] text-[#18181b]">
              <CalendarDays size={18} />
            </span>
            <div>
              <span className="text-xs font-semibold text-[#18181b]">Dữ liệu tự gom</span>
              <h2 className="text-lg font-semibold text-[#1f1f1f]">Lịch, phiếu và hồ sơ thiết bị trong ngày</h2>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <DailyMetric label="Lịch" value={suggested?.counts.dailyNotes ?? 0} />
          <DailyMetric label="Sửa chữa" value={suggested?.counts.repairs ?? 0} />
          <DailyMetric label="Bảo trì" value={suggested?.counts.maintenances ?? 0} />
          <DailyMetric label="Lắp đặt" value={suggested?.counts.installations ?? 0} />
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-[#e5e5e5] bg-white p-4 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
        <label className="grid gap-2 text-sm font-medium text-[#333333]">
          Công việc kỹ thuật đã thực hiện
          <textarea className="min-h-44 rounded-lg border border-[#d6d6d6] px-3 py-2.5 text-[#1f1f1f] outline-none focus:border-[#18181b]" disabled={!canEdit} onChange={(event) => setSummary(event.target.value)} value={summary} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[#333333]">
          Tồn đọng, rủi ro, lịch hẹn lại
          <textarea className="min-h-28 rounded-lg border border-[#d6d6d6] px-3 py-2.5 text-[#1f1f1f] outline-none focus:border-[#18181b]" disabled={!canEdit} onChange={(event) => setPending(event.target.value)} value={pending} />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[#333333]">
          Vật tư, đề xuất hỗ trợ, bài học kinh nghiệm
          <textarea className="min-h-24 rounded-lg border border-[#d6d6d6] px-3 py-2.5 text-[#1f1f1f] outline-none focus:border-[#18181b]" disabled={!canEdit} onChange={(event) => setProposal(event.target.value)} value={proposal} />
        </label>
      </section>
    </PageFrame>
  );
}

function DailyMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3 text-center">
      <strong className="block text-lg text-[#18181b]">{value}</strong>
      <span className="text-xs font-semibold text-[#666666]">{label}</span>
    </div>
  );
}

function selectedEngineerName(engineers: ApiUser[], selectedEngineerId: string) {
  const engineer = engineers.find((item) => item.id === selectedEngineerId);
  return engineer?.fullName || engineer?.email || 'Chọn kỹ sư';
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

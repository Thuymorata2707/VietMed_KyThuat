import { ArrowLeft, Download, Loader2, Save } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Paginated, apiFetch, getApiBaseUrl, getToken } from '../../api';
import { Notice } from '../../components/Notice';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { attachmentOptionsByKind } from '../EngineerTasksPage/constants';
import type { AttachmentType, RepairTask, TaskAttachment } from '../EngineerTasksPage/types';
import { attachmentTypeLabel, formatFileSize, statusLabel } from '../EngineerTasksPage/utils';

type RepairForm = {
  status: string;
  resultNote: string;
  customerFeedback: string;
  conditionAssessment: string;
  repairMethod: string;
  usingDepartment: string;
  representative: string;
  address: string;
  contactPhone: string;
  deviceName: string;
  modelName: string;
  serialNumber: string;
};

export function RepairUpdatePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/service-tickets';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detail, setDetail] = useState<RepairTask | null>(null);
  const [form, setForm] = useState<RepairForm>(() => emptyForm());
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentType, setAttachmentType] = useState<AttachmentType>('ERROR_PHOTO');
  const [attachmentTitle, setAttachmentTitle] = useState('');
  const [attachmentDescription, setAttachmentDescription] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  useEffect(() => {
    void loadDetail();
  }, [id]);

  async function loadDetail() {
    if (!id) return;

    setLoading(true);
    setError('');

    try {
      const repair = await apiFetch<RepairTask>(`/repairs/${id}`);
      setDetail(repair);
      setForm(buildForm(repair));
      await loadAttachments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được phiếu sửa chữa.');
    } finally {
      setLoading(false);
    }
  }

  function updateForm(patch: Partial<RepairForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function loadAttachments() {
    if (!id) return;

    setLoadingAttachments(true);

    try {
      const response = await apiFetch<Paginated<TaskAttachment>>(`/attachments?entityType=Repair&entityId=${id}&limit=100`);
      setAttachments(response.data);
    } catch {
      setAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  }

  async function uploadAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!attachmentFile) return;

    setUploadingAttachment(true);
    setError('');
    setSuccess('');

    const body = new FormData();
    body.append('entityType', 'Repair');
    body.append('entityId', id);
    body.append('type', attachmentType);
    if (attachmentTitle.trim()) body.append('title', attachmentTitle.trim());
    if (attachmentDescription.trim()) body.append('description', attachmentDescription.trim());
    body.append('file', attachmentFile);

    try {
      await apiFetch('/attachments', {
        method: 'POST',
        body,
      });
      setAttachmentTitle('');
      setAttachmentDescription('');
      setAttachmentFile(null);
      setSuccess('Đã tải ảnh/tài liệu lên phiếu sửa chữa.');
      await loadAttachments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được ảnh/tài liệu.');
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function downloadAttachment(attachment: TaskAttachment) {
    try {
      const response = await fetch(`${getApiBaseUrl()}${attachment.url}`, {
        headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : undefined,
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = attachment.originalName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Không tải được tệp đính kèm.');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiFetch(`/repairs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: form.status,
          resultNote: form.resultNote.trim() || undefined,
          customerFeedback: form.customerFeedback.trim() || undefined,
          conditionAssessment: form.conditionAssessment.trim() || undefined,
          repairMethod: form.repairMethod.trim() || undefined,
          usingDepartment: form.usingDepartment.trim() || undefined,
          representative: form.representative.trim() || undefined,
          address: form.address.trim() || undefined,
          contactPhone: form.contactPhone.trim() || undefined,
          deviceName: form.deviceName.trim() || undefined,
          modelName: form.modelName.trim() || undefined,
          serialNumber: form.serialNumber.trim() || undefined,
        }),
      });
      setSuccess('Đã cập nhật phiếu sửa chữa.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được phiếu sửa chữa.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageFrame>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Sửa chữa"
          title="Cập nhật phiếu sửa chữa"
          description="Cập nhật tình trạng thiết bị, phương án xử lý, kết quả và trạng thái máy sau khi kiểm tra thực tế."
        />
        <button className="secondary-button" onClick={() => navigate(returnTo)} type="button">
          <ArrowLeft size={17} />
          Quay lại danh sách
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      {loading ? (
        <div className="grid min-h-64 place-items-center rounded-lg border border-[#dfe7ef] bg-white text-sm font-semibold text-[#657384]">
          <Loader2 className="spin-icon" size={18} />
          Đang tải phiếu sửa chữa...
        </div>
      ) : (
        <form className="grid min-w-0 gap-4 min-[1320px]:grid-cols-[minmax(0,1fr)_360px]" onSubmit={submit}>
          <section className="grid min-w-0 gap-4">
            <div className={panelClass}>
              <div className="mb-4 border-b border-[#edf1f6] pb-4">
                <span className="text-xs font-extrabold uppercase text-[#c92a1f]">Thông tin phiếu</span>
                <h2 className="mt-1 text-lg font-bold text-[#17202a]">{detail?.title || 'Phiếu sửa chữa'}</h2>
                <p className="mt-1 text-sm text-[#657384]">{detail?.code} - {statusLabel(detail?.status || '')}</p>
              </div>

              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <label className={labelClass}>
                  Trạng thái xử lý
                  <select className={fieldClass} onChange={(event) => updateForm({ status: event.target.value })} required value={form.status}>
                    {statusOptionsForCurrent(detail?.status || form.status).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  S/N máy
                  <input className={fieldClass} onChange={(event) => updateForm({ serialNumber: event.target.value })} value={form.serialNumber} />
                </label>
                <label className={labelClass}>
                  Tên thiết bị
                  <input className={fieldClass} onChange={(event) => updateForm({ deviceName: event.target.value })} value={form.deviceName} />
                </label>
                <label className={labelClass}>
                  Model
                  <input className={fieldClass} onChange={(event) => updateForm({ modelName: event.target.value })} value={form.modelName} />
                </label>
                <label className={`${labelClass} md:col-span-2`}>
                  Kiểm tra tình trạng thiết bị
                  <textarea className={textareaClass} onChange={(event) => updateForm({ conditionAssessment: event.target.value })} value={form.conditionAssessment} />
                </label>
                <label className={`${labelClass} md:col-span-2`}>
                  Phương án sửa chữa
                  <textarea className={textareaClass} onChange={(event) => updateForm({ repairMethod: event.target.value })} value={form.repairMethod} />
                </label>
              </div>
            </div>

            <div className={panelClass}>
              <div className="mb-4 border-b border-[#edf1f6] pb-4">
                <span className="text-xs font-extrabold uppercase text-[#c92a1f]">Khách hàng</span>
                <h2 className="mt-1 text-lg font-bold text-[#17202a]">Thông tin tại điểm sửa chữa</h2>
              </div>
              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <label className={labelClass}>
                  Đơn vị sử dụng
                  <input className={fieldClass} onChange={(event) => updateForm({ usingDepartment: event.target.value })} value={form.usingDepartment} />
                </label>
                <label className={labelClass}>
                  Người đại diện
                  <input className={fieldClass} onChange={(event) => updateForm({ representative: event.target.value })} value={form.representative} />
                </label>
                <label className={labelClass}>
                  Số điện thoại
                  <input className={fieldClass} onChange={(event) => updateForm({ contactPhone: event.target.value })} value={form.contactPhone} />
                </label>
                <label className={`${labelClass} md:col-span-2`}>
                  Địa chỉ
                  <input className={fieldClass} onChange={(event) => updateForm({ address: event.target.value })} value={form.address} />
                </label>
              </div>
            </div>

            <div className={panelClass}>
              <div className="mb-4 border-b border-[#edf1f6] pb-4">
                <span className="text-xs font-extrabold uppercase text-[#c92a1f]">Kết quả</span>
                <h2 className="mt-1 text-lg font-bold text-[#17202a]">Ghi nhận sau xử lý</h2>
              </div>
              <div className="grid min-w-0 gap-4">
                <label className={labelClass}>
                  Kết quả xử lý
                  <textarea className={textareaClass} onChange={(event) => updateForm({ resultNote: event.target.value })} value={form.resultNote} />
                </label>
                <label className={labelClass}>
                  Phản hồi khách hàng
                  <textarea className={textareaClass} onChange={(event) => updateForm({ customerFeedback: event.target.value })} value={form.customerFeedback} />
                </label>
              </div>
            </div>
          </section>

          <aside className="grid min-w-0 gap-4 self-start">
            <div className={panelClass}>
              <span className="text-xs font-extrabold uppercase text-[#c92a1f]">Tóm tắt máy</span>
              <div className="mt-3 grid gap-3 text-sm text-[#405064]">
                <SummaryRow label="Mã máy" value={detail?.machine?.machineCode || '-'} />
                <SummaryRow label="S/N hệ thống" value={detail?.machine?.serialNumber || '-'} />
                <SummaryRow label="Model hệ thống" value={detail?.machine?.modelName || '-'} />
                <SummaryRow label="Khách hàng hệ thống" value={detail?.machine?.customer?.name || '-'} />
              </div>
            </div>

            <section className={panelClass}>
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#edf1f6] pb-4">
                <div>
                  <span className="text-xs font-extrabold uppercase text-[#c92a1f]">Tài liệu hiện trường</span>
                  <h2 className="mt-1 text-lg font-bold text-[#17202a]">Ảnh và biên bản</h2>
                </div>
                <strong className="rounded-full border border-[#dfe7ef] bg-[#f8fafc] px-2.5 py-1 text-sm text-[#405064]">{attachments.length}</strong>
              </div>

              <div className="grid gap-2">
                {loadingAttachments ? (
                  <div className="flex min-h-20 items-center justify-center gap-2 text-sm text-[#657384]">
                    <Loader2 className="spin-icon" size={16} />
                    Đang tải tài liệu...
                  </div>
                ) : null}

                {!loadingAttachments && attachments.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#dfe7ef] bg-[#fbfdff] p-4 text-center text-sm text-[#657384]">
                    Chưa có ảnh hoặc tài liệu nào cho phiếu này.
                  </div>
                ) : null}

                {!loadingAttachments
                  ? attachments.map((attachment) => (
                      <article className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#edf1f6] bg-[#fbfdff] p-3" key={attachment.id}>
                        <div className="min-w-0">
                          <span className="text-xs font-bold uppercase text-[#657384]">{attachmentTypeLabel(attachment.type)}</span>
                          <strong className="mt-1 block truncate text-sm text-[#17202a]">{attachment.title || attachment.originalName}</strong>
                          <small className="block truncate text-xs text-[#657384]">
                            {attachment.originalName} - {formatFileSize(attachment.size)}
                          </small>
                        </div>
                        <button className="icon-button" onClick={() => downloadAttachment(attachment)} title="Tải xuống" type="button">
                          <Download size={16} />
                        </button>
                      </article>
                    ))
                  : null}
              </div>

              <form className="mt-4 grid min-w-0 gap-3 border-t border-[#edf1f6] pt-4" onSubmit={uploadAttachment}>
                <label className={labelClass}>
                  Loại tài liệu
                  <select className={fieldClass} onChange={(event) => setAttachmentType(event.target.value as AttachmentType)} value={attachmentType}>
                    {attachmentOptionsByKind.repair.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Tên hiển thị
                  <input className={fieldClass} onChange={(event) => setAttachmentTitle(event.target.value)} placeholder="VD: Ảnh serial trước sửa chữa" value={attachmentTitle} />
                </label>
                <label className={labelClass}>
                  Ghi chú
                  <textarea className="min-h-20 w-full min-w-0 resize-y rounded-lg border border-[#ced8e3] bg-white px-3 py-2.5 text-sm font-medium leading-relaxed text-[#17202a] outline-none focus:border-[#c92a1f] focus:shadow-[0_0_0_3px_rgba(201,42,31,0.1)]" onChange={(event) => setAttachmentDescription(event.target.value)} value={attachmentDescription} />
                </label>
                <label className={labelClass}>
                  File
                  <input
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="w-full min-w-0 rounded-lg border border-dashed border-[#ced8e3] bg-[#fbfdff] px-3 py-3 text-sm text-[#405064]"
                    onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)}
                    type="file"
                  />
                </label>
                <button className="primary-button" disabled={uploadingAttachment || !attachmentFile} type="submit">
                  {uploadingAttachment ? <Loader2 className="spin-icon" size={17} /> : null}
                  {uploadingAttachment ? 'Đang tải lên' : 'Tải lên phiếu'}
                </button>
              </form>
            </section>

            <div className="flex flex-wrap justify-end gap-2">
              <button className="secondary-button" onClick={() => navigate(returnTo)} type="button">
                Hủy
              </button>
              <button className="primary-button" disabled={saving} type="submit">
                {saving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
                Lưu cập nhật
              </button>
            </div>
          </aside>
        </form>
      )}
    </PageFrame>
  );
}

function emptyForm(): RepairForm {
  return {
    status: 'IN_PROGRESS',
    resultNote: '',
    customerFeedback: '',
    conditionAssessment: '',
    repairMethod: '',
    usingDepartment: '',
    representative: '',
    address: '',
    contactPhone: '',
    deviceName: '',
    modelName: '',
    serialNumber: '',
  };
}

function buildForm(repair: RepairTask): RepairForm {
  return {
    status: repair.status || 'IN_PROGRESS',
    resultNote: repair.resultNote || '',
    customerFeedback: repair.customerFeedback || '',
    conditionAssessment: repair.conditionAssessment || '',
    repairMethod: repair.repairMethod || '',
    usingDepartment: repair.usingDepartment || repair.machine?.customer?.name || '',
    representative: repair.representative || '',
    address: repair.address || '',
    contactPhone: repair.contactPhone || '',
    deviceName: repair.deviceName || repair.machine?.modelName || '',
    modelName: repair.modelName || repair.machine?.modelName || '',
    serialNumber: repair.serialNumber || repair.machine?.serialNumber || '',
  };
}

function statusOptionsForCurrent(status: string) {
  const optionsByStatus: Record<string, Array<{ value: string; label: string }>> = {
    PENDING: [
      { value: 'PENDING', label: statusLabel('PENDING') },
      { value: 'ASSIGNED', label: statusLabel('ASSIGNED') },
      { value: 'CANCELLED', label: statusLabel('CANCELLED') },
    ],
    ASSIGNED: [
      { value: 'ASSIGNED', label: statusLabel('ASSIGNED') },
      { value: 'IN_PROGRESS', label: statusLabel('IN_PROGRESS') },
      { value: 'WAITING_PARTS', label: statusLabel('WAITING_PARTS') },
      { value: 'COMPLETED', label: statusLabel('COMPLETED') },
      { value: 'CANCELLED', label: statusLabel('CANCELLED') },
    ],
    IN_PROGRESS: [
      { value: 'IN_PROGRESS', label: statusLabel('IN_PROGRESS') },
      { value: 'WAITING_PARTS', label: statusLabel('WAITING_PARTS') },
      { value: 'COMPLETED', label: statusLabel('COMPLETED') },
      { value: 'CANCELLED', label: statusLabel('CANCELLED') },
    ],
    WAITING_PARTS: [
      { value: 'WAITING_PARTS', label: statusLabel('WAITING_PARTS') },
      { value: 'IN_PROGRESS', label: statusLabel('IN_PROGRESS') },
      { value: 'CANCELLED', label: statusLabel('CANCELLED') },
    ],
    COMPLETED: [{ value: 'COMPLETED', label: statusLabel('COMPLETED') }],
    CANCELLED: [{ value: 'CANCELLED', label: statusLabel('CANCELLED') }],
  };

  return optionsByStatus[status] || [{ value: status, label: statusLabel(status) }];
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1 rounded-lg border border-[#edf1f6] bg-[#fbfdff] p-3">
      <span className="text-xs font-bold uppercase text-[#657384]">{label}</span>
      <strong className="break-words text-[#17202a]">{value}</strong>
    </div>
  );
}

const panelClass = 'rounded-lg border border-[#dfe7ef] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
const labelClass = 'grid min-w-0 content-start gap-2 text-sm font-bold text-[#405064]';
const fieldClass = 'h-11 w-full min-w-0 rounded-lg border border-[#ced8e3] bg-white px-3 text-sm font-medium text-[#17202a] outline-none focus:border-[#c92a1f] focus:shadow-[0_0_0_3px_rgba(201,42,31,0.1)]';
const textareaClass = 'min-h-28 w-full min-w-0 resize-y rounded-lg border border-[#ced8e3] bg-white px-3 py-2.5 text-sm font-medium leading-relaxed text-[#17202a] outline-none focus:border-[#c92a1f] focus:shadow-[0_0_0_3px_rgba(201,42,31,0.1)]';

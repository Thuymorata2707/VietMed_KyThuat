import { ArrowLeft, Download, Loader2, RefreshCw, Save } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages, getApiBaseUrl, getToken } from '../../api';
import { getRoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { ModelInfoFields } from '../../components/ModelInfoFields';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { checklistForCategory } from '../../config/medicalDeviceChecklists';
import { machineDisplayName, machineModelOptionLabel, machineProductName } from '../../utils/machineDisplayName';
import { attachmentOptionsByKind } from '../EngineerTasksPage/constants';
import type { AttachmentType, RepairTask, TaskAttachment } from '../EngineerTasksPage/types';
import { attachmentTypeLabel, formatFileSize, statusLabel } from '../EngineerTasksPage/utils';

type EngineerOption = {
  id: string;
  fullName?: string | null;
  email: string;
};

type StockMachine = {
  id: string;
  machineCode?: string | null;
  serialNumber?: string | null;
  modelName?: string | null;
  name?: string | null;
  customer?: { id?: string | null; name?: string | null } | null;
};

type RepairForm = {
  status: string;
  priority: string;
  engineerId: string;
  resultNote: string;
  customerFeedback: string;
  conditionAssessment: string;
  repairMethod: string;
  usingDepartment: string;
  representative: string;
  address: string;
  contactPhone: string;
  deviceName: string;
  machineModelId: string;
  modelName: string;
  serialNumber: string;
};

type MachineModelOption = {
  id: string;
  code?: string | null;
  name?: string | null;
  displayName?: string | null;
  manufacturer?: string | null;
  countryOfOrigin?: string | null;
  productCategory?: string | null;
  businessLine?: {
    name?: string | null;
    countryOfOrigin?: string | null;
    productCategory?: string | null;
    productIndustry?: {
      name?: string | null;
    } | null;
  } | null;
};

export function RepairUpdatePage({ user }: { user: ApiUser }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/service-tickets';
  const isAdmin = getRoleName(user) === 'admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detail, setDetail] = useState<RepairTask | null>(null);
  const [engineers, setEngineers] = useState<EngineerOption[]>([]);
  const [machineModels, setMachineModels] = useState<MachineModelOption[]>([]);
  const [installedMachines, setInstalledMachines] = useState<StockMachine[]>([]);
  const [form, setForm] = useState<RepairForm>(() => emptyForm());
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentType, setAttachmentType] = useState<AttachmentType>('ERROR_PHOTO');
  const [attachmentTitle, setAttachmentTitle] = useState('');
  const [attachmentDescription, setAttachmentDescription] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const repairChecklist = checklistForCategory(detail?.machine?.productCategory || detail?.modelName || detail?.deviceName, 'repair');

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
      await loadMachineModels();
      await loadInstalledMachines();
      if (isAdmin) {
        await loadEngineers();
      }
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

  async function loadEngineers() {
    try {
      const response = await apiFetch<Paginated<EngineerOption>>('/users?limit=100&roleName=engineer');
      setEngineers(response.data);
    } catch {
      setEngineers([]);
    }
  }

  async function loadMachineModels() {
    try {
      const result = await apiFetchAllPages<MachineModelOption>('/machine-models');
      setMachineModels(result);
    } catch {
      setMachineModels([]);
    }
  }

  async function loadInstalledMachines() {
    try {
      const result = await apiFetch<Paginated<StockMachine>>('/machines?limit=200&inventoryStatus=INSTALLED');
      setInstalledMachines(result.data);
    } catch {
      setInstalledMachines([]);
    }
  }

  function syncAddressFromCustomer() {
    const c = detail?.customer || detail?.machine?.customer;
    if (!c) return;
    updateForm({
      usingDepartment: (c as { name?: string | null }).name || form.usingDepartment,
      representative: (detail?.customer ? detail.customer.contactPerson : '') || form.representative,
      address: (detail?.customer ? (detail.customer.fullAddress || detail.customer.address || '') : '') || form.address,
      contactPhone: (detail?.customer ? (detail.customer.contactPhone || detail.customer.phone || '') : '') || form.contactPhone,
    });
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
          ...(isAdmin
            ? {
                priority: form.priority,
                engineerId: form.engineerId || null,
              }
            : {}),
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
          description="Tình trạng, phương án xử lý và kết quả sửa chữa."
        />
        <button className="secondary-button" onClick={() => navigate(returnTo)} type="button">
          <ArrowLeft size={17} />
          Quay lại
        </button>
      </div>

      {error ? <Notice message={error} /> : null}
      {success ? <div className="success-notice">{success}</div> : null}

      {loading ? (
        <div className="grid min-h-64 place-items-center rounded-lg border border-[#e5e5e5] bg-white text-sm font-semibold text-[#666666]">
          <Loader2 className="spin-icon" size={18} />
          Đang tải phiếu sửa chữa...
        </div>
      ) : (
        <form className="grid min-w-0 gap-5 min-[1320px]:grid-cols-[minmax(0,1fr)_380px]" onSubmit={submit}>
          <section className="grid min-w-0 gap-5">
            <div className={panelClass}>
              <div className={sectionHeaderClass}>
                <span className={stepBadgeClass}>1</span>
                <div>
                  <span className={eyebrowClass}>Thông tin phiếu</span>
                  <h2 className={sectionTitleClass}>{detail?.title || 'Phiếu sửa chữa'}</h2>
                  <p className={sectionDescriptionClass}>{detail?.code} - {statusLabel(detail?.status || '')}</p>
                </div>
              </div>

              <div className="grid min-w-0 gap-5 md:grid-cols-2">
                <div className={labelClass}>
                  Trạng thái xử lý
                  <select className={fieldClass} onChange={(event) => updateForm({ status: event.target.value })} required value={form.status}>
                    {statusOptionsForCurrent(form.status).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className="secondary-button w-full justify-center border-[#e4e4e7] bg-[#f4f4f5] text-[#b5121b]"
                    disabled={form.status === 'COMPLETED' || form.status === 'CANCELLED'}
                    onClick={() => updateForm({ status: 'COMPLETED' })}
                    type="button"
                  >
                    Hoàn thành phiếu
                  </button>
                </div>
                {isAdmin ? (
                  <label className={labelClass}>
                    Mức ưu tiên
                    <select className={fieldClass} onChange={(event) => updateForm({ priority: event.target.value })} value={form.priority}>
                      <option value="LOW">Thấp</option>
                      <option value="NORMAL">Bình thường</option>
                      <option value="HIGH">Cao</option>
                      <option value="URGENT">Khẩn cấp</option>
                    </select>
                  </label>
                ) : null}
                {isAdmin ? (
                  <label className={labelClass}>
                    Kỹ sư xử lý
                    <select className={fieldClass} onChange={(event) => updateForm({ engineerId: event.target.value })} value={form.engineerId}>
                      <option value="">Chưa phân công</option>
                      {engineers.map((engineer) => (
                        <option key={engineer.id} value={engineer.id}>
                          {engineer.fullName || engineer.email}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className={`${labelClass} md:col-span-2`}>
                  Chọn máy đã lắp đặt
                  <select
                    className={fieldClass}
                    onChange={(event) => {
                      const machine = installedMachines.find((m) => m.id === event.target.value);
                      if (machine) {
                        updateForm({
                          serialNumber: machine.serialNumber || '',
                          modelName: machine.modelName || machine.name || '',
                          deviceName: machine.name || machine.modelName || '',
                          machineModelId: '',
                        });
                      }
                    }}
                    value=""
                  >
                    <option value="">-- Chọn máy đã lắp đặt (hoặc nhập tay S/N) --</option>
                    {installedMachines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {[m.machineCode, m.serialNumber ? `S/N ${m.serialNumber}` : '', m.modelName || m.name].filter(Boolean).join(' - ')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  S/N máy
                  <input className={fieldClass} onChange={(event) => updateForm({ serialNumber: event.target.value })} value={form.serialNumber} />
                </label>
                <label className={labelClass}>
                  Model / tên thiết bị
                  <select
                    className={fieldClass}
                    onChange={(event) => {
                      const model = machineModels.find((item) => item.id === event.target.value);
                      updateForm({
                        machineModelId: event.target.value,
                        modelName: model?.name || model?.displayName || model?.code || '',
                        deviceName: machineProductName(model) || machineDisplayName(model) || model?.displayName || model?.name || model?.code || '',
                      });
                    }}
                    value={form.machineModelId || modelIdByName(machineModels, form.modelName)}
                  >
                    <option value="">Chọn model</option>
                    {machineModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {machineModelLabel(model)}
                      </option>
                    ))}
                  </select>
                </label>
                <ModelInfoFields className="md:col-span-2" model={machineModels.find((model) => model.id === (form.machineModelId || modelIdByName(machineModels, form.modelName)))} />
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
              <div className={sectionHeaderClass}>
                <span className={stepBadgeClass}>2</span>
                <div>
                  <span className={eyebrowClass}>Khách hàng</span>
                  <h2 className={sectionTitleClass}>Thông tin tại điểm sửa chữa</h2>
                  <p className={sectionDescriptionClass}>Người liên hệ và địa chỉ thực tế.</p>
                </div>
              </div>
              <div className="grid min-w-0 gap-5 md:grid-cols-2">
                <label className={labelClass}>
                  <span className="flex items-center gap-2">
                    Đơn vị sử dụng
                    <button className="text-xs font-medium text-[#b5121b] hover:underline" onClick={syncAddressFromCustomer} type="button">
                      <RefreshCw size={13} className="inline" /> Lấy từ hồ sơ
                    </button>
                  </span>
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
              <div className={sectionHeaderClass}>
                <span className={stepBadgeClass}>3</span>
                <div>
                  <span className={eyebrowClass}>Kết quả</span>
                  <h2 className={sectionTitleClass}>Ghi nhận sau xử lý</h2>
                  <p className={sectionDescriptionClass}>Lỗi, cách xử lý và phản hồi khách hàng.</p>
                </div>
              </div>
              <div className="grid min-w-0 gap-5">
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

          <aside className="grid min-w-0 gap-4 self-start min-[1320px]:sticky min-[1320px]:top-5">
            <div className={sidePanelClass}>
              <span className={eyebrowClass}>Tóm tắt máy</span>
              <div className="mt-3 grid gap-3 text-sm text-[#333333]">
                <SummaryRow label="Mã máy" value={detail?.machine?.machineCode || '-'} />
                <SummaryRow label="S/N hệ thống" value={detail?.machine?.serialNumber || '-'} />
                <SummaryRow label="Model hệ thống" value={detail?.machine?.modelName || '-'} />
                <SummaryRow label="Khách hàng hệ thống" value={detail?.machine?.customer?.name || '-'} />
              </div>
            </div>

            <StandardRepairChecklist
              items={repairChecklist}
              onApplyPartsTemplate={() => updateForm({
                repairMethod: appendTextBlock(form.repairMethod, 'Linh kiện/phụ kiện:\n- Đã thay:\n- Cần chờ:\n- Mã/Số lượng:'),
              })}
            />

            <section className={sidePanelClass}>
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#f0e6e6] pb-4">
                <div>
                  <span className={eyebrowClass}>Tài liệu hiện trường</span>
                  <h2 className={sectionTitleClass}>Ảnh và biên bản</h2>
                </div>
                <strong className="rounded-full border border-[#e5e5e5] bg-[#fafafa] px-2.5 py-1 text-sm text-[#333333]">{attachments.length}</strong>
              </div>

              <div className="grid gap-2">
                {loadingAttachments ? (
                  <div className="flex min-h-20 items-center justify-center gap-2 text-sm text-[#666666]">
                    <Loader2 className="spin-icon" size={16} />
                    Đang tải tài liệu...
                  </div>
                ) : null}

                {!loadingAttachments && attachments.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#e5e5e5] bg-[#fafafa] p-4 text-center text-sm text-[#666666]">
                    Chưa có ảnh hoặc tài liệu nào cho phiếu này.
                  </div>
                ) : null}

                {!loadingAttachments
                  ? attachments.map((attachment) => (
                      <article className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#eeeeee] bg-[#fafafa] p-3" key={attachment.id}>
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-[#666666]">{attachmentTypeLabel(attachment.type)}</span>
                          <strong className="mt-1 block truncate text-sm text-[#1f1f1f]">{attachment.title || attachment.originalName}</strong>
                          <small className="block truncate text-xs text-[#666666]">
                            {attachment.originalName} - {formatFileSize(attachment.size)}
                          </small>
                        </div>
                        <button className="icon-button" onClick={() => downloadAttachment(attachment)} title="Download" type="button">
                          <Download size={16} />
                        </button>
                      </article>
                    ))
                  : null}
              </div>

              <form className="mt-4 grid min-w-0 gap-3 border-t border-[#eeeeee] pt-4" onSubmit={uploadAttachment}>
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
                  <textarea className={`${textareaClass} min-h-24`} onChange={(event) => setAttachmentDescription(event.target.value)} value={attachmentDescription} />
                </label>
                <label className={labelClass}>
                  File
                  <input
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="w-full min-w-0 rounded-2xl border border-dashed border-[#ded8d8] bg-[#ffffff] px-4 py-3 text-sm font-semibold text-[#333333]"
                    onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)}
                    type="file"
                  />
                </label>
                <button className="primary-button" disabled={uploadingAttachment || !attachmentFile} type="submit">
                  {uploadingAttachment ? <Loader2 className="spin-icon" size={17} /> : null}
                  {uploadingAttachment ? 'Đang tải lên' : 'Tải lên'}
                </button>
              </form>
            </section>

            <div className="rounded-[22px] border border-[#e4e4e7] bg-[#f4f4f5] p-3 shadow-[0_16px_40px_rgba(24,24,27,0.08)]">
              <div className="grid gap-2 sm:grid-cols-2 min-[1320px]:grid-cols-1">
                <button className="secondary-button" onClick={() => navigate(returnTo)} type="button">
                  Hủy
                </button>
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
                  {saving ? 'Đang lưu' : 'Lưu phiếu'}
                </button>
              </div>
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
    priority: 'NORMAL',
    engineerId: '',
    resultNote: '',
    customerFeedback: '',
    conditionAssessment: '',
    repairMethod: '',
    usingDepartment: '',
    representative: '',
    address: '',
    contactPhone: '',
    deviceName: '',
    machineModelId: '',
    modelName: '',
    serialNumber: '',
  };
}

function buildForm(repair: RepairTask): RepairForm {
  const c = repair.customer || repair.machine?.customer;
  return {
    status: repair.status || 'IN_PROGRESS',
    priority: repair.priority || 'NORMAL',
    engineerId: repair.engineer?.id || '',
    resultNote: repair.resultNote || '',
    customerFeedback: repair.customerFeedback || '',
    conditionAssessment: repair.conditionAssessment || '',
    repairMethod: repair.repairMethod || '',
    usingDepartment: repair.usingDepartment || c?.name || '',
    representative: repair.representative || (repair.customer ? (repair.customer.contactPerson || '') : ''),
    address: repair.address || (repair.customer ? (repair.customer.fullAddress || repair.customer.address || '') : ''),
    contactPhone: repair.contactPhone || (repair.customer ? (repair.customer.contactPhone || repair.customer.phone || '') : ''),
    deviceName: repair.deviceName || repair.machine?.modelName || '',
    machineModelId: '',
    modelName: repair.modelName || repair.machine?.modelName || '',
    serialNumber: repair.serialNumber || repair.machine?.serialNumber || '',
  };
}

function statusOptionsForCurrent(status: string) {
  const optionsByStatus: Record<string, Array<{ value: string; label: string }>> = {
    PENDING: [
      { value: 'PENDING', label: statusLabel('PENDING') },
      { value: 'ASSIGNED', label: statusLabel('ASSIGNED') },
      { value: 'IN_PROGRESS', label: statusLabel('IN_PROGRESS') },
      { value: 'COMPLETED', label: statusLabel('COMPLETED') },
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
      { value: 'COMPLETED', label: statusLabel('COMPLETED') },
      { value: 'CANCELLED', label: statusLabel('CANCELLED') },
    ],
    COMPLETED: [{ value: 'COMPLETED', label: statusLabel('COMPLETED') }],
    CANCELLED: [{ value: 'CANCELLED', label: statusLabel('CANCELLED') }],
  };

  return optionsByStatus[status] || [{ value: status, label: statusLabel(status) }];
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1 rounded-lg border border-[#eeeeee] bg-[#fafafa] p-3">
      <span className="text-xs font-medium text-[#666666]">{label}</span>
      <strong className="break-words text-[#1f1f1f]">{value}</strong>
    </div>
  );
}

function StandardRepairChecklist({
  items,
  onApplyPartsTemplate,
}: {
  items: string[];
  onApplyPartsTemplate: () => void;
}) {
  return (
    <section className={panelClass}>
      <div className="mb-4 border-b border-[#eeeeee] pb-4">
        <span className="text-xs font-medium text-[#18181b]">Chuẩn kỹ thuật</span>
        <h2 className="mt-1 text-lg font-medium text-[#1f1f1f]">Checklist sửa chữa</h2>
        <p className="mt-1 text-sm leading-6 text-[#666666]">Admin sẽ dựa vào các mục này để xác nhận phiếu sau khi kỹ sư hoàn tất.</p>
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <div className="rounded-lg border border-[#eeeeee] bg-[#fafafa] px-3 py-2 text-sm leading-5 text-[#333333]" key={item}>
            {item}
          </div>
        ))}
      </div>
      <button className="secondary-button mt-4 w-full justify-center" onClick={onApplyPartsTemplate} type="button">
        Thêm mẫu linh kiện
      </button>
    </section>
  );
}

function appendTextBlock(current: string, block: string) {
  return [current.trim(), block.trim()].filter(Boolean).join('\n\n');
}

function machineModelLabel(model: MachineModelOption) {
  return machineModelOptionLabel(model) || model.code || model.displayName || model.name || 'Model';
}

function modelIdByName(models: MachineModelOption[], value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  return models.find((model) => [model.name, model.displayName, model.code].filter(Boolean).some((item) => String(item).trim().toLowerCase() === normalized))?.id || '';
}

const panelClass = 'rounded-[24px] border border-[#e4e4e7] bg-white/95 p-5 shadow-[0_8px_24px_rgba(24,24,27,0.05)] sm:p-6';
const sidePanelClass = 'rounded-[24px] border border-[#e4e4e7] bg-[#ffffff] p-5 shadow-[0_8px_24px_rgba(24,24,27,0.04)]';
const sectionHeaderClass = 'mb-5 grid grid-cols-[34px_minmax(0,1fr)] gap-3 border-b border-[#e4e4e7] pb-4';
const stepBadgeClass = 'flex h-8 w-8 items-center justify-center rounded-xl bg-[#18181b] text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(24,24,27,0.24)]';
const eyebrowClass = 'text-xs font-bold uppercase tracking-[0.16em] text-[#18181b]';
const sectionTitleClass = 'mt-1 text-lg font-bold leading-tight text-[#1f1f1f]';
const sectionDescriptionClass = 'mt-1 text-xs font-medium leading-5 text-[#8a8f99]';
const labelClass = 'grid min-w-0 content-start gap-2 text-sm font-semibold text-[#333333]';
const fieldClass = 'h-12 w-full min-w-0 rounded-2xl border border-[#ded8d8] bg-[#ffffff] px-4 text-sm font-semibold text-[#1f1f1f] outline-none transition focus:border-[#18181b] focus:bg-white focus:shadow-[0_0_0_4px_rgba(24,24,27,0.12)] disabled:bg-[#f3f6f9] disabled:text-[#666666]';
const textareaClass = 'min-h-32 w-full min-w-0 resize-y rounded-2xl border border-[#ded8d8] bg-[#ffffff] px-4 py-3 text-sm font-semibold leading-relaxed text-[#1f1f1f] outline-none transition focus:border-[#18181b] focus:bg-white focus:shadow-[0_0_0_4px_rgba(24,24,27,0.12)]';

import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages } from '../../api';
import { getRoleName } from '../../auth/roles';
import { CustomerSiteFields } from '../../components/CustomerSiteFields';
import { Notice } from '../../components/Notice';
import { DateInput } from '../../components/DateInput';
import { DeleteRequestReviewPanel } from '../../components/DeleteRequestReviewPanel';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { WorkAttachmentsPanel } from '../../components/WorkAttachmentsPanel';
import { WorkMachineModelFields, modelIdByName } from '../../components/WorkMachineModelFields';
import { UsedPartDraft, WorkAccessoryOption, WorkUsedPartsEditor } from '../../components/WorkUsedPartsEditor';
import { appendChecklistLines, checklistForCategory } from '../../config/medicalDeviceChecklists';
import { useWorkAttachments } from '../../hooks/useWorkAttachments';
import {
  workEyebrowClass,
  workFieldClass,
  workLabelClass,
  workPanelClass,
  workSectionDescriptionClass,
  workSectionHeaderClass,
  workSectionTitleClass,
  workSidePanelClass,
  workStepBadgeClass,
  workTextareaClass,
} from '../../styles/workFormClasses';
import { deleteRequestReason, deleteWorkTicket, isDeletedResponse, isDeleteRequest, reviewDeleteWorkTicket } from '../../utils/workDeleteRequests';
import { buildUsedParts, fetchModelAccessories, normalizeUsedPartsPayload } from '../../utils/workParts';
import { attachmentOptionsByKind } from '../EngineerTasksPage/constants';
import type { MaintenanceTask } from '../EngineerTasksPage/types';
import { statusLabel } from '../EngineerTasksPage/utils';

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
  machineModel?: { id?: string | null } | null;
  customer?: { id?: string | null; name?: string | null } | null;
};

type MaintenanceForm = {
  status: string;
  type: string;
  engineerId: string;
  machineId: string;
  scheduledDate: string;
  nextDueDate: string;
  resultNote: string;
  checklistText: string;
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

export function MaintenanceUpdatePage({ user }: { user: ApiUser }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/my-tasks';
  const isAdmin = getRoleName(user) === 'admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detail, setDetail] = useState<MaintenanceTask | null>(null);
  const [engineers, setEngineers] = useState<EngineerOption[]>([]);
  const [machineModels, setMachineModels] = useState<MachineModelOption[]>([]);
  const [installedMachines, setInstalledMachines] = useState<StockMachine[]>([]);
  const [accessories, setAccessories] = useState<WorkAccessoryOption[]>([]);
  const [usedParts, setUsedParts] = useState<UsedPartDraft[]>([]);
  const [loadingAccessories, setLoadingAccessories] = useState(false);
  const [form, setForm] = useState<MaintenanceForm>(() => emptyForm());
  const attachmentsPanel = useWorkAttachments({
    entityId: id,
    entityType: 'Maintenance',
    initialType: 'MAINTENANCE_FORM',
    onError: setError,
    onSuccess: setSuccess,
    uploadSuccessMessage: (count) => `Đã tải ${count} ảnh/tài liệu lên phiếu bảo trì.`,
  });
  const standardChecklist = checklistForCategory(detail?.machine?.productCategory || detail?.modelName || detail?.deviceName, 'maintenance');
  const detailMachineModelId = form.machineId === (detail?.machine?.id || '') ? detail?.machine?.machineModel?.id || '' : '';
  const selectedMachineModelId = form.machineModelId || modelIdByName(machineModels, form.modelName) || detailMachineModelId;
  const selectedAccessoryModel = machineModels.find((model) => model.id === selectedMachineModelId);
  const selectedAccessoryModelLabel = selectedAccessoryModel
    ? [selectedAccessoryModel.code, selectedAccessoryModel.displayName || selectedAccessoryModel.name].filter(Boolean).join(' - ')
    : form.modelName;
  const installedMachineOptions =
    detail?.machine?.id && !installedMachines.some((machine) => machine.id === detail.machine?.id)
      ? [detail.machine as StockMachine, ...installedMachines]
      : installedMachines;
  const pendingDeleteRequest = isDeleteRequest(detail);

  useEffect(() => {
    void loadDetail();
  }, [id]);

  useEffect(() => {
    void loadAccessories(selectedMachineModelId);
  }, [selectedMachineModelId]);

  async function loadDetail() {
    if (!id) return;

    setLoading(true);
    setError('');

    try {
      const maintenance = await apiFetch<MaintenanceTask>(`/maintenance/${id}`);
      setDetail(maintenance);
      setForm(buildForm(maintenance));
      setUsedParts(buildUsedParts(maintenance.usedParts));
      await loadMachineModels();
      await loadInstalledMachines();
      if (isAdmin) {
        await loadEngineers();
      }
      await attachmentsPanel.loadAttachments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được phiếu bảo trì.');
    } finally {
      setLoading(false);
    }
  }

  function updateForm(patch: Partial<MaintenanceForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function updateMachineForm(patch: Partial<MaintenanceForm>) {
    const nextModelId = patch.machineModelId ?? form.machineModelId;
    if ((patch.machineId && patch.machineId !== form.machineId) || (nextModelId && nextModelId !== selectedMachineModelId)) {
      setUsedParts([]);
    }
    updateForm(patch);
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

  async function loadAccessories(machineModelId: string) {
    if (!machineModelId) {
      setAccessories([]);
      return;
    }

    setLoadingAccessories(true);
    try {
      setAccessories(await fetchModelAccessories(machineModelId));
    } catch {
      setAccessories([]);
    } finally {
      setLoadingAccessories(false);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiFetch(`/maintenance/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: form.status,
          ...(isAdmin
            ? {
                type: form.type,
                engineerId: form.engineerId || null,
              }
            : {}),
          machineId: form.machineId || undefined,
          scheduledDate: form.scheduledDate || undefined,
          nextDueDate: form.nextDueDate || undefined,
          resultNote: form.resultNote.trim() || undefined,
          checklist: splitLines(form.checklistText),
          usingDepartment: form.usingDepartment.trim() || undefined,
          representative: form.representative.trim() || undefined,
          address: form.address.trim() || undefined,
          contactPhone: form.contactPhone.trim() || undefined,
          deviceName: form.deviceName.trim() || undefined,
          modelName: form.modelName.trim() || undefined,
          serialNumber: form.serialNumber.trim() || undefined,
          usedParts: normalizeUsedPartsPayload(usedParts),
        }),
      });
      setSuccess('Đã cập nhật phiếu bảo trì.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được phiếu bảo trì.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTicket() {
    const reason = isAdmin ? '' : window.prompt('Nhập lý do yêu cầu xóa phiếu bảo trì:')?.trim();
    if (!isAdmin && !reason) return;

    const message = isAdmin
      ? 'Xóa vĩnh viễn phiếu bảo trì này?'
      : 'Gửi yêu cầu xóa phiếu bảo trì để admin duyệt?';
    if (!window.confirm(message)) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await deleteWorkTicket(`/maintenance/${id}`, reason);

      if (response.deleted) {
        navigate(returnTo);
        return;
      }

      if (response.deleteRequested) {
        setSuccess('Đã gửi yêu cầu xóa phiếu. Admin sẽ duyệt trước khi xóa.');
        await loadDetail();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được phiếu bảo trì.');
    } finally {
      setSaving(false);
    }
  }

  async function reviewDeleteRequest(approved: boolean) {
    const reviewNote = approved ? '' : window.prompt('Nhập lý do không duyệt xóa phiếu:')?.trim();
    if (!approved && !reviewNote) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await reviewDeleteWorkTicket<MaintenanceTask>(`/maintenance/${id}/review`, approved, reviewNote);

      if (isDeletedResponse(response)) {
        navigate(returnTo);
        return;
      }

      setSuccess(approved ? 'Đã duyệt xóa phiếu bảo trì.' : 'Đã từ chối yêu cầu xóa phiếu bảo trì.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không duyệt được yêu cầu xóa phiếu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageFrame>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Bảo trì"
          title="Cập nhật phiếu bảo trì"
          description="Checklist & kết quả."
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
          Đang tải phiếu bảo trì...
        </div>
      ) : (
        <form className="grid min-w-0 gap-5 min-[1320px]:grid-cols-[minmax(0,1fr)_380px]" onSubmit={submit}>
          <section className="grid min-w-0 gap-5">
            <div className={panelClass}>
              <div className={sectionHeaderClass}>
                <span className={stepBadgeClass}>1</span>
                <div>
                  <span className={eyebrowClass}>Thông tin phiếu</span>
                  <h2 className={sectionTitleClass}>{detail?.title || 'Phiếu bảo trì'}</h2>
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
                    Loại bảo trì
                    <select className={fieldClass} onChange={(event) => updateForm({ type: event.target.value })} value={form.type}>
                      <option value="PERIODIC">Định kỳ</option>
                      <option value="WARRANTY">Bảo hành</option>
                      <option value="CONTRACT">Hợp đồng</option>
                      <option value="INTERNAL">Nội bộ</option>
                      <option value="OTHER">Khác</option>
                    </select>
                  </label>
                ) : null}
                {isAdmin ? (
                  <label className={labelClass}>
                    Kỹ sư
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
                <DateInput className={labelClass} label="Ngày bảo trì" onChange={(value) => updateForm({ scheduledDate: value })} value={form.scheduledDate} />
                <DateInput className={labelClass} label="Lịch bảo trì tiếp theo" onChange={(value) => updateForm({ nextDueDate: value })} value={form.nextDueDate} />
                <WorkMachineModelFields
                  deviceName={form.deviceName}
                  fieldClassName={fieldClass}
                  installedMachines={installedMachineOptions}
                  labelClassName={labelClass}
                  lockedByMachine={Boolean(form.machineId)}
                  machineModelId={form.machineModelId}
                  machineModels={machineModels}
                  modelName={form.modelName}
                  onChange={updateMachineForm}
                  selectedMachineId={form.machineId}
                  serialNumber={form.serialNumber}
                />
                <label className={`${labelClass} md:col-span-2`}>
                  Checklist
                  <textarea className={textareaClass} onChange={(event) => updateForm({ checklistText: event.target.value })} placeholder="Mỗi dòng là một hạng mục kiểm tra" value={form.checklistText} />
                </label>
                <div className="md:col-span-2">
                  <StandardChecklistPanel
                    items={standardChecklist}
                    onApply={() => updateForm({ checklistText: appendChecklistLines(form.checklistText, standardChecklist) })}
                    title="Checklist chuẩn theo ngành hàng"
                  />
                </div>
                <label className={`${labelClass} md:col-span-2`}>
                  Kết quả/Ghi chú kỹ thuật
                  <textarea className={textareaClass} onChange={(event) => updateForm({ resultNote: event.target.value })} value={form.resultNote} />
                </label>
              </div>
            </div>

            <WorkUsedPartsEditor
              accessories={accessories}
              items={usedParts}
              loading={loadingAccessories}
              modelLabel={selectedAccessoryModelLabel}
              modelSelected={Boolean(selectedMachineModelId)}
              onChange={setUsedParts}
            />

            <div className={panelClass}>
              <div className={sectionHeaderClass}>
                <span className={stepBadgeClass}>2</span>
                <div>
                  <span className={eyebrowClass}>Khách hàng</span>
                  <h2 className={sectionTitleClass}>Thông tin tại điểm bảo trì</h2>
                  <p className={sectionDescriptionClass}>Liên hệ & địa chỉ.</p>
                </div>
              </div>
              <CustomerSiteFields
                address={form.address}
                contactPhone={form.contactPhone}
                fieldClassName={fieldClass}
                labelClassName={labelClass}
                onChange={updateForm}
                onSync={syncAddressFromCustomer}
                representative={form.representative}
                usingDepartment={form.usingDepartment}
              />
            </div>
          </section>

          <aside className="grid min-w-0 gap-4 self-start min-[1320px]:sticky min-[1320px]:top-5">
            {isAdmin && pendingDeleteRequest ? (
              <DeleteRequestReviewPanel
                disabled={saving}
                onApprove={() => void reviewDeleteRequest(true)}
                onReject={() => void reviewDeleteRequest(false)}
                reason={deleteRequestReason(detail)}
              />
            ) : null}

            <div className={sidePanelClass}>
              <span className={eyebrowClass}>Tóm tắt máy</span>
              <div className="mt-3 grid gap-3 text-sm text-[#333333]">
                <SummaryRow label="Mã máy" value={detail?.machine?.machineCode || '-'} />
                <SummaryRow label="S/N hệ thống" value={detail?.machine?.serialNumber || '-'} />
                <SummaryRow label="Model hệ thống" value={detail?.machine?.modelName || '-'} />
                <SummaryRow label="Khách hàng hệ thống" value={detail?.machine?.customer?.name || '-'} />
              </div>
            </div>

            <WorkAttachmentsPanel
              {...attachmentsPanel}
              descriptionClassName={textareaClass}
              fieldClassName={fieldClass}
              labelClassName={labelClass}
              loading={attachmentsPanel.loadingAttachments}
              onDescriptionChange={attachmentsPanel.setAttachmentDescription}
              onDownload={attachmentsPanel.downloadAttachment}
              onFilesChange={attachmentsPanel.setAttachmentFiles}
              onTitleChange={attachmentsPanel.setAttachmentTitle}
              onTypeChange={attachmentsPanel.setAttachmentType}
              onUpload={attachmentsPanel.uploadAttachment}
              onView={attachmentsPanel.viewAttachment}
              options={attachmentOptionsByKind.maintenance}
              titlePlaceholder="VD: Phiếu bảo trì có chữ ký"
              uploading={attachmentsPanel.uploadingAttachment}
            />

            <div className="rounded-[22px] border border-[#e4e4e7] bg-[#f4f4f5] p-3 shadow-[0_16px_40px_rgba(24,24,27,0.08)]">
              <div className="grid gap-2 sm:grid-cols-2 min-[1320px]:grid-cols-1">
                <button className="secondary-button" onClick={() => navigate(returnTo)} type="button">
                  Hủy
                </button>
                <button className="secondary-button justify-center text-[#b5121b]" disabled={saving} onClick={() => void deleteTicket()} type="button">
                  <Trash2 size={17} />
                  {isAdmin ? 'Xóa phiếu' : 'Yêu cầu xóa'}
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

function emptyForm(): MaintenanceForm {
  return {
    status: 'IN_PROGRESS',
    type: 'PERIODIC',
    engineerId: '',
    machineId: '',
    scheduledDate: '',
    nextDueDate: '',
    resultNote: '',
    checklistText: '',
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

function buildForm(maintenance: MaintenanceTask): MaintenanceForm {
  const c = maintenance.customer || maintenance.machine?.customer;
  return {
    status: maintenance.status || 'IN_PROGRESS',
    type: maintenance.type || 'PERIODIC',
    engineerId: maintenance.engineer?.id || '',
    machineId: maintenance.machine?.id || '',
    scheduledDate: dateInputValue(maintenance.scheduledDate),
    nextDueDate: dateInputValue(maintenance.nextDueDate),
    resultNote: maintenance.resultNote || '',
    checklistText: maintenance.checklist?.join('\n') || '',
    usingDepartment: maintenance.usingDepartment || c?.name || '',
    representative: maintenance.representative || (maintenance.customer ? (maintenance.customer.contactPerson || '') : ''),
    address: maintenance.address || (maintenance.customer ? (maintenance.customer.fullAddress || maintenance.customer.address || '') : ''),
    contactPhone: maintenance.contactPhone || (maintenance.customer ? (maintenance.customer.contactPhone || maintenance.customer.phone || '') : ''),
    deviceName: maintenance.deviceName || maintenance.machine?.modelName || '',
    machineModelId: maintenance.machine?.machineModel?.id || '',
    modelName: maintenance.modelName || maintenance.machine?.modelName || '',
    serialNumber: maintenance.serialNumber || maintenance.machine?.serialNumber || '',
  };
}

function statusOptionsForCurrent(status: string) {
  const optionsByStatus: Record<string, Array<{ value: string; label: string }>> = {
    SCHEDULED: [
      { value: 'SCHEDULED', label: statusLabel('SCHEDULED') },
      { value: 'ASSIGNED', label: statusLabel('ASSIGNED') },
      { value: 'IN_PROGRESS', label: statusLabel('IN_PROGRESS') },
      { value: 'COMPLETED', label: statusLabel('COMPLETED') },
      { value: 'CANCELLED', label: statusLabel('CANCELLED') },
    ],
    ASSIGNED: [
      { value: 'ASSIGNED', label: statusLabel('ASSIGNED') },
      { value: 'IN_PROGRESS', label: statusLabel('IN_PROGRESS') },
      { value: 'COMPLETED', label: statusLabel('COMPLETED') },
      { value: 'CANCELLED', label: statusLabel('CANCELLED') },
    ],
    OVERDUE: [
      { value: 'OVERDUE', label: statusLabel('OVERDUE') },
      { value: 'ASSIGNED', label: statusLabel('ASSIGNED') },
      { value: 'IN_PROGRESS', label: statusLabel('IN_PROGRESS') },
      { value: 'COMPLETED', label: statusLabel('COMPLETED') },
      { value: 'CANCELLED', label: statusLabel('CANCELLED') },
    ],
    IN_PROGRESS: [
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

function StandardChecklistPanel({ items, onApply, title }: { items: string[]; onApply: () => void; title: string }) {
  return (
    <div className="grid gap-3 rounded-lg border border-[#dbe5ef] bg-[#fafafa] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <strong className="text-sm text-[#1f1f1f]">{title}</strong>
          <p className="mt-1 text-xs leading-5 text-[#666666]">Checklist mẫu.</p>
        </div>
        <button className="secondary-button compact" onClick={onApply} type="button">
          Add to checklist
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div className="rounded-lg border border-[#eeeeee] bg-white px-3 py-2 text-sm leading-5 text-[#333333]" key={item}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

const panelClass = workPanelClass;
const sidePanelClass = workSidePanelClass;
const sectionHeaderClass = workSectionHeaderClass;
const stepBadgeClass = workStepBadgeClass;
const eyebrowClass = workEyebrowClass;
const sectionTitleClass = workSectionTitleClass;
const sectionDescriptionClass = workSectionDescriptionClass;
const labelClass = workLabelClass;
const fieldClass = workFieldClass;
const textareaClass = workTextareaClass;

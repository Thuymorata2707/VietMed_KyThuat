import { ArrowLeft, Download, Loader2, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, apiFetchAllPages, getApiBaseUrl, getToken } from '../../api';
import { getRoleName } from '../../auth/roles';
import { invalidateWorkTicketQueries } from '../../utils/workDeleteRequests';
import { DateInput } from '../../components/DateInput';
import { InfoHint } from '../../components/InfoHint';
import { ModelInfoFields } from '../../components/ModelInfoFields';
import { Notice } from '../../components/Notice';
import { DeleteTicketDialog } from '../../components/DeleteTicketDialog';
import { MachineAccessoryEditor } from '../../components/MachineAccessoryEditor';
import { WorkAttachmentsPanel } from '../../components/WorkAttachmentsPanel';
import { isEndoscopyMachineModel } from '../../config/endoscopyAccessories';
import { isUltrasoundMachineModel } from '../../config/ultrasoundProbes';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { useWorkAttachments } from '../../hooks/useWorkAttachments';
import {
  workEyebrowClass,
  workPanelClass,
  workSectionHeaderClass,
  workSectionTitleClass,
  workSidePanelClass,
  workStepBadgeClass,
} from '../../styles/workFormClasses';
import { parseMachineAccessoriesInput, serializeMachineAccessories } from '../../utils/machineAccessories';
import { machineModelName, machineModelOptionLabel, machineProductName } from '../../utils/machineDisplayName';
import { attachmentOptionsByKind } from '../EngineerTasksPage/constants';
import type { CreateTicketForm, InstallationDeviceItem, InstallationTask } from '../EngineerTasksPage/types';
import { emptyCreateTicketForm, emptyInstallationDeviceItem, normalizeInstallationDeviceItems } from '../EngineerTasksPage/utils';

type EngineerOption = {
  id: string;
  fullName?: string | null;
  email: string;
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

type StockMachine = {
  id: string;
  code?: string | null;
  machineCode?: string | null;
  serialNumber?: string | null;
  modelName?: string | null;
  manufacturer?: string | null;
  productCategory?: string | null;
  machineModel?: MachineModelOption | null;
  displayName?: string | null;
  name?: string | null;
  customer?: { id?: string | null; name?: string | null } | null;
};

const statusOptions = [
  { value: 'PENDING', label: 'Chờ triển khai' },
  { value: 'INSTALLED', label: 'Đã lắp đặt' },
  { value: 'CANCELLED', label: 'Hủy' },
];

export function InstallationUpdatePage({ user }: { user: ApiUser }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const role = getRoleName(user);
  const returnTo = searchParams.get('returnTo') || '/installations';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detail, setDetail] = useState<InstallationTask | null>(null);
  const [status, setStatus] = useState('PENDING');
  const [installedAt, setInstalledAt] = useState('');
  const [note, setNote] = useState('');
  const [machineSerialNumber, setMachineSerialNumber] = useState('');
  const [machineCode, setMachineCode] = useState('');
  const [machinePreviewCode, setMachinePreviewCode] = useState('');
  const [machineAccessoriesText, setMachineAccessoriesText] = useState('');
  const [machineAccessoriesLoaded, setMachineAccessoriesLoaded] = useState(true);
  const [installedById, setInstalledById] = useState('');
  const [engineers, setEngineers] = useState<EngineerOption[]>([]);
  const [machineModels, setMachineModels] = useState<MachineModelOption[]>([]);
  const [stockMachines, setStockMachines] = useState<StockMachine[]>([]);
  const [form, setForm] = useState<CreateTicketForm>(() => emptyCreateTicketForm('installation'));
  const attachmentsPanel = useWorkAttachments({
    entityId: id,
    entityType: 'MachineInstallation',
    initialType: 'MACHINE_PHOTO',
    onError: setError,
    onSuccess: setSuccess,
    uploadSuccessMessage: (count) => `Đã tải ${count} ảnh/tài liệu lên phiếu lắp đặt.`,
  });
  const isAdmin = role === 'admin';
  const canApprove = isAdmin || role === 'manager';
  const selectedMachine =
    stockMachines.find((machine) => machine.id === form.machineId) ||
    (detail?.machine?.id === form.machineId
        ? {
          id: detail.machine.id,
          code: detail.machine.machineModel?.code,
          machineCode: detail.machine.machineCode,
          serialNumber: detail.machine.serialNumber,
          modelName: detail.machine.modelName,
          manufacturer: detail.machine.manufacturer,
          productCategory: detail.machine.productCategory,
          machineModel: detail.machine.machineModel,
          displayName: detail.machine.machineModel?.displayName,
          name: detail.machine.name,
          customer: null,
        }
      : null);
  const formMachineModel = machineModels.find((model) => model.id === form.machineModelId);
  const accessoryModel = selectedMachine?.machineModel || (selectedMachine
    ? {
        code: selectedMachine.code,
        name: selectedMachine.modelName || selectedMachine.name,
        displayName: selectedMachine.displayName,
        productCategory: selectedMachine.productCategory,
      }
    : null) || formMachineModel || (form.modelName || form.deviceName
      ? {
          code: form.modelName,
          name: form.modelName || form.deviceName,
          displayName: form.deviceName,
          productCategory: form.productCategory,
        }
      : detail?.plannedMachineModel);
  const accessoryMode: 'probe' | 'endoscopy' | null = isEndoscopyMachineModel({
    code: accessoryModel?.code,
    name: accessoryModel?.name || detail?.plannedModelName,
    displayName: accessoryModel?.displayName,
    productCategory: accessoryModel?.productCategory,
  })
    ? 'endoscopy'
    : isUltrasoundMachineModel({
        code: accessoryModel?.code,
        name: accessoryModel?.name || detail?.plannedModelName,
        displayName: accessoryModel?.displayName,
        productCategory: accessoryModel?.productCategory,
      })
      ? 'probe'
      : null;
  const primaryMachineExpected = Boolean(form.machineId || hasMachineDraft(form, machineSerialNumber));
  const extraMachineCount = form.installedDeviceItems
    .filter((item) => item.itemName.trim())
    .reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
  const plannedMachineCount = (primaryMachineExpected ? 1 : 0) + extraMachineCount;
  const installedMachineCount =
    (primaryMachineExpected && status === 'INSTALLED' ? 1 : 0) +
    form.installedDeviceItems
      .filter((item) => item.itemName.trim() && item.isInstalled)
      .reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);

  useEffect(() => {
    loadDetail();
  }, [id]);

  useEffect(() => {
    if (machineCode) {
      setMachinePreviewCode(machineCode);
      return;
    }

    let cancelled = false;
    const source = selectedMachine?.modelName || selectedMachine?.name || form.modelName || form.deviceName || detail?.plannedMachineModel?.code || detail?.plannedMachineModel?.name || detail?.plannedModelName || 'MAY';
    const params = new URLSearchParams({ source });

    void apiFetch<{ code?: string | null }>(`/machines/next-code?${params.toString()}`)
      .then((result) => {
        if (!cancelled) setMachinePreviewCode(result.code || '');
      })
      .catch(() => {
        if (!cancelled) setMachinePreviewCode('');
      });

    return () => {
      cancelled = true;
    };
  }, [machineCode, selectedMachine?.modelName, selectedMachine?.name, detail?.plannedMachineModel?.code, detail?.plannedMachineModel?.name, detail?.plannedModelName, form.machineModelId, form.modelName, form.deviceName]);

  async function loadDetail() {
    if (!id) return;

    setLoading(true);
    setError('');

    try {
      const installation = await apiFetch<InstallationTask>(`/installations/${id}`);
      const mainDeviceItem = getMainMachineDeviceItem(installation);
      setDetail(installation);
      setStatus(installation.status || 'PENDING');
      setInstalledAt(dateInputValue(installation.installedAt));
      setNote(installation.note || '');
      setMachineSerialNumber(installation.machine?.serialNumber || mainDeviceItem?.serialNumber || '');
      setMachineCode(installation.machine?.machineCode || '');
      setMachineAccessoriesText('');
      setInstalledById(installation.installedBy?.id || '');
      setForm(buildForm(installation));
      setMachineAccessoriesLoaded(!installation.machine?.id);
      if (installation.machine?.id) {
        try {
          const accessories = await apiFetch<unknown[]>(`/machines/${installation.machine.id}/accessories`);
          setMachineAccessoriesText(serializeMachineAccessories(accessories));
          setMachineAccessoriesLoaded(true);
        } catch {
          setMachineAccessoriesText('');
          setMachineAccessoriesLoaded(false);
          setError('Không tải được phụ kiện hiện có. Chưa thể lưu phiếu để tránh làm mất dữ liệu phụ kiện.');
        }
      } else {
        // Keep accessories on the primary device item until its machine
        // record is created when the installation is completed.
        setMachineAccessoriesText(serializeMachineAccessories(mainDeviceItem?.accessories));
      }
      await loadMachineModels();
      await loadStockMachines();
      if (isAdmin) {
        await loadEngineers();
      }
      await attachmentsPanel.loadAttachments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được phiếu lắp đặt.');
    } finally {
      setLoading(false);
    }
  }

  function updateForm(patch: Partial<CreateTicketForm>) {
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

  async function loadStockMachines() {
    try {
      const availableMachines = await apiFetchAllPages<StockMachine>(
        '/machines?inventoryStatus=IN_STOCK',
      );
      setStockMachines(mergeMachines(availableMachines));
    } catch {
      setStockMachines([]);
    }
  }

  useEffect(() => {
    if (detail?.customer) {
      const c = detail.customer;
      if (!form.receiverInstallAddress && (c.fullAddress || c.address)) {
        updateForm({ receiverInstallAddress: c.fullAddress || c.address || '' });
      }
      if (!form.receiverRepresentative && c.contactPerson) {
        updateForm({ receiverRepresentative: c.contactPerson });
      }
      if (!form.receiverPosition && c.contactPosition) {
        updateForm({ receiverPosition: c.contactPosition });
      }
      if (!form.receiverPhone && (c.contactPhone || c.phone)) {
        updateForm({ receiverPhone: c.contactPhone || c.phone || '' });
      }
    }
  }, [detail]);

  function syncAddressFromCustomer() {
    const c = detail?.customer;
    if (!c) return;
    updateForm({
      receiverInstallAddress: c.fullAddress || c.address || form.receiverInstallAddress,
      receiverRepresentative: c.contactPerson || form.receiverRepresentative,
      receiverPosition: c.contactPosition || form.receiverPosition,
      receiverPhone: c.contactPhone || c.phone || form.receiverPhone,
    });
  }

  function updateDeviceItem(index: number, patch: Partial<InstallationDeviceItem>) {
    setForm((current) => ({
      ...current,
      installedDeviceItems: current.installedDeviceItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addDeviceItem() {
    setForm((current) => ({
      ...current,
      installedDeviceItems: [...current.installedDeviceItems, emptyInstallationDeviceItem()],
    }));
  }

  function removeDeviceItem(index: number) {
    setForm((current) => ({
      ...current,
      installedDeviceItems: current.installedDeviceItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function selectStockMachine(machineId: string) {
    const machine = stockMachines.find((m) => m.id === machineId);
    if (!machine) {
      updateForm({ machineId: '' });
      setMachineSerialNumber('');
      setMachineCode('');
      setMachineAccessoriesText('');
      setMachineAccessoriesLoaded(true);
      return;
    }
    updateForm({ machineId });
    setMachineSerialNumber(machine.serialNumber || '');
    setMachineCode(machine.machineCode || '');
    setMachineAccessoriesLoaded(false);
    setMachineAccessoriesText('');
    apiFetch<unknown[]>(`/machines/${machineId}/accessories`)
      .then((accessories) => {
        setMachineAccessoriesText(serializeMachineAccessories(accessories));
        setMachineAccessoriesLoaded(true);
      })
      .catch(() => setError('Không tải được phụ kiện của máy đã chọn; chưa thể lưu để tránh mất dữ liệu.'));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    if (!machineAccessoriesLoaded) {
      setError('Chưa tải được danh sách phụ kiện hiện có. Vui lòng tải lại trước khi lưu.');
      setSaving(false);
      return;
    }
    if (status === 'INSTALLED' && (plannedMachineCount === 0 || installedMachineCount < plannedMachineCount)) {
      setError(`Đã xác nhận lắp ${installedMachineCount}/${plannedMachineCount} máy. Hãy đánh dấu đủ máy trước khi hoàn tất.`);
      setSaving(false);
      return;
    }

    try {
      await apiFetch(`/installations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          ...(isAdmin ? { installedById: installedById || undefined } : {}),
          installedAt: installedAt || form.workDate || undefined,
          warrantyStartDate: form.workDate || installedAt || undefined,
          warrantyEndDate: form.warrantyEndDate || undefined,
          machineModelId: form.machineModelId || undefined,
          machineId: form.machineId || undefined,
          machineSerialNumber: machineSerialNumber.trim() || undefined,
          machineCode: undefined,
          machineName: form.deviceName.trim() || undefined,
          modelName: form.modelName.trim() || undefined,
          manufacturer: form.manufacturer.trim() || undefined,
          productCategory: form.productCategory || undefined,
          machineAccessories: parseMachineAccessoriesInput(machineAccessoriesText),
          note,
          warrantyNote: form.description,
          handoverInstallerName: form.handoverInstallerName,
          handoverInstallerPosition: form.handoverInstallerPosition,
          handoverVehicle: form.handoverVehicle,
          handoverDepartureDate: form.handoverDepartureDate || undefined,
          receiverInstallAddress: form.receiverInstallAddress,
          receiverRepresentative: form.receiverRepresentative,
          receiverPosition: form.receiverPosition,
          receiverPhone: form.receiverPhone,
          installedDeviceItems: normalizeInstallationDeviceItems([
            ...form.installedDeviceItems,
            ...(form.machineId || hasMachineDraft(form, machineSerialNumber)
              ? [{
                  ...emptyInstallationDeviceItem(),
                  itemName: selectedMachine?.name || form.deviceName.trim() || form.modelName.trim() || 'Máy lắp đặt',
                  model: selectedMachine?.modelName || form.modelName.trim(),
                  manufacturer: form.manufacturer.trim(),
                  productCategory: form.productCategory,
                  sourceMachineId: form.machineId || undefined,
                  serialNumber: machineSerialNumber.trim() || selectedMachine?.serialNumber || '',
                  isPrimary: true,
                  isInstalled: status === 'INSTALLED',
                  accessoriesText: machineAccessoriesText,
                  accessoriesConfigured: true,
                }]
              : []),
          ]),
          deviceCondition: form.deviceCondition,
          deviceConditionNote: form.deviceConditionNote,
        }),
      });

      setSuccess('Đã lưu phiếu lắp đặt.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được phiếu lắp đặt.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTicket() {
    if (!isAdmin) return;
    setDeleting(true);
    setError('');
    try {
      await apiFetch(`/installations/${id}`, { method: 'DELETE' });
      setShowDeleteConfirm(false);
      await invalidateWorkTicketQueries(queryClient);
      navigate(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được phiếu lắp đặt.');
    } finally {
      setDeleting(false);
    }
  }

  async function downloadHandoverDocx() {
    if (!id) return;

    setExporting(true);
    setError('');
    setSuccess('');

    try {
      const headers = new Headers();
      const token = getToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);

      const response = await fetch(`${getApiBaseUrl()}/installations/${id}/handover-docx`, {
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        throw new Error('Không tạo được file Word biên bản.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `phieu-ban-giao-${safeFileName(detail?.code || id)}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setSuccess('Đã tạo file Word biên bản.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được file Word biên bản.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageFrame>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Lắp đặt"
          meta={detail?.code}
          title="Cập nhật phiếu lắp đặt"
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
          Đang tải phiếu lắp đặt...
        </div>
      ) : (
        <form className="grid min-w-0 gap-5 min-[1320px]:grid-cols-[minmax(0,1fr)_380px]" onSubmit={submit}>
          <section className="grid min-w-0 gap-5">
            <div className={panelClass}>
              <div className={sectionHeaderClass}>
                <span className={stepBadgeClass}>1</span>
                <div>
                  <span className={eyebrowClass}>Thời gian và bảo hành</span>
                  <h2 className={sectionTitleClass}>Thông tin lắp đặt</h2>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <DateInput className="grid gap-2 text-sm font-semibold text-[#333333]" label="Ngày lắp đặt" onChange={setInstalledAt} value={installedAt} />
                <DateInput className="grid gap-2 text-sm font-semibold text-[#333333]" label="Bắt đầu bảo hành" onChange={(value) => updateForm({ workDate: value })} value={form.workDate} />
                <DateInput className="grid gap-2 text-sm font-semibold text-[#333333]" label="Kết thúc bảo hành" onChange={(value) => updateForm({ warrantyEndDate: value })} value={form.warrantyEndDate} />
                <label className="grid gap-2 text-sm font-semibold text-[#333333] md:col-span-2">
                  Ghi chú lắp đặt
                  <textarea className={textareaClass} onChange={(event) => setNote(event.target.value)} value={note} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-[#333333] md:col-span-2">
                  Ghi chú bảo hành
                  <textarea className={textareaClass} onChange={(event) => updateForm({ description: event.target.value })} value={form.description} />
                </label>
              </div>
            </div>

            <div className={panelClass}>
              <div className={sectionHeaderClass}>
                <span className={stepBadgeClass}>2</span>
                <div>
                  <span className={eyebrowClass}>Bên bàn giao</span>
                  <h2 className={sectionTitleClass}>Thông tin kỹ sư</h2>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className={labelClass}>
                  Người lắp đặt
                  <input
                    className={fieldClass}
                    onChange={(event) => updateForm({ handoverInstallerName: event.target.value })}
                    placeholder={user.fullName || user.email}
                    value={form.handoverInstallerName}
                  />
                </label>
                <label className={labelClass}>
                  Chức vụ
                  <input className={fieldClass} onChange={(event) => updateForm({ handoverInstallerPosition: event.target.value })} value={form.handoverInstallerPosition} />
                </label>
                <label className={labelClass}>
                  Phương tiện đi
                  <input className={fieldClass} onChange={(event) => updateForm({ handoverVehicle: event.target.value })} value={form.handoverVehicle} />
                </label>
                <DateInput className={labelClass} label="Ngày đi" onChange={(value) => updateForm({ handoverDepartureDate: value })} value={form.handoverDepartureDate} />
              </div>
            </div>

            <div className={panelClass}>
              <div className={sectionHeaderClass}>
                <span className={stepBadgeClass}>3</span>
                <div>
                  <span className={eyebrowClass}>Bên nhận bàn giao</span>
                  <h2 className={sectionTitleClass}>Thông tin khách hàng</h2>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className={`${labelClass} md:col-span-2`}>
                  <span className="flex items-center gap-2">
                    Địa chỉ lắp đặt
                    <button className="text-xs font-medium text-[#b5121b] hover:underline" onClick={syncAddressFromCustomer} type="button">
                      <RefreshCw size={13} className="inline" /> Lấy từ hồ sơ
                    </button>
                  </span>
                  <input className={fieldClass} onChange={(event) => updateForm({ receiverInstallAddress: event.target.value })} value={form.receiverInstallAddress} />
                </label>
                <label className={labelClass}>
                  Người đại diện
                  <input className={fieldClass} onChange={(event) => updateForm({ receiverRepresentative: event.target.value })} value={form.receiverRepresentative} />
                </label>
                <label className={labelClass}>
                  Chức vụ
                  <input className={fieldClass} onChange={(event) => updateForm({ receiverPosition: event.target.value })} value={form.receiverPosition} />
                </label>
                <label className={labelClass}>
                  SĐT
                  <input className={fieldClass} onChange={(event) => updateForm({ receiverPhone: event.target.value })} value={form.receiverPhone} />
                </label>
              </div>
            </div>

            <div className={panelClass}>
              <div className={sectionHeaderClass}>
                <span className={stepBadgeClass}>4</span>
                <div>
                  <span className={eyebrowClass}>Máy & thiết bị</span>
                  <h2 className={sectionTitleClass}>Máy và thiết bị lắp đặt</h2>
                  <span className="mt-1 inline-flex w-fit items-center rounded-md border border-[#dbe5ef] bg-white px-2 py-1 text-xs font-semibold text-[#475467]">
                    {plannedMachineCount ? `${installedMachineCount}/${plannedMachineCount} máy đã lắp` : 'Chưa khai báo máy'}
                  </span>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className={`${labelClass} md:col-span-2`}>
                  Chọn máy có sẵn trong kho
                  {status === 'INSTALLED' && selectedMachine ? (
                    <div className={`${fieldClass} flex items-center bg-[#f4f4f5]`}>
                      {selectedMachine.machineCode} · S/N {selectedMachine.serialNumber || '—'} · {selectedMachine.modelName || selectedMachine.name}
                    </div>
                  ) : (
                    <select
                      className={fieldClass}
                      onChange={(event) => selectStockMachine(event.target.value)}
                      value={form.machineId}
                    >
                      <option value="">Chưa liên kết — khai báo máy bên dưới</option>
                      {selectedMachine && !stockMachines.some((machine) => machine.id === selectedMachine.id) ? (
                        <option value={selectedMachine.id}>
                          {[selectedMachine.machineCode, selectedMachine.serialNumber ? `S/N ${selectedMachine.serialNumber}` : '', selectedMachine.modelName || selectedMachine.name]
                            .filter(Boolean)
                            .join(' - ')}
                        </option>
                      ) : null}
                      {stockMachines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {[m.machineCode, m.serialNumber ? `S/N ${m.serialNumber}` : '', m.modelName || m.name].filter(Boolean).join(' - ')}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                {selectedMachine ? (
                  <div className="grid gap-3 rounded-2xl border border-[#e8e3df] bg-[#faf8f6] p-4 md:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm text-[#514944]">{status === 'INSTALLED' ? 'Máy đã lắp' : 'Máy đã chọn'}</strong>
                      {status !== 'INSTALLED' ? <span className="text-xs font-medium text-[#85807c]">Thông tin từ kho</span> : null}
                    </div>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-3 xl:grid-cols-4">
                      <InfoCell label="Model" value={selectedMachine.modelName || selectedMachine.name} />
                      <InfoCell label="S/N" value={selectedMachine.serialNumber || machineSerialNumber} />
                      <InfoCell label="Hãng" value={selectedMachine.manufacturer} />
                      <InfoCell label="Mã máy" value={selectedMachine.machineCode} />
                    </div>
                  </div>
                ) : (
                  <>
                    <label className={`${labelClass} md:col-span-2`}>
                      Model danh mục
                      <select
                        className={fieldClass}
                        onChange={(event) => {
                          const model = machineModels.find((item) => item.id === event.target.value);
                          updateForm({
                            machineModelId: model?.id || '',
                            modelName: model?.name || '',
                            manufacturer: model?.manufacturer || '',
                            productCategory: model?.productCategory || 'OTHER',
                            deviceName: model?.displayName || model?.name || form.deviceName,
                          });
                        }}
                        value={form.machineModelId || ''}
                      >
                        <option value="">Chọn model</option>
                        {machineModels.map((model) => (
                          <option key={model.id} value={model.id}>{machineModelOptionLabel(model)}</option>
                        ))}
                      </select>
                    </label>
                    <label className={labelClass}>
                      Tên thiết bị
                      <input className={fieldClass} onChange={(event) => updateForm({ deviceName: event.target.value })} required={status === 'INSTALLED'} value={form.deviceName} />
                    </label>
                    <label className={labelClass}>
                      Model thực tế
                      <input className={fieldClass} onChange={(event) => updateForm({ modelName: event.target.value, machineModelId: '' })} required={status === 'INSTALLED'} value={form.modelName} />
                    </label>
                    <label className={labelClass}>
                      Hãng sản xuất
                      <input className={fieldClass} onChange={(event) => updateForm({ manufacturer: event.target.value })} required={status === 'INSTALLED'} value={form.manufacturer} />
                    </label>
                    <label className={labelClass}>
                      Nhóm thiết bị
                      <select className={fieldClass} onChange={(event) => updateForm({ productCategory: event.target.value })} value={form.productCategory}>
                        <option value="ULTRASOUND">Siêu âm</option>
                        <option value="LAB_TESTING">Xét nghiệm</option>
                        <option value="BIOCHEMISTRY">Sinh hóa</option>
                        <option value="IMMUNOLOGY">Miễn dịch</option>
                        <option value="HEMATOLOGY">Huyết học</option>
                        <option value="X_RAY">X-quang</option>
                        <option value="ENDOSCOPY">Nội soi</option>
                        <option value="OTHER">Khác</option>
                      </select>
                    </label>
                    <div className={`${labelClass} md:col-span-2`}>
                      <span>S/N máy thực tế</span>
                      <div className="flex gap-2">
                        <input aria-label="S/N máy thực tế" autoComplete="off" className={fieldClass} onChange={(event) => setMachineSerialNumber(event.target.value)} required={status === 'INSTALLED'} value={machineSerialNumber} />
                        <BarcodeScannerButton onScan={setMachineSerialNumber} />
                      </div>
                    </div>
                  </>
                )}
                <div className="md:col-span-2">
                  <MachineAccessoryEditor
                    mode={accessoryMode || 'generic'}
                    onChange={setMachineAccessoriesText}
                    value={machineAccessoriesText}
                  />
                </div>
              </div>

              <div className="mt-5 border-t border-[#e4e4e7] pt-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#1f1f1f]">Thiết bị bàn giao thêm</h3>
                  </div>
                  <button className="secondary-button" onClick={addDeviceItem} type="button">
                    Thêm thiết bị
                  </button>
                </div>
                {form.installedDeviceItems.length > 0 ? (
                  <div className="grid gap-3">
                    {form.installedDeviceItems.map((item, index) => (
                      <div className="rounded-[20px] border border-[#e4e4e7] bg-[#ffffff] p-5 md:p-6" key={index}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <strong className="text-sm text-[#1f1f1f]">Thiết bị {index + 1}</strong>
                          <button className="secondary-button compact" onClick={() => removeDeviceItem(index)} type="button">
                            Xóa dòng
                          </button>
                        </div>
                        <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#333333]">
                          <input checked={Boolean(item.isInstalled)} disabled={status === 'INSTALLED'} onChange={(event) => updateDeviceItem(index, { isInstalled: event.target.checked })} type="checkbox" />
                          Máy này đã lắp
                        </label>
                        <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
                          <label className={labelClass}>
                            Model
                            <select
                              className={fieldClass}
                              onChange={(event) => {
                                const model = machineModels.find((option) => option.id === event.target.value);
                                updateDeviceItem(index, {
                                  itemName: machineProductName(model) || item.itemName,
                                  model: machineModelName(model),
                                });
                              }}
                              value={modelIdByName(machineModels, item.model)}
                            >
                              <option value="">Chọn model</option>
                              {machineModels.map((model) => (
                                <option key={model.id} value={model.id}>
                                  {machineModelLabel(model)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={labelClass}>
                            Tên sản phẩm
                            <input className={fieldClass} onChange={(event) => updateDeviceItem(index, { itemName: event.target.value })} value={item.itemName} />
                          </label>
                          <label className={labelClass}>
                            S/N
                            <SerialNumberInputs
                              fieldClass={fieldClass}
                              item={item}
                              onChange={(serialNumber) => updateDeviceItem(index, { serialNumber })}
                            />
                          </label>
                          <DateInput className={labelClass} label="NSX" onChange={(value) => updateDeviceItem(index, { manufactureDate: value })} value={item.manufactureDate} />
                          <label className={labelClass}>
                            Số lượng
                            <input
                              className={fieldClass}
                              min={1}
                              onChange={(event) => {
                                const quantity = Number(event.target.value) || 1;
                                updateDeviceItem(index, {
                                  quantity,
                                  serialNumber: resizeSerialNumberList(item.serialNumber, quantity),
                                });
                              }}
                              type="number"
                              value={item.quantity}
                            />
                          </label>
                          <DateInput
                            className={labelClass}
                            label="Hết hạn bảo hành"
                            onChange={(value) => updateDeviceItem(index, { warrantyPeriod: value })}
                            value={dateInputValue(item.warrantyPeriod)}
                          />
                          <div className="sm:col-span-2 xl:col-span-3">
                            <MachineAccessoryEditor
                              mode={isEndoscopyMachineModel({ name: item.model }) ? 'endoscopy' : isUltrasoundMachineModel({ name: item.model }) ? 'probe' : 'generic'}
                              onChange={(accessoriesText) => updateDeviceItem(index, { accessoriesText, accessoriesConfigured: true })}
                              value={item.accessoriesText || ''}
                            />
                          </div>
                          <fieldset className="grid gap-3 rounded-2xl border border-[#edf0f4] bg-[#fafafa] p-4 sm:col-span-2 xl:col-span-3">
                            <legend className="sr-only">Kỹ sư lắp máy</legend>
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                              <span className="text-sm font-semibold text-[#475569]">Kỹ sư lắp máy</span>
                              <div className="flex flex-wrap gap-2 md:justify-end">
                                {(detail?.assignments || []).map((assignment) => {
                                  const engineer = assignment.engineer;
                                  if (!engineer) return null;
                                  const checked = (item.engineerIds || []).includes(engineer.id);
                                  return (
                                    <label
                                      key={engineer.id}
                                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                        checked
                                          ? 'border-[#9e172b]/25 bg-[#fbf0f1] text-[#821427]'
                                          : 'border-[#e4e4e7] bg-white text-[#475569] hover:border-[#cbd5e1]'
                                      }`}
                                    >
                                      <input
                                        checked={checked}
                                        onChange={() => updateDeviceItem(index, {
                                          engineerIds: checked
                                            ? (item.engineerIds || []).filter((engineerId) => engineerId !== engineer.id)
                                            : [...(item.engineerIds || []), engineer.id],
                                        })}
                                        className="size-4 accent-[#9e172b]"
                                        type="checkbox"
                                      />
                                      {engineer.fullName || engineer.email || 'Kỹ sư'}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </fieldset>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-medium text-[#8a8f99]">Chưa có thiết bị bàn giao thêm.</p>
                )}
              </div>
            </div>

            <div className={panelClass}>
              <div className={sectionHeaderClass}>
                <span className={stepBadgeClass}>5</span>
                  <div>
                    <span className={eyebrowClass}>Kiểm tra cuối</span>
                  <h2 className={sectionTitleClass}>Tình trạng thiết bị</h2>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className={labelClass}>
                  Tình trạng
                  <select className={fieldClass} onChange={(event) => updateForm({ deviceCondition: event.target.value })} value={form.deviceCondition}>
                    <option value="NEW_100">Mới 100%</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </label>
                {form.deviceCondition === 'OTHER' ? (
                  <label className={`${labelClass} md:col-span-2`}>
                    Ghi rõ tình trạng khác
                    <textarea className={textareaClass} onChange={(event) => updateForm({ deviceConditionNote: event.target.value })} required value={form.deviceConditionNote} />
                  </label>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="grid gap-4 self-start min-[1320px]:sticky min-[1320px]:top-5">
            <div className={sidePanelClass}>
              <span className={eyebrowClass}>Biên bản</span>
              <h2 className={sectionTitleClass}>Xuất Word</h2>
              <button
                className="secondary-button mt-4 w-full justify-center border-[#e4e4e7] bg-white text-[#b5121b]"
                disabled={exporting}
                onClick={downloadHandoverDocx}
                type="button"
              >
                {exporting ? <Loader2 className="spin-icon" size={17} /> : <Download size={17} />}
                {exporting ? 'Đang tạo Word' : 'Tải biên bản Word'}
              </button>
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
              options={attachmentOptionsByKind.installation}
              titlePlaceholder=""
              uploading={attachmentsPanel.uploadingAttachment}
            />

            <div className={sidePanelClass}>
              <span className={eyebrowClass}>Trạng thái</span>
              <h2 className={sectionTitleClass}>Trạng thái phiếu</h2>
              <label className="grid gap-2 text-sm font-semibold text-[#333333]">
                Trạng thái
                <select
                  className={fieldClass}
                  onChange={(event) => setStatus(event.target.value)}
                  value={status}
                >
                  {statusOptionsForCurrent(status, canApprove).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary-button mt-3 w-full justify-center border-[#e4e4e7] bg-[#f4f4f5] text-[#b5121b]"
                disabled={status === 'INSTALLED' || status === 'CANCELLED'}
                onClick={() => setStatus('INSTALLED')}
                type="button"
              >
                Đã lắp đặt
              </button>
              {isAdmin ? (
                <label className="mt-4 grid gap-2 text-sm font-semibold text-[#333333]">
                  Kỹ sư lắp đặt
                  <select className={fieldClass} onChange={(event) => setInstalledById(event.target.value)} value={installedById}>
                    <option value="">Chưa phân công</option>
                    {engineers.map((engineer) => (
                      <option key={engineer.id} value={engineer.id}>
                        {engineer.fullName || engineer.email}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {role === 'engineer' ? (
                <p className="mt-3 text-sm font-medium text-[#666666]">
                  Hoàn tất phiếu để trình quản trị viên phê duyệt.
                </p>
              ) : role === 'manager' ? (
                <p className="mt-3 text-sm font-medium text-[#666666]">
                  Hoàn thành để xác nhận lắp đặt.
                </p>
              ) : null}
            </div>

            <div className={sidePanelClass}>
              <span className={eyebrowClass}>Tóm tắt</span>
              <h2 className={sectionTitleClass}>Thiết bị</h2>
              <div className="grid gap-3 text-sm text-[#333333]">
                <InfoRow label="Mã phiếu" value={detail?.code} />
                <InfoRow label="Mã máy" value={detail?.machine?.machineCode || detail?.machine?.serialNumber} />
                <InfoRow label="Model" value={detail?.machine?.modelName || detail?.plannedMachineModel?.name || detail?.plannedModelName} />
                <InfoRow label="Khách hàng" value={detail?.customer?.name} />
              </div>
            </div>

            <div className="rounded-[22px] border border-[#e4e4e7] bg-[#f4f4f5] p-3 shadow-[0_16px_40px_rgba(24,24,27,0.08)]">
              <div className="grid gap-2 sm:grid-cols-2 min-[1320px]:grid-cols-1">
                <button className="secondary-button" onClick={() => navigate(returnTo)} type="button">
                  Hủy
                </button>
                {isAdmin && detail?.status === 'PENDING' ? (
                  <button className="secondary-button justify-center text-[#b5121b]" disabled={saving || deleting} onClick={() => setShowDeleteConfirm(true)} type="button">
                    {deleting ? <Loader2 className="spin-icon" size={17} /> : <Trash2 size={17} />}
                    {deleting ? 'Đang xóa' : 'Xóa phiếu'}
                  </button>
                ) : isAdmin && detail ? (
                  <p className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#667085] sm:col-span-2 min-[1320px]:col-span-1">
                    Chỉ phiếu chờ xử lý mới được xóa.
                  </p>
                ) : null}
                <button className="primary-button" disabled={saving} type="submit">
                  {saving ? <Loader2 className="spin-icon" size={17} /> : <Save size={17} />}
                  {saving ? 'Đang lưu' : 'Lưu phiếu'}
                </button>
              </div>
            </div>
          </aside>
        </form>
      )}
      {showDeleteConfirm && detail ? (
        <DeleteTicketDialog
          details={[
            { label: 'Mã phiếu', value: detail.code },
            { label: 'Khách hàng', value: detail.customer?.name },
            { label: 'Thiết bị', value: detail.machine?.name || detail.plannedMachineModel?.name || detail.plannedModelName },
            { label: 'Serial', value: detail.machine?.serialNumber || machineSerialNumber },
            { label: 'Trạng thái', value: statusOptions.find((item) => item.value === detail.status)?.label || detail.status },
          ]}
          loading={deleting}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => void deleteTicket()}
          title="Xác nhận xóa phiếu lắp đặt"
          warning="Phiếu lắp đặt và dữ liệu bảo hành liên kết sẽ bị xóa. Kỹ sư có thể tạo lại phiếu sau đó."
        />
      ) : null}
    </PageFrame>
  );
}

function statusOptionsForCurrent(status: string, canApprove: boolean) {
  if (status !== 'PENDING') {
    return statusOptions.filter((option) => option.value === status);
  }

  return statusOptions.filter(
    (option) => option.value !== 'CANCELLED' || canApprove,
  );
}

const panelClass = workPanelClass;
const sidePanelClass = workSidePanelClass;
const sectionHeaderClass = workSectionHeaderClass;
const stepBadgeClass = workStepBadgeClass;
const eyebrowClass = workEyebrowClass;
const sectionTitleClass = workSectionTitleClass;
const labelClass = 'grid gap-2 text-sm font-semibold text-[#333333]';
const fieldClass =
  'h-12 w-full min-w-0 rounded-2xl border border-[#ded8d8] bg-[#ffffff] px-4 text-sm font-semibold text-[#1f1f1f] outline-none transition focus:border-[#18181b] focus:bg-white focus:shadow-[0_0_0_4px_rgba(24,24,27,0.12)] disabled:bg-[#f3f6f9] disabled:text-[#666666]';

const textareaClass =
  'min-h-32 w-full min-w-0 resize-y rounded-2xl border border-[#ded8d8] bg-[#ffffff] px-4 py-3 text-sm font-semibold leading-relaxed text-[#1f1f1f] outline-none transition focus:border-[#18181b] focus:bg-white focus:shadow-[0_0_0_4px_rgba(24,24,27,0.12)]';

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#edf1f5] pb-2 last:border-b-0 last:pb-0">
      <span>{label}</span>
      <strong className="text-right text-[#1f1f1f]">{value || '-'}</strong>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0 border-l-2 border-[#e4deda] pl-3">
      <span className="block text-xs font-medium text-[#85807c]">{label}</span>
      <strong className="mt-1 block break-words text-sm font-semibold text-[#292524]">{value || '—'}</strong>
    </div>
  );
}

function buildForm(task: InstallationTask): CreateTicketForm {
  const installedAt = dateInputValue(task.installedAt);
  const warrantyStartDate = dateInputValue(task.warrantyStartDate || task.warrantyCard?.startDate) || installedAt;
  const mainDeviceItem = getMainMachineDeviceItem(task);
  const installedDeviceItems = (task.installedDeviceItems || [])
    .filter((item) => item !== mainDeviceItem && !isMainMachineItem(task, item))
    .map((item) => ({
        itemName: item.itemName || '',
        sourceMachineId: item.sourceMachineId || '',
        model: item.model || '',
        manufacturer: item.manufacturer || '',
        serialNumber: item.serialNumber || '',
        isInstalled: item.isInstalled ?? (task.status === 'INSTALLED'),
        manufactureDate: dateInputValue(item.manufactureDate),
        quantity: Number(item.quantity) || 1,
        warrantyPeriod: item.warrantyPeriod || '',
        accessoriesText: serializeMachineAccessories(item.accessories),
        accessoriesConfigured: Array.isArray(item.accessories),
      }));

  const customer = task.customer;

  return {
    ...emptyCreateTicketForm('installation'),
    machineId: task.machine?.id || '',
    machineModelId: task.plannedMachineModelId || task.machine?.machineModel?.id || '',
    deviceName:
      task.machine?.name ||
      mainDeviceItem?.itemName ||
      task.plannedMachineModel?.displayName ||
      task.plannedMachineModel?.name ||
      task.plannedModelName ||
      '',
    modelName: task.machine?.modelName || mainDeviceItem?.model || task.plannedMachineModel?.name || task.plannedModelName || '',
    manufacturer: task.machine?.manufacturer || task.machine?.machineModel?.manufacturer || mainDeviceItem?.manufacturer || task.plannedMachineModel?.manufacturer || '',
    productCategory: task.machine?.productCategory || mainDeviceItem?.productCategory || task.plannedMachineModel?.productCategory || 'OTHER',
    serialNumber: task.machine?.serialNumber || mainDeviceItem?.serialNumber || '',
    workDate: warrantyStartDate,
    warrantyEndDate: dateInputValue(task.warrantyEndDate || task.warrantyCard?.endDate),
    description: task.warrantyNote || task.warrantyCard?.note || '',
    handoverInstallerName: task.handoverInstallerName || '',
    handoverInstallerPosition: task.handoverInstallerPosition || '',
    handoverVehicle: task.handoverVehicle || '',
    handoverDepartureDate: dateInputValue(task.handoverDepartureDate) || warrantyStartDate,
    receiverInstallAddress: task.receiverInstallAddress || customer?.fullAddress || customer?.address || '',
    receiverRepresentative: task.receiverRepresentative || customer?.contactPerson || '',
    receiverPosition: task.receiverPosition || customer?.contactPosition || '',
    receiverPhone: task.receiverPhone || customer?.contactPhone || customer?.phone || '',
    installedDeviceItems,
    deviceCondition: task.deviceCondition || 'NEW_100',
    deviceConditionNote: task.deviceConditionNote || '',
  };
}

function hasMachineDraft(form: CreateTicketForm, serialNumber: string) {
  return Boolean(
    form.deviceName.trim() ||
      form.modelName.trim() ||
      form.manufacturer.trim() ||
      serialNumber.trim(),
  );
}

function getMainMachineDeviceItem(task: InstallationTask) {
  const items = task.installedDeviceItems || [];
  if (!items.length) return null;

  const explicitlyPrimary = items.find((item) => item.isPrimary);
  if (explicitlyPrimary) return explicitlyPrimary;

  const exactMachineItem = items.find((item) => isMainMachineItem(task, item));
  if (exactMachineItem) return exactMachineItem;

  const plannedNames = mainMachineNames(task);
  const plannedItem = items.find((item) => {
    const itemName = normalizeText(item.itemName);
    const itemModel = normalizeText(item.model);
    return plannedNames.some((name) => name && (name === itemName || name === itemModel));
  });
  if (plannedItem) return plannedItem;

  return !task.machine && items.length === 1 ? items[0] : null;
}

function isMainMachineItem(task: InstallationTask, item: InstallationDeviceItem) {
  if (item.isPrimary) return true;
  const machineSerial = normalizeText(task.machine?.serialNumber);
  const itemSerial = normalizeText(item.serialNumber);
  if (machineSerial && itemSerial && machineSerial === itemSerial) return true;

  const itemName = normalizeText(item.itemName);
  const itemModel = normalizeText(item.model);

  return !itemSerial && mainMachineNames(task).some((value) => value && (value === itemName || value === itemModel));
}

function mainMachineNames(task: InstallationTask) {
  return [
    task.machine?.name,
    task.machine?.modelName,
    task.plannedMachineModel?.displayName,
    task.plannedMachineModel?.name,
    task.plannedModelName,
  ]
    .filter(Boolean)
    .map((value) => normalizeText(value));
}

function normalizeText(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function machineModelLabel(model: MachineModelOption) {
  return machineModelOptionLabel(model) || machineModelName(model) || 'Model';
}

function mergeMachines(machines: StockMachine[]) {
  const seen = new Set<string>();
  return machines.filter((machine) => {
    if (!machine.id || seen.has(machine.id)) return false;
    seen.add(machine.id);
    return true;
  });
}

function modelIdByName(models: MachineModelOption[], value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  return models.find((model) =>
    [model.code, model.displayName, model.name, machineModelOptionLabel(model)]
      .filter(Boolean)
      .some((item) => String(item).trim().toLowerCase() === normalized),
  )?.id || '';
}

function SerialNumberInputs({
  fieldClass,
  item,
  onChange,
}: {
  fieldClass: string;
  item: InstallationDeviceItem;
  onChange: (serialNumber: string) => void;
}) {
  const quantity = Math.max(1, Number(item.quantity) || 1);
  const serialNumbers = serialNumberList(item.serialNumber, quantity);

  if (quantity === 1) {
    return (
      <input
        className={fieldClass}
        onChange={(event) => onChange(event.target.value)}
        value={serialNumbers[0] || ''}
      />
    );
  }

  return (
    <div className="grid gap-2">
      {serialNumbers.map((serialNumber, serialIndex) => (
        <input
          className={fieldClass}
          key={serialIndex}
          onChange={(event) => {
            const next = [...serialNumbers];
            next[serialIndex] = event.target.value;
            onChange(joinSerialNumbers(next));
          }}
          placeholder={`S/N ${serialIndex + 1}`}
          value={serialNumber}
        />
      ))}
      <BarcodeScannerButton onScan={(value) => {
        const next = [...serialNumbers];
        const emptyIndex = next.findIndex((serialNumber) => !serialNumber);
        if (emptyIndex >= 0) {
          next[emptyIndex] = value;
          onChange(joinSerialNumbers(next));
        }
      }} />
    </div>
  );
}

function BarcodeScannerButton({ onScan }: { onScan: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let frame = 0;
    let stream: MediaStream | null = null;
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
    const start = async () => {
      type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> };
      type DetectorConstructor = new (options?: { formats?: string[] }) => Detector;
      const DetectorClass = (window as Window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
      if (!DetectorClass) {
        setError('Thiết bị chưa hỗ trợ quét mã. Nhập S/N thủ công.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped || !videoRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new DetectorClass({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        const scan = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const match = (await detector.detect(videoRef.current)).find((item) => item.rawValue?.trim());
            if (match?.rawValue) {
              onScanRef.current(match.rawValue.trim());
              setOpen(false);
              return;
            }
          } catch {
            // Keep scanning while the camera focuses.
          }
          frame = requestAnimationFrame(() => void scan());
        };
        frame = requestAnimationFrame(() => void scan());
      } catch {
        setError('Không mở được camera. Hãy cấp quyền hoặc nhập S/N thủ công.');
      }
    };
    setError('');
    void start();
    return stop;
  }, [open]);

  return (
    <>
      <button className="secondary-button shrink-0" onClick={() => setOpen(true)} type="button">Quét S/N</button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="presentation">
          <section aria-label="Quét mã S/N" aria-modal="true" className="grid w-full max-w-md gap-3 rounded-2xl bg-white p-4" role="dialog">
            <div className="flex items-center justify-between"><strong>Quét mã S/N</strong><button className="secondary-button compact" onClick={() => setOpen(false)} type="button">Đóng</button></div>
            <video className="aspect-video w-full rounded-xl bg-black object-cover" muted playsInline ref={videoRef} />
            {error ? <p className="text-sm text-[#9a1b2e]">{error}</p> : <InfoHint content="Căn mã QR hoặc barcode vào khung quét." label="Quét mã thiết bị" />}
          </section>
        </div>
      ) : null}
    </>
  );
}

function serialNumberList(value: string, quantity: number) {
  const items = value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from({ length: quantity }, (_, index) => items[index] || '');
}

function resizeSerialNumberList(value: string, quantity: number) {
  return joinSerialNumbers(serialNumberList(value, Math.max(1, quantity)));
}

function joinSerialNumbers(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean).join(', ');
}

function safeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D')
    .replace(/đ/g, 'd')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

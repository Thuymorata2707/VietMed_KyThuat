import { ArrowLeft, Download, Loader2, Save } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch, getApiBaseUrl, getToken } from '../../api';
import { getRoleName } from '../../auth/roles';
import { Notice } from '../../components/Notice';
import { MachineAccessoryEditor } from '../../components/MachineAccessoryEditor';
import { isEndoscopyMachineModel } from '../../config/endoscopyAccessories';
import { isUltrasoundMachineModel } from '../../config/ultrasoundProbes';
import { PageFrame } from '../../components/PageFrame';
import { PageTitle } from '../../components/PageTitle';
import { parseMachineAccessoriesInput } from '../../utils/machineAccessories';
import type { CreateTicketForm, InstallationDeviceItem, InstallationTask } from '../EngineerTasksPage/types';
import { emptyCreateTicketForm, emptyInstallationDeviceItem, normalizeInstallationDeviceItems } from '../EngineerTasksPage/utils';

type EngineerOption = {
  id: string;
  fullName?: string | null;
  email: string;
};

const statusOptions = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'INSTALLED', label: 'Đã lắp đặt' },
  { value: 'CANCELLED', label: 'Hủy' },
];

export function InstallationUpdatePage({ user }: { user: ApiUser }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = getRoleName(user);
  const returnTo = searchParams.get('returnTo') || '/installations';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detail, setDetail] = useState<InstallationTask | null>(null);
  const [status, setStatus] = useState('PENDING');
  const [installedAt, setInstalledAt] = useState('');
  const [note, setNote] = useState('');
  const [machineSerialNumber, setMachineSerialNumber] = useState('');
  const [machineCode, setMachineCode] = useState('');
  const [machineAccessoriesText, setMachineAccessoriesText] = useState('');
  const [installedById, setInstalledById] = useState('');
  const [engineers, setEngineers] = useState<EngineerOption[]>([]);
  const [form, setForm] = useState<CreateTicketForm>(() => emptyCreateTicketForm('installation'));
  const isAdmin = role === 'admin';
  const accessoryMode: 'probe' | 'endoscopy' | null = isEndoscopyMachineModel({
    code: detail?.plannedMachineModel?.code,
    name: detail?.plannedMachineModel?.name || detail?.plannedModelName || detail?.machine?.modelName,
    displayName: detail?.plannedMachineModel?.displayName,
  })
    ? 'endoscopy'
    : isUltrasoundMachineModel({
        code: detail?.plannedMachineModel?.code,
        name: detail?.plannedMachineModel?.name || detail?.plannedModelName || detail?.machine?.modelName,
        displayName: detail?.plannedMachineModel?.displayName,
      })
      ? 'probe'
      : null;

  useEffect(() => {
    loadDetail();
  }, [id]);

  async function loadDetail() {
    if (!id) return;

    setLoading(true);
    setError('');

    try {
      const installation = await apiFetch<InstallationTask>(`/installations/${id}`);
      setDetail(installation);
      setStatus(installation.status || 'PENDING');
      setInstalledAt(dateInputValue(installation.installedAt));
      setNote(installation.note || '');
      setMachineSerialNumber(installation.machine?.serialNumber || '');
      setMachineCode(installation.machine?.machineCode || '');
      setMachineAccessoriesText('');
      setInstalledById(installation.installedBy?.id || '');
      setForm(buildForm(installation));
      if (isAdmin) {
        await loadEngineers();
      }
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
      installedDeviceItems:
        current.installedDeviceItems.length === 1
          ? [emptyInstallationDeviceItem()]
          : current.installedDeviceItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiFetch(`/installations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          ...(isAdmin ? { installedById: installedById || undefined } : {}),
          installedAt: installedAt || form.workDate || undefined,
          warrantyStartDate: form.workDate || installedAt || undefined,
          warrantyEndDate: form.warrantyEndDate || undefined,
          machineModelId: detail?.plannedMachineModelId || undefined,
          machineSerialNumber: machineSerialNumber.trim() || undefined,
          machineCode: machineCode.trim() || undefined,
          machineName: form.deviceName.trim() || detail?.plannedMachineModel?.name || detail?.plannedModelName || undefined,
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
          installedDeviceItems: normalizeInstallationDeviceItems(form.installedDeviceItems),
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
          title="Cập nhật phiếu lắp đặt"
          description="Nhập dữ liệu ngắn gọn. Biên bản Word sẽ tự ghép đủ nội dung theo mẫu."
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
                  <p className={sectionDescriptionClass}>Ngày lắp, hạn bảo hành và ghi chú nội bộ.</p>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-[#333333]">
                  Ngày lắp đặt
                  <input className={fieldClass} onChange={(event) => setInstalledAt(event.target.value)} required type="date" value={installedAt} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-[#333333]">
                  Bắt đầu bảo hành
                  <input className={fieldClass} onChange={(event) => updateForm({ workDate: event.target.value })} type="date" value={form.workDate} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-[#333333]">
                  Kết thúc bảo hành
                  <input className={fieldClass} onChange={(event) => updateForm({ warrantyEndDate: event.target.value })} required type="date" value={form.warrantyEndDate} />
                </label>
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
                  <p className={sectionDescriptionClass}>Người đi lắp đặt và thông tin di chuyển.</p>
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
                <label className={labelClass}>
                  Ngày đi
                  <input className={fieldClass} onChange={(event) => updateForm({ handoverDepartureDate: event.target.value })} type="date" value={form.handoverDepartureDate} />
                </label>
              </div>
            </div>

            <div className={panelClass}>
              <div className={sectionHeaderClass}>
                <span className={stepBadgeClass}>3</span>
                <div>
                  <span className={eyebrowClass}>Bên nhận bàn giao</span>
                  <h2 className={sectionTitleClass}>Thông tin khách hàng</h2>
                  <p className={sectionDescriptionClass}>Địa chỉ lắp đặt, đại diện nhận máy và số liên hệ.</p>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className={`${labelClass} md:col-span-2`}>
                  Địa chỉ lắp đặt
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
                  <span className={eyebrowClass}>Máy thực tế</span>
                  <h2 className={sectionTitleClass}>Sau bóc hàng</h2>
                  <p className={sectionDescriptionClass}>Nhập S/N và phụ kiện thực tế.</p>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className={labelClass}>
                  Model dự kiến
                  <input className={fieldClass} readOnly value={detail?.machine?.modelName || detail?.plannedMachineModel?.name || detail?.plannedModelName || ''} />
                </label>
                <label className={labelClass}>
                  S/N máy thực tế
                  <input className={fieldClass} onChange={(event) => setMachineSerialNumber(event.target.value)} required={status === 'INSTALLED'} value={machineSerialNumber} />
                </label>
                <label className={labelClass}>
                  Mã máy nội bộ (tự sinh nếu để trống)
                  <input className={fieldClass} onChange={(event) => setMachineCode(event.target.value)} placeholder="VD: XCUBE50-001" value={machineCode} />
                </label>
                <div className="md:col-span-2">
                  {accessoryMode ? (
                    <MachineAccessoryEditor
                      mode={accessoryMode}
                      onChange={setMachineAccessoriesText}
                      value={machineAccessoriesText}
                    />
                  ) : (
                    <label className={labelClass}>
                      Phụ kiện đi kèm
                      <textarea
                        className={`${textareaClass} min-h-28`}
                        onChange={(event) => setMachineAccessoriesText(event.target.value)}
                        placeholder="Mỗi dòng: Phụ kiện | S/N"
                        value={machineAccessoriesText}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className={panelClass}>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-[#dbe9e8] pb-4">
                <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-3">
                  <span className={stepBadgeClass}>5</span>
                  <div>
                    <span className={eyebrowClass}>Danh mục thiết bị</span>
                    <h2 className={sectionTitleClass}>Thiết bị lắp đặt</h2>
                    <p className={sectionDescriptionClass}>Dữ liệu này sẽ lên bảng trong file Word.</p>
                  </div>
                </div>
                <button className="secondary-button" onClick={addDeviceItem} type="button">
                  Thêm thiết bị
                </button>
              </div>
              <div className="grid gap-3">
                {form.installedDeviceItems.map((item, index) => (
                  <div className="rounded-[20px] border border-[#cfe4e2] bg-[#fffdfd] p-4" key={index}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <strong className="text-sm text-[#1f1f1f]">Dòng thiết bị {index + 1}</strong>
                      <button className="secondary-button compact" onClick={() => removeDeviceItem(index)} type="button">
                        Xóa dòng
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className={labelClass}>
                        Tên hàng
                        <input className={fieldClass} onChange={(event) => updateDeviceItem(index, { itemName: event.target.value })} required value={item.itemName} />
                      </label>
                      <label className={labelClass}>
                        Model
                        <input className={fieldClass} onChange={(event) => updateDeviceItem(index, { model: event.target.value })} value={item.model} />
                      </label>
                      <label className={labelClass}>
                        S/N
                        <input className={fieldClass} onChange={(event) => updateDeviceItem(index, { serialNumber: event.target.value })} value={item.serialNumber} />
                      </label>
                      <label className={labelClass}>
                        NSX
                        <input className={fieldClass} onChange={(event) => updateDeviceItem(index, { manufactureDate: event.target.value })} type="date" value={item.manufactureDate} />
                      </label>
                      <label className={labelClass}>
                        Số lượng
                        <input className={fieldClass} min={1} onChange={(event) => updateDeviceItem(index, { quantity: Number(event.target.value) || 1 })} type="number" value={item.quantity} />
                      </label>
                      <label className={labelClass}>
                        Thời gian bảo hành
                        <input className={fieldClass} onChange={(event) => updateDeviceItem(index, { warrantyPeriod: event.target.value })} placeholder="VD: 12 tháng" value={item.warrantyPeriod} />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={panelClass}>
              <div className={sectionHeaderClass}>
                <span className={stepBadgeClass}>6</span>
                <div>
                  <span className={eyebrowClass}>Kiểm tra cuối</span>
                  <h2 className={sectionTitleClass}>Tình trạng thiết bị</h2>
                  <p className={sectionDescriptionClass}>Xác nhận tình trạng khi bàn giao.</p>
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
              <p className="mt-2 text-sm leading-6 text-[#666666]">
                Lưu phiếu trước khi tải để file có dữ liệu mới nhất.
              </p>
              <button
                className="secondary-button mt-4 w-full justify-center border-[#cfe4e2] bg-white text-[#b5121b]"
                disabled={exporting}
                onClick={downloadHandoverDocx}
                type="button"
              >
                {exporting ? <Loader2 className="spin-icon" size={17} /> : <Download size={17} />}
                {exporting ? 'Đang tạo Word' : 'Tải biên bản Word'}
              </button>
            </div>

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
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary-button mt-3 w-full justify-center border-[#cfe4e2] bg-[#ecfdf8] text-[#b5121b]"
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
              {role !== 'admin' ? (
                <p className="mt-3 text-sm font-medium text-[#666666]">
                  Nhập S/N máy thực tế, bấm Đã lắp đặt rồi lưu phiếu. Hệ thống sẽ gửi admin duyệt và cập nhật máy sau khi hợp lệ.
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

            <div className="rounded-[22px] border border-[#cfe4e2] bg-[#ecfdf8] p-3 shadow-[0_16px_40px_rgba(15,118,110,0.08)]">
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

const panelClass = 'rounded-[24px] border border-[#cfe4e2] bg-white/95 p-5 shadow-[0_18px_50px_rgba(15,118,110,0.07)] sm:p-6';
const sidePanelClass = 'rounded-[24px] border border-[#cfe4e2] bg-[#fffdfd] p-5 shadow-[0_18px_50px_rgba(15,118,110,0.06)]';
const sectionHeaderClass = 'mb-5 grid grid-cols-[34px_minmax(0,1fr)] gap-3 border-b border-[#dbe9e8] pb-4';
const stepBadgeClass = 'flex h-8 w-8 items-center justify-center rounded-xl bg-[#0f766e] text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(15,118,110,0.24)]';
const eyebrowClass = 'text-xs font-bold uppercase tracking-[0.16em] text-[#0f766e]';
const sectionTitleClass = 'mt-1 text-lg font-bold leading-tight text-[#1f1f1f]';
const sectionDescriptionClass = 'mt-1 text-xs font-medium leading-5 text-[#8a8f99]';
const labelClass = 'grid gap-2 text-sm font-semibold text-[#333333]';
const fieldClass =
  'h-12 w-full min-w-0 rounded-2xl border border-[#ded8d8] bg-[#fffefe] px-4 text-sm font-semibold text-[#1f1f1f] outline-none transition focus:border-[#0f766e] focus:bg-white focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)] disabled:bg-[#f3f6f9] disabled:text-[#666666]';

const textareaClass =
  'min-h-32 w-full min-w-0 resize-y rounded-2xl border border-[#ded8d8] bg-[#fffefe] px-4 py-3 text-sm font-semibold leading-relaxed text-[#1f1f1f] outline-none transition focus:border-[#0f766e] focus:bg-white focus:shadow-[0_0_0_4px_rgba(15,118,110,0.12)]';

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#edf1f5] pb-2 last:border-b-0 last:pb-0">
      <span>{label}</span>
      <strong className="text-right text-[#1f1f1f]">{value || '-'}</strong>
    </div>
  );
}

function buildForm(task: InstallationTask): CreateTicketForm {
  const installedAt = dateInputValue(task.installedAt);
  const warrantyStartDate = dateInputValue(task.warrantyStartDate || task.warrantyCard?.startDate) || installedAt;
  const installedDeviceItems = task.installedDeviceItems?.length
    ? task.installedDeviceItems.map((item) => ({
        itemName: item.itemName || '',
        model: item.model || '',
        serialNumber: item.serialNumber || '',
        manufactureDate: dateInputValue(item.manufactureDate),
        quantity: Number(item.quantity) || 1,
        warrantyPeriod: item.warrantyPeriod || '',
      }))
    : [emptyInstallationDeviceItem()];

  return {
    ...emptyCreateTicketForm('installation'),
    workDate: warrantyStartDate,
    warrantyEndDate: dateInputValue(task.warrantyEndDate || task.warrantyCard?.endDate),
    description: task.warrantyNote || task.warrantyCard?.note || '',
    handoverInstallerName: task.handoverInstallerName || '',
    handoverInstallerPosition: task.handoverInstallerPosition || '',
    handoverVehicle: task.handoverVehicle || '',
    handoverDepartureDate: dateInputValue(task.handoverDepartureDate) || warrantyStartDate,
    receiverInstallAddress: task.receiverInstallAddress || '',
    receiverRepresentative: task.receiverRepresentative || '',
    receiverPosition: task.receiverPosition || '',
    receiverPhone: task.receiverPhone || '',
    installedDeviceItems,
    deviceCondition: task.deviceCondition || 'NEW_100',
    deviceConditionNote: task.deviceConditionNote || '',
  };
}

function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : '';
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

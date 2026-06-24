import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiUser, Paginated, apiFetch } from '../../api';
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

  return (
    <PageFrame>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Lắp đặt"
          title="Cập nhật phiếu lắp đặt"
          description="Hoàn thiện biên bản bàn giao, danh mục thiết bị và thông tin bảo hành trước khi admin duyệt."
        />
        <button className="secondary-button" onClick={() => navigate(returnTo)} type="button">
          <ArrowLeft size={17} />
          Quay lại danh sách
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
        <form className="grid min-w-0 gap-4 min-[1320px]:grid-cols-[minmax(0,1fr)_360px]" onSubmit={submit}>
          <section className="grid min-w-0 gap-4">
            <div className="rounded-lg border border-[#e5e5e5] bg-white p-5">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-[#1f1f1f]">Thông tin lắp đặt</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
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

            <div className="rounded-lg border border-[#e5e5e5] bg-white p-5">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-[#1f1f1f]">Bên bàn giao</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
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

            <div className="rounded-lg border border-[#e5e5e5] bg-white p-5">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-[#1f1f1f]">Bên nhận bàn giao</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
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

            <div className="rounded-lg border border-[#e5e5e5] bg-white p-5">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-[#1f1f1f]">Máy thực tế sau bóc hàng</h2>
                <p className="mt-1 text-sm text-[#666666]">Kỹ sư nhập S/N máy và đầu dò/phụ kiện thực tế sau khi mở thùng tại khách hàng.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className={labelClass}>
                  Model dự kiến
                  <input className={fieldClass} readOnly value={detail?.machine?.modelName || detail?.plannedMachineModel?.name || detail?.plannedModelName || ''} />
                </label>
                <label className={labelClass}>
                  S/N máy thực tế
                  <input className={fieldClass} onChange={(event) => setMachineSerialNumber(event.target.value)} required={status === 'INSTALLED'} value={machineSerialNumber} />
                </label>
                <label className={labelClass}>
                  Mã máy nội bộ
                  <input className={fieldClass} onChange={(event) => setMachineCode(event.target.value)} value={machineCode} />
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
                        className={`${fieldClass} min-h-28 py-2.5`}
                        onChange={(event) => setMachineAccessoriesText(event.target.value)}
                        placeholder="Mỗi dòng: Phụ kiện | S/N"
                        value={machineAccessoriesText}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#e5e5e5] bg-white p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-medium text-[#1f1f1f]">Danh mục thiết bị lắp đặt</h2>
                <button className="secondary-button" onClick={addDeviceItem} type="button">
                  Thêm thiết bị
                </button>
              </div>
              <div className="grid gap-3">
                {form.installedDeviceItems.map((item, index) => (
                  <div className="rounded-lg border border-[#edf1f5] bg-[#ffffff] p-4" key={index}>
                    <div className="grid gap-3 md:grid-cols-3">
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
                    <div className="mt-3 flex justify-end">
                      <button className="secondary-button" onClick={() => removeDeviceItem(index)} type="button">
                        Xóa dòng
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[#e5e5e5] bg-white p-5">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-[#1f1f1f]">Tình trạng thiết bị</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
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

          <aside className="grid gap-4 self-start">
            <div className="rounded-lg border border-[#e5e5e5] bg-white p-5">
              <h2 className="mb-4 text-lg font-medium text-[#1f1f1f]">Trạng thái phiếu</h2>
              <label className="grid gap-2 text-sm font-semibold text-[#333333]">
                Trạng thái
                <select
                  className={fieldClass}
                  disabled={role !== 'admin' && detail?.status !== 'PENDING'}
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
                  Kỹ sư được chuyển sang Đã lắp đặt sau khi nhập S/N máy thực tế. Khi lưu, hệ thống sẽ tạo/gắn máy vào kho và cập nhật tổng máy đã lắp.
                </p>
              ) : null}
            </div>

            <div className="rounded-lg border border-[#e5e5e5] bg-white p-5">
              <h2 className="mb-4 text-lg font-medium text-[#1f1f1f]">Thiết bị</h2>
              <div className="grid gap-3 text-sm text-[#333333]">
                <InfoRow label="Mã phiếu" value={detail?.code} />
                <InfoRow label="Mã máy" value={detail?.machine?.machineCode || detail?.machine?.serialNumber} />
                <InfoRow label="Model" value={detail?.machine?.modelName || detail?.plannedMachineModel?.name || detail?.plannedModelName} />
                <InfoRow label="Khách hàng" value={detail?.customer?.name} />
              </div>
            </div>

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

const fieldClass =
  'h-11 rounded-lg border border-[#d6d6d6] px-3 text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)] disabled:bg-[#f3f6f9] disabled:text-[#666666]';

const textareaClass =
  'min-h-28 rounded-lg border border-[#d6d6d6] px-3 py-2 text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]';

const labelClass = 'grid gap-2 text-sm font-semibold text-[#333333]';

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
  const warrantyStartDate = dateInputValue(task.warrantyCard?.startDate) || installedAt;
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
    warrantyEndDate: dateInputValue(task.warrantyCard?.endDate),
    description: task.warrantyCard?.note || '',
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

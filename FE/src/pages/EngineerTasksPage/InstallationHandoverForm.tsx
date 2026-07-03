import type { ApiUser } from '../../api';
import { DateInput } from '../../components/DateInput';
import { machineDisplayName } from '../../utils/machineDisplayName';
import type { CreateTicketForm, InstallationDeviceItem } from './types';

type InstallationHandoverFormProps = {
  form: CreateTicketForm;
  machineModels: MachineModelOption[];
  user: ApiUser;
  updateForm: (patch: Partial<CreateTicketForm>) => void;
  updateDeviceItem: (index: number, patch: Partial<InstallationDeviceItem>) => void;
  addDeviceItem: () => void;
  removeDeviceItem: (index: number) => void;
};

type MachineModelOption = {
  id: string;
  code?: string | null;
  name?: string | null;
  displayName?: string | null;
  manufacturer?: string | null;
  productCategory?: string | null;
  businessLine?: {
    name?: string | null;
    productCategory?: string | null;
    productIndustry?: {
      name?: string | null;
    } | null;
  } | null;
};

export function InstallationHandoverForm({
  addDeviceItem,
  form,
  machineModels,
  removeDeviceItem,
  updateDeviceItem,
  updateForm,
  user,
}: InstallationHandoverFormProps) {
  return (
    <>
      <div className="create-form-section">Bên bàn giao</div>
      <label>
        Người lắp đặt
        <input
          onChange={(event) => updateForm({ handoverInstallerName: event.target.value })}
          placeholder={user.fullName || user.email}
          value={form.handoverInstallerName}
        />
      </label>
      <label>
        Chức vụ
        <input onChange={(event) => updateForm({ handoverInstallerPosition: event.target.value })} value={form.handoverInstallerPosition} />
      </label>
      <label>
        Phương tiện đi
        <input onChange={(event) => updateForm({ handoverVehicle: event.target.value })} value={form.handoverVehicle} />
      </label>
      <DateInput label="Ngày đi" onChange={(value) => updateForm({ handoverDepartureDate: value })} value={form.handoverDepartureDate} />

      <div className="create-form-section">Bên nhận bàn giao</div>
      <label className="create-wide-field">
        Địa chỉ lắp đặt
        <input onChange={(event) => updateForm({ receiverInstallAddress: event.target.value })} value={form.receiverInstallAddress} />
      </label>
      <label>
        Người đại diện
        <input onChange={(event) => updateForm({ receiverRepresentative: event.target.value })} value={form.receiverRepresentative} />
      </label>
      <label>
        Chức vụ
        <input onChange={(event) => updateForm({ receiverPosition: event.target.value })} value={form.receiverPosition} />
      </label>
      <label>
        SĐT
        <input onChange={(event) => updateForm({ receiverPhone: event.target.value })} value={form.receiverPhone} />
      </label>

      <div className="create-form-section">Thiết bị bàn giao</div>
      <div className="installation-device-list">
        {form.installedDeviceItems.map((item, index) => (
          <div className="installation-device-row" key={index}>
            <label>
              Tên hàng
              <input onChange={(event) => updateDeviceItem(index, { itemName: event.target.value })} required value={item.itemName} />
            </label>
            <label>
              Model
              <select
                onChange={(event) => {
                  const model = machineModels.find((option) => option.id === event.target.value);
                  updateDeviceItem(index, {
                    itemName: machineDisplayName(model) || model?.displayName || model?.name || model?.code || item.itemName,
                    model: model?.code || model?.displayName || model?.name || '',
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
            <label>
              S/N
              <input onChange={(event) => updateDeviceItem(index, { serialNumber: event.target.value })} value={item.serialNumber} />
            </label>
            <DateInput label="NSX" onChange={(value) => updateDeviceItem(index, { manufactureDate: value })} value={item.manufactureDate} />
            <label>
              Số lượng
              <input
                min={1}
                onChange={(event) => updateDeviceItem(index, { quantity: Number(event.target.value) || 1 })}
                type="number"
                value={item.quantity}
              />
            </label>
            <label>
              Thời gian bảo hành
              <input
                onChange={(event) => updateDeviceItem(index, { warrantyPeriod: event.target.value })}
                placeholder="VD: 12 tháng"
                value={item.warrantyPeriod}
              />
            </label>
            <button className="task-secondary device-remove-button" onClick={() => removeDeviceItem(index)} type="button">
              Xóa dòng
            </button>
          </div>
        ))}
        <button className="task-secondary device-add-button" onClick={addDeviceItem} type="button">
          Thêm thiết bị
        </button>
      </div>

      <div className="create-form-section">Tình trạng thiết bị</div>
      <label>
        Tình trạng
        <select onChange={(event) => updateForm({ deviceCondition: event.target.value })} value={form.deviceCondition}>
          <option value="NEW_100">Mới 100%</option>
          <option value="OTHER">Khác</option>
        </select>
      </label>
      {form.deviceCondition === 'OTHER' ? (
        <label className="create-wide-field">
          Ghi rõ tình trạng khác
          <textarea onChange={(event) => updateForm({ deviceConditionNote: event.target.value })} required value={form.deviceConditionNote} />
        </label>
      ) : null}
    </>
  );
}

function machineModelLabel(model: MachineModelOption) {
  return [model.code, model.displayName || model.name, model.manufacturer].filter(Boolean).join(' - ');
}

function modelIdByName(models: MachineModelOption[], value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  return models.find((model) => [model.code, model.displayName, model.name].filter(Boolean).some((item) => String(item).trim().toLowerCase() === normalized))?.id || '';
}

import type { ApiUser } from '../../api';
import { DateInput } from '../../components/DateInput';
import { machineModelName, machineModelOptionLabel, machineProductName } from '../../utils/machineDisplayName';
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

      <div className="create-form-section">Máy lắp đặt</div>
      <div className="installation-device-list">
        {form.installedDeviceItems.map((item, index) => (
          <div className="installation-device-row" key={index}>
            <div className="installation-device-heading">Thiết bị {index + 1}</div>
            <label>
              Model
              <select
                onChange={(event) => {
                  const model = machineModels.find((option) => option.id === event.target.value);
                  updateDeviceItem(index, {
                    itemName: machineProductName(model) || item.itemName,
                    model: machineModelName(model),
                  });
                }}
                required={index === 0}
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
              Tên sản phẩm
              <input onChange={(event) => updateDeviceItem(index, { itemName: event.target.value })} required={index === 0} value={item.itemName} />
            </label>
            <label>
              S/N
              <SerialNumberInputs
                item={item}
                onChange={(serialNumber) => updateDeviceItem(index, { serialNumber })}
              />
            </label>
            <DateInput label="NSX" onChange={(value) => updateDeviceItem(index, { manufactureDate: value })} value={item.manufactureDate} />
            <label>
              Số lượng
              <input
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
  return machineModelOptionLabel(model) || machineModelName(model);
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
  item,
  onChange,
}: {
  item: InstallationDeviceItem;
  onChange: (serialNumber: string) => void;
}) {
  const quantity = Math.max(1, Number(item.quantity) || 1);
  const serialNumbers = serialNumberList(item.serialNumber, quantity);

  if (quantity === 1) {
    return (
      <input
        onChange={(event) => onChange(event.target.value)}
        value={serialNumbers[0] || ''}
      />
    );
  }

  return (
    <div className="grid gap-2">
      {serialNumbers.map((serialNumber, serialIndex) => (
        <input
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
    </div>
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

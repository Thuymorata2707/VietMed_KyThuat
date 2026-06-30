import type { ApiUser } from '../../api';
import type { CreateTicketForm, InstallationDeviceItem } from './types';

type InstallationHandoverFormProps = {
  form: CreateTicketForm;
  user: ApiUser;
  updateForm: (patch: Partial<CreateTicketForm>) => void;
  updateDeviceItem: (index: number, patch: Partial<InstallationDeviceItem>) => void;
  addDeviceItem: () => void;
  removeDeviceItem: (index: number) => void;
};

export function InstallationHandoverForm({
  addDeviceItem,
  form,
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
      <label>
        Ngày đi
        <input onChange={(event) => updateForm({ handoverDepartureDate: event.target.value })} type="date" value={form.handoverDepartureDate} />
      </label>

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
              <input onChange={(event) => updateDeviceItem(index, { model: event.target.value })} value={item.model} />
            </label>
            <label>
              S/N
              <input onChange={(event) => updateDeviceItem(index, { serialNumber: event.target.value })} value={item.serialNumber} />
            </label>
            <label>
              NSX
              <input
                onChange={(event) => updateDeviceItem(index, { manufactureDate: event.target.value })}
                type="date"
                value={item.manufactureDate}
              />
            </label>
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

import type { ApiUser } from '../../../api';
import { machineDisplayName, machineProductName } from '../../../utils/machineDisplayName';
import type { CreateTicketForm, QuickMachineModel } from '../types';
import { canEngineerSeeModel, quickModelLabel } from '../utils';
import { AsyncEntityPicker } from './AsyncEntityPicker';

type CreateModelDevicePickerProps = {
  loading: boolean;
  machineModelOptions: QuickMachineModel[];
  onChange: (patch: Partial<CreateTicketForm>) => void;
  user: ApiUser;
  value: string;
};

export function CreateModelDevicePicker({
  loading,
  machineModelOptions,
  onChange,
  user,
  value,
}: CreateModelDevicePickerProps) {
  return (
    <div className="machine-picker">
      <AsyncEntityPicker<QuickMachineModel>
        className="engineer-picker"
        disabled={loading}
        endpoint="/machine-models?limit=100"
        formatOption={(model) => ({
          label: quickModelLabel(model),
          row: model,
          value: model.id,
        })}
        initialOptions={machineModelOptions.map((model) => ({
          label: quickModelLabel(model),
          row: model,
          value: model.id,
        }))}
        label="Model / tên thiết bị"
        onChange={(nextValue, model) => {
          onChange({
            machineModelId: nextValue,
            modelName: model?.name || model?.displayName || model?.code || '',
            deviceName: machineProductName(model) || machineDisplayName(model) || model?.displayName || model?.name || model?.code || '',
          });
        }}
        placeholder="Tìm model, tên máy hoặc hãng"
        rowFilter={(model) => canEngineerSeeModel(user, model)}
        value={value}
      />
    </div>
  );
}

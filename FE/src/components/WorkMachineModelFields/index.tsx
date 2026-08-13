import { ModelInfoFields } from '../ModelInfoFields';
import { machineDisplayName, machineModelOptionLabel, machineProductName } from '../../utils/machineDisplayName';

export type WorkMachineOption = {
  id: string;
  machineCode?: string | null;
  serialNumber?: string | null;
  modelName?: string | null;
  name?: string | null;
  machineModel?: { id?: string | null } | null;
};

export type WorkMachineModelOption = {
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

type WorkMachineModelFieldsProps = {
  deviceName: string;
  fieldClassName: string;
  installedMachines: WorkMachineOption[];
  labelClassName: string;
  lockedByMachine?: boolean;
  machineModelId: string;
  machineModels: WorkMachineModelOption[];
  selectedMachineId?: string;
  modelName: string;
  onChange: (patch: {
    deviceName?: string;
    machineId?: string;
    machineModelId?: string;
    modelName?: string;
    serialNumber?: string;
  }) => void;
  serialNumber: string;
};

export function WorkMachineModelFields({
  deviceName: _deviceName,
  fieldClassName,
  installedMachines,
  labelClassName,
  lockedByMachine = false,
  machineModelId,
  machineModels,
  selectedMachineId = '',
  modelName,
  onChange,
  serialNumber,
}: WorkMachineModelFieldsProps) {
  const selectedModelId = machineModelId || modelIdByName(machineModels, modelName);
  const selectedModel = machineModels.find((model) => model.id === selectedModelId);
  const selectedMachine = selectedMachineId ? installedMachines.find((machine) => machine.id === selectedMachineId) : null;

  return (
    <>
      <label className={`${labelClassName} md:col-span-2`}>
        Chọn máy đã lắp đặt
        <select
          className={fieldClassName}
          onChange={(event) => {
            const machine = installedMachines.find((item) => item.id === event.target.value);
            if (machine) {
              const machineModelName = machine.modelName || machine.name || '';
              onChange({
                machineId: machine.id,
                serialNumber: machine.serialNumber || '',
                modelName: machineModelName,
                deviceName: machine.name || machine.modelName || '',
                machineModelId: machine.machineModel?.id || modelIdByName(machineModels, machineModelName),
              });
            }
          }}
          value={selectedMachineId}
        >
          <option value="">-- Chọn máy đã lắp đặt (hoặc nhập tay S/N) --</option>
          {selectedMachine && !installedMachines.some((machine) => machine.id === selectedMachine.id) ? (
            <option value={selectedMachine.id}>
              {[selectedMachine.machineCode, selectedMachine.serialNumber ? `S/N ${selectedMachine.serialNumber}` : '', selectedMachine.modelName || selectedMachine.name].filter(Boolean).join(' - ')}
            </option>
          ) : null}
          {installedMachines.map((machine) => (
            <option key={machine.id} value={machine.id}>
              {[machine.machineCode, machine.serialNumber ? `S/N ${machine.serialNumber}` : '', machine.modelName || machine.name].filter(Boolean).join(' - ')}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClassName}>
        S/N máy
        <input className={fieldClassName} onChange={(event) => onChange({ serialNumber: event.target.value })} value={serialNumber} />
      </label>
      <label className={labelClassName}>
        {lockedByMachine ? 'Model máy đã khóa theo máy chọn' : 'Model / tên thiết bị'}
        <select
          className={fieldClassName}
          disabled={lockedByMachine}
          onChange={(event) => {
            const model = machineModels.find((item) => item.id === event.target.value);
            onChange({
              machineModelId: event.target.value,
              modelName: model?.name || model?.displayName || model?.code || '',
              deviceName: machineProductName(model) || machineDisplayName(model) || model?.displayName || model?.name || model?.code || '',
            });
          }}
          value={selectedModelId}
        >
          <option value="">Chọn model</option>
          {machineModels.map((model) => (
            <option key={model.id} value={model.id}>
              {machineModelLabel(model)}
            </option>
          ))}
        </select>
        {lockedByMachine ? <span className="text-xs font-semibold text-[#8a8f99]">Phụ kiện thay thế sẽ lấy theo model này.</span> : null}
      </label>
      <ModelInfoFields className="md:col-span-2" model={selectedModel} />
    </>
  );
}

export function modelIdByName(models: WorkMachineModelOption[], value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  return models.find((model) => [model.name, model.displayName, model.code].filter(Boolean).some((item) => String(item).trim().toLowerCase() === normalized))?.id || '';
}

function machineModelLabel(model: WorkMachineModelOption) {
  return machineModelOptionLabel(model) || model.code || model.displayName || model.name || 'Model';
}

import { Plus, Trash2 } from 'lucide-react';
import { ultrasoundProbeOptions } from '../../config/ultrasoundProbes';
import { MachineAccessoryFormItem, makeProbeAccessory, parseMachineAccessoriesInput } from '../../utils/machineAccessories';

type MachineAccessoryEditorProps = {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
};

export function MachineAccessoryEditor({ value, onChange, compact }: MachineAccessoryEditorProps) {
  const items = parseMachineAccessoriesInput(value, [], { keepBlank: true });

  function setItems(nextItems: MachineAccessoryFormItem[]) {
    onChange(nextItems.length ? JSON.stringify(nextItems) : '');
  }

  function updateItem(index: number, patch: Partial<MachineAccessoryFormItem>) {
    setItems(items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const nextItem = { ...item, ...patch };
      if (patch.code) {
        nextItem.name = patch.code;
      }
      return nextItem;
    }));
  }

  function addItem() {
    setItems([...items, makeProbeAccessory('', '')]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className={compact ? 'machine-accessory-editor compact' : 'machine-accessory-editor'}>
      <div className="machine-accessory-header">
        <span>Đầu dò đi kèm</span>
        <button className="secondary-button compact" onClick={addItem} type="button">
          <Plus size={16} />
          Thêm đầu dò
        </button>
      </div>

      <div className="machine-accessory-list">
        {items.map((item, index) => (
          <div className="machine-accessory-row" key={`${item.id ?? 'new'}-${index}`}>
            <label>
              Ký hiệu đầu dò
              <select onChange={(event) => updateItem(index, { code: event.target.value })} value={item.code || item.name || ''}>
                <option value="">Chọn đầu dò</option>
                {ultrasoundProbeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              S/N đầu dò
              <input onChange={(event) => updateItem(index, { serialNumber: event.target.value })} value={item.serialNumber || ''} />
            </label>
            <button className="icon-button danger" onClick={() => removeItem(index)} title="Xóa đầu dò" type="button">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {!items.length ? (
        <div className="machine-accessory-empty">
          Mỗi máy siêu âm thường có khoảng 6 đầu dò. Bấm thêm đầu dò để nhập ký hiệu và S/N thực tế.
        </div>
      ) : null}
    </div>
  );
}

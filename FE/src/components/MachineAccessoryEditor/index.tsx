import { Plus, ScanLine, Trash2 } from 'lucide-react';
import { endoscopyAccessoryOptions } from '../../config/endoscopyAccessories';
import { ultrasoundProbeOptions } from '../../config/ultrasoundProbes';
import { MachineAccessoryFormItem, makeProbeAccessory, parseMachineAccessoriesInput } from '../../utils/machineAccessories';

type MachineAccessoryEditorProps = {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  mode?: 'probe' | 'endoscopy';
};

export function MachineAccessoryEditor({ value, onChange, compact, mode = 'probe' }: MachineAccessoryEditorProps) {
  const items = parseMachineAccessoriesInput(value, [], { keepBlank: true });
  const isEndoscopy = mode === 'endoscopy';

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

  function toggleEndoscopyAccessory(name: string) {
    const exists = items.some((item) => (item.name || item.code) === name);
    if (exists) {
      setItems(items.filter((item) => (item.name || item.code) !== name));
      return;
    }
    setItems([...items.filter((item) => item.name), { code: name, name, serialNumber: '' }]);
  }

  return (
    <div className={`${compact ? 'machine-accessory-editor compact' : 'machine-accessory-editor'} grid gap-3 rounded-lg border border-[#dbe5ef] bg-[#fbfdff] p-4`}>
      <div className="machine-accessory-header flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#333333]">
          <ScanLine size={17} className="text-[#d71920]" />
          {isEndoscopy ? 'Phụ kiện nội soi đi kèm' : 'Đầu dò đi kèm'}
        </span>
        <button className="secondary-button compact" onClick={addItem} type="button">
          <Plus size={16} />
          {isEndoscopy ? 'Add accessory' : 'Add probe'}
        </button>
      </div>

      {isEndoscopy ? (
        <div className="grid gap-2 rounded-lg border border-[#eeeeee] bg-white p-3">
          <span className="text-xs font-semibold text-[#666666]">Checklist nội soi tiêu hóa</span>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {endoscopyAccessoryOptions.map((option) => {
              const checked = items.some((item) => (item.name || item.code) === option.value);
              return (
                <label className="flex min-h-9 items-center gap-2 rounded-lg border border-[#eeeeee] bg-[#fafafa] px-3 py-2 text-sm font-medium text-[#333333]" key={option.value}>
                  <input checked={checked} onChange={() => toggleEndoscopyAccessory(option.value)} type="checkbox" />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="machine-accessory-list grid gap-3">
        {items.map((item, index) => (
          <div className="machine-accessory-row grid gap-3 rounded-lg border border-[#eeeeee] bg-white p-3 md:grid-cols-[minmax(190px,1fr)_minmax(180px,1fr)_auto]" key={`${item.id ?? 'new'}-${index}`}>
            <label className="grid gap-2 text-sm font-medium text-[#333333]">
              {isEndoscopy ? 'Tên phụ kiện' : 'Ký hiệu đầu dò'}
              {isEndoscopy ? (
                <input className="h-11 rounded-lg border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]" onChange={(event) => updateItem(index, { code: event.target.value, name: event.target.value })} value={item.name || item.code || ''} />
              ) : (
                <select className="h-11 rounded-lg border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]" onChange={(event) => updateItem(index, { code: event.target.value })} value={item.code || item.name || ''}>
                  <option value="">Chọn đầu dò</option>
                  {ultrasoundProbeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#333333]">
              {isEndoscopy ? 'S/N hoặc số lượng/ghi chú' : 'S/N đầu dò'}
              <input className="h-11 rounded-lg border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f] outline-none focus:border-[#d71920] focus:shadow-[0_0_0_3px_rgba(215,25,32,0.12)]" onChange={(event) => updateItem(index, { serialNumber: event.target.value })} value={item.serialNumber || ''} />
            </label>
            <button className="icon-button danger self-end" onClick={() => removeItem(index)} title={isEndoscopy ? 'Delete accessory' : 'Delete probe'} type="button">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {!items.length ? (
        <div className="machine-accessory-empty rounded-lg border border-dashed border-[#d6d6d6] bg-white px-4 py-5 text-sm leading-6 text-[#666666]">
          {isEndoscopy
            ? 'Tích các phụ kiện có trong checklist hoặc bấm thêm phụ kiện khác nếu checklist chưa có.'
            : 'Mỗi máy siêu âm thường có khoảng 6 đầu dò. Bấm thêm đầu dò để nhập ký hiệu và S/N thực tế.'}
        </div>
      ) : null}
    </div>
  );
}

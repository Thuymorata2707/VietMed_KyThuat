import { Plus, ScanLine, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { endoscopyAccessoriesWithModel, endoscopyAccessoryOptions } from '../../config/endoscopyAccessories';
import { ultrasoundProbeOptions } from '../../config/ultrasoundProbes';
import { MachineAccessoryFormItem, makeProbeAccessory, parseMachineAccessoriesInput } from '../../utils/machineAccessories';

type MachineAccessoryEditorProps = {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  mode?: 'probe' | 'endoscopy' | 'generic';
  templates?: Array<{ id: string; code: string; name: string; quantity?: number | null }>;
};

export function MachineAccessoryEditor({ value, onChange, compact, mode = 'probe', templates = [] }: MachineAccessoryEditorProps) {
  const items = parseMachineAccessoriesInput(value, [], { keepBlank: true });
  const isEndoscopy = mode === 'endoscopy';
  const isProbe = mode === 'probe';
  const modelProbeOptions = templates
    .filter((template) => ultrasoundProbeOptions.some((option) => option.value === template.code))
    .map((template) => ({ label: template.code, value: template.code, id: template.id }));
  const probeOptions = modelProbeOptions.length
    ? modelProbeOptions
    : ultrasoundProbeOptions.map((option) => ({ ...option, id: undefined }));
  const [accessorySearch, setAccessorySearch] = useState('');
  const visibleEndoscopyOptions = useMemo(() => {
    const keyword = accessorySearch.trim().toLowerCase();
    if (!keyword) return endoscopyAccessoryOptions;
    return endoscopyAccessoryOptions.filter((option) => option.label.toLowerCase().includes(keyword));
  }, [accessorySearch]);
  const fieldClass = 'h-11 w-full min-w-0 rounded-xl border border-[#d6d6d6] bg-white px-3 text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.12)]';
  const labelClass = 'grid w-full min-w-0 gap-2 text-sm font-medium text-[#333333]';

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
    const template = templates.find((item) => item.code === name || item.name === name);
    setItems([...items.filter((item) => item.name), { componentAccessoryId: template?.id, code: template?.code || name, name: template?.name || name, quantity: isCoreEndoscopyAccessory(name) ? undefined : template?.quantity ?? 1, serialNumber: '', description: '' }]);
  }

  function setAllEndoscopyAccessories(checked: boolean) {
    const optionNames = new Set<string>(endoscopyAccessoryOptions.map((option) => option.value));
    if (!checked) {
      setItems(items.filter((item) => !optionNames.has(item.name || item.code || '')));
      return;
    }

    const existingNames = new Set(items.map((item) => item.name || item.code).filter(Boolean));
    const missingItems = endoscopyAccessoryOptions
      .filter((option) => !existingNames.has(option.value))
      .map((option) => {
        const template = templates.find((item) => item.code === option.value || item.name === option.value);
        return { componentAccessoryId: template?.id, code: template?.code || option.value, name: template?.name || option.value, quantity: isCoreEndoscopyAccessory(option.value) ? undefined : template?.quantity ?? 1, serialNumber: '', description: '' };
      });
    setItems([...items.filter((item) => item.name), ...missingItems]);
  }

  return (
    <div className={`${compact ? 'machine-accessory-editor compact' : 'machine-accessory-editor'} grid gap-3 rounded-2xl border border-[#dbe5ef] bg-[#fafafa] p-4`}>
      <div className="machine-accessory-header flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#333333]">
          <ScanLine size={17} className="text-[#18181b]" />
          {isEndoscopy ? 'Phụ kiện nội soi đi kèm' : isProbe ? 'Đầu dò đi kèm' : 'Phụ kiện đi kèm'}
        </span>
        <button className="secondary-button compact" onClick={addItem} type="button">
          <Plus size={16} />
          Thêm
        </button>
      </div>

      {isEndoscopy ? (
        <div className="grid gap-2 rounded-lg border border-[#eeeeee] bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#666666]">Checklist nội soi</span>
            <div className="flex flex-wrap gap-2">
              <button className="secondary-button compact" onClick={() => setAllEndoscopyAccessories(true)} type="button">
                Chọn tất cả
              </button>
              <button className="secondary-button compact" onClick={() => setAllEndoscopyAccessories(false)} type="button">
                Bỏ chọn
              </button>
            </div>
          </div>
          <input
            className="h-10 rounded-xl border border-[#d6d6d6] bg-[#fafafa] px-3 text-sm font-semibold text-[#1f1f1f] outline-none focus:border-[#18181b] focus:bg-white focus:shadow-[0_0_0_3px_rgba(24,24,27,0.10)]"
            onChange={(event) => setAccessorySearch(event.target.value)}
            placeholder="Tìm phụ kiện"
            value={accessorySearch}
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visibleEndoscopyOptions.map((option) => {
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

      <div className="machine-accessory-list grid w-full gap-3">
        {items.map((item, index) => {
          const accessoryName = item.name || item.code || '';
          const hasModelField = isEndoscopy && endoscopyAccessoriesWithModel.has(accessoryName);
          const hasQuantityField = !isProbe && !isCoreEndoscopyAccessory(accessoryName);
          const fieldsClass = hasModelField
            ? hasQuantityField
              ? 'grid w-full min-w-0 gap-3 md:grid-cols-4'
              : 'grid w-full min-w-0 gap-3 md:grid-cols-3'
            : hasQuantityField
              ? 'grid w-full min-w-0 gap-3 md:grid-cols-3'
              : 'grid w-full min-w-0 gap-3 md:grid-cols-2';

          return (
            <div className="machine-accessory-row grid w-full min-w-0 gap-3 rounded-2xl border border-[#eeeeee] bg-white p-3" key={`${item.id ?? 'new'}-${index}`}>
              <div className={fieldsClass}>
                <label className={labelClass}>
                  {isEndoscopy ? 'Tên phụ kiện' : isProbe ? 'Ký hiệu đầu dò' : 'Tên phụ kiện'}
                  {isProbe ? (
                    <select className={fieldClass} onChange={(event) => {
                      const option = probeOptions.find((candidate) => candidate.value === event.target.value);
                      updateItem(index, {
                        code: event.target.value,
                        name: event.target.value,
                        componentAccessoryId: option?.id,
                      });
                    }} value={item.code || item.name || ''}>
                      <option value="">Chọn đầu dò</option>
                      {probeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input className={fieldClass} onChange={(event) => updateItem(index, { code: event.target.value, name: event.target.value })} value={accessoryName} />
                  )}
                </label>
                {hasModelField ? (
                  <label className={labelClass}>
                    Model
                    <input className={fieldClass} onChange={(event) => updateItem(index, { description: event.target.value })} value={item.description || ''} />
                  </label>
                ) : null}
                <label className={labelClass}>
                  Serial
                  <input className={fieldClass} onChange={(event) => updateItem(index, { serialNumber: event.target.value })} value={item.serialNumber || ''} />
                </label>
                {hasQuantityField ? (
                  <label className={labelClass}>
                    Số lượng
                    <input className={fieldClass} min={1} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) || 1 })} type="number" value={item.quantity ?? 1} />
                  </label>
                ) : null}
              </div>
              {!isProbe ? (
                <details className="rounded-xl border border-[#eef0f3] bg-[#fafafa] px-3 py-2 text-sm text-[#475569] md:col-span-2">
                  <summary className="cursor-pointer font-semibold text-[#334155]">Thông tin thêm</summary>
                  <label className={`${labelClass} mt-3`}>
                    Ghi chú
                    <input className={fieldClass} onChange={(event) => updateItem(index, { description: event.target.value })} value={item.description || ''} />
                  </label>
                </details>
              ) : null}
              <button className="icon-button danger justify-self-start" onClick={() => removeItem(index)} title="Xóa phụ kiện" type="button">
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {!items.length ? (
        <div className="machine-accessory-empty rounded-xl border border-dashed border-[#d6d6d6] bg-white px-4 py-4 text-sm leading-6 text-[#666666]">
          Chưa có phụ kiện.
        </div>
      ) : null}
    </div>
  );
}

function isCoreEndoscopyAccessory(name: string) {
  return name === 'Bộ xử lý' || name === 'Nguồn sáng' || name === 'Màn hình';
}

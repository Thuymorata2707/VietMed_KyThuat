import { Plus, Trash2 } from 'lucide-react';

export type UsedPartDraft = {
  componentAccessoryId: string;
  name: string;
  note: string;
  quantity: number;
  serialNumber: string;
  unit: string;
  unitCost: number;
  unitPrice: number;
};

export type WorkAccessoryOption = {
  id: string;
  code?: string | null;
  name: string;
  quantity?: number | null;
  requiresSerial?: boolean | null;
  salePrice?: number | string | null;
  unitCost?: number | string | null;
  component?: {
    name?: string | null;
  } | null;
};

type WorkUsedPartsEditorProps = {
  accessories: WorkAccessoryOption[];
  items: UsedPartDraft[];
  loading?: boolean;
  modelLabel?: string;
  modelSelected: boolean;
  onChange: (items: UsedPartDraft[]) => void;
};

const inputClass = 'h-10 min-w-0 rounded-xl border border-[#ded8d8] bg-white px-3 text-sm font-semibold text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_3px_rgba(24,24,27,0.10)]';

export function WorkUsedPartsEditor({
  accessories,
  items,
  loading = false,
  modelLabel,
  modelSelected,
  onChange,
}: WorkUsedPartsEditorProps) {
  function addItem() {
    onChange([
      ...items,
      {
        componentAccessoryId: '',
        name: '',
        note: '',
        quantity: 1,
        serialNumber: '',
        unit: 'cái',
        unitCost: 0,
        unitPrice: 0,
      },
    ]);
  }

  function updateItem(index: number, patch: Partial<UsedPartDraft>) {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function selectAccessory(index: number, accessoryId: string) {
    const accessory = accessories.find((item) => item.id === accessoryId);
    updateItem(index, {
      componentAccessoryId: accessoryId,
      name: accessory?.name || '',
      quantity: items[index]?.quantity || accessory?.quantity || 1,
      unit: items[index]?.unit || 'cái',
      unitCost: Number(accessory?.unitCost || 0),
      unitPrice: Number(accessory?.salePrice || 0),
    });
  }

  function removeItem(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <section className="rounded-[24px] border border-[#e4e4e7] bg-white/95 p-5 shadow-[0_8px_24px_rgba(24,24,27,0.05)] sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#eeeeee] pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#18181b]">Phụ kiện thay thế</span>
          <h2 className="mt-1 text-lg font-bold leading-tight text-[#1f1f1f]">Phụ kiện phát sinh theo model máy</h2>
          <p className="mt-1 text-xs font-medium leading-5 text-[#8a8f99]">
            {modelSelected
              ? `${modelLabel ? `Đang khóa theo ${modelLabel}. ` : ''}${accessories.length} phụ kiện có thể chọn`
              : 'Chọn máy để tải phụ kiện phù hợp.'}
          </p>
        </div>
        <button className="secondary-button compact" onClick={addItem} type="button">
          <Plus size={15} />
          Thêm
        </button>
      </div>

      {loading ? <div className="rounded-xl bg-[#fafafa] p-4 text-sm font-semibold text-[#666666]">Đang tải phụ kiện...</div> : null}
      {!loading && modelSelected && accessories.length === 0 ? <div className="rounded-xl bg-[#fafafa] p-4 text-sm font-semibold text-[#666666]">Model này chưa có phụ kiện mẫu.</div> : null}

      <div className="grid gap-3">
        {items.map((item, index) => (
          <article className="grid gap-3 rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-3" key={`${index}-${item.componentAccessoryId}`}>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_90px_110px_130px_130px_auto]">
              <select className={inputClass} onChange={(event) => selectAccessory(index, event.target.value)} value={item.componentAccessoryId}>
                <option value="">Chọn phụ kiện theo model</option>
                {accessories.map((accessory) => (
                  <option key={accessory.id} value={accessory.id}>
                    {[accessory.code, accessory.name, accessory.component?.name].filter(Boolean).join(' - ')}
                  </option>
                ))}
              </select>
              <input className={inputClass} min={0.01} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} step={0.01} type="number" value={item.quantity} />
              <input className={inputClass} onChange={(event) => updateItem(index, { unit: event.target.value })} placeholder="Đơn vị" value={item.unit} />
              <input className={inputClass} min={0} onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })} placeholder="Giá bán" step={1000} type="number" value={item.unitPrice || ''} />
              <div className="grid h-10 content-center rounded-xl border border-[#ded8d8] bg-white px-3 text-sm font-bold text-[#177245]">
                {formatMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0))}
              </div>
              <button className="secondary-button compact justify-center text-[#b5121b]" onClick={() => removeItem(index)} type="button">
                <Trash2 size={15} />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input className={inputClass} onChange={(event) => updateItem(index, { name: event.target.value })} placeholder="Tên phụ kiện nếu nhập ngoài danh mục" value={item.name} />
              <input className={inputClass} onChange={(event) => updateItem(index, { serialNumber: event.target.value })} placeholder="Serial phụ kiện nếu có" value={item.serialNumber} />
            </div>
            <input className={inputClass} onChange={(event) => updateItem(index, { note: event.target.value })} placeholder="Ghi chú" value={item.note} />
          </article>
        ))}
      </div>
    </section>
  );
}

function formatMoney(value: number) {
  if (!value) return '0 đ';
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'VND',
  }).format(value);
}

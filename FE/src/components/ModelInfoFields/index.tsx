import { machineModelName, machineProductName } from '../../utils/machineDisplayName';

type ModelInfo = {
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

type ModelInfoFieldsProps = {
  className?: string;
  model?: ModelInfo | null;
};

export function ModelInfoFields({ className = '', model }: ModelInfoFieldsProps) {
  if (!model) return null;

  const items = [
    { label: 'Model', value: machineModelName(model) },
    { label: 'Tên sản phẩm', value: machineProductName(model) },
    { label: 'Hãng', value: model.manufacturer || '' },
    { label: 'Xuất xứ', value: model.countryOfOrigin || model.businessLine?.countryOfOrigin || '' },
  ];

  return (
    <div className={`grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {items.map((item) => (
        <label className="grid min-w-0 gap-1.5 text-xs font-medium text-[#475467]" key={item.label}>
          {item.label}
          <input
            className="h-11 min-w-0 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-medium text-[#475467] outline-none"
            readOnly
            value={item.value || '-'}
          />
        </label>
      ))}
    </div>
  );
}

import { RefreshCw } from 'lucide-react';

type CustomerSiteFieldsProps = {
  address: string;
  contactPhone: string;
  fieldClassName: string;
  labelClassName: string;
  onChange: (patch: {
    address?: string;
    contactPhone?: string;
    representative?: string;
    usingDepartment?: string;
  }) => void;
  onSync: () => void;
  representative: string;
  usingDepartment: string;
};

export function CustomerSiteFields({
  address,
  contactPhone,
  fieldClassName,
  labelClassName,
  onChange,
  onSync,
  representative,
  usingDepartment,
}: CustomerSiteFieldsProps) {
  return (
    <div className="grid min-w-0 gap-5 md:grid-cols-2">
      <label className={labelClassName}>
        <span className="flex items-center gap-2">
          Đơn vị sử dụng
          <button className="text-xs font-medium text-[#b5121b] hover:underline" onClick={onSync} type="button">
            <RefreshCw size={13} className="inline" /> Lấy từ hồ sơ
          </button>
        </span>
        <input className={fieldClassName} onChange={(event) => onChange({ usingDepartment: event.target.value })} value={usingDepartment} />
      </label>
      <label className={labelClassName}>
        Người đại diện
        <input className={fieldClassName} onChange={(event) => onChange({ representative: event.target.value })} value={representative} />
      </label>
      <label className={labelClassName}>
        Số điện thoại
        <input className={fieldClassName} onChange={(event) => onChange({ contactPhone: event.target.value })} value={contactPhone} />
      </label>
      <label className={`${labelClassName} md:col-span-2`}>
        Địa chỉ
        <input className={fieldClassName} onChange={(event) => onChange({ address: event.target.value })} value={address} />
      </label>
    </div>
  );
}

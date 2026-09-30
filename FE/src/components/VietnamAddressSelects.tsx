import vietnamAdministrativeUnits from '../config/vietnamAdministrativeUnits.json';
import { vietnamProvinceOptions } from '../config/vietnamProvinces';

type VietnamWard = {
  code: number;
  name: string;
  type: string;
};

type VietnamProvinceUnits = {
  provinceCode: string;
  provinceName: string;
  wards: VietnamWard[];
};

type AddressValue = {
  address?: string;
  district?: string;
  locality?: string;
  province?: string;
  ward?: string;
};

const administrativeUnits = vietnamAdministrativeUnits as VietnamProvinceUnits[];

export function VietnamAddressSelects({
  fieldClassName,
  labelClassName,
  onChange,
  showProvince = true,
  showStreet = true,
  value,
}: {
  fieldClassName?: string;
  labelClassName?: string;
  onChange: (patch: AddressValue) => void;
  showProvince?: boolean;
  showStreet?: boolean;
  value: AddressValue;
}) {
  const selectedProvince = findProvinceByName(vietnamProvinceOptions, value.province);
  const provinceUnits = administrativeUnits.find((province) =>
    province.provinceCode === selectedProvince?.code ||
    normalizeProvinceName(province.provinceName) === normalizeProvinceName(selectedProvince?.name),
  );
  const wards = provinceUnits?.wards ?? [];
  const labelClass = labelClassName ?? 'grid gap-2 text-sm font-semibold text-[#333333]';
  const fieldClass = fieldClassName ?? 'min-h-11 rounded-2xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_4px_rgba(24,24,27,0.10)]';

  return (
    <>
      {showProvince ? (
        <label className={labelClass}>
          Tỉnh/Thành
          <select className={fieldClass} onChange={(event) => onChange({ district: '', locality: '', province: event.target.value, ward: '' })} value={selectedProvince?.name ?? value.province ?? ''}>
            <option value="">Chọn tỉnh/thành</option>
            {vietnamProvinceOptions.map((province) => (
              <option key={String(province.code ?? province.name)} value={province.name}>
                {province.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className={labelClass}>
        Phường/Xã/Đặc khu
        <select className={fieldClass} disabled={!selectedProvince || wards.length === 0} onChange={(event) => onChange({ district: '', locality: '', ward: event.target.value })} value={wards.some((ward) => cleanUnitName(ward.name) === cleanUnitName(value.ward)) ? cleanUnitName(value.ward) : ''}>
          <option value="">{!selectedProvince ? 'Chọn tỉnh/thành trước' : wards.length ? 'Chọn phường/xã/đặc khu' : 'Chưa có dữ liệu phường/xã'}</option>
          {wards.map((ward) => (
            <option key={ward.code} value={cleanUnitName(ward.name)}>
              {cleanUnitName(ward.name)}
            </option>
          ))}
        </select>
        {value.ward && !wards.some((ward) => cleanUnitName(ward.name) === cleanUnitName(value.ward)) ? <span className="text-xs font-medium text-[#9a6b36]">Địa chỉ cũ: {value.ward}.</span> : null}
      </label>

      <label className={labelClass}>
        Thôn/Ấp/Tổ dân phố/Khu phố
        <input className={fieldClass} onChange={(event) => onChange({ locality: event.target.value })} placeholder="VD: Tổ 5, Khu phố 2" value={value.locality ?? ''} />
      </label>

      {showStreet ? (
        <label className={labelClass}>
          Số nhà / đường
          <input className={fieldClass} onChange={(event) => onChange({ address: event.target.value })} placeholder="VD: 71/2 đường Phương Canh" value={value.address ?? ''} />
        </label>
      ) : null}
    </>
  );
}

export function GoogleMapsDirectionsButton({
  address,
  className = 'secondary-button',
}: {
  address: string;
  className?: string;
}) {
  const href = buildGoogleMapsDirectionsUrl(address);
  return (
    <a className={className} href={href} rel="noreferrer" target="_blank">
      Mở Google Maps
    </a>
  );
}

export function buildFullVietnamAddress(value: AddressValue) {
  return [value.address, value.locality, value.ward, value.district, value.province]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
}

export function buildGoogleMapsDirectionsUrl(address: string) {
  const destination = encodeURIComponent(address.trim());
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

function findProvinceByName(provinces: Array<{ code: string; name: string }>, value?: string) {
  const normalizedValue = normalizeProvinceName(value);
  if (!normalizedValue) return null;

  return provinces.find((province) => normalizeProvinceName(province.name) === normalizedValue) ?? null;
}

function normalizeProvinceName(value?: string) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(tinh|thanh pho)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function cleanUnitName(value?: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

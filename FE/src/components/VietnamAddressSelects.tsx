import { useEffect, useMemo, useState } from 'react';
import { vietnamProvinceOptions } from '../config/vietnamProvinces';

type VietnamWard = {
  code?: number | string;
  name: string;
};

type VietnamDistrict = {
  code?: number | string;
  name: string;
  wards?: VietnamWard[];
};

type VietnamProvince = {
  code?: number | string;
  name: string;
  districts?: VietnamDistrict[];
};

type AddressValue = {
  address?: string;
  district?: string;
  province?: string;
  ward?: string;
};

let cachedAdministrativeUnits: VietnamProvince[] | null = null;

const administrativeApiUrl = 'https://provinces.open-api.vn/api/?depth=3';

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
  const { data, loading } = useVietnamAdministrativeUnits();
  const provinces = data.length ? data : fallbackProvinces;
  const selectedProvince = findProvinceByName(provinces, value.province);
  const districts = selectedProvince?.districts ?? [];
  const selectedDistrict = districts.find((district) => district.name === value.district) ?? null;
  const wards = selectedDistrict?.wards ?? [];
  const labelClass = labelClassName ?? 'grid gap-2 text-sm font-semibold text-[#333333]';
  const fieldClass = fieldClassName ?? 'min-h-11 rounded-2xl border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#1f1f1f] outline-none focus:border-[#18181b] focus:shadow-[0_0_0_4px_rgba(24,24,27,0.10)]';

  return (
    <>
      {showProvince ? (
        <label className={labelClass}>
          Tỉnh/Thành
          <select className={fieldClass} onChange={(event) => onChange({ district: '', province: event.target.value, ward: '' })} value={selectedProvince?.name ?? value.province ?? ''}>
            <option value="">{loading ? 'Đang tải tỉnh/thành...' : 'Chọn tỉnh/thành'}</option>
            {provinces.map((province) => (
              <option key={String(province.code ?? province.name)} value={province.name}>
                {province.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className={labelClass}>
        Quận/Huyện
        <select className={fieldClass} disabled={!value.province || districts.length === 0} onChange={(event) => onChange({ district: event.target.value, ward: '' })} value={value.district ?? ''}>
          <option value="">{districts.length ? 'Chọn quận/huyện' : 'Chọn tỉnh trước'}</option>
          {districts.map((district) => (
            <option key={String(district.code ?? district.name)} value={district.name}>
              {district.name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        Phường/Xã
        <select className={fieldClass} disabled={!value.district || wards.length === 0} onChange={(event) => onChange({ ward: event.target.value })} value={value.ward ?? ''}>
          <option value="">{wards.length ? 'Chọn phường/xã' : 'Chọn quận/huyện trước'}</option>
          {wards.map((ward) => (
            <option key={String(ward.code ?? ward.name)} value={ward.name}>
              {ward.name}
            </option>
          ))}
        </select>
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
  return [value.address, value.ward, value.district, value.province]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
}

export function buildGoogleMapsDirectionsUrl(address: string) {
  const destination = encodeURIComponent(address.trim());
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

function useVietnamAdministrativeUnits() {
  const [data, setData] = useState<VietnamProvince[]>(cachedAdministrativeUnits ?? fallbackProvinces);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cachedAdministrativeUnits) return;

    const controller = new AbortController();

    fetch(administrativeApiUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Không tải được dữ liệu hành chính.');
        return response.json() as Promise<VietnamProvince[]>;
      })
      .then((nextData) => {
        if (!Array.isArray(nextData) || !nextData.length) return;
        cachedAdministrativeUnits = nextData;
        setData(nextData);
      })
      .catch(() => {
        setData((current) => (current.length ? current : fallbackProvinces));
      });

    return () => controller.abort();
  }, []);

  return useMemo(() => ({ data, loading }), [data, loading]);
}

const fallbackProvinces: VietnamProvince[] = vietnamProvinceOptions.map((province) => ({
  code: province.code,
  name: province.name,
  districts: [],
}));

function findProvinceByName(provinces: VietnamProvince[], value?: string) {
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

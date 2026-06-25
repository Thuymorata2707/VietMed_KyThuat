import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { getRoleName } from '../../auth/roles';
import { AdminCrudPage } from '../AdminCrudPage';
import { ResourcePage } from '../ResourcePage';
import { ApiUser, Paginated, apiFetch } from '../../api';
import { adminCrudConfigs } from '../../config/adminCrud';
import { resources } from '../../config/resources';

type ServiceTicketKind = 'repairs' | 'maintenance';

const serviceTicketOptions: Array<{ label: string; value: ServiceTicketKind }> = [
  { label: 'Sửa chữa', value: 'repairs' },
  { label: 'Bảo trì', value: 'maintenance' },
];

export function ServiceTicketsPage({ user }: { user: ApiUser }) {
  const [kind, setKind] = useState<ServiceTicketKind>('repairs');
  const [productIndustryId, setProductIndustryId] = useState('');
  const role = getRoleName(user);
  const extraQueryParams = productIndustryId ? { productIndustryId } : undefined;
  const selector = (
    <div className="flex flex-wrap items-end gap-2">
      <label className="service-kind-select">
        <span>Loại phiếu</span>
        <select onChange={(event) => setKind(event.target.value as ServiceTicketKind)} value={kind}>
          {serviceTicketOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <ProductIndustryFilter onChange={setProductIndustryId} value={productIndustryId} />
      {role !== 'admin' ? (
        <Link className="primary-button" to={`/service-tickets/create?kind=${kind === 'maintenance' ? 'maintenance' : 'repair'}&returnTo=/service-tickets`}>
          <Plus size={16} />
          Tạo phiếu
        </Link>
      ) : null}
    </div>
  );

  if (role === 'admin') {
    return <AdminCrudPage config={adminCrudConfigs[kind]} extraQueryParams={extraQueryParams} headerControl={selector} />;
  }

  const updateBase = kind === 'maintenance' ? '/maintenance' : '/repairs';

  return (
    <ResourcePage
      config={resources[kind]}
      extraQueryParams={extraQueryParams}
      getEditHref={(row) => (row.id ? `${updateBase}/${String(row.id)}/update?returnTo=/service-tickets` : null)}
      toolbarControl={selector}
    />
  );
}

export function InstallationsPage({ user }: { user: ApiUser }) {
  const [productIndustryId, setProductIndustryId] = useState('');
  const role = getRoleName(user);
  const extraQueryParams = productIndustryId ? { productIndustryId } : undefined;
  const toolbarControl = (
    <div className="flex flex-wrap items-end gap-2">
      <ProductIndustryFilter onChange={setProductIndustryId} value={productIndustryId} />
      {role !== 'admin' ? (
        <Link className="primary-button" to="/installations/create?returnTo=/installations">
          <Plus size={16} />
          Tạo phiếu
        </Link>
      ) : null}
    </div>
  );

  if (role === 'admin') {
    return <AdminCrudPage config={adminCrudConfigs.installations} extraQueryParams={extraQueryParams} headerControl={toolbarControl} />;
  }

  return (
    <ResourcePage
      config={resources.installations}
      extraQueryParams={extraQueryParams}
      getEditHref={(row) => (row.id ? `/installations/${String(row.id)}/update?returnTo=/installations` : null)}
      toolbarControl={toolbarControl}
    />
  );
}

type ProductIndustry = {
  id: string;
  name: string;
  code?: string | null;
};

function ProductIndustryFilter({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const [industries, setIndustries] = useState<ProductIndustry[]>([]);

  useEffect(() => {
    apiFetch<Paginated<ProductIndustry> | ProductIndustry[]>('/product-industries?limit=100')
      .then((result) => setIndustries(Array.isArray(result) ? result : result.data ?? []))
      .catch(() => setIndustries([]));
  }, []);

  return (
    <label className="service-kind-select">
      <span>Ngành hàng</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">Tất cả ngành hàng</option>
        {industries.map((industry) => (
          <option key={industry.id} value={industry.id}>
            {industry.name}
          </option>
        ))}
      </select>
    </label>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { getRoleName } from '../../auth/roles';
import { AdminCrudPage } from '../AdminCrudPage';
import { ResourcePage } from '../ResourcePage';
import { ApiUser } from '../../api';
import { adminCrudConfigs } from '../../config/adminCrud';
import { resources } from '../../config/resources';

type ServiceTicketKind = 'repairs' | 'maintenance';

const serviceTicketOptions: Array<{ label: string; value: ServiceTicketKind }> = [
  { label: 'Sửa chữa', value: 'repairs' },
  { label: 'Bảo trì', value: 'maintenance' },
];

export function ServiceTicketsPage({ user }: { user: ApiUser }) {
  const [kind, setKind] = useState<ServiceTicketKind>('repairs');
  const role = getRoleName(user);
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
      {role !== 'admin' ? (
        <Link className="primary-button" to={`/service-tickets/create?kind=${kind === 'maintenance' ? 'maintenance' : 'repair'}&returnTo=/service-tickets`}>
          <Plus size={16} />
          Tạo phiếu
        </Link>
      ) : null}
    </div>
  );

  if (role === 'admin') {
    return <AdminCrudPage config={adminCrudConfigs[kind]} headerControl={selector} />;
  }

  return <ResourcePage config={resources[kind]} toolbarControl={selector} />;
}

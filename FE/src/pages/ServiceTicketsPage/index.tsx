import { useState } from 'react';
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
  );

  if (role === 'admin') {
    return <AdminCrudPage config={adminCrudConfigs[kind]} headerControl={selector} />;
  }

  return <ResourcePage config={resources[kind]} toolbarControl={selector} />;
}

import { RequestUser } from '../common/request-user.type';
import { hasPermission, PERMISSIONS } from './permissions';

describe('installation management permissions', () => {
  const manager: RequestUser = {
    id: 'manager-1',
    email: 'manager@example.test',
    roleId: 'role-manager',
    roleName: 'manager',
    regionId: 'region-1',
  };

  it('allows managers to update and approve installation tickets', () => {
    expect(hasPermission(manager, PERMISSIONS.INSTALLATION_UPDATE)).toBe(true);
    expect(hasPermission(manager, PERMISSIONS.INSTALLATION_STATUS_UPDATE)).toBe(
      true,
    );
  });

  it('keeps installation deletion restricted to administrators', () => {
    expect(hasPermission(manager, PERMISSIONS.INSTALLATION_DELETE)).toBe(false);
  });
});

import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../common/request-user.type';
import { assertPermission, hasPermission, PERMISSIONS } from './permissions';

describe('permissions', () => {
  const manager: RequestUser = {
    id: 'manager-1',
    email: 'manager@example.com',
    roleId: 'role-manager',
    roleName: 'manager',
    regionId: 'region-1',
  };

  const engineer: RequestUser = {
    id: 'engineer-1',
    email: 'engineer@example.com',
    roleId: 'role-engineer',
    roleName: 'engineer',
    regionId: 'region-1',
  };

  it('keeps managers read-oriented for repair workflows', () => {
    expect(hasPermission(manager, PERMISSIONS.REPAIR_READ)).toBe(true);
    expect(hasPermission(manager, PERMISSIONS.REPAIR_UPDATE)).toBe(false);
    expect(() =>
      assertPermission(manager, PERMISSIONS.REPAIR_ASSIGN),
    ).toThrow(ForbiddenException);
  });

  it('allows engineers to update assigned work status but not assign work', () => {
    expect(hasPermission(engineer, PERMISSIONS.REPAIR_STATUS_UPDATE)).toBe(
      true,
    );
    expect(hasPermission(engineer, PERMISSIONS.MAINTENANCE_STATUS_UPDATE)).toBe(
      true,
    );
    expect(hasPermission(engineer, PERMISSIONS.REPAIR_ASSIGN)).toBe(false);
  });
});

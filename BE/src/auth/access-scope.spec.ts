import { RequestUser } from '../common/request-user.type';
import { customerAccessWhere } from './access-scope';

describe('customerAccessWhere', () => {
  it('keeps legacy unscoped customers visible when branch tickets or assets are assigned to the branch', () => {
    const admin: RequestUser = {
      id: 'admin-1',
      email: 'admin@example.test',
      roleId: 'role-admin',
      roleName: 'admin',
      regionId: 'region-1',
    };

    expect(customerAccessWhere(admin)).toEqual({
      OR: [
        { regionId: 'region-1' },
        expect.objectContaining({
          regionId: null,
          OR: expect.arrayContaining([
            expect.objectContaining({ machines: expect.any(Object) }),
            expect.objectContaining({ machineInstallations: expect.any(Object) }),
            expect.objectContaining({ repairs: expect.any(Object) }),
            expect.objectContaining({ maintenances: expect.any(Object) }),
          ]),
        }),
      ],
    });
  });
});

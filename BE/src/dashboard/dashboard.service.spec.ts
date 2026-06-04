import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let prisma: any;
  let service: DashboardService;

  const manager = {
    id: 'manager-1',
    email: 'manager@example.com',
    roleId: 'role-manager',
    roleName: 'manager',
    regionId: 'region-north',
  };

  const engineer = {
    id: 'engineer-1',
    email: 'engineer@example.com',
    roleId: 'role-engineer',
    roleName: 'engineer',
    regionId: 'region-north',
  };

  beforeEach(() => {
    prisma = {
      customer: { count: jest.fn().mockResolvedValue(0) },
      businessLine: { count: jest.fn().mockResolvedValue(0) },
      machineInventoryMovement: { count: jest.fn().mockResolvedValue(0) },
      machine: { count: jest.fn().mockResolvedValue(0) },
      user: { count: jest.fn().mockResolvedValue(0) },
      repair: { count: jest.fn().mockResolvedValue(0) },
      maintenance: { count: jest.fn().mockResolvedValue(0) },
    };

    service = new DashboardService(prisma as PrismaService);
  });

  it('scopes manager dashboard counts to their region', async () => {
    await service.getSummary(manager);

    expect(prisma.customer.count.mock.calls[0][0]).toEqual({
      where: {
        AND: [{ regionId: 'region-north' }, {}],
      },
    });
    expect(prisma.machine.count.mock.calls[0][0]).toEqual({
      where: {
        AND: [
          {
            OR: [
              { customer: { regionId: 'region-north' } },
              { installedBy: { regionId: 'region-north' } },
              { primaryEngineer: { regionId: 'region-north' } },
            ],
          },
          {},
        ],
      },
    });
    expect(prisma.user.count.mock.calls[0][0]).toEqual({
      where: {
        AND: [{ regionId: 'region-north' }, {}],
      },
    });
  });

  it('scopes engineer dashboard counts to assigned or related work', async () => {
    await service.getSummary(engineer);

    expect(prisma.customer.count.mock.calls[0][0]).toEqual({
      where: {
        AND: [
          {
            machines: {
              some: {
                OR: [
                  { installedById: 'engineer-1' },
                  { primaryEngineerId: 'engineer-1' },
                  { repairs: { some: { engineerId: 'engineer-1' } } },
                  { maintenances: { some: { engineerId: 'engineer-1' } } },
                  {
                    installations: {
                      some: { installedById: 'engineer-1' },
                    },
                  },
                ],
              },
            },
          },
          {},
        ],
      },
    });
    expect(prisma.repair.count.mock.calls[0][0]).toEqual({
      where: {
        AND: [{ engineerId: 'engineer-1' }, {}],
      },
    });
    expect(prisma.user.count.mock.calls[0][0]).toEqual({
      where: {
        AND: [{ id: 'engineer-1' }, {}],
      },
    });
  });
});

import { MachineInventoryStatus } from '@prisma/client';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceServiceTicketsService } from './device-service-tickets.service';

describe('DeviceServiceTicketsService.create', () => {
  it('rejects an in-stock machine before changing its operational status', async () => {
    const admin: RequestUser = {
      id: 'admin-1',
      email: 'admin@example.test',
      roleId: 'role-admin',
      roleName: 'admin',
      regionId: 'region-1',
    };
    const prisma = {
      $transaction: jest.fn(),
      machine: { findFirst: jest.fn() },
    };
    prisma.machine.findFirst.mockResolvedValue({
      id: 'machine-1',
      inventoryStatus: MachineInventoryStatus.IN_STOCK,
    });
    const auditLogs = { create: jest.fn() };
    const service = new DeviceServiceTicketsService(
      prisma as unknown as PrismaService,
      auditLogs as never,
    );

    await expect(
      service.create({ machineId: 'machine-1' }, admin),
    ).rejects.toThrow('Only installed or returned machines can be received');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('scopes machine lookup before accepting a ticket from an engineer', async () => {
    const engineer: RequestUser = {
      id: 'engineer-1',
      email: 'engineer@example.test',
      roleId: 'role-engineer',
      roleName: 'engineer',
      regionId: 'region-1',
    };
    const prisma = {
      $transaction: jest.fn(),
      machine: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new DeviceServiceTicketsService(
      prisma as unknown as PrismaService,
      { create: jest.fn() } as never,
    );

    await expect(
      service.create({ machineId: 'foreign-machine' }, engineer),
    ).rejects.toThrow('outside your access');
    expect(prisma.machine.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { id: 'foreign-machine' },
            expect.objectContaining({ OR: expect.any(Array) }),
          ]),
        }),
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

import { BadRequestException } from '@nestjs/common';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersService } from './customers.service';

describe('CustomersService.remove', () => {
  const admin: RequestUser = {
    id: 'admin-1',
    email: 'admin@example.test',
    roleId: 'role-admin',
    roleName: 'admin',
    regionId: 'region-1',
  };

  it('preserves customer records referenced by operational history', async () => {
    const tx = { customer: { delete: jest.fn() } };
    const prisma = {
      customer: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'customer-1',
          customerCode: 'KH-001',
          name: 'Khách hàng thử',
          regionId: 'region-1',
          _count: {
            machines: 0,
            inventoryMovements: 0,
            machineInstallations: 0,
            demoLoans: 0,
            warrantyCards: 0,
            repairs: 0,
            maintenances: 0,
            deviceServiceTickets: 1,
            applicationSupportCases: 0,
            accessoryStockMovements: 0,
          },
        }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CustomersService(
      prisma as unknown as PrismaService,
      { create: jest.fn() } as never,
    );

    await expect(service.remove('customer-1', admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.customer.delete).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('CustomersService.create', () => {
  it('assigns a quick-created customer to the creating user region by default', async () => {
    const actor: RequestUser = {
      id: 'admin-1',
      email: 'admin@example.test',
      roleId: 'role-admin',
      roleName: 'admin',
      regionId: 'region-1',
    };
    const tx = {
      customer: {
        create: jest.fn().mockResolvedValue({
          id: 'customer-1',
          customerCode: 'KH-001',
          name: 'Bệnh viện thử',
          regionId: 'region-1',
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
      customer: { findUnique: jest.fn() },
      province: { findUnique: jest.fn() },
      user: { findFirst: jest.fn() },
    };
    const service = new CustomersService(
      prisma as unknown as PrismaService,
      { create: jest.fn() } as never,
    );

    await service.create(
      { customerCode: 'KH-001', name: 'Bệnh viện thử' },
      actor,
    );

    expect(tx.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ regionId: 'region-1' }),
      }),
    );
  });
});

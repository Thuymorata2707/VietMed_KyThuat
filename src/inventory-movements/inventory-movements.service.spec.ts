import { BadRequestException } from '@nestjs/common';
import {
  InventoryMovementType,
  MachineInventoryStatus,
  MachineStatus,
} from '@prisma/client';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryMovementsService } from './inventory-movements.service';

describe('InventoryMovementsService', () => {
  const actor: RequestUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    roleId: 'role-admin',
    roleName: 'admin',
    regionId: 'region-1',
  };

  let prisma: any;
  let service: InventoryMovementsService;

  beforeEach(() => {
    prisma = {
      machine: {
        findUnique: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
      },
      machineInventoryMovement: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    } as never;

    service = new InventoryMovementsService(prisma as PrismaService);
  });

  it('rejects selling an installed machine', async () => {
    prisma.machine.findUnique.mockResolvedValue({
      id: 'machine-1',
      inventoryStatus: MachineInventoryStatus.INSTALLED,
      customerId: 'customer-1',
    });

    await expect(
      service.create(
        {
          machineId: 'machine-1',
          type: InventoryMovementType.SELL,
          toStatus: MachineInventoryStatus.SOLD,
        },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('marks a sold machine inactive', async () => {
    const movement = {
      id: 'movement-1',
      occurredAt: new Date('2026-06-01T02:00:00.000Z'),
    };
    const tx = {
      machineInventoryMovement: {
        create: jest.fn().mockResolvedValue(movement),
      },
      machine: {
        update: jest.fn().mockResolvedValue({ id: 'machine-1' }),
      },
    };

    prisma.machine.findUnique.mockResolvedValue({
      id: 'machine-1',
      inventoryStatus: MachineInventoryStatus.IN_STOCK,
      customerId: null,
    });
    prisma.machineInventoryMovement.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation((callback: any) => callback(tx));

    await expect(
      service.create(
        {
          machineId: 'machine-1',
          type: InventoryMovementType.SELL,
          toStatus: MachineInventoryStatus.SOLD,
        },
        actor,
      ),
    ).resolves.toEqual(movement);

    expect(tx.machine.update).toHaveBeenCalledWith({
      where: { id: 'machine-1' },
      data: expect.objectContaining({
        inventoryStatus: MachineInventoryStatus.SOLD,
        status: MachineStatus.INACTIVE,
      }),
    });
  });

  it('requires a customer when installing through inventory movement', async () => {
    prisma.machine.findUnique.mockResolvedValue({
      id: 'machine-1',
      inventoryStatus: MachineInventoryStatus.IN_STOCK,
      customerId: null,
    });

    await expect(
      service.create(
        {
          machineId: 'machine-1',
          type: InventoryMovementType.INSTALL,
          toStatus: MachineInventoryStatus.INSTALLED,
        },
        actor,
      ),
    ).rejects.toThrow('customerId is required');
  });
});

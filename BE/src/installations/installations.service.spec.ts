import { BadRequestException } from '@nestjs/common';
import {
  InstallationStatus,
  InventoryMovementType,
  MachineInventoryStatus,
  MachineStatus,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { InstallationsService } from './installations.service';

describe('InstallationsService', () => {
  const actor: RequestUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    roleId: 'role-admin',
    roleName: 'admin',
    regionId: 'region-1',
  };

  let prisma: any;
  let auditLogsService: jest.Mocked<AuditLogsService>;
  let service: InstallationsService;

  beforeEach(() => {
    prisma = {
      machine: {
        findUnique: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      businessLine: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    } as never;

    auditLogsService = {
      create: jest.fn(),
    } as never;

    service = new InstallationsService(prisma, auditLogsService);
  });

  it('rejects machines that are already installed', async () => {
    prisma.machine.findUnique.mockResolvedValue({
      id: 'machine-1',
      inventoryStatus: MachineInventoryStatus.INSTALLED,
    });
    prisma.customer.findUnique.mockResolvedValue({ id: 'customer-1' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'engineer-1',
      status: 'ACTIVE',
      role: { name: 'engineer' },
    });
    prisma.businessLine.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        {
          machineId: 'machine-1',
          customerId: 'customer-1',
          installedAt: '2026-06-01T02:00:00.000Z',
          installedById: 'engineer-1',
          warrantyEndDate: '2027-06-01T02:00:00.000Z',
        },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates installation, warranty card, inventory movement, and updates machine', async () => {
    const machine = {
      id: 'machine-1',
      serialNumber: 'SN-001',
      businessLineId: 'line-1',
      primaryEngineerId: null,
      inventoryStatus: MachineInventoryStatus.IN_STOCK,
    };
    const customer = { id: 'customer-1' };
    const engineer = {
      id: 'engineer-1',
      fullName: 'Nguyen Van A',
      status: 'ACTIVE',
      role: { name: 'engineer' },
    };
    const createdInstallation = {
      id: 'installation-1',
      code: 'INS-20260601-0001',
      status: InstallationStatus.INSTALLED,
    };
    const returnedInstallation = {
      ...createdInstallation,
      warrantyCard: {
        id: 'warranty-1',
        code: 'WAR-20260601-0001',
      },
    };
    const tx = {
      machineInstallation: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(createdInstallation),
        findUnique: jest.fn().mockResolvedValue(returnedInstallation),
      },
      warrantyCard: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'warranty-1' }),
      },
      machineInventoryMovement: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'movement-1' }),
      },
      machine: {
        update: jest.fn().mockResolvedValue({ id: 'machine-1' }),
      },
    };

    prisma.machine.findUnique.mockResolvedValue(machine);
    prisma.customer.findUnique.mockResolvedValue(customer);
    prisma.user.findUnique.mockResolvedValue(engineer);
    prisma.businessLine.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation((callback: any) => callback(tx));

    await expect(
      service.create(
        {
          machineId: 'machine-1',
          customerId: 'customer-1',
          installedAt: '2026-06-01T02:00:00.000Z',
          installedById: 'engineer-1',
          accessories: [' Probe ', 'UPS', ''],
          warrantyEndDate: '2027-06-01T02:00:00.000Z',
        },
        actor,
      ),
    ).resolves.toEqual(returnedInstallation);

    expect(tx.machineInstallation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          machineId: 'machine-1',
          customerId: 'customer-1',
          businessLineId: 'line-1',
          installedById: 'engineer-1',
          accessories: ['Probe', 'UPS'],
        }),
      }),
    );
    expect(tx.warrantyCard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          installationId: 'installation-1',
          machineId: 'machine-1',
          customerId: 'customer-1',
          issuedById: actor.id,
          issuedByEmail: actor.email,
        }),
      }),
    );
    expect(tx.machineInventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: InventoryMovementType.INSTALL,
          fromStatus: MachineInventoryStatus.IN_STOCK,
          toStatus: MachineInventoryStatus.INSTALLED,
          customerId: 'customer-1',
        }),
      }),
    );
    expect(tx.machine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'machine-1' },
        data: expect.objectContaining({
          customerId: 'customer-1',
          installedById: 'engineer-1',
          primaryEngineerId: 'engineer-1',
          inventoryStatus: MachineInventoryStatus.INSTALLED,
          status: MachineStatus.ACTIVE,
        }),
      }),
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE_INSTALLATION',
        entityType: 'MachineInstallation',
        entityId: 'installation-1',
        actor,
      }),
      tx,
    );
  });
});

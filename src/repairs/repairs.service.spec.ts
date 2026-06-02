import { BadRequestException } from '@nestjs/common';
import {
  MachineInventoryStatus,
  MachineStatus,
  RepairStatus,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { RepairsService } from './repairs.service';

describe('RepairsService', () => {
  const actor: RequestUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    roleId: 'role-admin',
    roleName: 'admin',
    regionId: 'region-1',
  };

  let prisma: any;
  let auditLogsService: jest.Mocked<AuditLogsService>;
  let service: RepairsService;

  beforeEach(() => {
    prisma = {
      repair: {
        findFirst: jest.fn(),
      },
      machine: {
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    } as never;

    auditLogsService = {
      create: jest.fn(),
    } as never;

    service = new RepairsService(prisma, auditLogsService);
  });

  it('rejects invalid status transitions', async () => {
    prisma.repair.findFirst.mockResolvedValue({
      id: 'repair-1',
      machineId: 'machine-1',
      engineerId: null,
      status: RepairStatus.PENDING,
      resultNote: null,
      customerFeedback: null,
      machine: {
        inventoryStatus: MachineInventoryStatus.INSTALLED,
        customerId: 'customer-1',
      },
    } as never);

    await expect(
      service.updateStatus(
        'repair-1',
        { status: RepairStatus.COMPLETED },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires an engineer before starting repair work', async () => {
    prisma.repair.findFirst.mockResolvedValue({
      id: 'repair-1',
      machineId: 'machine-1',
      engineerId: null,
      status: RepairStatus.ASSIGNED,
      resultNote: null,
      customerFeedback: null,
      machine: {
        inventoryStatus: MachineInventoryStatus.INSTALLED,
        customerId: 'customer-1',
      },
    } as never);

    await expect(
      service.updateStatus(
        'repair-1',
        { status: RepairStatus.IN_PROGRESS },
        actor,
      ),
    ).rejects.toThrow('Repair must be assigned to an engineer first');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('starts an assigned repair, marks machine as repairing, and writes audit log', async () => {
    const repair = {
      id: 'repair-1',
      machineId: 'machine-1',
      engineerId: 'engineer-1',
      status: RepairStatus.ASSIGNED,
      startedAt: null,
      resultNote: null,
      customerFeedback: null,
      machine: {
        inventoryStatus: MachineInventoryStatus.INSTALLED,
        customerId: 'customer-1',
      },
    };
    const updated = {
      ...repair,
      status: RepairStatus.IN_PROGRESS,
      startedAt: new Date('2026-06-01T02:00:00.000Z'),
    };
    const tx = {
      repair: {
        update: jest.fn().mockResolvedValue(updated),
      },
      machine: {
        update: jest.fn().mockResolvedValue({ id: 'machine-1' }),
      },
    };

    prisma.repair.findFirst.mockResolvedValue(repair as never);
    prisma.$transaction.mockImplementation((callback: any) =>
      callback(tx),
    );

    await expect(
      service.updateStatus(
        'repair-1',
        { status: RepairStatus.IN_PROGRESS },
        actor,
      ),
    ).resolves.toEqual(updated);

    expect(tx.repair.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'repair-1' },
        data: expect.objectContaining({
          status: RepairStatus.IN_PROGRESS,
          startedAt: expect.any(Date),
        }),
      }),
    );
    expect(tx.machine.update).toHaveBeenCalledWith({
      where: { id: 'machine-1' },
      data: { status: MachineStatus.REPAIRING },
    });
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STATUS_CHANGE',
        entityType: 'Repair',
        entityId: 'repair-1',
        actor,
        metadata: { machineStatus: MachineStatus.REPAIRING },
      }),
      tx,
    );
  });
});

import { BadRequestException } from '@nestjs/common';
import {
  MachineInventoryStatus,
  MachineStatus,
  MaintenanceStatus,
} from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService', () => {
  const actor: RequestUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    roleId: 'role-admin',
    roleName: 'admin',
    regionId: 'region-1',
  };

  let prisma: any;
  let auditLogsService: jest.Mocked<AuditLogsService>;
  let service: MaintenanceService;

  beforeEach(() => {
    prisma = {
      maintenance: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    } as never;

    auditLogsService = {
      create: jest.fn(),
    } as never;

    service = new MaintenanceService(prisma, auditLogsService);
  });

  it('rejects invalid status transitions', async () => {
    prisma.maintenance.findFirst.mockResolvedValue({
      id: 'maintenance-1',
      machineId: 'machine-1',
      engineerId: null,
      status: MaintenanceStatus.SCHEDULED,
      resultNote: null,
      nextDueDate: null,
      machine: {
        inventoryStatus: MachineInventoryStatus.INSTALLED,
        customerId: 'customer-1',
      },
    } as never);

    await expect(
      service.updateStatus(
        'maintenance-1',
        { status: MaintenanceStatus.COMPLETED },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires an engineer before starting maintenance work', async () => {
    prisma.maintenance.findFirst.mockResolvedValue({
      id: 'maintenance-1',
      machineId: 'machine-1',
      engineerId: null,
      status: MaintenanceStatus.OVERDUE,
      resultNote: null,
      nextDueDate: null,
      machine: {
        inventoryStatus: MachineInventoryStatus.INSTALLED,
        customerId: 'customer-1',
      },
    } as never);

    await expect(
      service.updateStatus(
        'maintenance-1',
        { status: MaintenanceStatus.IN_PROGRESS },
        actor,
      ),
    ).rejects.toThrow('Maintenance must be assigned to an engineer first');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('starts assigned maintenance, marks machine as maintenance, and writes audit log', async () => {
    const maintenance = {
      id: 'maintenance-1',
      machineId: 'machine-1',
      engineerId: 'engineer-1',
      status: MaintenanceStatus.ASSIGNED,
      startedAt: null,
      resultNote: null,
      nextDueDate: null,
      machine: {
        inventoryStatus: MachineInventoryStatus.INSTALLED,
        customerId: 'customer-1',
      },
    };
    const updated = {
      ...maintenance,
      status: MaintenanceStatus.IN_PROGRESS,
      startedAt: new Date('2026-06-01T02:00:00.000Z'),
    };
    const tx = {
      maintenance: {
        update: jest.fn().mockResolvedValue(updated),
      },
      machine: {
        update: jest.fn().mockResolvedValue({ id: 'machine-1' }),
      },
    };

    prisma.maintenance.findFirst.mockResolvedValue(maintenance as never);
    prisma.$transaction.mockImplementation((callback: any) =>
      callback(tx),
    );

    await expect(
      service.updateStatus(
        'maintenance-1',
        { status: MaintenanceStatus.IN_PROGRESS },
        actor,
      ),
    ).resolves.toEqual(updated);

    expect(tx.maintenance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'maintenance-1' },
        data: expect.objectContaining({
          status: MaintenanceStatus.IN_PROGRESS,
          startedAt: expect.any(Date),
        }),
      }),
    );
    expect(tx.machine.update).toHaveBeenCalledWith({
      where: { id: 'machine-1' },
      data: { status: MachineStatus.MAINTENANCE },
    });
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STATUS_CHANGE',
        entityType: 'Maintenance',
        entityId: 'maintenance-1',
        actor,
        metadata: { machineStatus: MachineStatus.MAINTENANCE },
      }),
      tx,
    );
  });
});

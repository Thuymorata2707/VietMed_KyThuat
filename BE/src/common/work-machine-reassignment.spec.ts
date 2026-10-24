import {
  MachineInventoryStatus,
  MachineStatus,
  MaintenanceStatus,
  RepairStatus,
} from '@prisma/client';
import { reconcileMachineStatusFromOpenWork } from './machine-work-status';
import { RequestUser } from './request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RepairsService } from '../repairs/repairs.service';
import { MaintenanceService } from '../maintenance/maintenance.service';

jest.mock('./machine-work-status', () => ({
  reconcileMachineStatusFromOpenWork: jest.fn(),
}));

const reconcileMachineStatusMock = jest.mocked(
  reconcileMachineStatusFromOpenWork,
);

const admin: RequestUser = {
  id: 'admin-1',
  email: 'admin@example.test',
  roleId: 'role-admin',
  roleName: 'admin',
  regionId: 'region-1',
};

describe('work ticket machine reassignment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reconcileMachineStatusMock.mockResolvedValue(MachineStatus.ACTIVE);
  });

  it('reconciles the previous machine when a repair is moved to another machine', async () => {
    const current = {
      id: 'repair-1',
      status: RepairStatus.ASSIGNED,
      machineId: 'machine-1',
      customerId: 'customer-1',
      engineerId: 'engineer-1',
      machine: {
        id: 'machine-1',
        inventoryStatus: MachineInventoryStatus.INSTALLED,
        customerId: 'customer-1',
      },
    };
    const nextMachine = {
      id: 'machine-2',
      inventoryStatus: MachineInventoryStatus.INSTALLED,
      customerId: 'customer-1',
    };
    const updated = {
      ...current,
      status: RepairStatus.IN_PROGRESS,
      machineId: nextMachine.id,
      machine: nextMachine,
    };
    const tx = {
      repair: {
        update: jest.fn().mockResolvedValue(updated),
        findUnique: jest.fn().mockResolvedValue(updated),
      },
      machine: { update: jest.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      $transaction: jest.fn((work: (transaction: typeof tx) => unknown) =>
        work(tx),
      ),
    };
    const auditLogs = { create: jest.fn() };
    const notifications = { create: jest.fn() };
    const service = new RepairsService(
      prisma as unknown as PrismaService,
      auditLogs as unknown as AuditLogsService,
      notifications as unknown as NotificationsService,
    );
    jest.spyOn(service, 'findOne').mockResolvedValue(current as never);
    jest
      .spyOn(service as never, 'ensureMachineExists' as never)
      .mockResolvedValue(nextMachine as never);
    jest
      .spyOn(service as never, 'resolveTicketCustomerId' as never)
      .mockResolvedValue('customer-1' as never);
    jest
      .spyOn(service as never, 'ensureEngineerExists' as never)
      .mockResolvedValue(undefined as never);

    await service.update(
      current.id,
      { machineId: nextMachine.id, status: RepairStatus.IN_PROGRESS },
      admin,
    );

    expect(reconcileMachineStatusMock).toHaveBeenCalledWith(
      tx,
      current.machine.id,
      MachineInventoryStatus.INSTALLED,
    );
    expect(tx.machine.update).toHaveBeenCalledWith({
      where: { id: nextMachine.id },
      data: { status: MachineStatus.REPAIRING },
    });
  });

  it('reconciles the previous machine when a maintenance ticket is moved', async () => {
    const current = {
      id: 'maintenance-1',
      status: MaintenanceStatus.ASSIGNED,
      machineId: 'machine-1',
      customerId: 'customer-1',
      engineerId: 'engineer-1',
      machine: {
        id: 'machine-1',
        inventoryStatus: MachineInventoryStatus.INSTALLED,
        customerId: 'customer-1',
      },
    };
    const nextMachine = {
      id: 'machine-2',
      inventoryStatus: MachineInventoryStatus.INSTALLED,
      customerId: 'customer-1',
    };
    const updated = {
      ...current,
      status: MaintenanceStatus.IN_PROGRESS,
      machineId: nextMachine.id,
      machine: nextMachine,
    };
    const tx = {
      maintenance: { update: jest.fn().mockResolvedValue(updated) },
      machine: { update: jest.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      $transaction: jest.fn((work: (transaction: typeof tx) => unknown) =>
        work(tx),
      ),
    };
    const auditLogs = { create: jest.fn() };
    const notifications = { create: jest.fn() };
    const service = new MaintenanceService(
      prisma as unknown as PrismaService,
      auditLogs as unknown as AuditLogsService,
      notifications as unknown as NotificationsService,
    );
    jest.spyOn(service, 'findOne').mockResolvedValue(current as never);
    jest
      .spyOn(service as never, 'ensureMachineExists' as never)
      .mockResolvedValue(nextMachine as never);
    jest
      .spyOn(service as never, 'resolveTicketCustomerId' as never)
      .mockResolvedValue('customer-1' as never);
    jest
      .spyOn(service as never, 'ensureEngineerExists' as never)
      .mockResolvedValue(undefined as never);

    await service.update(
      current.id,
      {
        machineId: nextMachine.id,
        status: MaintenanceStatus.IN_PROGRESS,
      },
      admin,
    );

    expect(reconcileMachineStatusMock).toHaveBeenCalledWith(
      tx,
      current.machine.id,
      MachineInventoryStatus.INSTALLED,
    );
    expect(tx.machine.update).toHaveBeenCalledWith({
      where: { id: nextMachine.id },
      data: { status: MachineStatus.MAINTENANCE },
    });
  });
});

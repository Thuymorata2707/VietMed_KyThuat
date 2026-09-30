import {
  InstallationStatus,
  MachineInventoryStatus,
  WorkReviewStatus,
} from '@prisma/client';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { InstallationsService } from './installations.service';

describe('InstallationsService.review', () => {
  it('routes approval through the idempotent completion path to reconcile older tickets', async () => {
    const actor: RequestUser = {
      id: 'admin-1',
      email: 'admin@example.test',
      roleId: 'role-admin',
      roleName: 'admin',
      regionId: 'region-1',
    };
    const installation = {
      id: 'installation-1',
      code: 'LD-001',
      reviewStatus: WorkReviewStatus.PENDING,
      reviewNote: null,
      installedById: 'engineer-1',
    };
    const reviewed = {
      ...installation,
      reviewStatus: WorkReviewStatus.APPROVED,
      reviewNote: null,
    };
    const prisma = { $transaction: jest.fn() };
    const auditLogs = { create: jest.fn() };
    const notifications = { create: jest.fn().mockResolvedValue(undefined) };
    const machines = {};
    const service = new InstallationsService(
      prisma as unknown as PrismaService,
      auditLogs as never,
      notifications as never,
      machines as never,
    );
    jest.spyOn(service, 'findOne').mockResolvedValue(installation as never);
    const update = jest
      .spyOn(service, 'update')
      .mockResolvedValue(reviewed as never);

    await service.review(
      'installation-1',
      { status: WorkReviewStatus.APPROVED },
      actor,
    );

    expect(update).toHaveBeenCalledWith(
      'installation-1',
      expect.objectContaining({ status: 'INSTALLED' }),
      actor,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(auditLogs.create).not.toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledTimes(1);
  });

  it('does not repeat machine and inventory effects when approving an engineer-completed installation', async () => {
    const actor: RequestUser = {
      id: 'admin-1',
      email: 'admin@example.test',
      roleId: 'role-admin',
      roleName: 'admin',
      regionId: 'region-1',
    };
    const installation = {
      id: 'installation-1',
      code: 'LD-001',
      status: InstallationStatus.INSTALLED,
      reviewStatus: WorkReviewStatus.PENDING,
      reviewNote: null,
      installedById: 'engineer-1',
      installedAt: new Date('2026-06-03T02:00:00.000Z'),
      machineId: 'machine-1',
      machine: {
        id: 'machine-1',
        inventoryStatus: MachineInventoryStatus.INSTALLED,
      },
      warrantyStartDate: null,
      warrantyEndDate: null,
      warrantyCard: null,
      warrantyNote: null,
      assignments: [{ engineerId: 'engineer-1' }],
    };
    const reviewed = {
      ...installation,
      reviewStatus: WorkReviewStatus.APPROVED,
      reviewerId: actor.id,
    };
    const tx = {
      machineInstallation: { update: jest.fn().mockResolvedValue(reviewed) },
      machine: {
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      machineInventoryMovement: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((work: (transaction: typeof tx) => unknown) =>
        work(tx),
      ),
    };
    const auditLogs = { create: jest.fn() };
    const notifications = { create: jest.fn().mockResolvedValue(undefined) };
    const service = new InstallationsService(
      prisma as unknown as PrismaService,
      auditLogs as never,
      notifications as never,
      {} as never,
    );
    jest.spyOn(service, 'findOne').mockResolvedValue(installation as never);
    jest
      .spyOn(service as never, 'resolveActualInstallationMachine' as never)
      .mockResolvedValue(installation.machine as never);

    await service.review(
      installation.id,
      { status: WorkReviewStatus.APPROVED },
      actor,
    );

    expect(tx.machine.updateMany).not.toHaveBeenCalled();
    expect(tx.machineInventoryMovement.create).not.toHaveBeenCalled();
    expect(tx.machine.update).not.toHaveBeenCalled();
    expect(tx.machineInstallation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: installation.id },
        data: expect.objectContaining({
          status: InstallationStatus.INSTALLED,
          reviewStatus: WorkReviewStatus.APPROVED,
          reviewerId: actor.id,
        }),
      }),
    );
  });
});

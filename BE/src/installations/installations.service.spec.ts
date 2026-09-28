import { WorkReviewStatus } from '@prisma/client';
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
});

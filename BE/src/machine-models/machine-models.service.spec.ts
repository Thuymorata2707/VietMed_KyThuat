import { BadRequestException } from '@nestjs/common';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { MachineModelsService } from './machine-models.service';
import { describe } from 'node:test';

describe('MachineModelsService.remove', () => {
  const admin: RequestUser = {
    id: 'admin-1',
    email: 'admin@example.test',
    roleId: 'role-admin',
    roleName: 'admin',
    regionId: 'region-1',
  };

  function setup(counts: Record<string, number>) {
    const tx = {
      machineModel: { delete: jest.fn().mockResolvedValue({ id: 'model-1' }) },
    };
    const prisma = {
      machineModel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'model-1',
          code: 'MODEL-1',
          name: 'Model thử',
          businessLineId: 'line-1',
          _count: counts,
        }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const auditLogs = { create: jest.fn().mockResolvedValue(undefined) };
    const service = new MachineModelsService(
      prisma as unknown as PrismaService,
      auditLogs as never,
    );
    return { auditLogs, prisma, service, tx };
  }

  it('blocks deletion if linked accessory templates would be removed', async () => {
    const { prisma, service, tx } = setup({
      machines: 0,
      components: 1,
      componentAccessories: 2,
      plannedInstallations: 0,
      applicationSupportCases: 0,
    });

    await expect(service.remove('model-1', admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.machineModel.delete).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deletes an unused model and writes its audit entry', async () => {
    const { auditLogs, service, tx } = setup({
      machines: 0,
      components: 0,
      componentAccessories: 0,
      plannedInstallations: 0,
      applicationSupportCases: 0,
    });

    await expect(service.remove('model-1', admin)).resolves.toEqual({
      deleted: true,
    });
    expect(tx.machineModel.delete).toHaveBeenCalledWith({
      where: { id: 'model-1' },
    });
    expect(auditLogs.create).toHaveBeenCalled();
  });
});

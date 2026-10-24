import { DemoLoanStatus, MachineInventoryStatus } from '@prisma/client';
import { RequestUser } from '../common/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { DemoLoansService } from './demo-loans.service';

describe('DemoLoansService operational guards', () => {
  const admin: RequestUser = {
    id: 'admin-1',
    email: 'admin@example.test',
    roleId: 'role-admin',
    roleName: 'admin',
    regionId: 'region-1',
  };

  function createService() {
    const prisma = { $transaction: jest.fn() };
    const auditLogs = { create: jest.fn() };
    const service = new DemoLoansService(
      prisma as unknown as PrismaService,
      auditLogs as never,
    );
    return { prisma, service };
  }

  it('does not cancel a loan after the demo machine has been handed over', async () => {
    const { prisma, service } = createService();
    jest.spyOn(service, 'findOne').mockResolvedValue({
      id: 'loan-1',
      status: DemoLoanStatus.HANDED_OVER,
      machineId: 'machine-1',
    } as never);

    await expect(service.cancel('loan-1', admin)).rejects.toThrow(
      'Only planned demo loans can be cancelled',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not delete a loan while its machine is with a customer', async () => {
    const { prisma, service } = createService();
    jest.spyOn(service, 'findOne').mockResolvedValue({
      id: 'loan-1',
      code: 'DEMO-001',
      status: DemoLoanStatus.OVERDUE,
      machineId: 'machine-1',
      machine: { inventoryStatus: MachineInventoryStatus.RESERVED },
    } as never);

    await expect(service.remove('loan-1', admin)).rejects.toThrow(
      'Only planned demo loans can be cancelled; return a handed-over machine instead',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires a planned demo loan to be cancelled instead of returned', async () => {
    const { prisma, service } = createService();
    jest.spyOn(service, 'findOne').mockResolvedValue({
      id: 'loan-1',
      status: DemoLoanStatus.PLANNED,
      engineerId: 'engineer-1',
    } as never);

    await expect(service.returnLoan('loan-1', {}, admin)).rejects.toThrow(
      'cancel planned loans instead',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

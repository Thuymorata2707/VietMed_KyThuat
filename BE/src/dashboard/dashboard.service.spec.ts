import { DashboardService } from './dashboard.service';

describe('DashboardService.getSummary', () => {
  it('derives dashboard status totals from grouped queries', async () => {
    const count = jest.fn().mockResolvedValue(1);
    const groupByFor = (values: Record<string, string>) =>
      jest.fn(({ by }: { by: string[] }) => {
        const field = by[0];
        return Promise.resolve([
          { [field]: values[field] ?? 'ACTIVE', _count: { _all: 1 } },
        ]);
      });
    const prisma = {
      customer: {
        count,
        groupBy: groupByFor({ customerType: 'OTHER' }),
      },
      businessLine: { count, groupBy: groupByFor({}) },
      machineInventoryMovement: { count },
      machine: {
        count,
        groupBy: groupByFor({
          inventoryStatus: 'RETURNED',
          productCategory: 'OTHER',
          dataStatus: 'PENDING_REVIEW',
        }),
      },
      user: { count },
      repair: { count, groupBy: groupByFor({ status: 'PENDING' }) },
      maintenance: { count, groupBy: groupByFor({ status: 'SCHEDULED' }) },
      machineInstallation: { count },
      demoLoan: { count },
      deviceServiceTicket: { count },
    };
    const service = new DashboardService(prisma as never);

    const summary = await service.getSummary();
    expect(
      prisma.machine.groupBy.mock.calls.some(
        ([query]) => query.by[0] === 'inventoryStatus',
      ),
    ).toBe(true);
    expect(summary.returnedMachines).toBe(
      summary.machineInventoryStatusCounts.RETURNED,
    );
    expect(summary.openInstallations).toBe(1);
    expect(summary.openDemoLoans).toBe(1);
    expect(summary.openDeviceServiceTickets).toBe(1);
    expect(summary.openMaintenances).toBe(1);
    expect(prisma.machine.count).toHaveBeenCalledWith({
      where: { AND: [{}, { dataStatus: { not: 'VERIFIED' } }] },
    });
    expect(
      prisma.machine.groupBy.mock.calls.some(
        ([query]) => query.by[0] === 'dataStatus',
      ),
    ).toBe(true);
    expect(prisma.machineInstallation.count).toHaveBeenCalledWith({
      where: { AND: [{}, { status: 'PENDING' }] },
    });
    expect(prisma.demoLoan.count).toHaveBeenCalledWith({
      where: {
        AND: [{}, { status: { in: ['PLANNED', 'HANDED_OVER', 'OVERDUE'] } }],
      },
    });
  });
});

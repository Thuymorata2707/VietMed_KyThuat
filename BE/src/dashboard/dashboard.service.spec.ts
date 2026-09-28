import { DashboardService } from './dashboard.service';

describe('DashboardService.getSummary', () => {
  it('reuses the returned-machine count instead of issuing the same COUNT twice', async () => {
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      customer: { count },
      businessLine: { count },
      machineInventoryMovement: { count },
      machine: { count },
      user: { count },
      repair: { count },
      maintenance: { count },
      machineInstallation: { count },
      demoLoan: { count },
      deviceServiceTicket: { count },
    };
    const service = new DashboardService(prisma as never);

    const summary = await service.getSummary();
    const returnedMachineCounts = prisma.machine.count.mock.calls.filter(
      ([query]) =>
        JSON.stringify(query.where) ===
        JSON.stringify({ AND: [{}, { inventoryStatus: 'RETURNED' }] }),
    );

    expect(returnedMachineCounts).toHaveLength(1);
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
    expect(prisma.machine.count).toHaveBeenCalledWith({
      where: { AND: [{}, { dataStatus: 'PENDING_REVIEW' }] },
    });
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

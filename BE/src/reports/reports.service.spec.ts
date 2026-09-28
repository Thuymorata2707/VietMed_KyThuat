import { ReportsService } from './reports.service';

describe('ReportsService report aggregates', () => {
  const service = new ReportsService({} as never);

  it('does not count missing installation relations as real entities', () => {
    const rows = [
      {
        id: 'i-1',
        installedAt: new Date('2026-09-01T00:00:00Z'),
        customerId: null,
        machineId: null,
        installedById: null,
        customer: { province: null },
      },
      {
        id: 'i-2',
        installedAt: new Date('2026-09-02T00:00:00Z'),
        customerId: 'c-1',
        machineId: 'm-1',
        installedById: 'u-1',
        customer: { province: 'Hà Nội' },
      },
    ];

    const grouped = (service as any).groupInstallations(
      rows,
      () => ({ id: 'all', label: 'Tất cả' }),
    );

    expect(grouped[0]).toMatchObject({
      count: 2,
      customers: 1,
      machines: 1,
      engineers: 1,
      provinces: 1,
    });
  });

  it('keeps unlinked work in an explicit non-machine bucket', () => {
    const rows = [
      { id: 'r-1', kind: 'repair', date: new Date(), machineId: null, serialNumber: '-', machineCode: '-', customerId: null, customer: 'Chưa có khách hàng', province: 'Chưa có tỉnh' },
      { id: 'r-2', kind: 'repair', date: new Date(), machineId: null, serialNumber: '-', machineCode: '-', customerId: null, customer: 'Chưa có khách hàng', province: 'Chưa có tỉnh' },
    ];

    const groups = (service as any).buildTechnicalMachineGroups(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: '__no_machine__',
      machineCode: 'Chưa có máy liên kết',
      total: 2,
    });
  });

  it('classifies device receive/return tickets separately from repairs', () => {
    const row = (service as any).deviceServiceTicketToWorkRow({
      id: 'ds-1',
      code: 'DS-001',
      status: 'RECEIVED',
      receivedAt: new Date('2026-09-01T00:00:00Z'),
      customer: null,
      machine: null,
      engineer: null,
    });

    expect(row.kind).toBe('deviceService');
  });
});

import { RepairsService } from '../repairs/repairs.service';
import { DeviceServiceTicketsService } from '../device-service-tickets/device-service-tickets.service';

// These cases exercise the actual service generators against legacy records.
describe('Legacy ticket numbering regressions', () => {
  const date = new Date(2026, 8, 23, 12);

  function clientFor(codes: string[], field = 'code') {
    const delegate = {
      findFirst: jest.fn(async () => ({ [field]: [...codes].sort().at(-1) })),
      count: jest.fn(async () => codes.length),
    };
    return {
      repair: delegate,
      deviceServiceTicket: delegate,
      $executeRaw: jest.fn(async () => 1),
      $queryRaw: jest.fn(async (sql: { text: string }) => {
        if (!sql.text.includes('MAX(')) return [{ value: 0n }];
        const numbers = codes.map(code => code.split('-').at(-1)!)
          .filter(suffix => /^\d+$/.test(suffix)).map(Number);
        return [{ value: BigInt(Math.max(0, ...numbers)) }];
      }),
    };
  }

  it('continues past 999 using the numeric suffix', async () => {
    const client = clientFor(['SC-230926-999', 'SC-230926-1000']);
    const service = new RepairsService(client as any, {} as any, {} as any);
    await expect((service as any).generateRepairCode(client, date))
      .resolves.toBe('SC-230926-1001');
  });

  it('ignores malformed legacy suffixes instead of restarting at 001', async () => {
    const client = clientFor(['SC-230926-001', 'SC-230926-XYZ']);
    const service = new RepairsService(client as any, {} as any, {} as any);
    await expect((service as any).generateRepairCode(client, date))
      .resolves.toBe('SC-230926-002');
  });

  it('does not reuse an existing receipt after a previous receipt was deleted', async () => {
    const client = clientFor(['PNTB-230926-001', 'PNTB-230926-003'], 'receiveCode');
    const service = Object.create(DeviceServiceTicketsService.prototype);
    await expect(service.generateCode(client, 'PNTB', date, 'receiveCode'))
      .resolves.toBe('PNTB-230926-004');
  });
});

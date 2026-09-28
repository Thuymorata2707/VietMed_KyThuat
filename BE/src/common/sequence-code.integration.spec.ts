import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as mariadb from 'mariadb';
import { config } from 'dotenv';
import { sequenceCode } from './sequence-code';
import { RepairsService } from '../repairs/repairs.service';
import { DeviceServiceTicketsService } from '../device-service-tickets/device-service-tickets.service';

const enabled = process.env.RUN_SEQUENCE_DB_TESTS === 'true';

(enabled ? describe : describe.skip)('Code sequences on isolated MySQL database', () => {
  let admin: mariadb.Connection;
  let prisma: PrismaClient;
  let createdDatabase = false;
  const database = `vietmed_code_test_${process.pid}_${Date.now()}`;

  beforeAll(async () => {
    config({ quiet: true });
    const url = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL!);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
      throw new Error('These integration tests only use a local MySQL server');
    }
    const connection = {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      allowPublicKeyRetrieval: true,
    };
    admin = await mariadb.createConnection(connection);
    await admin.query(`CREATE DATABASE \`${database}\``);
    createdDatabase = true;
    prisma = new PrismaClient({ adapter: new PrismaMariaDb({ ...connection, database, connectionLimit: 12 }) });
    await prisma.$executeRawUnsafe('CREATE TABLE CodeSequence (scope VARCHAR(191) PRIMARY KEY, value BIGINT NOT NULL DEFAULT 0)');
    for (const table of ['Repair', 'Maintenance', 'MachineInstallation', 'MachineInventoryMovement', 'WarrantyCard', 'DemoLoan', 'AccessoryStockMovement']) {
      await prisma.$executeRawUnsafe(`CREATE TABLE \`${table}\` (code VARCHAR(191) PRIMARY KEY)`);
    }
    await prisma.$executeRawUnsafe('CREATE TABLE DeviceServiceTicket (receiveCode VARCHAR(191) PRIMARY KEY, returnCode VARCHAR(191) UNIQUE)');
  }, 30_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (admin) {
      // Only the database created by this exact test run is removed.
      try {
        if (createdDatabase) await admin.query(`DROP DATABASE \`${database}\``);
      } finally {
        await admin.end();
      }
    }
  });

  it('actual repair generator handles 999, 1000 and a malformed legacy code', async () => {
    await prisma.$executeRaw`INSERT INTO Repair (code) VALUES ('SC-230926-999'), ('SC-230926-1000'), ('SC-230926-XYZ')`;
    const service = new RepairsService(prisma as any, {} as any, {} as any);
    const code = await prisma.$transaction(tx => (service as any).generateRepairCode(tx, new Date(2026, 8, 23, 12)));
    expect(code).toBe('SC-230926-1001');
  });

  it('actual receipt generator survives a deletion gap', async () => {
    await prisma.$executeRaw`INSERT INTO DeviceServiceTicket (receiveCode) VALUES ('PNTB-230926-001'), ('PNTB-230926-003')`;
    const service = Object.create(DeviceServiceTicketsService.prototype);
    service.prisma = prisma;
    const code = await prisma.$transaction(tx => service.generateCode(tx, 'PNTB', new Date(2026, 8, 23, 12), 'receiveCode'));
    expect(code).toBe('PNTB-230926-004');
  });

  it('allocates distinct inventory codes under simultaneous transactions', async () => {
    const codes = await Promise.all(Array.from({ length: 20 }, () => prisma.$transaction(async tx => {
      const code = await sequenceCode(tx, 'inventory', 'INV-20260923', 4);
      await tx.$executeRaw`INSERT INTO MachineInventoryMovement (code) VALUES (${code})`;
      return code;
    }, { maxWait: 20_000, timeout: 20_000 })));
    expect(new Set(codes).size).toBe(20);
    expect(codes.sort()).toEqual(Array.from({ length: 20 }, (_, i) => `INV-20260923-${String(i + 1).padStart(4, '0')}`));
  }, 30_000);

  it('preview does not reserve numbers and saving allocates the current number', async () => {
    const first = await sequenceCode(prisma, 'maintenance', 'BT-PREVIEW', 3, true);
    expect(first).toBe('BT-PREVIEW-001');
    expect(await sequenceCode(prisma, 'maintenance', 'BT-PREVIEW', 3, true)).toBe(first);
    expect(await sequenceCode(prisma, 'maintenance', 'BT-PREVIEW')).toBe(first);
    expect(await sequenceCode(prisma, 'maintenance', 'BT-PREVIEW')).toBe('BT-PREVIEW-002');
  });

  it('rolls the reservation back with a failed business transaction', async () => {
    await expect(prisma.$transaction(async tx => {
      await sequenceCode(tx, 'warranty', 'WAR-ROLLBACK', 4);
      throw new Error('business transaction failed');
    })).rejects.toThrow('business transaction failed');
    expect(await sequenceCode(prisma, 'warranty', 'WAR-ROLLBACK', 4)).toBe('WAR-ROLLBACK-0001');
  });

  it('does not reuse the highest number after its record is deleted', async () => {
    const code = await prisma.$transaction(async tx => {
      const allocated = await sequenceCode(tx, 'demo', 'DM-DELETE', 4);
      await tx.$executeRaw`INSERT INTO DemoLoan (code) VALUES (${allocated})`;
      return allocated;
    });
    await prisma.$executeRaw`DELETE FROM DemoLoan WHERE code = ${code}`;
    expect(await sequenceCode(prisma, 'demo', 'DM-DELETE', 4)).toBe('DM-DELETE-0002');
  });

  it('accepts later imported higher codes without resetting the counter', async () => {
    expect(await sequenceCode(prisma, 'repair', 'SC-IMPORT')).toBe('SC-IMPORT-001');
    await prisma.$executeRaw`INSERT INTO Repair (code) VALUES ('SC-IMPORT-1100'), ('SC-IMPORT-BAD')`;
    expect(await sequenceCode(prisma, 'repair', 'SC-IMPORT')).toBe('SC-IMPORT-1101');
  });
});

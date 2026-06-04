import { MachineInventoryStatus, MachineProductCategory } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { MachinesService } from './machines.service';

describe('MachinesService', () => {
  let prisma: any;
  let auditLogsService: jest.Mocked<AuditLogsService>;
  let service: MachinesService;

  beforeEach(() => {
    prisma = {
      machine: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      machineModel: {
        findUnique: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      businessLine: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    } as never;

    auditLogsService = {
      create: jest.fn(),
    } as never;

    service = new MachinesService(
      prisma as PrismaService,
      auditLogsService,
    );
  });

  it('finds machine detail by serial number', async () => {
    const machine = {
      id: 'machine-1',
      serialNumber: 'XCUBE-001',
      modelName: 'XCube 70',
    };

    prisma.machine.findFirst.mockResolvedValue(machine);

    await expect(service.findBySerialNumber('xcube-001')).resolves.toEqual(
      machine,
    );

    expect(prisma.machine.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              serialNumber: 'XCUBE-001',
            }),
          ]),
        }),
      }),
    );
  });

  it('creates a machine from selected machine model', async () => {
    const machineModel = {
      id: 'model-1',
      name: 'XCube 70',
      manufacturer: 'Alpinion',
      productCategory: MachineProductCategory.ULTRASOUND,
      productLine: 'XCube',
      status: 'ACTIVE',
      businessLineId: 'line-1',
      businessLine: {
        id: 'line-1',
      },
    };
    const created = {
      id: 'machine-1',
      serialNumber: 'XCUBE-001',
      modelName: 'XCube 70',
    };

    prisma.machineModel.findUnique.mockResolvedValue(machineModel);
    prisma.machine.findUnique.mockResolvedValue(null);
    prisma.businessLine.findUnique.mockResolvedValue({ id: 'line-1' });
    const tx = {
      machine: {
        create: jest.fn().mockResolvedValue(created),
      },
    };

    prisma.$transaction.mockImplementation((callback: any) => callback(tx));

    await expect(
      service.create({
        serialNumber: 'xcube-001',
        machineModelId: 'model-1',
      }),
    ).resolves.toEqual(created);

    expect(tx.machine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serialNumber: 'XCUBE-001',
          modelName: 'XCube 70',
          manufacturer: 'Alpinion',
          productCategory: MachineProductCategory.ULTRASOUND,
          productLine: 'XCube',
          businessLineId: 'line-1',
          machineModelId: 'model-1',
          inventoryStatus: MachineInventoryStatus.IN_STOCK,
        }),
      }),
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entityType: 'Machine',
        entityId: 'machine-1',
      }),
      tx,
    );
  });
});

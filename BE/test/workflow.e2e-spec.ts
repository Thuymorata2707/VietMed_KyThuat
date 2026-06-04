import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AttachmentType,
  InventoryMovementType,
  MachineInventoryStatus,
  RepairPriority,
  RepairStatus,
} from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const runWorkflowE2e = process.env.RUN_WORKFLOW_E2E === 'true';

(runWorkflowE2e ? describe : describe.skip)('Main workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  const suffix = Date.now();
  const machineCode = `E2E-M-${suffix}`;
  const serialNumber = `E2E-SN-${suffix}`;
  const createdIds: Record<string, string | undefined> = {};

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdIds.attachmentId) {
      await prisma.attachment.deleteMany({
        where: { id: createdIds.attachmentId },
      });
    }
    if (createdIds.repairId) {
      await prisma.repair.deleteMany({ where: { id: createdIds.repairId } });
    }
    if (createdIds.installationId) {
      await prisma.warrantyCard.deleteMany({
        where: { installationId: createdIds.installationId },
      });
      await prisma.machineInstallation.deleteMany({
        where: { id: createdIds.installationId },
      });
    }
    if (createdIds.machineId) {
      await prisma.machineInventoryMovement.deleteMany({
        where: { machineId: createdIds.machineId },
      });
      await prisma.auditLog.deleteMany({
        where: { entityId: createdIds.machineId },
      });
      await prisma.machine.deleteMany({ where: { id: createdIds.machineId } });
    }

    await app.close();
  });

  it('logs in and completes machine inventory, installation, warranty, repair, assignment, status, and handover upload', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@vietmed.vn', password: '123456' })
      .expect(201);

    token = loginResponse.body.accessToken;
    expect(token).toBeTruthy();

    const [machineModel, customer, engineer] = await Promise.all([
      prisma.machineModel.findFirst(),
      prisma.customer.findFirst(),
      prisma.user.findFirst({
        where: { role: { name: 'engineer' }, status: 'ACTIVE' },
      }),
    ]);

    expect(machineModel).toBeTruthy();
    expect(customer).toBeTruthy();
    expect(engineer).toBeTruthy();

    const machineResponse = await request(app.getHttpServer())
      .post('/machines')
      .set('Authorization', `Bearer ${token}`)
      .send({
        machineCode,
        serialNumber,
        machineModelId: machineModel!.id,
        inventoryStatus: MachineInventoryStatus.RETURNED,
      })
      .expect(201);

    createdIds.machineId = machineResponse.body.id;

    await request(app.getHttpServer())
      .post('/inventory-movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        machineId: createdIds.machineId,
        type: InventoryMovementType.IMPORT,
        toStatus: MachineInventoryStatus.IN_STOCK,
      })
      .expect(201);

    const installationResponse = await request(app.getHttpServer())
      .post('/installations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        machineId: createdIds.machineId,
        customerId: customer!.id,
        installedById: engineer!.id,
        installedAt: '2026-06-03T02:00:00.000Z',
        warrantyEndDate: '2027-06-03T02:00:00.000Z',
      })
      .expect(201);

    createdIds.installationId = installationResponse.body.id;
    expect(installationResponse.body.warrantyCard).toBeTruthy();

    const repairResponse = await request(app.getHttpServer())
      .post('/repairs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'E2E repair workflow',
        machineId: createdIds.machineId,
        priority: RepairPriority.NORMAL,
      })
      .expect(201);

    createdIds.repairId = repairResponse.body.id;

    await request(app.getHttpServer())
      .patch(`/repairs/${createdIds.repairId}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .send({ engineerId: engineer!.id })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/repairs/${createdIds.repairId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: RepairStatus.IN_PROGRESS })
      .expect(200);

    const attachmentResponse = await request(app.getHttpServer())
      .post('/attachments')
      .set('Authorization', `Bearer ${token}`)
      .field('entityType', 'Repair')
      .field('entityId', createdIds.repairId!)
      .field('type', AttachmentType.HANDOVER_MINUTES)
      .attach('file', Buffer.from('handover minutes'), 'handover.txt')
      .expect(201);

    createdIds.attachmentId = attachmentResponse.body.id;
    expect(attachmentResponse.body.entityId).toBe(createdIds.repairId);
  });
});

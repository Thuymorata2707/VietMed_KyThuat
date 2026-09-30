import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AttachmentType,
  DemoLoanStatus,
  InventoryMovementType,
  MachineInventoryStatus,
  MachineStatus,
  MaintenanceStatus,
  RepairPriority,
  RepairStatus,
  WorkReviewStatus,
} from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '../src/auth/jwt.service';
import { PrismaService } from '../src/prisma/prisma.service';

const runWorkflowE2e = process.env.RUN_WORKFLOW_E2E === 'true';

(runWorkflowE2e ? describe : describe.skip)('Main workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let engineerToken: string;

  const suffix = Date.now();
  const machineCode = `E2E-M-${suffix}`;
  const serialNumber = `E2E-SN-${suffix}`;
  const demoSerialNumber = `E2E-DEMO-SN-${suffix}`;
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
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@vietmed.vn' },
      select: { regionId: true },
    });
    const customer = await prisma.customer.create({
      data: {
        customerCode: `E2E-C-${suffix}`,
        name: `E2E Workflow Customer ${suffix}`,
        status: 'ACTIVE',
        regionId: admin.regionId,
      },
    });
    createdIds.customerId = customer.id;
  });

  afterAll(async () => {
    const auditEntityIds = Object.values(createdIds).filter(
      (id): id is string => Boolean(id),
    );
    if (auditEntityIds.length) {
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: auditEntityIds } },
      });
    }
    if (createdIds.attachmentId) {
      await prisma.attachment.deleteMany({
        where: { id: createdIds.attachmentId },
      });
    }
    if (createdIds.repairId) {
      await prisma.repair.deleteMany({ where: { id: createdIds.repairId } });
    }
    if (createdIds.maintenanceId) {
      await prisma.maintenance.deleteMany({
        where: { id: createdIds.maintenanceId },
      });
    }
    if (createdIds.deviceServiceTicketId) {
      await prisma.deviceServiceTicket.deleteMany({
        where: { id: createdIds.deviceServiceTicketId },
      });
    }
    const demoLoanIds = [
      createdIds.demoLoanId,
      createdIds.cancelledDemoLoanId,
      createdIds.overdueDemoLoanId,
    ].filter((id): id is string => Boolean(id));
    if (demoLoanIds.length) {
      await prisma.demoLoan.deleteMany({ where: { id: { in: demoLoanIds } } });
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
    if (createdIds.demoMachineId) {
      await prisma.machineInventoryMovement.deleteMany({
        where: { machineId: createdIds.demoMachineId },
      });
      await prisma.machine.deleteMany({
        where: { id: createdIds.demoMachineId },
      });
    }
    if (createdIds.customerId) {
      await prisma.customer.deleteMany({
        where: { id: createdIds.customerId },
      });
    }

    await app.close();
  });

  it('runs installation, repair, maintenance, demo, device service, and handover workflows end to end', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ identifier: 'admin@vietmed.vn', password: '123456' })
      .expect(201);

    token = loginResponse.body.accessToken;
    expect(token).toBeTruthy();

    const [machineModel, customer, engineer] = await Promise.all([
      prisma.machineModel.findFirst(),
      prisma.customer.findUnique({ where: { id: createdIds.customerId } }),
      prisma.user.findFirst({
        where: { role: { name: 'engineer' }, status: 'ACTIVE' },
      }),
    ]);

    expect(machineModel).toBeTruthy();
    expect(customer).toBeTruthy();
    expect(engineer).toBeTruthy();

    const engineerRecord = await prisma.user.findUniqueOrThrow({
      where: { id: engineer!.id },
      select: { id: true, email: true, roleId: true, regionId: true },
    });
    engineerToken = app.get(JwtService).sign({
      ...engineerRecord,
      roleName: 'engineer',
    });

    const machineResponse = await request(app.getHttpServer())
      .post('/machines')
      .set('Authorization', `Bearer ${token}`)
      .send({
        machineCode,
        serialNumber,
        machineModelId: machineModel!.id,
        status: MachineStatus.REPAIRING,
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
    expect(installationResponse.body.status).toBe('PENDING');

    const installedAt = '2026-06-03T02:00:00.000Z';
    const warrantyEndDate = '2027-06-03T02:00:00.000Z';
    const completedInstallation = await request(app.getHttpServer())
      .patch(`/installations/${createdIds.installationId}`)
      .set('Authorization', `Bearer ${engineerToken}`)
      .send({
        status: 'INSTALLED',
        installedAt,
        warrantyEndDate,
      })
      .expect(200);

    expect(completedInstallation.body.reviewStatus).toBe(
      WorkReviewStatus.PENDING,
    );
    const installationMovementCount =
      await prisma.machineInventoryMovement.count({
        where: { machineId: createdIds.machineId },
      });
    const approvedInstallation = await request(app.getHttpServer())
      .post(`/installations/${createdIds.installationId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: WorkReviewStatus.APPROVED })
      .expect(201);
    expect(approvedInstallation.body.reviewStatus).toBe(
      WorkReviewStatus.APPROVED,
    );
    expect(
      await prisma.machineInventoryMovement.count({
        where: { machineId: createdIds.machineId },
      }),
    ).toBe(installationMovementCount);
    expect(
      await prisma.warrantyCard.findUnique({
        where: { installationId: createdIds.installationId },
      }),
    ).toBeTruthy();
    const installedMachine = await prisma.machine.findUniqueOrThrow({
      where: { id: createdIds.machineId },
    });
    expect(installedMachine.inventoryStatus).toBe(
      MachineInventoryStatus.INSTALLED,
    );
    expect(installedMachine.status).toBe(MachineStatus.ACTIVE);

    const repairRequest = await request(app.getHttpServer())
      .post('/repairs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'E2E repair workflow',
        machineId: createdIds.machineId,
        engineerId: engineer!.id,
        priority: RepairPriority.NORMAL,
      });
    if (repairRequest.status !== 201) {
      throw new Error(
        `Repair create failed: ${JSON.stringify(repairRequest.body)}`,
      );
    }
    const repairResponse = repairRequest;

    createdIds.repairId = repairResponse.body.id;

    await request(app.getHttpServer())
      .patch(`/repairs/${createdIds.repairId}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .send({ engineerId: engineer!.id })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/repairs/${createdIds.repairId}/status`)
      .set('Authorization', `Bearer ${engineerToken}`)
      .send({ status: RepairStatus.IN_PROGRESS })
      .expect(200);

    const repairComplete = await request(app.getHttpServer())
      .patch(`/repairs/${createdIds.repairId}/status`)
      .set('Authorization', `Bearer ${engineerToken}`)
      .send({
        status: RepairStatus.COMPLETED,
        resultNote: 'E2E repair complete',
      })
      .expect(200);
    expect(repairComplete.body.reviewStatus).toBe(WorkReviewStatus.PENDING);
    await request(app.getHttpServer())
      .post(`/repairs/${createdIds.repairId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: WorkReviewStatus.APPROVED })
      .expect(201);
    expect(
      (
        await prisma.machine.findUniqueOrThrow({
          where: { id: createdIds.machineId },
        })
      ).status,
    ).toBe(MachineStatus.ACTIVE);

    const maintenanceResponse = await request(app.getHttpServer())
      .post('/maintenance')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'E2E maintenance workflow',
        machineId: createdIds.machineId,
        customerId: customer!.id,
        engineerId: engineer!.id,
        engineerIds: [engineer!.id],
        scheduledDate: '2026-06-03T02:00:00.000Z',
        checklist: ['Check operational status'],
      })
      .expect(201);
    createdIds.maintenanceId = maintenanceResponse.body.id;
    expect(maintenanceResponse.body.status).toBe('ASSIGNED');

    await request(app.getHttpServer())
      .patch(`/maintenance/${createdIds.maintenanceId}/status`)
      .set('Authorization', `Bearer ${engineerToken}`)
      .send({ status: MaintenanceStatus.IN_PROGRESS })
      .expect(200);

    const maintenanceComplete = await request(app.getHttpServer())
      .patch(`/maintenance/${createdIds.maintenanceId}/status`)
      .set('Authorization', `Bearer ${engineerToken}`)
      .send({
        status: MaintenanceStatus.COMPLETED,
        resultNote: 'E2E maintenance complete',
      })
      .expect(200);
    expect(maintenanceComplete.body.reviewStatus).toBe(
      WorkReviewStatus.PENDING,
    );
    const returnedForRevision = await request(app.getHttpServer())
      .post(`/maintenance/${createdIds.maintenanceId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: WorkReviewStatus.NEEDS_REVISION,
        reviewNote: 'Please add the measurement results',
      })
      .expect(201);
    expect(returnedForRevision.body.status).toBe(MaintenanceStatus.IN_PROGRESS);
    expect(
      (
        await prisma.machine.findUniqueOrThrow({
          where: { id: createdIds.machineId },
        })
      ).status,
    ).toBe(MachineStatus.MAINTENANCE);
    await request(app.getHttpServer())
      .patch(`/maintenance/${createdIds.maintenanceId}/status`)
      .set('Authorization', `Bearer ${engineerToken}`)
      .send({
        status: MaintenanceStatus.COMPLETED,
        resultNote: 'E2E maintenance complete with measurements',
      })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/maintenance/${createdIds.maintenanceId}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: WorkReviewStatus.APPROVED })
      .expect(201);

    const demoMachineResponse = await request(app.getHttpServer())
      .post('/machines')
      .set('Authorization', `Bearer ${token}`)
      .send({
        machineCode: `E2E-DM-${suffix}`,
        serialNumber: demoSerialNumber,
        machineModelId: machineModel!.id,
        status: MachineStatus.REPAIRING,
        inventoryStatus: MachineInventoryStatus.RETURNED,
      })
      .expect(201);
    createdIds.demoMachineId = demoMachineResponse.body.id;

    await request(app.getHttpServer())
      .post('/inventory-movements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        machineId: createdIds.demoMachineId,
        type: InventoryMovementType.IMPORT,
        toStatus: MachineInventoryStatus.IN_STOCK,
      })
      .expect(201);

    const plannedHandoverAt = new Date().toISOString();
    const expectedReturnAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const demoRequest = await request(app.getHttpServer())
      .post('/demo-loans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        machineId: createdIds.demoMachineId,
        customerId: customer!.id,
        engineerId: engineer!.id,
        plannedHandoverAt,
        expectedReturnAt,
        purpose: 'E2E demo loan',
      });
    if (demoRequest.status !== 201) {
      throw new Error(
        `Demo create failed: ${JSON.stringify(demoRequest.body)}`,
      );
    }
    const demoResponse = demoRequest;
    createdIds.demoLoanId = demoResponse.body.id;
    expect(demoResponse.body.status).toBe(DemoLoanStatus.PLANNED);
    expect(
      (
        await prisma.machine.findUniqueOrThrow({
          where: { id: createdIds.demoMachineId },
        })
      ).inventoryStatus,
    ).toBe(MachineInventoryStatus.RESERVED);

    await request(app.getHttpServer())
      .post(`/demo-loans/${createdIds.demoLoanId}/handover`)
      .set('Authorization', `Bearer ${token}`)
      .send({ occurredAt: plannedHandoverAt, condition: 'Ready for demo' })
      .expect(201);

    const returnedDemo = await request(app.getHttpServer())
      .post(`/demo-loans/${createdIds.demoLoanId}/return`)
      .set('Authorization', `Bearer ${token}`)
      .send({ occurredAt: new Date().toISOString(), condition: 'Received' })
      .expect(201);
    expect(returnedDemo.body.status).toBe(DemoLoanStatus.RETURNED);
    expect(
      (
        await prisma.machine.findUniqueOrThrow({
          where: { id: createdIds.demoMachineId },
        })
      ).inventoryStatus,
    ).toBe(MachineInventoryStatus.RETURNED);
    const demoAuditActions = (
      await prisma.auditLog.findMany({
        where: { entityId: createdIds.demoLoanId },
        select: { action: true },
      })
    ).map((entry) => entry.action);
    expect(demoAuditActions).toEqual(
      expect.arrayContaining(['CREATE', 'STATUS_CHANGE']),
    );
    expect(
      demoAuditActions.filter((action) => action === 'STATUS_CHANGE'),
    ).toHaveLength(2);

    const cancelledDemoPlan = await request(app.getHttpServer())
      .post('/demo-loans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        machineId: createdIds.demoMachineId,
        customerId: customer!.id,
        engineerId: engineer!.id,
        plannedHandoverAt,
        expectedReturnAt,
        purpose: 'E2E cancelled demo plan',
      })
      .expect(201);
    createdIds.cancelledDemoLoanId = cancelledDemoPlan.body.id;
    const cancelledDemo = await request(app.getHttpServer())
      .post(`/demo-loans/${createdIds.cancelledDemoLoanId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(cancelledDemo.body.status).toBe(DemoLoanStatus.CANCELLED);
    expect(
      (
        await prisma.machine.findUniqueOrThrow({
          where: { id: createdIds.demoMachineId },
        })
      ).inventoryStatus,
    ).toBe(MachineInventoryStatus.RETURNED);
    expect(
      (
        await prisma.machine.findUniqueOrThrow({
          where: { id: createdIds.demoMachineId },
        })
      ).status,
    ).toBe(MachineStatus.REPAIRING);

    const overdueDemo = await request(app.getHttpServer())
      .post('/demo-loans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        machineId: createdIds.demoMachineId,
        customerId: customer!.id,
        engineerId: engineer!.id,
        plannedHandoverAt: '2026-06-01T02:00:00.000Z',
        expectedReturnAt: '2026-06-02T02:00:00.000Z',
        purpose: 'E2E overdue demo',
      })
      .expect(201);
    createdIds.overdueDemoLoanId = overdueDemo.body.id;
    await request(app.getHttpServer())
      .post(`/demo-loans/${createdIds.overdueDemoLoanId}/handover`)
      .set('Authorization', `Bearer ${engineerToken}`)
      .send({ occurredAt: '2026-06-01T02:00:00.000Z' })
      .expect(201);
    await request(app.getHttpServer())
      .get('/demo-loans?limit=100')
      .set('Authorization', `Bearer ${engineerToken}`)
      .expect(200);
    expect(
      (
        await prisma.demoLoan.findUniqueOrThrow({
          where: { id: createdIds.overdueDemoLoanId },
        })
      ).status,
    ).toBe(DemoLoanStatus.OVERDUE);
    const returnedOverdueDemo = await request(app.getHttpServer())
      .post(`/demo-loans/${createdIds.overdueDemoLoanId}/return`)
      .set('Authorization', `Bearer ${engineerToken}`)
      .send({ occurredAt: new Date().toISOString() })
      .expect(201);
    expect(returnedOverdueDemo.body.status).toBe(DemoLoanStatus.RETURNED);

    const deviceServiceResponse = await request(app.getHttpServer())
      .post('/device-service-tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        machineId: createdIds.machineId,
        customerId: customer!.id,
        engineerId: engineer!.id,
        receivedCondition: 'E2E received',
      })
      .expect(201);
    createdIds.deviceServiceTicketId = deviceServiceResponse.body.id;
    expect(deviceServiceResponse.body.status).toBe('RECEIVED');
    const returnedDeviceService = await request(app.getHttpServer())
      .post(
        `/device-service-tickets/${createdIds.deviceServiceTicketId}/return`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ resultNote: 'E2E device service complete' })
      .expect(201);
    expect(returnedDeviceService.body.status).toBe('RETURNED');
    const deviceServiceAuditActions = (
      await prisma.auditLog.findMany({
        where: { entityId: createdIds.deviceServiceTicketId },
        select: { action: true },
      })
    ).map((entry) => entry.action);
    expect(deviceServiceAuditActions).toEqual(
      expect.arrayContaining(['CREATE', 'STATUS_CHANGE']),
    );
    const finalMachine = await prisma.machine.findUniqueOrThrow({
      where: { id: createdIds.machineId },
    });
    expect(finalMachine.status).toBe(MachineStatus.ACTIVE);

    const attachmentResponse = await request(app.getHttpServer())
      .post('/attachments')
      .set('Authorization', `Bearer ${token}`)
      .field('entityType', 'Repair')
      .field('entityId', createdIds.repairId!)
      .field('type', AttachmentType.HANDOVER_MINUTES)
      .attach('file', Buffer.from('%PDF-1.4 E2E'), {
        filename: 'handover.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    createdIds.attachmentId = attachmentResponse.body.id;
    expect(attachmentResponse.body.entityId).toBe(createdIds.repairId);
  });
});

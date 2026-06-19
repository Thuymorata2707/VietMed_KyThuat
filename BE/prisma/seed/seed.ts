import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

type SeedTable =
  | 'Region'
  | 'Role'
  | 'User'
  | 'EngineerProfile'
  | 'ProductIndustry'
  | 'Customer'
  | 'BusinessLine'
  | 'MachineModel'
  | 'MachineComponent'
  | 'ComponentAccessory'
  | 'Machine'
  | 'MachineAccessory'
  | 'MachineInventoryMovement'
  | 'Repair'
  | 'Maintenance'
  | 'MachineInstallation'
  | 'WarrantyCard'
  | 'Attachment'
  | 'AuditLog'
  | 'DailyWorkNote'
  | 'WeeklyReport'
  | 'WeeklyReportRow'
  | 'Notification';

type SeedSnapshot = {
  source: string;
  generatedAt: string;
  tables: Record<SeedTable, Record<string, unknown>[]>;
};

const snapshot = JSON.parse(
  readFileSync(join(__dirname, 'snapshot-data.json'), 'utf8'),
) as SeedSnapshot;

const createOrder: SeedTable[] = [
  'Region',
  'Role',
  'User',
  'EngineerProfile',
  'ProductIndustry',
  'Customer',
  'BusinessLine',
  'MachineModel',
  'MachineComponent',
  'ComponentAccessory',
  'Machine',
  'MachineAccessory',
  'MachineInventoryMovement',
  'Repair',
  'Maintenance',
  'MachineInstallation',
  'WarrantyCard',
  'Attachment',
  'AuditLog',
  'DailyWorkNote',
  'WeeklyReport',
  'WeeklyReportRow',
  'Notification',
];

const deleteOrder: SeedTable[] = [...createOrder].reverse();

type SeedDelegate = {
  createMany: (args: { data: unknown[] }) => Promise<unknown>;
  deleteMany: () => Promise<unknown>;
};

const delegate = (value: unknown) => value as SeedDelegate;

const delegates: Record<SeedTable, SeedDelegate> = {
  Region: delegate(prisma.region),
  Role: delegate(prisma.role),
  User: delegate(prisma.user),
  EngineerProfile: delegate(prisma.engineerProfile),
  ProductIndustry: delegate(prisma.productIndustry),
  Customer: delegate(prisma.customer),
  BusinessLine: delegate(prisma.businessLine),
  MachineModel: delegate(prisma.machineModel),
  MachineComponent: delegate(prisma.machineComponent),
  ComponentAccessory: delegate(prisma.componentAccessory),
  Machine: delegate(prisma.machine),
  MachineAccessory: delegate(prisma.machineAccessory),
  MachineInventoryMovement: delegate(prisma.machineInventoryMovement),
  Repair: delegate(prisma.repair),
  Maintenance: delegate(prisma.maintenance),
  MachineInstallation: delegate(prisma.machineInstallation),
  WarrantyCard: delegate(prisma.warrantyCard),
  Attachment: delegate(prisma.attachment),
  AuditLog: delegate(prisma.auditLog),
  DailyWorkNote: delegate(prisma.dailyWorkNote),
  WeeklyReport: delegate(prisma.weeklyReport),
  WeeklyReportRow: delegate(prisma.weeklyReportRow),
  Notification: delegate(prisma.notification),
};

const dateFields = new Set([
  'createdAt',
  'updatedAt',
  'deletedAt',
  'dateOfBirth',
  'workStartDate',
  'manufacturingDate',
  'warehouseImportDate',
  'installDate',
  'warrantyStartDate',
  'warrantyEndDate',
  'installedAt',
  'handoverDepartureDate',
  'issuedAt',
  'startDate',
  'endDate',
  'occurredAt',
  'scheduledDate',
  'assignedAt',
  'startedAt',
  'completedAt',
  'nextDueDate',
  'reportedAt',
  'workDate',
  'weekStart',
  'submittedAt',
  'reviewedAt',
  'readAt',
]);

async function main() {
  for (const table of deleteOrder) {
    await delegates[table].deleteMany();
  }

  for (const table of createOrder) {
    const rows = (snapshot.tables[table] ?? []).map(hydrateDates);

    if (rows.length === 0) {
      continue;
    }

    await delegates[table].createMany({ data: rows });
  }

  console.log(
    JSON.stringify(
      {
        seededFrom: snapshot.source,
        generatedAt: snapshot.generatedAt,
        counts: Object.fromEntries(
          createOrder.map((table) => [
            table,
            snapshot.tables[table]?.length ?? 0,
          ]),
        ),
      },
      null,
      2,
    ),
  );
}

function hydrateDates(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      dateFields.has(key) && typeof value === 'string'
        ? new Date(value)
        : value,
    ]),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

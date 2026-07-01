import { PrismaClient } from '@prisma/client';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

loadEnvFile('.env');

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const shouldConfirm = args.has('--confirm');
const skipBackup = args.has('--skip-backup');

const pinnedTables = [
  ['Region', prisma.region],
  ['Role', prisma.role],
  ['User', prisma.user],
  ['EngineerProfile', prisma.engineerProfile],
  ['ProductIndustry', prisma.productIndustry],
  ['BusinessLine', prisma.businessLine],
  ['MachineModel', prisma.machineModel],
  ['MachineComponent', prisma.machineComponent],
  ['ComponentAccessory', prisma.componentAccessory],
  ['KnowledgeArticle', prisma.knowledgeArticle],
];

const operationalTables = [
  ['Notification', prisma.notification],
  ['Attachment', prisma.attachment],
  ['AuditLog', prisma.auditLog],
  ['WeeklyReportRow', prisma.weeklyReportRow],
  ['WeeklyReport', prisma.weeklyReport],
  ['DailyWorkNote', prisma.dailyWorkNote],
  ['WarrantyCard', prisma.warrantyCard],
  ['MachineInventoryMovement', prisma.machineInventoryMovement],
  ['Maintenance', prisma.maintenance],
  ['Repair', prisma.repair],
  ['MachineInstallation', prisma.machineInstallation],
  ['MachineAccessory', prisma.machineAccessory],
  ['Machine', prisma.machine],
  ['Customer', prisma.customer],
];

async function main() {
  const before = await countTables([...pinnedTables, ...operationalTables]);

  if (!shouldConfirm) {
    printSummary({
      mode: 'dry-run',
      before,
      deleted: Object.fromEntries(operationalTables.map(([name]) => [name, 0])),
      backupPath: null,
    });
    console.log('\nDry-run only. Run with --confirm to delete operational data.');
    return;
  }

  const backupPath = skipBackup ? null : await writeBackup();
  const deleted = {};

  await prisma.$transaction(
    async (tx) => {
      for (const [name] of operationalTables) {
        const delegate = tx[delegateName(name)];
        const result = await delegate.deleteMany();
        deleted[name] = result.count;
      }
    },
    { maxWait: 20_000, timeout: 60_000 },
  );

  const after = await countTables([...pinnedTables, ...operationalTables]);
  printSummary({ mode: 'confirmed', before, after, deleted, backupPath });
}

async function writeBackup() {
  const backupDir = join(process.cwd(), 'prisma', 'backups');
  mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `operational-data-${stamp}.json`);
  const tables = {};

  for (const [name, delegate] of operationalTables) {
    tables[name] = await delegate.findMany();
  }

  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        preservedTables: pinnedTables.map(([name]) => name),
        cleanedTables: operationalTables.map(([name]) => name),
        tables,
      },
      null,
      2,
    ),
  );

  return backupPath;
}

async function countTables(tables) {
  const entries = await Promise.all(
    tables.map(async ([name, delegate]) => [name, await delegate.count()]),
  );
  return Object.fromEntries(entries);
}

function printSummary({ mode, before, after, deleted, backupPath }) {
  console.log(
    JSON.stringify(
      {
        mode,
        preserved: Object.fromEntries(pinnedTables.map(([name]) => [name, before[name] ?? 0])),
        toCleanBefore: Object.fromEntries(operationalTables.map(([name]) => [name, before[name] ?? 0])),
        deleted,
        after: after
          ? Object.fromEntries([...pinnedTables, ...operationalTables].map(([name]) => [name, after[name] ?? 0]))
          : undefined,
        backupPath,
        note: 'Pinned data preserved: personnel, roles, regions, product industries, machine models/catalog, and knowledge articles.',
      },
      null,
      2,
    ),
  );
}

function delegateName(modelName) {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  const lines = readFileSync(path, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;

    const [, key, rawValue = ''] = match;
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

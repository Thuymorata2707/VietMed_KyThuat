import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import mariadb from 'mariadb';
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
loadEnvFile(join(projectRoot, '.env'));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const url = new URL(databaseUrl);
if (!['mysql:', 'mariadb:'].includes(url.protocol)) throw new Error('Only MySQL/MariaDB databases are supported');

const args = new Set(process.argv.slice(2));
const backupArg = process.argv.find((arg) => arg.startsWith('--backup-file='));
const backupFile = backupArg?.slice('--backup-file='.length);
const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
const hostIsLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);

if (!hostIsLocal && !args.has('--allow-non-local')) {
  throw new Error(`Refusing non-local database host ${url.hostname}. Use --allow-non-local only after verifying the target.`);
}

const preservedTables = new Set([
  '_prisma_migrations',
  'CodeSequence',
  'Region',
  'Branch',
  'Province',
  'Role',
  'User',
  'EngineerProfile',
  'KnowledgeArticle',
  'ProductIndustry',
  'BusinessLine',
  'MachineModel',
  'MachineComponent',
  'ComponentAccessory',
]);
const preservedAttachmentEntityTypes = ['User', 'EngineerProfile', 'BusinessLine', 'MachineModel'];

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: databaseName,
  }),
});

try {
  const tables = await prisma.$queryRawUnsafe(
    'SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = \'BASE TABLE\' ORDER BY TABLE_NAME',
  );
  const tableNames = tables.map((row) => row.tableName);
  const dataTables = tableNames.filter((tableName) => !preservedTables.has(tableName));
  const tableCounts = {};
  for (const tableName of tableNames) tableCounts[tableName] = await countRows(tableName);
  const attachmentCount = tableNames.includes('Attachment')
    ? await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) AS count FROM \`Attachment\` WHERE entityType NOT IN (${preservedAttachmentEntityTypes.map((type) => `'${type}'`).join(', ')})`,
      ).then((rows) => Number(rows[0].count))
    : 0;

  const cleanCounts = Object.fromEntries(dataTables.map((tableName) => [
    tableName,
    tableName === 'Attachment' ? attachmentCount : tableCounts[tableName],
  ]));
  const preserveCounts = Object.fromEntries([...preservedTables].filter((tableName) => tableNames.includes(tableName)).map((tableName) => [tableName, tableCounts[tableName]]));
  const preservedAttachmentCount = (tableCounts.Attachment ?? 0) - attachmentCount;

  if (!args.has('--confirm')) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      database: { host: url.hostname, name: databaseName },
      preserved: preserveCounts,
      preservedAttachments: preservedAttachmentCount,
      toDelete: cleanCounts,
      totalRowsToDelete: Object.values(cleanCounts).reduce((sum, count) => sum + Number(count || 0), 0),
      note: 'Dry run only. No rows were changed.',
    }, null, 2));
    process.exitCode = 0;
  } else {
    if (!backupFile) {
      throw new Error('A backup output path is required. Pass it with --backup-file=...');
    }
    await writeDataBackup(backupFile, tableNames);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
      try {
        for (const tableName of dataTables) {
          if (tableName === 'Attachment') {
            await tx.$executeRawUnsafe(
              `DELETE FROM \`Attachment\` WHERE entityType NOT IN (${preservedAttachmentEntityTypes.map((type) => `'${type}'`).join(', ')})`,
            );
          } else {
            await tx.$executeRawUnsafe(`DELETE FROM \`${tableName.replaceAll('`', '``')}\``);
          }
        }
      } finally {
        await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
      }
    }, { maxWait: 20_000, timeout: 120_000 });

    const after = {};
    for (const tableName of tableNames) after[tableName] = await countRows(tableName);
    console.log(JSON.stringify({
      mode: 'completed',
      database: { host: url.hostname, name: databaseName },
      backupFile,
      preserved: preserveCounts,
      preservedAttachments: preservedAttachmentCount,
      deleted: cleanCounts,
      after,
      note: 'All non-preserved database tables were cleared; system sequences, model catalogue, staff, knowledge articles and geographic/product reference data were retained.',
    }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}

async function countRows(tableName) {
  const escapedName = tableName.replaceAll('`', '``');
  const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM \`${escapedName}\``);
  return Number(rows[0].count);
}

async function writeDataBackup(outputPath, tableNames) {
  const absolutePath = resolve(outputPath);
  if (existsSync(absolutePath)) throw new Error(`Backup output already exists: ${absolutePath}`);
  mkdirSync(dirname(absolutePath), { recursive: true });
  const connection = await mariadb.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: databaseName,
    timezone: 'Z',
  });

  async function* sqlStatements() {
    yield '-- VietMed data backup. Schema is retained in the live database.\nSET FOREIGN_KEY_CHECKS=0;\nSTART TRANSACTION;\n';
    for (const tableName of tableNames) {
      const escapedTable = quoteIdentifier(tableName);
      const rows = await connection.query(`SELECT * FROM ${escapedTable}`);
      if (!rows.length) continue;
      const columns = Object.keys(rows[0]);
      const columnSql = columns.map(quoteIdentifier).join(', ');
      for (let offset = 0; offset < rows.length; offset += 200) {
        const values = rows.slice(offset, offset + 200)
          .map((row) => `(${columns.map((column) => sqlValue(row[column])).join(', ')})`)
          .join(',\n');
        yield `INSERT INTO ${escapedTable} (${columnSql}) VALUES\n${values};\n`;
      }
    }
    yield 'COMMIT;\nSET FOREIGN_KEY_CHECKS=1;\n';
  }

  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    await pipeline(Readable.from(sqlStatements()), createGzip({ level: 9 }), createWriteStream(absolutePath, { mode: 0o600 }));
    if (!existsSync(absolutePath) || statSync(absolutePath).size === 0) throw new Error('Database backup is empty');
  } catch (error) {
    try { unlinkSync(absolutePath); } catch { /* No backup file was created. */ }
    throw error;
  } finally {
    await connection.rollback().catch(() => undefined);
    await connection.end();
  }
}

function quoteIdentifier(value) {
  return `\`${value.replaceAll('`', '``')}\``;
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Date) return `'${value.toISOString().slice(0, 23).replace('T', ' ')}'`;
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return `X'${Buffer.from(value).toString('hex')}'`;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `CONVERT(X'${Buffer.from(text, 'utf8').toString('hex')}' USING utf8mb4)`;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
  }
}

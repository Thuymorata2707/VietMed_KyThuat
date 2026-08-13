import { createReadStream, createWriteStream, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { createGzip } from 'zlib';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Usage: npm run db:backup',
    '',
    'Environment:',
    '  DATABASE_URL                MySQL/MariaDB connection URL',
    '  BACKUP_DIR                  Backup output directory, default: backups',
    '  BACKUP_RETENTION_DAYS       Delete .sql.gz backups older than this, default: 14',
  ].join('\n'));
  process.exit(0);
}

loadDotEnv(join(projectRoot, '.env'));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  fail('DATABASE_URL is required');
}

const parsed = new URL(databaseUrl);
if (!['mysql:', 'mariadb:'].includes(parsed.protocol)) {
  fail(`Unsupported database protocol: ${parsed.protocol}. This backup script supports MySQL/MariaDB.`);
}

const backupDir = resolve(projectRoot, process.env.BACKUP_DIR || 'backups');
mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const dbName = parsed.pathname.replace(/^\//, '');
const sqlPath = join(backupDir, `${dbName}-${timestamp}.sql`);
const gzipPath = `${sqlPath}.gz`;

const args = [
  '--single-transaction',
  '--routines',
  '--triggers',
  '--events',
  '--default-character-set=utf8mb4',
  '-h',
  parsed.hostname,
  '-P',
  parsed.port || '3306',
  '-u',
  decodeURIComponent(parsed.username),
  dbName,
];

const dumpEnv = {
  ...process.env,
  MYSQL_PWD: decodeURIComponent(parsed.password || ''),
};

console.log(`Creating database backup: ${gzipPath}`);
await runDump(args, dumpEnv, sqlPath);
await gzipFile(sqlPath, gzipPath);
cleanupOldBackups(backupDir, Number(process.env.BACKUP_RETENTION_DAYS || 14));
console.log(`Backup complete: ${gzipPath}`);

function runDump(args, env, outputPath) {
  return new Promise((resolvePromise, rejectPromise) => {
    const output = createWriteStream(outputPath, { mode: 0o600 });
  const child = spawn('mysqldump', args, {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
    const errors = [];

    child.stdout.pipe(output);
    child.stderr.on('data', (chunk) => errors.push(chunk.toString()));
    child.on('error', rejectPromise);
    child.on('close', (code) => {
      output.end();
      if (code === 0) {
        resolvePromise();
        return;
      }

      try {
        unlinkSync(outputPath);
      } catch {
        // The dump may have failed before creating the file.
      }
      rejectPromise(new Error(errors.join('').trim() || `mysqldump exited with code ${code}`));
    });
  });
}

function gzipFile(sourcePath, targetPath) {
  return new Promise((resolvePromise, rejectPromise) => {
    const source = createReadStream(sourcePath);
    const target = createWriteStream(targetPath, { mode: 0o600 });
    source
      .pipe(createGzip({ level: 9 }))
      .pipe(target)
      .on('finish', () => {
        unlinkSync(sourcePath);
        resolvePromise();
      })
      .on('error', rejectPromise);
  });
}

function cleanupOldBackups(directory, retentionDays) {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return;
  }

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const fileName of readdirSync(directory)) {
    if (!fileName.endsWith('.sql.gz')) {
      continue;
    }

    const filePath = join(directory, fileName);
    if (statSync(filePath).mtimeMs < cutoff) {
      unlinkSync(filePath);
    }
  }
}

function loadDotEnv(path) {
  try {
    const data = readFileSync(path, 'utf8');
    for (const line of data.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
        continue;
      }

      const [key, ...valueParts] = trimmed.split('=');
      if (process.env[key]) {
        continue;
      }

      process.env[key] = valueParts.join('=').replace(/^['"]|['"]$/g, '');
    }
  } catch {
    // Environment variables may be provided by the process manager.
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

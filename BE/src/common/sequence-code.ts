import { Prisma } from '@prisma/client';

const targets = {
  repair: ['Repair', 'code'],
  maintenance: ['Maintenance', 'code'],
  installation: ['MachineInstallation', 'code'],
  inventory: ['MachineInventoryMovement', 'code'],
  warranty: ['WarrantyCard', 'code'],
  demo: ['DemoLoan', 'code'],
  receive: ['DeviceServiceTicket', 'receiveCode'],
  return: ['DeviceServiceTicket', 'returnCode'],
  machine: ['Machine', 'machineCode'],
  customer: ['Customer', 'customerCode'],
  accessory: ['ComponentAccessory', 'code'],
  accessoryStock: ['AccessoryStockMovement', 'code'],
} as const;

type Client = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'> & {
  $transaction?: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;
};

/** Reserve inside the caller's transaction. A preview is only an estimate. */
export async function sequenceCode(
  client: Client,
  target: keyof typeof targets,
  prefix: string,
  width = 3,
  preview = false,
): Promise<string> {
  if (!preview && client.$transaction) {
    return client.$transaction(tx => sequenceCode(tx, target, prefix, width));
  }

  const [tableName, columnName] = targets[target];
  // Identifiers come exclusively from the closed allowlist above; values are bound.
  const table = Prisma.raw(`\`${tableName}\``);
  const column = Prisma.raw(`\`${columnName}\``);
  const scope = `${tableName}.${columnName}:${prefix}`;
  if (scope.length > 191) throw new Error('Code prefix is too long');

  if (!preview) {
    // Both first use and later uses acquire the same InnoDB row lock, retained
    // until the business transaction commits or rolls back.
    await client.$executeRaw`
      INSERT INTO CodeSequence (scope, value) VALUES (${scope}, 0)
      ON DUPLICATE KEY UPDATE value = CodeSequence.value`;
  }
  const rows = await client.$queryRaw<Array<{ value: bigint }>>(Prisma.sql`
    SELECT value FROM CodeSequence WHERE scope = ${scope}
    ${preview ? Prisma.empty : Prisma.sql`FOR UPDATE`}`);
  const startsWith = `${prefix}-`;
  const suffix = Prisma.sql`SUBSTRING(${column}, ${startsWith.length + 1})`;
  // Numeric comparison handles 999/1000; strict suffix validation ignores
  // malformed imported codes. Compare with legacy rows even after bootstrap
  // so later manual imports with higher numbers remain supported.
  const existing = await client.$queryRaw<Array<{ value: bigint | null }>>(Prisma.sql`
    SELECT MAX(CAST(${suffix} AS UNSIGNED)) AS value FROM ${table}
    WHERE LEFT(${column}, ${startsWith.length}) = ${startsWith}
      AND ${suffix} REGEXP '^[0-9]+$'`);
  const stored = BigInt(rows[0]?.value ?? 0);
  const legacy = BigInt(existing[0]?.value ?? 0);
  const next = (stored > legacy ? stored : legacy) + 1n;
  if (next > 9223372036854775807n) throw new Error('Code sequence exhausted');
  if (!preview) {
    await client.$executeRaw`UPDATE CodeSequence SET value = ${next} WHERE scope = ${scope}`;
  }
  return `${startsWith}${next.toString().padStart(width, '0')}`;
}

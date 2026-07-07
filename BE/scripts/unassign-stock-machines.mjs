import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const machines = await prisma.machine.findMany({
    where: {
      inventoryStatus: 'IN_STOCK',
      customerId: { not: null },
    },
  });

  console.log(`Found ${machines.length} IN_STOCK machines with customerId set`);

  for (const m of machines) {
    await prisma.machine.update({
      where: { id: m.id },
      data: { customerId: null },
    });
    console.log(`  CLEARED: ${m.serialNumber || m.machineCode} - removed customer`);
  }

  console.log('\nDone!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

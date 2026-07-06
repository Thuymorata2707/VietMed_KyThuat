import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MODEL_NAME_MAP = {
  'X CUBE 70': 'Máy siêu âm X-CUBE 70',
  'BC30S': 'Máy xét nghiệm huyết học tự động BC-30s',
  'CL900I': 'CL-900i',
  'KT108': 'Máy điện xung trị liệu KT-108',
  'X2200': 'Máy nội soi X-2200',
};
const MODEL_NAMES = Object.values(MODEL_NAME_MAP);

async function main() {
  console.log('Fetching reference data...');

  const regions = await prisma.region.findMany();
  if (!regions.length) {
    console.error('No regions found. Run seed first.');
    process.exit(1);
  }
  console.log(`Found ${regions.length} regions`);

  const models = await prisma.machineModel.findMany({
    where: { name: { in: MODEL_NAMES } },
    include: { businessLine: true },
  });

  const modelMap = {};
  for (const m of models) {
    const key = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    modelMap[key] = m;
    console.log(`  Model: ${m.name} (${m.id}) -> businessLine: ${m.businessLine?.name || 'N/A'}`);
  }

  for (const [shortName, fullName] of Object.entries(MODEL_NAME_MAP)) {
    const key = fullName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!modelMap[key]) {
      console.error(`Model "${shortName}" (${fullName}) not found in DB`);
    }
  }

  const admin = await prisma.user.findFirst({
    where: { status: 'ACTIVE' },
    include: { role: true },
  });
  const adminUser = admin && admin.role?.name === 'admin' ? admin : null;

  const customers = [
    { name: 'Bệnh viện Đa khoa Hà Nội', province: 'Hà Nội', type: 'HOSPITAL' },
    { name: 'Bệnh viện Bạch Mai', province: 'Hà Nội', type: 'HOSPITAL' },
    { name: 'Bệnh viện Hữu Nghị Việt Đức', province: 'Hà Nội', type: 'HOSPITAL' },
    { name: 'Bệnh viện Chợ Rẫy', province: 'TP Hồ Chí Minh', type: 'HOSPITAL' },
    { name: 'Bệnh viện Đa khoa Đà Nẵng', province: 'Đà Nẵng', type: 'HOSPITAL' },
    { name: 'Phòng khám Đa khoa An Phú', province: 'TP Hồ Chí Minh', type: 'CLINIC' },
    { name: 'Trung tâm Y tế Quận 1', province: 'TP Hồ Chí Minh', type: 'HOSPITAL' },
    { name: 'Bệnh viện Đa khoa Huế', province: 'Thừa Thiên Huế', type: 'HOSPITAL' },
    { name: 'Bệnh viện Nhi Đồng 2', province: 'TP Hồ Chí Minh', type: 'HOSPITAL' },
    { name: 'Bệnh viện Đa khoa Cần Thơ', province: 'Cần Thơ', type: 'HOSPITAL' },
    { name: 'Phòng khám Đa khoa Hồng Đức', province: 'Hà Nội', type: 'CLINIC' },
    { name: 'Bệnh viện Đa khoa Hải Phòng', province: 'Hải Phòng', type: 'HOSPITAL' },
    { name: 'Bệnh viện Đa khoa Nghệ An', province: 'Nghệ An', type: 'HOSPITAL' },
    { name: 'Bệnh viện Đa khoa Quảng Ninh', province: 'Quảng Ninh', type: 'HOSPITAL' },
    { name: 'Bệnh viện Đa khoa Lâm Đồng', province: 'Lâm Đồng', type: 'HOSPITAL' },
  ];

  const regionId = regions[0].id;

  console.log('\nCreating customers...');
  const createdCustomers = [];
  for (const c of customers) {
    const existing = await prisma.customer.findFirst({ where: { name: c.name } });
    if (existing) {
      console.log(`  SKIP (exists): ${c.name}`);
      createdCustomers.push(existing);
      continue;
    }
    const customer = await prisma.customer.create({
      data: {
        name: c.name,
        province: c.province,
        customerType: c.type,
        status: 'ACTIVE',
        regionId,
        ...(adminUser ? { primaryEngineerId: adminUser.id } : {}),
      },
    });
    createdCustomers.push(customer);
    console.log(`  CREATED: ${customer.name} (${customer.id})`);
  }
  console.log(`Total customers: ${createdCustomers.length}`);

  const manufacturerMap = {
    'x cube 70': 'Mindray',
    'bc30s': 'Mindray',
    'cl900i': 'Sysmex',
    'kt108': 'ITC',
    'x2200': 'Fujifilm',
  };

  const serialCounter = {};
  for (const fullName of MODEL_NAMES) {
    serialCounter[fullName] = 1;
  }

  console.log('\nCreating machines (5 per model)...');
  let machineCount = 0;
  for (const [modelShortName, modelFullName] of Object.entries(MODEL_NAME_MAP)) {
    const key = modelFullName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const model = modelMap[key];
    if (!model) {
      console.error(`  SKIP: model "${modelShortName}" (${modelFullName}) not found`);
      continue;
    }

    for (let i = 1; i <= 5; i++) {
      const customerIndex = machineCount % createdCustomers.length;
      const customer = createdCustomers[customerIndex];
      const serial = `${modelShortName.toUpperCase()}-${String(serialCounter[modelFullName]++).padStart(3, '0')}`;

      const existingMachine = await prisma.machine.findUnique({
        where: { serialNumber: serial },
      });
      if (existingMachine) {
        console.log(`  SKIP (exists): ${serial}`);
        machineCount++;
        continue;
      }

      const machineCode = `${modelShortName.toUpperCase()}-${String(serialCounter[modelFullName] - 1).padStart(3, '0')}`;

      await prisma.machine.create({
        data: {
          serialNumber: serial,
          machineCode,
          name: `${model.name} #${i}`,
          modelName: model.name,
          manufacturer: manufacturerMap[modelShortName.toLowerCase()] || 'Unknown',
          productCategory: model.productCategory || 'OTHER',
          status: 'ACTIVE',
          inventoryStatus: 'IN_STOCK',
          businessLineId: model.businessLineId,
          machineModelId: model.id,
          customerId: customer.id,
        },
      });
      machineCount++;
      console.log(`  CREATED: ${serial} - ${model.name} -> ${customer.name}`);
    }
  }
  console.log(`Total machines created: ${machineCount}`);

  console.log('\nDone!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const snapshot = JSON.parse(readFileSync(join(process.cwd(), 'prisma/seed/snapshot-data.json'), 'utf8'));

const extraModels = [
  model('PRODUCT-BIOCHEMISTRY', 'BS-120', 'Máy xét nghiệm sinh hoá tự động BS-120', 'BIOCHEMISTRY', 'Mindray', 'Sinh hoá'),
  model('PRODUCT-BIOCHEMISTRY', 'BS-200E', 'Máy xét nghiệm sinh hoá tự động BS-200E', 'BIOCHEMISTRY', 'Mindray', 'Sinh hoá'),
  model('PRODUCT-BIOCHEMISTRY', 'BS-480', 'Máy xét nghiệm sinh hoá tự động BS-480', 'BIOCHEMISTRY', 'Mindray', 'Sinh hoá'),
  model('PRODUCT-HEMATOLOGY', 'BC-2800', 'Máy xét nghiệm huyết học tự động BC-2800', 'HEMATOLOGY', 'Mindray', 'Huyết học'),
  model('PRODUCT-HEMATOLOGY', 'BC-31S', 'Máy xét nghiệm huyết học tự động BC-31s', 'HEMATOLOGY', 'Mindray', 'Huyết học'),
  model('PRODUCT-HEMATOLOGY', 'BC-3000P', 'Máy xét nghiệm huyết học tự động BC-3000 Plus', 'HEMATOLOGY', 'Mindray', 'Huyết học'),
  model('PRODUCT-LAB-TESTING', 'CCU-1500', 'Máy xét nghiệm nước tiểu CCU-1500', 'LAB_TESTING', 'Chưa rõ', 'Nước tiểu'),
  model('PRODUCT-LAB-TESTING', 'CCU-2400', 'Máy xét nghiệm nước tiểu CCU-2400', 'LAB_TESTING', 'Chưa rõ', 'Nước tiểu'),
  model('PRODUCT-LAB-TESTING', 'CLINITEK-STATUS', 'Máy xét nghiệm nước tiểu Clinitek Status', 'LAB_TESTING', 'Siemens', 'Nước tiểu'),
  model('PRODUCT-ULTRASOUND', 'DC-60', 'Máy siêu âm DC-60', 'ULTRASOUND', 'Mindray', 'Máy siêu âm'),
  model('PRODUCT-PHYSIOTHERAPY', 'ENPULS-VERSION-2', 'Máy điều trị xung áp lực EnPuls Version 2.0', 'OTHER', 'Chưa rõ', 'Vật lý trị liệu'),
  model('PRODUCT-ENDOSCOPY', 'THORAX', 'Thiết bị Thorax', 'OTHER', 'Chưa rõ', 'Thiết bị khác'),
  model('PRODUCT-ENDOSCOPY', 'BB-1153', 'Thiết bị BB-1153', 'OTHER', 'Chưa rõ', 'Thiết bị khác'),
];

try {
  const productIndustries = (snapshot.tables.ProductIndustry ?? []).map(hydrateDates);
  const businessLines = (snapshot.tables.BusinessLine ?? []).map(hydrateDates);
  const machineModels = (snapshot.tables.MachineModel ?? []).map(hydrateDates);

  await prisma.$transaction([
    prisma.componentAccessory.deleteMany(),
    prisma.machineComponent.deleteMany(),
    prisma.machineModel.deleteMany(),
    prisma.businessLine.deleteMany(),
    prisma.productIndustry.deleteMany(),
  ]);

  if (productIndustries.length) await prisma.productIndustry.createMany({ data: productIndustries });
  if (businessLines.length) await prisma.businessLine.createMany({ data: businessLines });
  if (machineModels.length) await prisma.machineModel.createMany({ data: machineModels });

  const businessLinesByCode = new Map(
    (await prisma.businessLine.findMany({ select: { id: true, code: true } })).map((line) => [line.code, line.id]),
  );

  let extraWritten = 0;
  for (const item of extraModels) {
    const businessLineId = businessLinesByCode.get(item.businessLineCode);
    if (!businessLineId) continue;

    await prisma.machineModel.upsert({
      where: { businessLineId_code: { businessLineId, code: item.code } },
      update: {
        name: item.name,
        displayName: item.name,
        status: 'ACTIVE',
        manufacturer: item.manufacturer,
        productCategory: item.productCategory,
        productLine: item.productLine,
        note: 'Bổ sung vào catalog cố định để phân loại dữ liệu import Excel.',
      },
      create: {
        businessLineId,
        code: item.code,
        name: item.name,
        displayName: item.name,
        status: 'ACTIVE',
        manufacturer: item.manufacturer,
        productCategory: item.productCategory,
        productLine: item.productLine,
        note: 'Bổ sung vào catalog cố định để phân loại dữ liệu import Excel.',
      },
    });
    extraWritten += 1;
  }

  const counts = await Promise.all([
    prisma.productIndustry.count(),
    prisma.businessLine.count(),
    prisma.machineModel.count(),
  ]);

  console.log(
    JSON.stringify(
      {
        productIndustries: counts[0],
        businessLines: counts[1],
        machineModels: counts[2],
        extraModels: extraWritten,
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}

function hydrateDates(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      ['createdAt', 'updatedAt'].includes(key) && typeof value === 'string' ? new Date(value) : value,
    ]),
  );
}

function model(businessLineCode, code, name, productCategory, manufacturer, productLine) {
  return { businessLineCode, code, name, productCategory, manufacturer, productLine };
}

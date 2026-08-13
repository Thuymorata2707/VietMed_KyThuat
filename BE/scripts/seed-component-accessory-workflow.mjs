import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const templatesByCategory = {
  ULTRASOUND: [
    ['Đầu dò Convex', 'Dùng cho khám bụng, sản phụ khoa'],
    ['Đầu dò Linear', 'Dùng cho mạch máu, tuyến giáp, phần mềm'],
    ['Đầu dò Sector', 'Dùng cho tim mạch'],
    ['Cáp ECG', 'Phụ kiện đồng bộ tín hiệu ECG'],
    ['UPS y tế', 'Bộ lưu điện đi kèm hệ thống'],
  ],
  HEMATOLOGY: [
    ['Máy quét mã vạch', 'Quét barcode mẫu xét nghiệm'],
    ['Bộ dây hóa chất Lyse', 'Dây hóa chất lyse tiêu chuẩn'],
    ['Bình chứa thải', 'Bình thải dùng trong vận hành'],
    ['Kim hút mẫu', 'Kim hút mẫu thay thế'],
    ['Cụm sensor loader', 'Cảm biến cụm nạp mẫu'],
  ],
  BIOCHEMISTRY: [
    ['Bơm rửa', 'Bơm rửa đường nước và cuvette'],
    ['Kim hút mẫu', 'Kim hút mẫu sinh hóa'],
    ['Bộ lọc nước', 'Lọc nước cấp cho máy'],
    ['Van điện từ', 'Van điều khiển đường nước rửa'],
    ['Bình nước thải', 'Bình chứa nước thải tiêu chuẩn'],
  ],
  IMMUNOLOGY: [
    ['Kim hút mẫu', 'Kim hút mẫu miễn dịch'],
    ['Cụm rửa kim', 'Cụm rửa và vệ sinh probe'],
    ['Khay phản ứng', 'Khay phản ứng mẫu'],
    ['Bộ dây hóa chất', 'Dây hóa chất thuốc thử'],
    ['Cụm cảm biến mẫu', 'Sensor nhận diện mẫu'],
  ],
  ENDOSCOPY: [
    ['Ống soi dạ dày', 'Ống soi dạ dày tương thích hệ thống'],
    ['Ống soi đại tràng', 'Ống soi đại tràng tương thích hệ thống'],
    ['Cáp nguồn sáng', 'Cáp nguồn sáng dự phòng'],
    ['Bình nước nội soi', 'Bình nước và dây nối'],
    ['Van hút', 'Van hút thay thế'],
  ],
  OTHER: [
    ['Dây nguồn y tế', 'Dây nguồn chuẩn y tế'],
    ['Bộ chuyển đổi nguồn', 'Adapter hoặc nguồn phụ'],
    ['Cáp kết nối', 'Cáp kết nối tín hiệu'],
    ['Bộ phụ kiện tiêu chuẩn', 'Bộ phụ kiện đi kèm máy'],
  ],
};

function slug(value) {
  return String(value || 'MODEL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
    .slice(0, 36);
}

function defaultQuantity(name) {
  const normalized = String(name || '').toLowerCase();
  if (normalized.includes('cáp') || normalized.includes('dây')) return 2;
  if (normalized.includes('đầu dò')) return 2;
  return 1;
}

async function main() {
  const models = await prisma.machineModel.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [{ productCategory: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      code: true,
      name: true,
      displayName: true,
      productCategory: true,
    },
  });

  let created = 0;
  let updated = 0;

  for (const model of models) {
    const templates =
      templatesByCategory[model.productCategory] ?? templatesByCategory.OTHER;
    const modelPrefix = slug(model.code || model.name);

    for (const [index, [name, description]] of templates.entries()) {
      const code = `${modelPrefix}-PK-${String(index + 1).padStart(3, '0')}`;
      const quantity = defaultQuantity(name);
      const existing = await prisma.componentAccessory.findUnique({
        where: {
          machineModelId_code: {
            machineModelId: model.id,
            code,
          },
        },
        select: { id: true },
      });

      await prisma.componentAccessory.upsert({
        where: {
          machineModelId_code: {
            machineModelId: model.id,
            code,
          },
        },
        update: {
          name,
          description,
          quantity,
          requiresSerial: true,
          sortOrder: index,
          status: 'ACTIVE',
        },
        create: {
          machineModelId: model.id,
          code,
          name,
          description,
          quantity,
          requiresSerial: true,
          sortOrder: index,
          status: 'ACTIVE',
        },
      });

      if (existing) updated += 1;
      else created += 1;
    }
  }

  const total = await prisma.componentAccessory.count();
  console.log(
    JSON.stringify(
      {
        models: models.length,
        created,
        updated,
        total,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

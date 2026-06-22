import { PrismaClient } from '../../BE/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient();

const source = 'https://vietmed.vn/collections/all';

const businessLines = [
  { code: 'NSX-ALPINION', name: 'Alpinion', productCategory: 'ULTRASOUND', manufacturer: 'Alpinion' },
  { code: 'NSX-MINDRAY-ULTRASOUND', name: 'Mindray Ultrasound', productCategory: 'ULTRASOUND', manufacturer: 'Mindray' },
  { code: 'NSX-BIOCHEMISTRY', name: 'Mindray', productCategory: 'BIOCHEMISTRY', manufacturer: 'Mindray' },
  { code: 'NSX-IMMUNOLOGY', name: 'Fujirebio', productCategory: 'IMMUNOLOGY', manufacturer: 'Fujirebio' },
  { code: 'NSX-MINATO', name: 'Minato', productCategory: 'OTHER', manufacturer: 'Minato' },
  { code: 'NSX-SONOSCAPE', name: 'SonoScape', productCategory: 'ENDOSCOPY', manufacturer: 'SonoScape' },
  { code: 'NSX-CELLTRAZONE', name: 'CelltraZone', productCategory: 'OTHER', manufacturer: 'CelltraZone' },
];

const products = [
  // Máy siêu âm - Alpinion
  product('NSX-ALPINION', 'X-CUBE-50', 'Máy siêu âm X-CUBE 50', 'ULTRASOUND', 'Alpinion', 'Máy siêu âm'),
  product('NSX-ALPINION', 'X-CUBE-60', 'Máy siêu âm X-CUBE 60', 'ULTRASOUND', 'Alpinion', 'Máy siêu âm'),
  product('NSX-ALPINION', 'X-CUBE-70', 'Máy siêu âm X-CUBE 70', 'ULTRASOUND', 'Alpinion', 'Máy siêu âm'),
  product('NSX-ALPINION', 'X-CUBE-90', 'Máy siêu âm X-CUBE 90', 'ULTRASOUND', 'Alpinion', 'Máy siêu âm'),
  product('NSX-ALPINION', 'X-CUBE-I8', 'Máy siêu âm xách tay X-CUBE i8', 'ULTRASOUND', 'Alpinion', 'Máy siêu âm xách tay'),
  product('NSX-ALPINION', 'X-CUBE-I9', 'Máy siêu âm xách tay X-CUBE i9', 'ULTRASOUND', 'Alpinion', 'Máy siêu âm xách tay'),
  product('NSX-ALPINION', 'MINISONO', 'Siêu âm Minisono', 'ULTRASOUND', 'Alpinion', 'Máy siêu âm xách tay'),
  product('NSX-MINDRAY-ULTRASOUND', 'DC-60', 'Máy siêu âm DC-60', 'ULTRASOUND', 'Mindray', 'Máy siêu âm'),

  // Máy xét nghiệm - Mindray
  product('NSX-BIOCHEMISTRY', 'BA-88A', 'Máy xét nghiệm sinh hoá bán tự động BA-88A', 'BIOCHEMISTRY', 'Mindray', 'Sinh hoá'),
  product('NSX-BIOCHEMISTRY', 'BS-120', 'Máy xét nghiệm sinh hoá tự động BS-120', 'BIOCHEMISTRY', 'Mindray', 'Sinh hoá'),
  product('NSX-BIOCHEMISTRY', 'BS-200E', 'Máy xét nghiệm sinh hoá tự động BS-200E', 'BIOCHEMISTRY', 'Mindray', 'Sinh hoá'),
  product('NSX-BIOCHEMISTRY', 'BS-1000M', 'Máy xét nghiệm sinh hoá tự động BS-1000M', 'BIOCHEMISTRY', 'Mindray', 'Sinh hoá'),
  product('NSX-BIOCHEMISTRY', 'BS-240', 'Máy xét nghiệm sinh hoá tự động BS-240', 'BIOCHEMISTRY', 'Mindray', 'Sinh hoá'),
  product('NSX-BIOCHEMISTRY', 'BS-240E', 'Máy xét nghiệm sinh hoá tự động BS-240E', 'BIOCHEMISTRY', 'Mindray', 'Sinh hoá'),
  product('NSX-BIOCHEMISTRY', 'BS-360E', 'Máy xét nghiệm sinh hoá tự động BS-360E', 'BIOCHEMISTRY', 'Mindray', 'Sinh hoá'),
  product('NSX-BIOCHEMISTRY', 'BS-430', 'Máy xét nghiệm sinh hoá tự động BS-430', 'BIOCHEMISTRY', 'Mindray', 'Sinh hoá'),
  product('NSX-BIOCHEMISTRY', 'BS-480', 'Máy xét nghiệm sinh hoá tự động BS-480', 'BIOCHEMISTRY', 'Mindray', 'Sinh hoá'),
  product('NSX-BIOCHEMISTRY', 'BS-600M', 'Máy xét nghiệm sinh hoá tự động BS-600M', 'BIOCHEMISTRY', 'Mindray', 'Sinh hoá'),
  product('NSX-BIOCHEMISTRY', 'BC-2800', 'Máy xét nghiệm huyết học tự động BC-2800', 'HEMATOLOGY', 'Mindray', 'Huyết học'),
  product('NSX-BIOCHEMISTRY', 'BC-6800-PLUS', 'Máy xét nghiệm huyết học 5 thành phần BC-6800 Plus', 'HEMATOLOGY', 'Mindray', 'Huyết học'),
  product('NSX-BIOCHEMISTRY', 'BC-6000', 'Máy xét nghiệm huyết học 6 thành phần BC-6000', 'HEMATOLOGY', 'Mindray', 'Huyết học'),
  product('NSX-BIOCHEMISTRY', 'BC-20S', 'Máy xét nghiệm huyết học tự động BC-20s', 'HEMATOLOGY', 'Mindray', 'Huyết học'),
  product('NSX-BIOCHEMISTRY', 'BC-30S', 'Máy xét nghiệm huyết học tự động BC-30s', 'HEMATOLOGY', 'Mindray', 'Huyết học'),
  product('NSX-BIOCHEMISTRY', 'BC-31S', 'Máy xét nghiệm huyết học tự động BC-31s', 'HEMATOLOGY', 'Mindray', 'Huyết học'),
  product('NSX-BIOCHEMISTRY', 'BC-3000P', 'Máy xét nghiệm huyết học tự động BC-3000 Plus', 'HEMATOLOGY', 'Mindray', 'Huyết học'),
  product('NSX-BIOCHEMISTRY', 'BC-5380', 'Máy xét nghiệm huyết học tự động BC-5380', 'HEMATOLOGY', 'Mindray', 'Huyết học'),
  product('NSX-BIOCHEMISTRY', 'BC-700B', 'Máy xét nghiệm huyết học tự động BC-700(B)', 'HEMATOLOGY', 'Mindray', 'Huyết học'),
  product('NSX-BIOCHEMISTRY', 'BC-760B', 'Máy xét nghiệm huyết học tự động BC-760(B)', 'HEMATOLOGY', 'Mindray', 'Huyết học'),
  product('NSX-BIOCHEMISTRY', 'CL-1000I', 'Máy xét nghiệm miễn dịch tự động CL-1000i', 'IMMUNOLOGY', 'Mindray', 'Miễn dịch'),
  product('NSX-BIOCHEMISTRY', 'CL-2600I', 'Máy xét nghiệm miễn dịch tự động CL-2600i', 'IMMUNOLOGY', 'Mindray', 'Miễn dịch'),
  product('NSX-BIOCHEMISTRY', 'CL-8000I', 'Máy xét nghiệm miễn dịch tự động CL-8000i', 'IMMUNOLOGY', 'Mindray', 'Miễn dịch'),
  product('NSX-BIOCHEMISTRY', 'CL-960I', 'Máy xét nghiệm miễn dịch tự động CL-960i', 'IMMUNOLOGY', 'Mindray', 'Miễn dịch'),
  product('NSX-BIOCHEMISTRY', 'EU-5600-PRO', 'Máy xét nghiệm nước tiểu EU-5600 Pro', 'LAB_TESTING', 'Mindray', 'Nước tiểu'),
  product('NSX-BIOCHEMISTRY', 'UA-5600', 'Máy xét nghiệm nước tiểu UA-5600', 'LAB_TESTING', 'Mindray', 'Nước tiểu'),
  product('NSX-BIOCHEMISTRY', 'UA-600', 'Máy xét nghiệm nước tiểu UA-600', 'LAB_TESTING', 'Mindray', 'Nước tiểu'),
  product('NSX-BIOCHEMISTRY', 'UA-66', 'Máy xét nghiệm nước tiểu UA-66', 'LAB_TESTING', 'Mindray', 'Nước tiểu'),
  product('NSX-BIOCHEMISTRY', 'CCU-1500', 'Máy xét nghiệm nước tiểu CCU-1500', 'LAB_TESTING', 'Chưa rõ', 'Nước tiểu'),
  product('NSX-BIOCHEMISTRY', 'CCU-2400', 'Máy xét nghiệm nước tiểu CCU-2400', 'LAB_TESTING', 'Chưa rõ', 'Nước tiểu'),
  product('NSX-BIOCHEMISTRY', 'CLINITEK-STATUS', 'Máy xét nghiệm nước tiểu Clinitek Status', 'LAB_TESTING', 'Siemens', 'Nước tiểu'),

  // Fujirebio
  product('NSX-IMMUNOLOGY', 'LUMIPULSE-G1200', 'Máy xét nghiệm miễn dịch tự động Lumipulse G1200', 'IMMUNOLOGY', 'Fujirebio', 'Miễn dịch Fujirebio'),
  product('NSX-IMMUNOLOGY', 'LUMIPULSE-G600II', 'Máy xét nghiệm miễn dịch tự động Lumipulse G600II', 'IMMUNOLOGY', 'Fujirebio', 'Miễn dịch Fujirebio'),

  // PHCN & VLTL - Minato
  product('NSX-MINATO', 'QZ-240', 'Giường massage thủy trị liệu khô QZ-240', 'OTHER', 'Minato', 'Vật lý trị liệu'),
  product('NSX-MINATO', 'KT-104', 'Máy điện xung trị liệu KT-104', 'OTHER', 'Minato', 'Vật lý trị liệu'),
  product('NSX-MINATO', 'KT-108', 'Máy điện xung trị liệu KT-108', 'OTHER', 'Minato', 'Vật lý trị liệu'),
  product('NSX-MINATO', 'ST-2CL', 'Máy kéo giãn cột sống kỹ thuật số ST-2CL', 'OTHER', 'Minato', 'Vật lý trị liệu'),
  product('NSX-MINATO', 'TC-30D-TC-30S', 'Máy kéo giãn cột sống TC-30D / TC-30S', 'OTHER', 'Minato', 'Vật lý trị liệu'),
  product('NSX-MINATO', 'MHR-4F-MHR-2F', 'Máy nhiệt rung trị liệu MHR-4f / MHR-2f', 'OTHER', 'Minato', 'Vật lý trị liệu'),
  product('NSX-MINATO', 'ALB-200H', 'Máy trị liệu hồng ngoại ALB-200H', 'OTHER', 'Minato', 'Vật lý trị liệu'),
  product('NSX-MINATO', 'HC-5U', 'Máy ủ ầm kèm túi chườm nhiệt HC-5U', 'OTHER', 'Minato', 'Vật lý trị liệu'),
  product('NSX-MINATO', 'MT-5D', 'Máy vi sóng trị liệu MT-5D', 'OTHER', 'Minato', 'Vật lý trị liệu'),
  product('NSX-MINATO', 'WTS-SERIES', 'Bộ thiết bị tập vận động cơ WTS-series', 'OTHER', 'Minato', 'Phục hồi chức năng'),
  product('NSX-MINATO', 'STAIR-TRAINER', 'Cầu thang tập đi cao cấp', 'OTHER', 'Minato', 'Phục hồi chức năng'),
  product('NSX-MINATO', 'PARALLEL-BARS', 'Thanh tập đi song song', 'OTHER', 'Minato', 'Phục hồi chức năng'),
  product('NSX-MINATO', 'WTS-01', 'Thiết bị tập vận động Weltonic WTS-01', 'OTHER', 'Minato', 'Phục hồi chức năng'),
  product('NSX-MINATO', 'WTS-02', 'Thiết bị tập vận động Weltonic WTS-02', 'OTHER', 'Minato', 'Phục hồi chức năng'),
  product('NSX-MINATO', 'WTS-03', 'Thiết bị tập vận động Weltonic WTS-03', 'OTHER', 'Minato', 'Phục hồi chức năng'),
  product('NSX-MINATO', 'WTS-04', 'Thiết bị tập vận động Weltonic WTS-04', 'OTHER', 'Minato', 'Phục hồi chức năng'),
  product('NSX-MINATO', 'ENPULS-VERSION-2', 'Máy điều trị xung áp lực EnPuls Version 2.0', 'OTHER', 'Chưa rõ', 'Vật lý trị liệu'),

  // Nội soi - SonoScape
  product('NSX-SONOSCAPE', 'HD-350', 'Máy nội soi HD-350', 'ENDOSCOPY', 'SonoScape', 'Nội soi tiêu hoá'),
  product('NSX-SONOSCAPE', 'HD-500', 'Máy nội soi HD-500', 'ENDOSCOPY', 'SonoScape', 'Nội soi tiêu hoá'),
  product('NSX-SONOSCAPE', 'HD-550', 'Máy nội soi HD-550', 'ENDOSCOPY', 'SonoScape', 'Nội soi tiêu hoá'),
  product('NSX-SONOSCAPE', 'HD-650', 'Máy nội soi HD-650', 'ENDOSCOPY', 'SonoScape', 'Nội soi tiêu hoá'),
  product('NSX-SONOSCAPE', 'X-2200', 'Máy nội soi X-2200', 'ENDOSCOPY', 'SonoScape', 'Nội soi tiêu hoá'),
  product('NSX-SONOSCAPE', 'X-2600', 'Máy nội soi X-2600', 'ENDOSCOPY', 'SonoScape', 'Nội soi tiêu hoá'),
  product('NSX-SONOSCAPE', 'THORAX', 'Thiết bị Thorax', 'OTHER', 'Chưa rõ', 'Thiết bị khác'),
  product('NSX-SONOSCAPE', 'BB-1153', 'Thiết bị BB-1153', 'OTHER', 'Chưa rõ', 'Thiết bị khác'),

  // Tách chiết tế bào - nếu cần dùng sau
  product('NSX-CELLTRAZONE', 'HURO-PATH-T', 'Máy tách chiết tế bào HURO PATH T', 'OTHER', 'CelltraZone', 'Tách chiết tế bào'),
  product('NSX-CELLTRAZONE', 'HURO-PATH-S', 'Máy tách chiết tế bào HURO PATH S', 'OTHER', 'CelltraZone', 'Tách chiết tế bào'),
];

const linesByCode = new Map();

try {
  for (const line of businessLines) {
    const saved = await prisma.businessLine.upsert({
      where: { code: line.code },
      update: {
        name: line.name,
        manufacturer: line.manufacturer,
        productCategory: line.productCategory,
        status: 'ACTIVE',
        note: `Nguồn tham khảo: ${source}`,
      },
      create: {
        code: line.code,
        name: line.name,
        manufacturer: line.manufacturer,
        productCategory: line.productCategory,
        status: 'ACTIVE',
        note: `Nguồn tham khảo: ${source}`,
      },
      select: { id: true, code: true },
    });
    linesByCode.set(saved.code, saved.id);
  }

  let written = 0;
  for (const item of products) {
    const businessLineId = linesByCode.get(item.businessLineCode);
    if (!businessLineId) continue;

    await prisma.machineModel.upsert({
      where: {
        businessLineId_code: {
          businessLineId,
          code: item.code,
        },
      },
      update: {
        name: item.name,
        displayName: item.name,
        status: 'ACTIVE',
        manufacturer: item.manufacturer,
        productCategory: item.productCategory,
        productLine: item.productLine,
        note: `Import nhanh từ VietMed.vn. Nguồn: ${item.source}`,
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
        note: `Import nhanh từ VietMed.vn. Nguồn: ${item.source}`,
      },
    });
    written += 1;
  }

  console.log(
    JSON.stringify(
      {
        businessLines: businessLines.length,
        machineModels: written,
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}

function product(businessLineCode, code, name, productCategory, manufacturer, productLine) {
  return {
    businessLineCode,
    code,
    name,
    productCategory,
    manufacturer,
    productLine,
    source,
  };
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PREFIX = 'QA-HUAN-20260810';
const PASSWORD_HASH = '$2b$10$JeIbuIBp0WVUvTmuG30NfeXEwWZwVWAz6qbOOnEObvZZxW0FYjMni';

const hospital = {
  customerCode: `${PREFIX}-BV`,
  name: 'Bệnh viện Đa khoa Test Lê Văn Huấn',
  shortName: 'BV Test Huấn',
  hospitalName: 'Bệnh viện Đa khoa Test Lê Văn Huấn',
  customerType: 'HOSPITAL',
  status: 'ACTIVE',
  taxCode: '0109998888',
  email: 'cntt@bv-test-huan.vn',
  website: 'https://bv-test-huan.vn',
  phone: '02439998888',
  contactPerson: 'Nguyễn Thị Minh',
  contactPosition: 'Trưởng phòng Vật tư thiết bị y tế',
  contactPhone: '0912345678',
  contactEmail: 'minh.nguyen@bv-test-huan.vn',
  province: 'Hà Nội',
  district: 'Quận Cầu Giấy',
  ward: 'Phường Dịch Vọng',
  address: 'Số 25 đường Trần Thái Tông',
  fullAddress: 'Số 25 đường Trần Thái Tông, Phường Dịch Vọng, Quận Cầu Giấy, Hà Nội',
  note: 'Dữ liệu test đầy đủ cho màn kỹ sư: 3 lắp đặt, 5 sửa chữa, 2 bảo trì do kỹ sư Lê Văn Huấn phụ trách.',
};

const installSpecs = [
  {
    suffix: 'US-01',
    modelCode: 'X-CUBE-70',
    modelName: 'Máy siêu âm X-CUBE 70',
    displayName: 'Máy siêu âm X-CUBE 70',
    manufacturer: 'Alpinion',
    productCategory: 'ULTRASOUND',
    productLine: 'Chẩn đoán hình ảnh',
    machineCode: `${PREFIX}-MAY-LD-01`,
    serialNumber: `${PREFIX}-SN-LD-01`,
    name: 'Máy siêu âm X-CUBE 70 - Khoa Chẩn đoán hình ảnh',
    installDate: '2026-08-10T02:00:00.000Z',
    warrantyEndDate: '2028-08-10T16:59:59.000Z',
    department: 'Khoa Chẩn đoán hình ảnh',
    representative: 'BS. Phạm Quốc Bảo',
    contactPhone: '0912000001',
    receiverPosition: 'Trưởng khoa Chẩn đoán hình ảnh',
    accessories: [
      { code: 'CONVEX-C5-2', name: 'Đầu dò Convex C5-2', serialNumber: `${PREFIX}-ACC-LD-01-CVX`, description: 'Đầu dò bụng' },
      { code: 'LINEAR-L12-5', name: 'Đầu dò Linear L12-5', serialNumber: `${PREFIX}-ACC-LD-01-LIN`, description: 'Đầu dò tuyến giáp/mạch máu' },
      { code: 'UPS-1KVA', name: 'UPS 1KVA', serialNumber: `${PREFIX}-ACC-LD-01-UPS`, description: 'Bộ lưu điện đi kèm' },
    ],
  },
  {
    suffix: 'LAB-02',
    modelCode: 'BC-760B',
    modelName: 'Máy xét nghiệm huyết học tự động BC-760(B)',
    displayName: 'Máy xét nghiệm huyết học tự động BC-760(B)',
    manufacturer: 'Mindray',
    productCategory: 'HEMATOLOGY',
    productLine: 'Xét nghiệm huyết học',
    machineCode: `${PREFIX}-MAY-LD-02`,
    serialNumber: `${PREFIX}-SN-LD-02`,
    name: 'Máy xét nghiệm huyết học BC-760(B) - Khoa Xét nghiệm',
    installDate: '2026-08-10T03:15:00.000Z',
    warrantyEndDate: '2028-08-10T16:59:59.000Z',
    department: 'Khoa Xét nghiệm',
    representative: 'CN. Trần Hồng Anh',
    contactPhone: '0912000002',
    receiverPosition: 'Kỹ thuật viên trưởng Khoa Xét nghiệm',
    accessories: [
      { code: 'BARCODE-SCANNER', name: 'Máy quét mã vạch', serialNumber: `${PREFIX}-ACC-LD-02-SCN`, description: 'Quét barcode mẫu' },
      { code: 'LYSE-LINE', name: 'Bộ dây hóa chất lyse', serialNumber: `${PREFIX}-ACC-LD-02-LYS`, description: 'Dây hóa chất kèm máy' },
      { code: 'WASTE-TANK', name: 'Bình chứa thải', serialNumber: `${PREFIX}-ACC-LD-02-WST`, description: 'Bình thải tiêu chuẩn' },
    ],
  },
  {
    suffix: 'END-03',
    modelCode: 'HD-550',
    modelName: 'Máy nội soi HD-550',
    displayName: 'Máy nội soi HD-550',
    manufacturer: 'SonoScape',
    productCategory: 'ENDOSCOPY',
    productLine: 'Nội soi tiêu hóa',
    machineCode: `${PREFIX}-MAY-LD-03`,
    serialNumber: `${PREFIX}-SN-LD-03`,
    name: 'Máy nội soi HD-550 - Khoa Nội soi',
    installDate: '2026-08-10T07:30:00.000Z',
    warrantyEndDate: '2028-08-10T16:59:59.000Z',
    department: 'Khoa Nội soi',
    representative: 'BS. Lê Thu Trang',
    contactPhone: '0912000003',
    receiverPosition: 'Phụ trách phòng Nội soi',
    accessories: [
      { code: 'SCOPE-GASTRO', name: 'Ống soi dạ dày', serialNumber: `${PREFIX}-ACC-LD-03-GAS`, description: 'Ống soi dạ dày HD' },
      { code: 'SCOPE-COLON', name: 'Ống soi đại tràng', serialNumber: `${PREFIX}-ACC-LD-03-COL`, description: 'Ống soi đại tràng HD' },
      { code: 'LIGHT-CABLE', name: 'Cáp nguồn sáng', serialNumber: `${PREFIX}-ACC-LD-03-LGT`, description: 'Cáp nguồn sáng dự phòng' },
    ],
  },
];

const repairSpecs = [
  ['01', 'Máy siêu âm X-CUBE 70 báo lỗi mất tín hiệu đầu dò', 'Khoa Chẩn đoán hình ảnh', 'HIGH', 'IN_PROGRESS', 'Đầu dò convex lúc nhận lúc không, hình ảnh nhiễu khi doppler.', 'Đã vệ sinh chân tiếp xúc, kiểm tra cáp probe, cập nhật firmware, cần theo dõi thêm 24h.', 'Khách xác nhận máy đã hoạt động ổn định sau xử lý tại chỗ.'],
  ['02', 'Máy xét nghiệm BC-760 kẹt mẫu trong rack nạp', 'Khoa Xét nghiệm', 'URGENT', 'WAITING_PARTS', 'Rack nạp mẫu dừng giữa chu trình, báo lỗi loader motor.', 'Đã căn chỉnh cơ khí và vệ sinh ray trượt, đặt chờ cụm sensor loader thay thế.', 'Khách yêu cầu ưu tiên gửi linh kiện trong ngày.'],
  ['03', 'Máy nội soi HD-550 nhiễu hình khi xoay dây', 'Khoa Nội soi', 'NORMAL', 'COMPLETED', 'Tín hiệu hình ảnh chập chờn khi thao tác xoay đầu nối.', 'Đã siết lại socket video, test 30 phút liên tục không tái lỗi.', 'Bác sĩ phụ trách đã ký xác nhận nghiệm thu.'],
  ['04', 'Máy sinh hoá BS-240E báo áp lực nước rửa thấp', 'Khoa Xét nghiệm', 'LOW', 'ASSIGNED', 'Áp lực đường rửa thấp, máy yêu cầu kiểm tra bình nước và đường ống.', 'Chuẩn bị kiểm tra bơm rửa, lọc nước và van điện từ trong lần onsite tiếp theo.', 'Kỹ thuật viên xét nghiệm yêu cầu kiểm tra trước giờ chạy mẫu sáng.'],
  ['05', 'Máy miễn dịch CL-1000i lỗi kim hút mẫu', 'Khoa Miễn dịch', 'NORMAL', 'COMPLETED', 'Kim hút mẫu di chuyển lệch vị trí, báo lỗi aspiration position.', 'Đã hiệu chuẩn lại vị trí kim hút, vệ sinh cụm probe và chạy QC đạt.', 'Khách xác nhận máy chạy QC ổn định sau hiệu chuẩn.'],
];

const maintenanceSpecs = [
  ['01', 'Bảo trì định kỳ hệ thống siêu âm và đầu dò', 'Khoa Chẩn đoán hình ảnh', 'PERIODIC', 'COMPLETED', 'Đã vệ sinh máy, kiểm tra đầu dò, test Doppler, sao lưu cấu hình.', '2026-11-10T02:00:00.000Z'],
  ['02', 'Bảo trì hợp đồng máy xét nghiệm huyết học', 'Khoa Xét nghiệm', 'CONTRACT', 'IN_PROGRESS', 'Đã kiểm tra áp lực đường hóa chất, vệ sinh buồng đếm, còn chờ chạy QC cuối ca.', '2026-11-10T03:00:00.000Z'],
];

const extraRepairModelCodes = ['BS-240E', 'CL-1000I'];

function dt(value) {
  return new Date(value);
}

function addMonths(value, months) {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date;
}

async function ensureRole(name) {
  return prisma.role.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

async function ensureRegion() {
  const existing = await prisma.region.findFirst({ where: { OR: [{ code: 'HN' }, { name: 'Hà Nội' }] } });
  if (existing) return existing;
  return prisma.region.create({ data: { code: 'HN', name: 'Hà Nội' } });
}

async function ensureEngineer(regionId) {
  const engineerRole = await ensureRole('engineer');
  const engineer = await prisma.user.upsert({
    where: { email: 'lvhuan@vietmed.vn' },
    update: {
      fullName: 'Lê Văn Huấn',
      phone: '0987967762',
      status: 'ACTIVE',
      roleId: engineerRole.id,
      regionId,
    },
    create: {
      email: 'lvhuan@vietmed.vn',
      username: 'lvhuan',
      password: PASSWORD_HASH,
      fullName: 'Lê Văn Huấn',
      phone: '0987967762',
      status: 'ACTIVE',
      roleId: engineerRole.id,
      regionId,
    },
  });

  await prisma.engineerProfile.upsert({
    where: { userId: engineer.id },
    update: {
      employeeCode: 'VM-KS-HUAN',
      position: 'Kỹ sư thiết bị y tế',
      department: 'Phòng kỹ thuật hiện trường',
      specialties: ['Lắp đặt', 'Sửa chữa', 'Bảo trì', 'Chẩn đoán hình ảnh', 'Xét nghiệm'],
      expertiseGroup: 'IMAGING',
      certificateNo: 'CERT-HUAN-2026',
      note: 'Tài khoản dùng cho bộ dữ liệu test 1 bệnh viện: 3 lắp đặt, 5 sửa chữa, 2 bảo trì.',
    },
    create: {
      userId: engineer.id,
      employeeCode: 'VM-KS-HUAN',
      position: 'Kỹ sư thiết bị y tế',
      department: 'Phòng kỹ thuật hiện trường',
      workStartDate: dt('2024-01-02T00:00:00.000Z'),
      specialties: ['Lắp đặt', 'Sửa chữa', 'Bảo trì', 'Chẩn đoán hình ảnh', 'Xét nghiệm'],
      expertiseGroup: 'IMAGING',
      certificateNo: 'CERT-HUAN-2026',
      note: 'Tài khoản dùng cho bộ dữ liệu test 1 bệnh viện: 3 lắp đặt, 5 sửa chữa, 2 bảo trì.',
    },
  });

  return prisma.user.findUniqueOrThrow({
    where: { id: engineer.id },
    include: { region: true, role: true, engineerProfile: true },
  });
}

async function ensureAdmin(regionId) {
  const adminRole = await ensureRole('admin');
  return prisma.user.upsert({
    where: { email: 'admin@vietmed.vn' },
    update: { roleId: adminRole.id, regionId, status: 'ACTIVE' },
    create: {
      email: 'admin@vietmed.vn',
      username: 'admin',
      password: PASSWORD_HASH,
      fullName: 'System Admin',
      phone: '0901000001',
      status: 'ACTIVE',
      roleId: adminRole.id,
      regionId,
    },
  });
}

async function getRequiredModels(codes) {
  const models = await prisma.machineModel.findMany({
    where: { code: { in: codes } },
    include: { businessLine: true },
  });
  const byCode = new Map(models.map((model) => [model.code, model]));
  const missing = codes.filter((code) => !byCode.has(code));

  if (missing.length) {
    throw new Error(`Thiếu model có sẵn trong data: ${missing.join(', ')}. Hãy import catalog/model trước khi chạy script.`);
  }

  return byCode;
}

async function cleanup() {
  const repairIds = (await prisma.repair.findMany({ where: { code: { startsWith: `${PREFIX}-SC-` } }, select: { id: true } })).map((item) => item.id);
  const maintenanceIds = (await prisma.maintenance.findMany({ where: { code: { startsWith: `${PREFIX}-BT-` } }, select: { id: true } })).map((item) => item.id);
  const installationIds = (await prisma.machineInstallation.findMany({ where: { code: { startsWith: `${PREFIX}-LD-` } }, select: { id: true } })).map((item) => item.id);
  const machineIds = (await prisma.machine.findMany({ where: { machineCode: { startsWith: `${PREFIX}-MAY-` } }, select: { id: true } })).map((item) => item.id);
  const customer = await prisma.customer.findUnique({ where: { customerCode: hospital.customerCode }, select: { id: true } });

  await prisma.taskChecklistItem.deleteMany({
    where: {
      OR: [
        repairIds.length ? { repairId: { in: repairIds } } : undefined,
        maintenanceIds.length ? { maintenanceId: { in: maintenanceIds } } : undefined,
        installationIds.length ? { installationId: { in: installationIds } } : undefined,
      ].filter(Boolean),
    },
  });
  await prisma.usedPart.deleteMany({
    where: {
      OR: [
        repairIds.length ? { repairId: { in: repairIds } } : undefined,
        maintenanceIds.length ? { maintenanceId: { in: maintenanceIds } } : undefined,
        installationIds.length ? { installationId: { in: installationIds } } : undefined,
      ].filter(Boolean),
    },
  });
  await prisma.workLog.deleteMany({
    where: {
      OR: [
        repairIds.length ? { repairId: { in: repairIds } } : undefined,
        maintenanceIds.length ? { maintenanceId: { in: maintenanceIds } } : undefined,
        installationIds.length ? { installationId: { in: installationIds } } : undefined,
      ].filter(Boolean),
    },
  });
  await prisma.attachment.deleteMany({
    where: {
      OR: [
        repairIds.length ? { entityType: 'Repair', entityId: { in: repairIds } } : undefined,
        maintenanceIds.length ? { entityType: 'Maintenance', entityId: { in: maintenanceIds } } : undefined,
        installationIds.length ? { entityType: 'MachineInstallation', entityId: { in: installationIds } } : undefined,
      ].filter(Boolean),
    },
  });
  await prisma.notification.deleteMany({ where: { entityId: { startsWith: PREFIX } } });
  await prisma.warrantyCard.deleteMany({ where: { code: { startsWith: `${PREFIX}-BH-` } } });
  await prisma.repair.deleteMany({ where: { id: { in: repairIds } } });
  await prisma.maintenance.deleteMany({ where: { id: { in: maintenanceIds } } });
  await prisma.machineInstallation.deleteMany({ where: { id: { in: installationIds } } });
  await prisma.machineInventoryMovement.deleteMany({ where: { code: { startsWith: `${PREFIX}-KHO-` } } });
  await prisma.machineAccessory.deleteMany({
    where: {
      OR: [
        machineIds.length ? { machineId: { in: machineIds } } : undefined,
        { serialNumber: { startsWith: `${PREFIX}-ACC-` } },
      ].filter(Boolean),
    },
  });
  await prisma.machine.deleteMany({ where: { id: { in: machineIds } } });
  await prisma.dailyReport.deleteMany({ where: customer ? { summary: { contains: hospital.name } } : { summary: { contains: PREFIX } } });
  await prisma.weeklyReport.deleteMany({ where: { note: { contains: PREFIX } } });
  if (customer) {
    await prisma.customer.delete({ where: { id: customer.id } });
  }

  const testBusinessLine = await prisma.businessLine.findUnique({ where: { code: 'TEST-VIETMED-HUAN' } });
  if (testBusinessLine) {
    await prisma.machineModel.deleteMany({ where: { businessLineId: testBusinessLine.id } });
    await prisma.businessLine.delete({ where: { id: testBusinessLine.id } });
  }
  await prisma.productIndustry.deleteMany({ where: { code: 'TEST-MEDICAL-EQUIPMENT' } });
}

async function createAttachment(entityType, entityId, index, engineer) {
  return prisma.attachment.create({
    data: {
      entityType,
      entityId,
      type: entityType === 'Repair' ? 'ERROR_PHOTO' : entityType === 'Maintenance' ? 'MAINTENANCE_FORM' : 'HANDOVER_MINUTES',
      originalName: `${PREFIX}-${entityType}-${index}.txt`,
      storedName: `${PREFIX}-${entityType}-${index}.txt`,
      mimeType: 'text/plain',
      size: 128,
      path: `/uploads/test/${PREFIX}-${entityType}-${index}.txt`,
      url: `/attachments/test/${PREFIX}-${entityType}-${index}.txt`,
      fileData: Buffer.from(`Test attachment ${entityType} ${entityId}`),
      title: `Tài liệu hiện trường ${index}`,
      description: 'File test để màn tài liệu không trống.',
      uploadedById: engineer.id,
      uploadedByEmail: engineer.email,
    },
  });
}

async function createMachine(spec, customer, engineer, model, index) {
  const machine = await prisma.machine.create({
    data: {
      machineCode: spec.machineCode,
      serialNumber: spec.serialNumber,
      name: spec.name,
      imageUrl: 'https://vietmed.vn/test-machine.jpg',
      modelName: model.name,
      version: '2026.TEST',
      manufacturer: model.manufacturer || spec.manufacturer,
      productCategory: model.productCategory || spec.productCategory,
      productLine: model.productLine || spec.productLine,
      status: 'ACTIVE',
      inventoryStatus: 'INSTALLED',
      dataStatus: 'VERIFIED',
      createdSource: 'ENGINEER',
      manufacturingDate: dt('2026-06-01T00:00:00.000Z'),
      warehouseImportDate: dt('2026-07-25T00:00:00.000Z'),
      installDate: dt(spec.installDate),
      warrantyStartDate: dt(spec.installDate),
      warrantyEndDate: dt(spec.warrantyEndDate),
      accessoriesSnapshot: spec.accessories,
      businessLineId: model.businessLineId,
      machineModelId: model.id,
      customerId: customer.id,
      installedById: engineer.id,
      primaryEngineerId: engineer.id,
    },
  });

  await prisma.machineAccessory.createMany({
    data: spec.accessories.map((accessory) => ({
      machineId: machine.id,
      code: accessory.code,
      name: accessory.name,
      serialNumber: accessory.serialNumber,
      description: accessory.description,
      note: 'Phụ kiện test đã bàn giao cùng máy.',
    })),
  });

  await prisma.machineInventoryMovement.create({
    data: {
      code: `${PREFIX}-KHO-LD-${String(index).padStart(2, '0')}`,
      type: 'INSTALL',
      machineId: machine.id,
      fromStatus: 'IN_STOCK',
      toStatus: 'INSTALLED',
      occurredAt: dt(spec.installDate),
      note: `Xuất kho và lắp đặt cho ${hospital.name}.`,
      customerId: customer.id,
      createdById: engineer.id,
    },
  });

  return machine;
}

async function createInstallation(spec, customer, engineer, admin, model, machine, index) {
  const installation = await prisma.machineInstallation.create({
    data: {
      code: `${PREFIX}-LD-${String(index).padStart(2, '0')}`,
      status: 'INSTALLED',
      machineId: machine.id,
      plannedMachineModelId: model.id,
      plannedModelName: model.name,
      customerId: customer.id,
      businessLineId: model.businessLineId,
      installedById: engineer.id,
      installedAt: dt(spec.installDate),
      accessories: spec.accessories,
      note: `Lắp đặt mới ${spec.name}. Đã chạy thử, hướng dẫn vận hành, bàn giao phụ kiện và ký biên bản.`,
      warrantyStartDate: dt(spec.installDate),
      warrantyEndDate: dt(spec.warrantyEndDate),
      warrantyNote: 'Bảo hành 24 tháng, bao gồm kiểm tra định kỳ và hỗ trợ kỹ thuật từ xa.',
      handoverInstallerName: engineer.fullName,
      handoverInstallerPosition: 'Kỹ sư thiết bị y tế',
      handoverVehicle: 'Xe kỹ thuật VietMed 29A-888.88',
      handoverDepartureDate: dt(spec.installDate),
      receiverInstallAddress: `${hospital.fullAddress} - ${spec.department}`,
      receiverRepresentative: spec.representative,
      receiverPosition: spec.receiverPosition,
      receiverPhone: spec.contactPhone,
      installedDeviceItems: [
        {
          itemName: machine.name,
          model: model.name,
          serialNumber: machine.serialNumber,
          manufactureDate: '2026-06-01',
          quantity: 1,
          warrantyPeriod: '24 tháng',
        },
        ...spec.accessories.map((accessory) => ({
          itemName: accessory.name,
          model: accessory.code,
          serialNumber: accessory.serialNumber,
          manufactureDate: '2026-06-01',
          quantity: 1,
          warrantyPeriod: '24 tháng',
        })),
      ],
      deviceCondition: 'NEW_100',
      deviceConditionNote: 'Máy mới 100%, nguyên seal, không trầy xước, phụ kiện đủ theo packing list.',
      reviewStatus: 'APPROVED',
      reviewNote: 'Dữ liệu test đã duyệt để kiểm tra hiển thị.',
      reviewedAt: dt('2026-08-10T10:30:00.000Z'),
      reviewerId: admin.id,
    },
  });

  await prisma.warrantyCard.create({
    data: {
      code: `${PREFIX}-BH-LD-${String(index).padStart(2, '0')}`,
      status: 'ACTIVE',
      installationId: installation.id,
      machineId: machine.id,
      customerId: customer.id,
      issuedAt: dt(spec.installDate),
      startDate: dt(spec.installDate),
      endDate: dt(spec.warrantyEndDate),
      note: `Phiếu bảo hành test cho ${machine.name}.`,
      issuedById: engineer.id,
      issuedByEmail: engineer.email,
    },
  });

  await prisma.workLog.createMany({
    data: [
      { kind: 'INSTALLATION', installationId: installation.id, stepTime: dt(spec.installDate), title: 'Khảo sát vị trí lắp đặt', note: 'Kiểm tra nguồn điện, tiếp địa, mạng LAN và mặt bằng đặt máy.', sortOrder: 1, createdById: engineer.id },
      { kind: 'INSTALLATION', installationId: installation.id, stepTime: dt(spec.installDate), title: 'Lắp đặt và cấu hình', note: 'Lắp phụ kiện, cấu hình thông số ban đầu, nhập thông tin bệnh viện.', sortOrder: 2, createdById: engineer.id },
      { kind: 'INSTALLATION', installationId: installation.id, stepTime: dt(spec.installDate), title: 'Chạy thử và bàn giao', note: 'Chạy test chức năng, hướng dẫn người dùng, ký bàn giao.', sortOrder: 3, createdById: engineer.id },
    ],
  });

  await prisma.taskChecklistItem.createMany({
    data: [
      { kind: 'INSTALLATION', installationId: installation.id, label: 'Kiểm tra nguồn điện và tiếp địa', status: 'DONE', note: 'Đạt yêu cầu.', sortOrder: 1, checkedAt: dt(spec.installDate), updatedById: engineer.id },
      { kind: 'INSTALLATION', installationId: installation.id, label: 'Kiểm tra serial máy và phụ kiện', status: 'DONE', note: 'Khớp packing list.', sortOrder: 2, checkedAt: dt(spec.installDate), updatedById: engineer.id },
      { kind: 'INSTALLATION', installationId: installation.id, label: 'Chạy thử đầy đủ chức năng', status: 'DONE', note: 'Không phát sinh lỗi.', sortOrder: 3, checkedAt: dt(spec.installDate), updatedById: engineer.id },
      { kind: 'INSTALLATION', installationId: installation.id, label: 'Hướng dẫn vận hành và vệ sinh máy', status: 'DONE', note: 'Người dùng đã nắm thao tác cơ bản.', sortOrder: 4, checkedAt: dt(spec.installDate), updatedById: engineer.id },
    ],
  });

  await createAttachment('MachineInstallation', installation.id, index, engineer);
  return installation;
}

async function createRepair(spec, customer, engineer, admin, machine, index) {
  const [suffix, title, department, priority, status, description, repairMethod, customerFeedback] = spec;
  const isCompleted = status === 'COMPLETED';
  const reportedAt = dt(`2026-08-${10 + index}T02:30:00.000Z`);
  const repair = await prisma.repair.create({
    data: {
      code: `${PREFIX}-SC-${suffix}`,
      title,
      description,
      status,
      priority,
      machineId: machine.id,
      customerId: customer.id,
      engineerId: engineer.id,
      createdById: engineer.id,
      reportedAt,
      assignedAt: reportedAt,
      startedAt: status === 'ASSIGNED' ? null : dt(`2026-08-${10 + index}T03:00:00.000Z`),
      completedAt: isCompleted ? dt(`2026-08-${10 + index}T08:30:00.000Z`) : null,
      resultNote: status === 'ASSIGNED' ? 'Đã tiếp nhận, chuẩn bị onsite.' : repairMethod,
      customerFeedback,
      reviewStatus: isCompleted ? 'APPROVED' : 'PENDING',
      reviewNote: isCompleted ? 'Admin đã xác nhận kết quả sửa chữa test.' : 'Đang chờ cập nhật kết quả cuối cùng.',
      reviewedAt: isCompleted ? dt(`2026-08-${10 + index}T09:00:00.000Z`) : null,
      reviewerId: isCompleted ? admin.id : null,
      usingDepartment: department,
      representative: department.includes('Xét nghiệm') ? 'CN. Trần Hồng Anh' : department.includes('Nội soi') ? 'BS. Lê Thu Trang' : 'ĐD. Nguyễn Thị Minh',
      address: `${hospital.fullAddress} - ${department}`,
      contactPhone: `091300000${index}`,
      deviceName: machine.name,
      modelName: machine.modelName,
      serialNumber: machine.serialNumber,
      warrantyStatus: index <= 3 ? 'IN_WARRANTY' : 'OUT_OF_WARRANTY',
      conditionAssessment: `Kiểm tra hiện trạng ${machine.name}: ngoại quan đạt, nguồn ổn định, lỗi ghi nhận đúng theo phản ánh người dùng.`,
      repairMethod,
    },
  });

  await prisma.workLog.createMany({
    data: [
      { kind: 'REPAIR', repairId: repair.id, stepTime: reportedAt, title: 'Tiếp nhận lỗi', note: description, sortOrder: 1, createdById: engineer.id },
      { kind: 'REPAIR', repairId: repair.id, stepTime: dt(`2026-08-${10 + index}T03:30:00.000Z`), title: 'Kiểm tra tại hiện trường', note: 'Kiểm tra nguồn, kết nối, phụ kiện và log lỗi.', sortOrder: 2, createdById: engineer.id },
      { kind: 'REPAIR', repairId: repair.id, stepTime: dt(`2026-08-${10 + index}T05:30:00.000Z`), title: 'Xử lý kỹ thuật', note: repairMethod, sortOrder: 3, createdById: engineer.id },
    ],
  });

  await prisma.usedPart.createMany({
    data: [
      {
        kind: 'REPAIR',
        repairId: repair.id,
        name: index === 2 ? 'Sensor loader máy xét nghiệm' : index === 5 ? 'Giấy in nhiệt ECG chuẩn' : 'Dung dịch vệ sinh tiếp điểm thiết bị y tế',
        quantity: index === 5 ? 2 : 1,
        unit: index === 5 ? 'cuộn' : 'bộ',
        serialNumber: `${PREFIX}-PART-SC-${suffix}`,
        unitCost: index === 2 ? 2500000 : index === 5 ? 180000 : 120000,
        totalCost: index === 2 ? 2500000 : index === 5 ? 360000 : 120000,
        status: index === 2 ? 'WAITING' : 'USED',
        note: index === 2 ? 'Đang chờ xuất linh kiện thay thế.' : 'Đã sử dụng tại hiện trường.',
        usedAt: dt(`2026-08-${10 + index}T05:45:00.000Z`),
        createdById: engineer.id,
      },
    ],
  });

  await prisma.taskChecklistItem.createMany({
    data: [
      { kind: 'REPAIR', repairId: repair.id, label: 'Xác nhận lỗi với người dùng', status: 'DONE', note: 'Đã xác nhận.', sortOrder: 1, checkedAt: reportedAt, updatedById: engineer.id },
      { kind: 'REPAIR', repairId: repair.id, label: 'Kiểm tra serial/mã máy', status: 'DONE', note: machine.serialNumber, sortOrder: 2, checkedAt: reportedAt, updatedById: engineer.id },
      { kind: 'REPAIR', repairId: repair.id, label: 'Ghi nhận phương án xử lý', status: status === 'ASSIGNED' ? 'PENDING' : 'DONE', note: repairMethod, sortOrder: 3, checkedAt: status === 'ASSIGNED' ? null : reportedAt, updatedById: engineer.id },
      { kind: 'REPAIR', repairId: repair.id, label: 'Lấy phản hồi khách hàng', status: customerFeedback ? 'DONE' : 'PENDING', note: customerFeedback, sortOrder: 4, checkedAt: customerFeedback ? reportedAt : null, updatedById: engineer.id },
    ],
  });

  await createAttachment('Repair', repair.id, index, engineer);
  return repair;
}

async function createMaintenance(spec, customer, engineer, admin, machine, index) {
  const [suffix, title, department, type, status, resultNote, nextDueDate] = spec;
  const scheduledDate = dt(`2026-08-${17 + index}T02:00:00.000Z`);
  const isCompleted = status === 'COMPLETED';
  const maintenance = await prisma.maintenance.create({
    data: {
      code: `${PREFIX}-BT-${suffix}`,
      title,
      description: `${title} tại ${department}. Kiểm tra đầy đủ thông số vận hành, vệ sinh và hướng dẫn sử dụng.`,
      type,
      status,
      machineId: machine.id,
      customerId: customer.id,
      engineerId: engineer.id,
      scheduledDate,
      assignedAt: scheduledDate,
      startedAt: scheduledDate,
      completedAt: isCompleted ? dt(`2026-08-${17 + index}T08:00:00.000Z`) : null,
      checklist: [
        'Kiểm tra ngoại quan và tem nhãn',
        'Vệ sinh bề mặt, khe thông gió, phụ kiện',
        'Kiểm tra nguồn điện và tiếp địa',
        'Chạy test chức năng chính',
        'Ghi nhận khuyến nghị cho khách hàng',
      ],
      resultNote,
      nextDueDate: dt(nextDueDate),
      reviewStatus: isCompleted ? 'APPROVED' : 'PENDING',
      reviewNote: isCompleted ? 'Admin đã xác nhận bảo trì test.' : 'Đang chờ hoàn tất QC cuối ca.',
      reviewedAt: isCompleted ? dt(`2026-08-${17 + index}T08:30:00.000Z`) : null,
      reviewerId: isCompleted ? admin.id : null,
      usingDepartment: department,
      representative: department.includes('Xét nghiệm') ? 'CN. Trần Hồng Anh' : 'BS. Phạm Quốc Bảo',
      address: `${hospital.fullAddress} - ${department}`,
      contactPhone: `091400000${index}`,
      deviceName: machine.name,
      modelName: machine.modelName,
      serialNumber: machine.serialNumber,
    },
  });

  await prisma.workLog.createMany({
    data: [
      { kind: 'MAINTENANCE', maintenanceId: maintenance.id, stepTime: scheduledDate, title: 'Kiểm tra trước bảo trì', note: 'Ghi nhận hiện trạng máy và phụ kiện.', sortOrder: 1, createdById: engineer.id },
      { kind: 'MAINTENANCE', maintenanceId: maintenance.id, stepTime: dt(`2026-08-${17 + index}T03:30:00.000Z`), title: 'Thực hiện checklist bảo trì', note: resultNote, sortOrder: 2, createdById: engineer.id },
      { kind: 'MAINTENANCE', maintenanceId: maintenance.id, stepTime: dt(`2026-08-${17 + index}T06:00:00.000Z`), title: 'Hẹn lịch tiếp theo', note: `Lịch tiếp theo: ${nextDueDate.slice(0, 10)}.`, sortOrder: 3, createdById: engineer.id },
    ],
  });

  await prisma.usedPart.createMany({
    data: [
      {
        kind: 'MAINTENANCE',
        maintenanceId: maintenance.id,
        name: index === 1 ? 'Bộ vệ sinh đầu dò và gel test' : 'Dung dịch vệ sinh buồng đếm',
        quantity: 1,
        unit: 'bộ',
        serialNumber: `${PREFIX}-PART-BT-${suffix}`,
        unitCost: index === 1 ? 350000 : 420000,
        totalCost: index === 1 ? 350000 : 420000,
        status: 'USED',
        note: 'Vật tư tiêu hao sử dụng trong bảo trì.',
        usedAt: scheduledDate,
        createdById: engineer.id,
      },
    ],
  });

  await prisma.taskChecklistItem.createMany({
    data: [
      { kind: 'MAINTENANCE', maintenanceId: maintenance.id, label: 'Vệ sinh thiết bị', status: 'DONE', note: 'Hoàn tất.', sortOrder: 1, checkedAt: scheduledDate, updatedById: engineer.id },
      { kind: 'MAINTENANCE', maintenanceId: maintenance.id, label: 'Kiểm tra an toàn điện', status: 'DONE', note: 'Đạt.', sortOrder: 2, checkedAt: scheduledDate, updatedById: engineer.id },
      { kind: 'MAINTENANCE', maintenanceId: maintenance.id, label: 'Chạy test chức năng', status: status === 'COMPLETED' ? 'DONE' : 'PENDING', note: resultNote, sortOrder: 3, checkedAt: status === 'COMPLETED' ? scheduledDate : null, updatedById: engineer.id },
      { kind: 'MAINTENANCE', maintenanceId: maintenance.id, label: 'Hẹn lịch bảo trì tiếp theo', status: 'DONE', note: nextDueDate.slice(0, 10), sortOrder: 4, checkedAt: scheduledDate, updatedById: engineer.id },
    ],
  });

  await createAttachment('Maintenance', maintenance.id, index, engineer);
  return maintenance;
}

async function createReports(customer, engineer, repairRecords, maintenanceRecords, installationRecords) {
  const reportDate = dt('2026-08-10T00:00:00.000Z');
  await prisma.dailyReport.upsert({
    where: { userId_reportDate: { userId: engineer.id, reportDate } },
    update: {
      status: 'SUBMITTED',
      summary: `${hospital.name}: hoàn tất tạo bộ dữ liệu test gồm 3 lắp đặt, 5 sửa chữa, 2 bảo trì. Các phiếu có đủ máy, serial, khách hàng, liên hệ, nhật ký, checklist, vật tư và tài liệu.`,
      pending: 'Theo dõi phiếu sửa chữa chờ linh kiện loader và phiếu bảo trì đang chạy QC cuối ca.',
      proposal: 'Dùng bộ dữ liệu này để kiểm tra màn kỹ sư, báo cáo cá nhân, sổ công việc và hồ sơ khách hàng phụ trách.',
      submittedAt: dt('2026-08-10T11:00:00.000Z'),
    },
    create: {
      userId: engineer.id,
      reportDate,
      status: 'SUBMITTED',
      summary: `${hospital.name}: hoàn tất tạo bộ dữ liệu test gồm 3 lắp đặt, 5 sửa chữa, 2 bảo trì. Các phiếu có đủ máy, serial, khách hàng, liên hệ, nhật ký, checklist, vật tư và tài liệu.`,
      pending: 'Theo dõi phiếu sửa chữa chờ linh kiện loader và phiếu bảo trì đang chạy QC cuối ca.',
      proposal: 'Dùng bộ dữ liệu này để kiểm tra màn kỹ sư, báo cáo cá nhân, sổ công việc và hồ sơ khách hàng phụ trách.',
      submittedAt: dt('2026-08-10T11:00:00.000Z'),
    },
  });

  const weekStart = dt('2026-08-10T00:00:00.000Z');
  const weekly = await prisma.weeklyReport.upsert({
    where: { userId_weekStart: { userId: engineer.id, weekStart } },
    update: {
      status: 'DRAFT',
      note: `${PREFIX}: tuần test cho ${hospital.name}.`,
    },
    create: {
      userId: engineer.id,
      weekStart,
      status: 'DRAFT',
      note: `${PREFIX}: tuần test cho ${hospital.name}.`,
    },
  });

  await prisma.weeklyReportRow.deleteMany({ where: { reportId: weekly.id } });
  const rows = [
    ...installationRecords.map((item, index) => ({
      reportId: weekly.id,
      workDate: item.installedAt,
      customer: customer.name,
      machine: installSpecs[index].name,
      content: `Lắp đặt mới ${installSpecs[index].name}`,
      result: 'Hoàn tất bàn giao, chạy thử, bảo hành và hồ sơ phụ kiện.',
      pending: 'Không',
      proposal: 'Theo dõi sau lắp đặt trong 7 ngày.',
      sortOrder: index + 1,
    })),
    ...repairRecords.map((item, index) => ({
      reportId: weekly.id,
      workDate: item.reportedAt,
      customer: customer.name,
      machine: item.deviceName,
      content: item.title,
      result: item.resultNote || item.repairMethod || 'Đang xử lý',
      pending: item.status === 'WAITING_PARTS' ? 'Chờ linh kiện thay thế' : item.status === 'ASSIGNED' ? 'Chờ onsite' : 'Không',
      proposal: 'Cập nhật kết quả sau khi khách xác nhận.',
      sortOrder: installationRecords.length + index + 1,
    })),
    ...maintenanceRecords.map((item, index) => ({
      reportId: weekly.id,
      workDate: item.scheduledDate,
      customer: customer.name,
      machine: item.deviceName,
      content: item.title,
      result: item.resultNote,
      pending: item.status === 'IN_PROGRESS' ? 'Chờ chạy QC cuối ca' : 'Không',
      proposal: `Lịch bảo trì tiếp theo ${item.nextDueDate.toISOString().slice(0, 10)}.`,
      sortOrder: installationRecords.length + repairRecords.length + index + 1,
    })),
  ];
  await prisma.weeklyReportRow.createMany({ data: rows });
}

async function main() {
  console.log(`Preparing test data ${PREFIX}...`);
  const region = await ensureRegion();
  const engineer = await ensureEngineer(region.id);
  const admin = await ensureAdmin(region.id);
  const modelCodes = [...new Set([...installSpecs.map((spec) => spec.modelCode), ...extraRepairModelCodes])];
  const modelByCode = await getRequiredModels(modelCodes);

  await cleanup();

  const customer = await prisma.customer.create({
    data: {
      ...hospital,
      regionId: region.id,
      primaryEngineerId: engineer.id,
    },
  });

  const installModels = installSpecs.map((spec) => modelByCode.get(spec.modelCode));
  const extraModels = extraRepairModelCodes.map((code) => modelByCode.get(code));

  const machines = [];
  const installationRecords = [];
  for (let index = 0; index < installSpecs.length; index += 1) {
    const spec = installSpecs[index];
    const model = installModels[index];
    const machine = await createMachine(spec, customer, engineer, model, index + 1);
    machines.push(machine);
    installationRecords.push(await createInstallation(spec, customer, engineer, admin, model, machine, index + 1));
  }

  const extraMachines = [];
  for (let index = 0; index < extraModels.length; index += 1) {
    const model = extraModels[index];
    const machine = await createMachine(
      {
        machineCode: `${PREFIX}-MAY-SC-0${index + 4}`,
        serialNumber: `${PREFIX}-SN-SC-0${index + 4}`,
        name: `${model.name} - ${index === 0 ? 'Khoa Xét nghiệm' : 'Khoa Miễn dịch'}`,
        manufacturer: model.manufacturer || 'Theo model catalog',
        productCategory: model.productCategory,
        productLine: model.productLine || model.businessLine?.name || 'Thiết bị y tế',
        installDate: '2026-07-01T02:00:00.000Z',
        warrantyEndDate: '2027-07-01T16:59:59.000Z',
        accessories: [
          { code: 'POWER-CABLE', name: 'Dây nguồn chuẩn y tế', serialNumber: `${PREFIX}-ACC-SC-0${index + 4}-PWR`, description: 'Dây nguồn đi kèm máy' },
          { code: 'USER-MANUAL', name: 'Tài liệu hướng dẫn sử dụng', serialNumber: `${PREFIX}-ACC-SC-0${index + 4}-DOC`, description: 'Bộ tài liệu bàn giao' },
        ],
      },
      customer,
      engineer,
      model,
      index + 4,
    );
    extraMachines.push(machine);
  }

  const repairMachines = [machines[0], machines[1], machines[2], extraMachines[0], extraMachines[1]];
  const repairRecords = [];
  for (let index = 0; index < repairSpecs.length; index += 1) {
    repairRecords.push(await createRepair(repairSpecs[index], customer, engineer, admin, repairMachines[index], index + 1));
  }

  const maintenanceRecords = [];
  for (let index = 0; index < maintenanceSpecs.length; index += 1) {
    maintenanceRecords.push(await createMaintenance(maintenanceSpecs[index], customer, engineer, admin, machines[index], index + 1));
  }

  await createReports(customer, engineer, repairRecords, maintenanceRecords, installationRecords);

  console.log(JSON.stringify({
    ok: true,
    prefix: PREFIX,
    engineer: { id: engineer.id, email: engineer.email, fullName: engineer.fullName },
    customer: { id: customer.id, code: customer.customerCode, name: customer.name },
    counts: {
      installations: installationRecords.length,
      repairs: repairRecords.length,
      maintenances: maintenanceRecords.length,
      machines: machines.length + extraMachines.length,
    },
    links: {
      engineerTasks: '/my-tasks',
      customerProfile: `/my-customers?customerId=${customer.id}`,
      serviceTickets: '/service-tickets',
      weeklyReport: '/weekly-reports?weekStart=2026-08-10',
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

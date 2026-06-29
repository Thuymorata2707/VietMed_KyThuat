import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

type SeedTable =
  | 'Region'
  | 'Role'
  | 'User'
  | 'KnowledgeArticle'
  | 'EngineerProfile'
  | 'ProductIndustry'
  | 'Customer'
  | 'BusinessLine'
  | 'MachineModel'
  | 'MachineComponent'
  | 'ComponentAccessory'
  | 'Machine'
  | 'MachineAccessory'
  | 'MachineInventoryMovement'
  | 'Repair'
  | 'Maintenance'
  | 'MachineInstallation'
  | 'WarrantyCard'
  | 'Attachment'
  | 'AuditLog'
  | 'DailyWorkNote'
  | 'WeeklyReport'
  | 'WeeklyReportRow'
  | 'Notification';

type SeedSnapshot = {
  source: string;
  generatedAt: string;
  tables: Record<SeedTable, Record<string, unknown>[]>;
};

const snapshot = JSON.parse(
  readFileSync(join(__dirname, 'snapshot-data.json'), 'utf8'),
) as SeedSnapshot;

const createOrder: SeedTable[] = [
  'Region',
  'Role',
  'User',
  'KnowledgeArticle',
  'EngineerProfile',
  'ProductIndustry',
  'Customer',
  'BusinessLine',
  'MachineModel',
  'MachineComponent',
  'ComponentAccessory',
  'Machine',
  'MachineAccessory',
  'MachineInventoryMovement',
  'Repair',
  'Maintenance',
  'MachineInstallation',
  'WarrantyCard',
  'Attachment',
  'AuditLog',
  'DailyWorkNote',
  'WeeklyReport',
  'WeeklyReportRow',
  'Notification',
];

const deleteOrder: SeedTable[] = [...createOrder].reverse();

type SeedDelegate = {
  createMany: (args: { data: unknown[] }) => Promise<unknown>;
  deleteMany: () => Promise<unknown>;
};

const delegate = (value: unknown) => value as SeedDelegate;

const delegates: Record<SeedTable, SeedDelegate> = {
  Region: delegate(prisma.region),
  Role: delegate(prisma.role),
  User: delegate(prisma.user),
  KnowledgeArticle: delegate(prisma.knowledgeArticle),
  EngineerProfile: delegate(prisma.engineerProfile),
  ProductIndustry: delegate(prisma.productIndustry),
  Customer: delegate(prisma.customer),
  BusinessLine: delegate(prisma.businessLine),
  MachineModel: delegate(prisma.machineModel),
  MachineComponent: delegate(prisma.machineComponent),
  ComponentAccessory: delegate(prisma.componentAccessory),
  Machine: delegate(prisma.machine),
  MachineAccessory: delegate(prisma.machineAccessory),
  MachineInventoryMovement: delegate(prisma.machineInventoryMovement),
  Repair: delegate(prisma.repair),
  Maintenance: delegate(prisma.maintenance),
  MachineInstallation: delegate(prisma.machineInstallation),
  WarrantyCard: delegate(prisma.warrantyCard),
  Attachment: delegate(prisma.attachment),
  AuditLog: delegate(prisma.auditLog),
  DailyWorkNote: delegate(prisma.dailyWorkNote),
  WeeklyReport: delegate(prisma.weeklyReport),
  WeeklyReportRow: delegate(prisma.weeklyReportRow),
  Notification: delegate(prisma.notification),
};

const dateFields = new Set([
  'createdAt',
  'updatedAt',
  'deletedAt',
  'dateOfBirth',
  'workStartDate',
  'manufacturingDate',
  'warehouseImportDate',
  'installDate',
  'warrantyStartDate',
  'warrantyEndDate',
  'installedAt',
  'handoverDepartureDate',
  'issuedAt',
  'startDate',
  'endDate',
  'occurredAt',
  'scheduledDate',
  'assignedAt',
  'startedAt',
  'completedAt',
  'nextDueDate',
  'reportedAt',
  'workDate',
  'weekStart',
  'submittedAt',
  'reviewedAt',
  'readAt',
]);

async function main() {
  for (const table of deleteOrder) {
    await delegates[table].deleteMany();
  }

  for (const table of createOrder) {
    const rows = (snapshot.tables[table] ?? []).map(hydrateDates);

    if (rows.length === 0) {
      continue;
    }

    await delegates[table].createMany({ data: rows });
  }

  if ((snapshot.tables.KnowledgeArticle ?? []).length === 0) {
    const adminUser = await prisma.user.findFirst({
      where: { role: { name: { in: ['admin', 'Quản trị viên', 'quan tri vien'] } } },
      select: { id: true },
    });

    await prisma.knowledgeArticle.createMany({
      data: defaultKnowledgeArticles.map((article, index) => ({
        ...article,
        sortOrder: index + 1,
        createdById: adminUser?.id,
        updatedById: adminUser?.id,
      })),
    });
  }

  console.log(
    JSON.stringify(
      {
        seededFrom: snapshot.source,
        generatedAt: snapshot.generatedAt,
        counts: Object.fromEntries(
          createOrder.map((table) => [
            table,
            snapshot.tables[table]?.length ?? 0,
          ]),
        ),
      },
      null,
      2,
    ),
  );
}

const defaultKnowledgeArticles = [
  {
    title: 'Máy xét nghiệm huyết học báo tắc kim hút mẫu',
    summary: 'Cách khoanh vùng lỗi khi BC series báo tắc, hút mẫu yếu hoặc kết quả bất thường.',
    modelHint: 'BC-20s, BC-30s, BC-60s, BC-6800',
    ownerTeam: 'Nhóm xét nghiệm',
    category: 'COMMON_FAULT' as const,
    status: 'PUBLISHED' as const,
    tags: ['Huyết học', 'Mindray', 'Kim hút mẫu'],
    symptoms: ['Máy báo clog/aperture block.', 'Mẫu hút chậm hoặc không đủ thể tích.', 'Kết quả WBC/RBC/PLT dao động bất thường.'],
    steps: [
      'Hỏi khách hàng thời điểm phát sinh lỗi và loại mẫu chạy gần nhất.',
      'Kiểm tra hóa chất, mức dung dịch rửa, đường ống xả và bình thải.',
      'Chạy quy trình probe cleanser theo hướng dẫn từng model.',
      'Kiểm tra kim hút mẫu, tubing và bơm định lượng nếu lỗi lặp lại.',
      'Chạy QC sau xử lý và lưu ảnh màn hình kết quả vào phiếu.',
    ],
    checklist: ['Găng tay, khăn thấm, dung dịch rửa.', 'Ảnh cảnh báo lỗi trước/sau xử lý.', 'Kết quả QC hoặc mẫu kiểm chứng.'],
    note: 'Không tháo cụm kim khi chưa xả áp và chưa ghi nhận tình trạng ban đầu.',
  },
  {
    title: 'Máy siêu âm mất hình hoặc nhiễu mạnh',
    summary: 'Checklist nhanh để phân biệt lỗi đầu dò, cổng probe, setting hoặc bo xử lý hình ảnh.',
    modelHint: 'HD-350, X-CUBE 50, P series',
    ownerTeam: 'Nhóm CĐHA',
    category: 'COMMON_FAULT' as const,
    status: 'PUBLISHED' as const,
    tags: ['Siêu âm', 'Đầu dò', 'Hình ảnh'],
    symptoms: ['Màn hình có sọc/nhiễu.', 'Một đầu dò mất hình, đầu dò khác bình thường.', 'Freeze hoặc gain không phản hồi ổn định.'],
    steps: [
      'Chụp lại preset, đầu dò đang dùng và tình trạng hình ảnh.',
      'Đổi đầu dò sang cổng khác nếu máy có nhiều cổng.',
      'Kiểm tra chân connector, khóa đầu dò và vết nứt cáp.',
      'Reset preset hoặc thử exam type khác để loại trừ setting.',
      'Nếu nhiều đầu dò cùng lỗi, kiểm tra log và bo xử lý theo service manual.',
    ],
    checklist: ['Ảnh connector đầu dò.', 'Video ngắn mô tả nhiễu.', 'Tên preset và phiên bản phần mềm.'],
    note: 'Không kéo cáp đầu dò khi đầu dò còn khóa trên cổng máy.',
  },
  {
    title: 'Đóng hàng máy siêu âm dạng trolley',
    summary: 'Quy trình đóng máy trước khi chuyển kho, chuyển tỉnh hoặc gửi bảo hành.',
    modelHint: 'Máy siêu âm có trolley',
    ownerTeam: 'Kho máy',
    category: 'PACKING' as const,
    status: 'PUBLISHED' as const,
    tags: ['Đóng hàng', 'Siêu âm', 'Trolley'],
    symptoms: [],
    steps: [
      'Tắt máy đúng quy trình, rút nguồn và chờ máy nguội.',
      'Tháo đầu dò, bọc riêng từng đầu dò bằng túi chống sốc.',
      'Cố định màn hình, bàn phím, bánh xe và các khay phụ kiện.',
      'Bọc thân máy bằng màng PE, foam góc và lớp chống ẩm.',
      'Dán tem hướng đặt, tem dễ vỡ và ghi rõ danh sách phụ kiện đi kèm.',
    ],
    checklist: ['Biên bản tình trạng máy.', 'Ảnh 4 mặt trước khi đóng.', 'Danh sách đầu dò/phụ kiện.', 'Tem serial ngoài kiện.'],
    note: 'Đầu dò luôn đi hộp riêng hoặc khoang riêng, không đặt đè lên thân máy.',
  },
  {
    title: 'Chuẩn bị trước khi đi sửa chữa onsite',
    summary: 'Các bước cần có trước khi kỹ sư xuất phát để tránh thiếu linh kiện và thiếu thông tin lỗi.',
    modelHint: 'Tất cả model',
    ownerTeam: 'Điều phối kỹ thuật',
    category: 'REPAIR' as const,
    status: 'PUBLISHED' as const,
    tags: ['Onsite', 'Sửa chữa', 'Chuẩn bị'],
    symptoms: [],
    steps: [
      'Đọc phiếu lỗi, lịch sử bảo trì và lịch sử thay linh kiện của máy.',
      'Gọi xác nhận người phụ trách tại bệnh viện và thời gian được phép thao tác.',
      'Chuẩn bị linh kiện nghi ngờ, cáp, dụng cụ đo và vật tư tiêu hao.',
      'Kiểm tra phiên bản phần mềm hoặc tài liệu service cần mang theo.',
      'Cập nhật trạng thái di chuyển để admin và khách hàng theo dõi.',
    ],
    checklist: ['Phiếu lỗi.', 'Serial/model máy.', 'Dụng cụ đo.', 'Linh kiện nghi ngờ.', 'Thông tin liên hệ khách hàng.'],
    note: 'Nếu lỗi ảnh hưởng vận hành khoa, ưu tiên phương án tạm chạy an toàn trước khi xử lý triệt để.',
  },
  {
    title: 'Lắp đặt và bàn giao máy mới',
    summary: 'Khung thao tác từ nhận mặt bằng, lắp đặt, chạy thử đến ký nghiệm thu.',
    modelHint: 'Máy siêu âm, nội soi, xét nghiệm',
    ownerTeam: 'Nhóm lắp đặt',
    category: 'INSTALLATION' as const,
    status: 'PUBLISHED' as const,
    tags: ['Lắp đặt', 'Bàn giao', 'Nghiệm thu'],
    symptoms: [],
    steps: [
      'Kiểm tra mặt bằng, nguồn điện, tiếp địa, điều hòa và vị trí đặt máy.',
      'Đối chiếu serial máy, phụ kiện, đầu dò/module với phiếu xuất kho.',
      'Lắp đặt theo thứ tự cơ khí, nguồn, phụ kiện, kết nối mạng nếu có.',
      'Chạy test chức năng chính, in/lưu kết quả mẫu và chụp ảnh hiện trạng.',
      'Hướng dẫn vận hành cơ bản, vệ sinh, tắt mở máy và cảnh báo an toàn.',
      'Ký biên bản bàn giao, nghiệm thu và cập nhật hồ sơ máy.',
    ],
    checklist: ['Biên bản lắp đặt.', 'Ảnh serial.', 'Ảnh vị trí máy.', 'Kết quả test.', 'Thông tin người nhận bàn giao.'],
    note: 'Không nghiệm thu khi nguồn điện hoặc tiếp địa chưa đạt điều kiện tối thiểu.',
  },
  {
    title: 'Bảo trì định kỳ theo quý',
    summary: 'Checklist chung cho các máy đang hoạt động tại khách hàng.',
    modelHint: 'Tất cả model đang vận hành',
    ownerTeam: 'Nhóm bảo trì',
    category: 'MAINTENANCE' as const,
    status: 'PUBLISHED' as const,
    tags: ['Bảo trì', 'Checklist', 'Định kỳ'],
    symptoms: [],
    steps: [
      'Ghi nhận số giờ chạy, số lần test hoặc counter liên quan.',
      'Vệ sinh bề mặt, khe gió, lọc bụi, khu vực lấy mẫu hoặc cổng kết nối.',
      'Kiểm tra cảnh báo tồn đọng, log lỗi và tình trạng phụ kiện tiêu hao.',
      'Chạy kiểm tra chức năng chính theo từng dòng máy.',
      'Khuyến nghị vật tư cần thay trong kỳ tới và cập nhật phiếu bảo trì.',
    ],
    checklist: ['Ảnh trước/sau bảo trì.', 'Log lỗi nếu có.', 'Counter máy.', 'Khuyến nghị vật tư.'],
    note: 'Luôn hỏi khách hàng về lỗi nhỏ lặp lại, vì nhiều lỗi không xuất hiện trong ngày bảo trì.',
  },
  {
    title: 'An toàn điện trước khi thao tác máy',
    summary: 'Các điểm cần kiểm tra trước khi mở vỏ máy, đo nguồn hoặc thay linh kiện.',
    modelHint: 'Tất cả model',
    ownerTeam: 'Quản lý kỹ thuật',
    category: 'SAFETY' as const,
    status: 'PUBLISHED' as const,
    tags: ['An toàn', 'Nguồn điện', 'Linh kiện'],
    symptoms: [],
    steps: [
      'Tắt máy đúng quy trình và rút nguồn khỏi ổ cắm.',
      'Chờ tụ xả theo khuyến nghị của từng dòng máy.',
      'Dùng đồng hồ đo xác nhận điểm nguồn đã an toàn trước khi chạm tay.',
      'Đeo vòng chống tĩnh điện khi thao tác bo mạch.',
      'Chỉ cấp nguồn lại khi tất cả connector, vỏ che và dây tiếp địa đã đúng vị trí.',
    ],
    checklist: ['Đồng hồ đo.', 'Găng tay phù hợp.', 'Vòng ESD.', 'Ảnh connector trước khi tháo.'],
    note: 'Nếu môi trường ẩm hoặc nguồn không ổn định, dừng thao tác và báo quản lý kỹ thuật.',
  },
];

function hydrateDates(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      dateFields.has(key) && typeof value === 'string'
        ? new Date(value)
        : value,
    ]),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

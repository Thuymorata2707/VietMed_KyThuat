export type MedicalChecklistScope = 'installation' | 'maintenance' | 'repair' | 'review';

export type MedicalChecklistCategory =
  | 'ULTRASOUND'
  | 'ENDOSCOPY'
  | 'LAB_TESTING'
  | 'BIOCHEMISTRY'
  | 'IMMUNOLOGY'
  | 'HEMATOLOGY'
  | 'X_RAY'
  | 'OTHER';

const commonInstallation = [
  'Đối chiếu model, serial máy và phụ kiện thực tế',
  'Chụp ảnh tem serial máy trước khi bàn giao',
  'Kiểm tra nguồn điện, tiếp địa và vị trí lắp đặt',
  'Chạy thử chức năng chính cùng khách hàng',
  'Lập biên bản bàn giao có chữ ký/đóng dấu nếu có',
  'Ghi nhận ngày bắt đầu và kết thúc bảo hành',
];

const commonMaintenance = [
  'Kiểm tra ngoại quan, vệ sinh máy và khu vực thao tác',
  'Kiểm tra nguồn điện, dây nguồn, tiếp địa và kết nối ngoại vi',
  'Kiểm tra cảnh báo/lỗi đang hiển thị trên máy',
  'Chạy thử chức năng chính sau bảo trì',
  'Chụp ảnh serial và ảnh tổng thể sau bảo trì',
  'Ghi lịch bảo trì tiếp theo',
];

const commonRepair = [
  'Xác nhận hiện tượng lỗi với người dùng tại khoa/phòng',
  'Chụp ảnh lỗi, ảnh serial và tình trạng máy trước xử lý',
  'Ghi rõ nguyên nhân sơ bộ và phương án xử lý',
  'Ghi nhận linh kiện/phụ kiện đã thay hoặc cần chờ',
  'Chạy thử lại chức năng liên quan sau xử lý',
  'Ghi phản hồi khách hàng sau khi bàn giao lại',
];

export const medicalDeviceChecklists: Record<MedicalChecklistCategory, Record<MedicalChecklistScope, string[]>> = {
  ULTRASOUND: {
    installation: [
      ...commonInstallation,
      'Kiểm tra đủ đầu dò theo cấu hình bán hàng',
      'Kiểm tra cổng đầu dò và khóa đầu dò',
      'Test hình ảnh từng đầu dò ở preset phù hợp',
      'Lưu ảnh test mẫu nếu khách hàng yêu cầu',
    ],
    maintenance: [
      ...commonMaintenance,
      'Kiểm tra mặt tinh thể, dây và strain relief của từng đầu dò',
      'Kiểm tra cổng đầu dò, trackball, bàn phím và monitor',
      'Test hình ảnh từng đầu dò sau vệ sinh',
    ],
    repair: [
      ...commonRepair,
      'Xác định lỗi thuộc máy chính, đầu dò, nguồn hoặc màn hình',
      'Nếu lỗi đầu dò, ghi rõ mã đầu dò và S/N đầu dò',
      'Test lại ít nhất một đầu dò sau xử lý',
    ],
    review: [
      'Có ảnh serial máy và ảnh đầu dò liên quan',
      'Có kết quả test hình ảnh sau xử lý/lắp đặt',
      'Đã khai báo đủ đầu dò/phụ kiện đi kèm',
      'Có phản hồi hoặc xác nhận từ khách hàng',
    ],
  },
  ENDOSCOPY: {
    installation: [
      ...commonInstallation,
      'Đối chiếu checklist phụ kiện nội soi tiêu hóa',
      'Kiểm tra bộ xử lý, nguồn sáng, màn hình và dây soi',
      'Kiểm tra van khí/nước, van hút, bình nước và bộ thử dò rỉ',
      'Test hình ảnh, cân bằng trắng và nguồn sáng',
    ],
    maintenance: [
      ...commonMaintenance,
      'Kiểm tra dây soi, đầu nối, van khí/nước và van hút',
      'Kiểm tra rò rỉ theo quy trình của dây soi',
      'Kiểm tra cân bằng trắng, hình ảnh và nguồn sáng',
    ],
    repair: [
      ...commonRepair,
      'Ghi rõ lỗi thuộc bộ xử lý, nguồn sáng, dây soi hay phụ kiện',
      'Kiểm tra dò rỉ nếu có can thiệp dây soi',
      'Test hình ảnh và cân bằng trắng sau xử lý',
    ],
    review: [
      'Có ảnh serial bộ xử lý/nguồn sáng/dây soi nếu liên quan',
      'Có checklist phụ kiện nội soi khi lắp đặt hoặc thu hồi',
      'Có kết quả test hình ảnh/cân bằng trắng',
      'Có ghi nhận tình trạng dò rỉ nếu liên quan dây soi',
    ],
  },
  LAB_TESTING: {
    installation: [
      ...commonInstallation,
      'Kiểm tra nước, xả thải, nhiệt độ và vị trí đặt máy',
      'Kiểm tra reagent/sample probe, cuvette hoặc module xét nghiệm',
      'Chạy thử bằng mẫu QC hoặc mẫu kiểm tra phù hợp',
    ],
    maintenance: [
      ...commonMaintenance,
      'Kiểm tra đường nước, đường thải, probe và buồng phản ứng',
      'Vệ sinh khu vực hút mẫu/hóa chất theo khuyến cáo',
      'Ghi nhận QC/calibration nếu có thực hiện',
    ],
    repair: [
      ...commonRepair,
      'Ghi rõ module lỗi, mã lỗi và điều kiện phát sinh lỗi',
      'Ghi nhận reagent/QC/calibration nếu ảnh hưởng kết quả xét nghiệm',
      'Chạy kiểm tra lại sau xử lý',
    ],
    review: [
      'Có ảnh mã lỗi hoặc log lỗi nếu có',
      'Có kết quả chạy thử/QC sau xử lý',
      'Có ghi nhận vật tư, hóa chất hoặc linh kiện liên quan',
      'Có lịch bảo trì/kiểm tra lại nếu cần',
    ],
  },
  BIOCHEMISTRY: {
    installation: [],
    maintenance: [],
    repair: [],
    review: [],
  },
  IMMUNOLOGY: {
    installation: [],
    maintenance: [],
    repair: [],
    review: [],
  },
  HEMATOLOGY: {
    installation: [],
    maintenance: [],
    repair: [],
    review: [],
  },
  X_RAY: {
    installation: [
      ...commonInstallation,
      'Kiểm tra nguồn điện, tiếp địa, phòng đặt máy và điều kiện an toàn',
      'Kiểm tra detector, workstation, cáp kết nối và phụ kiện',
      'Chạy thử chụp ảnh mẫu và kiểm tra chất lượng ảnh',
    ],
    maintenance: [
      ...commonMaintenance,
      'Kiểm tra detector, bàn chụp, cáp kết nối và workstation',
      'Kiểm tra cảnh báo an toàn và chất lượng ảnh',
      'Ghi nhận thông số test nếu có',
    ],
    repair: [
      ...commonRepair,
      'Ghi rõ lỗi thuộc nguồn phát, detector, workstation hay cơ khí',
      'Chụp ảnh lỗi hoặc log lỗi trên workstation',
      'Test lại chất lượng ảnh sau xử lý',
    ],
    review: [
      'Có ảnh/log lỗi nếu có',
      'Có kết quả test ảnh sau xử lý/lắp đặt',
      'Có ghi nhận điều kiện an toàn và nguồn điện nếu liên quan',
      'Có biên bản nghiệm thu/bàn giao nếu hoàn tất',
    ],
  },
  OTHER: {
    installation: commonInstallation,
    maintenance: commonMaintenance,
    repair: commonRepair,
    review: [
      'Có ảnh serial thiết bị',
      'Có ghi chú kỹ thuật rõ kết quả xử lý',
      'Có tài liệu/biên bản phù hợp với loại việc',
      'Có thông tin khách hàng và người xác nhận nếu hoàn tất',
    ],
  },
};

medicalDeviceChecklists.BIOCHEMISTRY = medicalDeviceChecklists.LAB_TESTING;
medicalDeviceChecklists.IMMUNOLOGY = medicalDeviceChecklists.LAB_TESTING;
medicalDeviceChecklists.HEMATOLOGY = medicalDeviceChecklists.LAB_TESTING;

export function normalizeMedicalCategory(value?: string | null): MedicalChecklistCategory {
  const normalized = (value || '').toUpperCase();
  if (normalized.includes('ULTRASOUND')) return 'ULTRASOUND';
  if (normalized.includes('ENDOSCOPY')) return 'ENDOSCOPY';
  if (normalized.includes('BIOCHEM')) return 'BIOCHEMISTRY';
  if (normalized.includes('IMMUNO')) return 'IMMUNOLOGY';
  if (normalized.includes('HEMATO')) return 'HEMATOLOGY';
  if (normalized.includes('LAB')) return 'LAB_TESTING';
  if (normalized.includes('X_RAY') || normalized.includes('XRAY') || normalized.includes('X-RAY')) return 'X_RAY';
  return 'OTHER';
}

export function checklistForCategory(value: string | null | undefined, scope: MedicalChecklistScope) {
  const category = normalizeMedicalCategory(value);
  return medicalDeviceChecklists[category][scope].length
    ? medicalDeviceChecklists[category][scope]
    : medicalDeviceChecklists.OTHER[scope];
}

export function appendChecklistLines(current: string, lines: string[]) {
  const existing = new Set(current.split('\n').map((item) => item.trim()).filter(Boolean));
  const next = [...current.split('\n').map((item) => item.trim()).filter(Boolean)];
  lines.forEach((line) => {
    if (!existing.has(line)) next.push(line);
  });
  return next.join('\n');
}

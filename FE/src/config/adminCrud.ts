import { ResourceConfig } from './resources';
import { enumOptions } from '../utils/displayLabels';

export type CrudField = {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'url' | 'image' | 'date' | 'select' | 'textarea' | 'tags' | 'accessories';
  required?: boolean;
  createOnly?: boolean;
  updateOnly?: boolean;
  detailOnly?: boolean;
  valuePath?: string;
  options?: Array<{ label: string; value: string }>;
  optionSource?: {
    endpoint: string;
    labelPath: string;
    labelPaths?: string[];
    searchable?: boolean;
    valuePath: string;
    filterPath?: string;
    filterValues?: string[];
  };
  wide?: boolean;
};

export type AdminCrudConfig = ResourceConfig & {
  entityLabel: string;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  fields: CrudField[];
};

const customerTypes = enumOptions(['HOSPITAL', 'CLINIC', 'LAB', 'DISTRIBUTOR', 'UNIVERSITY', 'COMPANY', 'OTHER']);

const customerStatuses = enumOptions(['ACTIVE', 'INACTIVE', 'POTENTIAL', 'BLACKLISTED']);

const activeInactiveStatuses = enumOptions(['ACTIVE', 'INACTIVE']);

const productCategories = enumOptions([
  'ULTRASOUND',
  'LAB_TESTING',
  'BIOCHEMISTRY',
  'IMMUNOLOGY',
  'HEMATOLOGY',
  'X_RAY',
  'ENDOSCOPY',
  'OTHER',
]);

const expertiseGroups = [
  { label: 'Chẩn đoán hình ảnh', value: 'IMAGING' },
  { label: 'Xét nghiệm', value: 'LAB_TESTING' },
];

const yesNoOptions = [
  { label: 'Có', value: 'true' },
  { label: 'Không', value: 'false' },
];

const machineStatuses = enumOptions(['ACTIVE', 'MAINTENANCE', 'REPAIRING', 'INACTIVE']);

const inventoryStatuses = enumOptions(['IN_STOCK', 'ACCESSORY_SPLIT', 'INSTALLED', 'RESERVED', 'RETURNED', 'SOLD']);

const dataStatuses = enumOptions(['PENDING_REVIEW', 'VERIFIED', 'NEEDS_UPDATE']);

const createdSources = enumOptions(['ADMIN', 'ENGINEER', 'IMPORT', 'SYSTEM']);

const repairPriorities = enumOptions(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

const repairStatuses = enumOptions(['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED']);

const maintenanceStatuses = enumOptions(['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED', 'CANCELLED']);

const installationStatuses = enumOptions(['PENDING', 'INSTALLED', 'CANCELLED']);

const maintenanceTypes = enumOptions(['PERIODIC', 'WARRANTY', 'CONTRACT', 'INTERNAL', 'OTHER']);

const engineerOptionSource = {
  endpoint: '/users?limit=20&roleName=engineer',
  labelPath: 'fullName',
  labelPaths: ['fullName', 'email', 'region.name'],
  searchable: true,
  valuePath: 'id',
};

const customerOptionSource = {
  endpoint: '/customers?limit=20',
  labelPath: 'name',
  labelPaths: ['customerCode', 'name', 'province', 'phone'],
  searchable: true,
  valuePath: 'id',
};

const machineOptionSource = {
  endpoint: '/machines?limit=20',
  labelPath: 'serialNumber',
  labelPaths: ['machineCode', 'serialNumber', 'modelName', 'customer.name', 'inventoryStatus'],
  searchable: true,
  valuePath: 'id',
};

const machineModelOptionSource = {
  endpoint: '/machine-models?limit=20',
  labelPath: 'code',
  labelPaths: ['code', 'name', 'manufacturer', 'businessLine.name'],
  searchable: true,
  valuePath: 'id',
};

const businessLineOptionSource = {
  endpoint: '/business-lines?limit=20',
  labelPath: 'name',
  labelPaths: ['productIndustry.name', 'name'],
  searchable: true,
  valuePath: 'id',
};

const inventoryMovementTypes = enumOptions(['IMPORT', 'SPLIT_ACCESSORY', 'RESERVE', 'INSTALL', 'RETURN', 'SELL', 'ADJUST_STATUS'], {
  IMPORT: 'Nhập kho',
});

export const adminCrudConfigs: Record<string, AdminCrudConfig> = {
  customers: {
    title: 'Khách hàng',
    entityLabel: 'khách hàng',
    description: 'Tạo, cập nhật và xóa hồ sơ khách hàng theo khu vực phụ trách.',
    endpoint: '/customers',
    icon: null,
    searchPlaceholder: 'Tìm tên, mã, email, điện thoại',
    roles: ['admin'],
    columns: [
      { key: 'name', label: 'Tên khách hàng' },
      { key: 'customerCode', label: 'Mã' },
      { key: 'customerType', label: 'Loại' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'region.name', label: 'Khu vực' },
    ],
    fields: [
      { name: 'name', label: 'Tên khách hàng', required: true },
      { name: 'customerCode', label: 'Mã khách hàng' },
      { name: 'customerType', label: 'Loại khách hàng', type: 'select', options: customerTypes },
      { name: 'status', label: 'Trạng thái', type: 'select', options: customerStatuses },
      {
        name: 'regionId',
        label: 'Khu vực',
        type: 'select',
        required: true,
        valuePath: 'region.id',
        optionSource: { endpoint: '/regions', labelPath: 'name', valuePath: 'id' },
      },
      { name: 'phone', label: 'Điện thoại' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'taxCode', label: 'Mã số thuế' },
      { name: 'contactPerson', label: 'Người liên hệ' },
      { name: 'contactPhone', label: 'SĐT liên hệ' },
      { name: 'contactEmail', label: 'Email liên hệ', type: 'email' },
      { name: 'province', label: 'Tỉnh/Thành' },
      { name: 'district', label: 'Quận/Huyện' },
      { name: 'address', label: 'Địa chỉ' },
      { name: 'note', label: 'Ghi chú', type: 'textarea' },
    ],
  },
  'business-lines': {
    title: 'Nhóm sản phẩm',
    entityLabel: 'nhóm sản phẩm',
    description: 'Tạo và cập nhật nhóm sản phẩm trong từng ngành lớn. Hãng sản xuất nằm ở từng model máy.',
    endpoint: '/business-lines',
    icon: null,
    searchPlaceholder: 'Tìm sản phẩm hoặc mã',
    roles: ['admin'],
    columns: [
      { key: 'imageUrl', label: 'Ảnh' },
      { key: 'name', label: 'Nhóm sản phẩm' },
      { key: 'code', label: 'Mã' },
      { key: 'productIndustry.name', label: 'Ngành hàng' },
      { key: 'expertiseGroup', label: 'Nhóm chuyên môn' },
      { key: 'productCategory', label: 'Loại thiết bị' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'manager.fullName', label: 'Quản lý' },
    ],
    fields: [
      { name: 'code', label: 'Mã nhóm', required: true },
      { name: 'name', label: 'Tên nhóm sản phẩm', required: true },
      {
        name: 'productIndustryId',
        label: 'Ngành hàng',
        type: 'select',
        required: true,
        wide: true,
        valuePath: 'productIndustry.id',
        optionSource: { endpoint: '/product-industries?limit=100', labelPath: 'name', valuePath: 'id' },
      },
      { name: 'status', label: 'Trạng thái', type: 'select', options: activeInactiveStatuses },
      { name: 'expertiseGroup', label: 'Nhóm chuyên môn', type: 'select', required: true, options: expertiseGroups },
      { name: 'imageUrl', label: 'Hình ảnh nhóm', type: 'image' },
      { name: 'productCategory', label: 'Loại thiết bị', type: 'select', options: productCategories },
      {
        name: 'managerId',
        label: 'Quản lý',
        type: 'select',
        valuePath: 'manager.id',
        optionSource: { endpoint: '/users', labelPath: 'fullName', labelPaths: ['fullName', 'email'], searchable: true, valuePath: 'id' },
      },
      { name: 'description', label: 'Mô tả', type: 'textarea' },
      { name: 'note', label: 'Ghi chú', type: 'textarea' },
    ],
  },
  'product-industries': {
    title: 'Ngành hàng',
    entityLabel: 'ngành hàng',
    description: '4 ngành hàng lớn của hệ thống. Đây là tầng cố định, chỉ nên sửa tên/thứ tự khi thật sự cần.',
    endpoint: '/product-industries',
    icon: null,
    searchPlaceholder: 'Tìm ngành hàng',
    roles: ['admin'],
    canCreate: false,
    canDelete: false,
    columns: [
      { key: 'name', label: 'Ngành hàng' },
      { key: 'code', label: 'Mã' },
      { key: 'expertiseGroup', label: 'Nhóm kỹ sư quản lý' },
      { key: 'sortOrder', label: 'Thứ tự' },
      { key: 'status', label: 'Trạng thái' },
    ],
    fields: [
      { name: 'code', label: 'Mã ngành hàng', required: true },
      { name: 'name', label: 'Tên ngành hàng', required: true },
      { name: 'expertiseGroup', label: 'Nhóm kỹ sư quản lý', type: 'select', required: true, options: expertiseGroups },
      { name: 'sortOrder', label: 'Thứ tự' },
      { name: 'status', label: 'Trạng thái', type: 'select', options: activeInactiveStatuses },
      { name: 'description', label: 'Mô tả', type: 'textarea' },
    ],
  },
  'machine-models': {
    title: 'Sản phẩm / Model máy',
    entityLabel: 'sản phẩm/model máy',
    description: 'Danh mục model cố định của công ty. Máy nhập kho có S/N và phụ kiện riêng sẽ nằm ở bảng Thiết bị.',
    endpoint: '/machine-models',
    icon: null,
    searchPlaceholder: 'Tìm model hoặc mã',
    roles: ['admin'],
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    columns: [
      { key: 'code', label: 'Mã' },
      { key: 'name', label: 'Tên sản phẩm/model' },
      { key: 'manufacturer', label: 'Hãng' },
      { key: 'productCategory', label: 'Loại thiết bị' },
      { key: 'businessLine.name', label: 'Nhóm sản phẩm' },
    ],
    fields: [
      {
        name: 'businessLineId',
        label: 'Nhóm sản phẩm',
        type: 'select',
        required: true,
        wide: true,
        valuePath: 'businessLine.id',
        optionSource: businessLineOptionSource,
      },
      { name: 'code', label: 'Mã sản phẩm/model', required: true },
      { name: 'name', label: 'Tên sản phẩm/model', required: true },
      { name: 'displayName', label: 'Tên hiển thị' },
      { name: 'status', label: 'Trạng thái', type: 'select', options: activeInactiveStatuses },
      { name: 'manufacturer', label: 'Hãng sản xuất', required: true },
      { name: 'productCategory', label: 'Loại thiết bị', type: 'select', options: productCategories },
      { name: 'productLine', label: 'Dòng sản phẩm' },
      { name: 'description', label: 'Mô tả', type: 'textarea' },
      { name: 'note', label: 'Ghi chú', type: 'textarea' },
    ],
  },
  'machine-components': {
    title: 'Thành phần máy',
    entityLabel: 'thành phần máy',
    description: 'Khai báo thành phần chuẩn thuộc từng model sản phẩm để dùng khi nhập/lắp đặt.',
    endpoint: '/machine-components',
    icon: null,
    searchPlaceholder: 'Tìm thành phần, model hoặc mã',
    roles: ['admin'],
    columns: [
      { key: 'name', label: 'Thành phần' },
      { key: 'code', label: 'Mã' },
      { key: 'machineModel.code', label: 'Model' },
      { key: 'machineModel.businessLine.name', label: 'Nhóm sản phẩm' },
      { key: 'status', label: 'Trạng thái' },
    ],
    fields: [
      {
        name: 'machineModelId',
        label: 'Model',
        type: 'select',
        required: true,
        valuePath: 'machineModel.id',
        optionSource: machineModelOptionSource,
      },
      { name: 'code', label: 'Mã thành phần', required: true },
      { name: 'name', label: 'Tên thành phần', required: true },
      { name: 'sortOrder', label: 'Thứ tự' },
      { name: 'status', label: 'Trạng thái', type: 'select', options: activeInactiveStatuses },
      { name: 'description', label: 'Mô tả', type: 'textarea' },
    ],
  },
  'component-accessories': {
    title: 'Phụ kiện',
    entityLabel: 'phụ kiện',
    description: 'Khai báo phụ kiện thuộc thành phần máy và yêu cầu nhập serial khi bàn giao.',
    endpoint: '/component-accessories',
    icon: null,
    searchPlaceholder: 'Tìm phụ kiện, thành phần hoặc mã',
    roles: ['admin'],
    columns: [
      { key: 'name', label: 'Phụ kiện' },
      { key: 'code', label: 'Mã' },
      { key: 'component.name', label: 'Thành phần' },
      { key: 'component.machineModel.code', label: 'Model' },
      { key: 'requiresSerial', label: 'Cần S/N' },
      { key: 'status', label: 'Trạng thái' },
    ],
    fields: [
      {
        name: 'componentId',
        label: 'Thành phần máy',
        type: 'select',
        required: true,
        valuePath: 'component.id',
        optionSource: { endpoint: '/machine-components?limit=100', labelPath: 'name', labelPaths: ['machineModel.code', 'name'], valuePath: 'id' },
      },
      { name: 'code', label: 'Mã phụ kiện', required: true },
      { name: 'name', label: 'Tên phụ kiện', required: true },
      { name: 'requiresSerial', label: 'Cần nhập Serial Number', type: 'select', options: yesNoOptions },
      { name: 'sortOrder', label: 'Thứ tự' },
      { name: 'status', label: 'Trạng thái', type: 'select', options: activeInactiveStatuses },
      { name: 'description', label: 'Mô tả', type: 'textarea' },
    ],
  },
  machines: {
    title: 'Thiết bị',
    entityLabel: 'thiết bị',
    description: 'Tạo, cập nhật và xóa từng máy thực tế theo model, serial và phụ kiện đi kèm.',
    endpoint: '/machines',
    icon: null,
    searchPlaceholder: 'Tìm mã máy, serial, model',
    roles: ['admin'],
    columns: [
      { key: 'machineCode', label: 'Mã máy' },
      { key: 'serialNumber', label: 'Serial' },
      { key: 'modelName', label: 'Model' },
      { key: 'status', label: 'Vận hành' },
      { key: 'inventoryStatus', label: 'Tồn kho' },
      { key: 'dataStatus', label: 'Xác nhận' },
      { key: 'createdSource', label: 'Nguồn tạo' },
    ],
    fields: [
      { name: 'serialNumber', label: 'Serial', required: true },
      { name: 'machineCode', label: 'Mã máy' },
      {
        name: 'machineModelId',
        label: 'Model máy',
        type: 'select',
        required: true,
        wide: true,
        valuePath: 'machineModel.id',
        optionSource: machineModelOptionSource,
      },
      { name: 'name', label: 'Tên máy' },
      { name: 'status', label: 'Trạng thái vận hành', type: 'select', options: machineStatuses },
      { name: 'inventoryStatus', label: 'Trạng thái kho', type: 'select', options: inventoryStatuses, detailOnly: true },
      { name: 'dataStatus', label: 'Trạng thái xác nhận', type: 'select', options: dataStatuses },
      { name: 'createdSource', label: 'Nguồn tạo dữ liệu', type: 'select', options: createdSources },
      {
        name: 'customerId',
        label: 'Khách hàng',
        type: 'select',
        valuePath: 'customer.id',
        optionSource: customerOptionSource,
      },
      {
        name: 'installedById',
        label: 'Kỹ sư lắp đặt',
        type: 'select',
        valuePath: 'installedBy.id',
        optionSource: engineerOptionSource,
      },
      {
        name: 'primaryEngineerId',
        label: 'Kỹ sư phụ trách',
        type: 'select',
        valuePath: 'primaryEngineer.id',
        optionSource: engineerOptionSource,
      },
      { name: 'installDate', label: 'Ngày lắp', type: 'date' },
      { name: 'warrantyStartDate', label: 'Bắt đầu bảo hành', type: 'date' },
      { name: 'warrantyEndDate', label: 'Kết thúc bảo hành', type: 'date' },
      {
        name: 'accessories',
        label: 'Phụ kiện đi kèm',
        type: 'accessories',
        wide: true,
      },
    ],
  },
  repairs: {
    title: 'Sửa chữa',
    entityLabel: 'phiếu sửa chữa',
    description: 'Tạo, cập nhật, phân kỹ sư và xóa phiếu sửa chữa.',
    endpoint: '/repairs',
    icon: null,
    searchPlaceholder: 'Tìm tiêu đề, mã máy, kỹ sư',
    roles: ['admin'],
    columns: [
      { key: 'title', label: 'Tiêu đề' },
      { key: 'machine.machineCode', label: 'Mã máy' },
      { key: 'priority', label: 'Ưu tiên' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'createdBy.fullName', label: 'Người tạo' },
      { key: 'engineer.fullName', label: 'Kỹ sư xử lý' },
    ],
    fields: [
      { name: 'title', label: 'Tiêu đề', required: true },
      { name: 'description', label: 'Mô tả', type: 'textarea' },
      { name: 'usingDepartment', label: 'Đơn vị sử dụng thiết bị' },
      { name: 'representative', label: 'Người đại diện' },
      { name: 'address', label: 'Địa chỉ', wide: true },
      { name: 'contactPhone', label: 'Số điện thoại' },
      { name: 'deviceName', label: 'Tên thiết bị' },
      { name: 'modelName', label: 'Model' },
      { name: 'serialNumber', label: 'S/N' },
      {
        name: 'warrantyStatus',
        label: 'Thời hạn bảo hành',
        type: 'select',
        options: [
          { label: 'Còn bảo hành', value: 'IN_WARRANTY' },
          { label: 'Hết bảo hành', value: 'OUT_OF_WARRANTY' },
        ],
      },
      { name: 'conditionAssessment', label: 'Kiểm tra tình trạng thiết bị', type: 'textarea' },
      { name: 'repairMethod', label: 'Phương pháp sửa chữa', type: 'textarea' },
      {
        name: 'machineId',
        label: 'Thiết bị',
        type: 'select',
        required: true,
        createOnly: true,
        valuePath: 'machine.id',
        optionSource: { ...machineOptionSource, endpoint: '/machines?limit=20&inventoryStatus=INSTALLED' },
      },
      {
        name: 'engineerId',
        label: 'Kỹ sư xử lý',
        type: 'select',
        valuePath: 'engineer.id',
        optionSource: engineerOptionSource,
      },
      { name: 'priority', label: 'Ưu tiên', type: 'select', options: repairPriorities },
      { name: 'status', label: 'Trạng thái xử lý', type: 'select', options: repairStatuses, updateOnly: true },
      { name: 'reportedAt', label: 'Ngày báo lỗi', type: 'date', createOnly: true },
      { name: 'resultNote', label: 'Kết quả xử lý', type: 'textarea', updateOnly: true },
      { name: 'customerFeedback', label: 'Phản hồi khách hàng', type: 'textarea', updateOnly: true },
    ],
  },
  maintenance: {
    title: 'Bảo trì',
    entityLabel: 'phiếu bảo trì',
    description: 'Tạo, cập nhật, phân kỹ sư và xóa lịch bảo trì.',
    endpoint: '/maintenance',
    icon: null,
    searchPlaceholder: 'Tìm tiêu đề, mã máy, kỹ sư',
    roles: ['admin'],
    columns: [
      { key: 'title', label: 'Tiêu đề' },
      { key: 'machine.machineCode', label: 'Mã máy' },
      { key: 'type', label: 'Loại' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'scheduledDate', label: 'Lịch hẹn' },
      { key: 'engineer.fullName', label: 'Kỹ sư' },
    ],
    fields: [
      { name: 'title', label: 'Tiêu đề', required: true },
      { name: 'description', label: 'Mô tả', type: 'textarea' },
      { name: 'type', label: 'Loại bảo trì', type: 'select', options: maintenanceTypes },
      {
        name: 'machineId',
        label: 'Thiết bị',
        type: 'select',
        required: true,
        createOnly: true,
        valuePath: 'machine.id',
        optionSource: { ...machineOptionSource, endpoint: '/machines?limit=20&inventoryStatus=INSTALLED' },
      },
      {
        name: 'engineerId',
        label: 'Kỹ sư',
        type: 'select',
        valuePath: 'engineer.id',
        optionSource: engineerOptionSource,
      },
      { name: 'scheduledDate', label: 'Ngày bảo trì', type: 'date', required: true },
      { name: 'nextDueDate', label: 'Lịch tiếp theo', type: 'date' },
      { name: 'checklist', label: 'Danh sách kiểm tra', type: 'tags' },
      { name: 'status', label: 'Trạng thái xử lý', type: 'select', options: maintenanceStatuses, updateOnly: true },
      { name: 'resultNote', label: 'Kết quả bảo trì', type: 'textarea', updateOnly: true },
    ],
  },
  installations: {
    title: 'Lắp đặt',
    entityLabel: 'phiếu lắp đặt',
    description: 'Tạo, cập nhật kỹ sư/ngày lắp/bảo hành và xóa phiếu lắp đặt.',
    endpoint: '/installations',
    icon: null,
    searchPlaceholder: 'Tìm mã máy, khách hàng, kỹ sư',
    roles: ['admin'],
    columns: [
      { key: 'machine.machineCode', label: 'Mã máy' },
      { key: 'customer.name', label: 'Khách hàng' },
      { key: 'installedBy.fullName', label: 'Kỹ sư' },
      { key: 'installedAt', label: 'Ngày lắp' },
      { key: 'status', label: 'Trạng thái' },
    ],
    fields: [
      {
        name: 'machineId',
        label: 'Thiết bị',
        type: 'select',
        required: true,
        createOnly: true,
        valuePath: 'machine.id',
        optionSource: { ...machineOptionSource, endpoint: '/machines?limit=20&inventoryStatus=IN_STOCK' },
      },
      {
        name: 'customerId',
        label: 'Khách hàng',
        type: 'select',
        required: true,
        createOnly: true,
        valuePath: 'customer.id',
        optionSource: customerOptionSource,
      },
      {
        name: 'installedById',
        label: 'Kỹ sư lắp đặt',
        type: 'select',
        required: true,
        valuePath: 'installedBy.id',
        optionSource: engineerOptionSource,
      },
      {
        name: 'businessLineId',
        label: 'Ngành hàng',
        type: 'select',
        valuePath: 'businessLine.id',
        optionSource: businessLineOptionSource,
      },
      { name: 'installedAt', label: 'Ngày lắp', type: 'date', required: true },
      { name: 'warrantyStartDate', label: 'Bắt đầu bảo hành', type: 'date', valuePath: 'warrantyCard.startDate' },
      { name: 'warrantyEndDate', label: 'Kết thúc bảo hành', type: 'date', required: true, valuePath: 'warrantyCard.endDate' },
      { name: 'status', label: 'Trạng thái', type: 'select', options: installationStatuses, updateOnly: true },
      { name: 'accessories', label: 'Phụ kiện', type: 'tags' },
      { name: 'note', label: 'Ghi chú', type: 'textarea' },
      { name: 'warrantyNote', label: 'Ghi chú bảo hành', type: 'textarea', valuePath: 'warrantyCard.note' },
      { name: 'handoverInstallerName', label: 'Người lắp đặt', detailOnly: true },
      { name: 'handoverInstallerPosition', label: 'Chức vụ bên bàn giao', detailOnly: true },
      { name: 'handoverVehicle', label: 'Phương tiện đi', detailOnly: true },
      { name: 'handoverDepartureDate', label: 'Ngày đi', type: 'date', detailOnly: true },
      { name: 'receiverInstallAddress', label: 'Địa chỉ lắp đặt', detailOnly: true },
      { name: 'receiverRepresentative', label: 'Người đại diện bên nhận', detailOnly: true },
      { name: 'receiverPosition', label: 'Chức vụ bên nhận', detailOnly: true },
      { name: 'receiverPhone', label: 'SĐT bên nhận', detailOnly: true },
      { name: 'installedDeviceItems', label: 'Danh mục thiết bị lắp đặt', detailOnly: true },
      { name: 'deviceCondition', label: 'Tình trạng thiết bị', detailOnly: true },
      { name: 'deviceConditionNote', label: 'Ghi chú tình trạng', detailOnly: true },
    ],
  },
  'inventory-movements': {
    title: 'Kho máy',
    entityLabel: 'phiếu kho',
    description: 'Tạo phiếu điều chuyển trạng thái kho. Hệ thống hiện chỉ hỗ trợ tạo và xem.',
    endpoint: '/inventory-movements',
    icon: null,
    searchPlaceholder: 'Tìm mã phiếu, serial, người tạo',
    roles: ['admin'],
    canUpdate: false,
    canDelete: false,
    columns: [
      { key: 'code', label: 'Mã phiếu' },
      { key: 'machine.machineCode', label: 'Mã máy' },
      { key: 'type', label: 'Loại' },
      { key: 'toStatus', label: 'Trạng thái mới' },
      { key: 'createdBy.fullName', label: 'Người tạo' },
    ],
    fields: [
      {
        name: 'machineId',
        label: 'Thiết bị',
        type: 'select',
        required: true,
        valuePath: 'machine.id',
        optionSource: machineOptionSource,
      },
      { name: 'type', label: 'Loại phiếu', type: 'select', required: true, options: inventoryMovementTypes },
      { name: 'toStatus', label: 'Trạng thái mới', type: 'select', required: true, options: inventoryStatuses },
      {
        name: 'customerId',
        label: 'Khách hàng',
        type: 'select',
        valuePath: 'customer.id',
        optionSource: customerOptionSource,
      },
      { name: 'occurredAt', label: 'Ngày phát sinh', type: 'date' },
      { name: 'note', label: 'Ghi chú', type: 'textarea' },
    ],
  },
};

import { ResourceConfig } from './resources';

export type CrudField = {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'url' | 'image' | 'date' | 'select' | 'textarea' | 'tags';
  required?: boolean;
  createOnly?: boolean;
  updateOnly?: boolean;
  valuePath?: string;
  options?: Array<{ label: string; value: string }>;
  optionSource?: {
    endpoint: string;
    labelPath: string;
    valuePath: string;
  };
};

export type AdminCrudConfig = ResourceConfig & {
  entityLabel: string;
  canUpdate?: boolean;
  canDelete?: boolean;
  fields: CrudField[];
};

const customerTypes = [
  'HOSPITAL',
  'CLINIC',
  'LAB',
  'DISTRIBUTOR',
  'UNIVERSITY',
  'COMPANY',
  'OTHER',
].map((value) => ({ label: value.replaceAll('_', ' '), value }));

const customerStatuses = ['ACTIVE', 'INACTIVE', 'POTENTIAL', 'BLACKLISTED'].map((value) => ({
  label: value.replaceAll('_', ' '),
  value,
}));

const activeInactiveStatuses = ['ACTIVE', 'INACTIVE'].map((value) => ({
  label: value,
  value,
}));

const productCategories = [
  'ULTRASOUND',
  'LAB_TESTING',
  'BIOCHEMISTRY',
  'IMMUNOLOGY',
  'HEMATOLOGY',
  'X_RAY',
  'ENDOSCOPY',
  'OTHER',
].map((value) => ({ label: value.replaceAll('_', ' '), value }));

const machineStatuses = ['ACTIVE', 'MAINTENANCE', 'REPAIRING', 'INACTIVE'].map((value) => ({
  label: value.replaceAll('_', ' '),
  value,
}));

const inventoryStatuses = ['IN_STOCK', 'ACCESSORY_SPLIT', 'INSTALLED', 'RESERVED', 'RETURNED', 'SOLD'].map((value) => ({
  label: value.replaceAll('_', ' '),
  value,
}));

const repairPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((value) => ({
  label: value,
  value,
}));

const maintenanceTypes = ['PERIODIC', 'WARRANTY', 'CONTRACT', 'INTERNAL', 'OTHER'].map((value) => ({
  label: value.replaceAll('_', ' '),
  value,
}));

const inventoryMovementTypes = ['IMPORT', 'SPLIT_ACCESSORY', 'RESERVE', 'INSTALL', 'RETURN', 'SELL', 'ADJUST_STATUS'].map((value) => ({
  label: value.replaceAll('_', ' '),
  value,
}));

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
    title: 'Ngành hàng',
    entityLabel: 'ngành hàng',
    description: 'Tạo, cập nhật và xóa ngành hàng, hãng sản xuất và người quản lý.',
    endpoint: '/business-lines',
    icon: null,
    searchPlaceholder: 'Tìm ngành hàng hoặc mã',
    roles: ['admin'],
    columns: [
      { key: 'imageUrl', label: 'Ảnh' },
      { key: 'name', label: 'Ngành hàng' },
      { key: 'code', label: 'Mã' },
      { key: 'productCategory', label: 'Nhóm sản phẩm' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'manager.fullName', label: 'Quản lý' },
    ],
    fields: [
      { name: 'code', label: 'Mã ngành hàng', required: true },
      { name: 'name', label: 'Tên ngành hàng', required: true },
      { name: 'status', label: 'Trạng thái', type: 'select', options: activeInactiveStatuses },
      { name: 'manufacturer', label: 'Hãng sản xuất' },
      { name: 'imageUrl', label: 'Hình ảnh', type: 'image' },
      { name: 'productCategory', label: 'Nhóm sản phẩm', type: 'select', options: productCategories },
      {
        name: 'managerId',
        label: 'Quản lý',
        type: 'select',
        valuePath: 'manager.id',
        optionSource: { endpoint: '/users', labelPath: 'fullName', valuePath: 'id' },
      },
      { name: 'countryOfOrigin', label: 'Xuất xứ' },
      { name: 'website', label: 'Website', type: 'url' },
      { name: 'contactPerson', label: 'Người liên hệ' },
      { name: 'contactPhone', label: 'SĐT liên hệ' },
      { name: 'contactEmail', label: 'Email liên hệ', type: 'email' },
      { name: 'description', label: 'Mô tả', type: 'textarea' },
      { name: 'note', label: 'Ghi chú', type: 'textarea' },
    ],
  },
  'machine-models': {
    title: 'Model máy',
    entityLabel: 'model máy',
    description: 'Tạo, cập nhật và xóa model máy theo từng ngành hàng.',
    endpoint: '/machine-models',
    icon: null,
    searchPlaceholder: 'Tìm model hoặc mã',
    roles: ['admin'],
    columns: [
      { key: 'name', label: 'Model' },
      { key: 'code', label: 'Mã' },
      { key: 'manufacturer', label: 'Hãng' },
      { key: 'productCategory', label: 'Nhóm sản phẩm' },
      { key: 'businessLine.name', label: 'Ngành hàng' },
    ],
    fields: [
      {
        name: 'businessLineId',
        label: 'Ngành hàng',
        type: 'select',
        required: true,
        valuePath: 'businessLine.id',
        optionSource: { endpoint: '/business-lines', labelPath: 'name', valuePath: 'id' },
      },
      { name: 'code', label: 'Mã model', required: true },
      { name: 'name', label: 'Tên model', required: true },
      { name: 'displayName', label: 'Tên hiển thị' },
      { name: 'status', label: 'Trạng thái', type: 'select', options: activeInactiveStatuses },
      { name: 'manufacturer', label: 'Hãng sản xuất' },
      { name: 'productCategory', label: 'Nhóm sản phẩm', type: 'select', options: productCategories },
      { name: 'productLine', label: 'Dòng sản phẩm' },
      { name: 'description', label: 'Mô tả', type: 'textarea' },
      { name: 'note', label: 'Ghi chú', type: 'textarea' },
    ],
  },
  machines: {
    title: 'Thiết bị',
    entityLabel: 'thiết bị',
    description: 'Tạo, cập nhật và xóa thiết bị theo serial, model, khách hàng và kỹ sư phụ trách.',
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
    ],
    fields: [
      { name: 'serialNumber', label: 'Serial', required: true },
      { name: 'machineCode', label: 'Mã máy' },
      {
        name: 'machineModelId',
        label: 'Model máy',
        type: 'select',
        required: true,
        valuePath: 'machineModel.id',
        optionSource: { endpoint: '/machine-models?limit=100', labelPath: 'name', valuePath: 'id' },
      },
      { name: 'name', label: 'Tên máy' },
      { name: 'status', label: 'Trạng thái vận hành', type: 'select', options: machineStatuses },
      { name: 'inventoryStatus', label: 'Trạng thái kho', type: 'select', options: inventoryStatuses },
      {
        name: 'customerId',
        label: 'Khách hàng',
        type: 'select',
        valuePath: 'customer.id',
        optionSource: { endpoint: '/customers?limit=100', labelPath: 'name', valuePath: 'id' },
      },
      {
        name: 'installedById',
        label: 'Kỹ sư lắp đặt',
        type: 'select',
        valuePath: 'installedBy.id',
        optionSource: { endpoint: '/users', labelPath: 'fullName', valuePath: 'id' },
      },
      {
        name: 'primaryEngineerId',
        label: 'Kỹ sư phụ trách',
        type: 'select',
        valuePath: 'primaryEngineer.id',
        optionSource: { endpoint: '/users', labelPath: 'fullName', valuePath: 'id' },
      },
      { name: 'installDate', label: 'Ngày lắp', type: 'date' },
      { name: 'warrantyStartDate', label: 'Bắt đầu bảo hành', type: 'date' },
      { name: 'warrantyEndDate', label: 'Kết thúc bảo hành', type: 'date' },
    ],
  },
  repairs: {
    title: 'Sửa chữa',
    entityLabel: 'phiếu sửa chữa',
    description: 'Tạo và cập nhật phiếu sửa chữa. Backend hiện không hỗ trợ xóa phiếu.',
    endpoint: '/repairs',
    icon: null,
    searchPlaceholder: 'Tìm tiêu đề, mã máy, kỹ sư',
    roles: ['admin'],
    canDelete: false,
    columns: [
      { key: 'title', label: 'Tiêu đề' },
      { key: 'machine.machineCode', label: 'Mã máy' },
      { key: 'priority', label: 'Ưu tiên' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'engineer.fullName', label: 'Kỹ sư' },
    ],
    fields: [
      { name: 'title', label: 'Tiêu đề', required: true },
      { name: 'description', label: 'Mô tả', type: 'textarea' },
      {
        name: 'machineId',
        label: 'Thiết bị',
        type: 'select',
        required: true,
        createOnly: true,
        valuePath: 'machine.id',
        optionSource: { endpoint: '/machines?limit=100', labelPath: 'serialNumber', valuePath: 'id' },
      },
      {
        name: 'engineerId',
        label: 'Kỹ sư',
        type: 'select',
        createOnly: true,
        valuePath: 'engineer.id',
        optionSource: { endpoint: '/users', labelPath: 'fullName', valuePath: 'id' },
      },
      { name: 'priority', label: 'Ưu tiên', type: 'select', options: repairPriorities },
      { name: 'reportedAt', label: 'Ngày báo lỗi', type: 'date', createOnly: true },
      { name: 'resultNote', label: 'Kết quả xử lý', type: 'textarea', updateOnly: true },
      { name: 'customerFeedback', label: 'Phản hồi khách hàng', type: 'textarea', updateOnly: true },
    ],
  },
  maintenance: {
    title: 'Bảo trì',
    entityLabel: 'phiếu bảo trì',
    description: 'Tạo và cập nhật lịch bảo trì. Backend hiện không hỗ trợ xóa phiếu.',
    endpoint: '/maintenance',
    icon: null,
    searchPlaceholder: 'Tìm tiêu đề, mã máy, kỹ sư',
    roles: ['admin'],
    canDelete: false,
    columns: [
      { key: 'title', label: 'Tiêu đề' },
      { key: 'machine.machineCode', label: 'Mã máy' },
      { key: 'type', label: 'Loại' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'scheduledDate', label: 'Lịch hẹn' },
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
        optionSource: { endpoint: '/machines?limit=100', labelPath: 'serialNumber', valuePath: 'id' },
      },
      {
        name: 'engineerId',
        label: 'Kỹ sư',
        type: 'select',
        createOnly: true,
        valuePath: 'engineer.id',
        optionSource: { endpoint: '/users', labelPath: 'fullName', valuePath: 'id' },
      },
      { name: 'scheduledDate', label: 'Ngày bảo trì', type: 'date', required: true },
      { name: 'nextDueDate', label: 'Lịch tiếp theo', type: 'date' },
      { name: 'checklist', label: 'Checklist', type: 'tags' },
      { name: 'resultNote', label: 'Kết quả bảo trì', type: 'textarea', updateOnly: true },
    ],
  },
  installations: {
    title: 'Lắp đặt',
    entityLabel: 'phiếu lắp đặt',
    description: 'Tạo phiếu lắp đặt và bảo hành. Backend hiện chỉ hỗ trợ tạo và xem.',
    endpoint: '/installations',
    icon: null,
    searchPlaceholder: 'Tìm mã máy, khách hàng, kỹ sư',
    roles: ['admin'],
    canUpdate: false,
    canDelete: false,
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
        valuePath: 'machine.id',
        optionSource: { endpoint: '/machines?limit=100', labelPath: 'serialNumber', valuePath: 'id' },
      },
      {
        name: 'customerId',
        label: 'Khách hàng',
        type: 'select',
        required: true,
        valuePath: 'customer.id',
        optionSource: { endpoint: '/customers?limit=100', labelPath: 'name', valuePath: 'id' },
      },
      {
        name: 'installedById',
        label: 'Kỹ sư lắp đặt',
        type: 'select',
        required: true,
        valuePath: 'installedBy.id',
        optionSource: { endpoint: '/users', labelPath: 'fullName', valuePath: 'id' },
      },
      {
        name: 'businessLineId',
        label: 'Ngành hàng',
        type: 'select',
        valuePath: 'businessLine.id',
        optionSource: { endpoint: '/business-lines', labelPath: 'name', valuePath: 'id' },
      },
      { name: 'installedAt', label: 'Ngày lắp', type: 'date', required: true },
      { name: 'warrantyStartDate', label: 'Bắt đầu bảo hành', type: 'date' },
      { name: 'warrantyEndDate', label: 'Kết thúc bảo hành', type: 'date', required: true },
      { name: 'accessories', label: 'Phụ kiện', type: 'tags' },
      { name: 'note', label: 'Ghi chú', type: 'textarea' },
      { name: 'warrantyNote', label: 'Ghi chú bảo hành', type: 'textarea' },
    ],
  },
  'inventory-movements': {
    title: 'Kho máy',
    entityLabel: 'phiếu kho',
    description: 'Tạo phiếu điều chuyển trạng thái kho. Backend hiện chỉ hỗ trợ tạo và xem.',
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
        optionSource: { endpoint: '/machines?limit=100', labelPath: 'serialNumber', valuePath: 'id' },
      },
      { name: 'type', label: 'Loại phiếu', type: 'select', required: true, options: inventoryMovementTypes },
      { name: 'toStatus', label: 'Trạng thái mới', type: 'select', required: true, options: inventoryStatuses },
      {
        name: 'customerId',
        label: 'Khách hàng',
        type: 'select',
        valuePath: 'customer.id',
        optionSource: { endpoint: '/customers?limit=100', labelPath: 'name', valuePath: 'id' },
      },
      { name: 'occurredAt', label: 'Ngày phát sinh', type: 'date' },
      { name: 'note', label: 'Ghi chú', type: 'textarea' },
    ],
  },
};

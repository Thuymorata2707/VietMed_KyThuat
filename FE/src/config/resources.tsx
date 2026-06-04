import {
  Boxes,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  History,
  Layers3,
  MapPinned,
  PackageCheck,
  ShieldCheck,
  Stethoscope,
  Users,
  Wrench,
} from 'lucide-react';
import { ReactNode } from 'react';
import { RoleName } from '../auth/roles';

export type ResourceConfig = {
  title: string;
  description: string;
  endpoint: string;
  icon: ReactNode;
  columns: Array<{ key: string; label: string }>;
  searchPlaceholder: string;
  roles: RoleName[];
  searchEnabled?: boolean;
};

export const resources: Record<string, ResourceConfig> = {
  customers: {
    title: 'Khách hàng',
    description: 'Theo dõi bệnh viện, phòng khám, labo và nhà phân phối.',
    endpoint: '/customers',
    icon: <Building2 size={20} />,
    searchPlaceholder: 'Tìm theo tên, mã, email, điện thoại',
    roles: ['admin', 'manager'],
    columns: [
      { key: 'name', label: 'Tên khách hàng' },
      { key: 'customerCode', label: 'Mã' },
      { key: 'customerType', label: 'Loại' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'region.name', label: 'Khu vực' },
    ],
  },
  machines: {
    title: 'Thiết bị',
    description: 'Quản lý vòng đời máy, serial, tồn kho và tình trạng vận hành.',
    endpoint: '/machines',
    icon: <Stethoscope size={20} />,
    searchPlaceholder: 'Tìm mã máy, serial, model',
    roles: ['admin', 'manager', 'engineer'],
    columns: [
      { key: 'machineCode', label: 'Mã máy' },
      { key: 'serialNumber', label: 'Serial' },
      { key: 'modelName', label: 'Model' },
      { key: 'status', label: 'Vận hành' },
      { key: 'inventoryStatus', label: 'Tồn kho' },
    ],
  },
  installations: {
    title: 'Lắp đặt',
    description: 'Theo dõi bàn giao, kỹ sư phụ trách và trạng thái nghiệm thu.',
    endpoint: '/installations',
    icon: <PackageCheck size={20} />,
    searchPlaceholder: 'Tìm theo mã máy, khách hàng',
    roles: ['admin', 'manager', 'engineer'],
    columns: [
      { key: 'machine.machineCode', label: 'Mã máy' },
      { key: 'customer.name', label: 'Khách hàng' },
      { key: 'installedBy.fullName', label: 'Kỹ sư' },
      { key: 'installedAt', label: 'Ngày lắp' },
      { key: 'status', label: 'Trạng thái' },
    ],
  },
  repairs: {
    title: 'Sửa chữa',
    description: 'Điều phối yêu cầu sửa chữa, ưu tiên và tiến độ xử lý.',
    endpoint: '/repairs',
    icon: <Wrench size={20} />,
    searchPlaceholder: 'Tìm theo mã máy, lỗi, khách hàng',
    roles: ['admin', 'manager', 'engineer'],
    columns: [
      { key: 'machine.machineCode', label: 'Mã máy' },
      { key: 'machine.customer.name', label: 'Khách hàng' },
      { key: 'priority', label: 'Ưu tiên' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'engineer.fullName', label: 'Kỹ sư' },
    ],
  },
  maintenance: {
    title: 'Bảo trì',
    description: 'Lịch bảo trì định kỳ, hợp đồng, bảo hành và quá hạn.',
    endpoint: '/maintenance',
    icon: <ClipboardCheck size={20} />,
    searchPlaceholder: 'Tìm theo mã máy, khách hàng',
    roles: ['admin', 'manager', 'engineer'],
    columns: [
      { key: 'machine.machineCode', label: 'Mã máy' },
      { key: 'machine.customer.name', label: 'Khách hàng' },
      { key: 'type', label: 'Loại' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'scheduledDate', label: 'Lịch hẹn' },
    ],
  },
  users: {
    title: 'Nhân sự',
    description: 'Danh sách tài khoản, vai trò, vùng phụ trách và trạng thái.',
    endpoint: '/users',
    icon: <Users size={20} />,
    searchPlaceholder: 'Tìm tên, email, số điện thoại',
    roles: ['admin'],
    columns: [
      { key: 'fullName', label: 'Họ tên' },
      { key: 'email', label: 'Email' },
      { key: 'role.name', label: 'Vai trò' },
      { key: 'region.name', label: 'Khu vực' },
      { key: 'status', label: 'Trạng thái' },
    ],
  },
  roles: {
    title: 'Vai trò',
    description: 'Các vai trò hệ thống đang được backend dùng để kiểm soát quyền.',
    endpoint: '/roles',
    icon: <ShieldCheck size={20} />,
    searchPlaceholder: 'Tìm vai trò',
    roles: ['admin'],
    columns: [
      { key: 'name', label: 'Vai trò' },
      { key: 'createdAt', label: 'Ngày tạo' },
      { key: 'updatedAt', label: 'Cập nhật' },
    ],
  },
  regions: {
    title: 'Khu vực',
    description: 'Vùng phụ trách dùng cho scope dữ liệu của manager và kỹ sư.',
    endpoint: '/regions',
    icon: <MapPinned size={20} />,
    searchPlaceholder: 'Tìm tên hoặc mã khu vực',
    roles: ['admin'],
    columns: [
      { key: 'name', label: 'Tên khu vực' },
      { key: 'code', label: 'Mã' },
      { key: 'createdAt', label: 'Ngày tạo' },
      { key: 'updatedAt', label: 'Cập nhật' },
    ],
  },
  'business-lines': {
    title: 'Ngành hàng',
    description: 'Danh mục ngành hàng, người quản lý và nhóm sản phẩm kỹ thuật.',
    endpoint: '/business-lines',
    icon: <BriefcaseBusiness size={20} />,
    searchPlaceholder: 'Tìm ngành hàng hoặc mã',
    roles: ['admin', 'manager', 'engineer'],
    columns: [
      { key: 'name', label: 'Ngành hàng' },
      { key: 'code', label: 'Mã' },
      { key: 'productCategory', label: 'Nhóm sản phẩm' },
      { key: 'status', label: 'Trạng thái' },
      { key: 'manager.fullName', label: 'Quản lý' },
    ],
  },
  'machine-models': {
    title: 'Model máy',
    description: 'Danh mục model theo ngành hàng, hãng sản xuất và dòng sản phẩm.',
    endpoint: '/machine-models',
    icon: <Layers3 size={20} />,
    searchPlaceholder: 'Bộ lọc model đang được làm ở bước tiếp theo',
    roles: ['admin', 'manager', 'engineer'],
    searchEnabled: false,
    columns: [
      { key: 'name', label: 'Model' },
      { key: 'code', label: 'Mã' },
      { key: 'manufacturer', label: 'Hãng' },
      { key: 'productCategory', label: 'Nhóm sản phẩm' },
      { key: 'businessLine.name', label: 'Ngành hàng' },
    ],
  },
  'inventory-movements': {
    title: 'Kho máy',
    description: 'Lịch sử nhập kho, tách phụ kiện, giữ hàng, lắp đặt, trả hoặc bán máy.',
    endpoint: '/inventory-movements',
    icon: <Boxes size={20} />,
    searchPlaceholder: 'Tìm theo mã máy hoặc ghi chú',
    roles: ['admin', 'manager', 'engineer'],
    columns: [
      { key: 'code', label: 'Mã phiếu' },
      { key: 'machine.machineCode', label: 'Mã máy' },
      { key: 'type', label: 'Loại' },
      { key: 'toStatus', label: 'Trạng thái mới' },
      { key: 'createdBy.fullName', label: 'Người tạo' },
    ],
  },
  'audit-logs': {
    title: 'Audit log',
    description: 'Lịch sử thay đổi dữ liệu quan trọng trong hệ thống.',
    endpoint: '/audit-logs',
    icon: <History size={20} />,
    searchPlaceholder: 'Bộ lọc audit sẽ tách riêng theo action/entity',
    roles: ['admin'],
    searchEnabled: false,
    columns: [
      { key: 'action', label: 'Hành động' },
      { key: 'entityType', label: 'Đối tượng' },
      { key: 'actorEmail', label: 'Người thao tác' },
      { key: 'entityId', label: 'ID dữ liệu' },
      { key: 'createdAt', label: 'Thời gian' },
    ],
  },
};

import {
  Boxes,
  BriefcaseBusiness,
  Building2,
  Gauge,
  History,
  Layers3,
  MapPinned,
  PackageCheck,
  SquareCheckBig,
  ShieldCheck,
  Stethoscope,
  Users,
  Wrench,
} from 'lucide-react';
import { ReactNode } from 'react';
import { RoleName } from '../auth/roles';

export type NavItem = {
  path: string;
  label: string;
  icon: ReactNode;
  roles: RoleName[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navItems: NavItem[] = [
  { path: '/', label: 'Tổng quan', icon: <Gauge size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/customers', label: 'Khách hàng', icon: <Building2 size={18} />, roles: ['admin', 'manager'] },
  { path: '/machines', label: 'Thiết bị', icon: <Stethoscope size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/installations', label: 'Lắp đặt', icon: <PackageCheck size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/service-tickets', label: 'Sửa chữa / Bảo trì', icon: <Wrench size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/inventory-movements', label: 'Kho máy', icon: <Boxes size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/business-lines', label: 'Sản phẩm', icon: <BriefcaseBusiness size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/product-industries', label: 'Ngành hàng', icon: <BriefcaseBusiness size={18} />, roles: ['admin'] },
  { path: '/machine-models', label: 'Sản phẩm / Model', icon: <Layers3 size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/machine-components', label: 'Thành phần máy', icon: <Layers3 size={18} />, roles: ['admin'] },
  { path: '/component-accessories', label: 'Phụ kiện', icon: <Boxes size={18} />, roles: ['admin'] },
  { path: '/users', label: 'Nhân sự', icon: <Users size={18} />, roles: ['admin'] },
  { path: '/roles', label: 'Vai trò', icon: <ShieldCheck size={18} />, roles: ['admin'] },
  { path: '/regions', label: 'Khu vực', icon: <MapPinned size={18} />, roles: ['admin'] },
  { path: '/audit-logs', label: 'Audit log', icon: <History size={18} />, roles: ['admin'] },
  { path: '/my-tasks', label: 'Phân việc', icon: <SquareCheckBig size={18} />, roles: ['admin'] },
  { path: '/my-tasks', label: 'Việc của tôi', icon: <SquareCheckBig size={18} />, roles: ['manager', 'engineer'] },
];

export const navGroups: NavGroup[] = [
  {
    label: 'Tổng quan',
    items: [
      { path: '/', label: 'Tổng quan', icon: <Gauge size={18} />, roles: ['admin', 'manager', 'engineer'] },
    ],
  },
  {
    label: 'Vận hành kỹ thuật',
    items: [
      { path: '/my-tasks', label: 'Phân việc', icon: <SquareCheckBig size={18} />, roles: ['admin'] },
      { path: '/my-tasks', label: 'Việc của tôi', icon: <SquareCheckBig size={18} />, roles: ['manager', 'engineer'] },
      { path: '/machines', label: 'Thiết bị', icon: <Stethoscope size={18} />, roles: ['admin', 'manager', 'engineer'] },
      { path: '/service-tickets', label: 'Sửa chữa / Bảo trì', icon: <Wrench size={18} />, roles: ['admin', 'manager', 'engineer'] },
      { path: '/installations', label: 'Lắp đặt', icon: <PackageCheck size={18} />, roles: ['admin', 'manager', 'engineer'] },
      { path: '/inventory-movements', label: 'Kho máy', icon: <Boxes size={18} />, roles: ['admin', 'manager', 'engineer'] },
    ],
  },
  {
    label: 'Danh mục dữ liệu',
    items: [
      { path: '/customers', label: 'Khách hàng', icon: <Building2 size={18} />, roles: ['admin', 'manager'] },
      { path: '/business-lines', label: 'Sản phẩm', icon: <BriefcaseBusiness size={18} />, roles: ['admin', 'manager', 'engineer'] },
      { path: '/regions', label: 'Khu vực', icon: <MapPinned size={18} />, roles: ['admin'] },
    ],
  },
  {
    label: 'Quản trị hệ thống',
    items: [
      { path: '/users', label: 'Nhân sự', icon: <Users size={18} />, roles: ['admin'] },
      { path: '/roles', label: 'Vai trò', icon: <ShieldCheck size={18} />, roles: ['admin'] },
      { path: '/audit-logs', label: 'Audit log', icon: <History size={18} />, roles: ['admin'] },
    ],
  },
];

export function navItemsForRole(role: RoleName) {
  return navItems.filter((item) => item.roles.includes(role));
}

export function navGroupsForRole(role: RoleName) {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((group) => group.items.length > 0);
}

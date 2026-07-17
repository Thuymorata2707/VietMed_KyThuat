import {
  Boxes,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Gauge,
  MapPinned,
  FileBarChart2,
  SquareCheckBig,
  ShieldCheck,
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
  defaultCollapsed?: boolean;
};

export const navItems: NavItem[] = [
  { path: '/', label: 'Tổng quan', icon: <Gauge size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/customers', label: 'Khách hàng', icon: <Building2 size={18} />, roles: ['admin', 'manager'] },
  { path: '/my-customers', label: 'Khách hàng phụ trách', icon: <Building2 size={18} />, roles: ['engineer'] },
  { path: '/service-tickets', label: 'Tổng hợp phiếu', icon: <Wrench size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/daily-work', label: 'Lịch & báo cáo', icon: <CalendarDays size={18} />, roles: ['admin', 'engineer'] },
  { path: '/knowledge-base', label: 'Chia sẻ kinh nghiệm', icon: <BookOpenCheck size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/technical-statistics', label: 'Thống kê kỹ thuật', icon: <BarChart3 size={18} />, roles: ['admin'] },
  { path: '/reports', label: 'Báo cáo', icon: <FileBarChart2 size={18} />, roles: ['admin', 'manager'] },
  { path: '/my-reports', label: 'Báo cáo của tôi', icon: <FileBarChart2 size={18} />, roles: ['engineer'] },
  { path: '/inventory-movements', label: 'Kho máy', icon: <Boxes size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/product-catalog', label: 'Sản phẩm & Thiết bị', icon: <BriefcaseBusiness size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/product-industries', label: 'Ngành hàng', icon: <BriefcaseBusiness size={18} />, roles: ['admin'] },
  { path: '/machine-components', label: 'Thành phần máy', icon: <Boxes size={18} />, roles: ['admin'] },
  { path: '/component-accessories', label: 'Phụ kiện', icon: <Boxes size={18} />, roles: ['admin'] },
  { path: '/users', label: 'Nhân sự', icon: <Users size={18} />, roles: ['admin'] },
  { path: '/roles', label: 'Vai trò', icon: <ShieldCheck size={18} />, roles: ['admin'] },
  { path: '/regions', label: 'Khu vực', icon: <MapPinned size={18} />, roles: ['admin'] },
  { path: '/audit-logs', label: 'Audit log', icon: <ShieldCheck size={18} />, roles: ['admin'] },
  { path: '/my-tasks', label: 'Điều phối & duyệt', icon: <SquareCheckBig size={18} />, roles: ['admin'] },
  { path: '/my-tasks', label: 'Việc của tôi', icon: <SquareCheckBig size={18} />, roles: ['engineer'] },
];

export const navGroups: NavGroup[] = [
  {
    label: 'Làm việc',
    items: [
      { path: '/', label: 'Tổng quan', icon: <Gauge size={18} />, roles: ['admin', 'manager', 'engineer'] },
      { path: '/my-tasks', label: 'Điều phối & duyệt', icon: <SquareCheckBig size={18} />, roles: ['admin'] },
      { path: '/my-tasks', label: 'Việc của tôi', icon: <SquareCheckBig size={18} />, roles: ['engineer'] },
      { path: '/service-tickets', label: 'Phiếu dịch vụ', icon: <Wrench size={18} />, roles: ['admin', 'manager', 'engineer'] },
    ],
  },
  {
    label: 'Khách hàng & máy',
    items: [
      { path: '/customers', label: 'Khách hàng', icon: <Building2 size={18} />, roles: ['admin', 'manager'] },
      { path: '/my-customers', label: 'Khách hàng phụ trách', icon: <Building2 size={18} />, roles: ['engineer'] },
      { path: '/inventory-movements', label: 'Kho máy', icon: <Boxes size={18} />, roles: ['admin', 'manager', 'engineer'] },
      { path: '/product-catalog', label: 'Sản phẩm & Thiết bị', icon: <BriefcaseBusiness size={18} />, roles: ['admin', 'manager', 'engineer'] },
    ],
  },
  {
    label: 'Báo cáo & tri thức',
    items: [
      { path: '/daily-work', label: 'Lịch & báo cáo', icon: <CalendarDays size={18} />, roles: ['admin', 'engineer'] },
      { path: '/reports', label: 'Báo cáo', icon: <FileBarChart2 size={18} />, roles: ['admin', 'manager'] },
      { path: '/my-reports', label: 'Báo cáo của tôi', icon: <FileBarChart2 size={18} />, roles: ['engineer'] },
      { path: '/knowledge-base', label: 'Chia sẻ kinh nghiệm', icon: <BookOpenCheck size={18} />, roles: ['admin', 'manager', 'engineer'] },
    ],
  },
  {
    label: 'Dữ liệu nền',
    defaultCollapsed: true,
    items: [
      { path: '/technical-statistics', label: 'Thống kê kỹ thuật', icon: <BarChart3 size={18} />, roles: ['admin'] },
      { path: '/product-industries', label: 'Ngành hàng', icon: <BriefcaseBusiness size={18} />, roles: ['admin'] },
      { path: '/machine-components', label: 'Thành phần máy', icon: <Boxes size={18} />, roles: ['admin'] },
      { path: '/component-accessories', label: 'Phụ kiện', icon: <Boxes size={18} />, roles: ['admin'] },
      { path: '/regions', label: 'Khu vực', icon: <MapPinned size={18} />, roles: ['admin'] },
    ],
  },
  {
    label: 'Hệ thống',
    defaultCollapsed: true,
    items: [
      { path: '/users', label: 'Nhân sự', icon: <Users size={18} />, roles: ['admin'] },
      { path: '/roles', label: 'Vai trò', icon: <ShieldCheck size={18} />, roles: ['admin'] },
      { path: '/audit-logs', label: 'Audit log', icon: <ShieldCheck size={18} />, roles: ['admin'] },
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

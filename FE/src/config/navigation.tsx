import {
  Boxes,
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Headphones,
  Gauge,
  MapPinned,
  FileBarChart2,
  FileSpreadsheet,
  SquareCheckBig,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';
import { ReactNode } from 'react';
import { RoleName } from '../auth/roles';
import { ApiUser } from '../api';

export type NavItem = {
  path: string;
  label: string;
  icon: ReactNode;
  matchPaths?: string[];
  roles: RoleName[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
  defaultCollapsed?: boolean;
};

export const navItems: NavItem[] = [
  { path: '/', label: 'Tổng quan', icon: <Gauge size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/customers', label: 'Khách hàng', icon: <Building2 size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/service-tickets', label: 'Phiếu kỹ thuật', icon: <Wrench size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/application-support', label: 'Hỗ trợ app xét nghiệm', icon: <Headphones size={18} />, roles: ['engineer'] },
  { path: '/daily-work', label: 'Lịch & báo cáo', icon: <CalendarDays size={18} />, matchPaths: ['/daily-work', '/daily-reports', '/weekly-reports'], roles: ['admin', 'engineer'] },
  { path: '/knowledge-base', label: 'Chia sẻ kinh nghiệm', icon: <BookOpenCheck size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/engineer-performance', label: 'Hiệu suất kỹ sư', icon: <TrendingUp size={18} />, roles: ['admin', 'engineer'] },
  { path: '/technical-statistics', label: 'Phân tích kỹ thuật', icon: <BarChart3 size={18} />, roles: ['admin', 'engineer'] },
  { path: '/reports', label: 'Báo cáo tổng hợp', icon: <FileBarChart2 size={18} />, roles: ['admin', 'manager'] },
  { path: '/accessory-inventory', label: 'Phụ kiện', icon: <Boxes size={18} />, matchPaths: ['/accessory-inventory'], roles: ['admin', 'manager', 'engineer'] },
  { path: '/product-catalog', label: 'Danh mục thiết bị', icon: <BriefcaseBusiness size={18} />, matchPaths: ['/product-catalog', '/inventory-movements', '/technical-machines', '/business-lines/models', '/business-lines/add-product'], roles: ['admin', 'manager', 'engineer'] },
  { path: '/product-industries', label: 'Ngành hàng', icon: <BriefcaseBusiness size={18} />, roles: ['admin'] },
  { path: '/users', label: 'Nhân sự', icon: <Users size={18} />, roles: ['admin'] },
  { path: '/regions', label: 'Khu vực', icon: <MapPinned size={18} />, roles: ['admin'] },
  { path: '/my-tasks', label: 'Điều phối & duyệt', icon: <SquareCheckBig size={18} />, roles: ['admin'] },
  { path: '/my-tasks', label: 'Việc của tôi', icon: <SquareCheckBig size={18} />, roles: ['engineer'] },
];

export const navGroups: NavGroup[] = [
  {
    label: 'Vận hành',
    items: [
      { path: '/', label: 'Tổng quan', icon: <Gauge size={18} />, roles: ['admin', 'manager', 'engineer'] },
      { path: '/my-tasks', label: 'Điều phối & duyệt', icon: <SquareCheckBig size={18} />, roles: ['admin'] },
      { path: '/my-tasks', label: 'Việc của tôi', icon: <SquareCheckBig size={18} />, roles: ['engineer'] },
      { path: '/service-tickets', label: 'Phiếu kỹ thuật', icon: <Wrench size={18} />, roles: ['admin', 'manager', 'engineer'] },
      { path: '/daily-work', label: 'Lịch & báo cáo', icon: <CalendarDays size={18} />, matchPaths: ['/daily-work', '/daily-reports', '/weekly-reports'], roles: ['admin', 'engineer'] },
      { path: '/application-support', label: 'Hỗ trợ app xét nghiệm', icon: <Headphones size={18} />, roles: ['engineer'] },
    ],
  },
  {
    label: 'Hồ sơ & kho',
    items: [
      { path: '/customers', label: 'Khách hàng', icon: <Building2 size={18} />, roles: ['admin', 'manager', 'engineer'] },
      { path: '/accessory-inventory', label: 'Phụ kiện', icon: <Boxes size={18} />, matchPaths: ['/accessory-inventory'], roles: ['admin', 'manager', 'engineer'] },
      { path: '/product-catalog', label: 'Danh mục thiết bị', icon: <BriefcaseBusiness size={18} />, matchPaths: ['/product-catalog', '/inventory-movements', '/technical-machines', '/business-lines/models', '/business-lines/add-product'], roles: ['admin', 'manager', 'engineer'] },
    ],
  },
  {
    label: 'Phân tích',
    items: [
      { path: '/engineer-performance', label: 'Hiệu suất kỹ sư', icon: <TrendingUp size={18} />, roles: ['admin', 'engineer'] },
      { path: '/technical-statistics', label: 'Phân tích kỹ thuật', icon: <BarChart3 size={18} />, roles: ['admin', 'engineer'] },
      { path: '/reports', label: 'Báo cáo tổng hợp', icon: <FileBarChart2 size={18} />, roles: ['admin', 'manager'] },
      { path: '/knowledge-base', label: 'Chia sẻ kinh nghiệm', icon: <BookOpenCheck size={18} />, roles: ['admin', 'manager', 'engineer'] },
    ],
  },
  {
    label: 'Quản trị',
    items: [
      { path: '/users', label: 'Nhân sự', icon: <Users size={18} />, matchPaths: ['/users', '/roles', '/audit-logs'], roles: ['admin'] },
      { path: '/regions', label: 'Khu vực', icon: <MapPinned size={18} />, roles: ['admin'] },
      { path: '/data-import', label: 'Nhập dữ liệu', icon: <FileSpreadsheet size={18} />, roles: ['admin'] },
      { path: '/product-industries', label: 'Ngành hàng', icon: <BriefcaseBusiness size={18} />, roles: ['admin'] },
    ],
  },
];

export function canAccessApplicationSupport(user: ApiUser, role: RoleName) {
  const isLabEngineer = user.engineerProfile?.expertiseGroups?.includes('LAB_TESTING')
    ?? user.engineerProfile?.expertiseGroup === 'LAB_TESTING';
  return role === 'engineer' && isLabEngineer;
}

export function navItemsForRole(role: RoleName, user?: ApiUser) {
  return navItems.filter((item) => item.roles.includes(role) && (item.path !== '/application-support' || (user && canAccessApplicationSupport(user, role))));
}

export function navGroupsForRole(role: RoleName, user?: ApiUser) {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(role) && (item.path !== '/application-support' || (user && canAccessApplicationSupport(user, role)))),
    }))
    .filter((group) => group.items.length > 0);
}

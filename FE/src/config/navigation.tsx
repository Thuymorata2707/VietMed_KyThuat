import {
  Boxes,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  Gauge,
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

export type NavItem = {
  path: string;
  label: string;
  icon: ReactNode;
  roles: RoleName[];
};

export const navItems: NavItem[] = [
  { path: '/', label: 'Tổng quan', icon: <Gauge size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/customers', label: 'Khách hàng', icon: <Building2 size={18} />, roles: ['admin', 'manager'] },
  { path: '/machines', label: 'Thiết bị', icon: <Stethoscope size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/installations', label: 'Lắp đặt', icon: <PackageCheck size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/repairs', label: 'Sửa chữa', icon: <Wrench size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/maintenance', label: 'Bảo trì', icon: <ClipboardCheck size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/inventory-movements', label: 'Kho máy', icon: <Boxes size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/business-lines', label: 'Ngành hàng', icon: <BriefcaseBusiness size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/machine-models', label: 'Model máy', icon: <Layers3 size={18} />, roles: ['admin', 'manager', 'engineer'] },
  { path: '/users', label: 'Nhân sự', icon: <Users size={18} />, roles: ['admin'] },
  { path: '/roles', label: 'Vai trò', icon: <ShieldCheck size={18} />, roles: ['admin'] },
  { path: '/regions', label: 'Khu vực', icon: <MapPinned size={18} />, roles: ['admin'] },
  { path: '/audit-logs', label: 'Audit log', icon: <History size={18} />, roles: ['admin'] },
];

export function navItemsForRole(role: RoleName) {
  return navItems.filter((item) => item.roles.includes(role));
}

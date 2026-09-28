import { ApiUser } from '../api';

export type RoleName = 'admin' | 'manager' | 'engineer';

export function getRoleName(user: ApiUser): RoleName {
  const role = (user.role?.name ?? user.roleName ?? '').toLowerCase();
  if (role === 'admin' || role === 'quản trị viên' || role === 'quan tri vien') return 'admin';
  if (role === 'manager' || role === 'quản lý' || role === 'quan ly') return 'manager';
  if (role === 'engineer' || role === 'kỹ sư' || role === 'ky su') return 'engineer';
  return 'engineer';
}

export function roleLabel(role: RoleName) {
  const labels: Record<RoleName, string> = {
    admin: 'Quản trị viên',
    manager: 'Quản lý vùng',
    engineer: 'Kỹ sư',
  };
  return labels[role];
}

export function homePathForRole(role: RoleName) {
  if (role === 'engineer') return '/my-tasks';
  return '/';
}

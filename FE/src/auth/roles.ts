import { ApiUser } from '../api';

export type RoleName = 'admin' | 'manager' | 'engineer';

export function getRoleName(user: ApiUser): RoleName {
  const role = (user.role?.name ?? user.roleName ?? '').toLowerCase();
  if (role === 'manager' || role === 'engineer') return role;
  return 'admin';
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
  if (role === 'engineer') return '/machines';
  return '/';
}

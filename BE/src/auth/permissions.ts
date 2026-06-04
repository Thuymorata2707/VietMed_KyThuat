import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../common/request-user.type';

export type RoleName = 'admin' | 'manager' | 'engineer';

export const PERMISSIONS = {
  DASHBOARD_READ: 'dashboard:read',
  AUDIT_LOG_READ: 'audit-log:read',

  MACHINE_READ: 'machine:read',
  MACHINE_CREATE: 'machine:create',
  MACHINE_UPDATE: 'machine:update',
  MACHINE_DELETE: 'machine:delete',
  MACHINE_STATUS_UPDATE: 'machine:status:update',

  CUSTOMER_READ: 'customer:read',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_UPDATE: 'customer:update',
  CUSTOMER_DELETE: 'customer:delete',

  INVENTORY_READ: 'inventory:read',
  INVENTORY_CREATE: 'inventory:create',

  INSTALLATION_READ: 'installation:read',
  INSTALLATION_CREATE: 'installation:create',

  REPAIR_READ: 'repair:read',
  REPAIR_CREATE: 'repair:create',
  REPAIR_UPDATE: 'repair:update',
  REPAIR_ASSIGN: 'repair:assign',
  REPAIR_STATUS_UPDATE: 'repair:status:update',

  MAINTENANCE_READ: 'maintenance:read',
  MAINTENANCE_CREATE: 'maintenance:create',
  MAINTENANCE_UPDATE: 'maintenance:update',
  MAINTENANCE_ASSIGN: 'maintenance:assign',
  MAINTENANCE_STATUS_UPDATE: 'maintenance:status:update',

  ATTACHMENT_READ: 'attachment:read',
  ATTACHMENT_CREATE: 'attachment:create',
  ATTACHMENT_DELETE: 'attachment:delete',

  MASTER_DATA_READ: 'master-data:read',
  MASTER_DATA_WRITE: 'master-data:write',
  USER_MANAGE: 'user:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSION_MATRIX: Record<RoleName, Permission[]> = {
  admin: Object.values(PERMISSIONS),
  manager: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.MACHINE_READ,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INSTALLATION_READ,
    PERMISSIONS.REPAIR_READ,
    PERMISSIONS.MAINTENANCE_READ,
    PERMISSIONS.ATTACHMENT_READ,
    PERMISSIONS.ATTACHMENT_CREATE,
    PERMISSIONS.MASTER_DATA_READ,
  ],
  engineer: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.MACHINE_READ,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INSTALLATION_READ,
    PERMISSIONS.REPAIR_READ,
    PERMISSIONS.REPAIR_STATUS_UPDATE,
    PERMISSIONS.MAINTENANCE_READ,
    PERMISSIONS.MAINTENANCE_STATUS_UPDATE,
    PERMISSIONS.ATTACHMENT_READ,
    PERMISSIONS.ATTACHMENT_CREATE,
    PERMISSIONS.MASTER_DATA_READ,
  ],
};

export function hasPermission(
  user: RequestUser | undefined,
  permission: Permission,
): boolean {
  const roleName = user?.roleName as RoleName | undefined;

  if (!roleName || !(roleName in ROLE_PERMISSION_MATRIX)) {
    return false;
  }

  return ROLE_PERMISSION_MATRIX[roleName].includes(permission);
}

export function assertPermission(
  user: RequestUser | undefined,
  permission: Permission,
) {
  if (!hasPermission(user, permission)) {
    throw new ForbiddenException('You do not have permission for this action');
  }
}

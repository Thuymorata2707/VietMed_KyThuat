# Permission Matrix

This backend uses role permissions for coarse access and service-layer data scopes for row-level access.

| Area | Admin | Manager | Engineer |
| --- | --- | --- | --- |
| Dashboard | Read all | Read scoped region/work data | Read assigned/related work data |
| Users, roles, regions | Create, read, update, status changes | No direct access | No direct access |
| Customers | Create, read, update, delete | Read customers in own region | Read customers linked to assigned/related machines |
| Business lines, machine models | Create, read, update, delete | Read | Read |
| Machines | Create, read, update, status changes, delete | Read machines in own region | Read assigned/installed/related machines |
| Inventory movements | Create and read all | Read own region/customer/machine movements | Read own created or related machine movements |
| Installations and warranty cards | Create installation and warranty, read all | Read own region installations | Read own installations |
| Repairs | Create, update, assign, status changes, read all | Read own region repairs | Read and update status for assigned repairs |
| Maintenance | Create, update, assign, status changes, read all | Read own region maintenance | Read and update status for assigned maintenance |
| Attachments | Upload, read, delete | Upload and read allowed entities | Upload and read allowed entities |
| Audit logs | Read all, filter | No access | No access |

## Service-Layer Rules

- Controllers keep endpoint-level role guards, but service methods must still call `assertPermission` for mutations.
- Read methods must apply the relevant `access-scope` helper before querying Prisma.
- Mutations that first load an entity must load it with the acting user scope unless the permission is admin-only.
- Engineers can update repair and maintenance status only when the record is visible to them through the service-layer scope.
- Managers are read-oriented by default. New manager write permissions should be added explicitly to `src/auth/permissions.ts`.

## Permission Source

The source of truth is `ROLE_PERMISSION_MATRIX` in `src/auth/permissions.ts`.

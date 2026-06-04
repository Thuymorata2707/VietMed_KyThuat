import { ReactNode } from 'react';
import { RoleName, roleLabel } from '../../auth/roles';

type RequireRoleProps = {
  allowedRoles: RoleName[];
  currentRole: RoleName;
  children: ReactNode;
  renderDenied: (message: string) => ReactNode;
};

export function RequireRole({ allowedRoles, currentRole, children, renderDenied }: RequireRoleProps) {
  if (!allowedRoles.includes(currentRole)) {
    return (
      <>
        {renderDenied(`Tài khoản ${roleLabel(currentRole)} không được cấp quyền xem màn hình này.`)}
      </>
    );
  }

  return <>{children}</>;
}

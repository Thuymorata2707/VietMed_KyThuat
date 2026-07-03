type TechnicalUserLike = {
  engineerProfile?: unknown;
  role?: { id?: string | null; name?: string | null } | null;
  roleName?: string | null;
  status?: string | null;
};

export function isTechnicalUser(user: TechnicalUserLike) {
  const roleName = normalizeRoleName(user.role?.name ?? user.roleName);
  return user.status !== 'INACTIVE' && (roleName === 'engineer' || Boolean(user.engineerProfile));
}

export function technicalUserName(user: { email: string; fullName?: string | null }) {
  return user.fullName || user.email;
}

function normalizeRoleName(value?: string | null) {
  return (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

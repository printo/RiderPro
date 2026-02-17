import { AuthUser } from '@shared/types';

export function isManagerUser(user: AuthUser | null | undefined): boolean {
  if (!user) return false;

  return Boolean(
    user.isSuperUser ||
    user.isOpsTeam ||
    user.isStaff ||
    user.role === 'admin' ||
    user.role === 'manager'
  );
}


import { AuthUser } from '@shared/types';

export function isManagerUser(user: AuthUser | null | undefined): boolean {
  if (!user) return false;

  return Boolean(
    user.is_super_user ||
    user.is_ops_team ||
    user.is_staff ||
    user.role === 'admin' ||
    user.role === 'manager'
  );
}


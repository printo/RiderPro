// Re-export all authentication hooks from the AuthContext for convenience
export {
  useAuth,
  useAuthState,
  useUser,
  usePermissions,
  useIsAuthenticated,
  useHasPermission,
  useHasRole,
  useHasAnyRole,
  useHasAnyPermission,
  useIsAdmin,
  useIsSuperAdmin,
  useIsOpsTeam,
} from '@/contexts/AuthContext';

// Additional utility hooks for common authentication patterns
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Permission, UserRole } from '@/types/Auth';

/**
 * Hook for handling login with loading state and error handling
 */
export function useLogin() {
  const { login } = useAuth();

  const loginWithErrorHandling = useCallback(async (
    employeeId: string,
    password: string,
    onSuccess?: () => void,
    onError?: (message: string) => void
  ) => {
    try {
      const result = await login(employeeId, password);

      if (result.success) {
        onSuccess?.();
      } else {
        onError?.(result.message || 'Login failed');
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      onError?.(message);
      return { success: false, message };
    }
  }, [login]);

  return { login: loginWithErrorHandling };
}

/**
 * Hook for handling logout with confirmation and cleanup
 */
export function useLogout() {
  const { logout } = useAuth();

  const logoutWithConfirmation = useCallback(async (
    skipConfirmation = false,
    onSuccess?: () => void,
    onError?: (error: any) => void
  ) => {
    try {
      if (!skipConfirmation) {
        const confirmed = window.confirm('Are you sure you want to log out?');
        if (!confirmed) {
          return false;
        }
      }

      const result = await logout();

      if (result) {
        onSuccess?.();
      } else {
        onError?.(new Error('Logout failed'));
      }

      return result;
    } catch (error) {
      onError?.(error);
      return false;
    }
  }, [logout]);

  return { logout: logoutWithConfirmation };
}

/**
 * Hook for checking if user can access admin features
 */
export function useCanAccessAdmin(): boolean {
  const { hasAnyRole } = useAuth();
  return hasAnyRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
}

/**
 * Hook for checking if user can view analytics
 */
export function useCanViewAnalytics(): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(Permission.VIEW_ANALYTICS);
}

/**
 * Hook for checking if user can export data
 */
export function useCanExportData(): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(Permission.EXPORT_DATA);
}

/**
 * Hook for checking if user can manage other users
 */
export function useCanManageUsers(): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(Permission.MANAGE_USERS);
}

/**
 * Hook for checking if user can view live tracking
 */
export function useCanViewLiveTracking(): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(Permission.VIEW_LIVE_TRACKING);
}

/**
 * Hook for checking if user can view all routes or only their own
 */
export function useRouteViewPermissions(): {
  canViewAllRoutes: boolean;
  canViewOwnRoutes: boolean;
  canViewAnyRoutes: boolean;
} {
  const { hasPermission } = useAuth();

  const canViewAllRoutes = hasPermission(Permission.VIEW_ALL_ROUTES);
  const canViewOwnRoutes = hasPermission(Permission.VIEW_OWN_ROUTES);
  const canViewAnyRoutes = canViewAllRoutes || canViewOwnRoutes;

  return {
    canViewAllRoutes,
    canViewOwnRoutes,
    canViewAnyRoutes,
  };
}

/**
 * Hook for getting user display information
 */
export function useUserDisplayInfo(): {
  displayName: string;
  initials: string;
  employeeId: string;
  role: string;
} {
  const { user } = useAuth();

  if (!user) {
    return {
      displayName: 'Guest',
      initials: 'G',
      employeeId: '',
      role: 'guest',
    };
  }

  const displayName = user.fullName || user.username || user.employeeId || 'User';
  const initials = displayName
    .split(' ')
    .map(name => name.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return {
    displayName,
    initials,
    employeeId: user.employeeId || user.username,
    role: user.role,
  };
}

/**
 * Hook for authentication debugging (development only)
 */
export function useAuthDebug() {
  const { getAuthenticationStatus, authState } = useAuth();

  const debugInfo = useCallback(() => {
    const status = getAuthenticationStatus();

    return {
      authState,
      serviceStatus: status,
      timestamp: new Date().toISOString(),
    };
  }, [getAuthenticationStatus, authState]);

  return { debugInfo };
}

/**
 * Hook for handling authentication errors consistently
 */
export function useAuthErrorHandler() {
  const handleAuthError = useCallback((error: any, context?: string) => {
    console.error(`[Auth Error${context ? ` - ${context}` : ''}]:`, error);

    // You can extend this to show toast notifications, redirect to login, etc.
    if (error?.status === 401) {
      // Token expired or invalid - user will be redirected automatically by AuthService
      console.log('Authentication expired, user will be redirected to login');
    } else if (error?.status === 403) {
      // Permission denied
      console.log('Permission denied for current action');
    } else {
      // Other auth-related errors
      console.log('Authentication error occurred:', error?.message || 'Unknown error');
    }
  }, []);

  return { handleAuthError };
}
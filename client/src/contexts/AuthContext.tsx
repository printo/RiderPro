import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Permission, UserRole } from '@/types/Auth';
import authService from '@/services/AuthService';

// Enhanced AuthState interface based on the design document
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Authentication result interface
interface AuthResult {
  success: boolean;
  message?: string;
}

// AuthContext interface with all methods and state
interface AuthContextValue {
  // State
  authState: AuthState;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  permissions: Permission[];

  // Authentication methods
  login: (employeeId: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<boolean>;

  // Permission checking utilities
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;

  // Utility methods
  getAuthHeaders: () => Record<string, string>;
  getAuthenticationStatus: () => {
    isAuthenticated: boolean;
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    hasUser: boolean;
    isLoading: boolean;
    listenerCount: number;
  };
}

// Create the context
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// AuthProvider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize state from AuthService
  const [authState, setAuthState] = useState<AuthState>(() => {
    const serviceState = authService.getState();
    return {
      user: serviceState.user,
      accessToken: serviceState.accessToken,
      refreshToken: serviceState.refreshToken,
      permissions: serviceState.permissions,
      isAuthenticated: serviceState.isAuthenticated,
      isLoading: serviceState.isLoading,
    };
  });

  // Subscribe to AuthService state changes
  useEffect(() => {
    console.log('[AuthProvider] Subscribing to AuthService state changes');

    const unsubscribe = authService.subscribe((serviceState) => {
      console.log('[AuthProvider] Received state update from AuthService:', {
        isAuthenticated: serviceState.isAuthenticated,
        hasUser: !!serviceState.user,
        hasAccessToken: !!serviceState.accessToken,
        isLoading: serviceState.isLoading,
      });

      setAuthState({
        user: serviceState.user,
        accessToken: serviceState.accessToken,
        refreshToken: serviceState.refreshToken,
        permissions: serviceState.permissions,
        isAuthenticated: serviceState.isAuthenticated,
        isLoading: serviceState.isLoading,
      });
    });

    return () => {
      console.log('[AuthProvider] Unsubscribing from AuthService');
      unsubscribe();
    };
  }, []);

  // Authentication methods
  const login = useCallback(async (employeeId: string, password: string): Promise<AuthResult> => {
    console.log('[AuthProvider] Login attempt for:', employeeId);
    try {
      const result = await authService.login(employeeId, password);
      console.log('[AuthProvider] Login result:', { success: result.success });
      return result;
    } catch (error) {
      console.error('[AuthProvider] Login error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }, []);

  const logout = useCallback(async (): Promise<boolean> => {
    console.log('[AuthProvider] Logout initiated');
    try {
      const result = await authService.logout();
      console.log('[AuthProvider] Logout result:', result);
      return result;
    } catch (error) {
      console.error('[AuthProvider] Logout error:', error);
      return false;
    }
  }, []);

  // Permission checking utilities
  const hasPermission = useCallback((permission: Permission): boolean => {
    if (!authState.isAuthenticated || !authState.permissions) {
      return false;
    }
    return authState.permissions.includes(permission);
  }, [authState.isAuthenticated, authState.permissions]);

  const hasRole = useCallback((role: UserRole): boolean => {
    if (!authState.isAuthenticated || !authState.user) {
      return false;
    }
    return authState.user.role === role;
  }, [authState.isAuthenticated, authState.user]);

  const hasAnyRole = useCallback((roles: UserRole[]): boolean => {
    if (!authState.isAuthenticated || !authState.user) {
      return false;
    }
    return roles.includes(authState.user.role);
  }, [authState.isAuthenticated, authState.user]);

  const hasAnyPermission = useCallback((permissions: Permission[]): boolean => {
    if (!authState.isAuthenticated || !authState.permissions) {
      return false;
    }
    return permissions.some(permission => authState.permissions.includes(permission));
  }, [authState.isAuthenticated, authState.permissions]);

  // Utility methods
  const getAuthHeaders = useCallback((): Record<string, string> => {
    return authService.getAuthHeaders();
  }, []);

  const getAuthenticationStatus = useCallback(() => {
    return authService.getAuthenticationStatus();
  }, []);

  // Context value
  const contextValue: AuthContextValue = {
    // State
    authState,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    user: authState.user,
    permissions: authState.permissions,

    // Methods
    login,
    logout,

    // Permission utilities
    hasPermission,
    hasRole,
    hasAnyRole,
    hasAnyPermission,

    // Utility methods
    getAuthHeaders,
    getAuthenticationStatus,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// useAuth hook
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  // Add debug logging for auth access (only in development)
  if (process.env.NODE_ENV === 'development') {
    const caller = new Error().stack?.split('\n')[2]?.trim();
    console.log('🔍 useAuth called:', {
      isAuthenticated: context.authState.isAuthenticated,
      hasUser: !!context.authState.user,
      hasAccessToken: !!context.authState.accessToken,
      caller: caller?.substring(0, 100) + '...'
    });
  }

  return context;
}

// Additional convenience hooks for specific use cases
export function useAuthState(): AuthState {
  const { authState } = useAuth();
  return authState;
}

export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

export function usePermissions(): Permission[] {
  const { permissions } = useAuth();
  return permissions;
}

export function useIsAuthenticated(): boolean {
  const { isAuthenticated, authState } = useAuth();

  // Debug logging for authentication checks
  if (process.env.NODE_ENV === 'development') {
    console.log('🔐 useIsAuthenticated called:', {
      isAuthenticated,
      hasUser: !!authState.user,
      hasAccessToken: !!authState.accessToken,
      isLoading: authState.isLoading,
      caller: new Error().stack?.split('\n')[2]?.trim()?.substring(0, 100) + '...'
    });
  }

  return isAuthenticated;
}

// Permission checking hooks
export function useHasPermission(permission: Permission): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}

export function useHasRole(role: UserRole): boolean {
  const { hasRole } = useAuth();
  return hasRole(role);
}

export function useHasAnyRole(roles: UserRole[]): boolean {
  const { hasAnyRole } = useAuth();
  return hasAnyRole(roles);
}

export function useHasAnyPermission(permissions: Permission[]): boolean {
  const { hasAnyPermission } = useAuth();
  return hasAnyPermission(permissions);
}

// Admin role checking hooks for convenience
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return user?.isAdmin || user?.isSuperAdmin || false;
}

export function useIsSuperAdmin(): boolean {
  const { user } = useAuth();
  return user?.isSuperAdmin || false;
}

export function useIsOpsTeam(): boolean {
  const { user } = useAuth();
  return user?.isOpsTeam || false;
}
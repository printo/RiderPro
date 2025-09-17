import { UserRole, Permission } from '../types/Auth';

interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  fullName?: string;
  isActive?: boolean;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface DjangoLoginResponse {
  refresh: string;
  access: string;
  full_name?: string;
  is_ops_team?: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
}

class AuthService {
  private static instance: AuthService;
  private state: AuthState = {
    user: null,
    accessToken: null,
    refreshToken: null,
    permissions: [],
    isAuthenticated: false,
    isLoading: true,
  };
  private listeners: ((state: AuthState) => void)[] = [];

  private constructor() {
    this.initializeAuth();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private initializeAuth() {
    const token = localStorage.getItem('access_token');
    const refresh = localStorage.getItem('refresh_token');
    const userStr = localStorage.getItem('auth_user');
    const permissionsStr = localStorage.getItem('auth_permissions');

    if (token && userStr && permissionsStr) {
      try {
        const user = JSON.parse(userStr);
        const permissions = JSON.parse(permissionsStr);

        this.state = {
          user,
          accessToken: token,
          refreshToken: refresh,
          permissions,
          isAuthenticated: true,
          isLoading: false,
        };

        // Verify token validity
        this.verifyToken().catch(() => {
          this.logout();
        });
      } catch (error) {
        console.error('Failed to parse stored auth data:', error);
        this.logout();
      }
    } else {
      this.state.isLoading = false;
    }

    this.notifyListeners();
  }

  private async verifyToken(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${this.state.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.state.user = data.data.user;
        this.state.permissions = data.data.permissions;
        this.notifyListeners();
        return true;
      } else {
        throw new Error('Token verification failed');
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  }

  private getServerAuthBase(): string { return '/api/auth'; }

  private setCookie(name: string, value: string, days = 7) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  }

  private deleteCookie(name: string) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }

  public async login(email: string, password: string): Promise<{ success: boolean; message?: string }> {
    try {
      const loginUrl = `${this.getServerAuthBase()}/login`;
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        return { success: false, message: 'Invalid credentials' };
      }

      const payload = await response.json();
      const accessToken = payload?.data?.accessToken;
      const refreshToken = payload?.data?.refreshToken;

      const user: User = {
        id: payload?.data?.user?.id || email,
        username: payload?.data?.user?.username || email,
        email: payload?.data?.user?.email || email,
        role: payload?.data?.user?.role || UserRole.DRIVER,
        employeeId: payload?.data?.user?.employeeId,
        isActive: true,
        fullName: payload?.data?.user?.fullName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any;

      const permissions: Permission[] = user.role === UserRole.ADMIN ? [
        Permission.VIEW_ALL_ROUTES,
        Permission.VIEW_ANALYTICS,
        Permission.EXPORT_DATA,
        Permission.MANAGE_USERS,
        Permission.VIEW_LIVE_TRACKING,
        Permission.ACCESS_AUDIT_LOGS,
        Permission.CONFIGURE_SYSTEM,
      ] : [Permission.VIEW_OWN_ROUTES];

      // Store tokens and user
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken || '');
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('auth_permissions', JSON.stringify(permissions));

      // Set cookies if required by API
      this.setCookie('access', accessToken);
      if (refreshToken) this.setCookie('refresh', refreshToken);
      if (user.fullName) this.setCookie('full_name', user.fullName);
      const isOpsTeam = Boolean(payload?.data?.user?.is_ops_team);
      this.setCookie('is_ops_team', String(isOpsTeam));

      // Update state
      this.state = {
        user,
        accessToken,
        refreshToken: refreshToken || null,
        permissions,
        isAuthenticated: true,
        isLoading: false,
      };

      this.notifyListeners();
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, message: 'Login failed due to network error' };
    }
  }

  public async logout(): Promise<void> {
    try {
      // Best-effort client-side logout
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Clear local storage and reset state
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_permissions');

      this.deleteCookie('access');
      this.deleteCookie('refresh');
      this.deleteCookie('full_name');
      this.deleteCookie('is_ops_team');

      this.state = {
        user: null,
        accessToken: null,
        refreshToken: null,
        permissions: [],
        isAuthenticated: false,
        isLoading: false,
      };

      this.notifyListeners();
    }
  }

  public async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.state.accessToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Password change failed:', error);
      return {
        success: false,
        message: 'Password change failed due to network error',
      };
    }
  }

  public getState(): AuthState {
    return { ...this.state };
  }

  public getUser(): User | null {
    return this.state.user;
  }

  public getAccessToken(): string | null {
    return this.state.accessToken;
  }

  public getRefreshToken(): string | null {
    return this.state.refreshToken;
  }

  public isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  public hasPermission(permission: Permission): boolean {
    return this.state.permissions.includes(permission);
  }

  public hasRole(role: UserRole): boolean {
    return this.state.user?.role === role;
  }

  public canAccessEmployeeData(employeeId: string): boolean {
    if (!this.state.user) return false;

    // Admins and managers can access all employee data
    if (
      this.state.user.role === UserRole.ADMIN ||
      this.state.user.role === UserRole.MANAGER
    ) {
      return true;
    }

    // Drivers can only access their own data
    if (this.state.user.role === UserRole.DRIVER) {
      return this.state.user.employeeId === employeeId;
    }

    return false;
  }

  public getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.state.accessToken) {
      headers['Authorization'] = `Bearer ${this.state.accessToken}`;
    }

    return headers;
  }

  public subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error('Auth listener error:', error);
      }
    });
  }

  // Utility method for making authenticated API requests
  public async authenticatedFetch(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const headers = {
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle token expiration
    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) {
        await this.logout();
        throw new Error('Authentication expired');
      }
      // retry once
      const retryHeaders = {
        ...this.getAuthHeaders(),
        ...options.headers,
      };
      return fetch(url, { ...options, headers: retryHeaders });
    }

    return response;
  }

  public async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;
    try {
      const refreshUrl = `${this.getServerAuthBase()}/refresh`;
      const res = await fetch(refreshUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.state.user?.id, refresh: refreshToken })
      });
      if (!res.ok) return false;
      const data = await res.json();
      const newAccess = data?.data?.accessToken;
      if (!newAccess) return false;
      localStorage.setItem('access_token', newAccess);
      this.setCookie('access', newAccess);
      this.state.accessToken = newAccess;
      this.state.isAuthenticated = true;
      this.notifyListeners();
      return true;
    } catch (e) {
      return false;
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
export default authService;

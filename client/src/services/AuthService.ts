// client/src/services/AuthService.ts
import { User, UserRole, Permission } from '../types/Auth';

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
  private readonly API_BASE = 'https://pia.printo.in/api/v1';

  private constructor() {
    this.initializeAuth();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Centralized state update
   */
  private setAuthState(newState: Partial<AuthState>) {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  /**
   * Refresh the access token using the refresh token
   */
  public async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.state.refreshToken || localStorage.getItem('refresh_token');
    if (!refreshToken) {
      console.log('No refresh token available');
      return false;
    }

    try {
      console.log('Attempting to refresh token...');

      const response = await fetch(`${this.API_BASE}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        console.error('Token refresh failed with status:', response.status);
        await this.logout();
        return false;
      }

      const data = await response.json();
      if (!data.accessToken) {
        console.error('No access token in refresh response');
        return false;
      }

      // Persist tokens
      localStorage.setItem('access_token', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('refresh_token', data.refreshToken);
      }

      // Update state
      this.setAuthState({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });

      console.log('Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  private initializeAuth() {
    const token = localStorage.getItem('access_token');
    const refresh = localStorage.getItem('refresh_token');
    const userStr = localStorage.getItem('auth_user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        const permissions = this.getPermissionsForRole(user.role);

        this.setAuthState({
          user,
          accessToken: token,
          refreshToken: refresh,
          permissions,
          isAuthenticated: true,
          isLoading: false,
        });

        this.verifyToken().catch(() => {
          console.log('Stored token is invalid, clearing auth data');
          this.clearAuthData();
        });
      } catch (error) {
        console.error('Failed to parse stored auth data:', error);
        this.clearAuthData();
      }
    } else {
      this.setAuthState({ isLoading: false });
    }
  }

  private async verifyToken(): Promise<boolean> {
    if (!this.state.accessToken) return false;

    try {
      const response = await this.authenticatedFetch('/auth/me/');
      return response.ok;
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  }

  private getPermissionsForRole(role: UserRole): Permission[] {
    switch (role) {
      case UserRole.ADMIN:
        return [
          Permission.VIEW_ALL_ROUTES,
          Permission.VIEW_ANALYTICS,
          Permission.EXPORT_DATA,
          Permission.MANAGE_USERS,
          Permission.VIEW_LIVE_TRACKING,
          Permission.ACCESS_AUDIT_LOGS,
          Permission.CONFIGURE_SYSTEM,
        ];
      case UserRole.MANAGER:
        return [
          Permission.VIEW_ALL_ROUTES,
          Permission.VIEW_ANALYTICS,
          Permission.EXPORT_DATA,
          Permission.VIEW_LIVE_TRACKING,
        ];
      case UserRole.DRIVER:
        return [Permission.VIEW_OWN_ROUTES];
      default:
        return [];
    }
  }

  public async login(employeeId: string, password: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log('Attempting login for employee ID:', employeeId);

      const response = await fetch(`${this.API_BASE}/auth/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'http://localhost:5000',
        },
        mode: 'cors',
        credentials: 'include',
        body: JSON.stringify({ email: employeeId, password }),
      });

      if (!response.ok) {
        let errorMessage = 'Authentication failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          errorMessage = `Authentication failed (${response.status})`;
        }
        return { success: false, message: errorMessage };
      }

      const data = await response.json();
      const { access, refresh, full_name, is_ops_team = false, is_admin = false, is_super_admin = false, user_id } = data;

      if (!access) {
        return { success: false, message: 'No access token received' };
      }

      let role: UserRole;
      if (is_super_admin) role = UserRole.SUPER_ADMIN;
      else if (is_admin) role = UserRole.ADMIN;
      else if (is_ops_team) role = UserRole.OPS_TEAM;
      else role = UserRole.DRIVER;

      const user: User = {
        id: user_id?.toString() || employeeId,
        username: employeeId,
        email: `${employeeId}@company.com`,
        role,
        employeeId: employeeId,
        isActive: true,
        fullName: full_name || `Employee ${employeeId}`,
        lastLogin: new Date().toISOString(),
        isOpsTeam: is_ops_team,
        isAdmin: is_admin,
        isSuperAdmin: is_super_admin,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const permissions = this.getPermissionsForRole(role);

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh || '');
      localStorage.setItem('auth_user', JSON.stringify(user));

      this.setAuthState({
        user,
        accessToken: access,
        refreshToken: refresh || null,
        permissions,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Network error occurred' };
    }
  }

  public async logout(): Promise<boolean> {
    console.log('Initiating logout...');
    try {
      if (this.state.accessToken) {
        const response = await fetch(`${this.API_BASE}/auth/logout/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.accessToken}`,
          },
          credentials: 'include',
        });

        if (!response.ok) throw new Error(`Logout failed with status: ${response.status}`);
      }
      this.clearAuthData();
      return true;
    } catch (error) {
      console.error('Logout failed:', error);
      this.clearAuthData();
      return false;
    }
  }

  private clearAuthData(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');

    this.setAuthState({
      user: null,
      accessToken: null,
      refreshToken: null,
      permissions: [],
      isAuthenticated: false,
      isLoading: false,
    });
  }

  public async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const fullUrl = url.startsWith('http') ? url : `${this.API_BASE}${url}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.state.accessToken) {
      headers['Authorization'] = `Bearer ${this.state.accessToken}`;
    }

    const fetchOptions: RequestInit = { ...options, mode: 'cors', credentials: 'include', headers };

    try {
      const response = await fetch(fullUrl, fetchOptions);

      if (response.status === 401 && this.state.accessToken) {
        console.log('Token expired, attempting refresh...');
        const refreshSuccess = await this.refreshAccessToken();
        if (refreshSuccess) {
          return fetch(fullUrl, {
            ...fetchOptions,
            headers: { ...headers, 'Authorization': `Bearer ${this.state.accessToken}` },
          });
        } else {
          await this.logout();
          throw new Error('Session expired. Please log in again.');
        }
      }
      return response;
    } catch (error) {
      console.error('Authenticated fetch error:', error);
      throw error;
    }
  }

  // New method that works with local API endpoints (like /api/shipments)
  public async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.state.accessToken) {
      throw new Error('No access token available');
    }

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
      'Authorization': `Bearer ${this.state.accessToken}`,
    };

    let response = await fetch(url, {
      ...options,
      headers,
    });

    // If we get a 401, try to refresh the token and retry
    if (response.status === 401) {
      try {
        await this.refreshAccessToken();
        
        // Retry with new token
        const newHeaders = {
          ...options.headers,
          'Authorization': `Bearer ${this.state.accessToken}`,
        };

        response = await fetch(url, {
          ...options,
          headers: newHeaders,
        });
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        await this.logout();
        throw refreshError;
      }
    }

    return response;
  }

  // --- Getters ---
  public getState(): AuthState {
    return { ...this.state };
  }

  public isAuthenticated(): boolean {
    return !!this.state.accessToken && this.state.isAuthenticated;
  }

  public getUser(): User | null {
    return this.state.user;
  }

  public getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.state.accessToken) {
      headers['Authorization'] = `Bearer ${this.state.accessToken}`;
    }
    return headers;
  }

  public hasRole(role: UserRole): boolean {
    return this.state.user?.role === role;
  }

  // --- Subscription ---
  public subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    listener(this.getState());

    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (error) {
        console.error('Auth listener error:', error);
      }
    });
  }
}

// Export singleton
export const authService = AuthService.getInstance();
export default authService;

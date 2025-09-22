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
    if (!refreshToken || !this.state.user) {
      console.log('No refresh token available');
      return false;
    }

    try {
      console.log('Attempting to refresh token...');

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: this.state.user.id, 
          refresh: refreshToken 
        }),
      });

      if (!response.ok) {
        console.error('Token refresh failed with status:', response.status);
        await this.logout();
        return false;
      }

      const result = await response.json();
      if (!result.success || !result.data.accessToken) {
        console.error('No access token in refresh response');
        await this.logout();
        return false;
      }

      // Persist tokens
      localStorage.setItem('access_token', result.data.accessToken);

      // Update state
      this.setAuthState({
        accessToken: result.data.accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });

      console.log('Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      await this.logout();
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
      // Try to make a simple authenticated request to verify token
      const response = await fetch('/api/dashboard', {
        headers: {
          'Authorization': `Bearer ${this.state.accessToken}`,
        },
      });
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

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: employeeId, password }),
      });

      if (!response.ok) {
        let errorMessage = 'Authentication failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = `Authentication failed (${response.status})`;
        }
        return { success: false, message: errorMessage };
      }

      const result = await response.json();
      if (!result.success) {
        return { success: false, message: result.message || 'Login failed' };
      }

      const { accessToken, refreshToken, user: userData } = result.data;

      if (!accessToken) {
        return { success: false, message: 'No access token received' };
      }

      // Map the user data to our User interface
      let role: UserRole;
      if (userData.role === 'super_admin') role = UserRole.SUPER_ADMIN;
      else if (userData.role === 'admin') role = UserRole.ADMIN;
      else if (userData.role === 'ops_team') role = UserRole.OPS_TEAM;
      else role = UserRole.DRIVER;

      const user: User = {
        id: userData.id,
        username: userData.employeeId,
        email: userData.email,
        role,
        employeeId: userData.employeeId,
        isActive: true,
        fullName: userData.name || `Employee ${employeeId}`,
        lastLogin: new Date().toISOString(),
        isOpsTeam: userData.role === 'ops_team',
        isAdmin: userData.role === 'admin' || userData.role === 'super_admin',
        isSuperAdmin: userData.role === 'super_admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const permissions = this.getPermissionsForRole(role);

      localStorage.setItem('access_token', accessToken);
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }
      localStorage.setItem('auth_user', JSON.stringify(user));

      this.setAuthState({
        user,
        accessToken,
        refreshToken: refreshToken || null,
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
      // Just clear local data - backend doesn't need a logout endpoint for JWT tokens
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

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

  private initializeAuth() {
    const token = localStorage.getItem('access_token');
    const refresh = localStorage.getItem('refresh_token');
    const userStr = localStorage.getItem('auth_user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        const permissions = this.getPermissionsForRole(user.role);

        this.state = {
          user,
          accessToken: token,
          refreshToken: refresh,
          permissions,
          isAuthenticated: true,
          isLoading: false,
        };

        // Verify token is still valid
        this.verifyToken().catch(() => {
          console.log('Stored token is invalid, clearing auth data');
          this.clearAuthData();
        });
      } catch (error) {
        console.error('Failed to parse stored auth data:', error);
        this.clearAuthData();
      }
    } else {
      this.state.isLoading = false;
    }

    this.notifyListeners();
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

      const response = await fetch('https://pia.printo.in/api/v1/auth/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'http://localhost:5000',
        },
        mode: 'cors',
        credentials: 'include',
        body: JSON.stringify({ 
          email: employeeId,
          password 
        }),
      });

      console.log('Login response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Authentication failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = `Authentication failed (${response.status})`;
        }
        console.error('Login failed:', errorMessage);
        return { success: false, message: errorMessage };
      }

      const data = await response.json();
      console.log('Login successful, processing response', data);

      const { 
        access, 
        refresh, 
        full_name, 
        is_ops_team = false, 
        is_admin = false, 
        is_super_admin = false,
        user_id
      } = data;

      if (!access) {
        return { success: false, message: 'No access token received' };
      }

      // Determine user role based on the flags from the API
      let role: UserRole;
      if (is_super_admin) {
        role = UserRole.SUPER_ADMIN;
      } else if (is_admin) {
        role = UserRole.ADMIN;
      } else if (is_ops_team) {
        role = UserRole.OPS_TEAM;
      } else {
        // Default role for other users
        role = UserRole.DRIVER;
      }

      // Create user object with all the properties
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
        updatedAt: new Date().toISOString()
      };

      // Get permissions for role
      const permissions = this.getPermissionsForRole(role);

      // Store tokens in localStorage
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh || '');
      localStorage.setItem('auth_user', JSON.stringify(user));

      // Update state
      this.state = {
        user,
        accessToken: access,
        refreshToken: refresh || null,
        permissions,
        isAuthenticated: true,
        isLoading: false,
      };

      console.log('Login state updated successfully');
      this.notifyListeners();
      return { success: true };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Network error occurred' };
    }
  }

  public async logout(): Promise<boolean> {
    console.log('Initiating logout...');
    
    // Try to call logout endpoint
    try {
      if (this.state.accessToken) {
        const response = await fetch('https://pia.printo.in/api/v1/auth/logout/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.accessToken}`,
          },
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error(`Logout failed with status: ${response.status}`);
        }
      }
      
      // Clear local data
      this.clearAuthData();
      
      console.log('Logout successful');
      return true;
      
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear local data even if server logout fails
      this.clearAuthData();
      return false;
    }
  }

  private clearAuthData(): void {
    // Clear localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');

    // Reset state
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

  public async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.state.refreshToken;
    if (!refreshToken) {
      console.log('No refresh token available');
      return false;
    }
    
    try {
      console.log('Attempting to refresh token...');
      
      const response = await fetch(`${this.API_BASE}/auth/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        mode: 'cors',
        credentials: 'include',
        body: JSON.stringify({ refresh: refreshToken }),
      });
      
      if (!response.ok) {
        console.error('Token refresh failed with status:', response.status);
        return false;
      }
      
      const data = await response.json();
      
      if (!data.access) {
        console.error('No access token in refresh response');
        return false;
      }
      
      // Update stored tokens
      localStorage.setItem('access_token', data.access);
      if (data.refresh) {
        localStorage.setItem('refresh_token', data.refresh);
      }
      
      // Update state
      this.state.accessToken = data.access;
      if (data.refresh) {
        this.state.refreshToken = data.refresh;
      }
      
      console.log('Token refreshed successfully');
      this.notifyListeners();
      return true;
      
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  // Helper method for making authenticated API requests
  public async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // If the URL doesn't start with http, assume it's a relative API path
    const fullUrl = url.startsWith('http') ? url : `${this.API_BASE}${url}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Always include Authorization header
    if (this.state.accessToken) {
      headers['Authorization'] = `Bearer ${this.state.accessToken}`;
    }

    const fetchOptions: RequestInit = {
      ...options,
      mode: 'cors',
      credentials: 'include',
      headers,
    };

    try {
      const response = await fetch(fullUrl, fetchOptions);

      // Handle token expiration
      if (response.status === 401 && this.state.accessToken) {
        console.log('Token expired, attempting refresh...');
        
        const refreshSuccess = await this.refreshAccessToken();
        if (refreshSuccess) {
          // Retry with new token
          const retryHeaders: Record<string, string> = {
            ...headers,
            'Authorization': `Bearer ${this.state.accessToken}`,
          };
          
          return fetch(fullUrl, {
            ...fetchOptions,
            headers: retryHeaders,
          });
        } else {
          // Refresh failed, logout user
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

  // Getter methods
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.state.accessToken) {
      headers['Authorization'] = `Bearer ${this.state.accessToken}`;
    }
    
    return headers;
  }

  public hasRole(role: UserRole): boolean {
    return this.state.user?.role === role;
  }

  // Subscribe to auth state changes
  public subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    // Immediately notify the new listener of the current state
    listener(this.getState());
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
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

// Export singleton instance
export const authService = AuthService.getInstance();
export default authService;
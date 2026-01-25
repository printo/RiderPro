// client/src/services/AuthService.ts
import { AuthUser, UserRole, AuthState } from '@shared/types';
import { log } from "../utils/logger.js";

interface ExternalAuthResponse {
  access: string;
  refresh: string;
  full_name: string;
  is_staff?: boolean;
  is_super_user?: boolean;
  is_ops_team?: boolean;
  employee_id?: string;
}

interface LocalAuthResponse {
  success: boolean;
  message?: string;
  accessToken: string;
  refreshToken: string;
  fullName: string;
  isApproved: boolean;
  is_super_user?: boolean;
  is_staff?: boolean;
  is_ops_team?: boolean;
  employee_id?: string;
  role?: string;
}

class AuthService {
  private static instance: AuthService;
  private state: AuthState = {
    user: null,
    accessToken: null,
    refreshToken: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  };
  private listeners: ((state: AuthState) => void)[] = [];

  private constructor() {
    this.initializeFromStorage();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Initialize auth state from localStorage
  private initializeFromStorage(): void {
    try {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');
      const fullName = localStorage.getItem('full_name');
      const employeeId = localStorage.getItem('employee_id');
      const isRider = localStorage.getItem('is_rider') === 'true';
      const isSuperUser = localStorage.getItem('is_super_user') === 'true';
      const isOpsTeam = localStorage.getItem('is_ops_team') === 'true';
      const isStaff = localStorage.getItem('is_staff') === 'true';

      if (accessToken && fullName && employeeId) {
        // Use new role determination logic
        const role = isSuperUser ? UserRole.ADMIN : (isRider ? UserRole.MANAGER : UserRole.DRIVER);

        this.state = {
          user: {
            id: employeeId,
            username: employeeId,
            email: '',
            role,
            employeeId,
            fullName,
            isActive: true,
            isApproved: true, // Assume approved if we have valid tokens
            isRider,
            isSuperUser,
            // Original PIA roles for server-side filtering
            isOpsTeam,
            isStaff,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          accessToken,
          token: accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        };
      } else {
        this.state = {
          user: null,
          accessToken: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        };
      }
    } catch (error) {
      console.error('Error initializing auth from storage:', error);
      this.state = {
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      };
    }
  }

  // Determine role based on API response flags from PIA
  // PIA sends: is_ops_team, is_super_user, is_staff
  // We map to internal roles: is_rider, is_super_user
  private determineRole(isStaff?: boolean, isSuperUser?: boolean, isOpsTeam?: boolean): UserRole {
    // Map PIA roles to UI roles
    if (isSuperUser === true) {
      return UserRole.ADMIN; // Only super users get admin access
    }
    if (isOpsTeam === true || isStaff === true) {
      return UserRole.MANAGER; // Ops team and staff get manager access
    }
    // Default to DRIVER for anything else
    return UserRole.DRIVER;
  }

  // Helper method to map PIA response to internal role flags
  private mapPIARolesToInternal(isStaff?: boolean, isSuperUser?: boolean, isOpsTeam?: boolean): {
    is_rider: boolean;
    is_super_user: boolean;
  } {
    // is_super_user: true → is_super_user: true
    if (isSuperUser === true) {
      return {
        is_rider: false,
        is_super_user: true
      };
    }

    // is_ops_team: true OR is_staff: true → is_rider: true
    if (isOpsTeam === true || isStaff === true) {
      return {
        is_rider: true,
        is_super_user: false
      };
    }

    // Everything else → is_driver (default, no special flags)
    return {
      is_rider: false,
      is_super_user: false
    };
  }

  // Method A: External API Authentication
  public async loginWithExternalAPI(employeeId: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      this.setState({ isLoading: true });

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: employeeId,  // Proxy expects 'email' field
          password: password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, message: errorData.message || 'Invalid credentials' };
      }

      const data: ExternalAuthResponse = await response.json();
      log.dev('[AuthService] PIA API response:', data);

      // Map PIA roles to internal role structure
      const internalRoles = this.mapPIARolesToInternal(data.is_staff, data.is_super_user, data.is_ops_team);

      // Save to localStorage with all user details
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      localStorage.setItem('full_name', data.full_name);
      localStorage.setItem('employee_id', employeeId);  // Use the original employee ID
      localStorage.setItem('is_rider', internalRoles.is_rider.toString());
      localStorage.setItem('is_super_user', internalRoles.is_super_user.toString());
      // Also save original PIA roles for server-side filtering
      localStorage.setItem('is_ops_team', (data.is_ops_team || false).toString());
      localStorage.setItem('is_staff', (data.is_staff || false).toString());

      const role = this.determineRole(data.is_staff, data.is_super_user, data.is_ops_team);

      this.setState({
        user: {
          id: employeeId,  // Use the original employee ID
          username: employeeId,
          email: '',
          role,
          employeeId: employeeId,
          fullName: data.full_name,
          isActive: true,
          isApproved: true, // PIA users are always approved
          isRider: internalRoles.is_rider,
          isSuperUser: internalRoles.is_super_user,
          // Original PIA roles for server-side filtering
          isOpsTeam: data.is_ops_team || false,
          isStaff: data.is_staff || false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        accessToken: data.access,
        refreshToken: data.refresh,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true, message: 'Login successful' };
    } catch (error) {
      console.error('External API login error:', error);
      this.setState({ isLoading: false });
      return { success: false, message: 'Login failed. Please try again.' };
    }
  }

  // Method B: Local Database Authentication
  public async loginWithLocalDB(riderId: string, password: string): Promise<{ success: boolean; message: string; isApproved?: boolean }> {
    try {
      this.setState({ isLoading: true });

      const response = await fetch('/api/auth/local-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          riderId,
          password,
        }),
      });

      const data: LocalAuthResponse = await response.json();

      if (!data.success) {
        this.setState({ isLoading: false });
        return { success: false, message: data.message || 'Login failed' };
      }

      if (!data.isApproved) {
        this.setState({ isLoading: false });
        return { success: false, message: 'Account pending approval', isApproved: false };
      }

      // Map PIA roles to internal role structure
      const internalRoles = this.mapPIARolesToInternal(data.is_staff, data.is_super_user, data.is_ops_team);

      // Save to localStorage with all user details
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      localStorage.setItem('full_name', data.fullName);
      localStorage.setItem('employee_id', riderId);
      localStorage.setItem('is_rider', internalRoles.is_rider.toString());
      localStorage.setItem('is_super_user', internalRoles.is_super_user.toString());
      localStorage.setItem('is_ops_team', (data.is_ops_team || false).toString());
      localStorage.setItem('is_staff', (data.is_staff || false).toString());

      const role = this.determineRole(data.is_staff, data.is_super_user, data.is_ops_team);

      this.setState({
        user: {
          id: riderId,
          username: riderId,
          email: '',
          role,
          employeeId: riderId,
          fullName: data.fullName,
          isActive: true,
          isApproved: data.isApproved || false,
          isRider: internalRoles.is_rider,
          isSuperUser: internalRoles.is_super_user,
          isOpsTeam: data.is_ops_team || false,
          isStaff: data.is_staff || false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true, message: 'Login successful' };
    } catch (error) {
      console.error('Local DB login error:', error);
      this.setState({ isLoading: false });
      return { success: false, message: 'Login failed. Please try again.' };
    }
  }

  // Register new user (local database)
  public async registerUser(riderId: string, password: string, fullName: string, email?: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          riderId,
          password,
          fullName,
          email,
        }),
      });

      const data = await response.json();
      return { success: data.success, message: data.message };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Registration failed. Please try again.' };
    }
  }

  // Refresh token automatically
  public async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        return false;
      }

      const response = await fetch('https://pia.printo.in/api/v1/auth/refresh/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh: refreshToken,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();

      // Update localStorage
      localStorage.setItem('access_token', data.access);
      if (data.refresh) {
        localStorage.setItem('refresh_token', data.refresh);
      }

      // Update state
      this.setState({
        accessToken: data.access,
        refreshToken: data.refresh || refreshToken,
      });

      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  // Authenticated fetch with automatic token refresh
  public async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const accessToken = localStorage.getItem('access_token');

    if (!accessToken) {
      throw new Error('No access token available');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      ...(options.headers as Record<string, string> || {}),
    };

    let response = await fetch(url, {
      ...options,
      headers
    });

    // If 401, try to refresh token and retry
    if (response.status === 401) {
      const refreshSuccess = await this.refreshAccessToken();
      if (refreshSuccess) {
        const newAccessToken = localStorage.getItem('access_token');
        const newHeaders = { ...headers, 'Authorization': `Bearer ${newAccessToken}` };
        response = await fetch(url, {
          ...options,
          headers: newHeaders
        });
      } else {
        // Refresh failed, logout user
        this.logout();
        throw new Error('Session expired. Please log in again.');
      }
    }

    return response;
  }

  // Logout
  public logout(): void {
    // Clear localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('full_name');
    localStorage.removeItem('employee_id');
    localStorage.removeItem('is_staff');
    localStorage.removeItem('is_super_user');
    localStorage.removeItem('is_ops_team');

    // Clear state
    this.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }

  // State management
  private setState(newState: Partial<AuthState>): void {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  public subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Getters
  public getState(): AuthState {
    return this.state;
  }

  public isAuthenticated(): boolean {
    return this.state.isAuthenticated && !!this.state.accessToken;
  }

  public getUser(): AuthUser | null {
    return this.state.user;
  }

  public getAccessToken(): string | null | undefined {
    return this.state.accessToken;
  }

  public getAuthHeaders(): Record<string, string> {
    const accessToken = this.state.accessToken;
    if (!accessToken) {
      return {};
    }
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  }
}

export default AuthService;

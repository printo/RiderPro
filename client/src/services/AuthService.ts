// client/src/services/AuthService.ts
import { AuthUser, UserRole, AuthState } from '@shared/types';
import { log } from "../utils/logger.js";
import { API_ENDPOINTS } from '@/config/api';

interface ExternalAuthResponse {
  access: string;
  refresh: string;
  full_name: string;
  is_staff?: boolean;
  is_super_user?: boolean;
  is_ops_team?: boolean;
  username?: string;
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
  username?: string;
  role?: string;
}

class AuthService {
  private static instance: AuthService;
  private state: AuthState = {
    user: null,
    access_token: null,
    refresh_token: null,
    token: null,
    is_authenticated: false,
    is_loading: true,
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
      const username = localStorage.getItem('username');
      const isRider = localStorage.getItem('is_rider') === 'true';
      const isSuperUser = localStorage.getItem('is_super_user') === 'true';
      const isOpsTeam = localStorage.getItem('is_ops_team') === 'true';
      const isStaff = localStorage.getItem('is_staff') === 'true';

      if (accessToken && fullName && username) {
        // Use new role determination logic
        const role = isSuperUser ? UserRole.ADMIN : (isRider ? UserRole.MANAGER : UserRole.RIDER);

        this.state = {
          user: {
            id: username,
            username: username,
            email: '',
            role,
            employee_id: username, // Keep for backward compatibility
            full_name: fullName,
            is_active: true,
            is_approved: true, // Assume approved if we have valid tokens
            is_rider: isRider,
            is_super_user: isSuperUser,
            // Original PIA roles for server-side filtering
            is_ops_team: isOpsTeam,
            is_staff: isStaff,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          access_token: accessToken,
          token: accessToken,
          refresh_token: refreshToken,
          is_authenticated: true,
          is_loading: false,
        };
      } else {
        this.state = {
          user: null,
          access_token: null,
          token: null,
          refresh_token: null,
          is_authenticated: false,
          is_loading: false,
        };
      }
    } catch (error) {
      console.error('Error initializing auth from storage:', error);
      this.state = {
        user: null,
        access_token: null,
        refresh_token: null,
        is_authenticated: false,
        is_loading: false,
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
    // Default to RIDER for anything else
    return UserRole.RIDER;
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

    // Everything else → is_rider (default, no special flags)
    return {
      is_rider: false,
      is_super_user: false
    };
  }

  // Helper to set cookies
  private setCookies(access: string, refresh: string, fullName: string, isOpsTeam: boolean): void {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    const sameSite = '; SameSite=Lax';
    const path = '; Path=/';
    const maxAge = '; Max-Age=86400'; // 1 day

    document.cookie = `access=${access}${path}${maxAge}${secure}${sameSite}`;
    document.cookie = `refresh=${refresh}${path}${maxAge}${secure}${sameSite}`;
    document.cookie = `full_name=${fullName}${path}${maxAge}${secure}${sameSite}`;
    document.cookie = `is_ops_team=${isOpsTeam}${path}${maxAge}${secure}${sameSite}`;
  }

  // Helper to clear cookies
  private clearCookies(): void {
    const path = '; Path=/';
    const expire = '; Max-Age=0';

    document.cookie = `access=${path}${expire}`;
    document.cookie = `refresh=${path}${expire}`;
    document.cookie = `full_name=${path}${expire}`;
    document.cookie = `is_ops_team=${path}${expire}`;
  }

  // Method A: External API Authentication
  public async loginWithExternalAPI(username: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      this.setState({ is_loading: true });

      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,  // Username is the email value from estimator DB
          password: password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.setState({ is_loading: false });
        return { success: false, message: errorData.message || 'Invalid credentials' };
      }

      const data: ExternalAuthResponse = await response.json();
      log.dev('[AuthService] PIA API response:', data);

      // Map PIA roles to internal role structure
      const internalRoles = this.mapPIARolesToInternal(data.is_staff, data.is_super_user, data.is_ops_team);

      // Get username from response or use the one provided
      const userUsername = data.username || username;

      // Save to localStorage with all user details
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      localStorage.setItem('full_name', data.full_name);
      localStorage.setItem('username', userUsername);  // Username is the primary identifier
      localStorage.setItem('is_rider', internalRoles.is_rider.toString());
      localStorage.setItem('is_super_user', internalRoles.is_super_user.toString());
      localStorage.setItem('isadmin', internalRoles.is_super_user.toString()); // Added per requirement
      // Also save original PIA roles for server-side filtering
      localStorage.setItem('is_ops_team', (data.is_ops_team || false).toString());
      localStorage.setItem('is_staff', (data.is_staff || false).toString());

      // Set cookies as requested
      this.setCookies(data.access, data.refresh, data.full_name, data.is_ops_team || false);

      const role = this.determineRole(data.is_staff, data.is_super_user, data.is_ops_team);

      this.setState({
        user: {
          id: userUsername,
          username: userUsername,
          email: '',
          role,
          employee_id: userUsername, // Keep for backward compatibility
          full_name: data.full_name,
          is_active: true,
          is_approved: true, // PIA users are always approved
          is_rider: internalRoles.is_rider,
          is_super_user: internalRoles.is_super_user,
          // Original PIA roles for server-side filtering
          is_ops_team: data.is_ops_team || false,
          is_staff: data.is_staff || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        access_token: data.access,
        refresh_token: data.refresh,
        is_authenticated: true,
        is_loading: false,
      });

      return { success: true, message: 'Login successful' };
    } catch (error) {
      console.error('External API login error:', error);
      this.setState({ is_loading: false });
      return { success: false, message: 'Login failed. Please try again.' };
    }
  }

  // Method B: Local Database Authentication
  public async loginWithLocalDB(riderId: string, password: string): Promise<{ success: boolean; message: string; isApproved?: boolean }> {
    try {
      this.setState({ is_loading: true });

      const response = await fetch('/api/v1/auth/local-login', {
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
        this.setState({ is_loading: false });
        return { success: false, message: data.message || 'Login failed' };
      }

      if (!data.isApproved) {
        this.setState({ is_loading: false });
        return { success: false, message: 'Account pending approval', isApproved: false };
      }

      // Map PIA roles to internal role structure
      const internalRoles = this.mapPIARolesToInternal(data.is_staff, data.is_super_user, data.is_ops_team);

      // Get username from response or use riderId
      const userUsername = data.username || riderId;

      // Save to localStorage with all user details
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      localStorage.setItem('full_name', data.fullName);
      localStorage.setItem('username', userUsername);  // Username is the primary identifier
      localStorage.setItem('is_rider', internalRoles.is_rider.toString());
      localStorage.setItem('is_super_user', internalRoles.is_super_user.toString());
      localStorage.setItem('is_ops_team', (data.is_ops_team || false).toString());
      localStorage.setItem('is_staff', (data.is_staff || false).toString());

      const role = this.determineRole(data.is_staff, data.is_super_user, data.is_ops_team);

      this.setState({
        user: {
          id: userUsername,
          username: userUsername,
          email: '',
          role,
          employee_id: userUsername, // Keep for backward compatibility
          full_name: data.fullName,
          is_active: true,
          is_approved: data.isApproved || false,
          is_rider: internalRoles.is_rider,
          is_super_user: internalRoles.is_super_user,
          is_ops_team: data.is_ops_team || false,
          is_staff: data.is_staff || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
        is_authenticated: true,
        is_loading: false,
      });

      return { success: true, message: 'Login successful' };
    } catch (error) {
      console.error('Local DB login error:', error);
      this.setState({ is_loading: false });
      return { success: false, message: 'Login failed. Please try again.' };
    }
  }

  // Register new user (local database)
  public async registerUser(riderId: string, password: string, fullName: string, email?: string, riderType?: string, dispatchOption?: string, homebaseId?: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          riderId,
          password,
          fullName,
          email,
          riderType,
          dispatchOption,
          homebaseId,
        }),
      });

      const data = await response.json();
      return { success: data.success, message: data.message };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Registration failed. Please try again.' };
    }
  }

  // Fetch all homebases
  public async fetchHomebases(): Promise<{ success: boolean; homebases?: any[]; message?: string }> {
    try {
      const response = await fetch('/api/v1/auth/homebases/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      const data = await response.json();
      return {
        success: data.success,
        homebases: data.homebases,
        message: data.message
      };
    } catch (error) {
      console.error('Fetch homebases error:', error);
      return { success: false, message: 'Failed to fetch homebases' };
    }
  }

  // Sync homebases from POPS
  public async syncHomebases(): Promise<{ success: boolean; message: string; stats?: any }> {
    try {
      const response = await fetch('/api/v1/auth/homebases/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      const data = await response.json();
      return {
        success: data.success,
        message: data.message,
        stats: data.stats
      };
    } catch (error) {
      console.error('Sync homebases error:', error);
      return { success: false, message: 'Failed to sync homebases' };
    }
  }

  // Refresh token automatically
  public async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        log.warn('[AuthService] No refresh token available');
        return false;
      }

      // Use RiderPro API for token refresh
      const response = await fetch(API_ENDPOINTS.auth.refresh, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({
          refresh: refreshToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.detail || 'Token refresh failed';

        // Check if token is blacklisted or revoked
        if (errorMessage.includes('blacklisted') || errorMessage.includes('revoked')) {
          log.warn('[AuthService] Token is blacklisted or revoked, forcing logout');
          await this.logout();
          return false;
        }

        log.error('[AuthService] Token refresh failed:', errorData);
        return false;
      }

      const data = await response.json();

      // Update localStorage
      localStorage.setItem('access_token', data.access);
      if (data.refresh) {
        localStorage.setItem('refresh_token', data.refresh);
      }

      // Update cookies
      const fullName = localStorage.getItem('full_name') || '';
      const isOpsTeam = localStorage.getItem('is_ops_team') === 'true';
      this.setCookies(data.access, data.refresh || refreshToken, fullName, isOpsTeam);

      // Update state
      this.setState({
        access_token: data.access,
        refresh_token: data.refresh || refreshToken,
      });

      log.dev('[AuthService] Token refreshed successfully');
      return true;
    } catch (error) {
      log.error('[AuthService] Token refresh error:', error);
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
  public async logout(): Promise<void> {
    try {
      // Call backend logout endpoint to blacklist token
      // This ensures the token is blacklisted on the server
      const accessToken = localStorage.getItem('access_token');
      if (accessToken) {
        try {
          const response = await fetch(API_ENDPOINTS.auth.logout, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            credentials: 'include', // Include cookies
          });

          if (response.ok) {
            log.dev('[AuthService] Token blacklisted on server');
          } else {
            log.warn('[AuthService] Logout endpoint returned error, but continuing with local cleanup');
          }
        } catch (error) {
          // If backend is unreachable, still clear local state
          log.warn('[AuthService] Failed to call logout endpoint, but continuing with local cleanup:', error);
        }
      }
    } catch (error) {
      log.warn('[AuthService] Error during logout API call, but continuing with local cleanup:', error);
    }

    // Always clear local state, even if backend call fails
    // Clear localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('full_name');
    localStorage.removeItem('username');
    localStorage.removeItem('is_staff');
    localStorage.removeItem('is_super_user');
    localStorage.removeItem('isadmin');
    localStorage.removeItem('is_ops_team');

    // Clear cookies
    this.clearCookies();

    // Clear state
    this.setState({
      user: null,
      access_token: null,
      refresh_token: null,
      is_authenticated: false,
      is_loading: false,
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
    return this.state.is_authenticated && !!this.state.access_token;
  }

  public getUser(): AuthUser | null {
    return this.state.user;
  }

  public getAccessToken(): string | null | undefined {
    return this.state.access_token;
  }

  public getAuthHeaders(): Record<string, string> {
    const accessToken = this.state.access_token;
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

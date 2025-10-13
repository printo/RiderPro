// client/src/services/AuthService.ts
import { User, UserRole, Permission } from '../types/Auth';
import { TokenStorage } from './TokenStorage';

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

  // Token refresh management
  private refreshPromise: Promise<boolean> | null = null;
  private refreshInProgress: boolean = false;
  private refreshRetryCount: number = 0;
  private readonly MAX_REFRESH_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 second

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
   * Centralized state update with comprehensive logging and validation
   */
  private setAuthState(newState: Partial<AuthState>, context?: string) {
    const previousState = { ...this.state };
    const updatedState = { ...this.state, ...newState };

    // Log state changes for debugging
    this.logStateChange(previousState, updatedState, context);

    // Validate state consistency
    this.validateAuthState(updatedState);

    // Update state
    this.state = updatedState;

    // Synchronize with localStorage if authentication state changed
    this.synchronizeStorageWithState(previousState, updatedState);

    // Notify all listeners
    this.notifyListeners();
  }

  /**
   * Log authentication state changes for debugging
   */
  private logStateChange(previousState: AuthState, newState: AuthState, context?: string) {
    const changes: string[] = [];

    if (previousState.isAuthenticated !== newState.isAuthenticated) {
      changes.push(`isAuthenticated: ${previousState.isAuthenticated} → ${newState.isAuthenticated}`);
    }

    if (previousState.isLoading !== newState.isLoading) {
      changes.push(`isLoading: ${previousState.isLoading} → ${newState.isLoading}`);
    }

    if ((previousState.user?.id) !== (newState.user?.id)) {
      changes.push(`user: ${previousState.user?.employeeId || 'null'} → ${newState.user?.employeeId || 'null'}`);
    }

    if (!!previousState.accessToken !== !!newState.accessToken) {
      changes.push(`accessToken: ${previousState.accessToken ? 'present' : 'null'} → ${newState.accessToken ? 'present' : 'null'}`);
    }

    if (!!previousState.refreshToken !== !!newState.refreshToken) {
      changes.push(`refreshToken: ${previousState.refreshToken ? 'present' : 'null'} → ${newState.refreshToken ? 'present' : 'null'}`);
    }

    if (changes.length > 0) {
      const contextStr = context ? ` [${context}]` : '';
      console.log(`AuthService state change${contextStr}:`, changes.join(', '));
    }
  }

  /**
   * Validate authentication state consistency
   */
  private validateAuthState(state: AuthState) {
    // Check for inconsistent authentication state
    if (state.isAuthenticated && (!state.accessToken || !state.user)) {
      console.warn('AuthService: Inconsistent state - marked as authenticated but missing token or user');
    }

    if (!state.isAuthenticated && (state.accessToken || state.user)) {
      console.warn('AuthService: Inconsistent state - marked as not authenticated but has token or user');
    }

    // Check for missing permissions when user is present
    if (state.user && (!state.permissions || state.permissions.length === 0)) {
      console.warn('AuthService: User present but no permissions assigned');
    }
  }

  /**
   * Synchronize localStorage with current state when needed
   */
  private synchronizeStorageWithState(previousState: AuthState, newState: AuthState) {
    try {
      // If authentication status changed to false, clear storage
      if (previousState.isAuthenticated && !newState.isAuthenticated) {
        console.log('AuthService: Clearing localStorage due to logout');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('auth_user');
      }

      // If tokens changed, update storage
      if (newState.accessToken !== previousState.accessToken && newState.accessToken) {
        localStorage.setItem('access_token', newState.accessToken);
      }

      if (newState.refreshToken !== previousState.refreshToken) {
        if (newState.refreshToken) {
          localStorage.setItem('refresh_token', newState.refreshToken);
        } else {
          localStorage.removeItem('refresh_token');
        }
      }

      // If user data changed, update storage
      if (newState.user !== previousState.user && newState.user) {
        localStorage.setItem('auth_user', JSON.stringify(newState.user));
      }

      // Cache auth state for offline use
      this.cacheAuthStateForOfflineUse(newState);

    } catch (error) {
      console.error('AuthService: Failed to synchronize localStorage:', error);
    }
  }

  /**
   * Cache authentication state for offline use
   */
  private cacheAuthStateForOfflineUse(authState: AuthState): void {
    try {
      // Dynamically import ApiClient to avoid circular dependencies
      import('./ApiClient').then(({ apiClient }) => {
        // Cache the current auth state for offline use
        apiClient.cacheAuthState({
          isAuthenticated: authState.isAuthenticated,
          user: authState.user,
          permissions: authState.permissions,
          lastCached: Date.now()
        });
      }).catch(error => {
        console.warn('Failed to import ApiClient for caching:', error);
      });
    } catch (error) {
      console.warn('Failed to cache auth state for offline use:', error);
    }
  }

  /**
   * Refresh the access token using the refresh token with duplicate prevention and retry logic
   */
  public async refreshAccessToken(): Promise<boolean> {
    // Prevent duplicate refresh attempts by returning existing promise
    if (this.refreshPromise) {
      console.log('Token refresh already in progress, waiting for existing attempt...');
      return this.refreshPromise;
    }

    // Create and cache the refresh promise
    this.refreshPromise = this.performTokenRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      // Clear the promise when done (success or failure)
      this.refreshPromise = null;
      this.refreshInProgress = false;
    }
  }

  /**
   * Internal method to perform the actual token refresh with retry logic
   */
  private async performTokenRefresh(): Promise<boolean> {
    const refreshToken = this.state.refreshToken || localStorage.getItem('refresh_token');
    if (!refreshToken || !this.state.user) {
      console.log('No refresh token or user available for refresh');
      this.refreshRetryCount = 0;
      return false;
    }

    this.refreshInProgress = true;

    for (let attempt = 0; attempt <= this.MAX_REFRESH_RETRIES; attempt++) {
      try {
        console.log(`Attempting token refresh (attempt ${attempt + 1}/${this.MAX_REFRESH_RETRIES + 1})...`);

        const response: Response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.state.user.id,
            refresh: refreshToken
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error(`Token refresh failed with status ${response.status}: ${errorText}`);

          // Don't retry on 401/403 - these indicate invalid refresh token
          if (response.status === 401 || response.status === 403) {
            console.log('Refresh token is invalid, logging out...');
            await this.logout();
            this.refreshRetryCount = 0;
            return false;
          }

          // For other errors, continue to retry logic
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result: any = await response.json();
        if (!result.success || !result.data?.accessToken) {
          console.error('Invalid refresh response format:', result);
          throw new Error('No access token in refresh response');
        }

        // Success - update tokens and state
        const newAccessToken: string = result.data.accessToken;
        const newRefreshToken: string = result.data.refreshToken || refreshToken; // Use new refresh token if provided

        // Persist tokens
        localStorage.setItem('access_token', newAccessToken);
        if (newRefreshToken !== refreshToken) {
          localStorage.setItem('refresh_token', newRefreshToken);
        }

        // Update state
        this.setAuthState({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          isAuthenticated: true,
          isLoading: false,
        }, 'token-refresh-success');

        console.log('Token refreshed successfully');
        this.refreshRetryCount = 0;
        return true;

      } catch (error) {
        console.error(`Token refresh attempt ${attempt + 1} failed:`, error);

        // If this was the last attempt, give up
        if (attempt === this.MAX_REFRESH_RETRIES) {
          console.error('All token refresh attempts failed, logging out...');
          await this.logout();
          this.refreshRetryCount = 0;
          return false;
        }

        // Wait before retrying with exponential backoff
        const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        console.log(`Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }
    }

    // This should never be reached, but just in case
    this.refreshRetryCount = 0;
    return false;
  }

  /**
   * Utility method for delays in retry logic
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private initializeAuth() {
    try {
      // Try to retrieve auth data using enhanced storage with error recovery
      const authData = TokenStorage.retrieve();

      if (authData && authData.user) {
        const permissions = this.getPermissionsForRole(authData.user.role);

        this.setAuthState({
          user: authData.user,
          accessToken: authData.accessToken,
          refreshToken: authData.refreshToken,
          permissions,
          isAuthenticated: true,
          isLoading: false,
        }, 'initialization-from-enhanced-storage');

        // Verify token validity
        this.verifyToken().catch(() => {
          console.log('Stored token is invalid, clearing auth data');
          this.clearAuthData();
        });

        // Log storage health for monitoring
        const storageInfo = TokenStorage.getStorageInfo();
        if (storageInfo.isUsingMemoryFallback) {
          console.warn('Auth initialized from memory fallback - session will not persist across page reloads');
        }

      } else {
        // No valid auth data found
        this.setAuthState({ isLoading: false }, 'initialization-no-stored-auth');

        // Check if there were storage issues
        const storageHealth = TokenStorage.getStorageHealth();
        if (!storageHealth.healthy) {
          console.warn('Storage health issues detected during initialization:', storageHealth.errors);
        }
      }

    } catch (error) {
      console.error('Failed to initialize auth from storage:', error);

      // Fallback to legacy initialization method
      this.initializeAuthLegacy();
    }
  }

  /**
   * Legacy initialization method as fallback
   */
  private initializeAuthLegacy() {
    try {
      const token = localStorage.getItem('access_token');
      const refresh = localStorage.getItem('refresh_token');
      const userStr = localStorage.getItem('auth_user');

      if (token && userStr) {
        const user = JSON.parse(userStr);
        const permissions = this.getPermissionsForRole(user.role);

        this.setAuthState({
          user,
          accessToken: token,
          refreshToken: refresh,
          permissions,
          isAuthenticated: true,
          isLoading: false,
        }, 'initialization-from-legacy-storage');

        this.verifyToken().catch(() => {
          console.log('Stored token is invalid, clearing auth data');
          this.clearAuthData();
        });
      } else {
        this.setAuthState({ isLoading: false }, 'initialization-no-stored-auth');
      }
    } catch (error) {
      console.error('Legacy auth initialization also failed:', error);
      this.setAuthState({ isLoading: false }, 'initialization-failed');
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
      case UserRole.SUPER_ADMIN:
        // Super admin has all permissions
        return [
          Permission.VIEW_ALL_ROUTES,
          Permission.VIEW_ANALYTICS,
          Permission.EXPORT_DATA,
          Permission.MANAGE_USERS,
          Permission.VIEW_LIVE_TRACKING,
          Permission.ACCESS_AUDIT_LOGS,
          Permission.CONFIGURE_SYSTEM,
        ];
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
      case UserRole.OPS_TEAM:
        return [
          Permission.VIEW_ALL_ROUTES,
          Permission.VIEW_ANALYTICS,
          Permission.EXPORT_DATA,
          Permission.VIEW_LIVE_TRACKING,
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
        console.error('Login failed with status:', response.status, errorMessage);
        return { success: false, message: errorMessage };
      }

      const result = await response.json();
      console.log('Login response received:', { success: result.success, hasData: !!result.data });

      // Validate response structure
      if (!result.success) {
        const message = result.message || 'Login failed';
        console.error('Login unsuccessful:', message);
        return { success: false, message };
      }

      if (!result.data) {
        console.error('No data in login response');
        return { success: false, message: 'Invalid response format' };
      }

      // Extract and validate authentication data
      const authData = this.parseAuthenticationResponse(result.data, employeeId);
      if (!authData.success) {
        console.error('Failed to parse authentication response:', authData.message);
        return { success: false, message: authData.message };
      }

      const { accessToken, refreshToken, user } = authData.data!;

      // Store authentication data
      this.storeAuthenticationData(accessToken, refreshToken, user);

      console.log('Login successful for user:', user.employeeId, 'Role:', user.role);
      return { success: true };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Network error occurred' };
    }
  }

  /**
   * Parse and validate the authentication response from the server
   */
  private parseAuthenticationResponse(data: any, employeeId: string): {
    success: boolean;
    message?: string;
    data?: { accessToken: string; refreshToken: string | null; user: User }
  } {
    // Validate required fields
    if (!data.accessToken) {
      return { success: false, message: 'No access token received' };
    }

    if (!this.isValidTokenFormat(data.accessToken)) {
      return { success: false, message: 'Invalid access token format' };
    }

    if (!data.user) {
      return { success: false, message: 'No user data received' };
    }

    const userData = data.user;

    // Validate required user fields
    if (!userData.id) {
      return { success: false, message: 'Missing user ID in response' };
    }

    if (!userData.employeeId && !employeeId) {
      return { success: false, message: 'Missing employee ID' };
    }

    // Map user role with enhanced validation
    const roleMapping = this.mapUserRole(userData, employeeId);
    if (!roleMapping.success) {
      return { success: false, message: roleMapping.message };
    }

    const { role, isKannaSuperAdmin } = roleMapping.data!;

    // Create user object with comprehensive data
    const user: User = {
      id: userData.id,
      username: userData.employeeId || employeeId,
      email: userData.email || employeeId,
      role,
      employeeId: userData.employeeId || employeeId,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      fullName: userData.name || userData.fullName || `Employee ${employeeId}`,
      lastLogin: new Date().toISOString(),
      permissions: this.getPermissionsForRole(role),
      // Legacy role flags for backward compatibility
      isOpsTeam: isKannaSuperAdmin || userData.role === 'ops_team',
      isAdmin: isKannaSuperAdmin || userData.role === 'admin' || userData.role === 'super_admin',
      isSuperAdmin: isKannaSuperAdmin || userData.role === 'super_admin',
      createdAt: userData.createdAt || new Date().toISOString(),
      updatedAt: userData.updatedAt || new Date().toISOString(),
    };

    return {
      success: true,
      data: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || null,
        user
      }
    };
  }

  /**
   * Validate token format (basic JWT structure check)
   */
  private isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Basic JWT format check (three parts separated by dots)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // Check that each part is base64-like (contains valid characters)
    const base64Regex = /^[A-Za-z0-9_-]+$/;
    return parts.every(part => part.length > 0 && base64Regex.test(part));
  }

  /**
   * Map user role from server response with enhanced validation and edge case handling
   */
  private mapUserRole(userData: any, employeeId: string): {
    success: boolean;
    message?: string;
    data?: { role: UserRole; isKannaSuperAdmin: boolean }
  } {
    let role: UserRole;
    let isKannaSuperAdmin = false;

    try {
      // Special override for kanna.p@printo.in and employee ID 12180 - always super admin
      if (userData.email === 'kanna.p@printo.in' ||
        employeeId === 'kanna.p@printo.in' ||
        userData.employeeId === '12180' ||
        employeeId === '12180') {
        role = UserRole.SUPER_ADMIN;
        isKannaSuperAdmin = true;
        console.log('Applied special super admin override for:', employeeId);
      } else {
        // Map role from server response
        const serverRole = userData.role?.toLowerCase();

        switch (serverRole) {
          case 'super_admin':
          case 'superadmin':
            role = UserRole.SUPER_ADMIN;
            break;
          case 'admin':
            role = UserRole.ADMIN;
            break;
          case 'ops_team':
          case 'ops':
          case 'operations':
            role = UserRole.OPS_TEAM;
            break;
          case 'manager':
            role = UserRole.MANAGER;
            break;
          case 'driver':
            role = UserRole.DRIVER;
            break;
          default:
            // Handle edge cases - if no role specified or unknown role, default to driver
            console.warn('Unknown or missing role in user data:', userData.role, 'defaulting to DRIVER');
            role = UserRole.DRIVER;
            break;
        }
      }

      return { success: true, data: { role, isKannaSuperAdmin } };

    } catch (error) {
      console.error('Error mapping user role:', error);
      return { success: false, message: 'Failed to determine user role' };
    }
  }

  /**
   * Store authentication data with error recovery
   */
  private storeAuthenticationData(accessToken: string, refreshToken: string | null, user: User): void {
    try {
      // Calculate token expiry (default to 1 hour if not specified)
      const tokenExpiry = Date.now() + (60 * 60 * 1000);

      // Use enhanced TokenStorage with error recovery
      const stored = TokenStorage.store({
        accessToken,
        refreshToken: refreshToken || '',
        tokenExpiry,
        user,
        lastRefresh: Date.now()
      });

      if (!stored) {
        // If storage failed, we can still continue with in-memory state
        console.warn('Failed to persist authentication data, continuing with memory-only session');

        // Check storage health for debugging
        const storageHealth = TokenStorage.getStorageHealth();
        if (!storageHealth.healthy) {
          console.warn('Storage health issues detected:', storageHealth.errors);
          console.log('Recommendations:', storageHealth.recommendations);
        }
      }

      // Update application state regardless of storage success
      this.setAuthState({
        user,
        accessToken,
        refreshToken,
        permissions: user.permissions || this.getPermissionsForRole(user.role),
        isAuthenticated: true,
        isLoading: false,
      }, 'login-success');

      console.log('Authentication data processed successfully', {
        stored,
        memoryOnly: !stored
      });

    } catch (error) {
      console.error('Failed to store authentication data:', error);

      // Don't throw error - allow login to continue with memory-only state
      console.warn('Continuing with memory-only authentication session');

      // Update application state even if storage completely failed
      this.setAuthState({
        user,
        accessToken,
        refreshToken,
        permissions: user.permissions || this.getPermissionsForRole(user.role),
        isAuthenticated: true,
        isLoading: false,
      }, 'login-success-memory-only');
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
    console.log('AuthService: Clearing all authentication data');

    try {
      // Use enhanced TokenStorage for clearing with error recovery
      TokenStorage.clear();
    } catch (error) {
      console.error('Failed to clear auth data using TokenStorage:', error);

      // Fallback to manual clearing
      this.clearAuthDataLegacy();
    }

    // Reset state through centralized method
    this.setAuthState({
      user: null,
      accessToken: null,
      refreshToken: null,
      permissions: [],
      isAuthenticated: false,
      isLoading: false,
    }, 'clear-auth-data');

    // Reset refresh tracking
    this.refreshPromise = null;
    this.refreshInProgress = false;
    this.refreshRetryCount = 0;
  }

  /**
   * Legacy method to clear auth data as fallback
   */
  private clearAuthDataLegacy(): void {
    const keysToRemove = ['access_token', 'refresh_token', 'auth_user', 'auth_data'];

    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove '${key}' from localStorage:`, error);
      }
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
        console.log('Received 401, attempting token refresh...');
        const refreshSuccess = await this.refreshAccessToken();
        if (refreshSuccess && this.state.accessToken) {
          // Retry with new token
          const retryHeaders = { ...headers, 'Authorization': `Bearer ${this.state.accessToken}` };
          return fetch(fullUrl, {
            ...fetchOptions,
            headers: retryHeaders,
          });
        } else {
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
      console.log('Received 401 on fetchWithAuth, attempting token refresh...');
      const refreshSuccess = await this.refreshAccessToken();

      if (refreshSuccess && this.state.accessToken) {
        // Retry with new token
        const newHeaders = {
          'Content-Type': 'application/json',
          ...options.headers,
          'Authorization': `Bearer ${this.state.accessToken}`,
        };

        response = await fetch(url, {
          ...options,
          headers: newHeaders,
        });
      } else {
        throw new Error('Session expired. Please log in again.');
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

  /**
   * Get detailed authentication status for debugging
   */
  public getAuthenticationStatus(): {
    isAuthenticated: boolean;
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    hasUser: boolean;
    isLoading: boolean;
    refreshInProgress: boolean;
    listenerCount: number;
    networkStatus?: {
      isOnline: boolean;
      queuedRequests: number;
      hasOfflineCache: boolean;
    };
  } {
    let networkStatus;

    try {
      // Dynamically import ApiClient to avoid circular dependencies
      import('./ApiClient').then(({ apiClient }) => {
        const netStatus = apiClient.getNetworkStatus();
        const cachedState = apiClient.getCachedAuthState();

        networkStatus = {
          isOnline: netStatus.isOnline,
          queuedRequests: netStatus.queuedRequests,
          hasOfflineCache: !!cachedState
        };
      }).catch(error => {
        console.warn('Failed to get network status:', error);
      });
    } catch (error) {
      console.warn('Failed to get network status:', error);
    }

    return {
      isAuthenticated: this.state.isAuthenticated,
      hasAccessToken: !!this.state.accessToken,
      hasRefreshToken: !!this.state.refreshToken,
      hasUser: !!this.state.user,
      isLoading: this.state.isLoading,
      refreshInProgress: this.refreshInProgress,
      listenerCount: this.listeners.length,
      networkStatus
    };
  }

  /**
   * Get offline authentication capabilities
   */
  public getOfflineAuthCapabilities(): {
    hasOfflineCache: boolean;
    canWorkOffline: boolean;
    lastCachedAuth: number | null;
    offlineRecommendations: string[];
  } {
    const recommendations: string[] = [];
    let hasOfflineCache = false;
    let lastCachedAuth: number | null = null;

    try {
      // Note: ApiClient import is async, so we return current state
      // Network status will be updated asynchronously
      import('./ApiClient').then(({ apiClient }) => {
        const cachedState = apiClient.getCachedAuthState();

        if (cachedState) {
          hasOfflineCache = true;
          lastCachedAuth = cachedState.lastCached || null;
        }

        const networkStatus = apiClient.getNetworkStatus();

        if (!networkStatus.isOnline) {
          recommendations.push('You are currently offline');

          if (hasOfflineCache) {
            recommendations.push('Using cached authentication data');
            recommendations.push('Some features may be limited while offline');
          } else {
            recommendations.push('No offline authentication cache available');
            recommendations.push('Please connect to the internet to authenticate');
          }

          if (networkStatus.queuedRequests > 0) {
            recommendations.push(`${networkStatus.queuedRequests} requests queued for when connection is restored`);
          }
        }
      }).catch(error => {
        console.warn('Failed to get offline auth capabilities:', error);
      });
    } catch (error) {
      console.warn('Failed to get offline auth capabilities:', error);
      recommendations.push('Unable to determine offline capabilities');
    }

    return {
      hasOfflineCache,
      canWorkOffline: hasOfflineCache && this.state.isAuthenticated,
      lastCachedAuth,
      offlineRecommendations: recommendations
    };
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
    console.log(`AuthService: New listener subscribed (total: ${this.listeners.length})`);

    // Immediately notify the new listener of current state
    try {
      listener(this.getState());
    } catch (error) {
      console.error('AuthService: Error notifying new subscriber:', error);
    }

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
        console.log(`AuthService: Listener unsubscribed (remaining: ${this.listeners.length})`);
      }
    };
  }

  private notifyListeners(): void {
    const currentState = this.getState();
    const listenerCount = this.listeners.length;

    if (listenerCount > 0) {
      console.log(`AuthService: Notifying ${listenerCount} listeners of state change`);
    }

    this.listeners.forEach((listener, index) => {
      try {
        listener(currentState);
      } catch (error) {
        console.error(`AuthService: Error in listener ${index}:`, error);
        // Continue notifying other listeners even if one fails
      }
    });
  }
}

// Export singleton
export const authService = AuthService.getInstance();
export default authService;

// client/src/services/TokenStorage.ts
import { User } from '../types/Auth';

export interface StoredAuthData {
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number; // Unix timestamp
  user: User;
  lastRefresh: number; // Unix timestamp
  version: string; // For future migrations
}

export interface TokenValidationResult {
  isValid: boolean;
  isExpired: boolean;
  isCorrupted: boolean;
  error?: string;
}

export enum StorageErrorType {
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  STORAGE_DISABLED = 'STORAGE_DISABLED',
  CORRUPTION_DETECTED = 'CORRUPTION_DETECTED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface StorageError extends Error {
  type: StorageErrorType;
  recoverable: boolean;
  fallbackUsed: boolean;
}

export class TokenStorage {
  private static readonly STORAGE_KEY = 'auth_data';
  private static readonly CURRENT_VERSION = '1.0.0';
  private static readonly TOKEN_BUFFER_TIME = 5 * 60 * 1000; // 5 minutes buffer before expiry

  // Memory fallback storage for when localStorage fails
  private static memoryStorage: Map<string, string> = new Map();
  private static isUsingMemoryFallback = false;
  private static storageHealthy = true;

  /**
   * Store authentication data securely with error recovery
   */
  public static store(data: Omit<StoredAuthData, 'version'>): boolean {
    console.log('🏪 TokenStorage.store called:', {
      hasAccessToken: !!data.accessToken,
      accessTokenLength: data.accessToken?.length,
      hasRefreshToken: !!data.refreshToken,
      refreshTokenLength: data.refreshToken?.length,
      hasUser: !!data.user,
      userId: data.user?.id,
      userRole: data.user?.role
    });

    const authData: StoredAuthData = {
      ...data,
      version: this.CURRENT_VERSION
    };

    const serializedData = JSON.stringify(authData);
    console.log('📝 Serialized data length:', serializedData.length);

    // Try localStorage first
    console.log('🔄 Attempting localStorage storage...');
    const localStorageResult = this.tryStoreInLocalStorage(serializedData, data);

    console.log('📊 localStorage storage result:', {
      success: localStorageResult.success,
      errorType: localStorageResult.error?.type,
      errorMessage: localStorageResult.error?.message
    });

    if (localStorageResult.success) {
      console.log('✅ Successfully stored in localStorage');
      this.storageHealthy = true;
      this.isUsingMemoryFallback = false;
      return true;
    }

    // Handle storage error and fallback to memory
    const storageError = localStorageResult.error || this.createStorageError(
      'Unknown localStorage error',
      StorageErrorType.UNKNOWN_ERROR,
      true
    );
    console.warn('⚠️ localStorage failed, falling back to memory storage:', storageError);
    return this.fallbackToMemoryStorage(serializedData, data, storageError);
  }

  /**
   * Attempt to store data in localStorage with comprehensive error handling
   */
  private static tryStoreInLocalStorage(
    serializedData: string,
    data: Omit<StoredAuthData, 'version'>
  ): { success: boolean; error?: StorageError } {
    try {
      // Check if localStorage is available
      if (!this.isStorageAvailable()) {
        return {
          success: false,
          error: this.createStorageError(
            'localStorage is not available',
            StorageErrorType.STORAGE_DISABLED,
            true
          )
        };
      }

      // Try to store the main auth data
      console.log('💾 Setting localStorage items...');
      localStorage.setItem(this.STORAGE_KEY, serializedData);
      console.log('✅ Set auth_data in localStorage');

      // Store individual tokens for backward compatibility
      localStorage.setItem('access_token', data.accessToken);
      console.log('✅ Set access_token in localStorage');

      localStorage.setItem('refresh_token', data.refreshToken);
      console.log('✅ Set refresh_token in localStorage');

      localStorage.setItem('auth_user', JSON.stringify(data.user));
      console.log('✅ Set auth_user in localStorage');

      // Verify storage immediately
      const verification = {
        authData: localStorage.getItem(this.STORAGE_KEY) ? 'stored' : 'missing',
        accessToken: localStorage.getItem('access_token') ? 'stored' : 'missing',
        refreshToken: localStorage.getItem('refresh_token') ? 'stored' : 'missing',
        authUser: localStorage.getItem('auth_user') ? 'stored' : 'missing'
      };
      console.log('🔍 Storage verification:', verification);

      return { success: true };

    } catch (error: any) {
      const storageError = this.classifyStorageError(error);

      // Try to recover from quota exceeded by clearing old data
      if (storageError.type === StorageErrorType.QUOTA_EXCEEDED) {
        const recoveryResult = this.attemptQuotaRecovery();
        if (recoveryResult) {
          // Retry storage after cleanup
          try {
            localStorage.setItem(this.STORAGE_KEY, serializedData);
            localStorage.setItem('access_token', data.accessToken);
            localStorage.setItem('refresh_token', data.refreshToken);
            localStorage.setItem('auth_user', JSON.stringify(data.user));

            console.log('Successfully stored auth data after quota recovery');
            return { success: true };
          } catch (retryError) {
            console.error('Storage failed even after quota recovery:', retryError);
          }
        }
      }

      return { success: false, error: storageError };
    }
  }

  /**
   * Fallback to memory-only storage when localStorage fails
   */
  private static fallbackToMemoryStorage(
    serializedData: string,
    data: Omit<StoredAuthData, 'version'>,
    originalError: StorageError
  ): boolean {
    try {
      console.log('Falling back to memory-only auth state due to storage error:', originalError.type);

      // Store in memory
      this.memoryStorage.set(this.STORAGE_KEY, serializedData);
      this.memoryStorage.set('access_token', data.accessToken);
      this.memoryStorage.set('refresh_token', data.refreshToken);
      this.memoryStorage.set('auth_user', JSON.stringify(data.user));

      this.isUsingMemoryFallback = true;
      this.storageHealthy = false;

      // Log fallback usage for monitoring
      console.warn('TokenStorage: Using memory fallback due to localStorage error', {
        errorType: originalError.type,
        recoverable: originalError.recoverable,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (memoryError) {
      console.error('Failed to store auth data even in memory fallback:', memoryError);
      return false;
    }
  }

  /**
   * Attempt to recover from quota exceeded errors by clearing old data
   */
  private static attemptQuotaRecovery(): boolean {
    try {
      console.log('Attempting localStorage quota recovery...');

      // List of non-essential keys that can be safely removed
      const nonEssentialKeys = [
        'debug_logs',
        'temp_data',
        'cache_',
        'analytics_',
        'performance_',
        'old_auth_',
        'backup_'
      ];

      let clearedItems = 0;
      const keysToRemove: string[] = [];

      // Find keys that can be safely removed
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && nonEssentialKeys.some(prefix => key.startsWith(prefix))) {
          keysToRemove.push(key);
        }
      }

      // Remove non-essential items
      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
          clearedItems++;
        } catch (error) {
          console.warn('Failed to remove non-essential item during quota recovery:', key);
        }
      });

      // If we didn't clear enough, try to clear some older auth data
      if (clearedItems === 0) {
        const oldAuthKeys = ['old_access_token', 'expired_refresh_token', 'backup_auth_user'];
        oldAuthKeys.forEach(key => {
          try {
            if (localStorage.getItem(key)) {
              localStorage.removeItem(key);
              clearedItems++;
            }
          } catch (error) {
            // Ignore errors when cleaning up
          }
        });
      }

      console.log(`Quota recovery completed: cleared ${clearedItems} items`);
      return clearedItems > 0;

    } catch (error) {
      console.error('Quota recovery failed:', error);
      return false;
    }
  }

  /**
   * Classify storage errors for appropriate handling
   */
  private static classifyStorageError(error: any): StorageError {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorName = error.name?.toLowerCase() || '';

    if (errorMessage.includes('quota') || errorMessage.includes('exceeded') ||
      errorName.includes('quota') || error.code === 22) {
      return this.createStorageError(
        'Storage quota exceeded',
        StorageErrorType.QUOTA_EXCEEDED,
        true // Recoverable through cleanup
      );
    }

    if (errorMessage.includes('access') || errorMessage.includes('denied') ||
      errorMessage.includes('permission')) {
      return this.createStorageError(
        'Storage access denied',
        StorageErrorType.ACCESS_DENIED,
        false
      );
    }

    if (errorMessage.includes('disabled') || errorMessage.includes('not available')) {
      return this.createStorageError(
        'Storage is disabled',
        StorageErrorType.STORAGE_DISABLED,
        false
      );
    }

    return this.createStorageError(
      error.message || 'Unknown storage error',
      StorageErrorType.UNKNOWN_ERROR,
      true
    );
  }

  /**
   * Create a structured storage error
   */
  private static createStorageError(
    message: string,
    type: StorageErrorType,
    recoverable: boolean
  ): StorageError {
    const error = new Error(message) as StorageError;
    error.type = type;
    error.recoverable = recoverable;
    error.fallbackUsed = false;
    return error;
  }

  /**
   * Retrieve authentication data with error recovery
   */
  public static retrieve(): StoredAuthData | null {
    console.log('📥 TokenStorage.retrieve called');

    // Check what's in localStorage first
    const rawCheck = {
      authData: localStorage.getItem(this.STORAGE_KEY) ? 'exists' : 'null',
      accessToken: localStorage.getItem('access_token') ? 'exists' : 'null',
      refreshToken: localStorage.getItem('refresh_token') ? 'exists' : 'null',
      authUser: localStorage.getItem('auth_user') ? 'exists' : 'null'
    };
    console.log('📦 Raw localStorage check:', rawCheck);

    // Try localStorage first
    console.log('🔄 Attempting localStorage retrieval...');
    const localStorageResult = this.tryRetrieveFromLocalStorage();

    console.log('📊 localStorage retrieval result:', {
      success: localStorageResult.success,
      hasData: !!localStorageResult.data,
      errorType: localStorageResult.error?.type,
      errorMessage: localStorageResult.error?.message
    });

    if (localStorageResult.success && localStorageResult.data) {
      console.log('✅ Successfully retrieved from localStorage:', {
        hasUser: !!localStorageResult.data.user,
        userId: localStorageResult.data.user?.id,
        hasAccessToken: !!localStorageResult.data.accessToken,
        hasRefreshToken: !!localStorageResult.data.refreshToken,
        isExpired: this.isTokenExpired(localStorageResult.data)
      });
      return localStorageResult.data;
    }

    // If localStorage failed but we have memory fallback, use it
    if (this.isUsingMemoryFallback) {
      console.log('🧠 Retrieving auth data from memory fallback');
      return this.retrieveFromMemoryStorage();
    }

    // Handle storage corruption
    if (localStorageResult.error?.type === StorageErrorType.CORRUPTION_DETECTED) {
      console.warn('🔧 Storage corruption detected, attempting recovery...');
      const recoveryResult = this.attemptCorruptionRecovery();
      if (recoveryResult) {
        console.log('✅ Successfully recovered corrupted data');
        return recoveryResult;
      }
    }

    console.log('❌ No valid auth data found in any storage');
    return null;
  }

  /**
   * Attempt to retrieve data from localStorage with error handling
   */
  private static tryRetrieveFromLocalStorage(): {
    success: boolean;
    data?: StoredAuthData | null;
    error?: StorageError
  } {
    try {
      if (!this.isStorageAvailable()) {
        return {
          success: false,
          error: this.createStorageError(
            'localStorage is not available',
            StorageErrorType.STORAGE_DISABLED,
            false
          )
        };
      }

      const serializedData = localStorage.getItem(this.STORAGE_KEY);
      if (!serializedData) {
        // Try to migrate from old storage format
        const migratedData = this.migrateFromLegacyStorage();
        return { success: true, data: migratedData };
      }

      const authData: StoredAuthData = JSON.parse(serializedData);

      // Validate the retrieved data
      const validation = this.validateStoredData(authData);
      if (!validation.isValid) {
        const error = this.createStorageError(
          validation.error || 'Data validation failed',
          StorageErrorType.CORRUPTION_DETECTED,
          true
        );
        return { success: false, error };
      }

      return { success: true, data: authData };

    } catch (error: any) {
      console.error('Failed to retrieve auth data from localStorage:', error);

      const storageError = this.createStorageError(
        error.message || 'Failed to retrieve data',
        StorageErrorType.CORRUPTION_DETECTED,
        true
      );

      return { success: false, error: storageError };
    }
  }

  /**
   * Retrieve data from memory fallback storage
   */
  private static retrieveFromMemoryStorage(): StoredAuthData | null {
    try {
      const serializedData = this.memoryStorage.get(this.STORAGE_KEY);
      if (!serializedData) {
        return null;
      }

      const authData: StoredAuthData = JSON.parse(serializedData);

      // Validate memory data as well
      const validation = this.validateStoredData(authData);
      if (!validation.isValid) {
        console.warn('Memory fallback data is invalid:', validation.error);
        this.clearMemoryStorage();
        return null;
      }

      return authData;
    } catch (error) {
      console.error('Failed to retrieve auth data from memory storage:', error);
      this.clearMemoryStorage();
      return null;
    }
  }

  /**
   * Attempt to recover from storage corruption
   */
  private static attemptCorruptionRecovery(): StoredAuthData | null {
    try {
      console.log('Attempting storage corruption recovery...');

      // Try to recover from individual token storage (legacy format)
      const accessToken = this.safeGetItem('access_token');
      const refreshToken = this.safeGetItem('refresh_token');
      const userStr = this.safeGetItem('auth_user');

      if (accessToken && refreshToken && userStr) {
        try {
          const user = JSON.parse(userStr);

          // Create recovered auth data
          const recoveredData: StoredAuthData = {
            accessToken,
            refreshToken,
            tokenExpiry: Date.now() + (60 * 60 * 1000), // Default to 1 hour
            user,
            lastRefresh: Date.now(),
            version: this.CURRENT_VERSION
          };

          // Validate recovered data
          const validation = this.validateStoredData(recoveredData);
          if (validation.isValid) {
            console.log('Successfully recovered auth data from individual tokens');

            // Store the recovered data properly
            this.store(recoveredData);
            return recoveredData;
          }
        } catch (parseError) {
          console.error('Failed to parse recovered user data:', parseError);
        }
      }

      // If individual token recovery failed, clear all corrupted data
      console.warn('Corruption recovery failed, clearing all auth data');
      this.clear();
      return null;

    } catch (error) {
      console.error('Corruption recovery attempt failed:', error);
      this.clear();
      return null;
    }
  }

  /**
   * Safely get item from localStorage without throwing
   */
  private static safeGetItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`Failed to get item '${key}' from localStorage:`, error);
      return null;
    }
  }

  /**
   * Clear memory fallback storage
   */
  private static clearMemoryStorage(): void {
    this.memoryStorage.clear();
    this.isUsingMemoryFallback = false;
  }

  /**
   * Check if the stored token is expired
   */
  public static isTokenExpired(authData?: StoredAuthData): boolean {
    const data = authData || this.retrieve();
    if (!data) {
      return true;
    }

    const now = Date.now();
    const expiryWithBuffer = data.tokenExpiry - this.TOKEN_BUFFER_TIME;

    return now >= expiryWithBuffer;
  }

  /**
   * Get a valid token if available and not expired
   */
  public static getValidToken(): string | null {
    const authData = this.retrieve();
    if (!authData) {
      return null;
    }

    if (this.isTokenExpired(authData)) {
      return null;
    }

    return authData.accessToken;
  }

  /**
   * Update only the access token and expiry (for refresh scenarios)
   */
  public static updateAccessToken(accessToken: string, tokenExpiry: number): boolean {
    const existingData = this.retrieve();
    if (!existingData) {
      console.error('Cannot update access token: no existing auth data');
      return false;
    }

    const updatedData: StoredAuthData = {
      ...existingData,
      accessToken,
      tokenExpiry,
      lastRefresh: Date.now()
    };

    return this.store(updatedData);
  }

  /**
   * Clear all stored authentication data with error handling
   */
  public static clear(): void {
    // Clear localStorage with error handling
    this.safeClearLocalStorage();

    // Clear memory fallback
    this.clearMemoryStorage();

    // Reset storage health status
    this.storageHealthy = true;
  }

  /**
   * Safely clear localStorage without throwing errors
   */
  private static safeClearLocalStorage(): void {
    const keysToRemove = [
      this.STORAGE_KEY,
      'access_token',
      'refresh_token',
      'auth_user'
    ];

    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove '${key}' from localStorage:`, error);
        // Continue with other keys even if one fails
      }
    });
  }

  /**
   * Clean up expired tokens automatically
   */
  public static cleanupExpiredTokens(): void {
    const authData = this.retrieve();
    if (authData && this.isTokenExpired(authData)) {
      console.log('Cleaning up expired tokens');
      this.clear();
    }
  }

  /**
   * Validate stored authentication data for corruption
   */
  private static validateStoredData(data: any): TokenValidationResult {
    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        isExpired: false,
        isCorrupted: true,
        error: 'Data is not an object'
      };
    }

    // Check required fields
    const requiredFields = ['accessToken', 'refreshToken', 'tokenExpiry', 'user', 'lastRefresh', 'version'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        return {
          isValid: false,
          isExpired: false,
          isCorrupted: true,
          error: `Missing required field: ${field}`
        };
      }
    }

    // Validate token format (basic JWT structure check)
    if (!this.isValidJWTFormat(data.accessToken)) {
      return {
        isValid: false,
        isExpired: false,
        isCorrupted: true,
        error: 'Invalid access token format'
      };
    }

    if (!this.isValidJWTFormat(data.refreshToken)) {
      return {
        isValid: false,
        isExpired: false,
        isCorrupted: true,
        error: 'Invalid refresh token format'
      };
    }

    // Validate timestamps
    if (typeof data.tokenExpiry !== 'number' || data.tokenExpiry <= 0) {
      return {
        isValid: false,
        isExpired: false,
        isCorrupted: true,
        error: 'Invalid token expiry timestamp'
      };
    }

    if (typeof data.lastRefresh !== 'number' || data.lastRefresh <= 0) {
      return {
        isValid: false,
        isExpired: false,
        isCorrupted: true,
        error: 'Invalid last refresh timestamp'
      };
    }

    // Validate user object
    if (!data.user || typeof data.user !== 'object' || !data.user.id) {
      return {
        isValid: false,
        isExpired: false,
        isCorrupted: true,
        error: 'Invalid user data'
      };
    }

    // Check if token is expired
    const isExpired = this.isTokenExpired(data);

    return {
      isValid: true,
      isExpired,
      isCorrupted: false
    };
  }

  /**
   * Basic JWT format validation (checks for three parts separated by dots)
   */
  private static isValidJWTFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
  }

  /**
   * Migrate from legacy storage format to new format
   */
  private static migrateFromLegacyStorage(): StoredAuthData | null {
    try {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');
      const userStr = localStorage.getItem('auth_user');

      if (!accessToken || !refreshToken || !userStr) {
        return null;
      }

      const user = JSON.parse(userStr);

      // Estimate token expiry (default to 1 hour from now if not available)
      const tokenExpiry = Date.now() + (60 * 60 * 1000);

      const migratedData: StoredAuthData = {
        accessToken,
        refreshToken,
        tokenExpiry,
        user,
        lastRefresh: Date.now(),
        version: this.CURRENT_VERSION
      };

      // Store in new format
      this.store(migratedData);

      console.log('Successfully migrated auth data from legacy storage');
      return migratedData;
    } catch (error) {
      console.error('Failed to migrate from legacy storage:', error);
      return null;
    }
  }

  /**
   * Get comprehensive storage statistics for debugging and monitoring
   */
  public static getStorageInfo(): {
    hasData: boolean;
    isExpired: boolean;
    version: string | null;
    lastRefresh: number | null;
    tokenExpiry: number | null;
    isUsingMemoryFallback: boolean;
    storageHealthy: boolean;
    storageAvailable: boolean;
    memoryStorageSize: number;
    lastError?: string;
  } {
    const authData = this.retrieve();

    return {
      hasData: !!authData,
      isExpired: authData ? this.isTokenExpired(authData) : true,
      version: authData?.version || null,
      lastRefresh: authData?.lastRefresh || null,
      tokenExpiry: authData?.tokenExpiry || null,
      isUsingMemoryFallback: this.isUsingMemoryFallback,
      storageHealthy: this.storageHealthy,
      storageAvailable: this.isStorageAvailable(),
      memoryStorageSize: this.memoryStorage.size
    };
  }

  /**
   * Get storage health status for monitoring
   */
  public static getStorageHealth(): {
    healthy: boolean;
    usingFallback: boolean;
    available: boolean;
    errors: string[];
    recommendations: string[];
  } {
    const errors: string[] = [];
    const recommendations: string[] = [];

    if (!this.isStorageAvailable()) {
      errors.push('localStorage is not available');
      recommendations.push('Check browser settings and privacy mode');
    }

    if (this.isUsingMemoryFallback) {
      errors.push('Using memory fallback due to storage issues');
      recommendations.push('Auth state will be lost on page refresh');
      recommendations.push('Check browser storage quota and permissions');
    }

    if (!this.storageHealthy) {
      errors.push('Storage health check failed');
      recommendations.push('Clear browser cache and try again');
    }

    return {
      healthy: this.storageHealthy && this.isStorageAvailable() && !this.isUsingMemoryFallback,
      usingFallback: this.isUsingMemoryFallback,
      available: this.isStorageAvailable(),
      errors,
      recommendations
    };
  }

  /**
   * Attempt to repair storage issues
   */
  public static attemptStorageRepair(): {
    success: boolean;
    actions: string[];
    errors: string[];
  } {
    const actions: string[] = [];
    const errors: string[] = [];

    try {
      // Test storage availability
      if (!this.isStorageAvailable()) {
        errors.push('localStorage is not available - cannot repair');
        return { success: false, actions, errors };
      }

      // Attempt quota recovery
      const quotaRecovered = this.attemptQuotaRecovery();
      if (quotaRecovered) {
        actions.push('Cleared non-essential data to free up storage quota');
      }

      // Test storage by writing and reading a test value
      const testKey = '__storage_repair_test__';
      const testValue = JSON.stringify({ test: true, timestamp: Date.now() });

      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      if (retrieved === testValue) {
        actions.push('Storage read/write test passed');
        this.storageHealthy = true;

        // If we were using memory fallback, try to migrate back to localStorage
        if (this.isUsingMemoryFallback && this.memoryStorage.has(this.STORAGE_KEY)) {
          const memoryData = this.memoryStorage.get(this.STORAGE_KEY);
          if (memoryData) {
            try {
              localStorage.setItem(this.STORAGE_KEY, memoryData);
              actions.push('Migrated auth data from memory back to localStorage');
              this.isUsingMemoryFallback = false;
            } catch (migrationError) {
              errors.push('Failed to migrate data back to localStorage');
            }
          }
        }

        return { success: true, actions, errors };
      } else {
        errors.push('Storage read/write test failed');
        return { success: false, actions, errors };
      }

    } catch (error: any) {
      errors.push(`Storage repair failed: ${error.message}`);
      return { success: false, actions, errors };
    }
  }

  /**
   * Check if localStorage is available and working
   */
  public static isStorageAvailable(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      console.error('localStorage is not available:', error);
      return false;
    }
  }
}
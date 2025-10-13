// client/src/services/TokenExpirationManager.ts
import { TokenStorage, StoredAuthData } from './TokenStorage';

export interface TokenExpirationInfo {
  isExpired: boolean;
  expiresAt: number;
  timeUntilExpiry: number;
  shouldRefresh: boolean;
}

export class TokenExpirationManager {
  private static readonly REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry
  private static readonly CLEANUP_INTERVAL = 60 * 1000; // Check every minute
  private static cleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Check if the current token is expired
   */
  public static isTokenExpired(): boolean {
    return TokenStorage.isTokenExpired();
  }

  /**
   * Get detailed expiration information for the current token
   */
  public static getExpirationInfo(): TokenExpirationInfo | null {
    const authData = TokenStorage.retrieve();
    if (!authData) {
      return null;
    }

    const now = Date.now();
    const expiresAt = authData.tokenExpiry;
    const timeUntilExpiry = expiresAt - now;
    const isExpired = timeUntilExpiry <= 0;
    const shouldRefresh = timeUntilExpiry <= this.REFRESH_THRESHOLD && timeUntilExpiry > 0;

    return {
      isExpired,
      expiresAt,
      timeUntilExpiry,
      shouldRefresh
    };
  }

  /**
   * Calculate token expiry timestamp from JWT token
   * This is a fallback method when the server doesn't provide explicit expiry
   */
  public static calculateTokenExpiry(token: string, defaultExpiryHours: number = 1): number {
    try {
      // Try to decode JWT payload to get 'exp' claim
      const payload = this.decodeJWTPayload(token);
      if (payload && payload.exp) {
        // JWT exp is in seconds, convert to milliseconds
        return payload.exp * 1000;
      }
    } catch (error) {
      console.warn('Could not decode JWT token for expiry:', error);
    }

    // Fallback to default expiry time
    return Date.now() + (defaultExpiryHours * 60 * 60 * 1000);
  }

  /**
   * Update token expiry timestamp
   */
  public static updateTokenExpiry(accessToken: string, expiryTimestamp?: number): boolean {
    const tokenExpiry = expiryTimestamp || this.calculateTokenExpiry(accessToken);
    return TokenStorage.updateAccessToken(accessToken, tokenExpiry);
  }

  /**
   * Start automatic cleanup of expired tokens
   */
  public static startAutomaticCleanup(): void {
    if (this.cleanupTimer) {
      return; // Already running
    }

    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL);

    console.log('Started automatic token cleanup');
  }

  /**
   * Stop automatic cleanup
   */
  public static stopAutomaticCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('Stopped automatic token cleanup');
    }
  }

  /**
   * Perform cleanup of expired tokens
   */
  public static performCleanup(): void {
    try {
      const authData = TokenStorage.retrieve();
      if (!authData) {
        return;
      }

      if (this.isTokenExpired()) {
        console.log('Cleaning up expired authentication data');
        TokenStorage.clear();

        // Notify about token expiration (could be used by auth service)
        this.notifyTokenExpired();
      }
    } catch (error) {
      console.error('Error during token cleanup:', error);
    }
  }

  /**
   * Get time remaining until token expires (in milliseconds)
   */
  public static getTimeUntilExpiry(): number {
    const info = this.getExpirationInfo();
    return info ? Math.max(0, info.timeUntilExpiry) : 0;
  }

  /**
   * Get time remaining until token should be refreshed (in milliseconds)
   */
  public static getTimeUntilRefresh(): number {
    const info = this.getExpirationInfo();
    if (!info) {
      return 0;
    }

    const timeUntilRefresh = info.timeUntilExpiry - this.REFRESH_THRESHOLD;
    return Math.max(0, timeUntilRefresh);
  }

  /**
   * Check if token should be refreshed soon
   */
  public static shouldRefreshToken(): boolean {
    const info = this.getExpirationInfo();
    return info ? info.shouldRefresh : false;
  }

  /**
   * Format expiration time for display
   */
  public static formatExpirationTime(): string {
    const info = this.getExpirationInfo();
    if (!info) {
      return 'No token';
    }

    if (info.isExpired) {
      return 'Expired';
    }

    const minutes = Math.floor(info.timeUntilExpiry / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      return 'Less than 1 minute';
    }
  }

  /**
   * Decode JWT payload without verification (for expiry extraction)
   */
  private static decodeJWTPayload(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = parts[1];
      // Add padding if needed
      const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
      const decodedPayload = atob(paddedPayload);

      return JSON.parse(decodedPayload);
    } catch (error) {
      throw new Error(`Failed to decode JWT payload: ${error}`);
    }
  }

  /**
   * Notify about token expiration (can be extended with event system)
   */
  private static notifyTokenExpired(): void {
    // Dispatch custom event for token expiration
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('tokenExpired', {
        detail: { timestamp: Date.now() }
      });
      window.dispatchEvent(event);
    }
  }

  /**
   * Set up token expiration warning
   */
  public static setupExpirationWarning(warningCallback: (timeRemaining: number) => void): () => void {
    const checkInterval = setInterval(() => {
      const info = this.getExpirationInfo();
      if (info && info.shouldRefresh && !info.isExpired) {
        warningCallback(info.timeUntilExpiry);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkInterval);
  }

  /**
   * Get expiration statistics for debugging
   */
  public static getExpirationStats(): {
    hasToken: boolean;
    isExpired: boolean;
    shouldRefresh: boolean;
    timeUntilExpiry: string;
    expiresAt: string;
    lastRefresh: string;
  } {
    const info = this.getExpirationInfo();
    const authData = TokenStorage.retrieve();

    return {
      hasToken: !!authData,
      isExpired: info?.isExpired || true,
      shouldRefresh: info?.shouldRefresh || false,
      timeUntilExpiry: this.formatExpirationTime(),
      expiresAt: info ? new Date(info.expiresAt).toISOString() : 'N/A',
      lastRefresh: authData ? new Date(authData.lastRefresh).toISOString() : 'N/A'
    };
  }
}
import { apiTokenService } from './ApiTokenService.js';

export class TokenExpirationService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start the automatic token expiration monitoring service
   * Runs cleanup every 24 hours by default
   */
  start(intervalHours: number = 24): void {
    if (this.isRunning) {
      console.log('Token expiration service is already running');
      return;
    }

    const intervalMs = intervalHours * 60 * 60 * 1000; // Convert hours to milliseconds

    console.log(`Starting token expiration service (checking every ${intervalHours} hours)`);

    // Run initial cleanup
    this.performCleanup();

    // Schedule recurring cleanup
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, intervalMs);

    this.isRunning = true;
  }

  /**
   * Stop the automatic token expiration monitoring service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    console.log('Token expiration service stopped');
  }

  /**
   * Perform cleanup of expired tokens and old usage logs
   */
  private async performCleanup(): Promise<void> {
    try {
      console.log('Running scheduled token cleanup...');

      const result = await apiTokenService.cleanupExpiredData();

      if (result.expiredTokens > 0 || result.oldLogs > 0) {
        console.log(`Cleanup completed: ${result.expiredTokens} tokens expired, ${result.oldLogs} old logs removed`);

        // Log details of expired tokens
        if (result.expiredTokenDetails.length > 0) {
          console.log('Expired tokens:');
          result.expiredTokenDetails.forEach(token => {
            console.log(`  - "${token.name}" (ID: ${token.id}) expired on ${token.expiresAt.toISOString()}`);
          });
        }
      } else {
        console.log('No expired tokens or old logs to clean up');
      }
    } catch (error) {
      console.error('Error during scheduled token cleanup:', error);
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    isRunning: boolean;
    nextCleanup?: Date;
  } {
    return {
      isRunning: this.isRunning,
      nextCleanup: this.cleanupInterval ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined
    };
  }

  /**
   * Manually trigger cleanup (for testing or immediate cleanup needs)
   */
  async triggerCleanup(): Promise<{
    expiredTokens: number;
    oldLogs: number;
    expiredTokenDetails: { id: number; name: string; expiresAt: Date }[];
  }> {
    console.log('Manual token cleanup triggered');
    const result = await apiTokenService.cleanupExpiredData();

    console.log(`Manual cleanup completed: ${result.expiredTokens} tokens expired, ${result.oldLogs} old logs removed`);

    return result;
  }

  /**
   * Get tokens that are expiring soon for notifications
   */
  async getExpiringTokensForNotification(warningDays: number = 7): Promise<{
    expiringSoon: any[];
    expired: any[];
    shouldNotify: boolean;
  }> {
    try {
      const expiringTokens = await apiTokenService.getExpiringTokens(warningDays);

      const shouldNotify = expiringTokens.expiringSoon.length > 0 || expiringTokens.expired.length > 0;

      return {
        expiringSoon: expiringTokens.expiringSoon,
        expired: expiringTokens.expired,
        shouldNotify
      };
    } catch (error) {
      console.error('Error checking expiring tokens for notification:', error);
      return {
        expiringSoon: [],
        expired: [],
        shouldNotify: false
      };
    }
  }
}

// Export singleton instance
export const tokenExpirationService = new TokenExpirationService();
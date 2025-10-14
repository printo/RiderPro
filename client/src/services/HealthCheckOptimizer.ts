/**
 * Health Check Optimization Service
 * 
 * Manages health check frequency and caching to reduce server load
 * while maintaining good user experience for connectivity monitoring.
 */

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number; // milliseconds
  cacheTimeout: number; // milliseconds
  maxRetries: number;
  backoffMultiplier: number;
}

export interface HealthCheckResult {
  isHealthy: boolean;
  timestamp: number;
  cached: boolean;
  responseTime?: number;
}

class HealthCheckOptimizer {
  private static instance: HealthCheckOptimizer;
  private config: HealthCheckConfig;
  private cache = new Map<string, HealthCheckResult>();
  private activeChecks = new Set<string>();
  private retryCounters = new Map<string, number>();

  private constructor() {
    this.config = this.getDefaultConfig();
    this.loadConfigFromStorage();
  }

  public static getInstance(): HealthCheckOptimizer {
    if (!HealthCheckOptimizer.instance) {
      HealthCheckOptimizer.instance = new HealthCheckOptimizer();
    }
    return HealthCheckOptimizer.instance;
  }

  private getDefaultConfig(): HealthCheckConfig {
    return {
      enabled: true,
      interval: 120000, // 2 minutes default (reduced from 30 seconds)
      cacheTimeout: 30000, // 30 seconds cache
      maxRetries: 3,
      backoffMultiplier: 2
    };
  }

  private loadConfigFromStorage(): void {
    try {
      const stored = localStorage.getItem('health_check_config');
      if (stored) {
        const storedConfig = JSON.parse(stored);
        this.config = { ...this.config, ...storedConfig };
      }
    } catch (error) {
      console.warn('[HealthCheckOptimizer] Failed to load config from storage:', error);
    }
  }

  private saveConfigToStorage(): void {
    try {
      localStorage.setItem('health_check_config', JSON.stringify(this.config));
    } catch (error) {
      console.warn('[HealthCheckOptimizer] Failed to save config to storage:', error);
    }
  }

  /**
   * Update health check configuration
   */
  public updateConfig(newConfig: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfigToStorage();
    console.log('[HealthCheckOptimizer] Configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): HealthCheckConfig {
    return { ...this.config };
  }

  /**
   * Perform optimized health check with caching and rate limiting
   */
  public async performHealthCheck(
    endpoint: string,
    checkFunction: () => Promise<boolean>
  ): Promise<HealthCheckResult> {
    if (!this.config.enabled) {
      return {
        isHealthy: false,
        timestamp: Date.now(),
        cached: false
      };
    }

    const now = Date.now();
    const cacheKey = endpoint;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && (now - cached.timestamp) < this.config.cacheTimeout) {
      return { ...cached, cached: true };
    }

    // Prevent concurrent checks for the same endpoint
    if (this.activeChecks.has(cacheKey)) {
      // Return cached result if available, otherwise return unknown state
      return cached || {
        isHealthy: false,
        timestamp: now,
        cached: false
      };
    }

    this.activeChecks.add(cacheKey);

    try {
      const startTime = Date.now();
      const isHealthy = await this.performCheckWithRetry(endpoint, checkFunction);
      const responseTime = Date.now() - startTime;

      const result: HealthCheckResult = {
        isHealthy,
        timestamp: now,
        cached: false,
        responseTime
      };

      // Cache the result
      this.cache.set(cacheKey, result);

      // Reset retry counter on success
      if (isHealthy) {
        this.retryCounters.delete(cacheKey);
      }

      return result;
    } finally {
      this.activeChecks.delete(cacheKey);
    }
  }

  private async performCheckWithRetry(
    endpoint: string,
    checkFunction: () => Promise<boolean>
  ): Promise<boolean> {
    const retryCount = this.retryCounters.get(endpoint) || 0;

    try {
      const result = await checkFunction();
      return result;
    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        // Increment retry counter
        this.retryCounters.set(endpoint, retryCount + 1);

        // Calculate backoff delay
        const delay = Math.min(
          1000 * Math.pow(this.config.backoffMultiplier, retryCount),
          30000 // Max 30 seconds
        );

        console.log(`[HealthCheckOptimizer] Retrying ${endpoint} in ${delay}ms (attempt ${retryCount + 1})`);

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry
        return this.performCheckWithRetry(endpoint, checkFunction);
      } else {
        // Max retries exceeded
        console.warn(`[HealthCheckOptimizer] Max retries exceeded for ${endpoint}`);
        return false;
      }
    }
  }

  /**
   * Clear cache for specific endpoint or all endpoints
   */
  public clearCache(endpoint?: string): void {
    if (endpoint) {
      this.cache.delete(endpoint);
      this.retryCounters.delete(endpoint);
    } else {
      this.cache.clear();
      this.retryCounters.clear();
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    cacheSize: number;
    activeChecks: number;
    retryCounters: number;
    oldestEntry?: number;
  } {
    let oldestEntry: number | undefined;

    for (const result of this.cache.values()) {
      if (!oldestEntry || result.timestamp < oldestEntry) {
        oldestEntry = result.timestamp;
      }
    }

    return {
      cacheSize: this.cache.size,
      activeChecks: this.activeChecks.size,
      retryCounters: this.retryCounters.size,
      oldestEntry
    };
  }

  /**
   * Clean up old cache entries
   */
  public cleanupCache(): void {
    const now = Date.now();
    const maxAge = this.config.cacheTimeout * 2; // Keep entries for 2x cache timeout

    for (const [key, result] of this.cache.entries()) {
      if (now - result.timestamp > maxAge) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Disable health checks temporarily
   */
  public disable(): void {
    this.updateConfig({ enabled: false });
  }

  /**
   * Enable health checks
   */
  public enable(): void {
    this.updateConfig({ enabled: true });
  }

  /**
   * Set health check interval
   */
  public setInterval(intervalMs: number): void {
    const safeInterval = Math.max(intervalMs, 30000); // Minimum 30 seconds
    this.updateConfig({ interval: safeInterval });
  }

  /**
   * Get recommended settings based on usage patterns
   */
  public getRecommendedSettings(): Partial<HealthCheckConfig> {
    const stats = this.getCacheStats();

    // If we have many active checks, increase cache timeout
    if (stats.activeChecks > 5) {
      return {
        cacheTimeout: Math.min(this.config.cacheTimeout * 1.5, 60000),
        interval: Math.min(this.config.interval * 1.2, 300000)
      };
    }

    // If cache is frequently hit, we can increase interval
    if (stats.cacheSize > 10) {
      return {
        interval: Math.min(this.config.interval * 1.1, 180000)
      };
    }

    return {};
  }
}

export const healthCheckOptimizer = HealthCheckOptimizer.getInstance();

// Auto-cleanup cache every 5 minutes
setInterval(() => {
  healthCheckOptimizer.cleanupCache();
}, 300000);

export default healthCheckOptimizer;
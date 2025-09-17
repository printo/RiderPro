import { GPSError, GPSPosition } from './GPSTracker';
import { ErrorHandlingService } from './ErrorHandlingService';

export interface GPSRecoveryState {
  isRecovering: boolean;
  lastKnownPosition: GPSPosition | null;
  recoveryAttempts: number;
  maxRecoveryAttempts: number;
  fallbackMode: boolean;
  lastSuccessfulUpdate: Date | null;
}

export interface GPSRecoveryConfig {
  maxRetryAttempts: number;
  retryDelayMs: number;
  fallbackTimeout: number; // ms to wait before enabling fallback mode
  enableFallbackMode: boolean;
  enablePositionEstimation: boolean;
  positionEstimationAccuracy: number; // meters
}

export class GPSErrorRecoveryService {
  private errorHandler: ErrorHandlingService;
  private recoveryState: GPSRecoveryState = {
    isRecovering: false,
    lastKnownPosition: null,
    recoveryAttempts: 0,
    maxRecoveryAttempts: 3,
    fallbackMode: false,
    lastSuccessfulUpdate: null
  };
  private config: GPSRecoveryConfig = {
    maxRetryAttempts: 3,
    retryDelayMs: 2000,
    fallbackTimeout: 30000, // 30 seconds
    enableFallbackMode: true,
    enablePositionEstimation: true,
    positionEstimationAccuracy: 100 // 100 meters
  };
  private fallbackTimer: NodeJS.Timeout | null = null;
  private recoveryListeners: ((state: GPSRecoveryState) => void)[] = [];

  constructor(errorHandler: ErrorHandlingService, config?: Partial<GPSRecoveryConfig>) {
    this.errorHandler = errorHandler;
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.recoveryState.maxRecoveryAttempts = this.config.maxRetryAttempts;
  }

  /**
   * Handle GPS error and attempt recovery
   */
  async handleGPSError(
    error: GPSError,
    sessionId?: string,
    onRecovery?: (position: GPSPosition) => void
  ): Promise<GPSPosition | null> {
    // Log the GPS error
    this.errorHandler.logError('gps', `GPS Error: ${error.message}`, {
      code: error.code,
      sessionId
    });

    // Start recovery process
    this.recoveryState.isRecovering = true;
    this.notifyRecoveryListeners();

    let recoveredPosition: GPSPosition | null = null;

    try {
      switch (error.code) {
        case 1: // PERMISSION_DENIED
          recoveredPosition = await this.handlePermissionDenied(sessionId);
          break;
        case 2: // POSITION_UNAVAILABLE
          recoveredPosition = await this.handlePositionUnavailable(sessionId);
          break;
        case 3: // TIMEOUT
          recoveredPosition = await this.handleTimeout(sessionId);
          break;
        default:
          recoveredPosition = await this.handleUnknownError(error, sessionId);
          break;
      }

      if (recoveredPosition) {
        this.onRecoverySuccess(recoveredPosition);
        onRecovery?.(recoveredPosition);
      } else {
        this.onRecoveryFailure(error);
      }

    } catch (recoveryError) {
      this.errorHandler.logError('gps', 'GPS recovery failed', {
        originalError: error,
        recoveryError,
        sessionId
      });
      this.onRecoveryFailure(error);
    }

    return recoveredPosition;
  }

  /**
   * Handle permission denied error
   */
  private async handlePermissionDenied(sessionId?: string): Promise<GPSPosition | null> {
    this.errorHandler.logWarn('gps', 'GPS permission denied - attempting recovery', { sessionId });

    // Check if we can request permission again
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });

      if (permission.state === 'prompt') {
        // Try to request permission again
        return await this.retryGPSRequest();
      } else if (permission.state === 'denied') {
        // Permission permanently denied - enable fallback mode
        this.enableFallbackMode('GPS permission permanently denied');
        return this.getFallbackPosition();
      }
    } catch (error) {
      this.errorHandler.logWarn('gps', 'Could not check GPS permission status', { error });
    }

    // Enable fallback mode
    this.enableFallbackMode('GPS permission denied');
    return this.getFallbackPosition();
  }

  /**
   * Handle position unavailable error
   */
  private async handlePositionUnavailable(sessionId?: string): Promise<GPSPosition | null> {
    this.errorHandler.logWarn('gps', 'GPS position unavailable - attempting recovery', { sessionId });

    // Try with different GPS settings
    const recoveredPosition = await this.retryWithFallbackSettings();

    if (!recoveredPosition) {
      // Use last known position if available
      if (this.recoveryState.lastKnownPosition) {
        this.errorHandler.logInfo('gps', 'Using last known GPS position', { sessionId });
        return this.estimateCurrentPosition();
      }

      // Enable fallback mode
      this.enableFallbackMode('GPS signal unavailable');
      return this.getFallbackPosition();
    }

    return recoveredPosition;
  }

  /**
   * Handle timeout error
   */
  private async handleTimeout(sessionId?: string): Promise<GPSPosition | null> {
    this.errorHandler.logWarn('gps', 'GPS request timeout - attempting recovery', { sessionId });

    // Retry with longer timeout
    const recoveredPosition = await this.retryWithExtendedTimeout();

    if (!recoveredPosition) {
      // Use last known position
      if (this.recoveryState.lastKnownPosition) {
        return this.estimateCurrentPosition();
      }

      // Enable fallback mode
      this.enableFallbackMode('GPS timeout');
      return this.getFallbackPosition();
    }

    return recoveredPosition;
  }

  /**
   * Handle unknown GPS error
   */
  private async handleUnknownError(error: GPSError, sessionId?: string): Promise<GPSPosition | null> {
    this.errorHandler.logError('gps', 'Unknown GPS error - attempting recovery', {
      error,
      sessionId
    });

    // Try basic retry
    const recoveredPosition = await this.retryGPSRequest();

    if (!recoveredPosition) {
      this.enableFallbackMode('Unknown GPS error');
      return this.getFallbackPosition();
    }

    return recoveredPosition;
  }

  /**
   * Retry GPS request with standard settings
   */
  private async retryGPSRequest(): Promise<GPSPosition | null> {
    if (this.recoveryState.recoveryAttempts >= this.config.maxRetryAttempts) {
      return null;
    }

    this.recoveryState.recoveryAttempts++;

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs));

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const gpsPosition: GPSPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || undefined,
            timestamp: new Date().toISOString()
          };
          resolve(gpsPosition);
        },
        () => {
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  }

  /**
   * Retry with fallback GPS settings
   */
  private async retryWithFallbackSettings(): Promise<GPSPosition | null> {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const gpsPosition: GPSPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || undefined,
            timestamp: new Date().toISOString()
          };
          resolve(gpsPosition);
        },
        () => {
          resolve(null);
        },
        {
          enableHighAccuracy: false, // Use less accurate but more reliable positioning
          timeout: 15000,
          maximumAge: 300000 // Accept 5-minute old position
        }
      );
    });
  }

  /**
   * Retry with extended timeout
   */
  private async retryWithExtendedTimeout(): Promise<GPSPosition | null> {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const gpsPosition: GPSPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || undefined,
            timestamp: new Date().toISOString()
          };
          resolve(gpsPosition);
        },
        () => {
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 30000, // Extended timeout
          maximumAge: 120000
        }
      );
    });
  }

  /**
   * Enable fallback mode
   */
  private enableFallbackMode(reason: string): void {
    if (!this.config.enableFallbackMode) return;

    this.recoveryState.fallbackMode = true;
    this.errorHandler.logInfo('gps', `Fallback mode enabled: ${reason}`);

    // Set timer to disable fallback mode after some time
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
    }

    this.fallbackTimer = setTimeout(() => {
      this.disableFallbackMode();
    }, this.config.fallbackTimeout);

    this.notifyRecoveryListeners();
  }

  /**
   * Disable fallback mode
   */
  private disableFallbackMode(): void {
    this.recoveryState.fallbackMode = false;
    this.errorHandler.logInfo('gps', 'Fallback mode disabled - attempting normal GPS');
    this.notifyRecoveryListeners();
  }

  /**
   * Get fallback position (estimated or last known)
   */
  private getFallbackPosition(): GPSPosition | null {
    if (this.recoveryState.lastKnownPosition && this.config.enablePositionEstimation) {
      return this.estimateCurrentPosition();
    }
    return null;
  }

  /**
   * Estimate current position based on last known position
   */
  private estimateCurrentPosition(): GPSPosition | null {
    if (!this.recoveryState.lastKnownPosition) return null;

    const lastPos = this.recoveryState.lastKnownPosition;
    const timeSinceLastUpdate = this.recoveryState.lastSuccessfulUpdate
      ? Date.now() - this.recoveryState.lastSuccessfulUpdate.getTime()
      : 0;

    // If last position is very recent (< 5 minutes), use it as-is
    if (timeSinceLastUpdate < 300000) {
      return {
        ...lastPos,
        accuracy: Math.max(lastPos.accuracy, this.config.positionEstimationAccuracy),
        timestamp: new Date().toISOString()
      };
    }

    // For older positions, increase accuracy uncertainty
    const accuracyDegradation = Math.min(timeSinceLastUpdate / 60000, 10); // Max 10x degradation

    return {
      ...lastPos,
      accuracy: lastPos.accuracy * (1 + accuracyDegradation),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Record successful GPS position
   */
  recordSuccessfulPosition(position: GPSPosition): void {
    this.recoveryState.lastKnownPosition = position;
    this.recoveryState.lastSuccessfulUpdate = new Date();

    // Reset recovery state on success
    if (this.recoveryState.isRecovering) {
      this.onRecoverySuccess(position);
    }
  }

  /**
   * Handle recovery success
   */
  private onRecoverySuccess(position: GPSPosition): void {
    this.recoveryState.isRecovering = false;
    this.recoveryState.recoveryAttempts = 0;
    this.recoveryState.lastKnownPosition = position;
    this.recoveryState.lastSuccessfulUpdate = new Date();

    // Disable fallback mode on successful recovery
    if (this.recoveryState.fallbackMode) {
      this.disableFallbackMode();
    }

    this.errorHandler.logInfo('gps', 'GPS recovery successful', {
      position: {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy
      }
    });

    this.notifyRecoveryListeners();
  }

  /**
   * Handle recovery failure
   */
  private onRecoveryFailure(originalError: GPSError): void {
    this.recoveryState.isRecovering = false;

    this.errorHandler.logError('gps', 'GPS recovery failed - all attempts exhausted', {
      originalError,
      recoveryAttempts: this.recoveryState.recoveryAttempts,
      fallbackMode: this.recoveryState.fallbackMode
    });

    this.notifyRecoveryListeners();
  }

  /**
   * Get current recovery state
   */
  getRecoveryState(): GPSRecoveryState {
    return { ...this.recoveryState };
  }

  /**
   * Check if GPS is in fallback mode
   */
  isInFallbackMode(): boolean {
    return this.recoveryState.fallbackMode;
  }

  /**
   * Check if GPS is currently recovering
   */
  isRecovering(): boolean {
    return this.recoveryState.isRecovering;
  }

  /**
   * Get last known position
   */
  getLastKnownPosition(): GPSPosition | null {
    return this.recoveryState.lastKnownPosition;
  }

  /**
   * Add recovery state listener
   */
  addRecoveryListener(listener: (state: GPSRecoveryState) => void): void {
    this.recoveryListeners.push(listener);
  }

  /**
   * Remove recovery state listener
   */
  removeRecoveryListener(listener: (state: GPSRecoveryState) => void): void {
    const index = this.recoveryListeners.indexOf(listener);
    if (index > -1) {
      this.recoveryListeners.splice(index, 1);
    }
  }

  /**
   * Notify recovery listeners
   */
  private notifyRecoveryListeners(): void {
    this.recoveryListeners.forEach(listener => {
      try {
        listener(this.recoveryState);
      } catch (error) {
        console.error('Error in recovery listener:', error);
      }
    });
  }

  /**
   * Reset recovery state
   */
  reset(): void {
    this.recoveryState = {
      isRecovering: false,
      lastKnownPosition: null,
      recoveryAttempts: 0,
      maxRecoveryAttempts: this.config.maxRetryAttempts,
      fallbackMode: false,
      lastSuccessfulUpdate: null
    };

    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }

    this.notifyRecoveryListeners();
  }

  /**
   * Update recovery configuration
   */
  updateConfig(newConfig: Partial<GPSRecoveryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.recoveryState.maxRecoveryAttempts = this.config.maxRetryAttempts;
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    totalRecoveryAttempts: number;
    successfulRecoveries: number;
    fallbackModeActivations: number;
    lastRecoveryTime?: Date;
    averageRecoveryTime: number;
  } {
    // In a real implementation, these would be tracked over time
    return {
      totalRecoveryAttempts: this.recoveryState.recoveryAttempts,
      successfulRecoveries: this.recoveryState.lastSuccessfulUpdate ? 1 : 0,
      fallbackModeActivations: this.recoveryState.fallbackMode ? 1 : 0,
      lastRecoveryTime: this.recoveryState.lastSuccessfulUpdate || undefined,
      averageRecoveryTime: 0 // Would be calculated from historical data
    };
  }
}
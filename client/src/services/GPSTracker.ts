import { GPSCoordinate } from '@shared/schema';
import { OfflineStorageService } from './OfflineStorageService';
import { BatteryOptimizationService } from './BatteryOptimizationService';
import { PerformanceMonitoringService } from './PerformanceMonitoringService';
import { ErrorHandlingService } from './ErrorHandlingService';
import { GPSErrorRecoveryService } from './GPSErrorRecoveryService';
import { log } from "../utils/logger.js";

export interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number;
  timestamp: string;
}

export interface GPSError {
  code: number;
  message: string;
}

export type GPSPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

export class GPSTracker {
  private watchId: number | null = null;
  private isTracking = false;
  private sessionId: string | null = null;
  private onLocationUpdate?: (position: GPSPosition) => void;
  private onError?: (error: GPSError) => void;
  private trackingInterval = 30000; // 30 seconds default
  private lastPosition: GPSPosition | null = null;
  private offlineCoordinates: GPSCoordinate[] = [];
  private offlineStorage: OfflineStorageService | null = null;
  private batteryOptimization: BatteryOptimizationService | null = null;
  private performanceMonitoring: PerformanceMonitoringService | null = null;
  private errorHandler: ErrorHandlingService | null = null;
  private gpsErrorRecovery: GPSErrorRecoveryService | null = null;
  private useOfflineStorage = true;
  private useBatteryOptimization = true;
  private useErrorHandling = true;
  private adaptiveTrackingInterval = 30000;
  private lastOptimizationCheck = 0;

  constructor(
    useOfflineStorage = true,
    useBatteryOptimization = true,
    usePerformanceMonitoring = true,
    useErrorHandling = true
  ) {
    this.useOfflineStorage = useOfflineStorage;
    this.useBatteryOptimization = useBatteryOptimization;
    this.useErrorHandling = useErrorHandling;

    if (this.useOfflineStorage) {
      this.offlineStorage = new OfflineStorageService();
    } else {
      // Fallback to localStorage for backward compatibility
      this.loadOfflineCoordinates();
    }

    if (this.useBatteryOptimization) {
      this.batteryOptimization = new BatteryOptimizationService();
      this.setupBatteryOptimization();
    }

    if (usePerformanceMonitoring) {
      this.performanceMonitoring = new PerformanceMonitoringService();
    }

    if (this.useErrorHandling) {
      this.errorHandler = new ErrorHandlingService();
      this.gpsErrorRecovery = new GPSErrorRecoveryService(this.errorHandler);
      this.setupErrorHandling();
    }
  }

  /**
   * Check if Geolocation API is supported
   */
  isSupported(): boolean {
    return 'geolocation' in navigator;
  }

  /**
   * Check current permission status
   */
  async checkPermission(): Promise<GPSPermissionStatus> {
    if (!this.isSupported()) {
      return 'unknown';
    }

    try {
      // Check if permissions API is available
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        return permission.state as GPSPermissionStatus;
      }

      // Fallback: try to get position to check permission
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve('granted'),
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              resolve('denied');
            } else {
              resolve('unknown');
            }
          },
          { timeout: 5000 }
        );
      });
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Request location permission and get current position
   */
  async requestPermission(): Promise<GPSPosition> {
    if (!this.isSupported()) {
      throw new Error('Geolocation is not supported by this browser');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const gpsPosition: GPSPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || undefined,
            timestamp: new Date().toISOString()
          };
          this.lastPosition = gpsPosition;
          resolve(gpsPosition);
        },
        (error) => {
          const gpsError: GPSError = {
            code: error.code,
            message: this.getErrorMessage(error.code)
          };
          reject(gpsError);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000 // 1 minute
        }
      );
    });
  }

  /**
   * Start GPS tracking for a session
   */
  async startTracking(
    sessionId: string,
    onLocationUpdate: (position: GPSPosition) => void,
    onError?: (error: GPSError) => void
  ): Promise<void> {
    if (this.isTracking) {
      throw new Error('GPS tracking is already active');
    }

    if (!this.isSupported()) {
      throw new Error('Geolocation is not supported by this browser');
    }

    this.sessionId = sessionId;
    this.onLocationUpdate = onLocationUpdate;
    this.onError = onError;
    this.isTracking = true;

    // Start watching position
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const gpsPosition: GPSPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || undefined,
          timestamp: new Date().toISOString()
        };

        this.lastPosition = gpsPosition;

        // Record successful position for error recovery
        this.recordSuccessfulGPSPosition(gpsPosition);

        // Record performance metrics
        if (this.performanceMonitoring) {
          const updateTime = Date.now() - position.timestamp;
          this.performanceMonitoring.recordQuery(
            'GPS_Update',
            performance.now() - updateTime,
            1,
            true
          );
        }

        // Record GPS update for battery optimization
        if (this.batteryOptimization) {
          this.batteryOptimization.recordGPSUpdate(
            gpsPosition.latitude,
            gpsPosition.longitude,
            gpsPosition.accuracy,
            Date.now() - new Date(gpsPosition.timestamp).getTime()
          );
        }

        // Store offline if needed (async but don't wait)
        this.storeOfflineCoordinate(gpsPosition).catch(error => {
          console.warn('Failed to store coordinate offline:', error);
        });

        // Check for adaptive tracking optimization
        this.checkAdaptiveTracking();

        // Call update callback
        if (this.onLocationUpdate) {
          this.onLocationUpdate(gpsPosition);
        }
      },
      async (error) => {
        const gpsError: GPSError = {
          code: error.code,
          message: this.getErrorMessage(error.code)
        };

        console.warn('GPS tracking error:', gpsError);

        // Attempt error recovery
        let recoveredPosition: GPSPosition | null = null;
        if (this.gpsErrorRecovery) {
          recoveredPosition = await this.gpsErrorRecovery.handleGPSError(
            gpsError,
            this.sessionId || undefined,
            (position) => {
              // Handle recovered position
              this.lastPosition = position;
              if (this.onLocationUpdate) {
                this.onLocationUpdate(position);
              }
            }
          );
        }

        // If recovery failed, call error callback
        if (!recoveredPosition && this.onError) {
          this.onError(gpsError);
        }

        // Stop tracking only on permission denied (unrecoverable)
        if (error.code === error.PERMISSION_DENIED && !recoveredPosition) {
          this.stopTracking();
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: this.trackingInterval / 2 // Half of tracking interval
      }
    );

    log.dev(`GPS tracking started for session: ${sessionId}`);
  }

  /**
   * Stop GPS tracking
   */
  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    this.isTracking = false;
    this.sessionId = null;
    this.onLocationUpdate = undefined;
    this.onError = undefined;

    log.dev('GPS tracking stopped');
  }

  /**
   * Get current position once
   */
  async getCurrentPosition(): Promise<GPSPosition> {
    if (!this.isSupported()) {
      throw new Error('Geolocation is not supported by this browser');
    }

    return new Promise((resolve, reject) => {
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
        (error) => {
          const gpsError: GPSError = {
            code: error.code,
            message: this.getErrorMessage(error.code)
          };
          reject(gpsError);
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
   * Set tracking interval (in milliseconds)
   */
  setTrackingInterval(interval: number): void {
    this.trackingInterval = Math.max(interval, 5000); // Minimum 5 seconds
  }

  /**
   * Get tracking status
   */
  getTrackingStatus(): {
    isTracking: boolean;
    sessionId: string | null;
    lastPosition: GPSPosition | null;
  } {
    return {
      isTracking: this.isTracking,
      sessionId: this.sessionId,
      lastPosition: this.lastPosition
    };
  }

  /**
   * Store coordinate offline for later sync
   */
  private async storeOfflineCoordinate(position: GPSPosition): Promise<void> {
    if (!this.sessionId) return;

    try {
      if (this.useOfflineStorage && this.offlineStorage) {
        // Use IndexedDB for better offline storage
        await this.offlineStorage.storeGPSRecord(this.sessionId, position);
      } else {
        // Fallback to localStorage
        const coordinate: GPSCoordinate = {
          sessionId: this.sessionId,
          latitude: position.latitude,
          longitude: position.longitude,
          timestamp: position.timestamp,
          accuracy: position.accuracy,
          speed: position.speed
        };

        this.offlineCoordinates.push(coordinate);
        this.saveOfflineCoordinates();

        // Limit offline storage to prevent memory issues
        if (this.offlineCoordinates.length > 1000) {
          this.offlineCoordinates = this.offlineCoordinates.slice(-500);
          this.saveOfflineCoordinates();
        }
      }
    } catch (error) {
      console.warn('Failed to store GPS coordinate offline:', error);

      // Fallback to localStorage if IndexedDB fails
      if (this.useOfflineStorage) {
        const coordinate: GPSCoordinate = {
          sessionId: this.sessionId,
          latitude: position.latitude,
          longitude: position.longitude,
          timestamp: position.timestamp,
          accuracy: position.accuracy,
          speed: position.speed
        };

        this.offlineCoordinates.push(coordinate);
        this.saveOfflineCoordinates();
      }
    }
  }

  /**
   * Get offline coordinates for sync
   */
  getOfflineCoordinates(): GPSCoordinate[] {
    return [...this.offlineCoordinates];
  }

  /**
   * Clear offline coordinates after successful sync
   */
  clearOfflineCoordinates(): void {
    this.offlineCoordinates = [];
    this.saveOfflineCoordinates();
  }

  /**
   * Get offline storage service instance
   */
  getOfflineStorage(): OfflineStorageService | null {
    return this.offlineStorage;
  }

  /**
   * Check if offline storage is enabled and available
   */
  isOfflineStorageEnabled(): boolean {
    return this.useOfflineStorage && this.offlineStorage !== null;
  }

  /**
   * Get offline storage status
   */
  async getOfflineStorageStatus(): Promise<{
    enabled: boolean;
    pendingRecords: number;
    isOnline: boolean;
  } | null> {
    if (!this.offlineStorage) {
      return null;
    }

    try {
      const syncStatus = this.offlineStorage.getSyncStatus();
      return {
        enabled: this.useOfflineStorage,
        pendingRecords: syncStatus.pendingRecords,
        isOnline: syncStatus.isOnline
      };
    } catch (error) {
      console.warn('Failed to get offline storage status:', error);
      return null;
    }
  }

  /**
   * Force sync offline data
   */
  async forceSyncOfflineData(): Promise<void> {
    if (!this.offlineStorage) {
      throw new Error('Offline storage not available');
    }

    await this.offlineStorage.forceSyncNow();
  }

  /**
   * Setup battery optimization
   */
  private setupBatteryOptimization(): void {
    if (!this.batteryOptimization) return;

    // Listen for optimization changes
    this.batteryOptimization.addOptimizationListener((interval, reason) => {
      this.adaptiveTrackingInterval = interval;
      log.dev(`GPS tracking interval adjusted to ${interval}ms: ${reason}`);
    });

    // Initial optimization check
    const { interval } = this.batteryOptimization.getOptimalTrackingInterval();
    this.adaptiveTrackingInterval = interval;
  }

  /**
   * Check and apply adaptive tracking optimization
   */
  private checkAdaptiveTracking(): void {
    if (!this.batteryOptimization || !this.isTracking) return;

    const now = Date.now();

    // Check optimization every 30 seconds
    if (now - this.lastOptimizationCheck < 30000) return;

    this.lastOptimizationCheck = now;

    const { interval, reason } = this.batteryOptimization.getOptimalTrackingInterval();

    if (interval !== this.adaptiveTrackingInterval) {
      this.adaptiveTrackingInterval = interval;
      log.dev(`Adaptive tracking: ${reason} - interval: ${interval}ms`);

      // Restart tracking with new interval if needed
      if (this.watchId !== null) {
        this.restartTrackingWithNewInterval();
      }
    }
  }

  /**
   * Restart tracking with new interval
   */
  private restartTrackingWithNewInterval(): void {
    if (!this.isTracking || !this.sessionId) return;

    const currentSessionId = this.sessionId;
    const currentOnLocationUpdate = this.onLocationUpdate;
    const currentOnError = this.onError;

    // Stop current tracking
    this.stopTracking();

    // Restart with new settings
    setTimeout(() => {
      if (currentOnLocationUpdate) {
        this.startTracking(currentSessionId, currentOnLocationUpdate, currentOnError);
      }
    }, 1000);
  }

  /**
   * Get battery optimization service
   */
  getBatteryOptimization(): BatteryOptimizationService | null {
    return this.batteryOptimization;
  }

  /**
   * Get performance monitoring service
   */
  getPerformanceMonitoring(): PerformanceMonitoringService | null {
    return this.performanceMonitoring;
  }

  /**
   * Get current adaptive tracking interval
   */
  getAdaptiveTrackingInterval(): number {
    return this.adaptiveTrackingInterval;
  }

  /**
   * Get battery status
   */
  getBatteryStatus(): any {
    return this.batteryOptimization?.getBatteryStatus() || null;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): any {
    return this.performanceMonitoring?.getPerformanceStats() || null;
  }

  /**
   * Check if battery optimization is active
   */
  isBatteryOptimizationActive(): boolean {
    return this.batteryOptimization?.shouldOptimize() || false;
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.batteryOptimization) {
      recommendations.push(...this.batteryOptimization.getOptimizationRecommendations());
    }

    if (this.performanceMonitoring) {
      recommendations.push(...this.performanceMonitoring.getOptimizationRecommendations());
    }

    return recommendations;
  }

  /**
   * Enable/disable battery optimization
   */
  setBatteryOptimizationEnabled(enabled: boolean): void {
    if (!this.batteryOptimization) return;

    const settings = this.batteryOptimization.getSettings();
    settings.adaptiveSettings.enableBatteryOptimization = enabled;
    this.batteryOptimization.updateSettings(settings);
  }

  /**
   * Enable/disable movement-based adaptation
   */
  setMovementAdaptationEnabled(enabled: boolean): void {
    if (!this.batteryOptimization) return;

    const settings = this.batteryOptimization.getSettings();
    settings.adaptiveSettings.enableMovementAdaptation = enabled;
    this.batteryOptimization.updateSettings(settings);
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    if (!this.errorHandler || !this.gpsErrorRecovery) return;

    // Listen for GPS recovery state changes
    this.gpsErrorRecovery.addRecoveryListener((state) => {
      if (this.errorHandler) {
        this.errorHandler.logInfo('gps', 'GPS recovery state changed', {
          isRecovering: state.isRecovering,
          fallbackMode: state.fallbackMode,
          recoveryAttempts: state.recoveryAttempts
        });
      }
    });
  }

  /**
   * Record successful GPS position for error recovery
   */
  private recordSuccessfulGPSPosition(position: GPSPosition): void {
    if (this.gpsErrorRecovery) {
      this.gpsErrorRecovery.recordSuccessfulPosition(position);
    }
  }

  /**
   * Get error handler instance
   */
  getErrorHandler(): ErrorHandlingService | null {
    return this.errorHandler;
  }

  /**
   * Get GPS error recovery service
   */
  getGPSErrorRecovery(): GPSErrorRecoveryService | null {
    return this.gpsErrorRecovery;
  }

  /**
   * Check if GPS is in fallback mode
   */
  isInFallbackMode(): boolean {
    return this.gpsErrorRecovery?.isInFallbackMode() || false;
  }

  /**
   * Get GPS recovery state
   */
  getGPSRecoveryState(): any {
    return this.gpsErrorRecovery?.getRecoveryState() || null;
  }

  /**
   * Get error logs related to GPS
   */
  getGPSErrorLogs(): any[] {
    if (!this.errorHandler) return [];

    return this.errorHandler.getLogs({
      category: 'gps',
      since: new Date(Date.now() - 86400000) // Last 24 hours
    });
  }

  /**
   * Get system health status
   */
  getSystemHealth(): any {
    return this.errorHandler?.getSystemHealth() || null;
  }

  /**
   * Handle critical GPS error
   */
  private handleCriticalGPSError(error: GPSError): void {
    if (!this.errorHandler) return;

    this.errorHandler.logCritical('gps', 'Critical GPS error - tracking may be compromised', {
      error,
      sessionId: this.sessionId,
      trackingStatus: this.isTracking
    });

    // In a critical error, we should ensure shipment operations continue
    console.warn('Critical GPS error detected - shipment operations will continue without GPS tracking');
  }

  /**
   * Ensure shipment operations continue despite GPS errors
   */
  private ensureShipmentContinuity(): void {
    if (!this.errorHandler) return;

    this.errorHandler.logInfo('system', 'Ensuring shipment operations continue despite GPS errors', {
      sessionId: this.sessionId,
      hasLastKnownPosition: !!this.lastPosition,
      fallbackMode: this.isInFallbackMode()
    });

    // This method ensures that GPS failures don't affect shipment operations
    // The actual shipment system should continue to work normally
  }

  /**
   * Save offline coordinates to localStorage
   */
  private saveOfflineCoordinates(): void {
    try {
      localStorage.setItem('gps_offline_coordinates', JSON.stringify(this.offlineCoordinates));
    } catch (error) {
      console.warn('Failed to save offline coordinates:', error);
    }
  }

  /**
   * Load offline coordinates from localStorage
   */
  private loadOfflineCoordinates(): void {
    try {
      const stored = localStorage.getItem('gps_offline_coordinates');
      if (stored) {
        this.offlineCoordinates = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load offline coordinates:', error);
      this.offlineCoordinates = [];
    }
  }

  /**
   * Get human-readable error message
   */
  private getErrorMessage(code: number): string {
    switch (code) {
      case 1: // PERMISSION_DENIED
        return 'Location access denied by user';
      case 2: // POSITION_UNAVAILABLE
        return 'Location information unavailable';
      case 3: // TIMEOUT
        return 'Location request timed out';
      default:
        return 'Unknown location error';
    }
  }

  /**
   * Calculate distance between two positions using Haversine formula
   */
  static calculateDistance(pos1: GPSPosition, pos2: GPSPosition): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(pos2.latitude - pos1.latitude);
    const dLon = this.toRadians(pos2.longitude - pos1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(pos1.latitude)) * Math.cos(this.toRadians(pos2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  }

  /**
   * Convert degrees to radians
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if position is within radius of another position
   */
  static isWithinRadius(pos1: GPSPosition, pos2: GPSPosition, radiusKm: number): boolean {
    const distance = this.calculateDistance(pos1, pos2);
    return distance <= radiusKm;
  }
}
import { log } from "../utils/logger.js";

export interface BatteryInfo {
  level: number; // 0-1 (0% to 100%)
  charging: boolean;
  chargingTime?: number; // seconds until charged
  dischargingTime?: number; // seconds until discharged
}

export interface PerformanceMetrics {
  gpsAccuracy: number;
  locationUpdateCount: number;
  averageUpdateInterval: number;
  batteryUsageRate: number; // % per hour
  memoryUsage: number; // MB
  cpuUsage: number; // estimated %
}

export interface OptimizationSettings {
  batteryThresholds: {
    critical: number; // 0.15 (15%)
    low: number; // 0.30 (30%)
    normal: number; // 0.50 (50%)
  };
  trackingIntervals: {
    critical: number; // 300000ms (5 minutes)
    low: number; // 120000ms (2 minutes)
    normal: number; // 30000ms (30 seconds)
    high: number; // 15000ms (15 seconds)
  };
  movementThresholds: {
    stationary: number; // 5 meters
    slow: number; // 50 meters
    normal: number; // 200 meters
  };
  adaptiveSettings: {
    enableBatteryOptimization: boolean;
    enableMovementAdaptation: boolean;
    enablePerformanceMonitoring: boolean;
    maxLocationAge: number; // 60000ms (1 minute)
  };
}

interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  onlevelchange: ((this: BatteryManager, ev: Event) => void) | null;
  onchargingchange: ((this: BatteryManager, ev: Event) => void) | null;
  onchargingtimechange: ((this: BatteryManager, ev: Event) => void) | null;
  ondischargingtimechange: ((this: BatteryManager, ev: Event) => void) | null;
}

export class BatteryOptimizationService {
  private battery: BatteryManager | null = null;
  private batteryInfo: BatteryInfo = {
    level: 1,
    charging: false
  };
  private performanceMetrics: PerformanceMetrics = {
    gpsAccuracy: 0,
    locationUpdateCount: 0,
    averageUpdateInterval: 30000,
    batteryUsageRate: 0,
    memoryUsage: 0,
    cpuUsage: 0
  };
  private settings: OptimizationSettings = {
    batteryThresholds: {
      critical: 0.15,
      low: 0.30,
      normal: 0.50
    },
    trackingIntervals: {
      critical: 300000, // 5 minutes
      low: 120000, // 2 minutes
      normal: 30000, // 30 seconds
      high: 15000 // 15 seconds
    },
    movementThresholds: {
      stationary: 5, // 5 meters
      slow: 50, // 50 meters
      normal: 200 // 200 meters
    },
    adaptiveSettings: {
      enableBatteryOptimization: true,
      enableMovementAdaptation: true,
      enablePerformanceMonitoring: true,
      maxLocationAge: 60000
    }
  };

  private lastPositions: Array<{ lat: number; lng: number; timestamp: number }> = [];
  private batteryListeners: ((info: BatteryInfo) => void)[] = [];
  private performanceListeners: ((metrics: PerformanceMetrics) => void)[] = [];
  private optimizationListeners: ((interval: number, reason: string) => void)[] = [];

  private startTime = Date.now();
  private initialBatteryLevel = 1;
  private updateCount = 0;
  private totalUpdateTime = 0;

  constructor() {
    this.initializeBatteryAPI();
    this.startPerformanceMonitoring();
  }

  /**
   * Initialize Battery API if available
   */
  private async initializeBatteryAPI(): Promise<void> {
    try {
      // Check if Battery API is available
      if ('getBattery' in navigator) {
        this.battery = await (navigator as unknown as { getBattery: () => Promise<BatteryManager> }).getBattery();
        this.updateBatteryInfo();
        this.setupBatteryListeners();
        log.dev('Battery API initialized');
      } else if ('battery' in navigator) {
        // Older API
        this.battery = (navigator as unknown as { battery: BatteryManager }).battery;
        this.updateBatteryInfo();
        this.setupBatteryListeners();
        log.dev('Legacy Battery API initialized');
      } else {
        console.warn('Battery API not available');
        // Use mock battery info
        this.batteryInfo = {
          level: 0.8, // Assume 80% battery
          charging: false
        };
      }
    } catch (error) {
      console.warn('Failed to initialize Battery API:', error);
      // Fallback to estimated battery info
      this.batteryInfo = {
        level: 0.8,
        charging: false
      };
    }
  }

  /**
   * Setup battery event listeners
   */
  private setupBatteryListeners(): void {
    if (!this.battery) return;

    this.battery.addEventListener('chargingchange', () => {
      this.updateBatteryInfo();
    });

    this.battery.addEventListener('levelchange', () => {
      this.updateBatteryInfo();
    });

    this.battery.addEventListener('chargingtimechange', () => {
      this.updateBatteryInfo();
    });

    this.battery.addEventListener('dischargingtimechange', () => {
      this.updateBatteryInfo();
    });
  }

  /**
   * Update battery information
   */
  private updateBatteryInfo(): void {
    if (!this.battery) return;

    this.batteryInfo = {
      level: this.battery.level,
      charging: this.battery.charging,
      chargingTime: this.battery.chargingTime !== Infinity ? this.battery.chargingTime : undefined,
      dischargingTime: this.battery.dischargingTime !== Infinity ? this.battery.dischargingTime : undefined
    };

    // Calculate battery usage rate
    const elapsedHours = (Date.now() - this.startTime) / (1000 * 60 * 60);
    if (elapsedHours > 0 && !this.batteryInfo.charging) {
      const batteryUsed = this.initialBatteryLevel - this.batteryInfo.level;
      this.performanceMetrics.batteryUsageRate = batteryUsed / elapsedHours;
    }

    // Notify listeners
    this.batteryListeners.forEach(listener => {
      try {
        listener(this.batteryInfo);
      } catch (error) {
        console.error('Error in battery listener:', error);
      }
    });
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    if (!this.settings.adaptiveSettings.enablePerformanceMonitoring) return;

    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 60000); // Update every minute
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    // Update memory usage if available
    if ('memory' in performance) {
      const memory = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
      this.performanceMetrics.memoryUsage = memory.usedJSHeapSize / (1024 * 1024); // MB
    }

    // Calculate average update interval
    if (this.updateCount > 0) {
      this.performanceMetrics.averageUpdateInterval = this.totalUpdateTime / this.updateCount;
    }

    // Notify listeners
    this.performanceListeners.forEach(listener => {
      try {
        listener(this.performanceMetrics);
      } catch (error) {
        console.error('Error in performance listener:', error);
      }
    });
  }

  /**
   * Record GPS update for performance tracking
   */
  recordGPSUpdate(latitude: number, longitude: number, accuracy: number, updateTime: number): void {
    this.updateCount++;
    this.totalUpdateTime += updateTime;
    this.performanceMetrics.gpsAccuracy = accuracy;
    this.performanceMetrics.locationUpdateCount = this.updateCount;

    // Store position for movement analysis
    this.lastPositions.push({
      lat: latitude,
      lng: longitude,
      timestamp: Date.now()
    });

    // Keep only last 10 positions
    if (this.lastPositions.length > 10) {
      this.lastPositions = this.lastPositions.slice(-10);
    }
  }

  /**
   * Calculate optimal tracking interval based on battery and movement
   */
  getOptimalTrackingInterval(): { interval: number; reason: string } {
    let interval = this.settings.trackingIntervals.normal;
    let reason = 'Normal tracking';

    // Battery-based optimization
    if (this.settings.adaptiveSettings.enableBatteryOptimization) {
      if (this.batteryInfo.level <= this.settings.batteryThresholds.critical) {
        interval = this.settings.trackingIntervals.critical;
        reason = 'Critical battery level';
      } else if (this.batteryInfo.level <= this.settings.batteryThresholds.low) {
        interval = this.settings.trackingIntervals.low;
        reason = 'Low battery level';
      } else if (this.batteryInfo.charging) {
        interval = this.settings.trackingIntervals.high;
        reason = 'Device charging - high frequency';
      }
    }

    // Movement-based optimization
    if (this.settings.adaptiveSettings.enableMovementAdaptation && this.lastPositions.length >= 3) {
      const movementDistance = this.calculateRecentMovement();

      if (movementDistance < this.settings.movementThresholds.stationary) {
        // Stationary - reduce frequency
        interval = Math.max(interval, this.settings.trackingIntervals.low);
        reason += ' + stationary';
      } else if (movementDistance > this.settings.movementThresholds.normal) {
        // Fast movement - increase frequency (but respect battery)
        if (this.batteryInfo.level > this.settings.batteryThresholds.normal) {
          interval = Math.min(interval, this.settings.trackingIntervals.high);
          reason += ' + fast movement';
        }
      }
    }

    // Notify optimization listeners
    this.optimizationListeners.forEach(listener => {
      try {
        listener(interval, reason);
      } catch (error) {
        console.error('Error in optimization listener:', error);
      }
    });

    return { interval, reason };
  }

  /**
   * Calculate recent movement distance
   */
  private calculateRecentMovement(): number {
    if (this.lastPositions.length < 2) return 0;

    const recent = this.lastPositions.slice(-3); // Last 3 positions
    let totalDistance = 0;

    for (let i = 1; i < recent.length; i++) {
      const distance = this.calculateDistance(
        recent[i - 1].lat,
        recent[i - 1].lng,
        recent[i].lat,
        recent[i].lng
      );
      totalDistance += distance;
    }

    return totalDistance;
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get current battery information
   */
  getBatteryInfo(): BatteryInfo {
    return { ...this.batteryInfo };
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get optimization settings
   */
  getSettings(): OptimizationSettings {
    return { ...this.settings };
  }

  /**
   * Update optimization settings
   */
  updateSettings(newSettings: Partial<OptimizationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    log.dev('Battery optimization settings updated:', this.settings);
  }

  /**
   * Add battery status listener
   */
  addBatteryListener(listener: (info: BatteryInfo) => void): void {
    this.batteryListeners.push(listener);
  }

  /**
   * Remove battery status listener
   */
  removeBatteryListener(listener: (info: BatteryInfo) => void): void {
    const index = this.batteryListeners.indexOf(listener);
    if (index > -1) {
      this.batteryListeners.splice(index, 1);
    }
  }

  /**
   * Add performance metrics listener
   */
  addPerformanceListener(listener: (metrics: PerformanceMetrics) => void): void {
    this.performanceListeners.push(listener);
  }

  /**
   * Remove performance metrics listener
   */
  removePerformanceListener(listener: (metrics: PerformanceMetrics) => void): void {
    const index = this.performanceListeners.indexOf(listener);
    if (index > -1) {
      this.performanceListeners.splice(index, 1);
    }
  }

  /**
   * Add optimization change listener
   */
  addOptimizationListener(listener: (interval: number, reason: string) => void): void {
    this.optimizationListeners.push(listener);
  }

  /**
   * Remove optimization change listener
   */
  removeOptimizationListener(listener: (interval: number, reason: string) => void): void {
    const index = this.optimizationListeners.indexOf(listener);
    if (index > -1) {
      this.optimizationListeners.splice(index, 1);
    }
  }

  /**
   * Get battery status summary
   */
  getBatteryStatus(): {
    level: string;
    status: 'critical' | 'low' | 'normal' | 'high';
    charging: boolean;
    estimatedTime?: string;
  } {
    const level = Math.round(this.batteryInfo.level * 100);
    let status: 'critical' | 'low' | 'normal' | 'high' = 'normal';

    if (this.batteryInfo.level <= this.settings.batteryThresholds.critical) {
      status = 'critical';
    } else if (this.batteryInfo.level <= this.settings.batteryThresholds.low) {
      status = 'low';
    } else if (this.batteryInfo.level >= 0.8) {
      status = 'high';
    }

    let estimatedTime: string | undefined;
    if (this.batteryInfo.charging && this.batteryInfo.chargingTime) {
      const hours = Math.floor(this.batteryInfo.chargingTime / 3600);
      const minutes = Math.floor((this.batteryInfo.chargingTime % 3600) / 60);
      estimatedTime = `${hours}h ${minutes}m to full`;
    } else if (!this.batteryInfo.charging && this.batteryInfo.dischargingTime) {
      const hours = Math.floor(this.batteryInfo.dischargingTime / 3600);
      const minutes = Math.floor((this.batteryInfo.dischargingTime % 3600) / 60);
      estimatedTime = `${hours}h ${minutes}m remaining`;
    }

    return {
      level: `${level}%`,
      status,
      charging: this.batteryInfo.charging,
      estimatedTime
    };
  }

  /**
   * Check if battery optimization is recommended
   */
  shouldOptimize(): boolean {
    return (
      this.batteryInfo.level <= this.settings.batteryThresholds.low &&
      !this.batteryInfo.charging &&
      this.settings.adaptiveSettings.enableBatteryOptimization
    );
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.batteryInfo.level <= this.settings.batteryThresholds.critical) {
      recommendations.push('Critical battery: GPS tracking reduced to 5-minute intervals');
    } else if (this.batteryInfo.level <= this.settings.batteryThresholds.low) {
      recommendations.push('Low battery: GPS tracking reduced to 2-minute intervals');
    }

    if (this.performanceMetrics.memoryUsage > 100) {
      recommendations.push('High memory usage detected: Consider clearing old location data');
    }

    if (this.performanceMetrics.averageUpdateInterval > 60000) {
      recommendations.push('GPS updates are slow: Check location permissions and signal strength');
    }

    const recentMovement = this.calculateRecentMovement();
    if (recentMovement < this.settings.movementThresholds.stationary) {
      recommendations.push('Device appears stationary: Tracking frequency automatically reduced');
    }

    return recommendations;
  }
}
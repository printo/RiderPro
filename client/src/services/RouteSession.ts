import { GPSTracker } from './GPSTracker';
import { GPSPosition } from '@shared/types';
import { RouteSession as RouteSessionType, GPSCoordinate } from '@shared/types';
import { routeAPI } from '@/apiClient/routes';
import { log } from "../utils/logger.js";

export type SessionStatus = 'active' | 'completed' | 'paused';

export interface RouteSessionConfig {
  trackingInterval?: number;
  autoSaveInterval?: number;
  geofenceRadius?: number; // km
  enableGeofencing?: boolean;
  onLocationUpdate?: (position: GPSPosition) => void;
  onSessionStatusChange?: (status: SessionStatus) => void;
  onGeofenceDetected?: (startPosition: GPSPosition, currentPosition: GPSPosition) => void;
  onError?: (error: Error) => void;
}

export interface SessionMetrics {
  totalDistance: number;
  totalTime: number; // seconds
  averageSpeed: number; // km/h
  coordinateCount: number;
  lastUpdate: string;
}

export class RouteSession {
  private sessionId: string | null = null;
  private employeeId: string | null = null;
  private status: SessionStatus = 'completed';
  private startTime: Date | null = null;
  private endTime: Date | null = null;
  private startPosition: GPSPosition | null = null;
  private endPosition: GPSPosition | null = null;
  private gpsTracker: GPSTracker;
  private coordinates: GPSPosition[] = [];
  private config: Required<RouteSessionConfig>;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private lastSavedCoordinateIndex = 0;
  private hasLeftStartZone = false;

  constructor(config: RouteSessionConfig = {}) {
    this.config = {
      trackingInterval: 30000, // 30 seconds
      autoSaveInterval: 60000, // 1 minute
      geofenceRadius: 0.1, // 100 meters
      enableGeofencing: true,
      onLocationUpdate: () => { /* no-op */ },
      onSessionStatusChange: () => { /* no-op */ },
      onGeofenceDetected: () => { /* no-op */ },
      onError: () => { /* no-op */ },
      ...config
    };

    this.gpsTracker = new GPSTracker();
    this.gpsTracker.setTrackingInterval(this.config.trackingInterval);
  }

  /**
   * Start a new route session
   */
  async startSession(employeeId: string): Promise<RouteSessionType> {
    if (this.status === 'active') {
      throw new Error('A route session is already active');
    }

    try {
      // Get current position for session start
      const startPosition = await this.gpsTracker.getCurrentPosition();

      this.sessionId = this.generateSessionId();
      this.employeeId = employeeId;
      this.startTime = new Date();
      this.endTime = null;
      this.startPosition = startPosition;
      this.endPosition = null;
      this.coordinates = [startPosition];
      this.status = 'active';
      this.lastSavedCoordinateIndex = 0;
      this.hasLeftStartZone = false;

      // Start GPS tracking
      await this.gpsTracker.startTracking(
        this.sessionId,
        this.handleLocationUpdate.bind(this),
        this.handleGPSError.bind(this)
      );

      // Start auto-save timer
      this.startAutoSave();

      // Notify status change
      this.config.onSessionStatusChange(this.status);

      log.dev(`Route session started: ${this.sessionId} for employee: ${employeeId}`);

      return this.getSessionData();
    } catch (error) {
      this.config.onError(error as Error);
      throw error;
    }
  }

  /**
   * Stop the current route session
   */
  async stopSession(): Promise<RouteSessionType> {
    if (this.status !== 'active' && this.status !== 'paused') {
      throw new Error('No active route session to stop');
    }

    try {
      // Get current position for session end
      const endPosition = await this.gpsTracker.getCurrentPosition();

      this.endTime = new Date();
      this.endPosition = endPosition;
      this.coordinates.push(endPosition);
      this.status = 'completed';

      // Stop GPS tracking
      this.gpsTracker.stopTracking();

      // Stop auto-save timer
      this.stopAutoSave();

      // Save any remaining coordinates
      await this.saveCoordinates();

      // Notify status change
      this.config.onSessionStatusChange(this.status);

      log.dev(`Route session stopped: ${this.sessionId}`);

      return this.getSessionData();
    } catch (error) {
      this.config.onError(error as Error);
      throw error;
    }
  }

  /**
   * Pause the current route session
   */
  async pauseSession(): Promise<RouteSessionType> {
    if (this.status !== 'active') {
      throw new Error('No active route session to pause');
    }

    this.status = 'paused';
    this.gpsTracker.stopTracking();
    this.stopAutoSave();

    // Notify status change
    this.config.onSessionStatusChange(this.status);

    log.dev(`Route session paused: ${this.sessionId}`);

    return this.getSessionData();
  }

  /**
   * Resume a paused route session
   */
  async resumeSession(): Promise<RouteSessionType> {
    if (this.status !== 'paused') {
      throw new Error('No paused route session to resume');
    }

    if (!this.sessionId) {
      throw new Error('No session ID available for resume');
    }

    this.status = 'active';

    // Resume GPS tracking
    await this.gpsTracker.startTracking(
      this.sessionId,
      this.handleLocationUpdate.bind(this),
      this.handleGPSError.bind(this)
    );

    // Restart auto-save timer
    this.startAutoSave();

    // Notify status change
    this.config.onSessionStatusChange(this.status);

    log.dev(`Route session resumed: ${this.sessionId}`);

    return this.getSessionData();
  }

  /**
   * Get current session data
   */
  getSessionData(): RouteSessionType {
    return {
      id: this.sessionId || '',
      employeeId: this.employeeId || '',
      startTime: this.startTime?.toISOString() || '',
      endTime: this.endTime?.toISOString(),
      status: this.status,
      startLatitude: this.startPosition?.latitude || 0,
      startLongitude: this.startPosition?.longitude || 0,
      endLatitude: this.endPosition?.latitude,
      endLongitude: this.endPosition?.longitude,
      totalDistance: this.calculateTotalDistance(),
      createdAt: this.startTime?.toISOString() || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Get session metrics
   */
  getSessionMetrics(): SessionMetrics {
    const totalDistance = this.calculateTotalDistance();
    const totalTime = this.calculateTotalTime();
    const averageSpeed = totalTime > 0 ? (totalDistance / (totalTime / 3600)) : 0;

    return {
      totalDistance,
      totalTime,
      averageSpeed,
      coordinateCount: this.coordinates.length,
      lastUpdate: this.coordinates.length > 0
        ? this.coordinates[this.coordinates.length - 1].timestamp
        : new Date().toISOString()
    };
  }

  /**
   * Get current session status
   */
  getStatus(): SessionStatus {
    return this.status;
  }

  /**
   * Get session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Get all coordinates for the session
   */
  getCoordinates(): GPSPosition[] {
    return [...this.coordinates];
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.status === 'active';
  }

  /**
   * Handle location updates from GPS tracker
   */
  private handleLocationUpdate(position: GPSPosition): void {
    if (this.status !== 'active') {
      return;
    }

    // Add coordinate to session
    this.coordinates.push(position);

    // Check geofencing if enabled
    if (this.config.enableGeofencing && this.startPosition) {
      this.checkGeofence(position);
    }

    // Notify location update
    this.config.onLocationUpdate(position);
  }

  /**
   * Handle GPS errors
   */
  private handleGPSError(error: unknown): void {
    console.warn('GPS error in route session:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.config.onError(new Error(`GPS tracking error: ${errorMessage}`));
  }

  /**
   * Check if current position is within geofence of start position
   */
  private checkGeofence(currentPosition: GPSPosition): void {
    if (!this.startPosition) return;

    const distance = GPSTracker.calculateDistance(this.startPosition, currentPosition);

    // Initial zone exit check
    // We require the user to move at least 1.5x the geofence radius away before we arm the return detection
    if (!this.hasLeftStartZone) {
      if (distance > this.config.geofenceRadius * 1.5) {
        this.hasLeftStartZone = true;
        log.dev(`User left start zone (distance: ${distance.toFixed(3)}km). Geofence return detection armed.`);
      }
      return;
    }

    // Return detection
    if (distance <= this.config.geofenceRadius) {
      log.dev('Geofence detected: rider returned to starting position');
      this.config.onGeofenceDetected(this.startPosition, currentPosition);
      // Reset to prevent repeated alerts immediately
      this.hasLeftStartZone = false;
    }
  }

  /**
   * Calculate total distance traveled
   */
  private calculateTotalDistance(): number {
    if (this.coordinates.length < 2) {
      return 0;
    }

    let totalDistance = 0;
    for (let i = 1; i < this.coordinates.length; i++) {
      const distance = GPSTracker.calculateDistance(
        this.coordinates[i - 1],
        this.coordinates[i]
      );
      totalDistance += distance;
    }

    return totalDistance;
  }

  /**
   * Calculate total time in seconds
   */
  private calculateTotalTime(): number {
    if (!this.startTime) {
      return 0;
    }

    const endTime = this.endTime || new Date();
    return Math.floor((endTime.getTime() - this.startTime.getTime()) / 1000);
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.stopAutoSave(); // Clear any existing timer

    this.autoSaveTimer = setInterval(() => {
      this.saveCoordinates().catch((error: unknown) => {
        console.warn('Auto-save failed:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.config.onError(new Error(`Auto-save failed: ${errorMessage}`));
      });
    }, this.config.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Save coordinates to server (placeholder for API integration)
   */
  private async saveCoordinates(): Promise<void> {
    if (!this.sessionId || this.coordinates.length <= this.lastSavedCoordinateIndex) {
      return;
    }

    try {
      // Get unsaved coordinates
      const unsavedCoordinates = this.coordinates.slice(this.lastSavedCoordinateIndex);

      // Convert to API format
      const coordinatesToSave: GPSCoordinate[] = unsavedCoordinates.map(coord => ({
        sessionId: this.sessionId!,
        latitude: coord.latitude,
        longitude: coord.longitude,
        timestamp: coord.timestamp,
        accuracy: coord.accuracy,
        speed: coord.speed
      }));

      // Try to send to API
      try {
        await routeAPI.batchSubmitCoordinates(coordinatesToSave);
        log.dev(`Successfully saved ${coordinatesToSave.length} coordinates for session ${this.sessionId}`);
      } catch (apiError) {
        console.warn('API save failed, storing offline:', apiError);
        // Store in localStorage as backup when API fails
        this.saveToLocalStorage(coordinatesToSave);
      }

      // Update saved index
      this.lastSavedCoordinateIndex = this.coordinates.length;
    } catch (error) {
      console.warn('Failed to save coordinates:', error);
      throw error;
    }
  }

  /**
   * Save coordinates to localStorage as backup
   */
  private saveToLocalStorage(coordinates: GPSCoordinate[]): void {
    try {
      const key = `route_session_${this.sessionId}`;
      const existing = localStorage.getItem(key);
      const existingCoords = existing ? JSON.parse(existing) : [];

      const allCoords = [...existingCoords, ...coordinates];
      localStorage.setItem(key, JSON.stringify(allCoords));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  /**
   * Load coordinates from localStorage
   */
  private _loadFromLocalStorage(): GPSCoordinate[] {
    try {
      const key = `route_session_${this.sessionId}`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
      return [];
    }
  }

  /**
   * Clear localStorage data for session
   */
  private clearLocalStorage(): void {
    try {
      const key = `route_session_${this.sessionId}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `session_${timestamp}_${random}`;
  }

  /**
   * Cleanup session resources
   */
  cleanup(): void {
    this.gpsTracker.stopTracking();
    this.stopAutoSave();

    if (this.sessionId) {
      this.clearLocalStorage();
    }

    this.sessionId = null;
    this.employeeId = null;
    this.status = 'completed';
    this.coordinates = [];
    this.hasLeftStartZone = false;
  }

  /**
   * Get session summary for analytics
   */
  getSessionSummary(): {
    sessionId: string | null;
    employeeId: string | null;
    status: SessionStatus;
    duration: number; // seconds
    distance: number; // km
    averageSpeed: number; // km/h
    coordinateCount: number;
    startTime: string | null;
    endTime: string | null;
  } {
    const metrics = this.getSessionMetrics();

    return {
      sessionId: this.sessionId,
      employeeId: this.employeeId,
      status: this.status,
      duration: metrics.totalTime,
      distance: metrics.totalDistance,
      averageSpeed: metrics.averageSpeed,
      coordinateCount: metrics.coordinateCount,
      startTime: this.startTime?.toISOString() || null,
      endTime: this.endTime?.toISOString() || null
    };
  }
}
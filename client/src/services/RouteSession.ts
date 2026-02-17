import { GPSTracker } from './GPSTracker';
import { GPSPosition } from '@shared/types';
import { RouteSession as RouteSessionType, GPSCoordinate } from '@shared/types';
import { routeAPI } from '@/apiClient/routes';
import { log } from "../utils/logger.js";

export type SessionStatus = 'active' | 'completed' | 'paused';

export interface RouteSessionConfig {
  tracking_interval?: number;
  auto_save_interval?: number;
  geofence_radius?: number; // km
  enable_geofencing?: boolean;
  on_location_update?: (position: GPSPosition) => void;
  on_session_status_change?: (status: SessionStatus) => void;
  on_geofence_detected?: (start_position: GPSPosition, current_position: GPSPosition) => void;
  on_error?: (error: Error) => void;
}

export interface SessionMetrics {
  total_distance: number;
  total_time: number; // seconds
  average_speed: number; // km/h
  coordinate_count: number;
  last_update: string;
}

export class RouteSession {
  private session_id: string | null = null;
  private employee_id: string | null = null;
  private status: SessionStatus = 'completed';
  private start_time: Date | null = null;
  private end_time: Date | null = null;
  private start_position: GPSPosition | null = null;
  private end_position: GPSPosition | null = null;
  private gps_tracker: GPSTracker;
  private coordinates: GPSPosition[] = [];
  private config: Required<RouteSessionConfig>;
  private auto_save_timer: NodeJS.Timeout | null = null;
  private last_saved_coordinate_index = 0;
  private has_left_start_zone = false;

  constructor(config: RouteSessionConfig = {}) {
    this.config = {
      tracking_interval: 30000, // 30 seconds
      auto_save_interval: 60000, // 1 minute
      geofence_radius: 0.1, // 100 meters
      enable_geofencing: true,
      on_location_update: () => { /* no-op */ },
      on_session_status_change: () => { /* no-op */ },
      on_geofence_detected: () => { /* no-op */ },
      on_error: () => { /* no-op */ },
      ...config
    };

    this.gps_tracker = new GPSTracker();
    this.gps_tracker.setTrackingInterval(this.config.tracking_interval);
  }

  /**
   * Start a new route session
   */
  async startSession(employee_id: string): Promise<RouteSessionType> {
    if (this.status === 'active') {
      throw new Error('A route session is already active');
    }

    try {
      // Get current position for session start
      const start_position = await this.gps_tracker.getCurrentPosition();

      // Call backend API to create session in database
      try {
        const { routeAPI } = await import('@/apiClient/routes');
        const backend_session = await routeAPI.startSession({
          employee_id: employee_id,
          start_latitude: start_position.latitude,
          start_longitude: start_position.longitude
        });

        // Use session ID from backend
        this.session_id = backend_session.id;
        this.start_time = new Date(backend_session.start_time);
      } catch (apiError) {
        // Fallback to local session ID if API call fails (offline mode)
        log.dev('Failed to create session via API, using local session ID:', apiError);
        this.session_id = this.generateSessionId();
        this.start_time = new Date();
      }

      this.employee_id = employee_id;
      this.end_time = null;
      this.start_position = start_position;
      this.end_position = null;
      this.coordinates = [start_position];
      this.status = 'active';
      this.last_saved_coordinate_index = 0;
      this.has_left_start_zone = false;

      // Start GPS tracking
      await this.gps_tracker.startTracking(
        this.session_id,
        this.handleLocationUpdate.bind(this),
        this.handleGPSError.bind(this)
      );

      // Start auto-save timer
      this.startAutoSave();

      // Notify status change
      this.config.on_session_status_change(this.status);

      log.dev(`Route session started: ${this.session_id} for employee: ${employee_id}`);

      return this.getSessionData();
    } catch (error) {
      this.config.on_error(error as Error);
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
      const end_position = await this.gps_tracker.getCurrentPosition();

      this.end_time = new Date();
      this.end_position = end_position;
      this.coordinates.push(end_position);
      this.status = 'completed';

      // Stop GPS tracking
      this.gps_tracker.stopTracking();

      // Stop auto-save timer
      this.stopAutoSave();

      // Save any remaining coordinates
      await this.saveCoordinates();

      // Call backend API to stop session in database
      if (this.session_id && this.employee_id) {
        try {
          await routeAPI.stopSession({
            session_id: this.session_id,
            end_latitude: end_position.latitude,
            end_longitude: end_position.longitude
          });
        } catch (apiError) {
          // Log but don't fail if API call fails (offline mode)
          log.dev('Failed to stop session via API:', apiError);
        }
      }

      // Notify status change
      this.config.on_session_status_change(this.status);

      log.dev(`Route session stopped: ${this.session_id}`);

      return this.getSessionData();
    } catch (error) {
      this.config.on_error(error as Error);
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
    this.gps_tracker.stopTracking();
    this.stopAutoSave();

    // Notify status change
    this.config.on_session_status_change(this.status);

    log.dev(`Route session paused: ${this.session_id}`);

    return this.getSessionData();
  }

  /**
   * Resume a paused route session
   */
  async resumeSession(): Promise<RouteSessionType> {
    if (this.status !== 'paused') {
      throw new Error('No paused route session to resume');
    }

    if (!this.session_id) {
      throw new Error('No session ID available for resume');
    }

    this.status = 'active';

    // Resume GPS tracking
    await this.gps_tracker.startTracking(
      this.session_id,
      this.handleLocationUpdate.bind(this),
      this.handleGPSError.bind(this)
    );

    // Restart auto-save timer
    this.startAutoSave();

    // Notify status change
    this.config.on_session_status_change(this.status);

    log.dev(`Route session resumed: ${this.session_id}`);

    return this.getSessionData();
  }

  /**
   * Get current session data
   */
  getSessionData(): RouteSessionType {
    return {
      id: this.session_id || '',
      employee_id: this.employee_id || '',
      start_time: this.start_time?.toISOString() || '',
      end_time: this.end_time?.toISOString(),
      status: this.status,
      start_latitude: this.start_position?.latitude || 0,
      start_longitude: this.start_position?.longitude || 0,
      end_latitude: this.end_position?.latitude,
      end_longitude: this.end_position?.longitude,
      total_distance: this.calculateTotalDistance(),
      created_at: this.start_time?.toISOString() || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Get session metrics
   */
  getSessionMetrics(): SessionMetrics {
    const total_distance = this.calculateTotalDistance();
    const total_time = this.calculateTotalTime();
    const average_speed = total_time > 0 ? (total_distance / (total_time / 3600)) : 0;

    return {
      total_distance,
      total_time,
      average_speed,
      coordinate_count: this.coordinates.length,
      last_update: this.coordinates.length > 0
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
    return this.session_id;
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
    if (this.config.enable_geofencing && this.start_position) {
      this.checkGeofence(position);
    }

    // Notify location update
    this.config.on_location_update(position);
  }

  /**
   * Handle GPS errors
   */
  private handleGPSError(error: unknown): void {
    console.warn('GPS error in route session:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.config.on_error(new Error(`GPS tracking error: ${errorMessage}`));
  }

  /**
   * Check if current position is within geofence of start position
   */
  private checkGeofence(current_position: GPSPosition): void {
    if (!this.start_position) return;

    const distance = GPSTracker.calculateDistance(this.start_position, current_position);

    // Initial zone exit check
    // We require the user to move at least 1.5x the geofence radius away before we arm the return detection
    if (!this.has_left_start_zone) {
      if (distance > this.config.geofence_radius * 1.5) {
        this.has_left_start_zone = true;
        log.dev(`User left start zone (distance: ${distance.toFixed(3)}km). Geofence return detection armed.`);
      }
      return;
    }

    // Return detection
    if (distance <= this.config.geofence_radius) {
      log.dev('Geofence detected: rider returned to starting position');
      this.config.on_geofence_detected(this.start_position, current_position);
      // Reset to prevent repeated alerts immediately
      this.has_left_start_zone = false;
    }
  }

  /**
   * Calculate total distance traveled
   */
  private calculateTotalDistance(): number {
    if (this.coordinates.length < 2) {
      return 0;
    }

    let total_distance = 0;
    for (let i = 1; i < this.coordinates.length; i++) {
      const distance = GPSTracker.calculateDistance(
        this.coordinates[i - 1],
        this.coordinates[i]
      );
      total_distance += distance;
    }

    return total_distance;
  }

  /**
   * Calculate total time in seconds
   */
  private calculateTotalTime(): number {
    if (!this.start_time) {
      return 0;
    }

    const end_time = this.end_time || new Date();
    return Math.floor((end_time.getTime() - this.start_time.getTime()) / 1000);
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.stopAutoSave(); // Clear any existing timer

    this.auto_save_timer = setInterval(() => {
      this.saveCoordinates().catch((error: unknown) => {
        console.warn('Auto-save failed:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.config.on_error(new Error(`Auto-save failed: ${errorMessage}`));
      });
    }, this.config.auto_save_interval);
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.auto_save_timer) {
      clearInterval(this.auto_save_timer);
      this.auto_save_timer = null;
    }
  }

  /**
   * Save coordinates to server (placeholder for API integration)
   */
  private async saveCoordinates(): Promise<void> {
    if (!this.session_id || this.coordinates.length <= this.last_saved_coordinate_index) {
      return;
    }

    try {
      // Get unsaved coordinates
      const unsaved_coordinates = this.coordinates.slice(this.last_saved_coordinate_index);

      // Convert to API format
      const coordinates_to_save: GPSCoordinate[] = unsaved_coordinates.map(coord => ({
        session_id: this.session_id!,
        latitude: coord.latitude,
        longitude: coord.longitude,
        timestamp: coord.timestamp,
        accuracy: coord.accuracy,
        speed: coord.speed
      }));

      // Try to send to API
      try {
        await routeAPI.batchSubmitCoordinates(coordinates_to_save);
        log.dev(`Successfully saved ${coordinates_to_save.length} coordinates for session ${this.session_id}`);
      } catch (apiError) {
        console.warn('API save failed, storing offline:', apiError);
        // Store in localStorage as backup when API fails
        this.saveToLocalStorage(coordinates_to_save);
      }

      // Update saved index
      this.last_saved_coordinate_index = this.coordinates.length;
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
      const key = `route_session_${this.session_id}`;
      const existing = localStorage.getItem(key);
      const existing_coords = existing ? JSON.parse(existing) : [];

      const all_coords = [...existing_coords, ...coordinates];
      localStorage.setItem(key, JSON.stringify(all_coords));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  /**
   * Load coordinates from localStorage
   */
  private _loadFromLocalStorage(): GPSCoordinate[] {
    try {
      const key = `route_session_${this.session_id}`;
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
      const key = `route_session_${this.session_id}`;
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
    this.gps_tracker.stopTracking();
    this.stopAutoSave();

    if (this.session_id) {
      this.clearLocalStorage();
    }

    this.session_id = null;
    this.employee_id = null;
    this.status = 'completed';
    this.coordinates = [];
    this.has_left_start_zone = false;
  }

  /**
   * Get session summary for analytics
   */
  getSessionSummary(): {
    session_id: string | null;
    employee_id: string | null;
    status: SessionStatus;
    duration: number; // seconds
    distance: number; // km
    average_speed: number; // km/h
    coordinate_count: number;
    start_time: string | null;
    end_time: string | null;
  } {
    const metrics = this.getSessionMetrics();

    return {
      session_id: this.session_id,
      employee_id: this.employee_id,
      status: this.status,
      duration: metrics.total_time,
      distance: metrics.total_distance,
      average_speed: metrics.average_speed,
      coordinate_count: metrics.coordinate_count,
      start_time: this.start_time?.toISOString() || null,
      end_time: this.end_time?.toISOString() || null
    };
  }
}
import { GPSPosition } from '@shared/types';
import { log } from "../utils/logger.js";

export interface GeofenceConfig {
  center: {
    latitude: number;
    longitude: number;
  };
  radius: number; // in meters
  name?: string;
  description?: string;
}

export interface GeofenceEvent {
  type: 'enter' | 'exit';
  geofence: GeofenceConfig;
  position: GPSPosition;
  timestamp: Date;
  distance: number; // distance from center in meters
}

export interface GeofenceStatus {
  isInside: boolean;
  distance: number;
  lastEvent?: GeofenceEvent;
  entryTime?: Date;
  exitTime?: Date;
}

export class GeofencingService {
  private geofences: Map<string, GeofenceConfig> = new Map();
  private geofenceStatuses: Map<string, GeofenceStatus> = new Map();
  private eventListeners: Map<string, ((event: GeofenceEvent) => void)[]> = new Map();

  /**
   * Add a geofence to monitor
   */
  addGeofence(id: string, config: GeofenceConfig): void {
    this.geofences.set(id, config);
    this.geofenceStatuses.set(id, {
      isInside: false,
      distance: Infinity
    });

    log.dev(`Geofence added: ${id} at (${config.center.latitude}, ${config.center.longitude}) with radius ${config.radius}m`);
  }

  /**
   * Remove a geofence
   */
  removeGeofence(id: string): void {
    this.geofences.delete(id);
    this.geofenceStatuses.delete(id);
    this.eventListeners.delete(id);

    log.dev(`Geofence removed: ${id}`);
  }

  /**
   * Update position and check all geofences
   */
  updatePosition(position: GPSPosition): GeofenceEvent[] {
    const events: GeofenceEvent[] = [];

    this.geofences.forEach((geofence, id) => {
      const distance = this.calculateDistance(
        position.latitude,
        position.longitude,
        geofence.center.latitude,
        geofence.center.longitude
      );

      const currentStatus = this.geofenceStatuses.get(id)!;
      const wasInside = currentStatus.isInside;
      const isInside = distance <= geofence.radius;

      // Update status
      currentStatus.distance = distance;

      // Check for entry/exit events
      if (!wasInside && isInside) {
        // Entered geofence
        const event: GeofenceEvent = {
          type: 'enter',
          geofence,
          position,
          timestamp: new Date(),
          distance
        };

        currentStatus.isInside = true;
        currentStatus.lastEvent = event;
        currentStatus.entryTime = new Date();

        events.push(event);
        this.triggerEventListeners(id, event);

        log.dev(`Entered geofence: ${id} (distance: ${distance.toFixed(1)}m)`);

      } else if (wasInside && !isInside) {
        // Exited geofence
        const event: GeofenceEvent = {
          type: 'exit',
          geofence,
          position,
          timestamp: new Date(),
          distance
        };

        currentStatus.isInside = false;
        currentStatus.lastEvent = event;
        currentStatus.exitTime = new Date();

        events.push(event);
        this.triggerEventListeners(id, event);

        log.dev(`Exited geofence: ${id} (distance: ${distance.toFixed(1)}m)`);
      }

      this.geofenceStatuses.set(id, currentStatus);
    });

    return events;
  }

  /**
   * Get current status of a geofence
   */
  getGeofenceStatus(id: string): GeofenceStatus | null {
    return this.geofenceStatuses.get(id) || null;
  }

  /**
   * Get all geofence statuses
   */
  getAllStatuses(): Map<string, GeofenceStatus> {
    return new Map(this.geofenceStatuses);
  }

  /**
   * Check if position is inside a specific geofence
   */
  isInsideGeofence(id: string, position: GPSPosition): boolean {
    const geofence = this.geofences.get(id);
    if (!geofence) return false;

    const distance = this.calculateDistance(
      position.latitude,
      position.longitude,
      geofence.center.latitude,
      geofence.center.longitude
    );

    return distance <= geofence.radius;
  }

  /**
   * Add event listener for geofence events
   */
  addEventListener(geofenceId: string, listener: (event: GeofenceEvent) => void): void {
    if (!this.eventListeners.has(geofenceId)) {
      this.eventListeners.set(geofenceId, []);
    }
    this.eventListeners.get(geofenceId)!.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(geofenceId: string, listener: (event: GeofenceEvent) => void): void {
    const listeners = this.eventListeners.get(geofenceId);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Trigger event listeners for a geofence
   */
  private triggerEventListeners(geofenceId: string, event: GeofenceEvent): void {
    const listeners = this.eventListeners.get(geofenceId);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in geofence event listener:', error);
        }
      });
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

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
   * Create a geofence for route completion detection
   */
  createRouteCompletionGeofence(
    startPosition: GPSPosition,
    radius: number = 100,
    name: string = 'Route Completion Zone'
  ): string {
    const geofenceId = `route-completion-${Date.now()}`;

    this.addGeofence(geofenceId, {
      center: {
        latitude: startPosition.latitude,
        longitude: startPosition.longitude
      },
      radius,
      name,
      description: `Geofence for detecting return to starting position (${radius}m radius)`
    });

    return geofenceId;
  }

  /**
   * Get distance to geofence center
   */
  getDistanceToGeofence(id: string, position: GPSPosition): number | null {
    const geofence = this.geofences.get(id);
    if (!geofence) return null;

    return this.calculateDistance(
      position.latitude,
      position.longitude,
      geofence.center.latitude,
      geofence.center.longitude
    );
  }

  /**
   * Update geofence radius
   */
  updateGeofenceRadius(id: string, newRadius: number): boolean {
    const geofence = this.geofences.get(id);
    if (!geofence) return false;

    geofence.radius = newRadius;
    this.geofences.set(id, geofence);

    log.dev(`Updated geofence ${id} radius to ${newRadius}m`);
    return true;
  }

  /**
   * Clear all geofences
   */
  clearAll(): void {
    this.geofences.clear();
    this.geofenceStatuses.clear();
    this.eventListeners.clear();

    log.dev('All geofences cleared');
  }

  /**
   * Get geofence configuration
   */
  getGeofenceConfig(id: string): GeofenceConfig | null {
    return this.geofences.get(id) || null;
  }

  /**
   * Check if any geofence is currently active (position inside)
   */
  hasActiveGeofences(): boolean {
    for (const [_, status] of Array.from(this.geofenceStatuses.entries())) {
      if (status.isInside) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get list of active geofences (position inside)
   */
  getActiveGeofences(): string[] {
    const active: string[] = [];

    this.geofenceStatuses.forEach((status, id) => {
      if (status.isInside) {
        active.push(id);
      }
    });

    return active;
  }
}
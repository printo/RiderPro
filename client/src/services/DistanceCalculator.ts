import { GPSPosition } from './GPSTracker';
import { RouteTracking } from '@shared/schema';

export interface DistanceCalculationResult {
  totalDistance: number; // in kilometers
  segmentDistances: number[];
  averageSpeed: number; // km/h
  totalTime: number; // in seconds
  maxSpeed: number; // km/h
  minSpeed: number; // km/h
}

export interface RouteSegment {
  startPoint: GPSPosition | RouteTracking;
  endPoint: GPSPosition | RouteTracking;
  distance: number; // km
  duration: number; // seconds
  speed: number; // km/h
}

export class DistanceCalculator {
  private static readonly EARTH_RADIUS_KM = 6371;
  private static readonly MIN_SPEED_THRESHOLD = 0.5; // km/h - below this is considered stationary
  private static readonly MAX_REALISTIC_SPEED = 120; // km/h - above this is likely GPS error

  /**
   * Calculate distance between two GPS points using Haversine formula
   */
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS_KM * c;
  }

  /**
   * Calculate distance between two GPS positions
   */
  static calculateDistanceBetweenPositions(
    pos1: GPSPosition | RouteTracking,
    pos2: GPSPosition | RouteTracking
  ): number {
    return this.calculateDistance(
      pos1.latitude,
      pos1.longitude,
      pos2.latitude,
      pos2.longitude
    );
  }

  /**
   * Calculate comprehensive route metrics from GPS coordinates
   */
  static calculateRouteMetrics(
    coordinates: (GPSPosition | RouteTracking)[]
  ): DistanceCalculationResult {
    if (coordinates.length < 2) {
      return {
        totalDistance: 0,
        segmentDistances: [],
        averageSpeed: 0,
        totalTime: 0,
        maxSpeed: 0,
        minSpeed: 0
      };
    }

    const segments = this.calculateRouteSegments(coordinates);
    const segmentDistances = segments.map(s => s.distance);
    const totalDistance = segmentDistances.reduce((sum, dist) => sum + dist, 0);

    const startTime = new Date(coordinates[0].timestamp);
    const endTime = new Date(coordinates[coordinates.length - 1].timestamp);
    const totalTime = Math.max(1, (endTime.getTime() - startTime.getTime()) / 1000); // seconds

    const validSpeeds = segments
      .map(s => s.speed)
      .filter(speed => speed >= this.MIN_SPEED_THRESHOLD && speed <= this.MAX_REALISTIC_SPEED);

    const averageSpeed = totalTime > 0 ? (totalDistance / (totalTime / 3600)) : 0;
    const maxSpeed = validSpeeds.length > 0 ? Math.max(...validSpeeds) : 0;
    const minSpeed = validSpeeds.length > 0 ? Math.min(...validSpeeds) : 0;

    return {
      totalDistance: Math.round(totalDistance * 1000) / 1000, // Round to 3 decimal places
      segmentDistances,
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      totalTime,
      maxSpeed: Math.round(maxSpeed * 100) / 100,
      minSpeed: Math.round(minSpeed * 100) / 100
    };
  }

  /**
   * Calculate individual route segments with distance, duration, and speed
   */
  static calculateRouteSegments(
    coordinates: (GPSPosition | RouteTracking)[]
  ): RouteSegment[] {
    if (coordinates.length < 2) {
      return [];
    }

    const segments: RouteSegment[] = [];

    for (let i = 1; i < coordinates.length; i++) {
      const startPoint = coordinates[i - 1];
      const endPoint = coordinates[i];

      const distance = this.calculateDistanceBetweenPositions(startPoint, endPoint);

      const startTime = new Date(startPoint.timestamp);
      const endTime = new Date(endPoint.timestamp);
      const duration = Math.max(1, (endTime.getTime() - startTime.getTime()) / 1000); // seconds

      const speed = (distance / (duration / 3600)); // km/h

      segments.push({
        startPoint,
        endPoint,
        distance: Math.round(distance * 1000) / 1000, // Round to 3 decimal places
        duration,
        speed: Math.round(speed * 100) / 100 // Round to 2 decimal places
      });
    }

    return segments;
  }

  /**
   * Filter out GPS coordinates that are likely errors
   */
  static filterGPSErrors(
    coordinates: (GPSPosition | RouteTracking)[],
    options: {
      maxSpeed?: number;
      minAccuracy?: number;
      maxDistanceJump?: number;
    } = {}
  ): (GPSPosition | RouteTracking)[] {
    const {
      maxSpeed = this.MAX_REALISTIC_SPEED,
      minAccuracy = 100, // meters
      maxDistanceJump = 5 // km - max distance between consecutive points
    } = options;

    if (coordinates.length < 2) {
      return coordinates;
    }

    const filtered: (GPSPosition | RouteTracking)[] = [coordinates[0]];

    for (let i = 1; i < coordinates.length; i++) {
      const current = coordinates[i];
      const previous = filtered[filtered.length - 1];

      // Filter by accuracy if available
      if (current.accuracy && current.accuracy > minAccuracy) {
        continue;
      }

      // Calculate distance and speed to previous point
      const distance = this.calculateDistanceBetweenPositions(previous, current);
      const timeDiff = (new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime()) / 1000;
      const speed = timeDiff > 0 ? (distance / (timeDiff / 3600)) : 0;

      // Filter unrealistic speeds and distance jumps
      if (speed <= maxSpeed && distance <= maxDistanceJump) {
        filtered.push(current);
      }
    }

    return filtered;
  }

  /**
   * Calculate fuel consumption based on distance and efficiency
   */
  static calculateFuelConsumption(
    distance: number, // km
    fuelEfficiency: number, // km per liter
    fuelPrice?: number // price per liter
  ): { liters: number; cost?: number } {
    const liters = distance / fuelEfficiency;
    const cost = fuelPrice ? liters * fuelPrice : undefined;

    return {
      liters: Math.round(liters * 100) / 100,
      cost: cost ? Math.round(cost * 100) / 100 : undefined
    };
  }

  /**
   * Calculate route efficiency metrics
   */
  static calculateRouteEfficiency(
    actualDistance: number,
    directDistance: number,
    actualTime: number,
    estimatedTime: number
  ): {
    distanceEfficiency: number; // percentage
    timeEfficiency: number; // percentage
    detourFactor: number;
  } {
    const distanceEfficiency = directDistance > 0 ? (directDistance / actualDistance) * 100 : 0;
    const timeEfficiency = estimatedTime > 0 ? (estimatedTime / actualTime) * 100 : 0;
    const detourFactor = directDistance > 0 ? actualDistance / directDistance : 1;

    return {
      distanceEfficiency: Math.round(distanceEfficiency * 100) / 100,
      timeEfficiency: Math.round(timeEfficiency * 100) / 100,
      detourFactor: Math.round(detourFactor * 100) / 100
    };
  }

  /**
   * Group coordinates by time intervals (e.g., hourly segments)
   */
  static groupCoordinatesByTimeInterval(
    coordinates: (GPSPosition | RouteTracking)[],
    intervalMinutes: number = 60
  ): (GPSPosition | RouteTracking)[][] {
    if (coordinates.length === 0) {
      return [];
    }

    const groups: (GPSPosition | RouteTracking)[][] = [];
    let currentGroup: (GPSPosition | RouteTracking)[] = [coordinates[0]];
    let groupStartTime = new Date(coordinates[0].timestamp);

    for (let i = 1; i < coordinates.length; i++) {
      const current = coordinates[i];
      const currentTime = new Date(current.timestamp);
      const timeDiff = (currentTime.getTime() - groupStartTime.getTime()) / (1000 * 60); // minutes

      if (timeDiff >= intervalMinutes) {
        groups.push(currentGroup);
        currentGroup = [current];
        groupStartTime = currentTime;
      } else {
        currentGroup.push(current);
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Calculate direct distance between start and end points
   */
  static calculateDirectDistance(
    coordinates: (GPSPosition | RouteTracking)[]
  ): number {
    if (coordinates.length < 2) {
      return 0;
    }

    const start = coordinates[0];
    const end = coordinates[coordinates.length - 1];

    return this.calculateDistanceBetweenPositions(start, end);
  }

  /**
   * Find stationary periods in the route
   */
  static findStationaryPeriods(
    coordinates: (GPSPosition | RouteTracking)[],
    radiusMeters: number = 50,
    minDurationMinutes: number = 5
  ): Array<{
    startIndex: number;
    endIndex: number;
    duration: number; // minutes
    centerPoint: { latitude: number; longitude: number };
  }> {
    if (coordinates.length < 2) {
      return [];
    }

    const stationaryPeriods: Array<{
      startIndex: number;
      endIndex: number;
      duration: number;
      centerPoint: { latitude: number; longitude: number };
    }> = [];

    let stationaryStart = 0;
    const radiusKm = radiusMeters / 1000;

    for (let i = 1; i < coordinates.length; i++) {
      const distance = this.calculateDistanceBetweenPositions(
        coordinates[stationaryStart],
        coordinates[i]
      );

      if (distance > radiusKm) {
        // Check if we had a stationary period
        if (i - stationaryStart > 1) {
          const startTime = new Date(coordinates[stationaryStart].timestamp);
          const endTime = new Date(coordinates[i - 1].timestamp);
          const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // minutes

          if (duration >= minDurationMinutes) {
            // Calculate center point
            const stationaryCoords = coordinates.slice(stationaryStart, i);
            const centerLat = stationaryCoords.reduce((sum, coord) => sum + coord.latitude, 0) / stationaryCoords.length;
            const centerLon = stationaryCoords.reduce((sum, coord) => sum + coord.longitude, 0) / stationaryCoords.length;

            stationaryPeriods.push({
              startIndex: stationaryStart,
              endIndex: i - 1,
              duration: Math.round(duration * 100) / 100,
              centerPoint: {
                latitude: Math.round(centerLat * 1000000) / 1000000,
                longitude: Math.round(centerLon * 1000000) / 1000000
              }
            });
          }
        }
        stationaryStart = i;
      }
    }

    return stationaryPeriods;
  }

  /**
   * Convert degrees to radians
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees
   */
  private static toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  /**
   * Calculate bearing between two points
   */
  static calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const dLon = this.toRadians(lon2 - lon1);
    const lat1Rad = this.toRadians(lat1);
    const lat2Rad = this.toRadians(lat2);

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    const bearing = this.toDegrees(Math.atan2(y, x));
    return (bearing + 360) % 360; // Normalize to 0-360 degrees
  }
}
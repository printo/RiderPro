import { apiRequest } from "@/lib/queryClient";
import {
  RouteSession, StartRouteSession, StopRouteSession,
  GPSCoordinate, RouteAnalytics, RouteFilters, RouteTracking
} from "@shared/schema";
import { apiClient } from "../services/ApiClient";

export interface RouteAPIResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

export interface SessionResponse extends RouteAPIResponse {
  session: RouteSession;
}

export interface CoordinatesResponse extends RouteAPIResponse {
  coordinates: RouteTracking[];
  count: number;
}

export interface AnalyticsResponse extends RouteAPIResponse {
  analytics: RouteAnalytics[];
  count: number;
}

export interface BatchCoordinateResult {
  success: boolean;
  record?: RouteTracking;
  error?: string;
  coordinate?: GPSCoordinate;
}

export interface BatchCoordinatesResponse extends RouteAPIResponse {
  results: BatchCoordinateResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface SessionSummary {
  sessionId: string;
  employeeId: string;
  startTime: string;
  endTime: string;
  totalDistance: number;
  totalTimeSeconds: number;
  averageSpeed: number;
  coordinateCount: number;
  status: string;
}

export interface SessionSummaryResponse extends RouteAPIResponse {
  summary: SessionSummary;
}

export const routeAPI = {
  /**
   * Start a new route session
   */
  startSession: async (data: StartRouteSession): Promise<RouteSession> => {
    const response = await apiRequest("POST", "/api/routes/start", data);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Failed to start route session');
    }

    return result.session;
  },

  /**
   * Stop a route session
   */
  stopSession: async (data: StopRouteSession): Promise<RouteSession> => {
    const response = await apiRequest("POST", "/api/routes/stop", data);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Failed to stop route session');
    }

    return result.session;
  },

  /**
   * Submit GPS coordinates
   */
  submitCoordinates: async (coordinate: GPSCoordinate): Promise<RouteTracking> => {
    const response = await apiRequest("POST", "/api/routes/coordinates", coordinate);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Failed to submit GPS coordinates');
    }

    return result.record;
  },

  /**
   * Record shipment event (pickup/delivery)
   */
  recordShipmentEvent: async (
    sessionId: string,
    shipmentId: string,
    eventType: 'pickup' | 'delivery',
    latitude: number,
    longitude: number
  ): Promise<RouteTracking> => {
    const response = await apiRequest("POST", "/api/routes/shipment-event", {
      sessionId,
      shipmentId,
      eventType,
      latitude,
      longitude
    });
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Failed to record shipment event');
    }

    return result.record;
  },

  /**
   * Get active session for an employee
   */
  getActiveSession: async (employeeId: string): Promise<RouteSession | null> => {
    try {
      const response = await apiClient.get(`/api/routes/active/${employeeId}`);
      const result = await response.json();

      if (response.status === 404) {
        return null; // No active session
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to get active session');
      }

      return result.session;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get session coordinates
   */
  getSessionCoordinates: async (sessionId: string): Promise<RouteTracking[]> => {
    const response = await apiClient.get(`/api/routes/session/${sessionId}`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to get session coordinates');
    }

    return result.coordinates;
  },

  /**
   * Get route analytics
   */
  getRouteAnalytics: async (filters: RouteFilters = {}): Promise<RouteAnalytics[]> => {
    const params = new URLSearchParams();
    if (filters.employeeId) params.append('employeeId', filters.employeeId);
    if (filters.date) params.append('date', filters.date);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.sessionStatus) params.append('sessionStatus', filters.sessionStatus);

    const url = `/api/routes/analytics${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiClient.get(url);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to get route analytics');
    }

    return result.analytics;
  },

  /**
   * Get analytics (alias for getRouteAnalytics)
   */
  getAnalytics: async (filters: RouteFilters = {}): Promise<RouteAnalytics[]> => {
    return routeAPI.getRouteAnalytics(filters);
  },

  /**
   * Batch submit GPS coordinates (for offline sync)
   */
  batchSubmitCoordinates: async (coordinates: GPSCoordinate[]): Promise<BatchCoordinatesResponse> => {
    const response = await apiRequest("POST", "/api/routes/coordinates/batch", { coordinates });
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Failed to batch submit coordinates');
    }

    return result;
  },

  /**
   * Get session summary with calculated metrics
   */
  getSessionSummary: async (sessionId: string): Promise<SessionSummary> => {
    const response = await apiClient.get(`/api/routes/session/${sessionId}/summary`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to get session summary');
    }

    return result.summary;
  },

  /**
   * Sync offline coordinates
   */
  syncOfflineCoordinates: async (coordinates: GPSCoordinate[]): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }> => {
    if (coordinates.length === 0) {
      return { successful: 0, failed: 0, errors: [] };
    }

    try {
      const result = await routeAPI.batchSubmitCoordinates(coordinates);

      const errors = result.results
        .filter(r => !r.success)
        .map(r => r.error || 'Unknown error');

      return {
        successful: result.summary.successful,
        failed: result.summary.failed,
        errors
      };
    } catch (error) {
      return {
        successful: 0,
        failed: coordinates.length,
        errors: [(error as Error).message]
      };
    }
  },

  /**
   * Check if route tracking API is available
   */
  checkAPIHealth: async (): Promise<boolean> => {
    try {
      const response = await apiClient.get('/api/routes/analytics?limit=1');
      return response.ok;
    } catch (error) {
      return false;
    }
  }
};

// Helper functions for working with route data

/**
 * Calculate total distance from coordinates
 */
export function calculateTotalDistance(coordinates: RouteTracking[]): number {
  if (coordinates.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const distance = calculateDistance(
      coordinates[i - 1].latitude,
      coordinates[i - 1].longitude,
      coordinates[i].latitude,
      coordinates[i].longitude
    );
    totalDistance += distance;
  }

  return totalDistance;
}

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format duration from seconds to HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format distance with appropriate units
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Format speed with units
 */
export function formatSpeed(kmh: number): string {
  return `${kmh.toFixed(1)} km/h`;
}

/**
 * Group coordinates by date
 */
export function groupCoordinatesByDate(coordinates: RouteTracking[]): Record<string, RouteTracking[]> {
  return coordinates.reduce((groups, coord) => {
    const date = coord.date || coord.timestamp.split('T')[0];
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(coord);
    return groups;
  }, {} as Record<string, RouteTracking[]>);
}

/**
 * Filter coordinates by session
 */
export function filterCoordinatesBySession(coordinates: RouteTracking[], sessionId: string): RouteTracking[] {
  return coordinates.filter(coord => coord.sessionId === sessionId);
}

/**
 * Get unique session IDs from coordinates
 */
export function getUniqueSessionIds(coordinates: RouteTracking[]): string[] {
  const sessionIds = new Set(coordinates.map(coord => coord.sessionId));
  return Array.from(sessionIds);
}
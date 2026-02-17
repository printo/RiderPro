import { apiRequest } from "@/lib/queryClient";
import {
  RouteSession, StartRouteSession, StopRouteSession,
  GPSCoordinate, RouteAnalytics, RouteFilters, RouteTracking,
  BatchCoordinatesResponse, SessionSummary, Shipment, RouteData,
  RouteOptimizeRequest, RouteOptimizeResponse, BulkShipmentEvent
} from "@shared/types";
import { apiClient } from "../services/ApiClient";

export const routeAPI = {
  /**
   * Start a new route session
   */
  startSession: async (data: StartRouteSession): Promise<RouteSession> => {
    const response = await apiRequest("POST", "/api/v1/routes/start", data);
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
    const response = await apiRequest("POST", "/api/v1/routes/stop", data);
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
    const response = await apiRequest("POST", "/api/v1/routes/coordinates", coordinate);
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
    const response = await apiRequest("POST", "/api/v1/routes/shipment-event", {
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
      const response = await apiClient.get(`/api/v1/routes/active/${employeeId}`);
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
    const response = await apiClient.get(`/api/v1/routes/session/${sessionId}`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to get session coordinates');
    }

    return Array.isArray(result.coordinates) ? result.coordinates : [];
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

    const url = `/api/v1/routes/analytics${params.toString() ? `?${params.toString()}` : ''}`;
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
    const response = await apiRequest("POST", "/api/v1/routes/coordinates/batch", { coordinates });
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
    const response = await apiClient.get(`/api/v1/routes/session/${sessionId}/summary`);
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
   * Optimize route path
   */
  optimizePath: async (data: RouteOptimizeRequest): Promise<RouteOptimizeResponse> => {
    const response = await apiRequest("POST", "/api/v1/routes/optimize_path", data);
    return await response.json();
  },

  /**
   * Get shipments assigned to the current rider
   */
  getShipments: async (): Promise<{ success: boolean; count: number; shipments: Shipment[] }> => {
    const response = await apiRequest("GET", "/api/v1/routes/shipments");
    const result = await response.json();

    // Support both route-session payload shape and paginated DRF list shape.
    // This keeps UI stable if a proxy/middleware serves the trailing-slash variant.
    if (Array.isArray(result)) {
      return {
        success: true,
        count: result.length,
        shipments: result,
      };
    }

    if (Array.isArray(result?.results)) {
      return {
        success: true,
        count: result.count ?? result.results.length,
        shipments: result.results,
      };
    }

    return {
      success: Boolean(result?.success ?? true),
      count: result?.count ?? result?.shipments?.length ?? 0,
      shipments: Array.isArray(result?.shipments) ? result.shipments : [],
    };
  },

  /**
   * Record event for multiple shipments at once
   */
  bulkRecordShipmentEvent: async (data: BulkShipmentEvent): Promise<{ success: boolean; message: string; results: any[] }> => {
    const response = await apiRequest("POST", "/api/v1/routes/bulk_shipment_event", data);
    return await response.json();
  },

  /**
   * Get route visualization payload from session/tracking tables
   */
  getVisualizationData: async (filters: RouteFilters = {}): Promise<{
    success: boolean;
    sessions: RouteSession[];
    routeData: RouteData[];
  }> => {
    const params = new URLSearchParams();
    if (filters.employeeId) params.append('employeeId', filters.employeeId);
    if (filters.date) params.append('date', filters.date);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const url = `/api/v1/routes/visualization${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiClient.get(url);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to get route visualization data');
    }

    return result;
  },

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
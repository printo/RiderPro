import { useState, useEffect, useCallback, useRef } from 'react';
import { GeofencingService, GeofenceEvent } from '@/services/GeofencingService';
import { GPSPosition } from '@shared/types';
import { RouteCompletionData } from '@/components/routes/RouteCompletionDialog';
import { log } from "../utils/logger.js";

export interface SmartCompletionConfig {
  enabled: boolean;
  radius: number; // in meters
  minSessionDuration: number; // minimum session duration in seconds before allowing completion
  autoConfirmDelay: number; // seconds to wait before auto-confirming
  requireMinDistance: boolean; // require minimum distance traveled
  minDistanceKm: number; // minimum distance in km
  autoDeliver: boolean; // automatically mark shipments as delivered when in range
  autoDeliverRadius: number; // radius for auto-delivery in meters
}

export interface SmartCompletionState {
  isEnabled: boolean;
  geofenceId: string | null;
  isInCompletionZone: boolean;
  distanceFromStart: number;
  showCompletionDialog: boolean;
  completionData: RouteCompletionData | null;
  lastDetectionTime: Date | null;
}

interface UseSmartRouteCompletionProps {
  sessionId: string | null;
  startPosition: GPSPosition | null;
  currentPosition: GPSPosition | null;
  sessionStartTime: Date | null;
  totalDistance: number;
  shipments_completed: number;
  config?: Partial<SmartCompletionConfig>;
  onRouteCompletionDetected?: (data: RouteCompletionData) => void;
  onRouteCompleted?: () => void;
}

const DEFAULT_CONFIG: SmartCompletionConfig = {
  enabled: true,
  radius: 100, // 100 meters
  minSessionDuration: 300, // 5 minutes
  autoConfirmDelay: 30, // 30 seconds
  requireMinDistance: true,
  minDistanceKm: 0.5, // 500 meters minimum
  autoDeliver: false,
  autoDeliverRadius: 100 // 100 meters
};

const STORAGE_KEY = 'riderpro_smart_completion_config';

export function useSmartRouteCompletion({
  sessionId,
  startPosition,
  currentPosition,
  sessionStartTime,
  totalDistance,
  shipments_completed,
  config = {},
  onRouteCompletionDetected,
  onRouteCompleted
}: UseSmartRouteCompletionProps) {
  const [fullConfig, setFullConfig] = useState<SmartCompletionConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved), ...config } : { ...DEFAULT_CONFIG, ...config };
  });

  const [state, setState] = useState<SmartCompletionState>({
    isEnabled: fullConfig.enabled,
    geofenceId: null,
    isInCompletionZone: false,
    distanceFromStart: Infinity,
    showCompletionDialog: false,
    completionData: null,
    lastDetectionTime: null
  });

  const geofencingService = useRef<GeofencingService>(new GeofencingService());
  const detectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handlerRef = useRef<((event: GeofenceEvent) => void) | null>(null);

  // Track if geofence has been initialized for this session
  const geofenceInitializedRef = useRef<string | null>(null);

  // Handle geofence events
  const handleGeofenceEvent = useCallback((event: GeofenceEvent) => {
    log.dev('Geofence event:', event.type, 'Distance:', event.distance.toFixed(1) + 'm');

    if (event.type === 'enter') {
      // Check if conditions are met for route completion
      const sessionDuration = sessionStartTime
        ? Math.floor((Date.now() - sessionStartTime.getTime()) / 1000)
        : 0;

      const meetsMinDuration = sessionDuration >= fullConfig.minSessionDuration;
      const meetsMinDistance = !fullConfig.requireMinDistance || totalDistance >= fullConfig.minDistanceKm;

      if (meetsMinDuration && meetsMinDistance) {
        // Trigger route completion detection
        const completionData: RouteCompletionData = {
          session_id: sessionId!,
          start_position: startPosition!,
          current_position: event.position,
          distance_from_start: event.distance,
          geofence_radius: fullConfig.radius,
          session_duration: sessionDuration,
          total_distance: totalDistance,
          shipments_completed
        };

        setState(prev => ({
          ...prev,
          isInCompletionZone: true,
          distanceFromStart: event.distance,
          showCompletionDialog: true,
          completionData,
          lastDetectionTime: new Date()
        }));

        onRouteCompletionDetected?.(completionData);
      } else {
        log.dev('Route completion conditions not met:', {
          sessionDuration,
          meetsMinDuration,
          totalDistance,
          meetsMinDistance
        });
      }
    } else if (event.type === 'exit') {
      setState(prev => ({
        ...prev,
        isInCompletionZone: false,
        distanceFromStart: event.distance,
        showCompletionDialog: false,
        completionData: null
      }));
    }
  }, [
    sessionId,
    startPosition,
    sessionStartTime,
    totalDistance,
    shipments_completed,
    fullConfig,
    onRouteCompletionDetected
  ]);

  // Update handler ref whenever handleGeofenceEvent changes
  useEffect(() => {
    handlerRef.current = handleGeofenceEvent;
  }, [handleGeofenceEvent]);

  // Initialize geofence when session starts
  useEffect(() => {
    if (!sessionId || !startPosition || !state.isEnabled) {
      // Clean up if session ends or disabled
      if (geofenceInitializedRef.current) {
        const oldGeofenceId = state.geofenceId;
        if (oldGeofenceId) {
          geofencingService.current.removeGeofence(oldGeofenceId);
        }
        geofenceInitializedRef.current = null;
        setState(prev => ({ ...prev, geofenceId: null }));
      }
      return;
    }

    // Skip if already initialized for this session
    if (geofenceInitializedRef.current === sessionId && state.geofenceId) {
      return;
    }

    // Clear any existing geofence
    if (state.geofenceId) {
      geofencingService.current.removeGeofence(state.geofenceId);
    }

    // Create new geofence for route completion
    const geofenceId = geofencingService.current.createRouteCompletionGeofence(
      startPosition,
      fullConfig.radius,
      `Route Completion - Session ${sessionId}`
    );

    // Add event listener for geofence events
    // Use ref to avoid dependency issues
    const stableHandler = (event: GeofenceEvent) => {
      if (handlerRef.current) {
        handlerRef.current(event);
      }
    };
    geofencingService.current.addEventListener(geofenceId, stableHandler);

    setState(prev => ({
      ...prev,
      geofenceId,
      isInCompletionZone: false,
      distanceFromStart: Infinity
    }));

    geofenceInitializedRef.current = sessionId;

    log.dev(`Smart route completion initialized for session ${sessionId} with ${fullConfig.radius}m radius`);

    return () => {
      if (geofenceId) {
        geofencingService.current.removeGeofence(geofenceId);
        if (geofenceInitializedRef.current === sessionId) {
          geofenceInitializedRef.current = null;
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, startPosition?.latitude, startPosition?.longitude, state.isEnabled, fullConfig.radius]);

  // Update position and check geofences
  useEffect(() => {
    if (!currentPosition || !state.geofenceId || !state.isEnabled) {
      return;
    }

    // Update geofencing service with current position
    geofencingService.current.updatePosition(currentPosition);

    // Update distance from start (only if it changed significantly to avoid unnecessary re-renders)
    if (startPosition) {
      const distance = geofencingService.current.getDistanceToGeofence(
        state.geofenceId,
        currentPosition
      );

      if (distance !== null && Math.abs(distance - state.distanceFromStart) > 1) {
        setState(prev => ({
          ...prev,
          distanceFromStart: distance
        }));
      }
    }
  }, [currentPosition, state.geofenceId, state.isEnabled, startPosition, state.distanceFromStart]);

  // Handle route completion confirmation
  const handleRouteCompletion = useCallback(() => {
    setState(prev => ({
      ...prev,
      showCompletionDialog: false,
      completionData: null
    }));

    onRouteCompleted?.();
  }, [onRouteCompleted]);

  // Handle route completion cancellation
  const handleCompletionCancel = useCallback(() => {
    setState(prev => ({
      ...prev,
      showCompletionDialog: false,
      completionData: null
    }));

    log.dev('Route completion cancelled by user');
  }, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<SmartCompletionConfig>) => {
    setFullConfig(prev => {
      const updated = { ...prev, ...newConfig };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      // If radius changed and we have an active geofence, update it
      if (state.geofenceId && newConfig.radius && newConfig.radius !== prev.radius) {
        geofencingService.current.updateGeofenceRadius(state.geofenceId, newConfig.radius);
      }

      return updated;
    });

    // If enabled state changed
    if (newConfig.enabled !== undefined) {
      setState(prev => ({
        ...prev,
        isEnabled: newConfig.enabled!
      }));
    }

    log.dev('Smart completion config updated:', newConfig);
  }, [state.geofenceId]);

  // Enable/disable smart completion
  const setEnabled = useCallback((enabled: boolean) => {
    setState(prev => ({
      ...prev,
      isEnabled: enabled
    }));
  }, []);

  // Get current status
  const getStatus = useCallback(() => {
    if (!state.geofenceId) return null;

    return geofencingService.current.getGeofenceStatus(state.geofenceId);
  }, [state.geofenceId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }
      geofencingService.current.clearAll();
    };
  }, []);

  return {
    // State
    isEnabled: state.isEnabled,
    isInCompletionZone: state.isInCompletionZone,
    distanceFromStart: state.distanceFromStart,
    showCompletionDialog: state.showCompletionDialog,
    completionData: state.completionData,
    lastDetectionTime: state.lastDetectionTime,

    // Actions
    handleRouteCompletion,
    handleCompletionCancel,
    updateConfig,
    setEnabled,
    getStatus,

    // Configuration
    config: fullConfig
  };
}
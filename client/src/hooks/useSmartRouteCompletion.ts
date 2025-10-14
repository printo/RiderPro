import { useState, useEffect, useCallback, useRef } from 'react';
import { GeofencingService, GeofenceEvent } from '@/services/GeofencingService';
import { GPSPosition } from '@/services/GPSTracker';
import { RouteCompletionData } from '@/components/routes/RouteCompletionDialog';

export interface SmartCompletionConfig {
  enabled: boolean;
  radius: number; // in meters
  minSessionDuration: number; // minimum session duration in seconds before allowing completion
  autoConfirmDelay: number; // seconds to wait before auto-confirming
  requireMinDistance: boolean; // require minimum distance traveled
  minDistanceKm: number; // minimum distance in km
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
  shipmentsCompleted: number;
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
  minDistanceKm: 0.5 // 500 meters minimum
};

export function useSmartRouteCompletion({
  sessionId,
  startPosition,
  currentPosition,
  sessionStartTime,
  totalDistance,
  shipmentsCompleted,
  config = {},
  onRouteCompletionDetected,
  onRouteCompleted
}: UseSmartRouteCompletionProps) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

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

  // Initialize geofence when session starts
  useEffect(() => {
    if (!sessionId || !startPosition || !state.isEnabled) {
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
    geofencingService.current.addEventListener(geofenceId, handleGeofenceEvent);

    setState(prev => ({
      ...prev,
      geofenceId,
      isInCompletionZone: false,
      distanceFromStart: Infinity
    }));

    console.log(`Smart route completion initialized for session ${sessionId} with ${fullConfig.radius}m radius`);

    return () => {
      if (geofenceId) {
        geofencingService.current.removeGeofence(geofenceId);
      }
    };
  }, [sessionId, startPosition, state.isEnabled, fullConfig.radius]);

  // Handle geofence events
  const handleGeofenceEvent = useCallback((event: GeofenceEvent) => {
    console.log('Geofence event:', event.type, 'Distance:', event.distance.toFixed(1) + 'm');

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
          sessionId: sessionId!,
          startPosition: startPosition!,
          currentPosition: event.position,
          distanceFromStart: event.distance,
          geofenceRadius: fullConfig.radius,
          sessionDuration,
          totalDistance,
          shipmentsCompleted
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
        console.log('Route completion conditions not met:', {
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
    shipmentsCompleted,
    fullConfig,
    onRouteCompletionDetected
  ]);

  // Update position and check geofences
  useEffect(() => {
    if (!currentPosition || !state.geofenceId || !state.isEnabled) {
      return;
    }

    // Update geofencing service with current position
    geofencingService.current.updatePosition(currentPosition);

    // Update distance from start
    if (startPosition) {
      const distance = geofencingService.current.getDistanceToGeofence(
        state.geofenceId,
        currentPosition
      );

      if (distance !== null) {
        setState(prev => ({
          ...prev,
          distanceFromStart: distance
        }));
      }
    }
  }, [currentPosition, state.geofenceId, state.isEnabled, startPosition]);

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

    console.log('Route completion cancelled by user');
  }, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<SmartCompletionConfig>) => {
    const updatedConfig = { ...fullConfig, ...newConfig };

    // If radius changed and we have an active geofence, update it
    if (state.geofenceId && newConfig.radius && newConfig.radius !== fullConfig.radius) {
      geofencingService.current.updateGeofenceRadius(state.geofenceId, newConfig.radius);
    }

    // If enabled state changed
    if (newConfig.enabled !== undefined) {
      setState(prev => ({
        ...prev,
        isEnabled: newConfig.enabled!
      }));
    }

    console.log('Smart completion config updated:', updatedConfig);
  }, [fullConfig, state.geofenceId]);

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
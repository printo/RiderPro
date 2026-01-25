import { useState, useEffect, useCallback, useRef } from 'react';
import { RouteSession, SessionStatus, RouteSessionConfig, SessionMetrics } from '../services/RouteSession';
import { GPSPosition } from '@shared/types';
import { RouteSession as RouteSessionType } from '@shared/types';

export interface RouteSessionState {
  session: RouteSessionType | null;
  status: SessionStatus;
  metrics: SessionMetrics | null;
  isLoading: boolean;
  error: string | null;
  coordinates: GPSPosition[];
  showGeofenceDialog: boolean;
}

export interface UseRouteSessionOptions extends RouteSessionConfig {
  employeeId?: string;
  autoStart?: boolean;
  onSessionComplete?: (session: RouteSessionType) => void;
}

export function useRouteSession(options: UseRouteSessionOptions = {}) {
  const {
    employeeId,
    autoStart = false,
    onSessionComplete,
    ...sessionConfig
  } = options;

  const [state, setState] = useState<RouteSessionState>({
    session: null,
    status: 'completed',
    metrics: null,
    isLoading: false,
    error: null,
    coordinates: [],
    showGeofenceDialog: false
  });

  const routeSessionRef = useRef<RouteSession | null>(null);
  const metricsUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize route session
  useEffect(() => {
    const config: RouteSessionConfig = {
      ...sessionConfig,
      onLocationUpdate: (position: GPSPosition) => {
        setState(prev => ({
          ...prev,
          coordinates: [...prev.coordinates, position]
        }));
        sessionConfig.onLocationUpdate?.(position);
      },
      onSessionStatusChange: (status: SessionStatus) => {
        setState(prev => ({ ...prev, status }));

        if (status === 'completed' && routeSessionRef.current) {
          const sessionData = routeSessionRef.current.getSessionData();
          onSessionComplete?.(sessionData);
        }

        sessionConfig.onSessionStatusChange?.(status);
      },
      onGeofenceDetected: (startPosition: GPSPosition, currentPosition: GPSPosition) => {
        // Show confirmation dialog for returning to start
        setState(prev => ({ ...prev, showGeofenceDialog: true }));
        sessionConfig.onGeofenceDetected?.(startPosition, currentPosition);
      },
      onError: (error: Error) => {
        setState(prev => ({ ...prev, error: error.message, isLoading: false }));
        sessionConfig.onError?.(error);
      }
    };

    routeSessionRef.current = new RouteSession(config);

    // Auto-start if requested and employeeId is provided
    if (autoStart && employeeId) {
      startSession(employeeId);
    }

    return () => {
      if (routeSessionRef.current) {
        routeSessionRef.current.cleanup();
      }
      stopMetricsUpdate();
    };
  }, []);

  // Update metrics periodically
  const startMetricsUpdate = useCallback(() => {
    stopMetricsUpdate();

    metricsUpdateInterval.current = setInterval(() => {
      if (routeSessionRef.current && routeSessionRef.current.isActive()) {
        const metrics = routeSessionRef.current.getSessionMetrics();
        setState(prev => ({ ...prev, metrics }));
      }
    }, 10000); // Update every 10 seconds
  }, []);

  const stopMetricsUpdate = useCallback(() => {
    if (metricsUpdateInterval.current) {
      clearInterval(metricsUpdateInterval.current);
      metricsUpdateInterval.current = null;
    }
  }, []);

  // Start a new route session
  const startSession = useCallback(async (empId?: string): Promise<RouteSessionType> => {
    if (!routeSessionRef.current) {
      throw new Error('Route session not initialized');
    }

    const targetEmployeeId = empId || employeeId;
    if (!targetEmployeeId) {
      throw new Error('Employee ID is required to start a session');
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      coordinates: []
    }));

    try {
      const session = await routeSessionRef.current.startSession(targetEmployeeId);

      setState(prev => ({
        ...prev,
        session,
        status: session.status as SessionStatus,
        isLoading: false,
        error: null
      }));

      startMetricsUpdate();
      return session;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }));
      throw error;
    }
  }, [employeeId, startMetricsUpdate]);

  // Stop the current route session
  const stopSession = useCallback(async (): Promise<RouteSessionType> => {
    if (!routeSessionRef.current) {
      throw new Error('Route session not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const session = await routeSessionRef.current.stopSession();

      setState(prev => ({
        ...prev,
        session,
        status: session.status as SessionStatus,
        isLoading: false,
        error: null
      }));

      stopMetricsUpdate();
      return session;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }));
      throw error;
    }
  }, [stopMetricsUpdate]);

  // Pause the current route session
  const pauseSession = useCallback(async (): Promise<RouteSessionType> => {
    if (!routeSessionRef.current) {
      throw new Error('Route session not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const session = await routeSessionRef.current.pauseSession();

      setState(prev => ({
        ...prev,
        session,
        status: session.status as SessionStatus,
        isLoading: false,
        error: null
      }));

      stopMetricsUpdate();
      return session;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }));
      throw error;
    }
  }, [stopMetricsUpdate]);

  // Resume a paused route session
  const resumeSession = useCallback(async (): Promise<RouteSessionType> => {
    if (!routeSessionRef.current) {
      throw new Error('Route session not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const session = await routeSessionRef.current.resumeSession();

      setState(prev => ({
        ...prev,
        session,
        status: session.status as SessionStatus,
        isLoading: false,
        error: null
      }));

      startMetricsUpdate();
      return session;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }));
      throw error;
    }
  }, [startMetricsUpdate]);

  // Get current session summary
  const getSessionSummary = useCallback(() => {
    if (!routeSessionRef.current) {
      return null;
    }
    return routeSessionRef.current.getSessionSummary();
  }, []);

  // Clear session error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Handle geofence confirmation actions
  const confirmGeofenceStop = useCallback(async () => {
    setState(prev => ({ ...prev, showGeofenceDialog: false }));
    try {
      await stopSession();
    } catch (error) {
      console.error('Failed to stop session from geofence:', error);
    }
  }, [stopSession]);

  const cancelGeofenceStop = useCallback(() => {
    setState(prev => ({ ...prev, showGeofenceDialog: false }));
  }, []);

  // Check if session can be started
  const canStartSession = useCallback((): boolean => {
    return state.status === 'completed' && !state.isLoading && !!employeeId;
  }, [state.status, state.isLoading, employeeId]);

  // Check if session can be stopped
  const canStopSession = useCallback((): boolean => {
    return (state.status === 'active' || state.status === 'paused') && !state.isLoading;
  }, [state.status, state.isLoading]);

  // Check if session can be paused
  const canPauseSession = useCallback((): boolean => {
    return state.status === 'active' && !state.isLoading;
  }, [state.status, state.isLoading]);

  // Check if session can be resumed
  const canResumeSession = useCallback((): boolean => {
    return state.status === 'paused' && !state.isLoading;
  }, [state.status, state.isLoading]);

  // Get formatted session duration
  const getFormattedDuration = useCallback((): string => {
    if (!state.metrics) {
      return '00:00:00';
    }

    const totalSeconds = state.metrics.totalTime;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [state.metrics]);

  // Get formatted distance
  const getFormattedDistance = useCallback((): string => {
    if (!state.metrics) {
      return '0.0 km';
    }

    return `${state.metrics.totalDistance.toFixed(1)} km`;
  }, [state.metrics]);

  // Get formatted average speed
  const getFormattedSpeed = useCallback((): string => {
    if (!state.metrics) {
      return '0.0 km/h';
    }

    return `${state.metrics.averageSpeed.toFixed(1)} km/h`;
  }, [state.metrics]);

  return {
    // State
    ...state,

    // Actions
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    clearError,

    // Utilities
    getSessionSummary,
    canStartSession,
    canStopSession,
    canPauseSession,
    canResumeSession,

    // Formatted data
    getFormattedDuration,
    getFormattedDistance,
    getFormattedSpeed,

    // Geofence Actions
    confirmGeofenceStop,
    cancelGeofenceStop
  };
}
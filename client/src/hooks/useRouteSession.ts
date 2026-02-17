import { useState, useEffect, useCallback, useRef } from 'react';
import { RouteSession, SessionStatus, RouteSessionConfig, SessionMetrics } from '../services/RouteSession';
import { GPSPosition } from '@shared/types';
import { RouteSession as RouteSessionType } from '@shared/types';

export interface RouteSessionState {
  session: RouteSessionType | null;
  status: SessionStatus;
  metrics: SessionMetrics | null;
  is_loading: boolean;
  error: string | null;
  coordinates: GPSPosition[];
  show_geofence_dialog: boolean;
}

export interface UseRouteSessionOptions extends RouteSessionConfig {
  employee_id?: string;
  auto_start?: boolean;
  on_session_complete?: (session: RouteSessionType) => void;
}

export function useRouteSession(options: UseRouteSessionOptions = {}) {
  const {
    employee_id,
    auto_start = false,
    on_session_complete,
    ...session_config
  } = options;

  const [state, set_state] = useState<RouteSessionState>({
    session: null,
    status: 'completed',
    metrics: null,
    is_loading: false,
    error: null,
    coordinates: [],
    show_geofence_dialog: false
  });

  const route_session_ref = useRef<RouteSession | null>(null);
  const metrics_update_interval = useRef<NodeJS.Timeout | null>(null);

  // Initialize route session
  useEffect(() => {
    const config: RouteSessionConfig = {
      ...session_config,
      onLocationUpdate: (position: GPSPosition) => {
        set_state(prev => ({
          ...prev,
          coordinates: [...prev.coordinates, position]
        }));
        session_config.onLocationUpdate?.(position);
      },
      onSessionStatusChange: (status: SessionStatus) => {
        set_state(prev => ({ ...prev, status }));

        if (status === 'completed' && route_session_ref.current) {
          const session_data = route_session_ref.current.getSessionData();
          on_session_complete?.(session_data);
        }

        session_config.onSessionStatusChange?.(status);
      },
      onGeofenceDetected: (start_position: GPSPosition, current_position: GPSPosition) => {
        // Show confirmation dialog for returning to start
        set_state(prev => ({ ...prev, show_geofence_dialog: true }));
        session_config.onGeofenceDetected?.(start_position, current_position);
      },
      onError: (error: Error) => {
        set_state(prev => ({ ...prev, error: error.message, is_loading: false }));
        session_config.onError?.(error);
      }
    };

    route_session_ref.current = new RouteSession(config);

    // Auto-start if requested and employee_id is provided
    if (auto_start && employee_id) {
      startSession(employee_id);
    }

    return () => {
      if (route_session_ref.current) {
        route_session_ref.current.cleanup();
      }
      stopMetricsUpdate();
    };
  }, []);

  // Update metrics periodically
  const startMetricsUpdate = useCallback(() => {
    stopMetricsUpdate();

    metrics_update_interval.current = setInterval(() => {
      if (route_session_ref.current && route_session_ref.current.isActive()) {
        const metrics = route_session_ref.current.getSessionMetrics();
        set_state(prev => ({ ...prev, metrics }));
      }
    }, 10000); // Update every 10 seconds
  }, []);

  const stopMetricsUpdate = useCallback(() => {
    if (metrics_update_interval.current) {
      clearInterval(metrics_update_interval.current);
      metrics_update_interval.current = null;
    }
  }, []);

  // Start a new route session
  const startSession = useCallback(async (empId?: string): Promise<RouteSessionType> => {
    if (!route_session_ref.current) {
      throw new Error('Route session not initialized');
    }

    const target_employee_id = empId || employee_id;
    if (!target_employee_id) {
      throw new Error('Employee ID is required to start a session');
    }

    set_state(prev => ({
      ...prev,
      is_loading: true,
      error: null,
      coordinates: []
    }));

    try {
      const session = await route_session_ref.current.startSession(target_employee_id);

      set_state(prev => ({
        ...prev,
        session,
        status: session.status as SessionStatus,
        is_loading: false,
        error: null
      }));

      startMetricsUpdate();
      return session;
    } catch (error) {
      set_state(prev => ({
        ...prev,
        is_loading: false,
        error: (error as Error).message
      }));
      throw error;
    }
  }, [employee_id, startMetricsUpdate]);

  // Stop the current route session
  const stopSession = useCallback(async (): Promise<RouteSessionType> => {
    if (!route_session_ref.current) {
      throw new Error('Route session not initialized');
    }

    set_state(prev => ({ ...prev, is_loading: true, error: null }));

    try {
      const session = await route_session_ref.current.stopSession();

      set_state(prev => ({
        ...prev,
        session,
        status: session.status as SessionStatus,
        is_loading: false,
        error: null
      }));

      stopMetricsUpdate();
      return session;
    } catch (error) {
      set_state(prev => ({
        ...prev,
        is_loading: false,
        error: (error as Error).message
      }));
      throw error;
    }
  }, [stopMetricsUpdate]);

  // Pause the current route session
  const pauseSession = useCallback(async (): Promise<RouteSessionType> => {
    if (!route_session_ref.current) {
      throw new Error('Route session not initialized');
    }

    set_state(prev => ({ ...prev, is_loading: true, error: null }));

    try {
      const session = await route_session_ref.current.pauseSession();

      set_state(prev => ({
        ...prev,
        session,
        status: session.status as SessionStatus,
        is_loading: false,
        error: null
      }));

      stopMetricsUpdate();
      return session;
    } catch (error) {
      set_state(prev => ({
        ...prev,
        is_loading: false,
        error: (error as Error).message
      }));
      throw error;
    }
  }, [stopMetricsUpdate]);

  // Resume a paused route session
  const resumeSession = useCallback(async (): Promise<RouteSessionType> => {
    if (!route_session_ref.current) {
      throw new Error('Route session not initialized');
    }

    set_state(prev => ({ ...prev, is_loading: true, error: null }));

    try {
      const session = await route_session_ref.current.resumeSession();

      set_state(prev => ({
        ...prev,
        session,
        status: session.status as SessionStatus,
        is_loading: false,
        error: null
      }));

      startMetricsUpdate();
      return session;
    } catch (error) {
      set_state(prev => ({
        ...prev,
        is_loading: false,
        error: (error as Error).message
      }));
      throw error;
    }
  }, [startMetricsUpdate]);

  // Get current session summary
  const getSessionSummary = useCallback(() => {
    if (!route_session_ref.current) {
      return null;
    }
    return route_session_ref.current.getSessionSummary();
  }, []);

  // Clear session error
  const clearError = useCallback(() => {
    set_state(prev => ({ ...prev, error: null }));
  }, []);

  // Handle geofence confirmation actions
  const confirmGeofenceStop = useCallback(async () => {
    set_state(prev => ({ ...prev, show_geofence_dialog: false }));
    try {
      await stopSession();
    } catch (error) {
      console.error('Failed to stop session from geofence:', error);
    }
  }, [stopSession]);

  const cancelGeofenceStop = useCallback(() => {
    set_state(prev => ({ ...prev, show_geofence_dialog: false }));
  }, []);

  // Check if session can be started
  const canStartSession = useCallback((): boolean => {
    return state.status === 'completed' && !state.is_loading && !!employee_id;
  }, [state.status, state.is_loading, employee_id]);

  // Check if session can be stopped
  const canStopSession = useCallback((): boolean => {
    return (state.status === 'active' || state.status === 'paused') && !state.is_loading;
  }, [state.status, state.is_loading]);

  // Check if session can be paused
  const canPauseSession = useCallback((): boolean => {
    return state.status === 'active' && !state.is_loading;
  }, [state.status, state.is_loading]);

  // Check if session can be resumed
  const canResumeSession = useCallback((): boolean => {
    return state.status === 'paused' && !state.is_loading;
  }, [state.status, state.is_loading]);

  // Get formatted session duration
  const getFormattedDuration = useCallback((): string => {
    if (!state.metrics) {
      return '00:00:00';
    }

    const total_seconds = state.metrics.total_time;
    const hours = Math.floor(total_seconds / 3600);
    const minutes = Math.floor((total_seconds % 3600) / 60);
    const seconds = total_seconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [state.metrics]);

  // Get formatted distance
  const getFormattedDistance = useCallback((): string => {
    if (!state.metrics) {
      return '0.0 km';
    }

    return `${state.metrics.total_distance.toFixed(1)} km`;
  }, [state.metrics]);

  // Get formatted average speed
  const getFormattedSpeed = useCallback((): string => {
    if (!state.metrics) {
      return '0.0 km/h';
    }

    return `${state.metrics.average_speed.toFixed(1)} km/h`;
  }, [state.metrics]);

  return {
    // State
    ...state,
    isLoading: state.is_loading,
    showGeofenceDialog: state.show_geofence_dialog,

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
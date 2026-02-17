import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  StartRouteSession, StopRouteSession, GPSCoordinate,
  RouteFilters, RouteSession
} from '@shared/types';
import { routeAPI } from '@/apiClient/routes';

// Query keys for React Query
export const routeQueryKeys = {
  all: ['routes'] as const,
  sessions: () => [...routeQueryKeys.all, 'sessions'] as const,
  session: (id: string) => [...routeQueryKeys.sessions(), id] as const,
  active_session: (employee_id: string) => [...routeQueryKeys.sessions(), 'active', employee_id] as const,
  coordinates: () => [...routeQueryKeys.all, 'coordinates'] as const,
  session_coordinates: (session_id: string) => [...routeQueryKeys.coordinates(), session_id] as const,
  analytics: () => [...routeQueryKeys.all, 'analytics'] as const,
  analytics_filtered: (filters: RouteFilters) => [...routeQueryKeys.analytics(), filters] as const,
  summary: (session_id: string) => [...routeQueryKeys.all, 'summary', session_id] as const,
};

/**
 * Hook for managing route sessions
 */
export function useRouteSessions() {
  const queryClient = useQueryClient();

  const startSessionMutation = useMutation({
    mutationFn: (data: StartRouteSession) => routeAPI.startSession(data),
    onSuccess: (session: RouteSession) => {
      // Invalidate active session queries
      queryClient.invalidateQueries({ queryKey: routeQueryKeys.active_session(session.employee_id) });
      queryClient.invalidateQueries({ queryKey: routeQueryKeys.sessions() });
    },
  });

  const stopSessionMutation = useMutation({
    mutationFn: (data: StopRouteSession) => routeAPI.stopSession(data),
    onSuccess: (session: RouteSession) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: routeQueryKeys.active_session(session.employee_id) });
      queryClient.invalidateQueries({ queryKey: routeQueryKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: routeQueryKeys.analytics() });
    },
  });

  return {
    startSession: startSessionMutation.mutateAsync,
    stopSession: stopSessionMutation.mutateAsync,
    isStarting: startSessionMutation.isPending,
    isstopping: stopSessionMutation.isPending,
    startError: startSessionMutation.error,
    stopError: stopSessionMutation.error,
  };
}

/**
 * Hook for getting active session
 */
export function useActiveSession(employee_id: string, enabled = true) {
  return useQuery({
    queryKey: routeQueryKeys.active_session(employee_id),
    queryFn: () => routeAPI.getActiveSession(employee_id),
    enabled: enabled && !!employee_id,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: (failureCount, error) => {
      // Don't retry if it's a 404 (no active session)
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * Hook for managing GPS coordinates
 */
export function useGPSCoordinates() {
  const queryClient = useQueryClient();

  const submitCoordinateMutation = useMutation({
    mutationFn: (coordinate: GPSCoordinate) => routeAPI.submitCoordinates(coordinate),
    onSuccess: (_, variables) => {
      // Invalidate session coordinates
      if (variables.session_id) {
        queryClient.invalidateQueries({
          queryKey: routeQueryKeys.session_coordinates(variables.session_id)
        });
      }
    },
  });

  const batchSubmitMutation = useMutation({
    mutationFn: (coordinates: GPSCoordinate[]) => routeAPI.batchSubmitCoordinates(coordinates),
    onSuccess: (_, variables) => {
      // Invalidate all coordinate queries for affected sessions
      const session_ids = Array.from(new Set(variables.map(c => c.session_id).filter(Boolean)));
      session_ids.forEach(session_id => {
        if (session_id) {
          queryClient.invalidateQueries({
            queryKey: routeQueryKeys.session_coordinates(session_id)
          });
        }
      });
    },
  });

  const recordShipmentEventMutation = useMutation({
    mutationFn: ({
      session_id,
      shipment_id,
      event_type,
      latitude,
      longitude
    }: {
      session_id: string;
      shipment_id: string;
      event_type: 'pickup' | 'delivery';
      latitude: number;
      longitude: number;
    }) => routeAPI.recordShipmentEvent(session_id, shipment_id, event_type, latitude, longitude),
    onSuccess: (_, variables) => {
      // Invalidate session coordinates
      queryClient.invalidateQueries({
        queryKey: routeQueryKeys.session_coordinates(variables.session_id)
      });
    },
  });

  return {
    submitCoordinate: submitCoordinateMutation.mutateAsync,
    batchSubmitCoordinates: batchSubmitMutation.mutateAsync,
    recordShipmentEvent: recordShipmentEventMutation.mutateAsync,
    isSubmitting: submitCoordinateMutation.isPending,
    isBatchSubmitting: batchSubmitMutation.isPending,
    isRecordingEvent: recordShipmentEventMutation.isPending,
    submitError: submitCoordinateMutation.error,
    batchError: batchSubmitMutation.error,
    eventError: recordShipmentEventMutation.error,
  };
}

/**
 * Hook for getting session coordinates
 */
export function useSessionCoordinates(session_id: string, enabled = true) {
  return useQuery({
    queryKey: routeQueryKeys.session_coordinates(session_id),
    queryFn: () => routeAPI.getSessionCoordinates(session_id),
    enabled: enabled && !!session_id,
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Hook for route analytics
 */
export function useRouteAnalytics(filters: RouteFilters = {}, enabled = true) {
  return useQuery({
    queryKey: routeQueryKeys.analytics_filtered(filters),
    queryFn: () => routeAPI.getRouteAnalytics(filters),
    enabled,
    refetchInterval: 300000, // Refetch every 5 minutes
  });
}

/**
 * Hook for session summary
 */
export function useSessionSummary(session_id: string, enabled = true) {
  return useQuery({
    queryKey: routeQueryKeys.summary(session_id),
    queryFn: () => routeAPI.getSessionSummary(session_id),
    enabled: enabled && !!session_id,
  });
}

/**
 * Hook for offline coordinate synchronization
 */
export function useOfflineSync() {
  const [syncStatus, setSyncStatus] = useState<{
    issyncing: boolean;
    last_sync: Date | null;
    pending_count: number;
  }>({
    issyncing: false,
    last_sync: null,
    pending_count: 0
  });

  const sync_offline_coordinates = useCallback(async (coordinates: GPSCoordinate[]) => {
    if (coordinates.length === 0) {
      return { successful: 0, failed: 0, errors: [] };
    }

    setSyncStatus(prev => ({ ...prev, issyncing: true }));

    try {
      const result = await routeAPI.syncOfflineCoordinates(coordinates);

      setSyncStatus(prev => ({
        ...prev,
        issyncing: false,
        last_sync: new Date(),
        pending_count: Math.max(0, prev.pending_count - result.successful)
      }));

      return result;
    } catch (error) {
      setSyncStatus(prev => ({ ...prev, issyncing: false }));
      throw error;
    }
  }, []);

  const update_pending_count = useCallback((count: number) => {
    setSyncStatus(prev => ({ ...prev, pending_count: count }));
  }, []);

  return {
    syncOfflineCoordinates: sync_offline_coordinates,
    updatePendingCount: update_pending_count,
    ...syncStatus
  };
}


/**
 * Combined hook for complete route tracking functionality
 */
export function useRouteTracking(employee_id: string) {
  const { data: activeSession, isLoading: isLoadingSession } = useActiveSession(employee_id);
  const { startSession, stopSession, isStarting, isstopping } = useRouteSessions();
  const { submitCoordinate, recordShipmentEvent, isSubmitting } = useGPSCoordinates();
  const { syncOfflineCoordinates, issyncing, pending_count } = useOfflineSync();

  const sessionCoordinates = useSessionCoordinates(
    activeSession?.id || '',
    !!activeSession?.id
  );

  const handleStartSession = useCallback(async (latitude: number, longitude: number) => {
    return await startSession({ employee_id, start_latitude: latitude, start_longitude: longitude });
  }, [employee_id, startSession]);

  const handleStopSession = useCallback(async (latitude: number, longitude: number) => {
    if (!activeSession?.id) {
      throw new Error('No active session to stop');
    }
    return await stopSession({ session_id: activeSession.id, end_latitude: latitude, end_longitude: longitude });
  }, [activeSession?.id, stopSession]);

  const handleSubmitCoordinate = useCallback(async (coordinate: Omit<GPSCoordinate, 'session_id'>) => {
    if (!activeSession?.id) {
      throw new Error('No active session for coordinate submission');
    }
    return await submitCoordinate({ ...coordinate, session_id: activeSession.id });
  }, [activeSession?.id, submitCoordinate]);

  const handleRecordShipmentEvent = useCallback(async (
    shipment_id: string,
    event_type: 'pickup' | 'delivery',
    latitude: number,
    longitude: number
  ) => {
    if (!activeSession?.id) {
      throw new Error('No active session for shipment event');
    }
    return await recordShipmentEvent({
      session_id: activeSession.id,
      shipment_id,
      event_type,
      latitude,
      longitude
    });
  }, [activeSession?.id, recordShipmentEvent]);

  return {
    // Session data
    activeSession,
    coordinates: sessionCoordinates.data || [],

    // Loading states
    isLoadingSession,
    isLoadingCoordinates: sessionCoordinates.isLoading,
    isStarting,
    isstopping,
    isSubmitting,
    issyncing,

    // Actions
    startSession: handleStartSession,
    stopSession: handleStopSession,
    submitCoordinate: handleSubmitCoordinate,
    recordShipmentEvent: handleRecordShipmentEvent,
    syncOfflineCoordinates,

    // Status
    hasActiveSession: !!activeSession,
    pending_count,

    // Refetch functions
    refetchSession: () => sessionCoordinates.refetch(),
    refetchCoordinates: () => sessionCoordinates.refetch(),
  };
}
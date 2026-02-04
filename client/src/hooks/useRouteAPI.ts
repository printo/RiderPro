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
  activeSession: (employeeId: string) => [...routeQueryKeys.sessions(), 'active', employeeId] as const,
  coordinates: () => [...routeQueryKeys.all, 'coordinates'] as const,
  sessionCoordinates: (sessionId: string) => [...routeQueryKeys.coordinates(), sessionId] as const,
  analytics: () => [...routeQueryKeys.all, 'analytics'] as const,
  analyticsFiltered: (filters: RouteFilters) => [...routeQueryKeys.analytics(), filters] as const,
  summary: (sessionId: string) => [...routeQueryKeys.all, 'summary', sessionId] as const,
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
      queryClient.invalidateQueries({ queryKey: routeQueryKeys.activeSession(session.employeeId) });
      queryClient.invalidateQueries({ queryKey: routeQueryKeys.sessions() });
    },
  });

  const stopSessionMutation = useMutation({
    mutationFn: (data: StopRouteSession) => routeAPI.stopSession(data),
    onSuccess: (session: RouteSession) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: routeQueryKeys.activeSession(session.employeeId) });
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
export function useActiveSession(employeeId: string, enabled = true) {
  return useQuery({
    queryKey: routeQueryKeys.activeSession(employeeId),
    queryFn: () => routeAPI.getActiveSession(employeeId),
    enabled: enabled && !!employeeId,
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
      if (variables.sessionId) {
        queryClient.invalidateQueries({
          queryKey: routeQueryKeys.sessionCoordinates(variables.sessionId)
        });
      }
    },
  });

  const batchSubmitMutation = useMutation({
    mutationFn: (coordinates: GPSCoordinate[]) => routeAPI.batchSubmitCoordinates(coordinates),
    onSuccess: (_, variables) => {
      // Invalidate all coordinate queries for affected sessions
      const sessionIds = Array.from(new Set(variables.map(c => c.sessionId).filter(Boolean)));
      sessionIds.forEach(sessionId => {
        if (sessionId) {
          queryClient.invalidateQueries({
            queryKey: routeQueryKeys.sessionCoordinates(sessionId)
          });
        }
      });
    },
  });

  const recordShipmentEventMutation = useMutation({
    mutationFn: ({
      sessionId,
      shipmentId,
      eventType,
      latitude,
      longitude
    }: {
      sessionId: string;
      shipmentId: string;
      eventType: 'pickup' | 'delivery';
      latitude: number;
      longitude: number;
    }) => routeAPI.recordShipmentEvent(sessionId, shipmentId, eventType, latitude, longitude),
    onSuccess: (_, variables) => {
      // Invalidate session coordinates
      queryClient.invalidateQueries({
        queryKey: routeQueryKeys.sessionCoordinates(variables.sessionId)
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
export function useSessionCoordinates(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: routeQueryKeys.sessionCoordinates(sessionId),
    queryFn: () => routeAPI.getSessionCoordinates(sessionId),
    enabled: enabled && !!sessionId,
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Hook for route analytics
 */
export function useRouteAnalytics(filters: RouteFilters = {}, enabled = true) {
  return useQuery({
    queryKey: routeQueryKeys.analyticsFiltered(filters),
    queryFn: () => routeAPI.getRouteAnalytics(filters),
    enabled,
    refetchInterval: 300000, // Refetch every 5 minutes
  });
}

/**
 * Hook for session summary
 */
export function useSessionSummary(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: routeQueryKeys.summary(sessionId),
    queryFn: () => routeAPI.getSessionSummary(sessionId),
    enabled: enabled && !!sessionId,
  });
}

/**
 * Hook for offline coordinate synchronization
 */
export function useOfflineSync() {
  const [syncStatus, setSyncStatus] = useState<{
    issyncing: boolean;
    lastSync: Date | null;
    pendingCount: number;
  }>({
    issyncing: false,
    lastSync: null,
    pendingCount: 0
  });

  const syncOfflineCoordinates = useCallback(async (coordinates: GPSCoordinate[]) => {
    if (coordinates.length === 0) {
      return { successful: 0, failed: 0, errors: [] };
    }

    setSyncStatus(prev => ({ ...prev, issyncing: true }));

    try {
      const result = await routeAPI.syncOfflineCoordinates(coordinates);

      setSyncStatus(prev => ({
        ...prev,
        issyncing: false,
        lastSync: new Date(),
        pendingCount: Math.max(0, prev.pendingCount - result.successful)
      }));

      return result;
    } catch (error) {
      setSyncStatus(prev => ({ ...prev, issyncing: false }));
      throw error;
    }
  }, []);

  const updatePendingCount = useCallback((count: number) => {
    setSyncStatus(prev => ({ ...prev, pendingCount: count }));
  }, []);

  return {
    syncOfflineCoordinates,
    updatePendingCount,
    ...syncStatus
  };
}


/**
 * Combined hook for complete route tracking functionality
 */
export function useRouteTracking(employeeId: string) {
  const { data: activeSession, isLoading: isLoadingSession } = useActiveSession(employeeId);
  const { startSession, stopSession, isStarting, isstopping } = useRouteSessions();
  const { submitCoordinate, recordShipmentEvent, isSubmitting } = useGPSCoordinates();
  const { syncOfflineCoordinates, issyncing, pendingCount } = useOfflineSync();

  const sessionCoordinates = useSessionCoordinates(
    activeSession?.id || '',
    !!activeSession?.id
  );

  const handleStartSession = useCallback(async (latitude: number, longitude: number) => {
    return await startSession({ employeeId, latitude, longitude });
  }, [employeeId, startSession]);

  const handleStopSession = useCallback(async (latitude: number, longitude: number) => {
    if (!activeSession?.id) {
      throw new Error('No active session to stop');
    }
    return await stopSession({ sessionId: activeSession.id, latitude, longitude });
  }, [activeSession?.id, stopSession]);

  const handleSubmitCoordinate = useCallback(async (coordinate: Omit<GPSCoordinate, 'sessionId'>) => {
    if (!activeSession?.id) {
      throw new Error('No active session for coordinate submission');
    }
    return await submitCoordinate({ ...coordinate, sessionId: activeSession.id });
  }, [activeSession?.id, submitCoordinate]);

  const handleRecordShipmentEvent = useCallback(async (
    shipmentId: string,
    eventType: 'pickup' | 'delivery',
    latitude: number,
    longitude: number
  ) => {
    if (!activeSession?.id) {
      throw new Error('No active session for shipment event');
    }
    return await recordShipmentEvent({
      sessionId: activeSession.id,
      shipmentId,
      eventType,
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
    pendingCount,

    // Refetch functions
    refetchSession: () => sessionCoordinates.refetch(),
    refetchCoordinates: () => sessionCoordinates.refetch(),
  };
}
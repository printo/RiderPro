import { useState, useEffect, useCallback, useRef } from 'react';
import { GPSTracker, GPSPosition, GPSError, GPSPermissionStatus } from '../services/GPSTracker';
import { GPSErrorRecoveryService } from '../services/GPSErrorRecoveryService';
import { ErrorHandlingService } from '../services/ErrorHandlingService';

export interface GPSTrackingState {
  isTracking: boolean;
  isSupported: boolean;
  permission: GPSPermissionStatus;
  currentPosition: GPSPosition | null;
  sessionId: string | null;
  error: GPSError | null;
  isLoading: boolean;
}

export interface UseGPSTrackingOptions {
  trackingInterval?: number;
  enableOfflineStorage?: boolean;
  showNotifications?: boolean;
  onLocationUpdate?: (position: GPSPosition) => void;
  onError?: (error: GPSError) => void;
  onPermissionDenied?: () => void;
}

export function useGPSTracking(options: UseGPSTrackingOptions = {}) {
  const {
    trackingInterval = 30000,
    enableOfflineStorage = true,
    showNotifications = true,
    onLocationUpdate,
    onError,
    onPermissionDenied
  } = options;

  const [state, setState] = useState<GPSTrackingState>({
    isTracking: false,
    isSupported: false,
    permission: 'unknown',
    currentPosition: null,
    sessionId: null,
    error: null,
    isLoading: false
  });

  const gpsTrackerRef = useRef<GPSTracker | null>(null);
  const errorHandlerRef = useRef<GPSErrorRecoveryService | null>(null);
  const errorServiceRef = useRef<ErrorHandlingService | null>(null);

  // Initialize GPS tracker and error handler
  useEffect(() => {
    gpsTrackerRef.current = new GPSTracker();
    gpsTrackerRef.current.setTrackingInterval(trackingInterval);

    errorServiceRef.current = new ErrorHandlingService({
      enableLogging: true,
      enableRemoteLogging: false
    });

    errorHandlerRef.current = new GPSErrorRecoveryService(errorServiceRef.current, {
      maxRetryAttempts: 3,
      retryDelayMs: 5000
    });

    // Set up recovery listeners for notifications
    if (showNotifications) {
      errorHandlerRef.current.addRecoveryListener((recoveryState) => {
        if (recoveryState.isRecovering) {
          // Could show recovery notification here
          console.log('GPS recovery in progress...');
        }
      });
    }

    // Check initial support and permission
    checkGPSAvailability();

    return () => {
      if (gpsTrackerRef.current) {
        gpsTrackerRef.current.stopTracking();
      }
    };
  }, []);

  // Check GPS availability
  const checkGPSAvailability = useCallback(async () => {
    if (!gpsTrackerRef.current) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const isSupported = gpsTrackerRef.current.isSupported();
      let permission: GPSPermissionStatus = 'unknown';

      if (isSupported) {
        permission = await gpsTrackerRef.current.checkPermission();
      }

      setState(prev => ({
        ...prev,
        isSupported,
        permission,
        isLoading: false,
        error: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as GPSError
      }));
    }
  }, []);

  // Handle location updates
  const handleLocationUpdate = useCallback((position?: GPSPosition) => {
    if (position) {
      setState(prev => ({
        ...prev,
        currentPosition: position,
        error: null
      }));
      onLocationUpdate?.(position);
    }
  }, [onLocationUpdate]);

  // Handle GPS errors using the recovery service
  const handleGPSError = useCallback(async (error: GPSError) => {
    if (errorHandlerRef.current) {
      try {
        // Attempt recovery using the advanced recovery service
        const recoveredPosition = await errorHandlerRef.current.handleGPSError(error, state.sessionId || undefined);

        if (recoveredPosition) {
          // Recovery successful
          handleLocationUpdate(recoveredPosition);
          return;
        }
      } catch (recoveryError) {
        console.warn('GPS recovery failed:', recoveryError);
      }
    }

    // Handle specific error types for user feedback
    switch (error.code) {
      case 1: // PERMISSION_DENIED
        setState(prev => ({ ...prev, permission: 'denied', error }));
        onPermissionDenied?.();
        break;
      case 2: // POSITION_UNAVAILABLE
      case 3: // TIMEOUT
        setState(prev => ({ ...prev, error }));
        break;
      default:
        setState(prev => ({ ...prev, error }));
    }

    onError?.(error);
  }, [state.sessionId, handleLocationUpdate, onError, onPermissionDenied]);

  // Request GPS permission
  const requestPermission = useCallback(async (): Promise<GPSPosition> => {
    if (!gpsTrackerRef.current) {
      throw new Error('GPS tracker not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const position = await gpsTrackerRef.current.requestPermission();

      setState(prev => ({
        ...prev,
        permission: 'granted',
        currentPosition: position,
        isLoading: false,
        error: null
      }));

      return position;
    } catch (error) {
      const gpsError = error as GPSError;

      setState(prev => ({
        ...prev,
        permission: gpsError.code === 1 ? 'denied' : prev.permission,
        isLoading: false,
        error: gpsError
      }));

      await handleGPSError(gpsError);
      throw error;
    }
  }, [handleGPSError]);

  // Start GPS tracking
  const startTracking = useCallback(async (sessionId: string): Promise<void> => {
    if (!gpsTrackerRef.current) {
      throw new Error('GPS tracker not initialized');
    }

    if (state.isTracking) {
      throw new Error('GPS tracking is already active');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request permission if not granted
      if (state.permission !== 'granted') {
        await requestPermission();
      }

      await gpsTrackerRef.current.startTracking(
        sessionId,
        handleLocationUpdate,
        handleGPSError
      );

      setState(prev => ({
        ...prev,
        isTracking: true,
        sessionId,
        isLoading: false,
        error: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as GPSError
      }));
      throw error;
    }
  }, [state.isTracking, state.permission, requestPermission, handleLocationUpdate, handleGPSError]);

  // Stop GPS tracking
  const stopTracking = useCallback(() => {
    if (gpsTrackerRef.current) {
      gpsTrackerRef.current.stopTracking();
    }

    setState(prev => ({
      ...prev,
      isTracking: false,
      sessionId: null,
      error: null
    }));
  }, []);

  // Get current position once
  const getCurrentPosition = useCallback(async (): Promise<GPSPosition> => {
    if (!gpsTrackerRef.current) {
      throw new Error('GPS tracker not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const position = await gpsTrackerRef.current.getCurrentPosition();

      setState(prev => ({
        ...prev,
        currentPosition: position,
        isLoading: false,
        error: null
      }));

      return position;
    } catch (error) {
      const gpsError = error as GPSError;

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: gpsError
      }));

      await handleGPSError(gpsError);
      throw error;
    }
  }, [handleGPSError]);

  // Get offline coordinates
  const getOfflineCoordinates = useCallback(() => {
    if (!gpsTrackerRef.current || !enableOfflineStorage) {
      return [];
    }
    return gpsTrackerRef.current.getOfflineCoordinates();
  }, [enableOfflineStorage]);

  // Clear offline coordinates
  const clearOfflineCoordinates = useCallback(() => {
    if (gpsTrackerRef.current && enableOfflineStorage) {
      gpsTrackerRef.current.clearOfflineCoordinates();
    }
  }, [enableOfflineStorage]);

  // Check if position is within radius of another position
  const isWithinRadius = useCallback((
    position1: GPSPosition,
    position2: GPSPosition,
    radiusKm: number
  ): boolean => {
    return GPSTracker.isWithinRadius(position1, position2, radiusKm);
  }, []);

  // Calculate distance between positions
  const calculateDistance = useCallback((
    position1: GPSPosition,
    position2: GPSPosition
  ): number => {
    return GPSTracker.calculateDistance(position1, position2);
  }, []);

  return {
    // State
    ...state,

    // Actions
    requestPermission,
    startTracking,
    stopTracking,
    getCurrentPosition,
    checkGPSAvailability,

    // Offline storage
    getOfflineCoordinates,
    clearOfflineCoordinates,

    // Utilities
    isWithinRadius,
    calculateDistance
  };
}
import { useState, useEffect, useRef, useCallback } from 'react';
import { RiderLocation } from '@/components/tracking/LiveTrackingMap';
import { log } from "../utils/logger.js";

interface LocationUpdate {
  type: 'location_update';
  employee_id: string;
  session_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
}

interface SessionStatusChange {
  type: 'session_status_change';
  employee_id: string;
  session_id: string;
  status: string;
  timestamp: string;
}

interface ActiveSessionsMessage {
  type: 'active_sessions';
  sessions: Array<{
    employee_id: string;
    session_id: string;
    start_time: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    accuracy?: number;
    speed?: number;
  }>;
}

type WebSocketMessage = LocationUpdate | SessionStatusChange | ActiveSessionsMessage;

interface UseLiveTrackingOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useLiveTracking(options: UseLiveTrackingOptions = {}) {
  const {
    autoConnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10
  } = options;

  const [riders, setRiders] = useState<Map<string, RiderLocation>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Determine rider status based on last update time
  const getRiderStatus = useCallback((timestamp: string): 'active' | 'idle' | 'offline' => {
    const now = new Date();
    const lastUpdate = new Date(timestamp);
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);

    if (diffMinutes < 2) return 'active';
    if (diffMinutes < 10) return 'idle';
    return 'offline';
  }, []);

  // Fetch active riders from REST API
  const fetchActiveRiders = useCallback(async () => {
    try {
      setConnectionStatus('connecting');

      const response = await fetch('/api/v1/routes/active-riders', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch active riders: ${response.statusText}`);
      }

      const data = await response.json();

      setRiders(prev => {
        const newRiders = new Map();

        // Transform API response to RiderLocation format
        if (data.locations && Array.isArray(data.locations)) {
          data.locations.forEach((loc: {
            employee_id: string;
            session_id: string;
            latitude: number;
            longitude: number;
            timestamp: string;
            accuracy?: number;
            speed?: number;
            start_time?: string;
          }) => {
            const existingRider = prev.get(loc.employee_id);

            const rider: RiderLocation = {
              employee_id: loc.employee_id,
              session_id: loc.session_id,
              latitude: loc.latitude,
              longitude: loc.longitude,
              timestamp: loc.timestamp,
              accuracy: loc.accuracy,
              speed: loc.speed,
              status: getRiderStatus(loc.timestamp),
              employee_name: existingRider?.employee_name,
              route: existingRider?.route || [{ lat: loc.latitude, lng: loc.longitude }]
            };

            // Add to route history (keep last 50 points)
            if (existingRider?.route) {
              const lastPoint = existingRider.route[existingRider.route.length - 1];
              // Only add if position changed
              if (lastPoint.lat !== loc.latitude || lastPoint.lng !== loc.longitude) {
                rider.route = [
                  ...existingRider.route.slice(-49),
                  { lat: loc.latitude, lng: loc.longitude }
                ];
              }
            }

            newRiders.set(loc.employee_id, rider);
          });
        }

        return newRiders;
      });

      setConnectionStatus('connected');
      setError(null);
      reconnectAttemptsRef.current = 0;

    } catch (error) {
      console.error('Error fetching active riders:', error);
      setConnectionStatus('error');
      setError(error instanceof Error ? error.message : 'Failed to fetch rider locations');

      // Retry logic
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        log.dev(`Retrying fetch (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
      }
    }
  }, [getRiderStatus, maxReconnectAttempts]);

  // Connect (start polling)
  const connect = useCallback(() => {
    setConnectionStatus('connecting');
    setError(null);

    // Initial fetch
    fetchActiveRiders();
  }, [fetchActiveRiders]);

  // Disconnect (stop polling)
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionStatus('disconnected');
    setRiders(new Map());
  }, []);

  // Subscribe to specific employee (no-op for polling, kept for API compatibility)
  const subscribeToEmployee = useCallback((employee_id: string) => {
    log.dev(`Subscribe to employee ${employee_id} (polling mode - no action needed)`);
  }, []);

  // Unsubscribe from specific employee (no-op for polling, kept for API compatibility)
  const unsubscribeFromEmployee = useCallback((employee_id: string) => {
    log.dev(`Unsubscribe from employee ${employee_id} (polling mode - no action needed)`);
  }, []);

  // Auto-connect and start polling on mount
  useEffect(() => {
    if (!autoConnect) return;

    // Start polling
    const pollInterval = setInterval(() => {
      if (connectionStatus !== 'disconnected') {
        fetchActiveRiders();
      }
    }, reconnectInterval);

    // Initial connection
    connect();

    return () => {
      clearInterval(pollInterval);
      disconnect();
    };
  }, [autoConnect, connect, disconnect, fetchActiveRiders, reconnectInterval, connectionStatus]);

  // Update rider statuses periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setRiders(prev => {
        const newRiders = new Map();
        let hasChanges = false;

        prev.forEach((rider, employee_id) => {
          const newStatus = getRiderStatus(rider.timestamp);
          if (newStatus !== rider.status) {
            hasChanges = true;
          }

          newRiders.set(employee_id, {
            ...rider,
            status: newStatus
          });
        });

        return hasChanges ? newRiders : prev;
      });
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [getRiderStatus]);

  return {
    riders: Array.from(riders.values()),
    connectionStatus,
    error,
    connect,
    disconnect,
    subscribeToEmployee,
    unsubscribeFromEmployee,
    isConnected: connectionStatus === 'connected'
  };
}
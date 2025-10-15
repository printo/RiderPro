import { useState, useEffect, useRef, useCallback } from 'react';
import { RiderLocation } from '@/components/tracking/LiveTrackingMap';

interface LocationUpdate {
  type: 'location_update';
  employeeId: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
}

interface SessionStatusChange {
  type: 'session_status_change';
  employeeId: string;
  sessionId: string;
  status: string;
  timestamp: string;
}

interface ActiveSessionsMessage {
  type: 'active_sessions';
  sessions: Array<{
    employeeId: string;
    sessionId: string;
    startTime: string;
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

  // Get WebSocket URL
  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/tracking`;
  }, []);

  // Determine rider status based on last update time
  const getRiderStatus = useCallback((timestamp: string): 'active' | 'idle' | 'offline' => {
    const now = new Date();
    const lastUpdate = new Date(timestamp);
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);

    if (diffMinutes < 2) return 'active';
    if (diffMinutes < 10) return 'idle';
    return 'offline';
  }, []);

  // Handle WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'location_update':
          setRiders(prev => {
            const newRiders = new Map(prev);
            const existingRider = newRiders.get(message.employeeId);

            const updatedRider: RiderLocation = {
              employeeId: message.employeeId,
              sessionId: message.sessionId,
              latitude: message.latitude,
              longitude: message.longitude,
              timestamp: message.timestamp,
              accuracy: message.accuracy,
              speed: message.speed,
              status: getRiderStatus(message.timestamp),
              employeeName: existingRider?.employeeName,
              route: existingRider?.route || []
            };

            // Add to route history (keep last 50 points)
            if (existingRider?.route) {
              updatedRider.route = [
                ...existingRider.route.slice(-49),
                { lat: message.latitude, lng: message.longitude }
              ];
            } else {
              updatedRider.route = [{ lat: message.latitude, lng: message.longitude }];
            }

            newRiders.set(message.employeeId, updatedRider);
            return newRiders;
          });
          break;

        case 'session_status_change':
          setRiders(prev => {
            const newRiders = new Map(prev);
            const rider = newRiders.get(message.employeeId);

            if (rider) {
              if (message.status === 'completed') {
                // Remove rider when session is completed
                newRiders.delete(message.employeeId);
              } else {
                // Update rider status
                newRiders.set(message.employeeId, {
                  ...rider,
                  status: message.status as 'active' | 'idle' | 'offline'
                });
              }
            }

            return newRiders;
          });
          break;

        case 'active_sessions':
          setRiders(prev => {
            const newRiders = new Map();

            message.sessions.forEach(session => {
              const existingRider = prev.get(session.employeeId);

              const rider: RiderLocation = {
                employeeId: session.employeeId,
                sessionId: session.sessionId,
                latitude: session.latitude,
                longitude: session.longitude,
                timestamp: session.timestamp,
                accuracy: session.accuracy,
                speed: session.speed,
                status: getRiderStatus(session.timestamp),
                employeeName: existingRider?.employeeName,
                route: existingRider?.route || [{ lat: session.latitude, lng: session.longitude }]
              };

              newRiders.set(session.employeeId, rider);
            });

            return newRiders;
          });
          break;

        default:
          console.warn('Unknown WebSocket message type:', message);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, [getRiderStatus]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    setError(null);

    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected for live tracking');
        setConnectionStatus('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Subscribe to all active tracking
        ws.send(JSON.stringify({
          type: 'subscribe_tracking'
        }));
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setConnectionStatus('disconnected');
        wsRef.current = null;

        // Attempt to reconnect if not a clean close
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
        setError('Connection error occurred');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
      setError('Failed to connect to live tracking');
    }
  }, [getWebSocketUrl, handleMessage, maxReconnectAttempts, reconnectInterval]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }

    setConnectionStatus('disconnected');
    setRiders(new Map());
  }, []);

  // Subscribe to specific employee
  const subscribeToEmployee = useCallback((employeeId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe_tracking',
        employeeId
      }));
    }
  }, []);

  // Unsubscribe from specific employee
  const unsubscribeFromEmployee = useCallback((employeeId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe_tracking',
        employeeId
      }));
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Update rider statuses periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setRiders(prev => {
        const newRiders = new Map();
        let hasChanges = false;

        prev.forEach((rider, employeeId) => {
          const newStatus = getRiderStatus(rider.timestamp);
          if (newStatus !== rider.status) {
            hasChanges = true;
          }

          newRiders.set(employeeId, {
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
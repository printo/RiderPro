import React, { useState, useEffect, useRef } from 'react';
import { GPSTracker, GPSPosition } from '../services/GPSTracker';
import { ErrorHandlingService } from '../services/ErrorHandlingService';
import '../styles/mobile.css';

interface MobileGPSTrackerProps {
  onLocationUpdate?: (position: GPSPosition) => void;
  onError?: (error: any) => void;
  className?: string;
}

interface TrackingState {
  isTracking: boolean;
  isPaused: boolean;
  sessionId: string | null;
  currentPosition: GPSPosition | null;
  distance: number;
  duration: number;
  accuracy: number;
}

export const MobileGPSTracker: React.FC<MobileGPSTrackerProps> = ({
  onLocationUpdate,
  onError,
  className = '',
}) => {
  const [trackingState, setTrackingState] = useState<TrackingState>({
    isTracking: false,
    isPaused: false,
    sessionId: null,
    currentPosition: null,
    distance: 0,
    duration: 0,
    accuracy: 0,
  });

  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [vibrationSupported, setVibrationSupported] = useState(false);

  const gpsTrackerRef = useRef<GPSTracker | null>(null);
  const errorHandlerRef = useRef<ErrorHandlingService | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // ------------------------------
  // Initialization
  // ------------------------------
  useEffect(() => {
    gpsTrackerRef.current = new GPSTracker(
      true, // enableOfflineStorage
      true, // enableBatteryOptimization
      true, // enableAccuracyFiltering
      true  // enableAdaptiveTracking
    );

    errorHandlerRef.current = new ErrorHandlingService({
      enableLogging: true,
      enableRemoteLogging: false,
      maxLocalLogs: 50,
      enableAutoRecovery: true,
      enableUserNotifications: true,
    });

    setVibrationSupported('vibrate' in navigator);

    return () => {
      gpsTrackerRef.current?.stopTracking();
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, []);

  // ------------------------------
  // Permissions
  // ------------------------------
  useEffect(() => {
    const checkPermission = async () => {
      if (gpsTrackerRef.current) {
        const status = await gpsTrackerRef.current.checkPermission();
        setPermissionStatus(status);
      }
    };
    checkPermission();
  }, []);

  // ------------------------------
  // Battery Monitoring
  // ------------------------------
  useEffect(() => {
    const updateBatteryInfo = async () => {
      if ('getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          setBatteryLevel(battery.level);

          battery.addEventListener('levelchange', () => {
            setBatteryLevel(battery.level);
          });
        } catch {
          console.log('Battery API not supported');
        }
      }
    };
    updateBatteryInfo();
  }, []);

  // ------------------------------
  // Online/Offline Monitoring
  // ------------------------------
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ------------------------------
  // Duration Timer
  // ------------------------------
  useEffect(() => {
    if (trackingState.isTracking && !trackingState.isPaused && startTimeRef.current) {
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
        setTrackingState((prev) => ({ ...prev, duration: elapsed }));
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }

    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [trackingState.isTracking, trackingState.isPaused]);

  // ------------------------------
  // Event Handlers
  // ------------------------------
  const handleLocationUpdate = (position: GPSPosition) => {
    setTrackingState((prev) => ({
      ...prev,
      currentPosition: position,
      accuracy: position.accuracy || 0,
    }));

    onLocationUpdate?.(position);

    if (vibrationSupported) navigator.vibrate(50);
  };

  const handleError = (error: any) => {
    errorHandlerRef.current?.logError(
      'gps',
      `GPS tracking error: ${error.message}`,
      error,
      error.stack,
      trackingState.sessionId || undefined
    );

    onError?.(error);

    if (vibrationSupported) navigator.vibrate([100, 50, 100]);
  };

  const requestPermission = async () => {
    if (gpsTrackerRef.current) {
      const granted = await gpsTrackerRef.current.requestPermission();
      setPermissionStatus(granted ? 'granted' : 'denied');
      return granted;
    }
    return false;
  };

  const startTracking = async () => {
    if (!gpsTrackerRef.current) return;

    if (permissionStatus !== 'granted') {
      const granted = await requestPermission();
      if (!granted) {
        alert('GPS permission is required for route tracking');
        return;
      }
    }

    const sessionId = `mobile-session-${Date.now()}`;
    try {
      await gpsTrackerRef.current.startTracking(sessionId, handleLocationUpdate, handleError);
      startTimeRef.current = Date.now();
      setTrackingState((prev) => ({
        ...prev,
        isTracking: true,
        isPaused: false,
        sessionId,
        distance: 0,
        duration: 0,
      }));

      if (vibrationSupported) navigator.vibrate(200);
    } catch (error) {
      console.error('Failed to start tracking:', error);
      alert('Failed to start GPS tracking');
    }
  };

  const pauseTracking = () => {
    setTrackingState((prev) => ({ ...prev, isPaused: !prev.isPaused }));
    if (vibrationSupported) navigator.vibrate(100);
  };

  const stopTracking = () => {
    gpsTrackerRef.current?.stopTracking();
    startTimeRef.current = null;

    setTrackingState({
      isTracking: false,
      isPaused: false,
      sessionId: null,
      currentPosition: null,
      distance: 0,
      duration: 0,
      accuracy: 0,
    });

    if (vibrationSupported) navigator.vibrate([100, 50, 100, 50, 100]);
  };

  const handleTouchStart = (e: React.TouchEvent, action: string) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

    if (action === 'stop') {
      longPressTimerRef.current = setTimeout(() => {
        setShowConfirmDialog(true);
        if (vibrationSupported) navigator.vibrate(300);
      }, 1000);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, action: string) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    const deltaTime = Date.now() - touchStartRef.current.time;

    if (deltaX < 10 && deltaY < 10 && deltaTime < 500) {
      switch (action) {
        case 'start':
          startTracking();
          break;
        case 'pause':
          pauseTracking();
          break;
        case 'stop':
          setShowConfirmDialog(true);
          break;
      }
    }

    touchStartRef.current = null;
  };

  // ------------------------------
  // Helpers
  // ------------------------------
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const getStatusText = (): string => {
    if (!trackingState.isTracking) return 'Stopped';
    if (trackingState.isPaused) return 'Paused';
    return 'Active';
  };

  // ------------------------------
  // Render
  // ------------------------------
  if (permissionStatus === 'denied') {
    return (
      <div className={`gps-tracking-container ${className}`}>
        <div className="error-message">
          <h3>GPS Permission Required</h3>
          <p>Please enable location access in your browser settings to use route tracking.</p>
          <button onClick={requestPermission} className="tracking-button start">
            Request Permission
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`gps-tracking-container ${className}`}>
      {/* Status Display */}
      <div className="tracking-status">
        <div className="status-row">
          <span
            className={`status-indicator ${trackingState.isTracking ? (trackingState.isPaused ? 'paused' : 'active') : 'stopped'
              }`}
          />
          <span className="status-text">{getStatusText()}</span>
          {!isOnline && <span className="offline-indicator">📶 Offline</span>}
        </div>

        {batteryLevel !== null && batteryLevel < 0.2 && (
          <div className="battery-warning">🔋 Low battery - GPS tracking may be reduced</div>
        )}
      </div>

      {/* Tracking Metrics */}
      <div className="tracking-metrics">
        <div className="metric-card">
          <div className="metric-value">{formatDuration(trackingState.duration)}</div>
          <div className="metric-label">Duration</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{formatDistance(trackingState.distance)}</div>
          <div className="metric-label">Distance</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">
            {trackingState.accuracy > 0 ? `${Math.round(trackingState.accuracy)}m` : '--'}
          </div>
          <div className="metric-label">Accuracy</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">
            {trackingState.currentPosition?.speed
              ? `${Math.round(trackingState.currentPosition.speed * 3.6)}`
              : '--'}
          </div>
          <div className="metric-label">Speed (km/h)</div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="tracking-controls">
        {!trackingState.isTracking ? (
          <button
            className="tracking-button start"
            onTouchStart={(e) => handleTouchStart(e, 'start')}
            onTouchEnd={(e) => handleTouchEnd(e, 'start')}
            disabled={permissionStatus === 'unknown'}
          >
            🚀 Start Tracking
          </button>
        ) : (
          <>
            <button
              className="tracking-button pause"
              onTouchStart={(e) => handleTouchStart(e, 'pause')}
              onTouchEnd={(e) => handleTouchEnd(e, 'pause')}
            >
              {trackingState.isPaused ? '▶️ Resume' : '⏸️ Pause'}
            </button>
            <button
              className="tracking-button stop"
              onTouchStart={(e) => handleTouchStart(e, 'stop')}
              onTouchEnd={(e) => handleTouchEnd(e, 'stop')}
            >
              ⏹️ Stop Tracking
            </button>
          </>
        )}
      </div>

      {/* Current Location Display */}
      {trackingState.currentPosition && (
        <div className="location-display">
          <h4>Current Location</h4>
          <div className="coordinates">
            <div>Lat: {trackingState.currentPosition.latitude.toFixed(6)}</div>
            <div>Lng: {trackingState.currentPosition.longitude.toFixed(6)}</div>
            <div className="timestamp">
              {new Date(trackingState.currentPosition.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="modal-overlay" onClick={() => setShowConfirmDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Stop Tracking?</h3>
            <p>Are you sure you want to stop GPS tracking? This will end the current route session.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowConfirmDialog(false)}>
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  stopTracking();
                  setShowConfirmDialog(false);
                }}
              >
                Stop Tracking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileGPSTracker;

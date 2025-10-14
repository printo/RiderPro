import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { withComponentErrorBoundary } from '@/components/ErrorBoundary';
import {
  Navigation,
  MapPin,
  Clock,
  Battery,
  Wifi,
  WifiOff,
  Play,
  Pause,
  Square,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface MobileGPSTrackerProps {
  onLocationUpdate?: (location: { latitude: number; longitude: number; accuracy: number }) => void;
  onTrackingStart?: () => void;
  onTrackingStop?: () => void;
  isTracking?: boolean;
  currentLocation?: { latitude: number; longitude: number; accuracy: number };
  batteryLevel?: number;
  isOnline?: boolean;
}

export const MobileGPSTracker: React.FC<MobileGPSTrackerProps> = ({
  onLocationUpdate,
  onTrackingStart,
  onTrackingStop,
  isTracking = false,
  currentLocation,
  batteryLevel = 100,
  isOnline = true
}) => {
  const [watchId, setWatchId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trackingDuration, setTrackingDuration] = useState(0);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const startTimeRef = useRef<Date | null>(null);
  const lastLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate distance between two coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Start GPS tracking
  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setError(null);
    startTimeRef.current = new Date();
    setTrackingDuration(0);
    setDistance(0);
    setSpeed(0);

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newLocation = { latitude, longitude, accuracy };

        setCurrentLocation(newLocation);
        setLastUpdate(new Date());

        // Calculate distance and speed
        if (lastLocationRef.current) {
          const dist = calculateDistance(
            lastLocationRef.current.latitude,
            lastLocationRef.current.longitude,
            latitude,
            longitude
          );
          setDistance(prev => prev + dist);

          // Calculate speed (m/s)
          const timeDiff = (new Date().getTime() - (lastUpdate?.getTime() || Date.now())) / 1000;
          if (timeDiff > 0) {
            setSpeed(dist / timeDiff);
          }
        }

        lastLocationRef.current = { latitude, longitude };
        onLocationUpdate?.(newLocation);
      },
      (error) => {
        let errorMessage = 'Unknown error occurred';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        setError(errorMessage);
      },
      options
    );

    setWatchId(watchId);
    onTrackingStart?.();
  };

  // Stop GPS tracking
  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    startTimeRef.current = null;
    onTrackingStop?.();
  };

  // Update tracking duration
  useEffect(() => {
    if (isTracking && startTimeRef.current) {
      intervalRef.current = setInterval(() => {
        const now = new Date();
        const duration = Math.floor((now.getTime() - startTimeRef.current!.getTime()) / 1000);
        setTrackingDuration(duration);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isTracking]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Format distance
  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  };

  // Format speed
  const formatSpeed = (mps: number): string => {
    const kmh = mps * 3.6;
    return `${kmh.toFixed(1)} km/h`;
  };

  // Get battery color
  const getBatteryColor = (level: number): string => {
    if (level > 50) return 'text-green-600';
    if (level > 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            GPS Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Indicators */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-green-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">{isOnline ? 'Online' : 'Offline'}</span>
              </div>

              <div className="flex items-center gap-1">
                <Battery className={`h-4 w-4 ${getBatteryColor(batteryLevel)}`} />
                <span className="text-sm">{batteryLevel}%</span>
              </div>
            </div>

            <Badge variant={isTracking ? 'default' : 'secondary'}>
              {isTracking ? 'Tracking' : 'Stopped'}
            </Badge>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Current Location */}
          {currentLocation && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Current Location</div>
              <div className="text-xs text-muted-foreground">
                Lat: {currentLocation.latitude.toFixed(6)}
              </div>
              <div className="text-xs text-muted-foreground">
                Lng: {currentLocation.longitude.toFixed(6)}
              </div>
              <div className="text-xs text-muted-foreground">
                Accuracy: ±{currentLocation.accuracy.toFixed(0)}m
              </div>
              {lastUpdate && (
                <div className="text-xs text-muted-foreground">
                  Last update: {lastUpdate.toLocaleTimeString()}
                </div>
              )}
            </div>
          )}

          {/* Tracking Stats */}
          {isTracking && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Duration</div>
                <div className="text-lg font-semibold">{formatDuration(trackingDuration)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Distance</div>
                <div className="text-lg font-semibold">{formatDistance(distance)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Speed</div>
                <div className="text-lg font-semibold">{formatSpeed(speed)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Battery</div>
                <div className="text-lg font-semibold">{batteryLevel}%</div>
              </div>
            </div>
          )}

          {/* Battery Level Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Battery Level</span>
              <span>{batteryLevel}%</span>
            </div>
            <Progress value={batteryLevel} className="h-2" />
          </div>

          {/* Control Buttons */}
          <div className="flex gap-2">
            {!isTracking ? (
              <Button
                onClick={startTracking}
                className="flex-1"
                disabled={!isOnline}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Tracking
              </Button>
            ) : (
              <Button
                onClick={stopTracking}
                variant="destructive"
                className="flex-1"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Tracking
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default withComponentErrorBoundary(MobileGPSTracker, {
  componentVariant: 'mobile',
  componentName: 'MobileGPSTracker'
});

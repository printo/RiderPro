import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { withComponentErrorBoundary } from '@/components/ErrorBoundary';
import {
  MapPin,
  Clock,
  Navigation,
  Users,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Play,
  Pause
} from 'lucide-react';

interface RiderLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  heading: number;
  lastUpdate: string;
  status: 'active' | 'inactive' | 'offline';
  batteryLevel: number;
}

interface MobileLiveTrackingProps {
  riders?: RiderLocation[];
  onRefresh?: () => void;
  onRiderSelect?: (rider: RiderLocation) => void;
  selectedRiderId?: string;
  isLive?: boolean;
  onToggleLive?: () => void;
}

export const MobileLiveTracking: React.FC<MobileLiveTrackingProps> = ({
  riders = [],
  onRefresh,
  onRiderSelect,
  selectedRiderId,
  isLive = false,
  onToggleLive
}) => {
  const [activeRiders, setActiveRiders] = useState<RiderLocation[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    setActiveRiders(riders);
    setLastUpdate(new Date());
  }, [riders]);

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatDistance = (lat1: number, lon1: number, lat2: number, lon2: number): string => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in meters

    if (distance >= 1000) {
      return `${(distance / 1000).toFixed(2)} km`;
    }
    return `${distance.toFixed(0)} m`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'text-green-600';
      case 'inactive':
        return 'text-yellow-600';
      case 'offline':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'offline':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getBatteryColor = (level: number): string => {
    if (level > 50) return 'text-green-600';
    if (level > 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSpeedColor = (speed: number): string => {
    if (speed > 50) return 'text-red-600';
    if (speed > 30) return 'text-yellow-600';
    return 'text-green-600';
  };

  const isRiderOnline = (lastUpdate: string): boolean => {
    const updateTime = new Date(lastUpdate);
    const now = new Date();
    const diffMinutes = (now.getTime() - updateTime.getTime()) / (1000 * 60);
    return diffMinutes < 5; // Consider online if updated within 5 minutes
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              Live Tracking
            </CardTitle>
            <div className="flex items-center gap-2">
              {onToggleLive && (
                <Button
                  variant={isLive ? "default" : "outline"}
                  size="sm"
                  onClick={onToggleLive}
                >
                  {isLive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              )}
              {onRefresh && (
                <Button variant="outline" size="sm" onClick={onRefresh}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Status Summary */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {activeRiders.filter(r => r.status === 'active').length}
              </div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {activeRiders.filter(r => r.status === 'inactive').length}
              </div>
              <div className="text-xs text-muted-foreground">Inactive</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {activeRiders.filter(r => r.status === 'offline').length}
              </div>
              <div className="text-xs text-muted-foreground">Offline</div>
            </div>
          </div>

          {/* Last Update */}
          {lastUpdate && (
            <div className="text-xs text-muted-foreground text-center mb-4">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Riders List */}
      <div className="space-y-3">
        {activeRiders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <div className="text-muted-foreground">No riders available</div>
            </CardContent>
          </Card>
        ) : (
          activeRiders.map((rider) => (
            <Card
              key={rider.id}
              className={`cursor-pointer transition-colors ${selectedRiderId === rider.id ? 'ring-2 ring-blue-500' : ''
                }`}
              onClick={() => onRiderSelect?.(rider)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <div className="rider-avatar">{rider.name.charAt(0).toUpperCase()}</div>
                    </div>
                    <div>
                      <div className="font-medium">{rider.name}</div>
                      <div className="text-xs text-muted-foreground">ID: {rider.id}</div>
                    </div>
                  </div>
                  <Badge variant={getStatusBadgeVariant(rider.status)}>
                    {rider.status}
                  </Badge>
                </div>

                {/* Location Info */}
                <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Lat:</span>
                    <span className="font-mono text-xs">{rider.latitude.toFixed(4)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Lng:</span>
                    <span className="font-mono text-xs">{rider.longitude.toFixed(4)}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Speed</div>
                    <div className={`font-medium ${getSpeedColor(rider.speed)}`}>
                      {rider.speed.toFixed(1)} km/h
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Battery</div>
                    <div className={`font-medium ${getBatteryColor(rider.batteryLevel)}`}>
                      {rider.batteryLevel}%
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Accuracy</div>
                    <div className="font-medium">±{rider.accuracy.toFixed(0)}m</div>
                  </div>
                </div>

                {/* Last Update */}
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Updated: {formatTime(rider.lastUpdate)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {isRiderOnline(rider.lastUpdate) ? (
                      <CheckCircle className="h-3 w-3 text-green-600" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-red-600" />
                    )}
                    <span>{isRiderOnline(rider.lastUpdate) ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* No Data Alert */}
      {activeRiders.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No rider data available. Make sure the tracking service is running.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default withComponentErrorBoundary(MobileLiveTracking, {
  componentVariant: 'mobile',
  componentName: 'MobileLiveTracking'
});

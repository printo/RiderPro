import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Clock, Zap, Navigation, User } from 'lucide-react';
import { RiderLocation } from '@/components/tracking/LiveTrackingMap';

interface RiderStatusPanelProps {
  riders: RiderLocation[];
  selectedRider?: string;
  onRiderSelect: (riderId: string) => void;
  onCenterOnRider: (riderId: string) => void;
}

export default function RiderStatusPanel({
  riders,
  selectedRider,
  onRiderSelect,
  onCenterOnRider
}: RiderStatusPanelProps) {
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'idle': return 'secondary';
      case 'offline': return 'outline';
      default: return 'outline';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return time.toLocaleDateString();
  };

  const formatSpeed = (speed?: number) => {
    if (speed === undefined) return 'N/A';
    return `${Math.round(speed)} km/h`;
  };

  const formatAccuracy = (accuracy?: number) => {
    if (accuracy === undefined) return 'N/A';
    return `±${Math.round(accuracy)}m`;
  };

  // Sort riders: active first, then by last update time
  const sortedRiders = [...riders].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (b.status === 'active' && a.status !== 'active') return 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const activeCount = riders.filter(r => r.status === 'active').length;
  const idleCount = riders.filter(r => r.status === 'idle').length;
  const offlineCount = riders.filter(r => r.status === 'offline').length;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Active Riders
        </CardTitle>

        {/* Summary stats */}
        <div className="flex gap-2 text-sm">
          <Badge variant="default" className="bg-green-100 text-green-800">
            {activeCount} Active
          </Badge>
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            {idleCount} Idle
          </Badge>
          <Badge variant="outline" className="bg-gray-100 text-gray-800">
            {offlineCount} Offline
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-3">
            {sortedRiders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No active riders</p>
                <p className="text-sm">Riders will appear here when they start tracking</p>
              </div>
            ) : (
              sortedRiders.map((rider) => (
                <Card
                  key={rider.employee_id}
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedRider === rider.employee_id
                    ? 'ring-2 ring-blue-500 bg-blue-50'
                    : 'hover:bg-gray-50'
                    }`}
                  onClick={() => onRiderSelect(rider.employee_id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm">
                          {rider.employee_name || `Employee ${rider.employee_id}`}
                        </h3>
                        <p className="text-xs text-gray-500">
                          ID: {rider.employee_id}
                        </p>
                      </div>

                      <Badge
                        variant={getStatusBadgeVariant(rider.status)}
                        className="ml-2"
                      >
                        {rider.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600">Last seen:</span>
                      </div>
                      <div className="text-right">
                        {formatTimestamp(rider.timestamp)}
                      </div>

                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600">Speed:</span>
                      </div>
                      <div className="text-right">
                        {formatSpeed(rider.speed)}
                      </div>

                      <div className="flex items-center gap-1">
                        <Navigation className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600">Accuracy:</span>
                      </div>
                      <div className="text-right">
                        {formatAccuracy(rider.accuracy)}
                      </div>

                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        <span className="text-gray-600">Location:</span>
                      </div>
                      <div className="text-right text-xs">
                        {rider.latitude.toFixed(4)}, {rider.longitude.toFixed(4)}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCenterOnRider(rider.employee_id);
                        }}
                      >
                        <MapPin className="h-3 w-3 mr-1" />
                        Center
                      </Button>

                      <Button
                        size="sm"
                        variant={selectedRider === rider.employee_id ? "default" : "outline"}
                        className="flex-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRiderSelect(rider.employee_id);
                        }}
                      >
                        {selectedRider === rider.employee_id ? 'Selected' : 'Select'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
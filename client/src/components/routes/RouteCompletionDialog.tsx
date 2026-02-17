import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { withModalErrorBoundary } from '@/components/ErrorBoundary';
import {
  MapPin,
  Clock,
  CheckCircle,
  Navigation,
  Target,
  Timer
} from 'lucide-react';
import { GPSPosition } from '@shared/types';

export interface RouteCompletionData {
  session_id: string;
  start_position: GPSPosition;
  current_position: GPSPosition;
  distance_from_start: number;
  geofence_radius: number;
  session_duration: number; // in seconds
  total_distance: number; // in km
  shipments_completed: number;
}

interface RouteCompletionDialogProps {
  is_open: boolean;
  on_close: () => void;
  on_confirm: () => void;
  on_cancel: () => void;
  data: RouteCompletionData;
  auto_confirm_seconds?: number;
}

function RouteCompletionDialog({
  is_open,
  on_close,
  on_confirm,
  on_cancel,
  data,
  auto_confirm_seconds = 30
}: RouteCompletionDialogProps) {
  const [countdown, setCountdown] = useState(auto_confirm_seconds);
  const [is_auto_confirming, set_is_auto_confirming] = useState(true);

  // Reset countdown when dialog opens
  useEffect(() => {
    if (is_open) {
      setCountdown(auto_confirm_seconds);
      set_is_auto_confirming(true);
    }
  }, [is_open, auto_confirm_seconds]);

  // Countdown timer
  useEffect(() => {
    if (!is_open || !is_auto_confirming) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          set_is_auto_confirming(false);
          on_confirm();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [is_open, is_auto_confirming, on_confirm]);

  const handle_manual_confirm = () => {
    set_is_auto_confirming(false);
    on_confirm();
  };

  const handle_cancel = () => {
    set_is_auto_confirming(false);
    on_cancel();
  };

  const format_duration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const format_distance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  };

  const completion_percentage = Math.max(0, Math.min(100,
    ((data.geofence_radius - data.distance_from_start) / data.geofence_radius) * 100
  ));

  return (
    <Dialog open={is_open} onOpenChange={on_close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-green-600" />
            Route Completion Detected
          </DialogTitle>
          <DialogDescription>
            Your route session has been automatically detected as complete based on your location and activity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Detection Status */}
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-green-800">
                    You're back at the starting location!
                  </h3>
                  <p className="text-sm text-green-700">
                    Distance from start: {format_distance(data.distance_from_start)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completion Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Completion Zone</span>
              <span className="font-medium">{completion_percentage.toFixed(0)}%</span>
            </div>
            <Progress value={completion_percentage} className="h-2" />
            <p className="text-xs text-gray-500">
              Within {format_distance(data.geofence_radius)} completion radius
            </p>
          </div>

          {/* Route Summary */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-gray-600">Duration</p>
                <p className="font-medium">{format_duration(data.session_duration)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-gray-600">Distance</p>
                <p className="font-medium">{data.total_distance.toFixed(1)} km</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-gray-600">Shipments</p>
                <p className="font-medium">{data.shipments_completed}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-gray-600">Accuracy</p>
                <p className="font-medium">{format_distance(data.distance_from_start)}</p>
              </div>
            </div>
          </div>

          {/* Auto-confirm countdown */}
          {is_auto_confirming && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Timer className="h-5 w-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm text-blue-800">
                      Auto-completing route in <strong>{countdown}</strong> seconds
                    </p>
                    <div className="mt-2">
                      <Progress
                        value={(countdown / auto_confirm_seconds) * 100}
                        className="h-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Position Details */}
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Start Position:</span>
              <span>
                {data.start_position.latitude.toFixed(6)}, {data.start_position.longitude.toFixed(6)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Current Position:</span>
              <span>
                {data.current_position.latitude.toFixed(6)}, {data.current_position.longitude.toFixed(6)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handle_cancel}
            disabled={!is_auto_confirming}
          >
            Continue Route
          </Button>
          <Button
            onClick={handle_manual_confirm}
            className="bg-green-600 hover:bg-green-700"
          >
            {is_auto_confirming ? `Complete Now (${countdown}s)` : 'Complete Route'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} export
  default withModalErrorBoundary(RouteCompletionDialog, {
    componentName: 'RouteCompletionDialog'
  });
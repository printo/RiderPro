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
  sessionId: string;
  startPosition: GPSPosition;
  currentPosition: GPSPosition;
  distanceFromStart: number;
  geofenceRadius: number;
  sessionDuration: number; // in seconds
  totalDistance: number; // in km
  shipmentsCompleted: number;
}

interface RouteCompletionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  data: RouteCompletionData;
  autoConfirmSeconds?: number;
}

function RouteCompletionDialog({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  data,
  autoConfirmSeconds = 30
}: RouteCompletionDialogProps) {
  const [countdown, setCountdown] = useState(autoConfirmSeconds);
  const [isAutoConfirming, setIsAutoConfirming] = useState(true);

  // Reset countdown when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCountdown(autoConfirmSeconds);
      setIsAutoConfirming(true);
    }
  }, [isOpen, autoConfirmSeconds]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || !isAutoConfirming) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setIsAutoConfirming(false);
          onConfirm();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isAutoConfirming, onConfirm]);

  const handleManualConfirm = () => {
    setIsAutoConfirming(false);
    onConfirm();
  };

  const handleCancel = () => {
    setIsAutoConfirming(false);
    onCancel();
  };

  const formatDuration = (seconds: number): string => {
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

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  };

  const completionPercentage = Math.max(0, Math.min(100,
    ((data.geofenceRadius - data.distanceFromStart) / data.geofenceRadius) * 100
  ));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
                    Distance from start: {formatDistance(data.distanceFromStart)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completion Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Completion Zone</span>
              <span className="font-medium">{completionPercentage.toFixed(0)}%</span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
            <p className="text-xs text-gray-500">
              Within {formatDistance(data.geofenceRadius)} completion radius
            </p>
          </div>

          {/* Route Summary */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-gray-600">Duration</p>
                <p className="font-medium">{formatDuration(data.sessionDuration)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-gray-600">Distance</p>
                <p className="font-medium">{data.totalDistance.toFixed(1)} km</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-gray-600">Shipments</p>
                <p className="font-medium">{data.shipmentsCompleted}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-gray-600">Accuracy</p>
                <p className="font-medium">{formatDistance(data.distanceFromStart)}</p>
              </div>
            </div>
          </div>

          {/* Auto-confirm countdown */}
          {isAutoConfirming && (
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
                        value={(countdown / autoConfirmSeconds) * 100}
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
                {data.startPosition.latitude.toFixed(6)}, {data.startPosition.longitude.toFixed(6)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Current Position:</span>
              <span>
                {data.currentPosition.latitude.toFixed(6)}, {data.currentPosition.longitude.toFixed(6)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={!isAutoConfirming}
          >
            Continue Route
          </Button>
          <Button
            onClick={handleManualConfirm}
            className="bg-green-600 hover:bg-green-700"
          >
            {isAutoConfirming ? `Complete Now (${countdown}s)` : 'Complete Route'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} export
  default withModalErrorBoundary(RouteCompletionDialog, {
    componentName: 'RouteCompletionDialog'
  });
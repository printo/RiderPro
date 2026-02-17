import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouteSessionContext } from '@/contexts/RouteSessionContext';
import { useSmartRouteCompletion } from '@/hooks/useSmartRouteCompletion';
import RouteCompletionDialog from '@/components/routes/RouteCompletionDialog';
import { withComponentErrorBoundary } from '@/components/ErrorBoundary';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Play, Pause, Square, RotateCcw, MapPin, Clock, Route, Gauge, Target } from 'lucide-react';
import { scrollToElementId } from '@/lib/utils';

interface RouteSessionControlsProps {
  employeeId: string;
  onSessionStart?: () => void;
  onSessionStop?: () => void;
  onSessionPause?: () => void;
  onSessionResume?: () => void;
  /** Open the route map in a dialog (avoids scroll issues) */
  onOpenRouteMap?: () => void;
}

function RouteSessionControls({
  employeeId,
  onSessionStart,
  onSessionStop,
  onSessionPause,
  onSessionResume,
  onOpenRouteMap
}: RouteSessionControlsProps) {
  const {
    session,
    status,
    metrics,
    coordinates,
    isLoading,
    error,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    clearError,
    canStartSession,
    canStopSession,
    canPauseSession,
    canResumeSession,
    getFormattedDuration,
    getFormattedDistance,
    getFormattedSpeed,
    showGeofenceDialog,
    confirmGeofenceStop,
    cancelGeofenceStop
  } = useRouteSessionContext();

  const currentPosition = coordinates.length > 0
    ? coordinates[coordinates.length - 1]
    : null;

  // Smart route completion integration
  const smartCompletion = useSmartRouteCompletion({
    sessionId: session?.id || null,
    startPosition: session ? {
      latitude: session.startLatitude || 0,
      longitude: session.startLongitude || 0,
      timestamp: session.startTime,
      accuracy: 10
    } : null,
    currentPosition,
    sessionStartTime: session ? new Date(session.startTime) : null,
    totalDistance: metrics?.totalDistance || 0,
    shipmentsCompleted: session?.shipmentsCompleted || 0,
    onRouteCompletionDetected: (data) => {
      console.log('Smart route completion detected:', data);
    },
    onRouteCompleted: () => {
      handleStopSession();
    }
  });

  const handleStartSession = async () => {
    try {
      await startSession();
      onSessionStart?.();
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  const handleStopSession = async () => {
    try {
      await stopSession();
      onSessionStop?.();
    } catch (error) {
      console.error('Failed to stop session:', error);
    }
  };

  const handlePauseSession = async () => {
    try {
      await pauseSession();
      onSessionPause?.();
    } catch (error) {
      console.error('Failed to pause session:', error);
    }
  };

  const handleResumeSession = async () => {
    try {
      await resumeSession();
      onSessionResume?.();
    } catch (error) {
      console.error('Failed to resume session:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'completed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Play className="h-3 w-3" />;
      case 'paused':
        return <Pause className="h-3 w-3" />;
      case 'completed':
        return <Square className="h-3 w-3" />;
      default:
        return <Square className="h-3 w-3" />;
    }
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Route Tracking
            </span>
            <div className="flex items-center gap-2">
              {smartCompletion.isEnabled && smartCompletion.isInCompletionZone && (
                <Badge className="bg-green-100 text-green-800">
                  <Target className="h-3 w-3 mr-1" />
                  Near Start
                </Badge>
              )}
              <Badge className={getStatusColor(status)}>
                {getStatusIcon(status)}
                <span className="ml-1 capitalize">{status}</span>
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
              <div className="flex justify-between items-start">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearError}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                >
                  ×
                </Button>
              </div>
            </div>
          )}

          {/* Session Metrics */}
          {/* Session Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-gray-50 rounded-md dark:bg-gray-800/50">
            <div className="flex flex-col gap-1 items-start">
              <div className="flex items-center gap-1.5 text-gray-500">
                <Clock className="h-3 w-3" />
                <span className="text-[10px] uppercase tracking-wider font-semibold">Duration</span>
              </div>
              <p className="text-sm font-semibold pl-[18px]">{getFormattedDuration()}</p>
            </div>

            <div className="flex flex-col gap-1 items-start">
              <div className="flex items-center gap-1.5 text-gray-500">
                <Route className="h-3 w-3" />
                <span className="text-[10px] uppercase tracking-wider font-semibold">Distance</span>
              </div>
              <p className="text-sm font-semibold pl-[18px]">{getFormattedDistance()}</p>
            </div>

            <div className="flex flex-col gap-1 items-start">
              <div className="flex items-center gap-1.5 text-gray-500">
                <Gauge className="h-3 w-3" />
                <span className="text-[10px] uppercase tracking-wider font-semibold">Speed</span>
              </div>
              <p className="text-sm font-semibold pl-[18px]">{getFormattedSpeed()}</p>
            </div>

            <div className="flex flex-col gap-1 items-start">
              <div className="flex items-center gap-1.5 text-gray-500">
                <MapPin className="h-3 w-3" />
                <span className="text-[10px] uppercase tracking-wider font-semibold">Points</span>
              </div>
              <p className="text-sm font-semibold pl-[18px]">{metrics?.coordinateCount || 0}</p>
            </div>
          </div>

          {session && (status === 'active' || status === 'paused') && (
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                if (typeof onOpenRouteMap === 'function') {
                  onOpenRouteMap();
                } else {
                  // Fallback to scrolling to the inline map section
                  if (window.location.hash !== '#route-map') {
                    window.location.hash = 'route-map';
                  } else {
                    // If already at the hash, force scroll again
                    scrollToElementId('route-map');
                  }
                }
              }}
              className="gap-2 w-full"
            >
              <MapPin className="h-4 w-4" />
              View route map & drop points
            </Button>
          )}

          {/* Control Buttons */}
          <div className="flex gap-2">
            {canStartSession() && (
              <Button
                onClick={handleStartSession}
                disabled={isLoading}
                className="flex-1"
                data-testid="start-session-btn"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Route
              </Button>
            )}

            {canResumeSession() && (
              <Button
                onClick={handleResumeSession}
                disabled={isLoading}
                className="flex-1"
                data-testid="resume-session-btn"
              >
                <Play className="h-4 w-4 mr-2" />
                Resume
              </Button>
            )}

            {canPauseSession() && (
              <Button
                onClick={handlePauseSession}
                disabled={isLoading}
                variant="outline"
                className="flex-1"
                data-testid="pause-session-btn"
              >
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            )}

            {canStopSession() && (
              <Button
                onClick={handleStopSession}
                disabled={isLoading}
                variant="destructive"
                className="flex-1"
                data-testid="stop-session-btn"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Route
              </Button>
            )}
          </div>

          {/* Session Info */}
          {session && (
            <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t mt-2">
              <p>Session ID: <span className="font-medium text-foreground">
                {session.id.startsWith('sess-')
                  ? session.id.split('-')[1]
                  : session.id.slice(-8)}
              </span></p>
              <p>Employee: <span className="font-medium text-foreground">{session.employeeId}</span></p>
              {session.startTime && (
                <p>Started: <span className="font-medium text-foreground">{new Date(session.startTime).toLocaleTimeString()}</span></p>
              )}
            </div>
          )}


          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-2">
              <RotateCcw className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-gray-500">Processing...</span>
            </div>
          )}
        </CardContent>
      </Card>



      {/* Route Completion Dialog */}
      {smartCompletion.showCompletionDialog && smartCompletion.completionData && (
        <RouteCompletionDialog
          isOpen={smartCompletion.showCompletionDialog}
          onClose={smartCompletion.handleCompletionCancel}
          onConfirm={smartCompletion.handleRouteCompletion}
          onCancel={smartCompletion.handleCompletionCancel}
          data={smartCompletion.completionData}
          autoConfirmSeconds={smartCompletion.config.autoConfirmDelay}
        />
      )}

      {/* Geofence Alert Dialog */}
      <AlertDialog open={showGeofenceDialog} onOpenChange={cancelGeofenceStop}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Route Session?</AlertDialogTitle>
            <AlertDialogDescription>
              You appear to have returned to your starting location. Would you like to stop GPS tracking?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelGeofenceStop}>Keep Tracking</AlertDialogCancel>
            <AlertDialogAction onClick={confirmGeofenceStop} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">
              Stop Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default withComponentErrorBoundary(RouteSessionControls, {
  componentVariant: 'card',
  componentName: 'RouteSessionControls'
});
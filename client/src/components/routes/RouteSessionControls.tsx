import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouteSession } from '@/hooks/useRouteSession';
import { useSmartRouteCompletion } from '@/hooks/useSmartRouteCompletion';
import RouteCompletionDialog from '@/components/routes/RouteCompletionDialog';
// import SmartCompletionSettings from '@/components/routes/SmartCompletionSettings';
import { withComponentErrorBoundary } from '@/components/ErrorBoundary';
import { Play, Pause, Square, RotateCcw, MapPin, Clock, Route, Gauge, Target, Settings } from 'lucide-react';

interface RouteSessionControlsProps {
  employeeId: string;
  onSessionStart?: () => void;
  onSessionStop?: () => void;
  onSessionPause?: () => void;
  onSessionResume?: () => void;
}

function RouteSessionControls({
  employeeId,
  onSessionStart,
  onSessionStop,
  onSessionPause,
  onSessionResume
}: RouteSessionControlsProps) {
  const [showSmartSettings, setShowSmartSettings] = useState(false);
  const {
    session,
    status,
    metrics,
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
    getFormattedSpeed
  } = useRouteSession({
    employeeId,
    trackingInterval: 30000,
    geofenceRadius: 0.1,
    enableGeofencing: true,
    onSessionComplete: (completedSession) => {
      console.log('Session completed:', completedSession);
    }
  });

  // Smart route completion integration
  const smartCompletion = useSmartRouteCompletion({
    sessionId: session?.id || null,
    startPosition: session ? {
      latitude: session.startLatitude || 0,
      longitude: session.startLongitude || 0,
      timestamp: session.startTime,
      accuracy: 10
    } : null,
    currentPosition: null, // Would need to get this from GPS tracker
    sessionStartTime: session ? new Date(session.startTime) : null,
    totalDistance: metrics?.totalDistance || 0,
    shipmentsCompleted: 0, // This would come from shipment tracking
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
      <Card className="w-full max-w-md">
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
          {session && metrics && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-md dark:bg-gray-800/50">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
                  <p className="text-sm font-medium">{getFormattedDuration()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Distance</p>
                  <p className="text-sm font-medium">{getFormattedDistance()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Avg Speed</p>
                  <p className="text-sm font-medium">{getFormattedSpeed()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Points</p>
                  <p className="text-sm font-medium">{metrics.coordinateCount}</p>
                </div>
              </div>
            </div>
          )}

          {/* Smart Completion Status */}
          {session && smartCompletion.isEnabled && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md dark:bg-blue-900/20 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Smart Completion Active
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-300">
                      Distance from start: {smartCompletion.distanceFromStart < 1000
                        ? `${Math.round(smartCompletion.distanceFromStart)}m`
                        : `${(smartCompletion.distanceFromStart / 1000).toFixed(1)}km`
                      }
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSmartSettings(!showSmartSettings)}
                  className="h-8 w-8 p-0"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
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
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p>Session ID: {session.id.slice(-8)}</p>
              <p>Employee: {session.employeeId}</p>
              {session.startTime && (
                <p>Started: {new Date(session.startTime).toLocaleTimeString()}</p>
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

      {/* Smart Completion Settings */}
      {showSmartSettings && (
        <div className="mt-4">
          {/* <SmartCompletionSettings
            config={smartCompletion.config}
            onConfigChange={smartCompletion.updateConfig}
            isActive={session?.status === 'active'}
            currentDistance={smartCompletion.distanceFromStart}
          /> */}
          <div className="text-sm text-muted-foreground">
            Smart completion settings component not available
          </div>
        </div>
      )}



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
    </>
  );
}

export default withComponentErrorBoundary(RouteSessionControls, {
  componentVariant: 'card',
  componentName: 'RouteSessionControls'
});
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouteSessionContext } from '@/contexts/RouteSessionContext';
import { useSmartRouteCompletion } from '@/hooks/useSmartRouteCompletion';
import RouteCompletionDialog from '@/components/routes/RouteCompletionDialog';
import SmartCompletionSettings from '@/components/SmartCompletionSettings';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Play, Pause, Square, RotateCcw, MapPin, Clock, Route, Gauge, Target, Settings, Loader2 } from 'lucide-react';
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
  employeeId: _employeeId,
  onSessionStart,
  onSessionStop,
  onSessionPause,
  onSessionResume,
  onOpenRouteMap
}: RouteSessionControlsProps) {
  const [show_smart_settings, set_show_smart_settings] = useState(false);
  const [is_stopping, set_is_stopping] = useState(false);
  const [stop_slow, set_stop_slow] = useState(false);
  const STOP_SLOW_MS = 12000; // after this, the overlay offers a "Continue" escape hatch
  const stop_handled_ref = useRef(false); // ensures onSessionStop fires exactly once
  const {
    session,
    status,
    metrics,
    is_loading,
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
    show_geofence_dialog,
    confirmGeofenceStop,
    cancelGeofenceStop
  } = useRouteSessionContext();

  // Smart route completion integration
  const smart_completion = useSmartRouteCompletion({
    sessionId: session?.id || null,
    startPosition: session ? {
      latitude: session.start_latitude || 0,
      longitude: session.start_longitude || 0,
      timestamp: session.start_time,
      accuracy: 10
    } : null,
    currentPosition: null, // Would need to get this from GPS tracker
    sessionStartTime: session ? new Date(session.start_time) : null,
    totalDistance: metrics?.total_distance || 0,
    shipments_completed: 0, // This would come from shipment tracking
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
    // Stopping now computes the route's distance & fuel server-side (a routing
    // call), so it can take a few seconds. Show a blocking "please wait" overlay,
    // and a fixed safety timeout so the UI never hangs with no response.
    set_is_stopping(true);
    set_stop_slow(false);
    stop_handled_ref.current = false;
    const slow_timer = setTimeout(() => set_stop_slow(true), STOP_SLOW_MS);
    try {
      await stopSession();
      if (!stop_handled_ref.current) {
        stop_handled_ref.current = true;
        onSessionStop?.();
      }
    } catch (error) {
      console.error('Failed to stop session:', error);
    } finally {
      clearTimeout(slow_timer);
      set_is_stopping(false);
      set_stop_slow(false);
    }
  };

  // Lets the rider dismiss the overlay if the stop call is taking too long — the
  // session-end is already saved server-side; the summary will catch up.
  const dismissStopOverlay = () => {
    set_is_stopping(false);
    set_stop_slow(false);
    if (!stop_handled_ref.current) {
      stop_handled_ref.current = true;
      onSessionStop?.();
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

  const getStatusColor = (current_status: string) => {
    switch (current_status) {
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

  const getStatusIcon = (current_status: string) => {
    switch (current_status) {
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
      {is_stopping && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl shadow-2xl border border-border max-w-sm w-full p-6 text-center">
            <Loader2 className="h-10 w-10 mx-auto mb-4 text-primary animate-spin" />
            <h3 className="text-lg font-bold mb-1">Finishing your route…</h3>
            <p className="text-sm text-muted-foreground">
              Computing distance, fuel &amp; summary. Please don't close the app.
            </p>
            {stop_slow && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-amber-600 mb-3">
                  Taking longer than usual. Your route end is already saved — you can continue and the summary will catch up.
                </p>
                <Button variant="outline" size="sm" className="w-full" onClick={dismissStopOverlay}>
                  Continue
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Route Tracking
            </span>
            <div className="flex items-center gap-2">
              {smart_completion.isEnabled && smart_completion.isInCompletionZone && (
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
              <p className="text-sm font-semibold pl-[18px]">{metrics?.coordinate_count || metrics?.coordinate_count || 0}</p>
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

          {/* Smart Completion Status */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md dark:bg-blue-900/20 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Smart Completion {smart_completion.isEnabled ? 'Active' : 'Inactive'}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300">
                    Distance from start: {
                      !session ? '0m' :
                        smart_completion.distanceFromStart === Number.POSITIVE_INFINITY || smart_completion.distanceFromStart === null
                          ? 'Unknown'
                          : smart_completion.distanceFromStart < 1000
                            ? `${Math.round(smart_completion.distanceFromStart)}m`
                            : `${(smart_completion.distanceFromStart / 1000).toFixed(1)}km`
                    }
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => set_show_smart_settings(!show_smart_settings)}
                className="h-8 w-8 p-0"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex gap-2">
            {canStartSession() && (
              <Button
                onClick={handleStartSession}
                disabled={is_loading}
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
                disabled={is_loading}
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
                disabled={is_loading}
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
                disabled={is_loading}
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
                {String(session.id).startsWith('sess-')
                  ? String(session.id).split('-')[1]
                  : String(session.id).slice(-8)}
              </span></p>
              <p>Employee: <span className="font-medium text-foreground">{session.employee_id}</span></p>
              {session.start_time && (
                <p>Started: <span className="font-medium text-foreground">{new Date(session.start_time).toLocaleTimeString()}</span></p>
              )}
            </div>
          )}


          {/* Loading State */}
          {is_loading && (
            <div className="flex items-center justify-center py-2">
              <RotateCcw className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-gray-500">Processing...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Smart Completion Settings Modal */}
      <Dialog open={show_smart_settings} onOpenChange={set_show_smart_settings}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col gap-0">
          <div className="p-6 pr-12 border-b bg-background sticky top-0 z-10">
            <DialogHeader>
              <DialogTitle>Smart Completion Settings</DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-6 pt-2">
            <SmartCompletionSettings
              config={smart_completion.config}
              onConfigChange={smart_completion.updateConfig}
              isActive={session?.status === 'active'}
              currentDistance={smart_completion.distanceFromStart}
            />
          </div>
        </DialogContent>
      </Dialog>



      {/* Route Completion Dialog */}
      {smart_completion.showCompletionDialog && smart_completion.completionData && (
        <RouteCompletionDialog
          is_open={smart_completion.showCompletionDialog}
          on_close={smart_completion.handleCompletionCancel}
          on_confirm={smart_completion.handleRouteCompletion}
          on_cancel={smart_completion.handleCompletionCancel}
          data={smart_completion.completionData}
          auto_confirm_seconds={smart_completion.config.autoConfirmDelay || smart_completion.config.autoConfirmDelay}
        />
      )}

      {/* Geofence Alert Dialog */}
      <AlertDialog open={show_geofence_dialog} onOpenChange={cancelGeofenceStop}>
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
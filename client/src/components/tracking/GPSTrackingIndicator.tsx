import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Navigation, AlertCircle, Loader2, MapPin, Clock } from 'lucide-react';
import { useRouteTracking } from '@/hooks/useRouteAPI';
import { cn } from '@/lib/utils';
import { withComponentErrorBoundary } from '@/components/ErrorBoundary';

interface GPSTrackingIndicatorProps {
  employeeId: string;
  variant?: 'badge' | 'card' | 'inline';
  showDetails?: boolean;
  className?: string;
}

function GPSTrackingIndicator({
  employeeId,
  variant = 'badge',
  showDetails = false,
  className
}: GPSTrackingIndicatorProps) {
  const {
    hasActiveSession,
    activeSession,
    isLoadingSession,
    coordinates
  } = useRouteTracking(employeeId);

  const getStatusInfo = () => {
    if (isLoadingSession) {
      return {
        icon: Loader2,
        text: 'Checking...',
        color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
        animate: 'animate-spin'
      };
    }

    if (hasActiveSession) {
      return {
        icon: Navigation,
        text: 'GPS Active',
        color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        animate: ''
      };
    }

    return {
      icon: AlertCircle,
      text: 'No Route',
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      animate: ''
    };
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  if (variant === 'badge') {
    return (
      <Badge className={cn(statusInfo.color, className)}>
        <Icon className={cn("h-3 w-3 mr-1", statusInfo.animate)} />
        {statusInfo.text}
      </Badge>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <Icon className={cn("h-4 w-4", statusInfo.animate)} />
        <span>{statusInfo.text}</span>
        {showDetails && hasActiveSession && activeSession && (
          <span className="text-xs text-muted-foreground">
            • {coordinates.length} points
          </span>
        )}
      </div>
    );
  }

  // Card variant
  return (
    <Card className={cn(
      hasActiveSession
        ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
        : "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800",
      className
    )}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={cn(
            "h-4 w-4",
            hasActiveSession ? "text-green-600" : "text-yellow-600",
            statusInfo.animate
          )} />
          <span className={cn(
            "text-sm font-medium",
            hasActiveSession
              ? "text-green-800 dark:text-green-400"
              : "text-yellow-800 dark:text-yellow-400"
          )}>
            {hasActiveSession ? 'GPS Tracking Active' : 'No Active Route'}
          </span>
        </div>

        <p className={cn(
          "text-xs",
          hasActiveSession
            ? "text-green-600 dark:text-green-400"
            : "text-yellow-600 dark:text-yellow-400"
        )}>
          {hasActiveSession
            ? 'Shipment locations will be recorded automatically'
            : 'Start route tracking to record GPS locations'
          }
        </p>

        {showDetails && hasActiveSession && activeSession && (
          <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{coordinates.length} GPS points</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  Started {new Date(activeSession.startTime).toLocaleTimeString()}
                </span>
              </div>
            </div>
            <p className="text-xs text-green-500 dark:text-green-500 mt-1">
              Session: {activeSession.id.startsWith('sess-')
                ? activeSession.id.split('-')[1]
                : activeSession.id.slice(-8)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact version for use in lists
export function GPSTrackingBadge({ employeeId, className }: { employeeId: string; className?: string }) {
  return (
    <GPSTrackingIndicator
      employeeId={employeeId}
      variant="badge"
      className={className}
    />
  );
}

// Inline version for use in text
export function GPSTrackingStatus({ employeeId, showDetails = false, className }: {
  employeeId: string;
  showDetails?: boolean;
  className?: string;
}) {
  return (
    <GPSTrackingIndicator
      employeeId={employeeId}
      variant="inline"
      showDetails={showDetails}
      className={className}
    />
  );
}

// Card version for dashboards
export function GPSTrackingCard({ employeeId, showDetails = true, className }: {
  employeeId: string;
  showDetails?: boolean;
  className?: string;
}) {
  return (
    <GPSTrackingIndicator
      employeeId={employeeId}
      variant="card"
      showDetails={showDetails}
      className={className}
    />
  );
} export default withComponentErrorBoundary(GPSTrackingIndicator, {
  componentVariant: 'inline',
  componentName: 'GPSTrackingIndicator'
});
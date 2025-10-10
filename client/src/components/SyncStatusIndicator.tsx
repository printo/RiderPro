import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { withComponentErrorBoundary } from '@/components/ErrorBoundary';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Database,
  RotateCcw
} from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';

interface SyncStatusIndicatorProps {
  showDetails?: boolean;
  compact?: boolean;
  onSyncComplete?: () => void;
  onSyncError?: (error: string) => void;
}

function SyncStatusIndicator({
  showDetails = false,
  compact = false,
  onSyncComplete,
  onSyncError
}: SyncStatusIndicatorProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [detailedStatus, setDetailedStatus] = useState<any>(null);

  const {
    syncStatus,
    isOnline,
    pendingRecords,
    syncInProgress,
    syncErrors,
    lastSyncTime,
    forceSyncNow,
    clearSyncedData,
    getDetailedSyncStatus,
    getSyncHealth
  } = useOfflineSync({
    onSyncComplete,
    onSyncError
  });

  const syncHealth = getSyncHealth();

  const handleForceSync = async () => {
    try {
      await forceSyncNow();
    } catch (error) {
      console.error('Force sync failed:', error);
    }
  };

  const handleShowDetails = async () => {
    const details = await getDetailedSyncStatus();
    setDetailedStatus(details);
    setShowPopover(true);
  };

  const getStatusIcon = () => {
    if (syncInProgress) {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }

    if (!isOnline) {
      return <WifiOff className="h-4 w-4" />;
    }

    if (syncErrors.length > 0) {
      return <XCircle className="h-4 w-4" />;
    }

    if (pendingRecords > 0) {
      return <AlertTriangle className="h-4 w-4" />;
    }

    return <CheckCircle className="h-4 w-4" />;
  };

  const getStatusColor = () => {
    if (syncInProgress) {
      return 'bg-blue-100 text-blue-800';
    }

    if (!isOnline) {
      return 'bg-orange-100 text-orange-800';
    }

    if (syncErrors.length > 0) {
      return 'bg-red-100 text-red-800';
    }

    if (pendingRecords > 0) {
      return 'bg-yellow-100 text-yellow-800';
    }

    return 'bg-green-100 text-green-800';
  };

  const getStatusText = () => {
    if (syncInProgress) {
      return 'Syncing...';
    }

    if (!isOnline) {
      return 'Offline';
    }

    if (syncErrors.length > 0) {
      return `${syncErrors.length} Error${syncErrors.length > 1 ? 's' : ''}`;
    }

    if (pendingRecords > 0) {
      return `${pendingRecords} Pending`;
    }

    return 'Synced';
  };

  const formatLastSyncTime = (time?: Date) => {
    if (!time) return 'Never';

    const now = new Date();
    const diff = now.getTime() - time.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (compact) {
    return (
      <Popover open={showPopover} onOpenChange={setShowPopover}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleShowDetails}
          >
            {getStatusIcon()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <SyncStatusDetails
            syncStatus={syncStatus}
            detailedStatus={detailedStatus}
            syncHealth={syncHealth}
            onForceSync={handleForceSync}
            onClearData={clearSyncedData}
            formatLastSyncTime={formatLastSyncTime}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge className={getStatusColor()}>
          {getStatusIcon()}
          <span className="ml-1">{getStatusText()}</span>
        </Badge>

        {isOnline && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleForceSync}
            disabled={syncInProgress}
            className="h-6 px-2 text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Sync
          </Button>
        )}

        {showDetails && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShowDetails}
            className="h-6 px-2 text-xs"
          >
            Details
          </Button>
        )}
      </div>

      {showDetails && showPopover && (
        <Card className="w-full max-w-sm">
          <SyncStatusDetails
            syncStatus={syncStatus}
            detailedStatus={detailedStatus}
            syncHealth={syncHealth}
            onForceSync={handleForceSync}
            onClearData={clearSyncedData}
            formatLastSyncTime={formatLastSyncTime}
          />
        </Card>
      )}
    </div>
  );
}

interface SyncStatusDetailsProps {
  syncStatus: any;
  detailedStatus: any;
  syncHealth: any;
  onForceSync: () => void;
  onClearData: () => void;
  formatLastSyncTime: (time?: Date) => string;
}

function SyncStatusDetails({
  syncStatus,
  detailedStatus,
  syncHealth,
  onForceSync,
  onClearData,
  formatLastSyncTime
}: SyncStatusDetailsProps) {
  return (
    <>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4" />
          Sync Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {syncStatus.isOnline ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-orange-600" />
            )}
            <span className="text-sm">
              {syncStatus.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <Badge variant="outline" className="text-xs">
            {syncStatus.isOnline ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        {/* Sync Progress */}
        {syncStatus.syncInProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Syncing data...</span>
              <RefreshCw className="h-4 w-4 animate-spin" />
            </div>
            <Progress value={undefined} className="h-2" />
          </div>
        )}

        {/* Pending Records */}
        {detailedStatus && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Pending Records</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span>GPS Records:</span>
                <span>{detailedStatus.unsyncedGPSRecords || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Sessions:</span>
                <span>{detailedStatus.unsyncedSessions || 0}</span>
              </div>
            </div>
            {detailedStatus.totalPending > 0 && (
              <div className="text-xs text-gray-500">
                Total: {detailedStatus.totalPending} records pending
              </div>
            )}
          </div>
        )}

        {/* Last Sync Time */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <span>Last Sync:</span>
          </div>
          <span className="text-gray-600">
            {formatLastSyncTime(syncStatus.lastSyncTime)}
          </span>
        </div>

        {/* Health Status */}
        <Alert variant={syncHealth.health === 'error' ? 'destructive' : 'default'}>
          <div className="flex items-center gap-2">
            {syncHealth.health === 'good' && <CheckCircle className="h-4 w-4 text-green-600" />}
            {syncHealth.health === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
            {syncHealth.health === 'error' && <XCircle className="h-4 w-4" />}
            <AlertDescription className="text-sm">
              {syncHealth.message}
            </AlertDescription>
          </div>
        </Alert>

        {/* Sync Errors */}
        {syncStatus.syncErrors.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-red-600">Recent Errors</div>
            <div className="space-y-1">
              {syncStatus.syncErrors.slice(0, 3).map((error: string, index: number) => (
                <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                  {error}
                </div>
              ))}
              {syncStatus.syncErrors.length > 3 && (
                <div className="text-xs text-gray-500">
                  +{syncStatus.syncErrors.length - 3} more errors
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={onForceSync}
            disabled={!syncStatus.isOnline || syncStatus.syncInProgress}
            className="flex-1"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Force Sync
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onClearData}
            className="flex-1"
          >
            Clear Data
          </Button>
        </div>
      </CardContent>
    </>
  );
} expor
t default withComponentErrorBoundary(SyncStatusIndicator, {
  componentVariant: 'inline',
  componentName: 'SyncStatusIndicator'
});
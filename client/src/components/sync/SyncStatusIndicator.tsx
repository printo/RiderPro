import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { withComponentErrorBoundary } from '@/components/ErrorBoundary';
import {
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Database,
  RotateCcw,
  Clock
} from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { DeviceSyncStatus as SyncStatus } from '@shared/types';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';

interface DetailedSyncStatus extends SyncStatus {
  unsynced_gps_records: number;
  unsynced_sessions: number;
  total_pending: number;
}

interface SyncHealth {
  health: 'good' | 'warning' | 'error';
  message: string;
  timeSinceLastSync: number;
}

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
  const [detailedStatus, setDetailedStatus] = useState<DetailedSyncStatus | null>(null);

  const {
    syncStatus,
    is_online,
    pending_records,
    sync_in_progress,
    sync_errors,
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
  };

  const getStatusIcon = () => {
    if (sync_in_progress) {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }

    if (!is_online) {
      return <XCircle className="h-4 w-4" />;
    }

    if (sync_errors.length > 0) {
      return <XCircle className="h-4 w-4" />;
    }

    if (pending_records > 0) {
      return <AlertTriangle className="h-4 w-4" />;
    }

    return <CheckCircle className="h-4 w-4" />;
  };

  const getStatusColor = () => {
    if (sync_in_progress) {
      return 'bg-blue-100 text-blue-800';
    }

    if (!is_online) {
      return 'bg-orange-100 text-orange-800';
    }

    if (sync_errors.length > 0) {
      return 'bg-red-100 text-red-800';
    }

    if (pending_records > 0) {
      return 'bg-yellow-100 text-yellow-800';
    }

    return 'bg-green-100 text-green-800';
  };

  const getStatusText = () => {
    if (sync_in_progress) {
      return 'Syncing...';
    }

    if (!is_online) {
      return 'Offline';
    }

    if (sync_errors.length > 0) {
      return `${sync_errors.length} Error${sync_errors.length > 1 ? 's' : ''}`;
    }

    if (pending_records > 0) {
      return `${pending_records} Pending`;
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
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={handleShowDetails}
      >
        {getStatusIcon()}
      </Button>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 items-stretch">
      {/* Details Section */}
      {showDetails && (
        <Card className="flex-1 h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Database className="h-4 w-4" />
                Sync Status Details
              </CardTitle>
              {is_online && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleForceSync}
                  disabled={sync_in_progress}
                  className="h-7"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Sync Now
                </Button>
              )}
            </div>
          </CardHeader>
          <SyncStatusDetails
            syncStatus={syncStatus}
            detailedStatus={detailedStatus}
            syncHealth={syncHealth}
            onForceSync={handleForceSync}
            onClearData={clearSyncedData}
            formatLastSyncTime={formatLastSyncTime}
            getStatusIcon={getStatusIcon}
            getStatusColor={getStatusColor}
            getStatusText={getStatusText}
          />
        </Card>
      )}
    </div>
  );
}

interface SyncStatusDetailsProps {
  syncStatus: SyncStatus;
  detailedStatus: DetailedSyncStatus | null;
  syncHealth: SyncHealth;
  onForceSync: () => void;
  onClearData: () => void;
  formatLastSyncTime: (time?: Date) => string;
  getStatusIcon?: () => JSX.Element;
  getStatusColor?: () => string;
  getStatusText?: () => string;
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
    <CardContent className="space-y-3">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <ConnectionStatus
          type="local"
          isConnected={syncStatus.is_online}
          isPending={syncStatus.sync_in_progress}
          hasError={syncStatus.sync_errors.length > 0}
          className="text-sm"
          showLabel={true}
          variant="compact"
        />
        <Badge variant="outline" className="text-xs">
          {syncStatus.is_online ? 'Connected' : 'Disconnected'}
        </Badge>
      </div>

      {/* Sync Progress */}
      {syncStatus.sync_in_progress && (
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
              <span>{detailedStatus.unsynced_gps_records || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Sessions:</span>
              <span>{detailedStatus.unsynced_sessions || 0}</span>
            </div>
          </div>
          {detailedStatus.total_pending > 0 && (
            <div className="text-xs text-gray-500">
              Total: {detailedStatus.total_pending} records pending
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
          {formatLastSyncTime(syncStatus.last_sync_at)}
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
      {syncStatus.sync_errors.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-red-600">Recent Errors</div>
          <div className="space-y-1">
            {syncStatus.sync_errors.slice(0, 3).map((error: string, index: number) => (
              <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            ))}
            {syncStatus.sync_errors.length > 3 && (
              <div className="text-xs text-gray-500">
                +{syncStatus.sync_errors.length - 3} more errors
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
          disabled={!syncStatus.is_online || syncStatus.sync_in_progress}
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
  );
}

export default withComponentErrorBoundary(SyncStatusIndicator, {
  componentVariant: 'inline',
  componentName: 'SyncStatusIndicator'
});
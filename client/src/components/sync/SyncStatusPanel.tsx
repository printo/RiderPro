import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { withComponentErrorBoundary } from "@/components/ErrorBoundary";
import { apiClient } from "@/services/ApiClient";
import { cn } from "@/lib/utils";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";

interface SyncStats {
  total_pending: number;
  total_sent: number;
  total_failed: number;
  last_sync_at?: string;
}

import { useOfflineSync } from "@/hooks/useOfflineSync";

interface SyncStatusPanelProps {
  className?: string;
}

function SyncStatusPanel({ className }: SyncStatusPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Offline Sync Hook
  const {
    is_online: isOnline,
    pending_records: pendingRecords,
    sync_in_progress: offlineSyncInProgress,
    forceSyncNow
  } = useOfflineSync({});

  const { data: syncStats, isLoading } = useQuery<SyncStats>({
    queryKey: ["/api/v1/sync/stats"],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/sync/stats');
      if (!response.ok) throw new Error('Failed to fetch sync stats');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const triggerSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/api/v1/sync/trigger');
      if (!response.ok) throw new Error('Failed to trigger sync');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/sync/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/dashboard"] });
      toast({
        title: "Sync Triggered",
        description: data.message || "Sync process started.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to trigger external sync.",
        variant: "destructive",
      });
    },
  });

  const handleManualSync = () => {
    // Determine what to do:
    // If we have offline pending records, we forceSyncNow (device -> db)
    // If we have online backend pending, we triggerSyncMutation (db -> api)
    // Or just do both to be safe "Sync Now" implies everything.

    // 1. Trigger backend sync
    triggerSyncMutation.mutate();

    // 2. Trigger offline sync
    if (isOnline) {
      forceSyncNow().catch(console.error);
    }

    // 3. Refresh stats
    queryClient.invalidateQueries({ queryKey: ["/api/v1/sync/stats"] });
  };

  // Determine cloud server connection status based on API availability and sync stats
  const isCloudServerConnected = isOnline && !triggerSyncMutation.isError && syncStats !== undefined;

  const isSyncing = triggerSyncMutation.isPending || offlineSyncInProgress;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">External Sync Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-4 w-4 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden border-border/60 shadow-sm flex flex-col", className)}>
      <CardHeader className="p-4 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Sync Status</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 px-3 text-xs font-medium w-full sm:w-auto"
            onClick={handleManualSync}
            disabled={isSyncing}
            data-testid="button-sync-now"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>
        </div>

        {/* Sub-header: Online Status & Date */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground border-b border-border/40 pb-3">
          <ConnectionStatus
            type="cloud"
            isConnected={isCloudServerConnected}
            isPending={triggerSyncMutation.isPending}
            hasError={triggerSyncMutation.isError}
            className="text-xs"
            showLabel={true}
            variant="default"
          />

          {syncStats?.last_sync_at && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>Last synced {new Date(syncStats.last_sync_at).toLocaleString()}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col">
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
          {/* Left Column: Sync Stats */}
          <div className="flex flex-wrap items-center justify-center gap-y-2 py-4 bg-muted/5 text-sm">
            <div className="flex items-center gap-3 px-2">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-muted-foreground tracking-wider text-[10px]">SENT</span>
                <span className="font-bold text-green-600" data-testid="text-sync-sent">{syncStats?.total_sent || 0}</span>
              </div>
              <div className="h-3 w-px bg-border/60"></div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-muted-foreground tracking-wider text-[10px]">PENDING</span>
                <span className="font-bold text-amber-600" data-testid="text-sync-pending">{syncStats?.total_pending || 0}</span>
              </div>
              <div className="h-3 w-px bg-border/60"></div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-muted-foreground tracking-wider text-[10px]">FAILED</span>
                <span className="font-bold text-red-600" data-testid="text-sync-failed">{syncStats?.total_failed || 0}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Device Connectivity */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 bg-card mt-auto sm:mt-0">
            <ConnectionStatus
              type="local"
              isConnected={isOnline}
              isPending={false}
              hasError={false}
              className="text-sm"
              showLabel={true}
              variant="inline"
            />

            <div className="flex items-center gap-2">
              {pendingRecords > 0 && <Badge variant="outline" className="text-[10px] h-5">Local: {pendingRecords}</Badge>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default withComponentErrorBoundary(SyncStatusPanel, {
  componentVariant: 'card',
  componentName: 'SyncStatusPanel'
});
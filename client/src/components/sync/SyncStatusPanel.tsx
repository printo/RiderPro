import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Send, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { withComponentErrorBoundary } from "@/components/ErrorBoundary";
import { apiClient } from "@/services/ApiClient";
import { cn } from "@/lib/utils";

interface SyncStats {
  totalPending: number;
  totalSent: number;
  totalFailed: number;
  lastSyncTime?: string;
}

import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Wifi, WifiOff, Database } from "lucide-react";

// ... existing imports ...

interface SyncStatusPanelProps {
  className?: string;
}

function SyncStatusPanel({ className }: SyncStatusPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Offline Sync Hook
  const {
    isOnline,
    pendingRecords,
    syncInProgress: offlineSyncInProgress,
    forceSyncNow
  } = useOfflineSync({});

  const { data: syncStats, isLoading } = useQuery<SyncStats>({
    queryKey: ["/api/sync/stats"],
    queryFn: async () => {
      const response = await apiClient.get('/api/sync/stats');
      if (!response.ok) throw new Error('Failed to fetch sync stats');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const triggerSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/api/sync/trigger');
      if (!response.ok) throw new Error('Failed to trigger sync');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sync/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Sync Triggered",
        description: data.message || "Sync process started.",
      });
    },
    onError: (error: any) => {
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
    queryClient.invalidateQueries({ queryKey: ["/api/sync/stats"] });
  };

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
            <Wifi className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground/80 lowercase sm:uppercase">Cloud Server</span>
            <Wifi className="h-3.5 w-3.5 text-green-500" />
            <span className="text-green-600 font-medium">Connected</span>
          </div>

          {syncStats?.lastSyncTime && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>Last synced {new Date(syncStats.lastSyncTime).toLocaleString()}</span>
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
                <span className="font-bold text-green-600" data-testid="text-sync-sent">{syncStats?.totalSent || 0}</span>
              </div>
              <div className="h-3 w-px bg-border/60"></div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-muted-foreground tracking-wider text-[10px]">PENDING</span>
                <span className="font-bold text-amber-600" data-testid="text-sync-pending">{syncStats?.totalPending || 0}</span>
              </div>
              <div className="h-3 w-px bg-border/60"></div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-muted-foreground tracking-wider text-[10px]">FAILED</span>
                <span className="font-bold text-red-600" data-testid="text-sync-failed">{syncStats?.totalFailed || 0}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Device Connectivity */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 bg-card mt-auto sm:mt-0">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-2.5 w-2.5">
                {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              </div>
              <span className="text-sm font-medium text-foreground/80">{isOnline ? 'Local Network: Connected' : 'Local Network: Offline'}</span>
            </div>

            <div className="flex items-center gap-2">
              {pendingRecords > 0 && <Badge variant="outline" className="text-[10px] h-5">Local: {pendingRecords}</Badge>}
              <Wifi className={`h-4 w-4 ${isOnline ? 'text-green-500/70' : 'text-muted-foreground'}`} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} export default withComponentErrorBoundary(SyncStatusPanel, {
  componentVariant: 'card',
  componentName: 'SyncStatusPanel'
});
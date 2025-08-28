import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Send, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SyncStats {
  totalPending: number;
  totalSent: number;
  totalFailed: number;
  lastSyncTime?: string;
}

export default function SyncStatusPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: syncStats, isLoading } = useQuery<SyncStats>({
    queryKey: ["/api/sync/stats"],
    queryFn: async () => {
      const response = await fetch('/api/sync/stats');
      if (!response.ok) throw new Error('Failed to fetch sync stats');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const triggerSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/sync/trigger', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to trigger sync');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sync/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Sync Triggered",
        description: `${data.processed} shipments processed for sync.`,
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

  const handleTriggerSync = () => {
    triggerSyncMutation.mutate();
  };

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          External Sync Status
          <Button
            variant="ghost"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/sync/stats"] })}
            data-testid="button-refresh-sync"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sync Statistics */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="flex items-center justify-center mb-1">
              <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-xs text-muted-foreground">Sent</span>
            </div>
            <div className="text-lg font-semibold text-green-600" data-testid="text-sync-sent">
              {syncStats?.totalSent || 0}
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-center mb-1">
              <Clock className="h-4 w-4 text-yellow-600 mr-1" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <div className="text-lg font-semibold text-yellow-600" data-testid="text-sync-pending">
              {syncStats?.totalPending || 0}
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-center mb-1">
              <XCircle className="h-4 w-4 text-red-600 mr-1" />
              <span className="text-xs text-muted-foreground">Failed</span>
            </div>
            <div className="text-lg font-semibold text-red-600" data-testid="text-sync-failed">
              {syncStats?.totalFailed || 0}
            </div>
          </div>
        </div>

        {/* Last Sync Time */}
        {syncStats?.lastSyncTime && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Last sync: {new Date(syncStats.lastSyncTime).toLocaleString()}
            </p>
          </div>
        )}

        {/* Manual Sync Button */}
        {(syncStats?.totalPending || 0) > 0 && (
          <Button
            onClick={handleTriggerSync}
            disabled={triggerSyncMutation.isPending}
            className="w-full"
            data-testid="button-trigger-sync"
          >
            <Send className="h-4 w-4 mr-2" />
            {triggerSyncMutation.isPending ? "Syncing..." : `Send ${syncStats?.totalPending} Pending`}
          </Button>
        )}

        {/* Status Badge */}
        <div className="flex justify-center">
          <Badge 
            variant={(syncStats?.totalFailed || 0) > 0 ? "destructive" : "default"}
            data-testid="badge-sync-status"
          >
            {(syncStats?.totalFailed || 0) > 0 ? "Issues Detected" : "All Synced"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
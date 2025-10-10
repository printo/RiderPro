import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { withComponentErrorBoundary } from '@/components/ErrorBoundary';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Trash2,
  Download,
  Shield,
  Activity
} from 'lucide-react';

interface ErrorMonitoringPanelProps {
  errorHandler?: any;
  gpsErrorRecovery?: any;
  expanded?: boolean;
  onErrorResolve?: (errorId: string) => void;
}

function ErrorMonitoringPanel({
  errorHandler,
  gpsErrorRecovery,
  expanded = false,
  onErrorResolve
}: ErrorMonitoringPanelProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [errorStats, setErrorStats] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [recoveryState, setRecoveryState] = useState<any>(null);

  useEffect(() => {
    if (!errorHandler) return;

    const updateData = () => {
      setErrorStats(errorHandler.getErrorStats());
      setSystemHealth(errorHandler.getSystemHealth());
      setRecentErrors(errorHandler.getLogs({
        since: new Date(Date.now() - 3600000) // Last hour
      }).slice(0, 5));
    };

    // Initial update
    updateData();

    // Set up periodic updates
    const interval = setInterval(updateData, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [errorHandler]);

  useEffect(() => {
    if (!gpsErrorRecovery) return;

    const updateRecoveryState = () => {
      setRecoveryState(gpsErrorRecovery.getRecoveryState());
    };

    // Initial update
    updateRecoveryState();

    // Listen for recovery state changes
    gpsErrorRecovery.addRecoveryListener(updateRecoveryState);

    return () => {
      gpsErrorRecovery.removeRecoveryListener(updateRecoveryState);
    };
  }, [gpsErrorRecovery]);

  const getHealthIcon = () => {
    if (!systemHealth) return <Activity className="h-4 w-4" />;

    switch (systemHealth.status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getHealthColor = () => {
    if (!systemHealth) return 'bg-gray-100 text-gray-800';

    switch (systemHealth.status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getErrorLevelIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <XCircle className="h-3 w-3 text-red-600" />;
      case 'error':
        return <AlertTriangle className="h-3 w-3 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      case 'info':
        return <Info className="h-3 w-3 text-blue-500" />;
      default:
        return <Info className="h-3 w-3" />;
    }
  };

  const getErrorLevelColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'error':
        return 'bg-red-50 text-red-700';
      case 'warn':
        return 'bg-yellow-50 text-yellow-700';
      case 'info':
        return 'bg-blue-50 text-blue-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  const handleClearOldErrors = () => {
    if (errorHandler) {
      const cleared = errorHandler.clearOldLogs();
      console.log(`Cleared ${cleared} old error logs`);
    }
  };

  const handleExportLogs = () => {
    if (errorHandler) {
      const logs = errorHandler.exportLogs();
      const blob = new Blob([logs], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `error-logs-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Card className="w-full">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-gray-50 transition-colors">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Error Monitoring</span>
                {systemHealth && (
                  <Badge className={getHealthColor()}>
                    {getHealthIcon()}
                    <span className="ml-1 capitalize">{systemHealth.status}</span>
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {errorStats && errorStats.recentErrors > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {errorStats.recentErrors} recent
                  </Badge>
                )}
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* System Health */}
            {systemHealth && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getHealthIcon()}
                    <span className="text-sm font-medium">System Health</span>
                  </div>
                  <Badge className={getHealthColor()}>
                    {systemHealth.status}
                  </Badge>
                </div>

                <p className="text-sm text-gray-600">{systemHealth.message}</p>

                {systemHealth.recommendations.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-700">Recommendations:</div>
                    {systemHealth.recommendations.map((rec: string, index: number) => (
                      <div key={index} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        {rec}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* GPS Recovery Status */}
            {recoveryState && (
              <div className="space-y-3">
                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className={`h-4 w-4 ${recoveryState.isRecovering ? 'animate-spin text-blue-600' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium">GPS Recovery</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {recoveryState.fallbackMode && (
                      <Badge className="bg-orange-100 text-orange-800 text-xs">
                        Fallback Mode
                      </Badge>
                    )}
                    {recoveryState.isRecovering && (
                      <Badge className="bg-blue-100 text-blue-800 text-xs">
                        Recovering
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span>Recovery Attempts:</span>
                    <span>{recoveryState.recoveryAttempts}/{recoveryState.maxRecoveryAttempts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Success:</span>
                    <span>
                      {recoveryState.lastSuccessfulUpdate
                        ? formatTimestamp(recoveryState.lastSuccessfulUpdate)
                        : 'Never'
                      }
                    </span>
                  </div>
                </div>

                {recoveryState.lastKnownPosition && (
                  <div className="text-xs text-gray-600">
                    Last known position: {recoveryState.lastKnownPosition.latitude.toFixed(6)}, {recoveryState.lastKnownPosition.longitude.toFixed(6)}
                    (±{Math.round(recoveryState.lastKnownPosition.accuracy)}m)
                  </div>
                )}
              </div>
            )}

            {/* Error Statistics */}
            {errorStats && (
              <div className="space-y-3">
                <Separator />

                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  <span className="text-sm font-medium">Error Statistics</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span>Total Errors:</span>
                    <span>{errorStats.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Recent (1h):</span>
                    <span>{errorStats.recentErrors}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Critical:</span>
                    <span className="text-red-600">{errorStats.criticalErrors}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Resolved:</span>
                    <span className="text-green-600">{errorStats.resolvedErrors}</span>
                  </div>
                </div>

                {/* Error breakdown by category */}
                <div className="space-y-1">
                  <div className="text-xs font-medium">By Category:</div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {Object.entries(errorStats.byCategory).map(([category, count]) => (
                      <div key={category} className="flex justify-between">
                        <span className="capitalize">{category}:</span>
                        <span>{count as number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Recent Errors */}
            {recentErrors.length > 0 && (
              <div className="space-y-3">
                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Recent Errors</span>
                  <Badge variant="outline" className="text-xs">
                    {recentErrors.length}
                  </Badge>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {recentErrors.map((error) => (
                    <div key={error.id} className={`p-2 rounded text-xs ${getErrorLevelColor(error.level)}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getErrorLevelIcon(error.level)}
                          <span className="font-medium capitalize">{error.category}</span>
                          <span className="text-xs opacity-75">
                            {formatTimestamp(error.timestamp)}
                          </span>
                        </div>
                        {!error.resolved && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-4 w-4 p-0"
                            onClick={() => {
                              if (errorHandler) {
                                errorHandler.resolveError(error.id);
                                onErrorResolve?.(error.id);
                              }
                            }}
                          >
                            <CheckCircle className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="mt-1 text-xs opacity-90">
                        {error.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleClearOldErrors}
                className="flex-1"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear Old
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportLogs}
                className="flex-1"
              >
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
            </div>

            {/* Status Summary */}
            <div className="text-xs text-gray-500 space-y-1">
              <div>Error logging: {errorHandler ? 'Enabled' : 'Disabled'}</div>
              <div>GPS recovery: {gpsErrorRecovery ? 'Enabled' : 'Disabled'}</div>
              <div>Shipment operations: Protected from GPS failures</div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}export d
efault withComponentErrorBoundary(ErrorMonitoringPanel, {
  componentVariant: 'card',
  componentName: 'ErrorMonitoringPanel'
});
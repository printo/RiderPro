import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { withComponentErrorBoundary } from '@/components/ErrorBoundary';
import {
  Battery,
  BatteryLow,
  Zap,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Settings,
  BarChart3
} from 'lucide-react';

interface BatteryPerformanceMonitorProps {
  batteryOptimization?: any;
  performanceMonitoring?: any;
  onOptimizationChange?: (enabled: boolean) => void;
  expanded?: boolean;
}

function BatteryPerformanceMonitor({
  batteryOptimization,
  performanceMonitoring,
  onOptimizationChange,
  expanded = false
}: BatteryPerformanceMonitorProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [batteryInfo, setBatteryInfo] = useState<any>(null);
  const [performanceStats, setPerformanceStats] = useState<any>(null);
  const [optimizationEnabled, setOptimizationEnabled] = useState(true);
  const [movementAdaptationEnabled, setMovementAdaptationEnabled] = useState(true);

  useEffect(() => {
    if (!batteryOptimization && !performanceMonitoring) return;

    const updateData = () => {
      if (batteryOptimization) {
        setBatteryInfo(batteryOptimization.getBatteryStatus());
      }

      if (performanceMonitoring) {
        setPerformanceStats(performanceMonitoring.getPerformanceStats());
      }
    };

    // Initial update
    updateData();

    // Set up periodic updates
    const interval = setInterval(updateData, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [batteryOptimization, performanceMonitoring]);

  const getBatteryIcon = () => {
    if (!batteryInfo) return <Battery className="h-4 w-4" />;

    if (batteryInfo.charging) {
      return <Zap className="h-4 w-4 text-green-600" />;
    }

    if (batteryInfo.status === 'critical' || batteryInfo.status === 'low') {
      return <BatteryLow className="h-4 w-4 text-red-600" />;
    }

    return <Battery className="h-4 w-4 text-green-600" />;
  };

  const getBatteryColor = () => {
    if (!batteryInfo) return 'bg-gray-100 text-gray-800';

    if (batteryInfo.charging) return 'bg-green-100 text-green-800';

    switch (batteryInfo.status) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'low':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
        return 'bg-blue-100 text-blue-800';
      case 'high':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPerformanceIcon = () => {
    if (!performanceStats) return <Activity className="h-4 w-4" />;

    if (performanceStats.averageQueryTime > 200) {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    } else if (performanceStats.averageQueryTime < 50) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    }

    return <Minus className="h-4 w-4 text-blue-600" />;
  };

  const handleOptimizationToggle = (enabled: boolean) => {
    setOptimizationEnabled(enabled);
    onOptimizationChange?.(enabled);
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  return (
    <Card className="w-full">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-gray-50 transition-colors">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span>Battery & Performance</span>
                {batteryInfo && (
                  <Badge className={getBatteryColor()}>
                    {getBatteryIcon()}
                    <span className="ml-1">{batteryInfo.level}</span>
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {performanceStats && (
                  <Badge variant="outline" className="text-xs">
                    {performanceStats.averageQueryTime.toFixed(1)}ms avg
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
            {/* Battery Status */}
            {batteryInfo && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getBatteryIcon()}
                    <span className="text-sm font-medium">Battery Status</span>
                  </div>
                  <Badge className={getBatteryColor()}>
                    {batteryInfo.level}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Level</span>
                    <span>{batteryInfo.level}</span>
                  </div>
                  <Progress
                    value={parseInt(batteryInfo.level)}
                    className="h-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="capitalize">{batteryInfo.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Charging:</span>
                    <span>{batteryInfo.charging ? 'Yes' : 'No'}</span>
                  </div>
                </div>

                {batteryInfo.estimatedTime && (
                  <div className="text-xs text-gray-600">
                    {batteryInfo.estimatedTime}
                  </div>
                )}

                {(batteryInfo.status === 'critical' || batteryInfo.status === 'low') && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {batteryInfo.status === 'critical'
                        ? 'Critical battery level - GPS tracking reduced to 5-minute intervals'
                        : 'Low battery level - GPS tracking reduced to 2-minute intervals'
                      }
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Performance Stats */}
            {performanceStats && (
              <div className="space-y-3">
                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span className="text-sm font-medium">Performance</span>
                  </div>
                  {getPerformanceIcon()}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span>Avg Query Time:</span>
                    <span>{performanceStats.averageQueryTime.toFixed(1)}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Queries:</span>
                    <span>{performanceStats.totalQueries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Slow Queries:</span>
                    <span>{performanceStats.slowQueries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failed Queries:</span>
                    <span>{performanceStats.failedQueries}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Index Hit Rate:</span>
                    <span>{performanceStats.indexHitRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cache Hit Rate:</span>
                    <span>{performanceStats.cacheHitRate.toFixed(1)}%</span>
                  </div>
                </div>

                {performanceStats.averageQueryTime > 100 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Performance degraded - average query time is high
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Optimization Settings */}
            <div className="space-y-3">
              <Separator />

              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="text-sm font-medium">Optimization Settings</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm">Battery Optimization</Label>
                    <p className="text-xs text-gray-500">
                      Automatically adjust GPS frequency based on battery level
                    </p>
                  </div>
                  <Switch
                    checked={optimizationEnabled}
                    onCheckedChange={handleOptimizationToggle}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm">Movement Adaptation</Label>
                    <p className="text-xs text-gray-500">
                      Adjust tracking frequency based on movement patterns
                    </p>
                  </div>
                  <Switch
                    checked={movementAdaptationEnabled}
                    onCheckedChange={setMovementAdaptationEnabled}
                  />
                </div>
              </div>
            </div>

            {/* Status Summary */}
            <div className="space-y-2">
              <Separator />

              <div className="flex items-center justify-between text-sm">
                <span>Overall Status:</span>
                <div className="flex items-center gap-2">
                  {batteryInfo?.status === 'critical' || performanceStats?.averageQueryTime > 200 ? (
                    <>
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-red-600">Needs Attention</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-green-600">Optimal</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {batteryOptimization && (
              <div className="space-y-2">
                <Separator />

                <div className="text-sm font-medium">Recommendations</div>
                <div className="space-y-1">
                  {batteryOptimization.getOptimizationRecommendations().slice(0, 3).map((rec: string, index: number) => (
                    <div key={index} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
} export default withComponentErrorBoundary(BatteryPerformanceMonitor, {
  componentVariant: 'card',
  componentName: 'BatteryPerformanceMonitor'
});
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { healthCheckOptimizer, HealthCheckConfig } from '@/services/HealthCheckOptimizer';
import { apiClient } from '@/services/ApiClient';
import { Activity, Clock, Database, Settings, Zap } from 'lucide-react';

export function HealthCheckSettings() {
  const [config, setConfig] = useState<HealthCheckConfig>(healthCheckOptimizer.getConfig());
  const [stats, setStats] = useState(healthCheckOptimizer.getCacheStats());
  const [isTestingConnectivity, setIsTestingConnectivity] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<{ success: boolean; time: number } | null>(null);

  useEffect(() => {
    // Update stats every 10 seconds
    const interval = setInterval(() => {
      setStats(healthCheckOptimizer.getCacheStats());
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleConfigChange = (key: keyof HealthCheckConfig, value: string | number | boolean) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    healthCheckOptimizer.updateConfig({ [key]: value });
  };

  const handleIntervalChange = (value: string) => {
    const intervalMs = parseInt(value) * 1000; // Convert seconds to milliseconds
    if (!isNaN(intervalMs) && intervalMs >= 30000) {
      handleConfigChange('interval', intervalMs);

      // Also update ApiClient connectivity check interval
      apiClient.setConnectivityCheckInterval(intervalMs);
    }
  };

  const handleCacheTimeoutChange = (value: string) => {
    const timeoutMs = parseInt(value) * 1000; // Convert seconds to milliseconds
    if (!isNaN(timeoutMs) && timeoutMs >= 5000) {
      handleConfigChange('cacheTimeout', timeoutMs);
    }
  };

  const testConnectivity = async () => {
    setIsTestingConnectivity(true);
    const startTime = Date.now();

    try {
      const result = await apiClient.forceConnectivityCheck();
      const responseTime = Date.now() - startTime;

      setLastTestResult({
        success: result,
        time: responseTime
      });
    } catch {
      setLastTestResult({
        success: false,
        time: Date.now() - startTime
      });
    } finally {
      setIsTestingConnectivity(false);
    }
  };

  const clearCache = () => {
    healthCheckOptimizer.clearCache();
    setStats(healthCheckOptimizer.getCacheStats());
  };

  const applyRecommendedSettings = () => {
    const recommended = healthCheckOptimizer.getRecommendedSettings();
    if (Object.keys(recommended).length > 0) {
      healthCheckOptimizer.updateConfig(recommended);
      setConfig(healthCheckOptimizer.getConfig());
    }
  };

  const resetToDefaults = () => {
    const defaults: HealthCheckConfig = {
      enabled: true,
      interval: 120000, // 2 minutes
      cacheTimeout: 30000, // 30 seconds
      maxRetries: 3,
      backoffMultiplier: 2
    };

    healthCheckOptimizer.updateConfig(defaults);
    setConfig(defaults);

    // Also reset ApiClient settings
    apiClient.setConnectivityCheckInterval(defaults.interval);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Health Check Settings
          </CardTitle>
          <CardDescription>
            Configure how frequently the application checks server connectivity to optimize performance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Health Checks */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="health-enabled">Enable Health Checks</Label>
              <p className="text-sm text-muted-foreground">
                Turn off to completely disable connectivity monitoring
              </p>
            </div>
            <Switch
              id="health-enabled"
              checked={config.enabled}
              onCheckedChange={(checked) => {
                handleConfigChange('enabled', checked);
                if (checked) {
                  apiClient.enableConnectivityChecks();
                } else {
                  apiClient.disableConnectivityChecks();
                }
              }}
            />
          </div>

          <Separator />

          {/* Check Interval */}
          <div className="space-y-2">
            <Label htmlFor="check-interval">Check Interval (seconds)</Label>
            <Input
              id="check-interval"
              type="number"
              min="30"
              max="600"
              value={Math.round(config.interval / 1000)}
              onChange={(e) => handleIntervalChange(e.target.value)}
              disabled={!config.enabled}
            />
            <p className="text-sm text-muted-foreground">
              How often to check server connectivity (minimum 30 seconds)
            </p>
          </div>

          {/* Cache Timeout */}
          <div className="space-y-2">
            <Label htmlFor="cache-timeout">Cache Timeout (seconds)</Label>
            <Input
              id="cache-timeout"
              type="number"
              min="5"
              max="300"
              value={Math.round(config.cacheTimeout / 1000)}
              onChange={(e) => handleCacheTimeoutChange(e.target.value)}
              disabled={!config.enabled}
            />
            <p className="text-sm text-muted-foreground">
              How long to cache health check results (minimum 5 seconds)
            </p>
          </div>

          {/* Max Retries */}
          <div className="space-y-2">
            <Label htmlFor="max-retries">Max Retries</Label>
            <Input
              id="max-retries"
              type="number"
              min="0"
              max="10"
              value={config.maxRetries}
              onChange={(e) => handleConfigChange('maxRetries', parseInt(e.target.value))}
              disabled={!config.enabled}
            />
            <p className="text-sm text-muted-foreground">
              Number of retry attempts for failed health checks
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Health Check Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.cacheSize}</div>
              <div className="text-sm text-muted-foreground">Cached Results</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.activeChecks}</div>
              <div className="text-sm text-muted-foreground">Active Checks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.retryCounters}</div>
              <div className="text-sm text-muted-foreground">Retry Counters</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {stats.oldestEntry ? Math.round((Date.now() - stats.oldestEntry) / 1000) : 0}s
              </div>
              <div className="text-sm text-muted-foreground">Oldest Entry</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Connectivity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Test Connectivity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={testConnectivity}
            disabled={isTestingConnectivity}
            className="w-full"
          >
            {isTestingConnectivity ? 'Testing...' : 'Test Connection Now'}
          </Button>

          {lastTestResult && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Last test: {lastTestResult.success ? 'Success' : 'Failed'}
                {' '}({lastTestResult.time}ms)
                <Badge
                  variant={lastTestResult.success ? 'default' : 'destructive'}
                  className="ml-2"
                >
                  {lastTestResult.success ? 'Online' : 'Offline'}
                </Badge>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={clearCache}>
              Clear Cache
            </Button>
            <Button variant="outline" onClick={applyRecommendedSettings}>
              Apply Recommended Settings
            </Button>
            <Button variant="outline" onClick={resetToDefaults}>
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Performance Tips */}
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertDescription>
          <strong>Performance Tips:</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• Increase check interval to reduce server load</li>
            <li>• Increase cache timeout to reduce redundant requests</li>
            <li>• Disable health checks if you don't need offline detection</li>
            <li>• Use recommended settings for optimal performance</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default HealthCheckSettings;
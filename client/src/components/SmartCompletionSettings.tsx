import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Target,
  Clock,
  Navigation,
  Settings,
  Info,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { SmartCompletionConfig } from '@/hooks/useSmartRouteCompletion';

interface SmartCompletionSettingsProps {
  config: SmartCompletionConfig;
  onConfigChange: (config: Partial<SmartCompletionConfig>) => void;
  isActive?: boolean;
  currentDistance?: number;
}

export default function SmartCompletionSettings({
  config,
  onConfigChange,
  isActive = false,
  currentDistance
}: SmartCompletionSettingsProps) {
  const [localConfig, setLocalConfig] = useState<SmartCompletionConfig>(config);

  const handleConfigUpdate = (updates: Partial<SmartCompletionConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onConfigChange(updates);
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const getRadiusRecommendation = (radius: number): { level: 'good' | 'warning' | 'error', message: string } => {
    if (radius < 50) {
      return { level: 'error', message: 'Very small radius may cause false positives' };
    } else if (radius < 100) {
      return { level: 'warning', message: 'Small radius - good for precise completion' };
    } else if (radius <= 200) {
      return { level: 'good', message: 'Recommended radius for most routes' };
    } else {
      return { level: 'warning', message: 'Large radius may be too permissive' };
    }
  };

  const radiusRecommendation = getRadiusRecommendation(localConfig.radius);

  return (
    <div className="space-y-6 pt-2">
      {/* Enable/Disable */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-base font-medium">Enable Smart Completion</Label>
          <p className="text-sm text-gray-500">
            Automatically detect when you return to the starting location
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <Badge variant="default" className="bg-green-100 text-green-800">
              Active
            </Badge>
          )}
          <Switch
            checked={localConfig.enabled}
            onCheckedChange={(enabled) => handleConfigUpdate({ enabled })}
          />
        </div>
      </div>

      {localConfig.enabled && (
        <>
          <Separator />

          {/* Current Status */}
          {isActive && currentDistance !== undefined && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>Current distance from start:</span>
                  <Badge variant="outline">
                    {formatDistance(currentDistance)}
                  </Badge>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Detection Radius */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Detection Radius</Label>
              <Badge variant="outline">{formatDistance(localConfig.radius)}</Badge>
            </div>
            <p className="text-sm text-gray-500">
              How close you need to be to the starting point to trigger completion
            </p>

            <div className="space-y-2">
              <Slider
                value={[localConfig.radius]}
                onValueChange={([radius]) => handleConfigUpdate({ radius })}
                min={25}
                max={500}
                step={25}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>25m</span>
                <span>500m</span>
              </div>
            </div>

            <Alert variant={radiusRecommendation.level === 'error' ? 'destructive' : 'default'}>
              <div className="flex items-center gap-2">
                {radiusRecommendation.level === 'good' && <CheckCircle className="h-4 w-4 text-green-600" />}
                {radiusRecommendation.level === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                {radiusRecommendation.level === 'error' && <AlertTriangle className="h-4 w-4" />}
                <AlertDescription>{radiusRecommendation.message}</AlertDescription>
              </div>
            </Alert>
          </div>

          <Separator />

          {/* Minimum Session Duration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Minimum Session Duration</Label>
              <Badge variant="outline">{formatDuration(localConfig.minSessionDuration)}</Badge>
            </div>
            <p className="text-sm text-gray-500">
              Minimum time before allowing route completion
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[300, 600, 900, 1800, 3600].map((seconds) => (
                <Button
                  key={seconds}
                  variant={localConfig.minSessionDuration === seconds ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleConfigUpdate({ minSessionDuration: seconds })}
                >
                  {formatDuration(seconds)}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Auto-confirm Delay */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Auto-confirm Delay</Label>
              <Badge variant="outline">{localConfig.autoConfirmDelay}s</Badge>
            </div>
            <p className="text-sm text-gray-500">
              Seconds to wait before automatically completing the route
            </p>

            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 60, 120].map((seconds) => (
                <Button
                  key={seconds}
                  variant={localConfig.autoConfirmDelay === seconds ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleConfigUpdate({ autoConfirmDelay: seconds })}
                >
                  {seconds}s
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Minimum Distance Requirement */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">Require Minimum Distance</Label>
                <p className="text-sm text-gray-500">
                  Only allow completion after traveling a minimum distance
                </p>
              </div>
              <Switch
                checked={localConfig.requireMinDistance}
                onCheckedChange={(requireMinDistance) =>
                  handleConfigUpdate({ requireMinDistance })
                }
              />
            </div>

            {localConfig.requireMinDistance && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Minimum Distance</Label>
                  <Badge variant="outline">{localConfig.minDistanceKm.toFixed(1)} km</Badge>
                </div>

                <div className="space-y-2">
                  <Slider
                    value={[localConfig.minDistanceKm]}
                    onValueChange={([minDistanceKm]) => handleConfigUpdate({ minDistanceKm })}
                    min={0.1}
                    max={5.0}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>0.1 km</span>
                    <span>5.0 km</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Quick Presets */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Quick Presets</Label>
            <div className="grid grid-cols-1 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConfigUpdate({
                  radius: 50,
                  minSessionDuration: 300,
                  autoConfirmDelay: 15,
                  requireMinDistance: true,
                  minDistanceKm: 0.2
                })}
                className="justify-start"
              >
                <Target className="h-4 w-4 mr-2" />
                Precise (50m radius, strict requirements)
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConfigUpdate({
                  radius: 100,
                  minSessionDuration: 600,
                  autoConfirmDelay: 30,
                  requireMinDistance: true,
                  minDistanceKm: 0.5
                })}
                className="justify-start"
              >
                <Navigation className="h-4 w-4 mr-2" />
                Balanced (100m radius, moderate requirements)
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConfigUpdate({
                  radius: 200,
                  minSessionDuration: 300,
                  autoConfirmDelay: 60,
                  requireMinDistance: false,
                  minDistanceKm: 0.1
                })}
                className="justify-start"
              >
                <Clock className="h-4 w-4 mr-2" />
                Relaxed (200m radius, lenient requirements)
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
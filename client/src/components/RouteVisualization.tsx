import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  MapPin,
  Clock,
  Route,
  Gauge,
  Zap,
  TrendingUp,
  Settings,
  Download,
  RefreshCw
} from 'lucide-react';

// Mock Leaflet types for now - in real implementation would import from leaflet
interface LatLng {
  lat: number;
  lng: number;
}

interface RoutePoint {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  eventType?: 'pickup' | 'delivery' | 'gps';
  shipmentId?: string;
}

interface RouteSession {
  id: string;
  employeeId: string;
  employeeName: string;
  startTime: string;
  endTime?: string;
  status: 'active' | 'completed' | 'paused';
  totalDistance: number;
  totalTime: number;
  averageSpeed: number;
  points: RoutePoint[];
  shipmentsCompleted: number;
}

interface RouteVisualizationProps {
  sessionId?: string;
  sessions?: RouteSession[];
  onSessionSelect?: (sessionId: string) => void;
  onPointClick?: (point: RoutePoint) => void;
  showComparison?: boolean;
  autoPlay?: boolean;
  className?: string;
}

export default function RouteVisualization({
  sessionId,
  sessions = [],
  onSessionSelect,
  onPointClick,
  showComparison = false,
  autoPlay = false
}: RouteVisualizationProps) {
  const [selectedSession, setSelectedSession] = useState<RouteSession | null>(null);
  const [comparisonSession, setComparisonSession] = useState<RouteSession | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [mapStyle, setMapStyle] = useState('openstreetmap');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mapInstanceRef = useRef<any>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    // In a real implementation, this would initialize Leaflet map
    // For now, we'll create a mock map container
    const mockMap = {
      setView: (center: [number, number], zoom: number) => {
        console.log(`Map centered at ${center} with zoom ${zoom}`);
      },
      addLayer: (layer: any) => {
        console.log('Layer added to map');
      },
      removeLayer: (layer: any) => {
        console.log('Layer removed from map');
      },
      fitBounds: (bounds: any) => {
        console.log('Map bounds fitted');
      }
    };

    mapInstanceRef.current = mockMap;

    // Initialize with default view
    mockMap.setView([40.7128, -74.0060], 13); // NYC default

    return () => {
      // Cleanup map
      mapInstanceRef.current = null;
    };
  }, []);

  // Load session data
  useEffect(() => {
    if (sessionId && sessions.length > 0) {
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        setSelectedSession(session);
        setCurrentPointIndex(0);
      }
    }
  }, [sessionId, sessions]);

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && selectedSession && selectedSession.points.length > 0) {
      const interval = 1000 / playbackSpeed; // Adjust speed

      playbackIntervalRef.current = setInterval(() => {
        setCurrentPointIndex(prev => {
          const nextIndex = prev + 1;
          if (nextIndex >= selectedSession.points.length) {
            setIsPlaying(false);
            return prev;
          }
          return nextIndex;
        });
      }, interval);
    } else {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, selectedSession]);

  // Update map when session or playback changes
  useEffect(() => {
    if (!selectedSession || !mapInstanceRef.current) return;

    // In real implementation, this would update the Leaflet map
    // with route polylines, markers, and current position
    console.log(`Updating map for session ${selectedSession.id}, point ${currentPointIndex}`);

    // Mock map update
    if (selectedSession.points.length > 0) {
      const currentPoint = selectedSession.points[currentPointIndex];
      if (currentPoint) {
        mapInstanceRef.current.setView([currentPoint.latitude, currentPoint.longitude], 15);
      }
    }
  }, [selectedSession, currentPointIndex]);

  const handleSessionSelect = (session: RouteSession) => {
    setSelectedSession(session);
    setCurrentPointIndex(0);
    setIsPlaying(false);
    onSessionSelect?.(session.id);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentPointIndex(0);
  };

  const handleSkipToStart = () => {
    setCurrentPointIndex(0);
    setIsPlaying(false);
  };

  const handleSkipToEnd = () => {
    if (selectedSession) {
      setCurrentPointIndex(selectedSession.points.length - 1);
      setIsPlaying(false);
    }
  };

  const handleSliderChange = (value: number[]) => {
    setCurrentPointIndex(value[0]);
    setIsPlaying(false);
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatDistance = (km: number): string => {
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)}km`;
  };

  const getCurrentPoint = (): RoutePoint | null => {
    if (!selectedSession || currentPointIndex >= selectedSession.points.length) {
      return null;
    }
    return selectedSession.points[currentPointIndex];
  };

  const getRouteProgress = (): number => {
    if (!selectedSession || selectedSession.points.length === 0) return 0;
    return (currentPointIndex / (selectedSession.points.length - 1)) * 100;
  };

  const getPlaybackTime = (): string => {
    const currentPoint = getCurrentPoint();
    if (!currentPoint || !selectedSession) return '00:00:00';

    const startTime = new Date(selectedSession.startTime).getTime();
    const currentTime = new Date(currentPoint.timestamp).getTime();
    const elapsed = Math.floor((currentTime - startTime) / 1000);

    return formatDuration(elapsed);
  };

  return (
    <div className="w-full space-y-4">
      {/* Session Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              <span>Route Visualization</span>
            </div>
            <div className="flex items-center gap-2">
              {selectedSession && (
                <Badge variant="outline">
                  {selectedSession.employeeName}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Session Selector */}
          <div className="flex gap-2">
            <Select
              value={selectedSession?.id || ''}
              onValueChange={(value) => {
                const session = sessions.find(s => s.id === value);
                if (session) handleSessionSelect(session);
              }}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a route session" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.employeeName} - {new Date(session.startTime).toLocaleDateString()}
                    ({formatDistance(session.totalDistance)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {showComparison && (
              <Select
                value={comparisonSession?.id || ''}
                onValueChange={(value) => {
                  const session = sessions.find(s => s.id === value);
                  setComparisonSession(session || null);
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Compare with..." />
                </SelectTrigger>
                <SelectContent>
                  {sessions
                    .filter(s => s.id !== selectedSession?.id)
                    .map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.employeeName} - {new Date(session.startTime).toLocaleDateString()}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="p-3 bg-gray-50 rounded-md space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Map Style</label>
                  <Select value={mapStyle} onValueChange={setMapStyle}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openstreetmap">OpenStreetMap</SelectItem>
                      <SelectItem value="satellite">Satellite</SelectItem>
                      <SelectItem value="terrain">Terrain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="heatmap"
                    checked={showHeatmap}
                    onChange={(e) => setShowHeatmap(e.target.checked)}
                  />
                  <label htmlFor="heatmap" className="text-sm">Show Heatmap</label>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Map Container */}
      <Card className="h-96">
        <CardContent className="p-0 h-full">
          <div
            ref={mapRef}
            className="w-full h-full bg-gray-100 rounded-md flex items-center justify-center"
          >
            {selectedSession ? (
              <div className="text-center space-y-2">
                <MapPin className="h-12 w-12 mx-auto text-blue-600" />
                <p className="text-lg font-medium">Interactive Route Map</p>
                <p className="text-sm text-gray-600">
                  Showing route for {selectedSession.employeeName}
                </p>
                <p className="text-xs text-gray-500">
                  In production: Leaflet.js + OpenStreetMap integration
                </p>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <MapPin className="h-12 w-12 mx-auto text-gray-400" />
                <p className="text-lg text-gray-600">Select a route to visualize</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Playback Controls */}
      {selectedSession && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Timeline Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Route Progress</span>
                <span>{getRouteProgress().toFixed(1)}%</span>
              </div>
              <Slider
                value={[currentPointIndex]}
                onValueChange={handleSliderChange}
                max={Math.max(0, selectedSession.points.length - 1)}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{new Date(selectedSession.startTime).toLocaleTimeString()}</span>
                <span>Current: {getPlaybackTime()}</span>
                <span>
                  {selectedSession.endTime
                    ? new Date(selectedSession.endTime).toLocaleTimeString()
                    : 'In Progress'
                  }
                </span>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSkipToStart}
                disabled={currentPointIndex === 0}
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <Button
                variant={isPlaying ? "default" : "outline"}
                size="sm"
                onClick={handlePlayPause}
                disabled={selectedSession.points.length === 0}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleStop}
                disabled={!isPlaying && currentPointIndex === 0}
              >
                <Square className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSkipToEnd}
                disabled={currentPointIndex >= selectedSession.points.length - 1}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            {/* Playback Speed */}
            <div className="flex items-center justify-center gap-4">
              <span className="text-sm text-gray-600">Speed:</span>
              <div className="flex gap-1">
                {[0.5, 1, 2, 4, 8].map((speed) => (
                  <Button
                    key={speed}
                    variant={playbackSpeed === speed ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPlaybackSpeed(speed)}
                  >
                    {speed}x
                  </Button>
                ))}
              </div>
            </div>

            {/* Current Point Info */}
            {getCurrentPoint() && (
              <div className="p-3 bg-blue-50 rounded-md">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Position:</span>
                    <div className="font-mono text-xs">
                      {getCurrentPoint()!.latitude.toFixed(6)}, {getCurrentPoint()!.longitude.toFixed(6)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Time:</span>
                    <div>{new Date(getCurrentPoint()!.timestamp).toLocaleTimeString()}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Accuracy:</span>
                    <div>±{getCurrentPoint()!.accuracy || 0}m</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Speed:</span>
                    <div>{getCurrentPoint()!.speed ? `${getCurrentPoint()!.speed!.toFixed(1)} km/h` : 'N/A'}</div>
                  </div>
                </div>
                {getCurrentPoint()!.eventType && (
                  <div className="mt-2">
                    <Badge className={
                      getCurrentPoint()!.eventType === 'pickup' ? 'bg-green-100 text-green-800' :
                        getCurrentPoint()!.eventType === 'delivery' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                    }>
                      {getCurrentPoint()!.eventType === 'pickup' ? 'Pickup Event' :
                        getCurrentPoint()!.eventType === 'delivery' ? 'Delivery Event' :
                          'GPS Tracking'}
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Route Statistics */}
      {selectedSession && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Route Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-500">Distance</p>
                  <p className="font-medium">{formatDistance(selectedSession.totalDistance)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="font-medium">{formatDuration(selectedSession.totalTime)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-xs text-gray-500">Avg Speed</p>
                  <p className="font-medium">{selectedSession.averageSpeed.toFixed(1)} km/h</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-xs text-gray-500">Shipments</p>
                  <p className="font-medium">{selectedSession.shipmentsCompleted}</p>
                </div>
              </div>
            </div>

            {/* Comparison Stats */}
            {comparisonSession && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium mb-2">Comparison with {comparisonSession.employeeName}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Distance Diff</p>
                    <p className={`font-medium ${selectedSession.totalDistance > comparisonSession.totalDistance
                      ? 'text-red-600' : 'text-green-600'
                      }`}>
                      {selectedSession.totalDistance > comparisonSession.totalDistance ? '+' : ''}
                      {formatDistance(selectedSession.totalDistance - comparisonSession.totalDistance)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Time Diff</p>
                    <p className={`font-medium ${selectedSession.totalTime > comparisonSession.totalTime
                      ? 'text-red-600' : 'text-green-600'
                      }`}>
                      {selectedSession.totalTime > comparisonSession.totalTime ? '+' : ''}
                      {formatDuration(Math.abs(selectedSession.totalTime - comparisonSession.totalTime))}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Speed Diff</p>
                    <p className={`font-medium ${selectedSession.averageSpeed < comparisonSession.averageSpeed
                      ? 'text-red-600' : 'text-green-600'
                      }`}>
                      {selectedSession.averageSpeed > comparisonSession.averageSpeed ? '+' : ''}
                      {(selectedSession.averageSpeed - comparisonSession.averageSpeed).toFixed(1)} km/h
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Efficiency</p>
                    <p className={`font-medium ${(selectedSession.totalDistance / selectedSession.shipmentsCompleted) <
                      (comparisonSession.totalDistance / comparisonSession.shipmentsCompleted)
                      ? 'text-green-600' : 'text-red-600'
                      }`}>
                      {((selectedSession.totalDistance / selectedSession.shipmentsCompleted) -
                        (comparisonSession.totalDistance / comparisonSession.shipmentsCompleted)).toFixed(1)} km/shipment
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {sessions.length === 0 && (
        <Alert>
          <MapPin className="h-4 w-4" />
          <AlertDescription>
            No route sessions available for visualization. Complete some routes with GPS tracking to see them here.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { withChartErrorBoundary } from '@/components/ErrorBoundary';
import { RouteSession, RoutePoint } from '@shared/types';
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
  Settings
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface RouteVisualizationProps {
  session_id?: string;
  sessions?: RouteSession[];
  on_session_select?: (sessionId: string) => void;
  show_comparison?: boolean;
  className?: string;
  auto_play?: boolean;
}

function RouteVisualization({
  session_id,
  sessions = [],
  on_session_select,
  show_comparison = false,
  auto_play = false
}: RouteVisualizationProps) {
  const [selected_session, set_selected_session] = useState<RouteSession | null>(null);
  const [comparison_session, set_comparison_session] = useState<RouteSession | null>(null);
  const [is_playing, set_is_playing] = useState(auto_play);
  const [playback_speed, set_playback_speed] = useState(1);
  const [current_point_index, set_current_point_index] = useState(0);
  const [show_settings, set_show_settings] = useState(false);
  const [map_style, set_map_style] = useState('openstreetmap');
  const [show_heatmap, set_show_heatmap] = useState(false);

  const playback_interval_ref = useRef<NodeJS.Timeout | null>(null);

  // Load session data
  useEffect(() => {
    if (session_id && sessions.length > 0) {
      const session = sessions.find(s => s.id === session_id);
      if (session) {
        set_selected_session(session);
        set_current_point_index(0);
      }
    }
  }, [session_id, sessions]);

  // Auto-play functionality
  useEffect(() => {
    if (is_playing && selected_session && selected_session.points && selected_session.points.length > 0) {
      const interval = 1000 / playback_speed; // Adjust speed

      playback_interval_ref.current = setInterval(() => {
        set_current_point_index(prev => {
          const nextIndex = prev + 1;
          if (nextIndex >= (selected_session.points?.length || 0)) {
            set_is_playing(false);
            return prev;
          }
          return nextIndex;
        });
      }, interval);
    } else {
      if (playback_interval_ref.current) {
        clearInterval(playback_interval_ref.current);
        playback_interval_ref.current = null;
      }
    }

    return () => {
      if (playback_interval_ref.current) {
        clearInterval(playback_interval_ref.current);
      }
    };
  }, [is_playing, playback_speed, selected_session]);

  // Component to handle map updates during playback
  function MapUpdater({ session, point_index }: { session: RouteSession | null; point_index: number }) {
    const map = useMap();

    useEffect(() => {
      if (!session || !session.points || session.points.length === 0) return;

      const currentPoint = session.points[point_index];
      if (currentPoint) {
        map.setView([currentPoint.latitude, currentPoint.longitude], 15);
      } else if (session.points.length > 0) {
        // Fit bounds to entire route
        const bounds = L.latLngBounds(
          session.points.map(p => [p.latitude, p.longitude] as [number, number])
        );
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }, [map, session, point_index]);

    return null;
  }

  const handle_session_select = (session: RouteSession) => {
    set_selected_session(session);
    set_current_point_index(0);
    set_is_playing(false);
    on_session_select?.(session.id);
  };

  const handle_play_pause = () => {
    set_is_playing(!is_playing);
  };

  const handle_stop = () => {
    set_is_playing(false);
    set_current_point_index(0);
  };

  const handle_skip_to_start = () => {
    set_current_point_index(0);
    set_is_playing(false);
  };

  const handle_skip_to_end = () => {
    if (selected_session && selected_session.points) {
      set_current_point_index(selected_session.points.length - 1);
      set_is_playing(false);
    }
  };

  const handle_slider_change = (value: number[]) => {
    set_current_point_index(value[0]);
    set_is_playing(false);
  };

  const format_duration = (seconds: number): string => {
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

  const format_distance = (km: number): string => {
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)}km`;
  };

  const get_current_point = (): RoutePoint | null => {
    if (!selected_session || !selected_session.points || current_point_index >= selected_session.points.length) {
      return null;
    }
    return selected_session.points[current_point_index];
  };

  const get_route_progress = (): number => {
    if (!selected_session || !selected_session.points || selected_session.points.length === 0) return 0;
    return (current_point_index / (selected_session.points.length - 1)) * 100;
  };

  const get_playback_time = (): string => {
    const currentPoint = get_current_point();
    if (!currentPoint || !selected_session) return '00:00:00';

    const start_time = new Date(selected_session.start_time).getTime();
    const current_time = new Date(currentPoint.timestamp).getTime();
    const elapsed = Math.floor((current_time - start_time) / 1000);

    return format_duration(elapsed);
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
              {selected_session && (
                <Badge variant="outline">
                  {selected_session.employee_name}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => set_show_settings(!show_settings)}
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
              value={selected_session?.id || ''}
              onValueChange={(value) => {
                const session = sessions.find(s => s.id === value);
                if (session) handle_session_select(session);
              }}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a route session" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.employee_name} - {new Date(session.start_time).toLocaleDateString()}
                    ({format_distance(session.total_distance || 0)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {show_comparison && (
              <Select
                value={comparison_session?.id || ''}
                onValueChange={(value) => {
                  const session = sessions.find(s => s.id === value);
                  set_comparison_session(session || null);
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Compare with..." />
                </SelectTrigger>
                <SelectContent>
                  {sessions
                    .filter(s => s.id !== selected_session?.id)
                    .map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.employee_name} - {new Date(session.start_time).toLocaleDateString()}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Settings Panel */}
          {show_settings && (
            <div className="p-3 bg-gray-50 rounded-md space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Map Style</label>
                  <Select value={map_style} onValueChange={set_map_style}>
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
                    checked={show_heatmap}
                    onChange={(e) => set_show_heatmap(e.target.checked)}
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
          {selected_session && selected_session.points && selected_session.points.length > 0 ? (
            <MapContainer
              center={[selected_session.points[0].latitude, selected_session.points[0].longitude]}
              zoom={13}
              style={{ height: '100%', width: '100%', zIndex: 0 }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapUpdater session={selected_session} point_index={current_point_index} />

              {/* Route polyline */}
              <Polyline
                positions={selected_session.points.map(p => [p.latitude, p.longitude] as [number, number])}
                color="#3b82f6"
                weight={4}
                opacity={0.7}
              />

              {/* Start marker */}
              {selected_session.points[0] && (
                <Marker position={[selected_session.points[0].latitude, selected_session.points[0].longitude]}>
                  <Popup>
                    <div className="text-sm">
                      <strong>Start</strong><br />
                      {new Date(selected_session.points[0].timestamp).toLocaleString()}
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Current position marker */}
              {selected_session.points[current_point_index] && (
                <Marker
                  position={[
                    selected_session.points[current_point_index].latitude,
                    selected_session.points[current_point_index].longitude
                  ]}
                  icon={L.divIcon({
                    className: 'current-position-marker',
                    html: '<div style="background-color: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                  })}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong>Current Position</strong><br />
                      {new Date(selected_session.points[current_point_index].timestamp).toLocaleString()}<br />
                      Speed: {selected_session.points[current_point_index].speed?.toFixed(1) || 'N/A'} km/h
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* End marker */}
              {selected_session.points.length > 1 && selected_session.points[selected_session.points.length - 1] && (
                <Marker
                  position={[
                    selected_session.points[selected_session.points.length - 1].latitude,
                    selected_session.points[selected_session.points.length - 1].longitude
                  ]}
                  icon={L.divIcon({
                    className: 'end-marker',
                    html: '<div style="background-color: #22c55e; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                  })}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong>End</strong><br />
                      {new Date(selected_session.points[selected_session.points.length - 1].timestamp).toLocaleString()}
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Event markers (pickup/delivery) */}
              {selected_session.points
                .filter(p => p.event_type === 'pickup' || p.event_type === 'delivery')
                .map((point, idx) => (
                  <Marker
                    key={`event-${idx}`}
                    position={[point.latitude, point.longitude]}
                    icon={L.divIcon({
                      className: 'event-marker',
                      html: `<div style="background-color: ${point.event_type === 'pickup' ? '#10b981' : '#3b82f6'}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                      iconSize: [16, 16],
                      iconAnchor: [8, 8]
                    })}
                  >
                    <Popup>
                      <div className="text-sm">
                        <strong>{point.event_type === 'pickup' ? 'Pickup' : 'Delivery'}</strong><br />
                        {new Date(point.timestamp).toLocaleString()}
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          ) : selected_session ? (
            <div className="w-full h-full bg-gray-100 rounded-md flex items-center justify-center">
              <div className="text-center space-y-2">
                <MapPin className="h-12 w-12 mx-auto text-gray-400" />
                <p className="text-lg text-gray-600">No route points available</p>
              </div>
            </div>
          ) : (
            <div className="w-full h-full bg-gray-100 rounded-md flex items-center justify-center">
              <div className="text-center space-y-2">
                <MapPin className="h-12 w-12 mx-auto text-gray-400" />
                <p className="text-lg text-gray-600">Select a route to visualize</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Playback Controls */}
      {selected_session && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Timeline Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Route Progress</span>
                <span>{get_route_progress().toFixed(1)}%</span>
              </div>
              <Slider
                value={[current_point_index]}
                onValueChange={handle_slider_change}
                max={Math.max(0, (selected_session.points?.length || 1) - 1)}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{new Date(selected_session.start_time).toLocaleTimeString()}</span>
                <span>Current: {get_playback_time()}</span>
                <span>
                  {selected_session.end_time
                    ? new Date(selected_session.end_time).toLocaleTimeString()
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
                onClick={handle_skip_to_start}
                disabled={current_point_index === 0}
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <Button
                variant={is_playing ? "default" : "outline"}
                size="sm"
                onClick={handle_play_pause}
                disabled={(selected_session.points?.length || 0) === 0}
              >
                {is_playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handle_stop}
                disabled={!is_playing && current_point_index === 0}
              >
                <Square className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handle_skip_to_end}
                disabled={current_point_index >= (selected_session.points?.length || 1) - 1}
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
                    variant={playback_speed === speed ? "default" : "outline"}
                    size="sm"
                    onClick={() => set_playback_speed(speed)}
                  >
                    {speed}x
                  </Button>
                ))}
              </div>
            </div>

            {/* Current Point Info */}
            {get_current_point() && (
              <div className="p-3 bg-blue-50 rounded-md">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Position:</span>
                    <div className="font-mono text-xs">
                      {get_current_point()!.latitude.toFixed(6)}, {get_current_point()!.longitude.toFixed(6)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Time:</span>
                    <div>{new Date(get_current_point()!.timestamp).toLocaleTimeString()}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Accuracy:</span>
                    <div>±{get_current_point()!.accuracy || 0}m</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Speed:</span>
                    <div>{get_current_point()!.speed ? `${get_current_point()!.speed!.toFixed(1)} km/h` : 'N/A'}</div>
                  </div>
                </div>
                {get_current_point()!.event_type && (
                  <div className="mt-2">
                    <Badge className={
                      get_current_point()!.event_type === 'pickup' ? 'bg-green-100 text-green-800' :
                        get_current_point()!.event_type === 'delivery' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                    }>
                      {get_current_point()!.event_type === 'pickup' ? 'Pickup Event' :
                        get_current_point()!.event_type === 'delivery' ? 'Delivery Event' :
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
      {selected_session && (
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
                  <p className="font-medium">{format_distance(selected_session.total_distance || 0)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="font-medium">{format_duration(selected_session.total_time || 0)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-xs text-gray-500">Avg Speed</p>
                  <p className="font-medium">{(selected_session.average_speed || 0).toFixed(1)} km/h</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-xs text-gray-500">Shipments</p>
                  <p className="font-medium">{selected_session.shipments_completed || 0}</p>
                </div>
              </div>
            </div>

            {/* Comparison Stats */}
            {comparison_session && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium mb-2">Comparison with {comparison_session.employee_name}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Distance Diff</p>
                    <p className={`font-medium ${(selected_session.total_distance || 0) > (comparison_session.total_distance || 0)
                      ? 'text-red-600' : 'text-green-600'
                      }`}>
                      {(selected_session.total_distance || 0) > (comparison_session.total_distance || 0) ? '+' : ''}
                      {format_distance((selected_session.total_distance || 0) - (comparison_session.total_distance || 0))}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Time Diff</p>
                    <p className={`font-medium ${(selected_session.total_time || 0) > (comparison_session.total_time || 0)
                      ? 'text-red-600' : 'text-green-600'
                      }`}>
                      {(selected_session.total_time || 0) > (comparison_session.total_time || 0) ? '+' : ''}
                      {format_duration(Math.abs((selected_session.total_time || 0) - (comparison_session.total_time || 0)))}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Speed Diff</p>
                    <p className={`font-medium ${(selected_session.average_speed || 0) < (comparison_session.average_speed || 0)
                      ? 'text-red-600' : 'text-green-600'
                      }`}>
                      {(selected_session.average_speed || 0) > (comparison_session.average_speed || 0) ? '+' : ''}
                      {((selected_session.average_speed || 0) - (comparison_session.average_speed || 0)).toFixed(1)} km/h
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Efficiency</p>
                    <p className={`font-medium ${((selected_session.total_distance || 0) / (selected_session.shipments_completed || 1)) <
                      ((comparison_session.total_distance || 0) / (comparison_session.shipments_completed || 1))
                      ? 'text-green-600' : 'text-red-600'
                      }`}>
                      {(((selected_session.total_distance || 0) / (selected_session.shipments_completed || 1)) -
                        ((comparison_session.total_distance || 0) / (comparison_session.shipments_completed || 1))).toFixed(1)} km/shipment
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

export default withChartErrorBoundary(RouteVisualization, {
  componentName: 'RouteVisualization'
});
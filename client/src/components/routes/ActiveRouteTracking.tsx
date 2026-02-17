import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Navigation, CheckCircle2, Package, User, Phone, XCircle, Zap, ExternalLink } from 'lucide-react';
import DropPointMap from '../tracking/DropPointMap';
import { useRouteOptimization } from '@/hooks/useRouteOptimization';
import { Shipment, RouteLocation } from '@shared/types';
import { withComponentErrorBoundary } from '@/components/ErrorBoundary';

/** Build Google Maps URL for full route: origin → waypoints → destination (opens in nav mode). */
function buildGoogleMapsRouteUrl(
  current_location: { latitude: number; longitude: number } | undefined,
  optimized_path: RouteLocation[]
): string | null {
  const has_path = optimized_path && optimized_path.length > 0;
  const has_current = current_location?.latitude != null && current_location?.longitude != null;
  if (!has_path && !has_current) return null;

  let origin: string;
  let destination: string;
  let waypoints: string[] = [];

  if (has_path && has_current) {
    origin = `${current_location!.latitude},${current_location!.longitude}`;
    if (optimized_path.length === 1) {
      destination = `${optimized_path[0].latitude},${optimized_path[0].longitude}`;
    } else {
      destination = `${optimized_path[optimized_path.length - 1].latitude},${optimized_path[optimized_path.length - 1].longitude}`;
      waypoints = optimized_path.slice(0, -1).map(l => `${l.latitude},${l.longitude}`);
    }
  } else if (has_path) {
    origin = `${optimized_path[0].latitude},${optimized_path[0].longitude}`;
    if (optimized_path.length === 1) return null;
    destination = `${optimized_path[optimized_path.length - 1].latitude},${optimized_path[optimized_path.length - 1].longitude}`;
    waypoints = optimized_path.slice(1, -1).map(l => `${l.latitude},${l.longitude}`);
  } else {
    return null;
  }

  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    ...(waypoints.length > 0 && { waypoints: waypoints.join('|') }),
    dir_action: 'navigate'
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

interface ActiveRouteTrackingProps {
  sessionId: string;
  currentLocation?: { latitude: number; longitude: number };
}

function ActiveRouteTracking({ sessionId: session_id, currentLocation: current_location }: ActiveRouteTrackingProps) {
  const {
    shipments,
    optimizedPath: optimized_path,
    isLoadingShipments: is_loading_shipments,
    nearestPoint: nearest_point,
    bulkUpdateStatus,
    skipShipment
  } = useRouteOptimization({ session_id, current_location });

  const [selected_point_shipments, set_selected_point_shipments] = useState<Shipment[] | null>(null);
  const [is_updating, set_is_updating] = useState(false);

  const active_shipments = shipments.filter(s => s.status !== 'Delivered' && s.status !== 'Cancelled');

  const google_maps_route_url = useMemo(
    () => buildGoogleMapsRouteUrl(current_location, optimized_path),
    [current_location, optimized_path]
  );

  const handle_arrived = async (target_shipments: Shipment[]) => {
    if (is_updating) return;
    set_is_updating(true);
    try {
      await bulkUpdateStatus(target_shipments, 'delivery');
      set_selected_point_shipments(null);
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      set_is_updating(false);
    }
  };

  // Auto-delivery effect
  useEffect(() => {
    if (!nearest_point || is_updating) return;

    const saved_config = localStorage.getItem('riderpro_smart_completion_config');
    const config = saved_config ? JSON.parse(saved_config) : { auto_deliver: false };

    if (config.auto_deliver) {
      console.log('Auto-delivery triggered for:', nearest_point.map(s => s.id));
      handle_arrived(nearest_point);
    }
  }, [nearest_point]);

  if (is_loading_shipments) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <Skeleton className="h-[200px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Map Section */}
      <Card className="lg:col-span-2 overflow-hidden border-none shadow-xl bg-card/30 backdrop-blur-md">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-xl flex items-center gap-2">
              <Navigation className="w-5 h-5 text-primary" />
              Live Route Tracking
            </CardTitle>
            <div className="flex items-center gap-2">
              {google_maps_route_url && (
                <Button
                  variant="default"
                  size="sm"
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => window.open(google_maps_route_url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in Google Maps
                </Button>
              )}
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {active_shipments.length} Pending
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 h-[500px]">
          <DropPointMap
            shipments={active_shipments}
            currentLocation={current_location}
            optimizedPath={optimized_path}
            onDropPointSelect={set_selected_point_shipments}
          />
        </CardContent>
      </Card>

      {/* Control & List Section */}
      <div className="space-y-6">
        {/* Proximity Alert / Action Card */}
        {nearest_point && (
          <Card className="border-primary/50 bg-primary/5 shadow-lg animate-pulse">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-primary/20 p-2 rounded-full">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-primary flex items-center gap-2">
                    Arrived!
                    {localStorage.getItem('riderpro_smart_completion_config')?.includes('"auto_deliver":true') && (
                      <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    At {nearest_point[0].address_display || (typeof nearest_point[0].address === 'string' ? nearest_point[0].address : '')}
                  </p>
                </div>
              </div>
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold"
                onClick={() => handle_arrived(nearest_point)}
                disabled={is_updating}
              >
                {is_updating ? 'Updating...' : `Mark ${nearest_point.length} as Delivered`}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Selected Point Details */}
        {selected_point_shipments && !nearest_point && (
          <Card className="border-blue-500/30 bg-blue-500/5 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Selected Drop Point
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                {selected_point_shipments[0].address_display || (typeof selected_point_shipments[0].address === 'string' ? selected_point_shipments[0].address : '')}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => handle_arrived(selected_point_shipments)}
                disabled={is_updating}
              >
                Manual Mark as Delivered
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Shipment List */}
        <Card className="border-none shadow-xl bg-card/30 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5" />
              Shipments in Route
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="p-4 space-y-3">
                {active_shipments.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p>All deliveries completed!</p>
                  </div>
                ) : (
                  active_shipments.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-lg border border-border/50 bg-background/50 hover:bg-background/80 transition-colors group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-sm truncate max-w-[120px]">
                          {s.customer_name}
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="secondary" className="text-[9px] uppercase font-bold py-0 h-4">
                            {s.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 text-muted-foreground hover:text-destructive p-0"
                            onClick={() => skipShipment(s.id)}
                            title="Skip for now"
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="w-3 h-3" />
                          <span>ID: {String(s.id).slice(-8)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{s.address_display || (typeof s.address === 'string' ? s.address : '')}</span>
                        </div>
                        {s.customer_mobile && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            <span>{s.customer_mobile}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 flex justify-between items-center">
                        {s.latitude && s.longitude && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[9px] flex items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`, '_blank')}
                          >
                            <Navigation className="w-3 h-3" />
                            Navigate
                          </Button>
                        )}
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-[10px] text-primary ml-auto"
                          onClick={() => handle_arrived([s])}
                        >
                          Mark Delivered
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default withComponentErrorBoundary(ActiveRouteTracking, {
  componentName: 'ActiveRouteTracking'
});

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
  currentLocation: { latitude: number; longitude: number } | undefined,
  optimizedPath: RouteLocation[]
): string | null {
  const hasPath = optimizedPath && optimizedPath.length > 0;
  const hasCurrent = currentLocation?.latitude != null && currentLocation?.longitude != null;
  if (!hasPath && !hasCurrent) return null;

  let origin: string;
  let destination: string;
  let waypoints: string[] = [];

  if (hasPath && hasCurrent) {
    origin = `${currentLocation!.latitude},${currentLocation!.longitude}`;
    if (optimizedPath.length === 1) {
      destination = `${optimizedPath[0].latitude},${optimizedPath[0].longitude}`;
    } else {
      destination = `${optimizedPath[optimizedPath.length - 1].latitude},${optimizedPath[optimizedPath.length - 1].longitude}`;
      waypoints = optimizedPath.slice(0, -1).map(l => `${l.latitude},${l.longitude}`);
    }
  } else if (hasPath) {
    origin = `${optimizedPath[0].latitude},${optimizedPath[0].longitude}`;
    if (optimizedPath.length === 1) return null;
    destination = `${optimizedPath[optimizedPath.length - 1].latitude},${optimizedPath[optimizedPath.length - 1].longitude}`;
    waypoints = optimizedPath.slice(1, -1).map(l => `${l.latitude},${l.longitude}`);
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

function ActiveRouteTracking({ sessionId, currentLocation }: ActiveRouteTrackingProps) {
  const {
    shipments,
    optimizedPath,
    isOptimizing,
    isLoadingShipments,
    nearestPoint,
    runtimeConfig,
    bulkUpdateStatus,
    skipShipment
  } = useRouteOptimization({ sessionId, currentLocation });

  const [selectedPointShipments, setSelectedPointShipments] = useState<Shipment[] | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const activeShipments = shipments.filter(s => s.status !== 'Delivered' && s.status !== 'Cancelled');

  const googleMapsRouteUrl = useMemo(
    () => buildGoogleMapsRouteUrl(currentLocation, optimizedPath),
    [currentLocation, optimizedPath]
  );

  const handleArrived = async (targetShipments: Shipment[]) => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      await bulkUpdateStatus(targetShipments, 'delivery');
      setSelectedPointShipments(null);
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Auto-delivery effect
  useEffect(() => {
    if (!nearestPoint || isUpdating) return;

    if (runtimeConfig.autoDeliver) {
      console.log('Auto-delivery triggered for:', nearestPoint.map(s => s.shipment_id));
      handleArrived(nearestPoint);
    }
  }, [nearestPoint, runtimeConfig.autoDeliver]);

  if (isLoadingShipments) {
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
              {googleMapsRouteUrl && (
                <Button
                  variant="default"
                  size="sm"
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => window.open(googleMapsRouteUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in Google Maps
                </Button>
              )}
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {activeShipments.length} Pending
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 h-[500px]">
          <DropPointMap
            shipments={activeShipments}
            currentLocation={currentLocation}
            optimizedPath={optimizedPath}
            onDropPointSelect={setSelectedPointShipments}
          />
        </CardContent>
      </Card>

      {/* Control & List Section */}
      <div className="space-y-6">
        {/* Proximity Alert / Action Card */}
        {nearestPoint && (
          <Card className="border-primary/50 bg-primary/5 shadow-lg animate-pulse">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-primary/20 p-2 rounded-full">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-primary flex items-center gap-2">
                    Arrived!
                    {runtimeConfig.autoDeliver && (
                      <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    At {nearestPoint[0].addressDisplay || nearestPoint[0].deliveryAddress}
                  </p>
                </div>
              </div>
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold"
                onClick={() => handleArrived(nearestPoint)}
                disabled={isUpdating}
              >
                {isUpdating ? 'Updating...' : `Mark ${nearestPoint.length} as Delivered`}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Selected Point Details */}
        {selectedPointShipments && !nearestPoint && (
          <Card className="border-blue-500/30 bg-blue-500/5 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Selected Drop Point
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                {selectedPointShipments[0].addressDisplay || selectedPointShipments[0].deliveryAddress}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => handleArrived(selectedPointShipments)}
                disabled={isUpdating}
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
                {activeShipments.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p>All deliveries completed!</p>
                  </div>
                ) : (
                  activeShipments.map((s) => (
                    <div
                      key={s.shipment_id}
                      className="p-3 rounded-lg border border-border/50 bg-background/50 hover:bg-background/80 transition-colors group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-sm truncate max-w-[120px]">
                          {s.customerName}
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="secondary" className="text-[9px] uppercase font-bold py-0 h-4">
                            {s.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 text-muted-foreground hover:text-destructive p-0"
                            onClick={() => skipShipment(s.shipment_id)}
                            title="Skip for now"
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="w-3 h-3" />
                          <span>ID: {s.shipment_id.slice(-8)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{s.addressDisplay || s.deliveryAddress}</span>
                        </div>
                        {s.recipientPhone && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            <span>{s.recipientPhone}</span>
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
                          onClick={() => handleArrived([s])}
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

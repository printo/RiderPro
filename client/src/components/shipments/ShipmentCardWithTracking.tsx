import { useState } from "react";
import { Shipment } from "@shared/types";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Truck, Package, MapPin, Phone, Route, Clock,
  Navigation, Satellite, User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouteTracking } from "@/hooks/useRouteAPI";
import { useGPSTracking } from "@/hooks/useGPSTracking";
import { useToast } from "@/hooks/use-toast";
import { withComponentErrorBoundary } from "@/components/ErrorBoundary";

interface ShipmentCardWithTrackingProps {
  shipment: Shipment;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onViewDetails: () => void;
  employeeId: string;
  showTrackingControls?: boolean;
}

function ShipmentCardWithTracking({
  shipment,
  selected,
  onSelect,
  onViewDetails,
  employeeId,
  showTrackingControls = true
}: ShipmentCardWithTrackingProps) {
  const [isRecordingEvent, setIsRecordingEvent] = useState(false);
  const { toast } = useToast();

  const {
    hasActiveSession,
    recordShipmentEvent,
    isSubmitting
  } = useRouteTracking(employeeId);

  const {
    getCurrentPosition,
    isLoading: isGettingLocation
  } = useGPSTracking();

  const getTypeIcon = (type: string) => {
    return type === "delivery" ? (
      <Truck className="text-blue-600 h-5 w-5" />
    ) : (
      <Package className="text-orange-600 h-5 w-5" />
    );
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return 'Not scheduled';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString || 'Not scheduled';
    }
  };

  const formatAddress = (address: any): string => {
    if (!address) return 'No address';
    
    // If it's already a string, return it
    if (typeof address === 'string') {
      return address;
    }
    
    // If it's an object, format it
    if (typeof address === 'object' && address !== null) {
      const parts: string[] = [];
      
      // Try common address field names
      if (address.address) parts.push(String(address.address));
      if (address.place_name) parts.push(String(address.place_name));
      if (address.city) parts.push(String(address.city));
      if (address.state) parts.push(String(address.state));
      if (address.pincode) parts.push(String(address.pincode));
      if (address.country) parts.push(String(address.country));
      
      return parts.length > 0 ? parts.join(', ') : 'No address';
    }
    
    return 'No address';
  };

  const handleRecordShipmentEvent = async (eventType: 'pickup' | 'delivery') => {
    if (!hasActiveSession) {
      toast({
        title: "No Active Route",
        description: "Please start route tracking before recording shipment events.",
        variant: "destructive",
      });
      return;
    }

    setIsRecordingEvent(true);

    try {
      // Get current GPS position
      const position = await getCurrentPosition();

      // Record the shipment event with GPS coordinates
      if (!shipment?.shipment_id) {
        throw new Error('Shipment ID is missing');
      }

      await recordShipmentEvent(
        shipment.shipment_id,
        eventType,
        position.latitude,
        position.longitude
      );

      toast({
        title: "Location Recorded",
        description: `${eventType === 'pickup' ? 'Pickup' : 'Delivery'} location has been recorded with GPS coordinates.`,
      });

    } catch (error) {
      console.error('Failed to record shipment event:', error);
      toast({
        title: "Recording Failed",
        description: `Failed to record ${eventType} location. The shipment status will still be updated.`,
        variant: "destructive",
      });
    } finally {
      setIsRecordingEvent(false);
    }
  };

  const canRecordPickup = () => {
    return shipment?.type === 'pickup' &&
      shipment?.status === 'Assigned' &&
      hasActiveSession;
  };

  const canRecordDelivery = () => {
    return shipment?.type === 'delivery' &&
      shipment?.status === 'Assigned' &&
      hasActiveSession;
  };

  const getTrackingStatusBadge = () => {
    // Show GPS indicator based on whether there's an active session
    if (hasActiveSession) {
      return (
        <div className="flex items-center" title="GPS tracking active">
          <Satellite className="h-4 w-4 text-green-600" />
        </div>
      );
    }

    return (
      <div className="flex items-center" title="No GPS tracking">
        <Satellite className="h-4 w-4 text-gray-400" />
      </div>
    );
  };

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      data-testid={`card-shipment-${shipment?.shipment_id}`}
      onClick={onViewDetails}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelect(!!checked)}
              className="mt-1"
              data-testid={`checkbox-select-${shipment?.shipment_id}`}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  "p-2 rounded-lg",
                  shipment?.type === "delivery" ? "bg-blue-100" : "bg-orange-100"
                )}>
                  {getTypeIcon(shipment?.type || 'delivery')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground" data-testid={`text-customer-name-${shipment?.shipment_id}`}>
                      {shipment?.customerName || shipment?.recipientName || 'Unknown Customer'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-2 py-1 text-xs font-medium rounded-full",
                          shipment?.status === 'Delivered' ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                            shipment?.status === 'Picked Up' ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                              shipment?.status === 'In Transit' ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
                                shipment?.status === 'Assigned' ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                                  shipment?.status === 'Cancelled' ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                                    shipment?.status === 'Returned' ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" :
                                      "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                        )}
                        data-testid={`text-status-${shipment?.shipment_id}`}
                      >
                        {shipment?.status || 'Unknown'}
                      </span>
                      {getTrackingStatusBadge()}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    <p data-testid={`text-shipment-id-${shipment?.shipment_id}`}>
                      Shipment ID: #{shipment?.shipment_id || 'Unknown ID'}
                    </p>
                    <p data-testid={`text-pops-order-id-${shipment?.shipment_id}`}>
                      Pia Order ID: {shipment?.orderId || (shipment as Shipment & { pops_order_id?: number })?.pops_order_id || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
                <div className="flex items-center text-muted-foreground">
                  <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span
                    className="truncate"
                    title={formatAddress(shipment?.addressDisplay || shipment?.address || shipment?.deliveryAddress)}
                    data-testid={`text-address-${shipment?.shipment_id}`}
                  >
                    {formatAddress(shipment?.addressDisplay || shipment?.address || shipment?.deliveryAddress)}
                  </span>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span data-testid={`text-mobile-${shipment?.shipment_id}`}>
                    {shipment?.customerMobile || shipment?.recipientPhone || 'No phone'}
                  </span>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Route className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span data-testid={`text-route-${shipment?.shipment_id}`}>
                    {shipment?.routeName || 'Not assigned'}
                  </span>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <User className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span data-testid={`text-rider-${shipment?.shipment_id}`} className="font-medium">
                    {shipment?.employeeId || (shipment as Shipment & { employee_id?: string })?.employee_id || 'Unassigned'}
                  </span>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span data-testid={`text-delivery-time-${shipment?.shipment_id}`}>
                    {formatTime(shipment?.deliveryTime || shipment?.estimatedDeliveryTime)}
                  </span>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Satellite className={`h-4 w-4 mr-2 flex-shrink-0 ${shipment?.latitude && shipment?.longitude ? 'animate-pulse text-green-600' : 'text-gray-500'}`} />
                  <span data-testid={`text-location-${shipment?.shipment_id}`}>
                    {shipment?.latitude && shipment?.longitude ? (
                      <span className="text-green-600 dark:text-green-400">
                        GPS Available
                      </span>
                    ) : (
                      <span className="text-gray-500">
                        No GPS Data
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* GPS Tracking Controls */}
              {showTrackingControls && (canRecordPickup() || canRecordDelivery()) && (
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-xs text-muted-foreground">GPS Tracking:</span>

                  {canRecordPickup() && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRecordShipmentEvent('pickup');
                      }}
                      disabled={isRecordingEvent || isGettingLocation || isSubmitting}
                      className="h-7 px-2 text-xs"
                      data-testid={`btn-record-pickup-${shipment?.shipment_id}`}
                    >
                      <Navigation className="h-3 w-3 mr-1" />
                      Record Pickup
                    </Button>
                  )}

                  {canRecordDelivery() && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRecordShipmentEvent('delivery');
                      }}
                      disabled={isRecordingEvent || isGettingLocation || isSubmitting}
                      className="h-7 px-2 text-xs"
                      data-testid={`btn-record-delivery-${shipment?.shipment_id}`}
                    >
                      <Navigation className="h-3 w-3 mr-1" />
                      Record Delivery
                    </Button>
                  )}

                  {(isRecordingEvent || isGettingLocation || isSubmitting) && (
                    <span className="text-xs text-muted-foreground">
                      Recording location...
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} export
  default withComponentErrorBoundary(ShipmentCardWithTracking, {
    componentVariant: 'card',
    componentName: 'ShipmentCardWithTracking'
  });
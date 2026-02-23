import { useState } from "react";
import { Shipment } from "@shared/types";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Truck, Package, MapPin, Phone, Route, Clock,
  Navigation, Satellite, User, CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouteTracking } from "@/hooks/useRouteAPI";
import { useGPSTracking } from "@/hooks/useGPSTracking";
import { useToast } from "@/hooks/use-toast";
import { withComponentErrorBoundary } from "@/components/ErrorBoundary";

// Reusable Components
const InfoRow = ({ icon: Icon, children, className = "" }: {
  icon: any;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
    <Icon className="h-4 w-4 flex-shrink-0 text-gray-500" />
    <span className="truncate">{children}</span>
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'Delivered':
      case 'Picked Up':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'Skipped':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'In Transit':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Assigned':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'Cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'Returned':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <span className={cn(
      "px-2 py-1 text-xs font-medium rounded-full",
      getStatusStyles(status)
    )}>
      {status || 'Unknown'}
    </span>
  );
};

interface ShipmentCardProps {
  shipment: Shipment;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onViewDetails: () => void;
  employeeId: string;
  variant?: 'dashboard' | 'list';
  showTrackingControls?: boolean;
  showIndividualActions?: boolean;
  onBulkAction?: (action: string) => void;
  selectedCount?: number;
  onClearSelection?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function ShipmentCard({
  shipment,
  selected,
  onSelect,
  onViewDetails,
  employeeId: employee_id,
  variant = 'list',
  showTrackingControls = true,
  showIndividualActions = true,
  onBulkAction,
  selectedCount = 0,
  onClearSelection,
  onRefresh,
  isRefreshing = false
}: ShipmentCardProps) {
  const [is_recording_event, set_is_recording_event] = useState(false);
  const { toast } = useToast();

  const {
    hasActiveSession,
    recordShipmentEvent,
    isSubmitting
  } = useRouteTracking(employee_id);

  const {
    getCurrentPosition,
    isLoading: is_getting_location
  } = useGPSTracking();

  const format_time = (date_string?: string) => {
    if (!date_string) return 'Not scheduled';
    try {
      const date = new Date(date_string);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return date_string || 'Not scheduled';
    }
  };

  const format_address = (address: any): string => {
    if (!address) return 'No address';
    if (typeof address === 'string') return address;
    if (typeof address === 'object' && address !== null) {
      const parts: string[] = [];
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

  const handle_record_shipment_event = async (event_type: 'pickup' | 'delivery') => {
    if (!hasActiveSession) {
      toast({
        title: "No Active Route",
        description: "Please start route tracking before recording shipment events.",
        variant: "destructive",
      });
      return;
    }

    set_is_recording_event(true);

    try {
      const position = await getCurrentPosition();
      if (!shipment?.id) {
        throw new Error('Shipment ID is missing');
      }

      await recordShipmentEvent(
        shipment.id,
        event_type,
        position.latitude,
        position.longitude
      );

      toast({
        title: "Location Recorded",
        description: `${event_type === 'pickup' ? 'Pickup' : 'Delivery'} location has been recorded with GPS coordinates.`,
      });

    } catch (error) {
      console.error('Failed to record shipment event:', error);
      toast({
        title: "Recording Failed",
        description: `Failed to record ${event_type} location. The shipment status will still be updated.`,
        variant: "destructive",
      });
    } finally {
      set_is_recording_event(false);
    }
  };

  const can_record_pickup = () => {
    return shipment?.type === 'pickup' &&
      shipment?.status === 'Assigned' &&
      hasActiveSession;
  };

  const can_record_delivery = () => {
    return shipment?.type === 'delivery' &&
      shipment?.status === 'Assigned' &&
      hasActiveSession;
  };

  const get_tracking_status_badge = () => {
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

  // Dashboard variant - simplified card
  if (variant === 'dashboard') {
    return (
      <div 
        className={cn(
          "w-full bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm cursor-pointer transition-colors hover:bg-gray-100",
          selected && "bg-blue-50 border-blue-200"
        )}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
            return;
          }
          onSelect(!selected);
        }}
      >
        <div className="space-y-3">
          {/* Header Section */}
          <div className="flex items-center justify-between">
            {/* Left Side - Icon + Title Block */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                {shipment?.type === "delivery" ? (
                  <Truck className="text-blue-600 h-5 w-5" />
                ) : (
                  <Package className="text-orange-600 h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-base text-foreground">
                  Shipment ID: #{shipment.pops_order_id || 'Unknown'}
                </h3>
                <p className="text-sm text-muted-foreground font-medium">
                  Store: {shipment.customer_name || 'Unknown Store'}
                </p>
              </div>
            </div>

            {/* Right Side - Status + Checkbox */}
            <div className="flex items-center gap-2">
              <StatusBadge status={shipment.status || 'Unknown'} />
              <Checkbox
                checked={selected}
                onCheckedChange={(checked) => onSelect(!!checked)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Info Section - Mobile Stacked */}
          <div className="space-y-2">
            <InfoRow icon={Route}>
              {shipment.route_name || 'Not assigned'}
            </InfoRow>
            <InfoRow icon={MapPin}>
              {format_address(shipment.address_display || shipment.address)}
            </InfoRow>
          </div>

          {/* Footer Section */}
          {shipment.special_instructions && (
            <>
              <div className="border-t border-gray-200 pt-3">
                <p className="text-sm text-muted-foreground truncate">
                  Special Instruction: {shipment.special_instructions}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // List variant - full featured card with mobile-first design
  return (
    <Card
      className="w-full bg-gray-50 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onViewDetails}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="space-y-4">
          {/* Header Section */}
          <div className="flex items-center justify-between">
            {/* Left Side - Icon + Title Block */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                {shipment?.type === "delivery" ? (
                  <Truck className="text-blue-600 h-5 w-5" />
                ) : (
                  <Package className="text-orange-600 h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-base sm:text-lg text-foreground">
                  Shipment ID: #{shipment.pops_order_id || 'Unknown'}
                </h3>
                <p className="text-sm text-muted-foreground font-medium">
                  Store: {shipment.customer_name || 'Unknown Store'}
                </p>
              </div>
            </div>

            {/* Right Side - Status + Checkbox */}
            <div className="flex items-center gap-2">
              <StatusBadge status={shipment.status || 'Unknown'} />
              {get_tracking_status_badge()}
              <Checkbox
                checked={selected}
                onCheckedChange={(checked) => onSelect(!!checked)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Info Section - Mobile Stacked, Desktop Grid */}
          <div className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0">
            <InfoRow icon={MapPin}>
              {format_address(shipment.address_display || shipment.address)}
            </InfoRow>
            <InfoRow icon={Phone}>
              {shipment.customer_mobile || 'No phone'}
            </InfoRow>
            <InfoRow icon={Route}>
              {shipment.route_name || 'Not assigned'}
            </InfoRow>
            <InfoRow icon={User}>
              {shipment.employee_id || 'Unassigned'}
            </InfoRow>
            <InfoRow icon={Clock}>
              {format_time(shipment.delivery_time)}
            </InfoRow>
            <InfoRow icon={Satellite}>
              {shipment.latitude && shipment.longitude ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center space-x-2">
                    {shipment.type === 'delivery' ? (
                      <Truck className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Package className="h-4 w-4 text-orange-600" />
                    )}
                    <span className="text-sm font-medium">
                      {shipment.type === 'delivery' ? 'Delivery' : 'Pickup'}
                    </span>
                  </div>
                  {shipment.status === 'Collected' && (
                    <div className="flex items-center text-xs text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      <span>Collected</span>
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-gray-500">
                  No GPS Data
                </span>
              )}
            </InfoRow>
          </div>

          {/* GPS Tracking Controls */}
          {showTrackingControls && showIndividualActions && (can_record_pickup() || can_record_delivery()) && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">GPS Tracking:</span>

                {shipment.latitude && shipment.longitude && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${shipment.latitude},${shipment.longitude}`, '_blank');
                    }}
                    className="h-7 px-2 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    <Navigation className="h-3 w-3 mr-1" />
                    Navigate
                  </Button>
                )}

                {can_record_pickup() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handle_record_shipment_event('pickup');
                    }}
                    disabled={is_recording_event || is_getting_location || isSubmitting}
                    className="h-7 px-2 text-xs"
                  >
                    <Truck className="h-3 w-3 mr-1" />
                    Record Pickup
                  </Button>
                )}

                {can_record_delivery() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handle_record_shipment_event('delivery');
                    }}
                    disabled={is_recording_event || is_getting_location || isSubmitting}
                    className="h-7 px-2 text-xs"
                  >
                    <Navigation className="h-3 w-3 mr-1" />
                    Record Delivery
                  </Button>
                )}

                {(is_recording_event || is_getting_location || isSubmitting) && (
                  <span className="text-xs text-muted-foreground">
                    Recording location...
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Footer Section */}
          {shipment.special_instructions && (
            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm text-muted-foreground truncate">
                Special Instruction: {shipment.special_instructions}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default withComponentErrorBoundary(ShipmentCard, {
  componentVariant: 'card',
  componentName: 'ShipmentCard'
});

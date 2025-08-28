import { Shipment } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Truck, Package, MapPin, Phone, Route, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShipmentCardProps {
  shipment: Shipment;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onViewDetails: () => void;
}

export default function ShipmentCard({ shipment, selected, onSelect, onViewDetails }: ShipmentCardProps) {
  const getStatusClass = (status: string) => {
    const statusLower = status.toLowerCase().replace(" ", "-");
    return `status-${statusLower}`;
  };

  const getTypeIcon = (type: string) => {
    return type === "delivery" ? (
      <Truck className="text-blue-600 h-5 w-5" />
    ) : (
      <Package className="text-orange-600 h-5 w-5" />
    );
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-shipment-${shipment.id}`} onClick={onViewDetails}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelect(!!checked)}
              onClick={(e) => e.stopPropagation()}
              className="mt-1"
              data-testid={`checkbox-select-${shipment.id}`}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  "p-2 rounded-lg",
                  shipment.type === "delivery" ? "bg-blue-100" : "bg-orange-100"
                )}>
                  {getTypeIcon(shipment.type)}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground" data-testid={`text-customer-name-${shipment.id}`}>
                    {shipment.customerName}
                  </h3>
                  <p className="text-sm text-muted-foreground" data-testid={`text-shipment-id-${shipment.id}`}>
                    #{shipment.id.slice(-8)}
                  </p>
                </div>
                <span 
                  className={cn(
                    "px-2 py-1 text-xs font-medium rounded-full",
                    getStatusClass(shipment.status)
                  )}
                  data-testid={`text-status-${shipment.id}`}
                >
                  {shipment.status}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center text-muted-foreground">
                  <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span 
                    className="truncate" 
                    title={shipment.address}
                    data-testid={`text-address-${shipment.id}`}
                  >
                    {shipment.address}
                  </span>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span data-testid={`text-mobile-${shipment.id}`}>
                    {shipment.customerMobile}
                  </span>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Route className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span data-testid={`text-route-${shipment.id}`}>
                    {shipment.routeName}
                  </span>
                </div>
                <div className="flex items-center text-muted-foreground">
                  <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span data-testid={`text-delivery-time-${shipment.id}`}>
                    {formatTime(shipment.deliveryTime)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="text-primary p-2">
            <ChevronRight className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

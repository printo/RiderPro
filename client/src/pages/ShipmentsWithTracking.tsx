import { useState } from "react";
import { useShipments } from "@/hooks/useShipments";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, RotateCcw, Navigation, MapPin } from "lucide-react";
import ShipmentCardWithTracking from "@/components/ShipmentCardWithTracking";
import ShipmentDetailModal from "@/components/ShipmentDetailModal";
import BatchUpdateModal from "@/components/BatchUpdateModal";
import RouteSessionControls from "@/components/RouteSessionControls";
import Filters from "@/components/Filters";
import { Shipment, ShipmentFilters } from "@shared/schema";
import { useRouteTracking } from "@/hooks/useRouteAPI";

// Mock employee ID - in a real app, this would come from authentication
const CURRENT_EMPLOYEE_ID = "emp123";

export default function ShipmentsWithTracking() {
  const [filters, setFilters] = useState<ShipmentFilters>({});
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showRouteControls, setShowRouteControls] = useState(true);

  const { data: shipments, isLoading, error, refetch } = useShipments(filters);
  const { hasActiveSession, activeSession } = useRouteTracking(CURRENT_EMPLOYEE_ID);

  const handleShipmentSelect = (shipmentId: string, selected: boolean) => {
    setSelectedShipmentIds(prev =>
      selected
        ? [...prev, shipmentId]
        : prev.filter(id => id !== shipmentId)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected && shipments) {
      setSelectedShipmentIds(shipments.map(s => s.id));
    } else {
      setSelectedShipmentIds([]);
    }
  };

  const handleBatchUpdate = () => {
    if (selectedShipmentIds.length === 0) {
      return;
    }
    setShowBatchModal(true);
  };

  const handleRefresh = () => {
    refetch();
  };

  const toggleRouteControls = () => {
    setShowRouteControls(!showRouteControls);
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-20 w-full mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4 mt-6">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center py-12">
          <p className="text-destructive mb-4" data-testid="text-shipments-error">
            Failed to load shipments. Please try again.
          </p>
          <Button onClick={handleRefresh} data-testid="button-retry">
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Route Tracking Controls */}
      {showRouteControls && (
        <div className="mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <RouteSessionControls
                    employeeId={CURRENT_EMPLOYEE_ID}
                    onSessionStart={() => {
                      console.log('Route session started');
                    }}
                    onSessionStop={() => {
                      console.log('Route session stopped');
                    }}
                  />
                </div>

                {hasActiveSession && (
                  <div className="lg:w-80">
                    <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Navigation className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800 dark:text-blue-400">
                            Active Route Session
                          </span>
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          GPS tracking is active. Shipment pickup/delivery locations will be automatically recorded.
                        </p>
                        {activeSession && (
                          <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                            Session: {activeSession.id.slice(-8)}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card className="mb-6" data-testid="card-filters">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h2 className="text-xl font-semibold text-foreground" data-testid="text-shipments-title">
              Shipments with GPS Tracking
            </h2>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleBatchUpdate}
                disabled={selectedShipmentIds.length === 0}
                className="bg-primary text-primary-foreground"
                data-testid="button-batch-update"
              >
                <Edit className="h-4 w-4 mr-2" />
                Batch Update ({selectedShipmentIds.length})
              </Button>
              <Button
                variant="outline"
                onClick={toggleRouteControls}
                data-testid="button-toggle-tracking"
              >
                <MapPin className="h-4 w-4 mr-2" />
                {showRouteControls ? 'Hide' : 'Show'} Tracking
              </Button>
              <Button
                variant="secondary"
                onClick={handleRefresh}
                data-testid="button-refresh"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          <Filters filters={filters} onFiltersChange={setFilters} />
        </CardContent>
      </Card>

      {/* Shipments List */}
      {!shipments || shipments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground" data-testid="text-no-shipments">
            {filters.status || filters.type || filters.routeName || filters.date
              ? "No shipments match the current filters"
              : "No shipments available"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Select All Control */}
          <div className="flex items-center gap-2 px-2">
            <input
              type="checkbox"
              checked={selectedShipmentIds.length === shipments.length}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="rounded border-gray-300"
              data-testid="checkbox-select-all"
            />
            <span className="text-sm text-muted-foreground">
              Select all ({shipments.length} shipments)
            </span>
            {hasActiveSession && (
              <span className="text-xs text-green-600 dark:text-green-400 ml-4">
                • GPS tracking active - locations will be recorded automatically
              </span>
            )}
          </div>

          {/* Shipment Cards */}
          {shipments.map((shipment) => (
            <ShipmentCardWithTracking
              key={shipment.id}
              shipment={shipment}
              selected={selectedShipmentIds.includes(shipment.id)}
              onSelect={(selected) => handleShipmentSelect(shipment.id, selected)}
              onViewDetails={() => setSelectedShipment(shipment)}
              employeeId={CURRENT_EMPLOYEE_ID}
              showTrackingControls={showRouteControls}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {selectedShipment && (
        <ShipmentDetailModal
          shipment={selectedShipment}
          isOpen={true}
          onClose={() => setSelectedShipment(null)}
        />
      )}

      {showBatchModal && (
        <BatchUpdateModal
          selectedCount={selectedShipmentIds.length}
          selectedIds={selectedShipmentIds}
          isOpen={showBatchModal}
          onClose={() => setShowBatchModal(false)}
          onSuccess={() => {
            setSelectedShipmentIds([]);
            setShowBatchModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
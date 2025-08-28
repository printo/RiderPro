import { useState } from "react";
import { useShipments } from "@/hooks/useShipments";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, RotateCcw } from "lucide-react";
import ShipmentCard from "@/components/ShipmentCard";
import ShipmentDetailModal from "@/components/ShipmentDetailModal";
import BatchUpdateModal from "@/components/BatchUpdateModal";
import Filters from "@/components/Filters";
import { Shipment, ShipmentFilters } from "@shared/schema";

export default function Shipments() {
  const [filters, setFilters] = useState<ShipmentFilters>({});
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);

  const { data: shipments, isLoading, error, refetch } = useShipments(filters);

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
      {/* Filters and Actions */}
      <Card className="mb-6" data-testid="card-filters">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h2 className="text-xl font-semibold text-foreground" data-testid="text-shipments-title">
              Shipments
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
          {shipments.map((shipment) => (
            <ShipmentCard
              key={shipment.id}
              shipment={shipment}
              selected={selectedShipmentIds.includes(shipment.id)}
              onSelect={(selected) => handleShipmentSelect(shipment.id, selected)}
              onViewDetails={() => setSelectedShipment(shipment)}
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

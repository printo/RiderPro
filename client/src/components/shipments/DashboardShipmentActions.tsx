import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { shipmentsApi } from '@/apiClient/shipments';
import { apiRequest } from '@/lib/queryClient';
import type { Shipment } from '@shared/types';
import BatchUpdateModal from '@/components/ui/forms/BatchUpdateModal';
import RemarksModal from '@/components/ui/forms/RemarksModal';

interface DashboardShipmentActionsProps {
  employeeId: string;
}

const ACTIONABLE_STATUSES = new Set(['Assigned', 'Initiated', 'Collected', 'In Transit', 'Picked Up']);

function DashboardShipmentActions({ employeeId }: DashboardShipmentActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [skipShipmentId, setSkipShipmentId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-shipment-actions', employeeId],
    queryFn: () => shipmentsApi.getShipments({ employeeId, limit: 30 }),
    enabled: !!employeeId,
    refetchInterval: 120000,
  });

  const actionableShipments = useMemo(
    () => (data?.data || []).filter((shipment) => ACTIONABLE_STATUSES.has(shipment.status)),
    [data]
  );

  const toggleSelection = (shipmentId: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, shipmentId] : prev.filter((id) => id !== shipmentId)));
  };

  const selectAll = (checked: boolean) => {
    setSelectedIds(checked ? actionableShipments.map((s) => s.shipment_id) : []);
  };

  const handleSingleStatusUpdate = async (
    shipment: Shipment,
    status: 'Collected' | 'Delivered' | 'Picked Up'
  ) => {
    try {
      await apiRequest('PATCH', `/api/v1/shipments/${shipment.shipment_id}`, { status });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-shipment-actions', employeeId] });
      toast({
        title: 'Status updated',
        description: `${shipment.customerName || shipment.recipientName || shipment.shipment_id} marked as ${status}.`,
      });
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Unable to update shipment status.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Quick Shipment Actions</span>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? 'Refreshing...' : 'Refresh'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading actionable shipments...</p>
          ) : actionableShipments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No actionable shipments available right now.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedIds.length > 0 && selectedIds.length === actionableShipments.length}
                    onCheckedChange={(checked) => selectAll(Boolean(checked))}
                  />
                  <span className="text-sm text-muted-foreground">
                    Select all ({actionableShipments.length})
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowBatchModal(true)}
                  disabled={selectedIds.length === 0}
                >
                  Bulk Update ({selectedIds.length})
                </Button>
              </div>

              <div className="space-y-2">
                {actionableShipments.map((shipment) => {
                  const canCollect = shipment.type === 'delivery' && shipment.status === 'Assigned';
                  const canDeliver =
                    shipment.type === 'delivery' &&
                    (shipment.status === 'Collected' || shipment.status === 'In Transit');
                  const canPickUp = shipment.type === 'pickup';
                  return (
                    <div key={shipment.shipment_id} className="border rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Checkbox
                            checked={selectedIds.includes(shipment.shipment_id)}
                            onCheckedChange={(checked) => toggleSelection(shipment.shipment_id, Boolean(checked))}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {shipment.customerName || shipment.recipientName || `Shipment ${shipment.shipment_id}`}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              #{shipment.shipment_id}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">{shipment.status}</Badge>
                      </div>
                      <div className="flex gap-2">
                        {canCollect && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8"
                            onClick={() => handleSingleStatusUpdate(shipment, 'Collected')}
                          >
                            Collected
                          </Button>
                        )}
                        {canDeliver && (
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => handleSingleStatusUpdate(shipment, 'Delivered')}
                          >
                            Delivered
                          </Button>
                        )}
                        {canPickUp && (
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => handleSingleStatusUpdate(shipment, 'Picked Up')}
                          >
                            Picked Up
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-purple-300 text-purple-700 hover:bg-purple-50"
                          onClick={() => setSkipShipmentId(shipment.shipment_id)}
                        >
                          Skip
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {showBatchModal && (
        <BatchUpdateModal
          selectedCount={selectedIds.length}
          selectedIds={selectedIds}
          selectedShipments={actionableShipments.filter((shipment) => selectedIds.includes(shipment.shipment_id))}
          isOpen={showBatchModal}
          onClose={() => setShowBatchModal(false)}
          onSuccess={() => {
            setShowBatchModal(false);
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['dashboard-shipment-actions', employeeId] });
            queryClient.invalidateQueries({ queryKey: ['shipments'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          }}
        />
      )}

      {skipShipmentId && (
        <RemarksModal
          isOpen={Boolean(skipShipmentId)}
          onClose={() => {
            setSkipShipmentId(null);
            queryClient.invalidateQueries({ queryKey: ['dashboard-shipment-actions', employeeId] });
            queryClient.invalidateQueries({ queryKey: ['shipments'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          }}
          shipmentId={skipShipmentId}
          status="Skipped"
          employeeId={employeeId}
        />
      )}
    </>
  );
}

export default DashboardShipmentActions;


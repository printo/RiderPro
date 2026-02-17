import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { shipmentsApi } from '@/apiClient/shipments';
import { apiRequest } from '@/lib/queryClient';
import type { Shipment } from '@shared/types';

interface DashboardShipmentActionsProps {
  employeeId: string;
}

const ACTIONABLE_STATUSES = new Set(['Assigned', 'Initiated']);

function DashboardShipmentActions({ employeeId }: DashboardShipmentActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-shipment-actions', employeeId],
    queryFn: () => shipmentsApi.getShipments({ employee_id: employeeId, limit: 30 }),
    enabled: !!employeeId,
    refetchInterval: 120000,
  });

  const actionableShipments = useMemo(
    () => (data?.data || []).filter((shipment) => ACTIONABLE_STATUSES.has(shipment.status)),
    [data]
  );

  const handleSingleStatusUpdate = async (
    shipment: Shipment,
    status: 'Collected' | 'In Transit' | 'Picked Up'
  ) => {
    try {
      await apiRequest('PATCH', `/api/v1/shipments/${shipment.shipment_id}`, { status });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-shipment-actions', employeeId] });
      toast({
        title: 'Status updated',
        description: `${shipment.customer_name || shipment.customer_name || shipment.id || shipment.shipment_id} marked as ${status}.`,
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
            <p className="text-sm text-muted-foreground">No shipments available for action.</p>
          ) : (
            <>
              <div className="space-y-2">
                {actionableShipments.map((shipment) => {
                  const canCollect = shipment.type === 'delivery' && shipment.status === 'Assigned';
                  const canStartTransit = shipment.type === 'delivery' && (shipment.status === 'Collected' || shipment.status === 'Initiated');
                  const canPickup = shipment.type === 'pickup' && shipment.status === 'Assigned';
                  
                  return (
                    <div key={shipment.shipment_id} className="border rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {shipment.customer_name || shipment.customer_name || `Shipment ${shipment.id || shipment.shipment_id}`}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              #{shipment.shipment_id}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">{shipment.status}</Badge>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {canCollect && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8"
                            onClick={() => handleSingleStatusUpdate(shipment, 'Collected')}
                          >
                            Mark as Collected
                          </Button>
                        )}
                        {canStartTransit && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8"
                            onClick={() => handleSingleStatusUpdate(shipment, 'In Transit')}
                          >
                            Start Transit
                          </Button>
                        )}
                        {canPickup && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8"
                            onClick={() => handleSingleStatusUpdate(shipment, 'Picked Up')}
                          >
                            Mark as Picked Up
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default DashboardShipmentActions;


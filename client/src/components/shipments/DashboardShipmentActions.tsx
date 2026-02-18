import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { shipmentsApi } from '@/apiClient/shipments';
import { apiRequest } from '@/lib/queryClient';
import type { Shipment } from '@shared/types';
import { MapPin, Route, User } from 'lucide-react';

interface DashboardShipmentActionsProps {
  employeeId: string;
}

const ACTIONABLE_STATUSES = new Set(['Assigned', 'Initiated', 'Collected']);

function DashboardShipmentActions({ employeeId }: DashboardShipmentActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedShipments, setSelectedShipments] = useState<Set<string>>(new Set());

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
    status: 'Collected' | 'In Transit' | 'Picked Up' | 'Unmark as Collected'
  ) => {
    try {
      // Map "Unmark as Collected" to actual API status
      const apiStatus = status === 'Unmark as Collected' ? 'Assigned' : status;
      await apiRequest('PATCH', `/api/v1/shipments/${shipment.id}`, { status: apiStatus });
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

  const handleShipmentSelection = (shipmentId: string, selected: boolean) => {
    setSelectedShipments(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(shipmentId);
      } else {
        newSet.delete(shipmentId);
      }
      return newSet;
    });
  };

  const formatAddress = (address: any): string => {
    if (!address) return 'No address';
    if (typeof address === 'string') return address;
    if (typeof address === 'object' && address !== null) {
      const parts: string[] = [];
      if (address.address) parts.push(String(address.address));
      if (address.place_name) parts.push(String(address.place_name));
      if (address.city) parts.push(String(address.city));
      if (address.state) parts.push(String(address.state));
      if (address.pincode) parts.push(String(address.pincode));
      return parts.length > 0 ? parts.join(', ') : 'No address';
    }
    return 'No address';
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
                  const canUnmarkCollected = shipment.type === 'delivery' && shipment.status === 'Collected';
                  const canPickup = shipment.type === 'pickup' && shipment.status === 'Assigned';
                  
                  return (
                    <div 
                      key={shipment.id} 
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedShipments.has(shipment.id) 
                          ? 'bg-blue-50 border-blue-200' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={(e) => {
                        // Prevent selection if clicking on buttons or checkbox
                        if ((e.target as HTMLElement).closest('button') || 
                            (e.target as HTMLElement).closest('input[type="checkbox"]')) {
                          return;
                        }
                        handleShipmentSelection(shipment.id, !selectedShipments.has(shipment.id));
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedShipments.has(shipment.id)}
                          onCheckedChange={(checked) => handleShipmentSelection(shipment.id, !!checked)}
                          className="mt-1"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 space-y-3">
                          {/* Header with customer name and status */}
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm">
                                {shipment.customer_name || `Customer ${shipment.shipment_id}`}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                Shipment ID: #{shipment.shipment_id || shipment.id}
                              </p>
                            </div>
                            <Badge variant="outline">{shipment.status}</Badge>
                          </div>

                          {/* Additional Information */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Route className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">
                                {shipment.route_name || 'Not assigned'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">
                                {formatAddress(shipment.address_display || shipment.address)}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
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
                            {canUnmarkCollected && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => handleSingleStatusUpdate(shipment, 'Unmark as Collected')}
                              >
                                Unmark as Collected
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


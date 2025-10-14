import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shipmentsApi } from '@/apiClient/shipments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  MapPin,
  Clock,
  Package,
  User,
  Navigation,
  CheckCircle,
  XCircle,
  RefreshCw,
  RotateCcw,
  Eye,
  Edit
} from 'lucide-react';
import { Shipment } from '@shared/schema';
import { useAuth } from '@/hooks/useAuth';
import ShipmentDetailModalWithTracking from '@/components/ui/forms/ShipmentDetailModalWithTracking';
import { withPageErrorBoundary } from '@/components/ErrorBoundary';

interface RoleBasedShipmentsProps {
  // Props can be added as needed
}

function RoleBasedShipments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Determine user role and permissions
  const isSuperUser = user?.isSuperUser || false;
  const isOpsTeam = user?.isOpsTeam || false;
  const isStaff = user?.isStaff || false;
  const isDriver = user?.role === 'driver';

  // Determine if user can perform actions
  const canEdit = isSuperUser || isDriver;
  const canViewAll = isSuperUser || isOpsTeam || isStaff;
  const isReadOnly = isOpsTeam;

  // Fetch shipments based on role
  const { data: shipments, isLoading, error } = useQuery({
    queryKey: ['/api/shipments/fetch'],
    queryFn: () => shipmentsApi.getShipments({
      // If driver, only show assigned shipments
      ...(isDriver && user?.employeeId ? { employeeId: user.employeeId } : {}),
      // If staff, only show assigned shipments
      ...(isStaff && user?.employeeId ? { employeeId: user.employeeId } : {}),
      // Super users and ops team see all
    }),
    enabled: !!user
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (shipmentId: string) => {
      const response = await fetch(`/api/shipments/${shipmentId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Sync failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shipments/fetch'] });
    }
  });

  // Update tracking mutation
  const updateTrackingMutation = useMutation({
    mutationFn: async ({ shipmentId, trackingData }: { shipmentId: string; trackingData: any }) => {
      const response = await fetch(`/api/shipments/${shipmentId}/tracking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackingData)
      });
      if (!response.ok) throw new Error('Update failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shipments/fetch'] });
    }
  });

  const handleShipmentClick = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsDetailModalOpen(true);
  };

  const handleSync = async (shipmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await syncMutation.mutateAsync(shipmentId);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleStatusUpdate = async (shipmentId: string, newStatus: string) => {
    try {
      await updateTrackingMutation.mutateAsync({
        shipmentId,
        trackingData: { status: newStatus }
      });
    } catch (error) {
      console.error('Status update failed:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Delivered': return 'bg-green-100 text-green-800';
      case 'In Transit': return 'bg-blue-100 text-blue-800';
      case 'Assigned': return 'bg-yellow-100 text-yellow-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      case 'Returned': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleDisplayName = () => {
    if (isSuperUser) return 'Super User';
    if (isOpsTeam) return 'Ops Team';
    if (isStaff) return 'Staff';
    if (isDriver) return 'Driver';
    return 'User';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load shipments. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shipments</h1>
          <p className="text-muted-foreground">
            Viewing as {getRoleDisplayName()}
            {isReadOnly && ' (Read-only)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/shipments/fetch'] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Shipments List */}
      <div className="grid gap-4">
        {shipments?.data?.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No shipments found</h3>
                <p className="text-muted-foreground">
                  {isDriver || isStaff
                    ? 'No shipments assigned to you yet.'
                    : 'No shipments available.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          shipments?.data?.map((shipment) => (
            <Card
              key={shipment.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleShipmentClick(shipment)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">
                        {shipment.trackingNumber || shipment.shipment_id || 'N/A'}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {shipment.customerName || shipment.recipientName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(shipment.status)}>
                      {shipment.status}
                    </Badge>
                    {shipment.synced_to_external ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Address */}
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Address</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {shipment.address || shipment.deliveryAddress}
                      </p>
                    </div>
                  </div>

                  {/* Delivery Time */}
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Delivery Time</p>
                      <p className="text-sm text-muted-foreground">
                        {shipment.deliveryTime ? new Date(shipment.deliveryTime).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Tracking Info */}
                  <div className="flex items-start gap-2">
                    <Navigation className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Tracking</p>
                      <p className="text-sm text-muted-foreground">
                        {shipment.km_travelled ? `${shipment.km_travelled.toFixed(2)} km` : 'Not started'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                {canEdit && (
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShipmentClick(shipment);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>

                    {!isReadOnly && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleSync(shipment.id, e)}
                          disabled={syncMutation.isPending}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          {syncMutation.isPending ? 'Syncing...' : 'Sync'}
                        </Button>

                        {shipment.status === 'Assigned' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusUpdate(shipment.id, 'In Transit');
                            }}
                          >
                            Start Delivery
                          </Button>
                        )}

                        {shipment.status === 'In Transit' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusUpdate(shipment.id, 'Delivered');
                            }}
                          >
                            Mark Delivered
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Shipment Detail Modal */}
      {selectedShipment && (
        <ShipmentDetailModalWithTracking
          shipment={selectedShipment}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedShipment(null);
          }}
          canEdit={canEdit}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
}

export default withPageErrorBoundary(RoleBasedShipments, {
  pageVariant: 'shipments',
  pageName: 'RoleBasedShipments'
});

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { shipmentsApi } from '@/apiClient/shipments';
import { apiRequest } from '@/lib/queryClient';
import type { Shipment } from '@shared/types';
import { Trash2, MoreHorizontal, CheckSquare, RotateCcw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ShipmentCard from './ShipmentCard';

interface DashboardShipmentActionsProps {
  employeeId: string;
}

const ACTIONABLE_STATUSES = new Set(['Assigned', 'Initiated', 'Collected']);

function DashboardShipmentActions({ employeeId }: DashboardShipmentActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedShipments, setSelectedShipments] = useState<Set<string>>(new Set());
  const [bulkActionDialog, setBulkActionDialog] = useState<{
    isOpen: boolean;
    action: string;
    count: number;
  }>({ isOpen: false, action: '', count: 0 });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-shipment-actions', employeeId],
    queryFn: () => {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      return shipmentsApi.getShipments({ 
        employee_id: employeeId, 
        created_at__gte: today,
        limit: 30 
      });
    },
    enabled: !!employeeId,
    refetchInterval: 120000,
  });

  const actionableShipments = useMemo(
    () => (data?.data || []).filter((shipment) => ACTIONABLE_STATUSES.has(shipment.status)),
    [data]
  );

  const handleBulkAction = async (action: string) => {
    try {
      const selectedShipmentsData = (data?.data || []).filter(shipment => 
        selectedShipments.has(shipment.id)
      );

      for (const shipment of selectedShipmentsData) {
        let apiStatus: string;
        
        switch (action) {
          case 'Mark as Collected':
            apiStatus = 'Collected';
            break;
          case 'Start Transit':
            apiStatus = 'In Transit';
            break;
          case 'Mark as Picked Up':
            apiStatus = 'Picked Up';
            break;
          case 'Unmark as Collected':
            apiStatus = 'Assigned';
            break;
          default:
            continue;
        }

        await apiRequest('PATCH', `/api/v1/shipments/${shipment.id}`, { status: apiStatus });
      }

      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-shipment-actions', employeeId] });
      
      setSelectedShipments(new Set());
      setBulkActionDialog({ isOpen: false, action: '', count: 0 });
      
      toast({
        title: 'Bulk update completed',
        description: `${selectedShipmentsData.length} shipments marked as ${action}.`,
      });
    } catch (error) {
      toast({
        title: 'Bulk update failed',
        description: error instanceof Error ? error.message : 'Unable to update shipment statuses.',
        variant: 'destructive',
      });
    }
  };

  const openBulkActionDialog = (action: string) => {
    const selectedCount = selectedShipments.size;
    if (selectedCount === 0) return;
    
    setBulkActionDialog({
      isOpen: true,
      action,
      count: selectedCount
    });
  };

  const getAvailableBulkActions = () => {
    const selectedShipmentsData = (data?.data || []).filter(shipment => 
      selectedShipments.has(shipment.id)
    );

    const actions = [];
    
    // Check if all selected can be marked as collected
    if (selectedShipmentsData.every(s => s.type === 'delivery' && s.status === 'Assigned')) {
      actions.push('Mark as Collected');
    }
    
    // Check if all selected can start transit
    if (selectedShipmentsData.every(s => 
      s.type === 'delivery' && (s.status === 'Collected' || s.status === 'Initiated'))) {
      actions.push('Start Transit');
    }
    
    // Check if all selected can be unmarked as collected
    if (selectedShipmentsData.every(s => s.type === 'delivery' && s.status === 'Collected')) {
      actions.push('Unmark as Collected');
    }
    
    // Check if all selected can be picked up
    if (selectedShipmentsData.every(s => s.type === 'pickup' && s.status === 'Assigned')) {
      actions.push('Mark as Picked Up');
    }
    
    return actions;
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

  return (
    <>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Quick Shipment Actions</span>
            <div className="flex items-center gap-2">
              {selectedShipments.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedShipments.size} selected
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="default">
                        <CheckSquare className="h-4 w-4 mr-2" />
                        Bulk Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {getAvailableBulkActions().map(action => (
                        <DropdownMenuItem
                          key={action}
                          onClick={() => openBulkActionDialog(action)}
                        >
                          {action}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedShipments(new Set())}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
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
                {actionableShipments.map((shipment) => (
                  <ShipmentCard
                    key={shipment.id}
                    shipment={shipment}
                    selected={selectedShipments.has(shipment.id)}
                    onSelect={(selected) => handleShipmentSelection(shipment.id, selected)}
                    onViewDetails={() => {}} // No details view in dashboard
                    employeeId={employeeId}
                    variant="dashboard"
                    showTrackingControls={false}
                    showIndividualActions={false}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={bulkActionDialog.isOpen} onOpenChange={(open) => 
        setBulkActionDialog(prev => ({ ...prev, isOpen: open }))
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark {bulkActionDialog.count} selected shipment(s) as "{bulkActionDialog.action}"?
              This action will be applied to all selected shipments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => 
              setBulkActionDialog({ isOpen: false, action: '', count: 0 })
            }>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleBulkAction(bulkActionDialog.action)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirm {bulkActionDialog.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default DashboardShipmentActions;


import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { shipmentsApi } from "@/apiClient/shipments";
import { withModalErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2, User } from "lucide-react";

interface BatchRiderAllocationModalProps {
  selectedCount: number;
  selectedIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function BatchRiderAllocationModal({
  selectedCount,
  selectedIds,
  isOpen,
  onClose,
  onSuccess
}: BatchRiderAllocationModalProps) {
  const [riderId, setRiderId] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: ridersData, isLoading: isLoadingRiders } = useQuery({
    queryKey: ["available-riders"],
    queryFn: () => shipmentsApi.getAvailableRiders(),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });
  const availableRiders = ridersData?.riders || [];

  const batchAllocationMutation = useMutation({
    mutationFn: async () => {
      if (!riderId.trim()) {
        throw new Error("Rider ID is required");
      }
      return shipmentsApi.batchChangeRider(selectedIds, riderId.trim(), reason.trim() || undefined);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({
        title: "Batch Allocation Successful",
        description: `${data.updated_count} shipment(s) allocated to rider ${riderId}. ${data.failed_count > 0 ? `${data.failed_count} failed.` : ''}`,
      });
      setRiderId("");
      setReason("");
      onSuccess();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to allocate shipments to rider.";
      toast({
        title: "Batch Allocation Failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleConfirm = () => {
    if (!riderId.trim()) {
      toast({
        title: "Rider ID Required",
        description: "Please enter a rider ID to allocate shipments.",
        variant: "destructive",
      });
      return;
    }
    batchAllocationMutation.mutate();
  };

  const handleClose = () => {
    setRiderId("");
    setReason("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" data-testid="modal-batch-rider-allocation">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Batch Rider Allocation
          </DialogTitle>
          <DialogDescription>
            Allocate {selectedCount} selected shipment{selectedCount !== 1 ? 's' : ''} to a specific rider.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="rider-id" className="text-sm font-medium text-foreground mb-2 block">
              Rider ID <span className="text-red-500">*</span>
            </Label>
            {isLoadingRiders ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading riders...
              </div>
            ) : (
              <Select value={riderId || undefined} onValueChange={setRiderId}>
                <SelectTrigger id="rider-id" className="w-full" data-testid="select-rider-id">
                  <SelectValue placeholder="Select rider" />
                </SelectTrigger>
                <SelectContent>
                  {availableRiders.length > 0 ? (
                    availableRiders.map((rider) => (
                      <SelectItem key={rider.id} value={rider.id}>
                        <div className="flex flex-col py-1">
                          <span className="font-medium">{rider.name || rider.id}</span>
                          {rider.email && (
                            <span className="text-xs text-muted-foreground">{rider.email}</span>
                          )}
                          <span className="text-xs text-blue-600 font-mono">{rider.id}</span>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No riders available</div>
                  )}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Select a rider from Rider Accounts to allocate these shipments.
            </p>
          </div>

          <div>
            <Label htmlFor="reason" className="text-sm font-medium text-foreground mb-2 block">
              Reason (Optional)
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for allocation (optional)"
              rows={3}
              className="w-full"
              data-testid="textarea-reason"
            />
          </div>

          <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
            <p className="font-medium mb-1">Note:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Shipments that are already "Collected", "In Transit", "Picked Up", "Delivered", "Returned", or "Cancelled" cannot be reallocated.</li>
              <li>Only shipments with status "Initiated" or "Assigned" can be allocated.</li>
            </ul>
          </div>

          <div className="text-sm text-muted-foreground">
            <span data-testid="text-selected-count">{selectedCount}</span> shipment{selectedCount !== 1 ? 's' : ''} selected for allocation
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleClose}
              disabled={batchAllocationMutation.isPending}
              data-testid="button-cancel-allocation"
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary text-primary-foreground"
              onClick={handleConfirm}
              disabled={batchAllocationMutation.isPending || !riderId.trim()}
              data-testid="button-confirm-allocation"
            >
              {batchAllocationMutation.isPending ? "Allocating..." : "Allocate All"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default withModalErrorBoundary(BatchRiderAllocationModal, {
  componentName: 'BatchRiderAllocationModal'
});


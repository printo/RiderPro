import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { withModalErrorBoundary } from "@/components/ErrorBoundary";

interface BatchUpdateModalProps {
  selectedCount: number;
  selectedIds: string[];
  selectedShipments?: Array<{ shipment_id: string; type?: string | null; status?: string | null }>;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface BatchUpdateResult {
  shipment_id?: string;
  success: boolean;
  message?: string;
}

interface BatchUpdateResponse {
  success?: boolean;
  updated?: number;
  updatedCount?: number;
  failed?: number;
  failedCount?: number;
  skipped?: number;
  skippedCount?: number;
  message?: string;
  results?: BatchUpdateResult[];
}

function BatchUpdateModal({
  selectedCount,
  selectedIds,
  selectedShipments = [],
  isOpen,
  onClose,
  onSuccess
}: BatchUpdateModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const incompatibleCount = useMemo(() => {
    if (!selectedStatus || selectedShipments.length === 0) return 0;

    if (selectedStatus === "Picked Up") {
      return selectedShipments.filter((s) => s.type !== "pickup").length;
    }
    if (selectedStatus === "Collected") {
      return selectedShipments.filter((s) => s.type === "pickup").length;
    }
    if (selectedStatus === "Delivered") {
      return selectedShipments.filter((s) => s.type === "pickup").length;
    }
    return 0;
  }, [selectedShipments, selectedStatus]);

  const batchUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStatus) {
        throw new Error("Status is required");
      }
      if (selectedStatus === "Skipped" && !reason.trim()) {
        throw new Error("Reason is required when marking shipments as Skipped");
      }
      const updates = selectedIds.map(id => ({
        id,
        status: selectedStatus,
        ...(selectedStatus === "Skipped" ? { remarks: reason.trim() } : {}),
      }));
      const response = await apiRequest("PATCH", "/api/v1/shipments/batch", { updates });
      return response.json() as Promise<BatchUpdateResponse>;
    },
    onSuccess: (data: BatchUpdateResponse | undefined) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/shipments/fetch"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/dashboard"] });
      const updated = data?.updatedCount ?? data?.updated ?? 0;
      const failed = data?.failedCount ?? data?.failed ?? 0;
      const skipped = data?.skippedCount ?? data?.skipped ?? 0;

      toast({
        title: failed > 0 ? "Batch Update Partially Completed" : "Batch Update Successful",
        description:
          data?.message ||
          `${updated} updated, ${skipped} skipped, ${failed} failed for status ${selectedStatus}.`,
        variant: failed > 0 ? "destructive" : "default",
      });
      if (updated > 0 || skipped > 0) {
        onSuccess();
      }
      setReason("");
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update shipments.";
      toast({
        title: "Batch Update Failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleConfirm = () => {
    if (!selectedStatus) {
      toast({
        title: "Status Required",
        description: "Please select a status to update to.",
        variant: "destructive",
      });
      return;
    }
    if (selectedStatus === "Skipped" && !reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for skipped shipments.",
        variant: "destructive",
      });
      return;
    }
    if (incompatibleCount > 0) {
      toast({
        title: "Selection Contains Incompatible Shipments",
        description:
          `${incompatibleCount} selected shipment(s) do not support "${selectedStatus}". ` +
          `For delivery flow use Collected/Delivered, and use Picked Up only for pickup orders.`,
        variant: "destructive",
      });
      return;
    }
    batchUpdateMutation.mutate();
  };

  const handleClose = () => {
    setSelectedStatus("");
    setReason("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" data-testid="modal-batch-update">
        <DialogHeader>
          <DialogTitle>Batch Update</DialogTitle>
          <DialogDescription>
            Update the status of {selectedCount} selected shipment{selectedCount !== 1 ? 's' : ''} at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Update Status for Selected Shipments
            </label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger data-testid="select-batch-status">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Collected" data-testid="option-collected">Collected</SelectItem>
                <SelectItem value="Delivered" data-testid="option-delivered">Delivered</SelectItem>
                <SelectItem value="Picked Up" data-testid="option-picked-up">Picked Up</SelectItem>
                <SelectItem value="Skipped" data-testid="option-skipped">Skipped</SelectItem>
                <SelectItem value="Returned" data-testid="option-returned">Returned</SelectItem>
                <SelectItem value="Cancelled" data-testid="option-cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedStatus === "Skipped" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Reason for skipping (required)
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for skipped shipments..."
                rows={3}
              />
            </div>
          )}

          {incompatibleCount > 0 && (
            <div className="text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md p-2">
              {incompatibleCount} selected shipment(s) are not compatible with <strong>{selectedStatus}</strong>.
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            <span data-testid="text-selected-count">{selectedCount}</span> shipments selected for update
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleClose}
              disabled={batchUpdateMutation.isPending}
              data-testid="button-cancel-batch"
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary text-primary-foreground"
              onClick={handleConfirm}
              disabled={batchUpdateMutation.isPending || incompatibleCount > 0}
              data-testid="button-confirm-batch"
            >
              {batchUpdateMutation.isPending ? "Updating..." : "Update All"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export default withModalErrorBoundary(BatchUpdateModal, {
  componentName: 'BatchUpdateModal'
});
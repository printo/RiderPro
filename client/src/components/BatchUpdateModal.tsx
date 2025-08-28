import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BatchUpdateModalProps {
  selectedCount: number;
  selectedIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BatchUpdateModal({ 
  selectedCount, 
  selectedIds, 
  isOpen, 
  onClose, 
  onSuccess 
}: BatchUpdateModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const batchUpdateMutation = useMutation({
    mutationFn: async () => {
      const updates = selectedIds.map(id => ({ id, status: selectedStatus }));
      const response = await apiRequest("PATCH", "/api/shipments/batch", { updates });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Batch Update Successful",
        description: `${data.updatedCount} shipments updated to ${selectedStatus}.`,
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Batch Update Failed",
        description: error.message || "Failed to update shipments.",
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
    batchUpdateMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="modal-batch-update">
        <DialogHeader>
          <DialogTitle>Batch Update</DialogTitle>
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
                <SelectItem value="Delivered" data-testid="option-delivered">Delivered</SelectItem>
                <SelectItem value="Picked Up" data-testid="option-picked-up">Picked Up</SelectItem>
                <SelectItem value="Returned" data-testid="option-returned">Returned</SelectItem>
                <SelectItem value="Cancelled" data-testid="option-cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <span data-testid="text-selected-count">{selectedCount}</span> shipments selected for update
          </div>
          
          <div className="flex gap-3">
            <Button 
              variant="secondary" 
              className="flex-1"
              onClick={onClose}
              disabled={batchUpdateMutation.isPending}
              data-testid="button-cancel-batch"
            >
              Cancel
            </Button>
            <Button 
              className="flex-1 bg-primary text-primary-foreground"
              onClick={handleConfirm}
              disabled={batchUpdateMutation.isPending}
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

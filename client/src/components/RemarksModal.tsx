import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MessageCircle, Save } from "lucide-react";

interface RemarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipmentId: string;
  status: "Cancelled" | "Returned";
}

export default function RemarksModal({ 
  isOpen, 
  onClose, 
  shipmentId, 
  status 
}: RemarksModalProps) {
  const [remarks, setRemarks] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitRemarksMutation = useMutation({
    mutationFn: async () => {
      if (!remarks.trim()) {
        throw new Error("Remarks are required");
      }
      
      // First update the shipment status
      const statusResponse = await apiRequest("PATCH", `/api/shipments/${shipmentId}`, { 
        status: status 
      });
      
      // Then save the remarks
      const remarksResponse = await apiRequest("POST", `/api/shipments/${shipmentId}/remarks`, {
        remarks: remarks.trim(),
        status: status
      });
      
      return { status: statusResponse, remarks: remarksResponse };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Status Updated",
        description: `Shipment marked as ${status} with remarks.`,
      });
      onClose();
      setRemarks("");
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || `Failed to update shipment to ${status}.`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    submitRemarksMutation.mutate();
  };

  const handleClose = () => {
    setRemarks("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-orange-600" />
            {status} Shipment - Add Remarks
          </DialogTitle>
          <DialogDescription>
            Please provide a reason for marking this shipment as {status.toLowerCase()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="remarks" className="text-sm font-medium">
              Please provide the reason for {status.toLowerCase()}:
            </Label>
            <Textarea
              id="remarks"
              placeholder={`Enter reason for ${status.toLowerCase()}...`}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
              className="mt-2"
              data-testid="textarea-remarks"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              data-testid="button-cancel-remarks"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitRemarksMutation.isPending || !remarks.trim()}
              className={`flex-1 ${
                status === "Cancelled" 
                  ? "bg-red-600 hover:bg-red-700" 
                  : "bg-orange-600 hover:bg-orange-700"
              } text-white`}
              data-testid="button-save-remarks"
            >
              <Save className="h-4 w-4 mr-2" />
              {submitRemarksMutation.isPending ? "Saving..." : `Mark as ${status}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
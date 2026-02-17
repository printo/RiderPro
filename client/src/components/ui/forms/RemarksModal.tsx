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
import { withModalErrorBoundary } from "@/components/ErrorBoundary";
import { useRouteTracking } from "@/hooks/useRouteAPI";
import { useGPSTracking } from "@/hooks/useGPSTracking";

interface RemarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipmentId: string;
  status: "Cancelled" | "Returned" | "Skipped";
  employeeId?: string;
}

function RemarksModal({
  isOpen,
  onClose,
  shipmentId,
  status,
  employeeId
}: RemarksModalProps) {
  const [remarks, setRemarks] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    hasActiveSession,
    recordShipmentEvent,
  } = useRouteTracking(employeeId || '');

  const {
    getCurrentPosition,
  } = useGPSTracking();

  const submitRemarksMutation = useMutation({
    mutationFn: async () => {
      if (!remarks.trim()) {
        throw new Error("Remarks are required");
      }

      // Record GPS coordinates if we have an active session
      if (hasActiveSession) {
        try {
          const position = await getCurrentPosition();
          // Record the shipment event with GPS coordinates
          // eventType is always 'delivery' for status changes on standard shipments
          await recordShipmentEvent(
            shipmentId,
            'delivery',
            position.latitude,
            position.longitude
          );
        } catch (gpsError) {
          console.error('Failed to record GPS location during status change:', gpsError);
          // We don't throw here - we want the status update to succeed even if GPS fails
        }
      }

      // Save status + reason together so statuses that require reason (e.g. Skipped) pass validation.
      const remarksResponse = await apiRequest("POST", `/api/v1/shipments/${shipmentId}/remarks`, {
        remarks: remarks.trim(),
        status: status
      });

      return { remarks: remarksResponse };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/shipments/fetch"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/dashboard"] });
      toast({
        title: "Status Updated",
        description: `Shipment marked as ${status} with remarks.`,
      });
      onClose();
      setRemarks("");
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to update shipment to ${status}.`;
      toast({
        title: "Update Failed",
        description: message,
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
              className={`flex-1 ${status === "Cancelled"
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
} export default withModalErrorBoundary(RemarksModal, {
  componentName: 'RemarksModal'
});
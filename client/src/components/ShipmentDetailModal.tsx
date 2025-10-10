import { useState } from "react";
import type { Shipment } from "@shared/schema";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Package, Undo, XCircle, Truck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import RemarksModal from "./RemarksModal";
import { withModalErrorBoundary } from "@/components/ErrorBoundary";
import AcknowledgmentCapture from "./AcknowledgmentCapture";
import { cn } from "@/lib/utils";

type ShipmentWithAcknowledgment = Shipment & {
  acknowledgment?: {
    photo?: string;
    signature?: string;
    timestamp?: string;
  };
};

interface ShipmentDetailModalProps {
  shipment: ShipmentWithAcknowledgment;
  isOpen: boolean;
  onClose: () => void;
}

function ShipmentDetailModal({ shipment, isOpen, onClose }: ShipmentDetailModalProps) {
  const [showAcknowledgment, setShowAcknowledgment] = useState(false);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [remarksStatus, setRemarksStatus] = useState<"Cancelled" | "Returned" | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      const response = await apiRequest("PATCH", `/api/shipments/${shipment.id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Status Updated",
        description: "Shipment status has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update shipment status.",
        variant: "destructive",
      });
    },
  });

  const acknowledgmentMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/shipments/${shipment.id}/acknowledgement`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to save acknowledgment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      toast({
        title: "Acknowledgment Saved",
        description: "Photo and signature have been saved successfully.",
      });
      setShowAcknowledgment(false);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save acknowledgment.",
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = async (status: string) => {
    if (status === "Delivered" || status === "Picked Up") {
      setShowAcknowledgment(true);
      updateStatusMutation.mutate({ status });
    } else if (status === "Cancelled" || status === "Returned") {
      setRemarksStatus(status as "Cancelled" | "Returned");
      setShowRemarksModal(true);
    } else {
      updateStatusMutation.mutate({ status });
      onClose();
    }
  };

  const handleSubmitAcknowledgment = async (data: { photo: File | null; signature: string }) => {
    if (!data.photo && !data.signature) {
      toast({
        title: "Missing Data",
        description: "Please capture both photo and signature.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    if (data.photo) {
      formData.append("photo", data.photo);
    }
    if (data.signature) {
      formData.append("signatureData", data.signature);
    }

    acknowledgmentMutation.mutate(formData);
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className={cn(
          "overflow-hidden flex flex-col p-0",
          showAcknowledgment ? "h-[100dvh] max-h-none" : "h-[90vh]"
        )}
        data-testid="modal-shipment-detail"
      >
        {showAcknowledgment ? (
          <AcknowledgmentCapture
            onClose={() => setShowAcknowledgment(false)}
            onSubmit={handleSubmitAcknowledgment}
            isSubmitting={acknowledgmentMutation.isPending}
          />
        ) : (
          <>
            <SheetHeader className="flex-shrink-0 px-6 py-4 border-b border-border">
              <SheetTitle className="text-left">
                Shipment #{shipment.id.slice(-8)}
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              <div className="space-y-6 pb-32 px-6">
                {/* Shipment Details */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-muted-foreground">Type</label>
                      <div className="flex items-center gap-2">
                        {shipment.type === "delivery" ? (
                          <Truck className="text-blue-600 dark:text-blue-400 h-4 w-4" />
                        ) : (
                          <Package className="text-orange-600 dark:text-orange-400 h-4 w-4" />
                        )}
                        <p className="text-foreground capitalize" data-testid="text-shipment-type">
                          {shipment.type}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-muted-foreground">Route</label>
                      <p className="text-foreground" data-testid="text-shipment-route">
                        {shipment.routeName}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-muted-foreground">Cost</label>
                      <p className="text-foreground font-medium" data-testid="text-shipment-cost">
                        ₹{shipment.cost}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-muted-foreground">
                        Current Status
                      </label>
                      <Badge
                        className={cn(
                          "inline-block text-xs",
                          shipment.status === 'Delivered' ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                            shipment.status === 'Picked Up' ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                              shipment.status === 'In Transit' ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
                                shipment.status === 'Assigned' ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                                  shipment.status === 'Cancelled' ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                                    shipment.status === 'Returned' ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" :
                                      "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                        )}
                        data-testid="text-current-status"
                      >
                        {shipment.status}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Delivery Time</label>
                    <p className="text-foreground" data-testid="text-delivery-time">
                      {formatTime(shipment.deliveryTime || "")}
                    </p>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground border-b border-border pb-2">
                    Customer Information
                  </h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Name</label>
                        <p className="text-foreground" data-testid="text-customer-name">
                          {shipment.customerName}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Mobile</label>
                        <p className="text-foreground" data-testid="text-customer-mobile">
                          {shipment.customerMobile}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Address</label>
                      <p className="text-foreground" data-testid="text-customer-address">
                        {shipment.address}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Acknowledgment Details - only show if available */}
                {(shipment.acknowledgment?.photo || shipment.acknowledgment?.signature) && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-foreground border-b border-border pb-2">
                      Acknowledgment Details
                    </h3>
                    <div className="space-y-4">
                      {shipment.acknowledgment.photo && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Delivery Photo</label>
                          <div className="rounded-lg overflow-hidden border border-border">
                            <img
                              src={shipment.acknowledgment.photo}
                              alt="Delivery confirmation"
                              className="w-full h-48 object-cover"
                              data-testid="img-delivery-photo"
                            />
                          </div>
                        </div>
                      )}
                      {shipment.acknowledgment.signature && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-muted-foreground">Customer Signature</label>
                          <div className="rounded-lg overflow-hidden border border-border bg-white p-4">
                            <img
                              src={shipment.acknowledgment.signature}
                              alt="Customer signature"
                              className="w-full h-24 object-contain"
                              data-testid="img-customer-signature"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fixed Footer Status Update */}
            <div className="absolute bottom-0 left-0 right-0 bg-background border-t border-border p-4 space-y-3">
              <h3 className="font-semibold text-foreground text-center">
                Update Status
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handleStatusUpdate("Returned")}
                  disabled={updateStatusMutation.isPending}
                  className="bg-orange-600 hover:bg-orange-700 text-white h-12"
                  data-testid="button-returned"
                >
                  <Undo className="h-4 w-4 mr-2" />
                  Returned
                </Button>
                <Button
                  onClick={() => handleStatusUpdate("Cancelled")}
                  disabled={updateStatusMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white h-12"
                  data-testid="button-cancelled"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelled
                </Button>
                {shipment.type === "pickup" ? (
                  <Button
                    onClick={() => handleStatusUpdate("Picked Up")}
                    disabled={updateStatusMutation.isPending}
                    className="col-span-2 bg-green-600 hover:bg-green-700 text-white h-12"
                    data-testid="button-picked-up"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Picked Up
                  </Button>
                ) : shipment.type === "delivery" ? (
                  <Button
                    onClick={() => handleStatusUpdate("Delivered")}
                    disabled={updateStatusMutation.isPending}
                    className="col-span-2 bg-green-600 hover:bg-green-700 text-white h-12"
                    data-testid="button-delivered"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Delivered
                  </Button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </SheetContent>

      {/* Remarks Modal for Cancelled/Returned */}
      {remarksStatus && (
        <RemarksModal
          isOpen={showRemarksModal}
          onClose={() => {
            setShowRemarksModal(false);
            setRemarksStatus(null);
          }}
          shipmentId={shipment.id}
          status={remarksStatus}
        />
      )}
    </Sheet>
  );
}

export default withModalErrorBoundary(ShipmentDetailModal, {
  componentName: 'ShipmentDetailModal'
});

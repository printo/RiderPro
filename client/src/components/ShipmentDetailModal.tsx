import { useState } from "react";
import { Shipment } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Package, Undo, XCircle, Truck, Save, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import SignatureCanvas from "./SignatureCanvas";
import { cn } from "@/lib/utils";

interface ShipmentDetailModalProps {
  shipment: Shipment;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShipmentDetailModal({ shipment, isOpen, onClose }: ShipmentDetailModalProps) {
  const [showAcknowledgment, setShowAcknowledgment] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [signatureData, setSignatureData] = useState<string>("");
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
    updateStatusMutation.mutate({ status });
    if (status === "Delivered" || status === "Picked Up") {
      setShowAcknowledgment(true);
    } else {
      onClose();
    }
  };

  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitAcknowledgment = async () => {
    if (!photoFile && !signatureData) {
      toast({
        title: "Missing Data",
        description: "Please capture both photo and signature.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    if (photoFile) {
      formData.append("photo", photoFile);
    }
    if (signatureData) {
      formData.append("signatureData", signatureData);
    }

    acknowledgmentMutation.mutate(formData);
  };

  const getStatusClass = (status: string) => {
    const statusLower = status.toLowerCase().replace(" ", "-");
    return `status-${statusLower}`;
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-shipment-detail">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Shipment Details
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              data-testid="button-close-modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground border-b border-border pb-2">
              Customer Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">Address</label>
                <p className="text-foreground" data-testid="text-customer-address">
                  {shipment.address}
                </p>
              </div>
            </div>
          </div>

          {/* Shipment Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground border-b border-border pb-2">
              Shipment Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Shipment ID</label>
                <p className="text-foreground" data-testid="text-shipment-id">
                  #{shipment.id.slice(-8)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Type</label>
                <div className="flex items-center gap-2">
                  {shipment.type === "delivery" ? (
                    <Truck className="text-blue-600 h-4 w-4" />
                  ) : (
                    <Package className="text-orange-600 h-4 w-4" />
                  )}
                  <p className="text-foreground capitalize" data-testid="text-shipment-type">
                    {shipment.type}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Route</label>
                <p className="text-foreground" data-testid="text-shipment-route">
                  {shipment.routeName}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Cost</label>
                <p className="text-foreground" data-testid="text-shipment-cost">
                  ₹{shipment.cost}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Delivery Time</label>
                <p className="text-foreground" data-testid="text-delivery-time">
                  {formatTime(shipment.deliveryTime)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Current Status</label>
                <Badge className={cn("mt-1", getStatusClass(shipment.status))} data-testid="text-current-status">
                  {shipment.status}
                </Badge>
              </div>
            </div>
          </div>

          {!showAcknowledgment && (
            <>
              <Separator />
              {/* Status Update Actions */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground border-b border-border pb-2">
                  Update Status
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleStatusUpdate("Delivered")}
                    disabled={updateStatusMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-delivered"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Delivered
                  </Button>
                  <Button
                    onClick={() => handleStatusUpdate("Picked Up")}
                    disabled={updateStatusMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-picked-up"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Picked Up
                  </Button>
                  <Button
                    onClick={() => handleStatusUpdate("Returned")}
                    disabled={updateStatusMutation.isPending}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    data-testid="button-returned"
                  >
                    <Undo className="h-4 w-4 mr-2" />
                    Returned
                  </Button>
                  <Button
                    onClick={() => handleStatusUpdate("Cancelled")}
                    disabled={updateStatusMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white"
                    data-testid="button-cancelled"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelled
                  </Button>
                </div>
              </div>
            </>
          )}

          {showAcknowledgment && (
            <>
              <Separator />
              {/* Acknowledgment Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground border-b border-border pb-2">
                  Capture Acknowledgment
                </h3>
                
                {/* Photo Capture */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Delivery Photo</label>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    {photoPreview ? (
                      <img 
                        src={photoPreview}
                        alt="Delivery photo preview" 
                        className="mx-auto mb-4 rounded-lg w-32 h-24 object-cover"
                        data-testid="img-photo-preview"
                      />
                    ) : (
                      <div className="mb-4">
                        <img 
                          src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=300"
                          alt="Delivery rider taking photo for package confirmation" 
                          className="mx-auto rounded-lg w-32 h-24 object-cover opacity-50"
                        />
                      </div>
                    )}
                    <p className="text-muted-foreground mb-4">Tap to capture delivery photo</p>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      id="photo-input"
                      onChange={handlePhotoCapture}
                      data-testid="input-photo"
                    />
                    <Button 
                      type="button" 
                      onClick={() => document.getElementById('photo-input')?.click()}
                      data-testid="button-capture-photo"
                    >
                      📷 Capture Photo
                    </Button>
                  </div>
                </div>

                {/* Signature Capture */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Customer Signature</label>
                  <SignatureCanvas 
                    onSignatureChange={setSignatureData}
                    data-testid="canvas-signature"
                  />
                </div>

                {/* Submit Acknowledgment */}
                <Button 
                  onClick={handleSubmitAcknowledgment}
                  disabled={acknowledgmentMutation.isPending}
                  className="w-full bg-primary text-primary-foreground"
                  data-testid="button-save-acknowledgment"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {acknowledgmentMutation.isPending ? "Saving..." : "Save Acknowledgment"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import type { Shipment } from "@shared/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle, Package, Undo, XCircle, Truck, Navigation,
  MapPin, Clock, AlertCircle, Loader2, Copy, ArrowLeft,
  RotateCcw
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiClient } from "@/services/ApiClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useRouteTracking } from "@/hooks/useRouteAPI";
import { useGPSTracking } from "@/hooks/useGPSTracking";
import { useAuth } from "@/hooks/useAuth";
import RemarksModal from "@/components/ui/forms/RemarksModal";
import AcknowledgmentCapture from "@/components/AcknowledgmentCapture";
import ShipmentDetailTabs from "@/components/shipments/ShipmentDetailTabs";

// Helper function to format address
const formatAddress = (address: any): string => {
  if (!address) return 'No address';
  
  // If it's already a string, return it
  if (typeof address === 'string') {
    return address;
  }
  
  // If it's an object, format it
  if (typeof address === 'object' && address !== null) {
    const parts: string[] = [];
    
    // Try common address field names
    if (address.address) parts.push(String(address.address));
    if (address.place_name) parts.push(String(address.place_name));
    if (address.city) parts.push(String(address.city));
    if (address.state) parts.push(String(address.state));
    if (address.pincode) parts.push(String(address.pincode));
    if (address.country) parts.push(String(address.country));
    
    return parts.length > 0 ? parts.join(', ') : 'No address';
  }
  
  return 'No address';
};

type ShipmentWithAcknowledgment = Shipment & {
  acknowledgment?: {
    photoUrl?: string;
    signatureUrl?: string;
  };
};

interface ShipmentDetailModalWithTrackingProps {
  shipment: ShipmentWithAcknowledgment;
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
}

function ShipmentDetailModalWithTracking({
  shipment,
  isOpen,
  onClose,
  employeeId
}: ShipmentDetailModalWithTrackingProps) {
  const [showAcknowledgment, setShowAcknowledgment] = useState(false);
  const [showRemarksModal, setShowRemarksModal] = useState(false);
  const [remarksStatus, setRemarksStatus] = useState<"Cancelled" | "Returned" | null>(null);
  const [isRecordingLocation, setIsRecordingLocation] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const {
    hasActiveSession,
    activeSession,
    recordShipmentEvent,
    isSubmitting: isRecordingEvent
  } = useRouteTracking(employeeId);

  const {
    getCurrentPosition,
    isLoading: isGettingLocation
  } = useGPSTracking();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      const response = await apiRequest("PATCH", `/api/v1/shipments/${shipment.shipment_id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({
        title: "Status Updated",
        description: "Shipment status has been updated successfully.",
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update shipment status.";
      toast({
        title: "Update Failed",
        description: message,
        variant: "destructive",
      });
    },
  });


  const handleStatusUpdateWithGPS = async (status: string) => {
    // Proceed with normal status update
    if (status === "Delivered" || status === "Picked Up") {
      setShowAcknowledgment(true);
      // Don't update status yet - wait for acknowledgment to be saved
    } else if (status === "Cancelled" || status === "Returned") {
      setRemarksStatus(status as "Cancelled" | "Returned");
      setShowRemarksModal(true);
    } else {
      updateStatusMutation.mutate({ status });
      onClose();
    }
  };

  const handleAcknowledgmentSave = async (data: { photo: File | null; signature: string }) => {
    const hasPhoto = Boolean(data.photo);
    const hasSignature = Boolean(data.signature.trim());

    if (!hasPhoto || !hasSignature) {
      toast({
        title: "Acknowledgment Required",
        description: "Delivery/Pickup photo and recipient signature are required before status update.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    if (data.photo) {
      formData.append('photo', data.photo);
    }
    if (hasSignature) {
      formData.append('signature_url', data.signature);
    }

    // First save the acknowledgment
    try {
      const response = await apiClient.upload(`/api/v1/shipments/${shipment.shipment_id}/acknowledgement`, formData);
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to save acknowledgment");
      }

      // Record GPS coordinates if we have an active session
      if (hasActiveSession) {
        setIsRecordingLocation(true);
        try {
          // Get current GPS position
          const position = await getCurrentPosition();

          // Determine event type based on shipment type
          const eventType = shipment.type === "pickup" ? 'pickup' : 'delivery';

          // Record the shipment event with GPS coordinates
          await recordShipmentEvent(
            shipment.shipment_id,
            eventType,
            position.latitude,
            position.longitude
          );

          toast({
            title: "Location Recorded",
            description: `GPS coordinates have been recorded for this ${eventType}.`,
          });

        } catch (error) {
          console.error('Failed to record GPS location:', error);
          toast({
            title: "GPS Recording Failed",
            description: "Failed to record GPS location, but acknowledgment was saved.",
            variant: "destructive",
          });
        } finally {
          setIsRecordingLocation(false);
        }
      }

      // Now update the shipment status
      const targetStatus = shipment.type === "delivery" ? "Delivered" : "Picked Up";
      await updateStatusMutation.mutateAsync({ status: targetStatus });

      // Close the acknowledgment modal
      setShowAcknowledgment(false);
      onClose();

    } catch (error) {
      toast({
        title: "Save Failed",
        description: (error as Error).message || "Failed to save acknowledgment.",
        variant: "destructive",
      });
    }
  };

  const handleRevertStatus = async () => {
    try {
      // Determine the previous status based on shipment type
      const previousStatus = shipment.type === "delivery" ? "In Transit" : "Assigned";

      await updateStatusMutation.mutateAsync({
        status: previousStatus
      });

      setShowRevertConfirm(false);
      // Removed onClose() to keep the details sheet open so user can see the change
    } catch (error) {
      console.error('Failed to revert status:', error);
      // Don't close the modal on error so user can try again
    }
  };

  const getPreviousStatus = () => {
    return shipment.type === "delivery" ? "In Transit" : "Assigned";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Delivered":
      case "Picked Up":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "In Transit":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "Assigned":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "Cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "Returned":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const canUpdateStatus = (targetStatus: string) => {
    if (shipment.type === "delivery") {
      return targetStatus === "Delivered" || targetStatus === "Cancelled" || targetStatus === "Returned";
    } else {
      return targetStatus === "Picked Up" || targetStatus === "Cancelled" || targetStatus === "Returned";
    }
  };

  const isProcessing = updateStatusMutation.isPending ||
    isRecordingLocation ||
    isGettingLocation ||
    isRecordingEvent;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                {shipment.type === "delivery" ? (
                  <Truck className="h-5 w-5 text-blue-600" />
                ) : (
                  <Package className="h-5 w-5 text-orange-600" />
                )}
                Shipment Details
              </SheetTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          </SheetHeader>

          <div className="mt-6">
            {/* GPS Tracking Status Banner */}
            {hasActiveSession && (
              <Card className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 mb-4">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Navigation className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-400">
                      GPS Tracking Active
                    </span>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Location will be automatically recorded when you update the shipment status.
                  </p>
                  {activeSession && (
                    <p className="text-xs text-green-500 dark:text-green-500 mt-1">
                      Session: {activeSession.id.slice(-8)}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {!hasActiveSession && (
              <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 mb-4">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                      No Active Route
                    </span>
                  </div>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    Start route tracking to automatically record GPS locations for shipments.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Tabbed Interface */}
            <ShipmentDetailTabs
              shipment={shipment}
              employeeId={employeeId}
              isManager={user?.isSuperUser || user?.isOpsTeam || user?.isStaff || user?.role === 'admin' || user?.role === 'manager'}
              onStatusUpdate={() => {
                queryClient.invalidateQueries({ queryKey: ['shipments'] });
                onClose();
              }}
            />
          </div>

          {/* Status Management Footer */}
          <div className="border-t border-border bg-muted/30 p-4">
            {/* Standard Status Updates: Visible for everyone when shipment is active (Assigned/In Transit) */}
            {(shipment.status === "Assigned" || shipment.status === "In Transit") && (
              <div className="space-y-3">
                <h4 className="font-medium text-center">Update Status</h4>
                <div className="grid grid-cols-2 gap-3">
                  {shipment.type === "delivery" && canUpdateStatus("Delivered") && (
                    <Button
                      onClick={() => handleStatusUpdateWithGPS("Delivered")}
                      disabled={isProcessing}
                      className="h-12 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Mark as Delivered
                      {hasActiveSession && (
                        <Navigation className="h-3 w-3 ml-1 text-green-200" />
                      )}
                    </Button>
                  )}

                  {shipment.type === "pickup" && canUpdateStatus("Picked Up") && (
                    <Button
                      onClick={() => handleStatusUpdateWithGPS("Picked Up")}
                      disabled={isProcessing}
                      className="h-12 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Mark as Picked Up
                      {hasActiveSession && (
                        <Navigation className="h-3 w-3 ml-1 text-green-200" />
                      )}
                    </Button>
                  )}

                  {canUpdateStatus("Cancelled") && (
                    <Button
                      variant="outline"
                      onClick={() => handleStatusUpdateWithGPS("Cancelled")}
                      disabled={isProcessing}
                      className="h-12 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  )}

                  {canUpdateStatus("Returned") && (
                    <Button
                      variant="outline"
                      onClick={() => handleStatusUpdateWithGPS("Returned")}
                      disabled={isProcessing}
                      className="h-12 border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-900/20"
                    >
                      <Undo className="h-4 w-4 mr-2" />
                      Return
                    </Button>
                  )}
                </div>

                {isRecordingLocation && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Recording GPS location...
                  </div>
                )}
              </div>
            )}

            {/* Status Management: Visible for non-riders when shipment is completed/resolved */}
            {(shipment.status === "Delivered" || shipment.status === "Picked Up" || shipment.status === "Cancelled" || shipment.status === "Returned") &&
              (user?.isSuperUser || user?.isOpsTeam || user?.isStaff) && (
                <div className="space-y-4">
                  <h4 className="font-medium text-center text-orange-600 dark:text-orange-400">Status Management</h4>

                  {/* Revert Action - Only for Delivered/Picked Up */}
                  {(shipment.status === "Delivered" || shipment.status === "Picked Up") && (
                    <div className="flex flex-col items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setShowRevertConfirm(true)}
                        disabled={isProcessing}
                        className="h-12 px-8 border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-900/20"
                      >
                        <Undo className="h-4 w-4 mr-2" />
                        Revert to {getPreviousStatus()}
                      </Button>
                      <p className="text-xs text-muted-foreground text-center px-4">
                        Use this option if you accidentally marked the shipment as {shipment.status.toLowerCase()}.
                      </p>
                    </div>
                  )}

                  {/* Additional Direct Actions for Admins */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {shipment.status !== "Cancelled" && (
                      <Button
                        variant="outline"
                        onClick={() => handleStatusUpdateWithGPS("Cancelled")}
                        disabled={isProcessing}
                        className="h-10 border-red-200 text-red-700 hover:bg-red-50 text-xs"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Force Cancel
                      </Button>
                    )}
                    {shipment.status !== "Returned" && (
                      <Button
                        variant="outline"
                        onClick={() => handleStatusUpdateWithGPS("Returned")}
                        disabled={isProcessing}
                        className="h-10 border-orange-200 text-orange-700 hover:bg-orange-50 text-xs"
                      >
                        <Undo className="h-4 w-4 mr-2" />
                        Force Return
                      </Button>
                    )}
                  </div>
                </div>
              )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Acknowledgment Capture Modal */}
      {showAcknowledgment && (
        <AcknowledgmentCapture
          onClose={() => setShowAcknowledgment(false)}
          onSubmit={handleAcknowledgmentSave}
          requireFullProof
          isSubmitting={isProcessing}
        />
      )}

      {/* Remarks Modal */}
      {showRemarksModal && remarksStatus && (
        <RemarksModal
          isOpen={showRemarksModal}
          onClose={() => setShowRemarksModal(false)}
          shipmentId={shipment.shipment_id}
          status={remarksStatus}
          employeeId={employeeId}
        />
      )}

      {/* Revert Confirmation Dialog */}
      <AlertDialog open={showRevertConfirm} onOpenChange={setShowRevertConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Revert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revert this shipment from <strong>{shipment.status}</strong> back to <strong>{getPreviousStatus()}</strong>?
              <br /><br />
              This will move the shipment back to its previous active state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRevertStatus();
              }}
              disabled={isProcessing}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reverting...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Revert Status
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ShipmentDetailModalWithTracking;

import { useState } from "react";
import type { Shipment } from "@shared/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle, Package, Undo, XCircle, Truck, Navigation,
  AlertCircle, Loader2, RotateCcw,
  ArrowLeft
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

type ShipmentWithAcknowledgment = Shipment & {
  acknowledgment?: {
    photo_url?: string;
    signature_url?: string;
  };
};

interface ShipmentDetailModalWithTrackingProps {
  shipment: ShipmentWithAcknowledgment;
  is_open: boolean;
  on_close: () => void;
  employee_id: string;
}

function ShipmentDetailModalWithTracking({
  shipment,
  is_open,
  on_close,
  employee_id
}: ShipmentDetailModalWithTrackingProps) {
  const [show_acknowledgment, set_show_acknowledgment] = useState(false);
  const [show_remarks_modal, set_show_remarks_modal] = useState(false);
  const [remarks_status, set_remarks_status] = useState<"Cancelled" | "Returned" | null>(null);
  const [is_recording_location, set_is_recording_location] = useState(false);
  const [show_revert_confirm, set_show_revert_confirm] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const {
    hasActiveSession,
    activeSession,
    recordShipmentEvent,
    isSubmitting: is_recording_event
  } = useRouteTracking(employee_id);

  const {
    getCurrentPosition,
    isLoading: is_getting_location
  } = useGPSTracking();

  const update_status_mutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      const response = await apiRequest("PATCH", `/api/v1/shipments/${shipment.id}`, { status });
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


  const handle_status_update_with_gps = async (status: string) => {
    // Proceed with normal status update
    if (status === "Delivered" || status === "Picked Up") {
      set_show_acknowledgment(true);
      // Don't update status yet - wait for acknowledgment to be saved
    } else if (status === "Cancelled" || status === "Returned") {
      set_remarks_status(status as "Cancelled" | "Returned");
      set_show_remarks_modal(true);
    } else {
      update_status_mutation.mutate({ status });
      on_close();
    }
  };

  const handle_acknowledgment_save = async (data: { photo: File | null; signature: string }) => {
    const has_photo = Boolean(data.photo);
    const has_signature = Boolean(data.signature.trim());

    if (!has_photo || !has_signature) {
      toast({
        title: "Acknowledgment Required",
        description: "Delivery/Pickup photo and recipient signature are required before status update.",
        variant: "destructive",
      });
      return;
    }

    const form_data = new FormData();
    if (data.photo) {
      form_data.append('photo', data.photo);
    }
    if (has_signature) {
      form_data.append('signature_url', data.signature);
    }

    // First save the acknowledgment
    try {
      const response = await apiClient.upload(`/api/v1/shipments/${shipment.id}/acknowledgement`, form_data);
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to save acknowledgment");
      }

      // Record GPS coordinates if we have an active session
      if (hasActiveSession) {
        set_is_recording_location(true);
        try {
          // Get current GPS position
          const position = await getCurrentPosition();

          // Determine event type based on shipment type
          const event_type = shipment.type === "pickup" ? 'pickup' : 'delivery';

          // Record the shipment event with GPS coordinates
          await recordShipmentEvent(
            shipment.id,
            event_type,
            position.latitude,
            position.longitude
          );

          toast({
            title: "Location Recorded",
            description: `GPS coordinates have been recorded for this ${event_type}.`,
          });

        } catch (error) {
          console.error('Failed to record GPS location:', error);
          toast({
            title: "GPS Recording Failed",
            description: "Failed to record GPS location, but acknowledgment was saved.",
            variant: "destructive",
          });
        } finally {
          set_is_recording_location(false);
        }
      }

      // Now update the shipment status
      const target_status = shipment.type === "delivery" ? "Delivered" : "Picked Up";
      await update_status_mutation.mutateAsync({ status: target_status });

      // Close the acknowledgment modal
      set_show_acknowledgment(false);
      on_close();

    } catch (error) {
      toast({
        title: "Save Failed",
        description: (error as Error).message || "Failed to save acknowledgment.",
        variant: "destructive",
      });
    }
  };

  const handle_revert_status = async () => {
    try {
      // Determine the previous status based on shipment type
      const previous_status = shipment.type === "delivery" ? "In Transit" : "Assigned";

      await update_status_mutation.mutateAsync({
        status: previous_status
      });

      set_show_revert_confirm(false);
      // Removed onClose() to keep the details sheet open so user can see the change
    } catch (error) {
      console.error('Failed to revert status:', error);
      // Don't close the modal on error so user can try again
    }
  };

  const get_previous_status = () => {
    return shipment.type === "delivery" ? "In Transit" : "Assigned";
  };

  const can_update_status = (target_status: string) => {
    if (shipment.type === "delivery") {
      return target_status === "Delivered" || target_status === "Cancelled" || target_status === "Returned";
    } else {
      return target_status === "Picked Up" || target_status === "Cancelled" || target_status === "Returned";
    }
  };

  const is_processing = update_status_mutation.isPending ||
    is_recording_location ||
    is_getting_location ||
    is_recording_event;

  return (
    <>
      <Sheet open={is_open} onOpenChange={on_close}>
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
                onClick={on_close}
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
                      Session: {String(activeSession.id).slice(-8)}
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
              employee_id={employee_id}
              is_manager={user?.is_super_user || user?.is_ops_team || user?.is_staff || user?.role === 'admin' || user?.role === 'manager'}
              on_status_update={() => {
                queryClient.invalidateQueries({ queryKey: ['shipments'] });
                on_close();
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
                  {shipment.type === "delivery" && can_update_status("Delivered") && (
                    <Button
                      onClick={() => handle_status_update_with_gps("Delivered")}
                      disabled={is_processing}
                      className="h-12 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {is_processing ? (
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

                  {shipment.type === "pickup" && can_update_status("Picked Up") && (
                    <Button
                      onClick={() => handle_status_update_with_gps("Picked Up")}
                      disabled={is_processing}
                      className="h-12 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {is_processing ? (
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

                  {can_update_status("Cancelled") && (
                    <Button
                      variant="outline"
                      onClick={() => handle_status_update_with_gps("Cancelled")}
                      disabled={is_processing}
                      className="h-12 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  )}

                  {can_update_status("Returned") && (
                    <Button
                      variant="outline"
                      onClick={() => handle_status_update_with_gps("Returned")}
                      disabled={is_processing}
                      className="h-12 border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-900/20"
                    >
                      <Undo className="h-4 w-4 mr-2" />
                      Return
                    </Button>
                  )}
                </div>

                {is_recording_location && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Recording GPS location...
                  </div>
                )}
              </div>
            )}

            {/* Status Management: Visible for non-riders when shipment is completed/resolved */}
            {(shipment.status === "Delivered" || shipment.status === "Picked Up" || shipment.status === "Cancelled" || shipment.status === "Returned") &&
              (user?.is_super_user || user?.is_ops_team || user?.is_staff) && (
                <div className="space-y-4">
                  <h4 className="font-medium text-center text-orange-600 dark:text-orange-400">Status Management</h4>

                  {/* Revert Action - Only for Delivered/Picked Up */}
                  {(shipment.status === "Delivered" || shipment.status === "Picked Up") && (
                    <div className="flex flex-col items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={() => set_show_revert_confirm(true)}
                        disabled={is_processing}
                        className="h-12 px-8 border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-900/20"
                      >
                        <Undo className="h-4 w-4 mr-2" />
                        Revert to {get_previous_status()}
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
                        onClick={() => handle_status_update_with_gps("Cancelled")}
                        disabled={is_processing}
                        className="h-10 border-red-200 text-red-700 hover:bg-red-50 text-xs"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Force Cancel
                      </Button>
                    )}
                    {shipment.status !== "Returned" && (
                      <Button
                        variant="outline"
                        onClick={() => handle_status_update_with_gps("Returned")}
                        disabled={is_processing}
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
      {show_acknowledgment && (
        <AcknowledgmentCapture
          on_close={() => set_show_acknowledgment(false)}
          onSubmit={handle_acknowledgment_save}
          require_full_proof
          is_submitting={is_processing}
        />
      )}

      {/* Remarks Modal */}
      {show_remarks_modal && remarks_status && (
        <RemarksModal
          isOpen={show_remarks_modal}
          onClose={() => set_show_remarks_modal(false)}
          shipmentId={shipment.id}
          status={remarks_status}
          employeeId={employee_id}
        />
      )}

      {/* Revert Confirmation Dialog */}
      <AlertDialog open={show_revert_confirm} onOpenChange={set_show_revert_confirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Revert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revert this shipment from <strong>{shipment.status}</strong> back to <strong>{get_previous_status()}</strong>?
              <br /><br />
              This will move the shipment back to its previous active state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={is_processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handle_revert_status();
              }}
              disabled={is_processing}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {is_processing ? (
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

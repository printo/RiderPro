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
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle, Package, Undo, XCircle, Truck, Navigation,
  MapPin, Clock, AlertCircle, Loader2, Copy
} from "lucide-react";
import { apiClient } from "@/services/ApiClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useRouteTracking } from "@/hooks/useRouteAPI";
import { useGPSTracking } from "@/hooks/useGPSTracking";
import RemarksModal from "@/components/ui/forms/RemarksModal";
import AcknowledgmentCapture from "@/components/AcknowledgmentCapture";
import { cn } from "@/lib/utils";

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

  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      const response = await apiRequest("PATCH", `/api/shipments/${shipment.shipment_id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments/fetch"] });
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
      const response = await apiClient.upload(`/api/shipments/${shipment.shipment_id}/acknowledgement`, formData);
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to save acknowledgment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments/fetch"] });
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

  const handleStatusUpdateWithGPS = async (status: string) => {
    // Record GPS coordinates if we have an active session
    if (hasActiveSession && (status === "Delivered" || status === "Picked Up")) {
      setIsRecordingLocation(true);

      try {
        // Get current GPS position
        const position = await getCurrentPosition();

        // Determine event type based on status and shipment type
        const eventType = (status === "Picked Up" ||
          (status === "Delivered" && shipment.type === "pickup"))
          ? 'pickup' : 'delivery';

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
          description: "Failed to record GPS location, but status will still be updated.",
          variant: "destructive",
        });
      } finally {
        setIsRecordingLocation(false);
      }
    }

    // Proceed with normal status update
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

  const handleAcknowledgmentSave = async (data: { photo: File | null; signature: string }) => {
    const formData = new FormData();
    if (data.photo) {
      formData.append('photo', data.photo);
    }
    if (data.signature) {
      formData.append('signature', data.signature);
    }
    acknowledgmentMutation.mutate(formData);
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
    acknowledgmentMutation.isPending ||
    isRecordingLocation ||
    isGettingLocation ||
    isRecordingEvent;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {shipment.type === "delivery" ? (
                <Truck className="h-5 w-5 text-blue-600" />
              ) : (
                <Package className="h-5 w-5 text-orange-600" />
              )}
              Shipment Details
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* GPS Tracking Status */}
            {hasActiveSession && (
              <Card className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
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
              <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
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

            {/* Shipment Information */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{shipment.customerName}</h3>
                <Badge className={getStatusColor(shipment.status)}>
                  {shipment.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Shipment ID:</span>
                  <p className="font-medium">#{shipment.shipment_id.slice(-8)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <p className="font-medium capitalize">{shipment.type}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Route:</span>
                  <p className="font-medium">{shipment.routeName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cost:</span>
                  <p className="font-medium">${shipment.cost}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{shipment.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {shipment.deliveryTime ? new Date(shipment.deliveryTime).toLocaleString() : 'Not scheduled'}
                  </span>
                </div>

                {/* Location Information with Directions */}
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    {shipment.latitude && shipment.longitude ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Location: {shipment.latitude.toFixed(6)}, {shipment.longitude.toFixed(6)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const url = `https://www.google.com/maps/dir/?api=1&destination=${shipment.latitude},${shipment.longitude}`;
                            window.open(url, '_blank');
                          }}
                          className="h-6 px-2 text-xs"
                        >
                          <Navigation className="h-3 w-3 mr-1" />
                          Directions
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Location: N/A</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Location & Directions Card */}
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-400">
                      GPS Location
                    </span>
                  </div>
                  {shipment.latitude && shipment.longitude && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const coordinates = `${shipment.latitude},${shipment.longitude}`;
                          navigator.clipboard.writeText(coordinates);
                          toast({
                            title: "Coordinates copied!",
                            description: `${coordinates} copied to clipboard`,
                          });
                        }}
                        className="h-8 px-3 text-xs bg-white hover:bg-gray-50 border-blue-300"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      <div className="relative group">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const url = `https://www.google.com/maps/dir/?api=1&destination=${shipment.latitude},${shipment.longitude}`;
                            window.open(url, '_blank');
                          }}
                          className="h-8 px-3 text-xs bg-white hover:bg-gray-50 border-blue-300"
                        >
                          <Navigation className="h-3 w-3 mr-1" />
                          Directions
                        </Button>

                        {/* Dropdown for other map options */}
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 min-w-[120px]">
                          <button
                            onClick={() => {
                              const url = `https://www.google.com/maps/dir/?api=1&destination=${shipment.latitude},${shipment.longitude}`;
                              window.open(url, '_blank');
                            }}
                            className="w-full px-3 py-2 text-xs text-left hover:bg-gray-50 border-b border-gray-100"
                          >
                            Google Maps
                          </button>
                          <button
                            onClick={() => {
                              const url = `https://maps.apple.com/?daddr=${shipment.latitude},${shipment.longitude}`;
                              window.open(url, '_blank');
                            }}
                            className="w-full px-3 py-2 text-xs text-left hover:bg-gray-50 border-b border-gray-100"
                          >
                            Apple Maps
                          </button>
                          <button
                            onClick={() => {
                              const url = `https://waze.com/ul?ll=${shipment.latitude},${shipment.longitude}&navigate=yes`;
                              window.open(url, '_blank');
                            }}
                            className="w-full px-3 py-2 text-xs text-left hover:bg-gray-50"
                          >
                            Waze
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-2">
                  {shipment.latitude && shipment.longitude ? (
                    <div className="space-y-1">
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Latitude: {shipment.latitude.toFixed(6)}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Longitude: {shipment.longitude.toFixed(6)}
                      </p>
                      <p className="text-xs text-blue-500 dark:text-blue-500 mt-2">
                        Click "Get Directions" to navigate using Google Maps
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        GPS coordinates not available
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        Location data was not provided for this shipment
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            {(shipment.status === "Assigned" || shipment.status === "In Transit") && (
              <div className="space-y-3">
                <h4 className="font-medium">Update Status</h4>
                <div className="grid grid-cols-1 gap-2">
                  {shipment.type === "delivery" && shipment.status !== "Delivered" && (
                    <Button
                      onClick={() => handleStatusUpdateWithGPS("Delivered")}
                      disabled={isProcessing}
                      className="w-full justify-start"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Mark as Delivered
                      {hasActiveSession && (
                        <Navigation className="h-3 w-3 ml-auto text-green-500" />
                      )}
                    </Button>
                  )}

                  {shipment.type === "pickup" && shipment.status !== "Picked Up" && (
                    <Button
                      onClick={() => handleStatusUpdateWithGPS("Picked Up")}
                      disabled={isProcessing}
                      className="w-full justify-start"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Mark as Picked Up
                      {hasActiveSession && (
                        <Navigation className="h-3 w-3 ml-auto text-green-500" />
                      )}
                    </Button>
                  )}

                  {shipment.status !== "Cancelled" && shipment.status !== "Returned" && (
                    <Button
                      variant="outline"
                      onClick={() => handleStatusUpdateWithGPS("Cancelled")}
                      disabled={isProcessing}
                      className="w-full justify-start"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel Shipment
                    </Button>
                  )}

                  {shipment.status !== "Returned" && shipment.status !== "Cancelled" && (
                    <Button
                      variant="outline"
                      onClick={() => handleStatusUpdateWithGPS("Returned")}
                      disabled={isProcessing}
                      className="w-full justify-start"
                    >
                      <Undo className="h-4 w-4 mr-2" />
                      Mark as Returned
                    </Button>
                  )}
                </div>

                {isRecordingLocation && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Recording GPS location...
                  </div>
                )}
              </div>
            )}

            {/* Acknowledgment Display */}
            {shipment.acknowledgment && (
              <div className="space-y-3">
                <h4 className="font-medium">Acknowledgment</h4>
                <div className="grid grid-cols-2 gap-4">
                  {shipment.acknowledgment.photoUrl && (
                    <div>
                      <span className="text-sm text-muted-foreground">Photo:</span>
                      <img
                        src={shipment.acknowledgment.photoUrl}
                        alt="Delivery photo"
                        className="mt-1 w-full h-24 object-cover rounded border"
                      />
                    </div>
                  )}
                  {shipment.acknowledgment.signatureUrl && (
                    <div>
                      <span className="text-sm text-muted-foreground">Signature:</span>
                      <img
                        src={shipment.acknowledgment.signatureUrl}
                        alt="Customer signature"
                        className="mt-1 w-full h-24 object-cover rounded border"
                      />
                    </div>
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
          isSubmitting={acknowledgmentMutation.isPending}
        />
      )}

      {/* Remarks Modal */}
      {showRemarksModal && remarksStatus && (
        <RemarksModal
          isOpen={showRemarksModal}
          onClose={() => setShowRemarksModal(false)}
          shipmentId={shipment.shipment_id}
          status={remarksStatus}
        />
      )}
    </>
  );
}

export default ShipmentDetailModalWithTracking;
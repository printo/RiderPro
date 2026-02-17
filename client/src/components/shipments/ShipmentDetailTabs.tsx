import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Package, MapPin, Clock, Phone, Route, FileText, Navigation,
  AlertCircle, Eye
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { shipmentsApi } from '@/apiClient/shipments';
import { apiRequest } from '@/lib/queryClient';
import { apiClient } from '@/services/ApiClient';
import PDFSigner from './PDFSigner';
import EditableField from './EditableField';
import CardSection from './CardSection';
import GPSLocationDisplay from './GPSLocationDisplay';
import PackageBoxesTable from './PackageBoxesTable';
import ChangeRiderSection from './ChangeRiderSection';
import DropPointMap from '@/components/tracking/DropPointMap';
import type { Shipment, RouteLocation } from '@shared/types';

function formatAddressForDisplay(shipment: Shipment): string | undefined {
  if (typeof shipment.addressDisplay === 'string' && shipment.addressDisplay) return shipment.addressDisplay;
  if (typeof shipment.deliveryAddress === 'string' && shipment.deliveryAddress) return shipment.deliveryAddress;
  const addr = shipment.deliveryAddress ?? shipment.address;
  if (addr && typeof addr === 'object' && !Array.isArray(addr)) {
    const parts = [
      (addr as { address?: string }).address,
      (addr as { place_name?: string }).place_name,
      (addr as { city?: string }).city,
      (addr as { state?: string }).state,
      (addr as { pincode?: string }).pincode,
      (addr as { country?: string }).country
    ].filter(Boolean) as string[];
    return parts.length ? parts.join(', ') : undefined;
  }
  return undefined;
}

interface ShipmentDetailTabsProps {
  shipment: Shipment;
  employeeId: string;
  isManager: boolean;
  onStatusUpdate?: () => void;
}

interface ActiveRiderLocation {
  employee_id: string;
  latitude: number;
  longitude: number;
  timestamp?: string;
  session_id?: string;
}

export default function ShipmentDetailTabs({
  shipment,
  employeeId,
  isManager,
  onStatusUpdate
}: ShipmentDetailTabsProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [acknowledgmentSettings, setAcknowledgmentSettings] = useState<any>(null);
  const [localRiderId, setLocalRiderId] = useState<string>(
    shipment.employeeId || (shipment as Shipment & { employee_id?: string }).employee_id || ''
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch PDF document
  const { data: pdfData, isLoading: isLoadingPdf, isError: isPdfError } = useQuery({
    queryKey: ['shipment-pdf', shipment.shipment_id],
    queryFn: () => shipmentsApi.getPdfDocument(shipment.shipment_id),
    enabled: activeTab === 'acknowledgment',
    retry: 2,
  });

  // Fetch acknowledgment settings
  const { data: ackSettingsData, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['acknowledgment-settings', shipment.shipment_id],
    queryFn: () => shipmentsApi.getAcknowledgmentSettings(shipment.shipment_id),
    enabled: activeTab === 'acknowledgment',
    retry: 2,
  });

  const { data: activeRidersData } = useQuery({
    queryKey: ['active-riders-locations'],
    queryFn: async (): Promise<ActiveRiderLocation[]> => {
      const response = await apiRequest('GET', '/api/v1/routes/active-riders');
      const result = await response.json();
      return Array.isArray(result?.riders) ? result.riders : [];
    },
    enabled: isManager && activeTab === 'tracking',
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (pdfData?.success && pdfData.pdf_url) {
      setPdfUrl(pdfData.pdf_url);
    }
  }, [pdfData]);

  useEffect(() => {
    if (ackSettingsData?.success && ackSettingsData.settings) {
      setAcknowledgmentSettings(ackSettingsData.settings);
    }
  }, [ackSettingsData]);

  useEffect(() => {
    setLocalRiderId(
      shipment.employeeId || (shipment as Shipment & { employee_id?: string }).employee_id || ''
    );
  }, [shipment]);

  // Change rider handler
  const handleChangeRider = async (newRiderId: string, reason?: string) => {
    const response = await shipmentsApi.changeRider(shipment.shipment_id, newRiderId, reason);
    const updatedRider =
      response?.shipment?.employeeId ||
      (response?.shipment as Shipment & { employee_id?: string })?.employee_id ||
      newRiderId;
    setLocalRiderId(updatedRider);
    queryClient.invalidateQueries({ queryKey: ['shipments'] });
    toast({
      title: 'Rider updated',
      description: `Shipment assigned to ${updatedRider}.`,
    });
  };

  // Update shipment handler
  const handleUpdateShipment = async (updates: any) => {
    await apiRequest("PATCH", `/api/v1/shipments/${shipment.shipment_id}`, updates);
    queryClient.invalidateQueries({ queryKey: ['shipments'] });
  };

  const canChangeRider = () => {
    const blockedStatuses = ['Collected', 'In Transit', 'Picked Up', 'Delivered', 'Skipped', 'Returned', 'Cancelled'];
    return !blockedStatuses.includes(shipment.status || '');
  };

  const activeRiderLocation = (activeRidersData || []).find(
    (rider) => rider.employee_id?.toLowerCase() === (localRiderId || '').toLowerCase()
  );
  const shipmentMapLocation: RouteLocation[] =
    shipment.latitude && shipment.longitude
      ? [{
        id: shipment.shipment_id,
        shipment_id: shipment.shipment_id,
        latitude: shipment.latitude,
        longitude: shipment.longitude,
        customerName: shipment.customerName || shipment.recipientName,
        address: formatAddressForDisplay(shipment) || undefined,
      }]
      : [];

  const formatAddress = (address: any): string => {
    if (!address) return 'No address';
    if (typeof address === 'string') return address;
    if (typeof address === 'object' && address !== null) {
      const parts: string[] = [];
      if (address.address) parts.push(String(address.address));
      if (address.place_name) parts.push(String(address.place_name));
      if (address.city) parts.push(String(address.city));
      if (address.state) parts.push(String(address.state));
      if (address.pincode) parts.push(String(address.pincode));
      return parts.length > 0 ? parts.join(', ') : 'No address';
    }
    return 'No address';
  };

  const handleSignatureComplete = async (signatureData: string) => {
    try {
      const response = await apiClient.post(
        `/api/v1/shipments/${shipment.shipment_id}/acknowledgement`,
        { signature_url: signatureData }
      );
      if (!response.ok) {
        throw new Error('Failed to save signature');
      }

      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      toast({
        title: 'Signature saved',
        description: 'Signature has been synced successfully.',
      });
    } catch (error) {
      toast({
        title: 'Signature save failed',
        description: error instanceof Error ? error.message : 'Failed to save signature.',
        variant: 'destructive',
      });
    }
  };

  const handlePhotoComplete = async (photoFile: File) => {
    try {
      const formData = new FormData();
      formData.append('photo', photoFile);
      const response = await apiClient.upload(
        `/api/v1/shipments/${shipment.shipment_id}/acknowledgement`,
        formData
      );
      if (!response.ok) {
        throw new Error('Failed to save proof photo');
      }

      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      toast({
        title: 'Photo saved',
        description: 'Proof of delivery photo has been synced successfully.',
      });
    } catch (error) {
      toast({
        title: 'Photo save failed',
        description: error instanceof Error ? error.message : 'Failed to save photo.',
        variant: 'destructive',
      });
    }
  };

  const handleSignedPdfUpload = async (signedPdfUrl: string) => {
    try {
      await shipmentsApi.uploadSignedPdf(shipment.shipment_id, signedPdfUrl);
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      toast({
        title: 'Signed PDF uploaded',
        description: 'Signed PDF has been saved and synced.',
      });
    } catch (error) {
      toast({
        title: 'Signed PDF upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload signed PDF.',
        variant: 'destructive',
      });
    }
  };
  
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

      {/* ================= TAB HEADER ================= */}
      <ScrollArea className="w-full mb-6">
        <TabsList className="inline-flex h-auto w-max gap-2 p-1">
          <TabsTrigger className="px-4 py-2 text-sm font-medium min-w-[112px] justify-center" value="overview">
            Overview
          </TabsTrigger>
          {isManager && (
            <TabsTrigger className="px-4 py-2 text-sm font-medium min-w-[112px] justify-center" value="manager">
              Manager
            </TabsTrigger>
          )}
          {isManager && (
            <TabsTrigger className="px-4 py-2 text-sm font-medium min-w-[112px] justify-center" value="tracking">
              Tracking
            </TabsTrigger>
          )}
          <TabsTrigger className="px-4 py-2 text-sm font-medium min-w-[112px] justify-center" value="packages">
            Packages
          </TabsTrigger>
          <TabsTrigger className="px-4 py-2 text-sm font-medium min-w-[140px] justify-center" value="acknowledgment">
            Acknowledgment
          </TabsTrigger>
        </TabsList>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>
      <TabsContent value="overview" className="space-y-4">
        <CardSection>
          <div className="space-y-4">
            <div className="flex justify-between">
              <h3 className="text-lg font-semibold">
                {shipment.customerName || shipment.recipientName}
              </h3>
              <Badge>{shipment.status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Pia Order ID</span>
                <p className="font-semibold">
                  {shipment.orderId || (shipment as Shipment & { pops_order_id?: number }).pops_order_id || 'Not available'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Shipment ID (Internal)</span>
                <p className="font-medium">#{shipment.shipment_id?.slice(-8)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Type</span>
                <p className="font-medium capitalize">{shipment.type}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Route</span>
                <p className="font-medium">{shipment.routeName || 'Not assigned'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Cost</span>
                <p className="font-medium">₹{shipment.cost || 0}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Rider</span>
                <p className="font-medium">{localRiderId || 'Unassigned'}</p>
              </div>
            </div>

            <div className="pt-3 border-t space-y-2">
              <div className="flex gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {formatAddress(
                    (shipment as Shipment & { addressDisplay?: string }).addressDisplay ||
                    shipment.address ||
                    shipment.deliveryAddress
                  )}
                </span>
              </div>
              <div className="flex gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{shipment.customerMobile || shipment.recipientPhone || 'No phone'}</span>
              </div>
              <div className="flex gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {shipment.deliveryTime
                    ? new Date(shipment.deliveryTime).toLocaleString()
                    : 'Not scheduled'}
                </span>
              </div>
            </div>
          </div>
        </CardSection>
      </TabsContent>

      {/* Manager Tab - Only visible to managers */}
      {isManager && (
        <TabsContent value="manager" className="space-y-4 mt-6">
          <CardSection
            title="Change Rider"
            icon={<span className="h-5 w-5">👤</span>}
          >
            <ChangeRiderSection
              currentRiderId={localRiderId || null}
              canChange={canChangeRider()}
              onChangeRider={handleChangeRider}
              blockedStatusMessage={`Cannot change rider. Shipment is already ${shipment.status}. Rider can only be changed when status is Initiated or Assigned.`}
            />
          </CardSection>

          <CardSection
            title="Route"
            icon={<Route className="h-5 w-5" />}
          >
            <EditableField
              label="Route"
              value={shipment.routeName || ''}
              onSave={(value) => handleUpdateShipment({ route_name: value })}
              placeholder="Select route"
              icon={<Route className="h-4 w-4" />}
              fetchOptions={async () => {
                const response = await shipmentsApi.getAvailableRoutes();
                return response.routes.map(route => ({
                  label: route.name,
                  value: route.value
                }));
              }}
            />
          </CardSection>

          <CardSection title="Remarks">
            <EditableField
              label="Remarks"
              value={shipment.remarks || ''}
              onSave={(value) => handleUpdateShipment({ remarks: value })}
              multiline
              placeholder="Enter remarks"
            />
          </CardSection>

          <CardSection title="Special Instructions">
            <EditableField
              label="Special Instructions"
              value={shipment.specialInstructions || ''}
              onSave={(value) => handleUpdateShipment({ special_instructions: value })}
              multiline
              placeholder="Enter special instructions"
            />
          </CardSection>
        </TabsContent>
      )}

      {/* Tracking Tab - Only visible to managers */}
      {isManager && (
        <TabsContent value="tracking" className="space-y-4 mt-6">
          {shipmentMapLocation.length > 0 ? (
            <CardSection
              title="Live Rider to Shipment Map"
              icon={<MapPin className="h-5 w-5" />}
            >
              <div className="h-[320px] rounded-lg overflow-hidden border">
                <DropPointMap
                  shipments={[shipment]}
                  currentLocation={
                    activeRiderLocation
                      ? { latitude: activeRiderLocation.latitude, longitude: activeRiderLocation.longitude }
                      : undefined
                  }
                  optimizedPath={shipmentMapLocation}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {activeRiderLocation
                  ? `Showing active rider location for ${localRiderId} and route to this shipment.`
                  : 'No active rider location currently available; showing shipment destination only.'}
              </p>
            </CardSection>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Shipment location is not available yet, so tracking map cannot be displayed.
              </AlertDescription>
            </Alert>
          )}

          <CardSection
            title="GPS Tracking"
            icon={<Navigation className="h-5 w-5" />}
          >
            <div className="space-y-3">
              <div>
                <span className="text-sm text-muted-foreground">Current Rider:</span>
                <p className="font-medium">{localRiderId || 'Unassigned'}</p>
              </div>
              <GPSLocationDisplay
                latitude={shipment.latitude}
                longitude={shipment.longitude}
                startLatitude={shipment.start_latitude}
                startLongitude={shipment.start_longitude}
                stopLatitude={shipment.stop_latitude}
                stopLongitude={shipment.stop_longitude}
                kmTravelled={shipment.km_travelled}
                addressDisplay={formatAddressForDisplay(shipment)}
                showDirections
              />
            </div>
          </CardSection>
        </TabsContent>
      )}

      {/* Packages Tab */}
      <TabsContent value="packages" className="space-y-4 mt-6">
        <CardSection
          title="Package Boxes"
          icon={<Package className="h-5 w-5" />}
        >
          <PackageBoxesTable packageBoxes={shipment.package_boxes} />
        </CardSection>
      </TabsContent>

      {/* Acknowledgment Tab */}
      <TabsContent value="acknowledgment" className="space-y-6 mt-6">
        {/* Loading States */}
        {(isLoadingPdf || isLoadingSettings) && (
          <CardSection title="Loading Acknowledgment Data">
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-sm text-muted-foreground">
                  {isLoadingPdf ? 'Loading PDF document...' : 'Loading acknowledgment settings...'}
                </p>
              </div>
            </div>
          </CardSection>
        )}

        {/* PDF Error State */}
        {isPdfError && !isLoadingPdf && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load PDF document. Please try refreshing the page or contact support if the issue persists.
            </AlertDescription>
          </Alert>
        )}

        {/* Empty State - Show when no data available */}
        {!isLoadingPdf && !isLoadingSettings && !pdfUrl && !shipment.signatureUrl && !shipment.photoUrl && !shipment.signedPdfUrl && (
          <CardSection>
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4 mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Acknowledgment Data</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                No acknowledgment data is available for this shipment. PDF document, signature, or photo will appear here once captured.
              </p>
            </div>
          </CardSection>
        )}

        {/* PDF Signer Component - Only show when PDF is available */}
        {pdfUrl && !isLoadingPdf && (
          <PDFSigner
            pdfUrl={pdfUrl}
            onSignatureComplete={handleSignatureComplete}
            onPhotoComplete={handlePhotoComplete}
            onSignedPdfUpload={handleSignedPdfUpload}
            signatureRequired={acknowledgmentSettings?.signature_required || 'optional'}
            photoRequired={acknowledgmentSettings?.photo_required || 'optional'}
            requirePdf={acknowledgmentSettings?.require_pdf || false}
          />
        )}

        {/* Captured Signature */}
        {shipment.signatureUrl && (
          <CardSection
            title="Captured Signature"
            icon={<span className="h-5 w-5 text-purple-600">✍</span>}
          >
            <div className="border-2 border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900 p-4">
              <img
                src={shipment.signatureUrl}
                alt="Signature"
                className="w-full max-w-md mx-auto border rounded shadow-sm"
              />
            </div>
          </CardSection>
        )}

        {/* Proof of Delivery Photo */}
        {shipment.photoUrl && (
          <CardSection
            title="Proof of Delivery Photo"
            icon={<span className="h-5 w-5 text-green-600">📷</span>}
          >
            <div className="border-2 border-green-200 dark:border-green-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900 p-4">
              <img
                src={shipment.photoUrl}
                alt="Proof of delivery"
                className="w-full max-w-2xl mx-auto border rounded shadow-sm"
              />
            </div>
          </CardSection>
        )}

        {/* Signed PDF */}
        {shipment.signedPdfUrl && (
          <CardSection
            title={
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span>Signed PDF Document</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(shipment.signedPdfUrl, '_blank')}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
              </div>
            }
          >
            <div className="border-2 border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
              <iframe
                src={shipment.signedPdfUrl}
                className="w-full h-96"
                title="Signed PDF"
                onError={() => {
                  toast({
                    title: "PDF Load Error",
                    description: "Failed to load PDF. Please try opening it in a new tab.",
                    variant: "destructive",
                  });
                }}
              />
            </div>
          </CardSection>
        )}
      </TabsContent>
    </Tabs>
  );
}


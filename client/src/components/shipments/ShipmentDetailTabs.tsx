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
import type { Shipment } from '@shared/types';

function formatAddressForDisplay(shipment: Shipment): string | undefined {
  if (typeof shipment.address_display === 'string' && shipment.address_display) return shipment.address_display;
  const addr = shipment.address;
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
  employee_id: string;
  is_manager: boolean;
  on_status_update?: () => void;
}

export default function ShipmentDetailTabs({
  shipment,
  employee_id: _employee_id,
  is_manager,
  on_status_update: _on_status_update
}: ShipmentDetailTabsProps) {
  const [active_tab, set_active_tab] = useState('overview');
  const [pdf_url, set_pdf_url] = useState<string | null>(null);
  const [acknowledgment_settings, set_acknowledgment_settings] = useState<any>(null);
  const [local_rider_id, set_local_rider_id] = useState<string>(
    shipment.employee_id || ''
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch PDF document
  const { data: pdf_data, isLoading: is_loading_pdf, isError: is_pdf_error } = useQuery({
    queryKey: ['shipment-pdf', shipment.id],
    queryFn: () => shipmentsApi.getPdfDocument(shipment.id),
    enabled: active_tab === 'acknowledgment',
    retry: 2,
  });

  // Fetch acknowledgment settings
  const { data: ack_settings_data, isLoading: is_loading_settings } = useQuery({
    queryKey: ['acknowledgment-settings', shipment.id],
    queryFn: () => shipmentsApi.getAcknowledgmentSettings(shipment.id),
    enabled: active_tab === 'acknowledgment',
    retry: 2,
  });

  useEffect(() => {
    if (pdf_data?.success && pdf_data.pdf_url) {
      set_pdf_url(pdf_data.pdf_url);
    }
  }, [pdf_data]);

  useEffect(() => {
    if (ack_settings_data?.success && ack_settings_data.settings) {
      set_acknowledgment_settings(ack_settings_data.settings);
    }
  }, [ack_settings_data]);

  useEffect(() => {
    set_local_rider_id(
      shipment.employee_id || ''
    );
  }, [shipment]);

  // Change rider handler
  const handle_change_rider = async (new_rider_id: string, reason?: string) => {
    const response = await shipmentsApi.changeRider(shipment.id, new_rider_id, reason);
    const updated_rider =
      response?.shipment?.employee_id ||
      new_rider_id;
    set_local_rider_id(updated_rider);
    queryClient.invalidateQueries({ queryKey: ['shipments'] });
    toast({
      title: 'Rider updated',
      description: `Shipment assigned to ${updated_rider}.`,
    });
  };

  // Update shipment handler
  const handle_update_shipment = async (updates: any) => {
    await apiRequest("PATCH", `/api/v1/shipments/${shipment.id}`, updates);
    queryClient.invalidateQueries({ queryKey: ['shipments'] });
  };

  const can_change_rider = () => {
    const blocked_statuses = ['In Transit', 'Picked Up', 'Delivered', 'Returned', 'Cancelled'];
    return !blocked_statuses.includes(shipment.status || '');
  };

  const format_address = (address: any): string => {
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

  const handle_signature_complete = async (signature_data: string) => {
    try {
      const response = await apiClient.post(
        `/api/v1/shipments/${shipment.id}/acknowledgement`,
        { signature_url: signature_data }
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

  const handle_photo_complete = async (photo_file: File) => {
    try {
      const form_data = new FormData();
      form_data.append('photo', photo_file);
      const response = await apiClient.upload(
        `/api/v1/shipments/${shipment.id}/acknowledgement`,
        form_data
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

  const handle_signed_pdf_upload = async (signed_pdf_url: string) => {
    try {
      await shipmentsApi.uploadSignedPdf(shipment.id, signed_pdf_url);
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
    <Tabs value={active_tab} onValueChange={set_active_tab} className="w-full">

      {/* ================= TAB HEADER ================= */}
      <ScrollArea className="w-full mb-6">
        <TabsList className="inline-flex h-auto w-max gap-2 p-1">
          <TabsTrigger className="px-4 py-2 text-sm font-medium min-w-[112px] justify-center" value="overview">
            Overview
          </TabsTrigger>
          {is_manager && (
            <TabsTrigger className="px-4 py-2 text-sm font-medium min-w-[112px] justify-center" value="manager">
              Manager
            </TabsTrigger>
          )}
          {is_manager && (
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
                {shipment.customer_name}
              </h3>
              <Badge>{shipment.status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Pia Order ID</span>
                <p className="font-semibold">
                  {shipment.pops_order_id || 'Not available'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Shipment ID (Internal)</span>
                <p className="font-medium">#{shipment.id?.slice(-8)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Type</span>
                <p className="font-medium capitalize">{shipment.type}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Route</span>
                <p className="font-medium">{shipment.route_name || 'Not assigned'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Cost</span>
                <p className="font-medium">₹{shipment.cost || 0}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Rider</span>
                <p className="font-medium">{local_rider_id || 'Unassigned'}</p>
              </div>
            </div>

            <div className="pt-3 border-t space-y-2">
              <div className="flex gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {format_address(
                    shipment.address_display ||
                    shipment.address
                  )}
                </span>
              </div>
              <div className="flex gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{shipment.customer_mobile || 'No phone'}</span>
              </div>
              <div className="flex gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {shipment.delivery_time
                    ? new Date(shipment.delivery_time).toLocaleString()
                    : 'Not scheduled'}
                </span>
              </div>
            </div>
          </div>
        </CardSection>
      </TabsContent>

      {/* Manager Tab - Only visible to managers */}
      {is_manager && (
        <TabsContent value="manager" className="space-y-4 mt-6">
          <CardSection
            title="Change Rider"
            icon={<span className="h-5 w-5">👤</span>}
          >
            <ChangeRiderSection
              current_rider_id={local_rider_id || null}
              can_change={can_change_rider()}
              on_change_rider={handle_change_rider}
              blocked_status_message={`Cannot change rider. Shipment is already ${shipment.status}. Rider can only be changed when status is Initiated or Assigned.`}
            />
          </CardSection>

          <CardSection
            title="Route"
            icon={<Route className="h-5 w-5" />}
          >
            <EditableField
              label="Route"
              value={shipment.route_name || ''}
              on_save={(value) => handle_update_shipment({ route_name: value })}
              placeholder="Select route"
              icon={<Route className="h-4 w-4" />}
              fetch_options={async () => {
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
              on_save={(value) => handle_update_shipment({ remarks: value })}
              multiline
              placeholder="Enter remarks"
            />
          </CardSection>

          <CardSection title="Special Instructions">
            <EditableField
              label="Special Instructions"
              value={shipment.special_instructions || ''}
              on_save={(value) => handle_update_shipment({ special_instructions: value })}
              multiline
              placeholder="Enter special instructions"
            />
          </CardSection>
        </TabsContent>
      )}

      {/* Tracking Tab - Only visible to managers */}
      {is_manager && (
        <TabsContent value="tracking" className="space-y-4 mt-6">
          <CardSection
            title="GPS Tracking"
            icon={<Navigation className="h-5 w-5" />}
          >
            <div className="space-y-3">
              <div>
                <span className="text-sm text-muted-foreground">Current Rider:</span>
                <p className="font-medium">{local_rider_id || 'Unassigned'}</p>
              </div>
              <GPSLocationDisplay
                latitude={shipment.latitude}
                longitude={shipment.longitude}
                start_latitude={shipment.start_latitude}
                start_longitude={shipment.start_longitude}
                stop_latitude={shipment.stop_latitude}
                stop_longitude={shipment.stop_longitude}
                km_travelled={shipment.km_travelled}
                address_display={formatAddressForDisplay(shipment)}
                show_directions
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
          <PackageBoxesTable package_boxes={shipment.package_boxes} />
        </CardSection>
      </TabsContent>

      {/* Acknowledgment Tab */}
      <TabsContent value="acknowledgment" className="space-y-6 mt-6">
        {/* Loading States */}
        {(is_loading_pdf || is_loading_settings) && (
          <CardSection title="Loading Acknowledgment Data">
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-sm text-muted-foreground">
                  {is_loading_pdf ? 'Loading PDF document...' : 'Loading acknowledgment settings...'}
                </p>
              </div>
            </div>
          </CardSection>
        )}

        {/* PDF Error State */}
        {is_pdf_error && !is_loading_pdf && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load PDF document. Please try refreshing the page or contact support if the issue persists.
            </AlertDescription>
          </Alert>
        )}

        {/* Empty State - Show when no data available */}
        {!is_loading_pdf && !is_loading_settings && !pdf_url && !shipment.signature_url && !shipment.photo_url && !shipment.signed_pdf_url && (
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
        {pdf_url && !is_loading_pdf && (
          <PDFSigner
            pdf_url={pdf_url}
            on_signature_complete={handle_signature_complete}
            on_photo_complete={handle_photo_complete}
            on_signed_pdf_upload={handle_signed_pdf_upload}
            signature_required={acknowledgment_settings?.signature_required || 'optional'}
            photo_required={acknowledgment_settings?.photo_required || 'optional'}
            require_pdf={acknowledgment_settings?.require_pdf || false}
          />
        )}

        {/* Captured Signature */}
        {shipment.signature_url && (
          <CardSection
            title="Captured Signature"
            icon={<span className="h-5 w-5 text-purple-600">✍</span>}
          >
            <div className="border-2 border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900 p-4">
              <img
                src={shipment.signature_url}
                alt="Signature"
                className="w-full max-w-md mx-auto border rounded shadow-sm"
              />
            </div>
          </CardSection>
        )}

        {/* Proof of Delivery Photo */}
        {shipment.photo_url && (
          <CardSection
            title="Proof of Delivery Photo"
            icon={<span className="h-5 w-5 text-green-600">📷</span>}
          >
            <div className="border-2 border-green-200 dark:border-green-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900 p-4">
              <img
                src={shipment.photo_url}
                alt="Proof of delivery"
                className="w-full max-w-2xl mx-auto border rounded shadow-sm"
              />
            </div>
          </CardSection>
        )}

        {/* Signed PDF */}
        {shipment.signed_pdf_url && (
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
                  onClick={() => window.open(shipment.signed_pdf_url, '_blank')}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
              </div>
            }
          >
            <div className="border-2 border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
              <iframe
                src={shipment.signed_pdf_url}
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

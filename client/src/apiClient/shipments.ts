import { apiRequest } from "@/lib/queryClient";
import { log } from "../utils/logger.js";
import { API_ENDPOINTS } from "@/config/api";
import {
  Shipment,
  InsertShipment,
  UpdateShipment,
  BatchUpdate,
  ShipmentFilters,
  DashboardMetrics,
  ExternalShipmentPayload,
  ExternalShipmentBatch,
  ExternalUpdatePayload,
  ShipmentReceptionResponse,
  BatchSyncResult,
  Acknowledgment
} from "@shared/types";

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export const shipmentsApi = {
  getShipments: async (filters: ShipmentFilters = {}): Promise<PaginatedResponse<Shipment>> => {
    log.dev('📦 shipmentsApi.getShipments called with filters:', filters);

    const params = new URLSearchParams();

    // Add filter parameters
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.type) params.append('type', filters.type);
    if (filters.routeName) params.append('routeName', filters.routeName);
    if (filters.date) params.append('date', filters.date);
    if (filters.search) params.append('search', filters.search);
    if (filters.employeeId) params.append('employeeId', filters.employeeId);
    if (filters.orderId) params.append('orderId', String(filters.orderId));

    // Add date range if provided
    if (filters.dateRange) {
      params.append('dateRange', JSON.stringify(filters.dateRange));
    }

    // Add pagination parameters
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    // Add sorting parameters
    if (filters.sortField) params.append('sortField', filters.sortField);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const url = `${API_ENDPOINTS.shipments.fetch}${params.toString() ? `?${params.toString()}` : ''}`;
    log.dev('📡 Making API request to:', url);

    const response = await apiRequest("GET", url);

    log.dev('📥 Shipments API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    // Extract pagination headers
    const total = parseInt(response.headers.get('X-Total-Count') || '0', 10);
    const totalPages = parseInt(response.headers.get('X-Total-Pages') || '1', 10);
    const currentPage = parseInt(response.headers.get('X-Current-Page') || '1', 10);
    const perPage = parseInt(response.headers.get('X-Per-Page') || '20', 10);
    const hasNextPage = response.headers.get('X-Has-Next-Page') === 'true';
    const hasPreviousPage = response.headers.get('X-Has-Previous-Page') === 'true';

    const data = await response.json();

    log.dev('📊 Parsed shipments data:', {
      dataLength: data?.length,
      total,
      currentPage,
      totalPages
    });

    return {
      data,
      total,
      page: currentPage,
      limit: perPage,
      totalPages,
      hasNextPage,
      hasPreviousPage,
    };
  },

  getShipment: async (id: string): Promise<{ shipment: Shipment; acknowledgment?: Acknowledgment }> => {
    const response = await apiRequest("GET", API_ENDPOINTS.shipments.get(id));
    return response.json();
  },

  createShipment: async (shipment: InsertShipment): Promise<Shipment> => {
    const response = await apiRequest("POST", API_ENDPOINTS.shipments.create, shipment);
    return response.json();
  },

  updateShipment: async (id: string, updates: UpdateShipment): Promise<Shipment> => {
    const response = await apiRequest("PATCH", API_ENDPOINTS.shipments.update(id), updates);
    return response.json();
  },

  batchUpdateShipments: async (updates: BatchUpdate): Promise<{ updatedCount: number; message: string }> => {
    const response = await apiRequest("PATCH", API_ENDPOINTS.shipments.batch, updates);
    return response.json();
  },

  generateGoogleMapsRoute: async (
    shipmentIds: number[],
    startLocation?: { latitude: number; longitude: number },
    optimize: boolean = true
  ): Promise<{ success: boolean; url: string; shipment_count: number }> => {
    const response = await apiRequest("POST", API_ENDPOINTS.shipments.googleMapsRoute, {
      shipment_ids: shipmentIds,
      start_location: startLocation,
      optimize,
    });
    return response.json();
  },

  getDashboardMetrics: async (): Promise<DashboardMetrics> => {
    const response = await apiRequest("GET", API_ENDPOINTS.dashboard.metrics);
    const raw = await response.json();

    // Backend returns snake_case fields; map them into the DashboardMetrics
    // shape expected by the frontend (camelCase plus aggregate fields).
    const totalShipments = raw.total_shipments ?? 0;
    const pendingShipments = raw.pending_shipments ?? 0;
    const inTransitShipments = raw.in_transit_shipments ?? 0;
    const deliveredShipments = raw.delivered_shipments ?? 0;
    const pickedUpShipments = raw.picked_up_shipments ?? 0;
    const inProgressShipments = raw.in_progress_shipments ?? 0;

    const completed = deliveredShipments; // Standardizing: Delivered = Completed
    const inProgress = inProgressShipments; // Picked Up + In Transit (calculated on backend)
    const pending = pendingShipments;

    const metrics: DashboardMetrics = {
      totalShipments,
      pendingShipments,
      deliveredShipments,
      inTransitShipments,
      completed,
      inProgress,
      pending,
      averageDeliveryTime: raw.average_delivery_time ?? 0,
      // Build a simple status breakdown so charts have data.
      statusBreakdown: {
        Pending: pendingShipments,
        "In Transit": inTransitShipments,
        Delivered: deliveredShipments,
        "Picked Up": pickedUpShipments,
        Returned: raw.returned_shipments ?? 0,
        Cancelled: raw.cancelled_shipments ?? 0,
      },
      // Route/type breakdowns can be filled in later from richer analytics.
      typeBreakdown: {},
      routeBreakdown: {},
    };

    return metrics;
  },

  // External integration endpoints
  receiveExternalShipment: async (payload: ExternalShipmentPayload | ExternalShipmentBatch): Promise<ShipmentReceptionResponse> => {
    const response = await apiRequest("POST", API_ENDPOINTS.shipments.receive, payload);
    return response.json();
  },

  sendExternalUpdate: async (payload: ExternalUpdatePayload): Promise<{ success: boolean; message: string }> => {
    const response = await apiRequest("POST", API_ENDPOINTS.shipments.updateExternal, payload);
    return response.json();
  },

  sendExternalBatchUpdate: async (payload: ExternalUpdatePayload[]): Promise<BatchSyncResult> => {
    const response = await apiRequest("POST", API_ENDPOINTS.shipments.updateExternalBatch, payload);
    return response.json();
  },

  changeRider: async (shipmentId: string, employeeId: string, reason?: string): Promise<{ success: boolean; message: string; shipment: Shipment }> => {
    const response = await apiRequest("POST", `${API_ENDPOINTS.shipments.get(shipmentId)}/change-rider/`, {
      employee_id: employeeId,
      reason: reason || ''
    });
    return response.json();
  },

  batchChangeRider: async (shipmentIds: string[], employeeId: string, reason?: string): Promise<{ success: boolean; message: string; updated_count: number; failed_count: number; results: Array<{ shipment_id: number; success: boolean; old_rider?: string; new_rider?: string; error?: string }> }> => {
    const response = await apiRequest("POST", `${API_ENDPOINTS.shipments.base}/batch-change-rider/`, {
      shipment_ids: shipmentIds.map(id => parseInt(id)),
      employee_id: employeeId,
      reason: reason || ''
    });
    return response.json();
  },

  getPdfDocument: async (shipmentId: string): Promise<{ success: boolean; pdf_url?: string; is_signed?: boolean; is_template?: boolean; message?: string }> => {
    const response = await apiRequest("GET", `${API_ENDPOINTS.shipments.get(shipmentId)}/pdf-document/`);
    return response.json();
  },

  uploadSignedPdf: async (shipmentId: string, signedPdfUrl: string): Promise<{ success: boolean; message: string; signed_pdf_url: string }> => {
    const response = await apiRequest("POST", `${API_ENDPOINTS.shipments.get(shipmentId)}/upload-signed-pdf/`, {
      signed_pdf_url: signedPdfUrl
    });
    return response.json();
  },

  getAcknowledgmentSettings: async (shipmentId: string): Promise<{ success: boolean; settings?: any }> => {
    const response = await apiRequest("GET", `${API_ENDPOINTS.shipments.get(shipmentId)}/acknowledgment-settings/`);
    return response.json();
  },

  getAvailableRiders: async (): Promise<{ success: boolean; riders: Array<{ id: string; name: string; email?: string }>; count: number }> => {
    const response = await apiRequest("GET", `${API_ENDPOINTS.shipments.base}/available-riders/`);
    return response.json();
  },

  getAvailableRoutes: async (): Promise<{ success: boolean; routes: Array<{ name: string; value: string }>; count: number }> => {
    const response = await apiRequest("GET", `${API_ENDPOINTS.shipments.base}/available-routes/`);
    return response.json();
  },
};

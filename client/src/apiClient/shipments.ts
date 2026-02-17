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
    if (filters.route_name) params.append('route_name', filters.route_name);
    if (filters.date) params.append('date', filters.date);
    if (filters.search) params.append('search', filters.search);
    if (filters.employee_id) params.append('employee_id', filters.employee_id);
    if (filters.pops_order_id) params.append('pops_order_id', String(filters.pops_order_id));

    // Add date range if provided
    if (filters.date_range) {
      params.append('date_range', JSON.stringify(filters.date_range));
    }

    // Add pagination parameters
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    // Add sorting parameters
    if (filters.sort_field) params.append('sort_field', filters.sort_field);
    if (filters.sort_order) params.append('sort_order', filters.sort_order);

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
    const result = await response.json();
    return result;
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

  change_rider: async (shipment_id: string, employee_id: string, reason?: string): Promise<{ success: boolean; message: string; shipment: Shipment }> => {
    const response = await apiRequest("POST", `${API_ENDPOINTS.shipments.get(shipment_id)}/change-rider/`, {
      employee_id: employee_id,
      reason: reason || ''
    });
    return response.json();
  },

  batch_change_rider: async (shipment_ids: string[], employee_id: string, reason?: string): Promise<{ success: boolean; message: string; updated_count: number; failed_count: number; results: Array<{ shipment_id: number; success: boolean; old_rider?: string; new_rider?: string; error?: string }> }> => {
    const response = await apiRequest("POST", `${API_ENDPOINTS.shipments.base}/batch-change-rider/`, {
      shipment_ids: shipment_ids.map(id => parseInt(id)),
      employee_id: employee_id,
      reason: reason || ''
    });
    return response.json();
  },

  get_pdf_document: async (shipment_id: string): Promise<{ success: boolean; pdf_url?: string; is_signed?: boolean; is_template?: boolean; message?: string }> => {
    try {
      const response = await apiRequest("GET", `${API_ENDPOINTS.shipments.get(shipment_id)}/pdf-document/`);
      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          message: data.message || 'No PDF document available for this shipment'
        };
      }
      
      return data;
    } catch (error) {
      log.error('Error fetching PDF document:', error);
      return {
        success: false,
        message: 'Failed to fetch PDF document'
      };
    }
  },

  upload_signed_pdf: async (shipment_id: string, signed_pdf_url: string): Promise<{ success: boolean; message: string; signed_pdf_url: string }> => {
    const response = await apiRequest("POST", `${API_ENDPOINTS.shipments.get(shipment_id)}/upload-signed-pdf/`, {
      signed_pdf_url: signed_pdf_url
    });
    return response.json();
  },

  get_acknowledgment_settings: async (shipment_id: string): Promise<{ success: boolean; settings?: any }> => {
    const response = await apiRequest("GET", `${API_ENDPOINTS.shipments.get(shipment_id)}/acknowledgment-settings/`);
    return response.json();
  },

  get_available_riders: async (): Promise<{ success: boolean; riders: Array<{ id: string; name: string; email?: string }>; count: number }> => {
    const response = await apiRequest("GET", `${API_ENDPOINTS.shipments.base}/available-riders/`);
    return response.json();
  },

  get_available_routes: async (): Promise<{ success: boolean; routes: Array<{ name: string; value: string }>; count: number }> => {
    const response = await apiRequest("GET", `${API_ENDPOINTS.shipments.base}/available-routes/`);
    return response.json();
  },
};

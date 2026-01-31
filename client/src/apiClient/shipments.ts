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

  getDashboardMetrics: async (): Promise<DashboardMetrics> => {
    const response = await apiRequest("GET", API_ENDPOINTS.dashboard.metrics);
    return response.json();
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
};

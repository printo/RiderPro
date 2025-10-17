import { apiRequest } from "@/lib/queryClient";
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
  BatchSyncResult
} from "@shared/schema";

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
    console.log('📦 shipmentsApi.getShipments called with filters:', filters);

    const params = new URLSearchParams();
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
    if (filters.sortField) params.append('sortField', filters.sortField);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const url = `/api/shipments/fetch${params.toString() ? `?${params.toString()}` : ''}`;
    console.log('📡 Making API request to:', url);

    const response = await apiRequest("GET", url);

    console.log('📥 Shipments API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    // Extract pagination headers
    const total = parseInt(resp.headers.get('X-Total-Count') || '0', 10);
    const totalPages = parseInt(resp.headers.get('X-Total-Pages') || '1', 10);
    const currentPage = parseInt(resp.headers.get('X-Current-Page') || '1', 10);
    const perPage = parseInt(resp.headers.get('X-Per-Page') || '20', 10);
    const hasNextPage = resp.headers.get('X-Has-Next-Page') === 'true';
    const hasPreviousPage = resp.headers.get('X-Has-Previous-Page') === 'true';

    const data = await resp.json();
    return { data, total, page: currentPage, limit: perPage, totalPages, hasNextPage, hasPreviousPage };
  },

  getShipment: async (id: string): Promise<{ shipment: Shipment; acknowledgment?: any }> => {
    const response = await apiRequest("GET", `/api/shipments/${id}`);
    return response.json();
  },

  createShipment: async (shipment: InsertShipment): Promise<Shipment> => {
    const response = await apiRequest("POST", "/api/shipments/create", shipment);
    return response.json();
  },

  updateShipment: async (id: string, updates: UpdateShipment): Promise<Shipment> => {
    const response = await apiRequest("PATCH", `/api/shipments/${id}`, updates);
    return response.json();
  },

  batchUpdateShipments: async (updates: BatchUpdate): Promise<{ updatedCount: number; message: string }> => {
    const response = await apiRequest("PATCH", "/api/shipments/batch", updates);
    return response.json();
  },

  getDashboardMetrics: async (): Promise<DashboardMetrics> => {
    const response = await apiRequest("GET", '/api/dashboard');
    return response.json();
  },

  // External integration endpoints
  receiveExternalShipment: async (payload: ExternalShipmentPayload | ExternalShipmentBatch): Promise<ShipmentReceptionResponse> => {
    const response = await apiRequest("POST", "/api/shipments/receive", payload);
    return response.json();
  },

  sendExternalUpdate: async (payload: ExternalUpdatePayload): Promise<{ success: boolean; message: string }> => {
    const response = await apiRequest("POST", "/api/shipments/update/external", payload);
    return response.json();
  },

  sendExternalBatchUpdate: async (payload: ExternalUpdatePayload[]): Promise<BatchSyncResult> => {
    const response = await apiRequest("POST", "/api/shipments/update/external/batch", payload);
    return response.json();
  },
};

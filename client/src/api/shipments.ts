import { apiRequest } from "@/lib/queryClient";
import { Shipment, InsertShipment, UpdateShipment, BatchUpdate, ShipmentFilters, DashboardMetrics } from "@shared/schema";

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
    const params = new URLSearchParams();
    
    // Add filter parameters
    if (filters.status) params.append('status', filters.status);
    if (filters.type) params.append('type', filters.type);
    if (filters.routeName) params.append('routeName', filters.routeName);
    if (filters.date) params.append('date', filters.date);
    
    // Add pagination parameters
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    
    // Add sorting parameters
    if (filters.sortField) params.append('sortField', filters.sortField);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const url = `/api/shipments${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiRequest("GET", url);
    
    // Extract pagination headers
    const total = parseInt(response.headers.get('X-Total-Count') || '0', 10);
    const totalPages = parseInt(response.headers.get('X-Total-Pages') || '1', 10);
    const currentPage = parseInt(response.headers.get('X-Current-Page') || '1', 10);
    const perPage = parseInt(response.headers.get('X-Per-Page') || '20', 10);
    const hasNextPage = response.headers.get('X-Has-Next-Page') === 'true';
    const hasPreviousPage = response.headers.get('X-Has-Previous-Page') === 'true';
    
    const data = await response.json();
    
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

  getShipment: async (id: string): Promise<{ shipment: Shipment; acknowledgment?: any }> => {
    const response = await apiRequest("GET", `/api/shipments/${id}`);
    return response.json();
  },

  createShipment: async (shipment: InsertShipment): Promise<Shipment> => {
    const response = await apiRequest("POST", "/api/shipments", shipment);
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
};

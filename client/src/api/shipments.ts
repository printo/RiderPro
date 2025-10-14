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
    console.log('📦 shipmentsApi.getShipments called with filters:', filters);

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

    // For now, return mock data to test the shipments page
    console.log('🧪 Using mock shipments data for testing');

    // Create mock shipments data
    const mockShipments = [
      {
        id: '1',
        customerName: 'Test Customer 1',
        address: '123 Test Street',
        status: 'pending',
        type: 'delivery',
        routeName: 'Route A',
        employeeId: 'EMP001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '2',
        customerName: 'Test Customer 2',
        address: '456 Demo Avenue',
        status: 'in_progress',
        type: 'pickup',
        routeName: 'Route B',
        employeeId: 'EMP002',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Create a mock Response object
    const response = new Response(JSON.stringify(mockShipments), {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/json',
        'X-Total-Count': '2',
        'X-Total-Pages': '1',
        'X-Current-Page': '1',
        'X-Per-Page': '20',
        'X-Has-Next-Page': 'false',
        'X-Has-Previous-Page': 'false'
      }
    });

    console.log('📥 Mock shipments API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      dataLength: mockShipments.length
    });

    // Extract pagination headers
    const total = parseInt(response.headers.get('X-Total-Count') || '0', 10);
    const totalPages = parseInt(response.headers.get('X-Total-Pages') || '1', 10);
    const currentPage = parseInt(response.headers.get('X-Current-Page') || '1', 10);
    const perPage = parseInt(response.headers.get('X-Per-Page') || '20', 10);
    const hasNextPage = response.headers.get('X-Has-Next-Page') === 'true';
    const hasPreviousPage = response.headers.get('X-Has-Previous-Page') === 'true';

    const data = await response.json();

    console.log('📊 Parsed shipments data:', {
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

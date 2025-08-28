import { apiRequest } from "@/lib/queryClient";
import { Shipment, InsertShipment, UpdateShipment, BatchUpdate, ShipmentFilters, DashboardMetrics } from "@shared/schema";

export const shipmentsApi = {
  getShipments: async (filters: ShipmentFilters = {}): Promise<Shipment[]> => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.type) params.append('type', filters.type);
    if (filters.routeName) params.append('routeName', filters.routeName);
    if (filters.date) params.append('date', filters.date);
    
    const url = `/api/shipments${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch shipments: ${response.statusText}`);
    }
    return response.json();
  },

  getShipment: async (id: string): Promise<{ shipment: Shipment; acknowledgment?: any }> => {
    const response = await fetch(`/api/shipments/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch shipment: ${response.statusText}`);
    }
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
    const response = await fetch('/api/dashboard');
    if (!response.ok) {
      throw new Error(`Failed to fetch dashboard metrics: ${response.statusText}`);
    }
    return response.json();
  },
};

import { apiRequest } from "@/lib/queryClient";
import { VehicleType, InsertVehicleType, UpdateVehicleType } from "@shared/types";

export const vehicleTypesApi = {
  getVehicleTypes: async (): Promise<VehicleType[]> => {
    const response = await apiRequest("GET", '/api/v1/vehicle-types/');
    const data = await response.json();
    // Handle both array and paginated response formats (DRF returns paginated by default)
    if (Array.isArray(data)) {
      return data;
    } else if (data.results && Array.isArray(data.results)) {
      return data.results;
    } else if (data.data && Array.isArray(data.data)) {
      return data.data;
    }
    return [];
  },

  getVehicleType: async (id: string): Promise<VehicleType> => {
    const response = await apiRequest("GET", `/api/v1/vehicle-types/${id}`);
    return response.json();
  },

  createVehicleType: async (vehicleType: InsertVehicleType): Promise<VehicleType> => {
    const response = await apiRequest("POST", '/api/v1/vehicle-types', vehicleType);
    return response.json();
  },

  updateVehicleType: async (id: string, updates: UpdateVehicleType): Promise<VehicleType> => {
    const response = await apiRequest("PUT", `/api/v1/vehicle-types/${id}`, updates);
    return response.json();
  },

  deleteVehicleType: async (id: string): Promise<{ message: string }> => {
    const response = await apiRequest("DELETE", `/api/v1/vehicle-types/${id}`);
    return response.json();
  },
};

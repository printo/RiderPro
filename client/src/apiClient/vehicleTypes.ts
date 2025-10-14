import { apiRequest } from "@/lib/queryClient";
import { VehicleType, InsertVehicleType, UpdateVehicleType } from "@shared/schema";

export const vehicleTypesApi = {
  getVehicleTypes: async (): Promise<VehicleType[]> => {
    const response = await apiRequest("GET", '/api/vehicle-types');
    return response.json();
  },

  getVehicleType: async (id: string): Promise<VehicleType> => {
    const response = await apiRequest("GET", `/api/vehicle-types/${id}`);
    return response.json();
  },

  createVehicleType: async (vehicleType: InsertVehicleType): Promise<VehicleType> => {
    const response = await apiRequest("POST", '/api/vehicle-types', vehicleType);
    return response.json();
  },

  updateVehicleType: async (id: string, updates: UpdateVehicleType): Promise<VehicleType> => {
    const response = await apiRequest("PUT", `/api/vehicle-types/${id}`, updates);
    return response.json();
  },

  deleteVehicleType: async (id: string): Promise<{ message: string }> => {
    const response = await apiRequest("DELETE", `/api/vehicle-types/${id}`);
    return response.json();
  },
};

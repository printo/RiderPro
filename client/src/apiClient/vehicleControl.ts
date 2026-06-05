/**
 * Vehicle control & approval API.
 * Riders confirm/request their vehicle (which sets mileage → fuel cost);
 * managers approve/reject. Endpoints live under /auth/.
 */
import { apiRequest } from '@/lib/queryClient';
import { API_ENDPOINTS } from '@/config/api';
import { MyVehicleResponse, VehicleChangeRequestItem } from '@shared/types';

export const vehicleControlAPI = {
  /** Rider: current vehicle + selectable types + any pending request. */
  getMyVehicle: async (): Promise<MyVehicleResponse> => {
    const res = await apiRequest('GET', API_ENDPOINTS.auth.myVehicle);
    return res.json();
  },

  /** Rider: raise a pending request to change vehicle (needs admin approval). */
  requestVehicleChange: async (
    vehicleTypeId: string,
    reason?: string,
  ): Promise<{ success: boolean; message: string; request?: VehicleChangeRequestItem }> => {
    const res = await apiRequest('POST', API_ENDPOINTS.auth.vehicleChangeRequest, {
      vehicleTypeId,
      reason: reason || '',
    });
    return res.json();
  },

  /** Manager: list pending vehicle change requests. */
  getPendingVehicleRequests: async (): Promise<{
    success: boolean;
    requests: VehicleChangeRequestItem[];
    count: number;
  }> => {
    const res = await apiRequest('GET', API_ENDPOINTS.auth.pendingVehicleRequests);
    return res.json();
  },

  /** Manager: approve a request (updates the rider's vehicle). */
  approveVehicleChange: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await apiRequest('POST', API_ENDPOINTS.auth.approveVehicleChange(id));
    return res.json();
  },

  /** Manager: reject a request. */
  rejectVehicleChange: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await apiRequest('POST', API_ENDPOINTS.auth.rejectVehicleChange(id));
    return res.json();
  },
};

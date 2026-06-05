import { useQuery } from '@tanstack/react-query';
import { vehicleControlAPI } from '@/apiClient/vehicleControl';

/**
 * Rider's current vehicle, the selectable types, and any pending change request.
 * Drives the day-start vehicle-confirmation modal.
 */
export function useMyVehicle(enabled = true) {
  return useQuery({
    queryKey: ['my-vehicle'],
    queryFn: () => vehicleControlAPI.getMyVehicle(),
    enabled,
    staleTime: 60_000,
  });
}

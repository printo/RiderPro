import { useQuery } from "@tanstack/react-query";
import { shipmentsApi } from "@/apiClient/shipments";
import { ShipmentFilters } from "@shared/types";

export function useShipments(filters: ShipmentFilters = {}) {
  return useQuery({
    queryKey: ["/api/shipments/fetch", filters],
    queryFn: async () => {
      const response = await shipmentsApi.getShipments(filters);
      return response.data; // Return just the array of shipments
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useShipment(id: string) {
  return useQuery({
    queryKey: ["/api/shipments/fetch", id],
    queryFn: () => shipmentsApi.getShipment(id),
    enabled: !!id,
  });
}

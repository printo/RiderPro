import { useQuery } from "@tanstack/react-query";
import { shipmentsApi } from "@/api/shipments";
import { ShipmentFilters } from "@shared/schema";

export function useShipments(filters: ShipmentFilters = {}) {
  return useQuery({
    queryKey: ["/api/shipments", filters],
    queryFn: () => shipmentsApi.getShipments(filters),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useShipment(id: string) {
  return useQuery({
    queryKey: ["/api/shipments", id],
    queryFn: () => shipmentsApi.getShipment(id),
    enabled: !!id,
  });
}

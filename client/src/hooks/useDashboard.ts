import { useQuery } from "@tanstack/react-query";
import { shipmentsApi } from "@/apiClient/shipments";

export function useDashboard() {
  return useQuery({
    queryKey: ["/api/v1/dashboard"],
    queryFn: () => shipmentsApi.getDashboardMetrics(),
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
  });
}

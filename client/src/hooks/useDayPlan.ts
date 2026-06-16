import { useQuery } from "@tanstack/react-query";
import { routeAPI } from "@/apiClient/routes";
import { DayPlanWave } from "@shared/types";

/**
 * Ops day-view data (read-only). Manager-gated server-side.
 *
 * No aggressive auto-refetch: each load runs one routing-matrix call per rider,
 * so we keep refreshes manual/infrequent to protect the routing (ORS) quota.
 */
export function useDayPlan(date: string, wave: DayPlanWave = "all") {
  return useQuery({
    queryKey: ["/api/v1/routes/day-plan", date, wave],
    queryFn: () => routeAPI.dayPlan(date, wave),
    enabled: !!date,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 min; a manual Refresh button drives updates
  });
}

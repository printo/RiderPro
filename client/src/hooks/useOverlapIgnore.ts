import { useMutation, useQueryClient } from "@tanstack/react-query";
import { routeAPI } from "@/apiClient/routes";
import type { DayPlanWave } from "@shared/types";

interface OverlapIgnoreArgs {
  date: string;
  wave: DayPlanWave;
  pincode: string;
  ignored: boolean;
}

/**
 * Toggle a server-shared "ignore" on a pincode-overlap flag (visible to all ops
 * users), then refetch the day-plan so the row updates.
 */
export function useOverlapIgnore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ date, wave, pincode, ignored }: OverlapIgnoreArgs) =>
      routeAPI.overlapIgnore(date, wave, pincode, ignored),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/routes/day-plan"] });
    },
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { routeAPI } from "@/apiClient/routes";
import { useToast } from "@/hooks/use-toast";
import type { DayPlanWave } from "@shared/types";

interface DispatchArgs {
  date: string;
  wave: DayPlanWave;
  employeeId: string;
  riderName?: string;
}

/**
 * Lock (dispatch) a rider's route for a date + wave. The rider app then obeys the
 * server dispatch_sequence instead of re-optimizing. Idempotent — re-dispatch
 * re-locks while preserving any stop the rider has already started. Refetches the
 * day-plan so the card flips to its dispatched state.
 */
export function useDispatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ date, wave, employeeId }: DispatchArgs) =>
      routeAPI.dispatch(date, wave, employeeId),
    onSuccess: (res, vars) => {
      const who = vars.riderName || res.employee_id;
      const preserved = res.preserved_count ?? 0;
      toast({
        title: `Dispatched ${res.dispatched_count} stop(s) to ${who}`,
        description:
          preserved > 0 ? `${preserved} in-progress stop(s) kept their order.` : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/routes/day-plan"] });
    },
    onError: (err) => {
      toast({
        title: "Dispatch failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });
}

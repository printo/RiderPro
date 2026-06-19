import { useMutation, useQueryClient } from "@tanstack/react-query";
import { shipmentsApi } from "@/apiClient/shipments";
import { useToast } from "@/hooks/use-toast";

interface ReassignArgs {
  shipmentIds: number[];
  toEmployeeId: string;
  reason?: string;
}

/**
 * Reassign shipments to another rider from the ops day-view. Reuses the existing
 * batch-change-rider endpoint (which validates the target + shipment status, logs
 * an assignment event, and syncs to POPS). Surfaces BOTH the updated and failed
 * counts honestly — an in-progress shipment is rejected server-side and shown as a
 * failure, never a silent success — then refetches the day-plan.
 */
export function useReassignShipments() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ shipmentIds, toEmployeeId, reason }: ReassignArgs) =>
      shipmentsApi.batch_change_rider(shipmentIds.map(String), toEmployeeId, reason),
    onSuccess: (res) => {
      if (res.failed_count > 0) {
        const failed = res.results
          .filter((r) => !r.success)
          .map((r) => `#${r.shipment_id}`)
          .join(", ");
        toast({
          title: `Reassigned ${res.updated_count}, ${res.failed_count} couldn't move`,
          description: failed ? `Not moved: ${failed} (already in progress?)` : undefined,
          variant: "destructive",
        });
      } else {
        toast({ title: `Reassigned ${res.updated_count} shipment(s)` });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/v1/routes/day-plan"] });
    },
    onError: (err) => {
      toast({
        title: "Reassign failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });
}

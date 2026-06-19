import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shipmentsApi } from "@/apiClient/shipments";
import { useReassignShipments } from "@/hooks/useReassignShipments";

interface ReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipmentIds: number[];
  sourceEmployeeId: string;
  sourceRiderName?: string;
}

/**
 * Move selected shipments from one rider to another. Target list comes from the
 * existing available-riders endpoint (approved RiderAccounts only); the reassign
 * itself reuses batch-change-rider via useReassignShipments.
 */
export default function ReassignDialog({
  open,
  onOpenChange,
  shipmentIds,
  sourceEmployeeId,
  sourceRiderName,
}: ReassignDialogProps) {
  const [target, setTarget] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const reassign = useReassignShipments();

  const { data: ridersData, isLoading: ridersLoading } = useQuery({
    queryKey: ["available-riders"],
    queryFn: () => shipmentsApi.get_available_riders(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setTarget("");
      setReason("");
    }
  }, [open]);

  const targets = (ridersData?.riders ?? []).filter((r) => r.id !== sourceEmployeeId);
  const count = shipmentIds.length;

  const submit = () => {
    if (!target || count === 0) return;
    reassign.mutate(
      { shipmentIds, toEmployeeId: target, reason: reason.trim() || undefined },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Reassign {count} stop{count === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Move {count} shipment{count === 1 ? "" : "s"} from{" "}
            <span className="font-medium">{sourceRiderName || sourceEmployeeId}</span> to another rider.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Move to rider</label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue placeholder={ridersLoading ? "Loading riders…" : "Select a rider"} />
              </SelectTrigger>
              <SelectContent>
                {targets.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} ({r.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Reason (optional)</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. balance the load"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={reassign.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!target || count === 0 || reassign.isPending}>
            {reassign.isPending ? "Reassigning…" : "Reassign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PackageCheck, X } from "lucide-react";
import { useState } from "react";
import { ShipmentStatus } from "@shared/types";
import { cn } from "@/lib/utils";

interface CollectedStatusToggleProps {
  id: string;
  current_status: ShipmentStatus;
  on_status_change: (new_status: ShipmentStatus) => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function CollectedStatusToggle({
  id,
  current_status,
  on_status_change,
  className = "",
  variant = 'outline',
  size = 'default',
}: CollectedStatusToggleProps) {
  const { toast } = useToast();
  const [is_loading, set_is_loading] = useState(false);

  const handle_toggle = async () => {
    try {
      set_is_loading(true);
      const response = await fetch(`/api/shipments/${id}/toggle_collected_status/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update status");
      }

      on_status_change(data.shipment.status);

      toast({
        title: "Success",
        description: data.message,
      });
    } catch (error) {
      console.error("Error toggling collected status:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    } finally {
      set_is_loading(false);
    }
  };

  if (current_status === 'Assigned' || current_status === 'Collected') {
    const is_collected = current_status === 'Collected';

    return (
      <Button
        onClick={handle_toggle}
        disabled={is_loading}
        variant={variant}
        size={size}
        className={cn(
          'inline-flex items-center',
          is_collected
            ? 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30'
            : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30',
          className
        )}
      >
        {is_loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating...
          </>
        ) : (
          <>
            {is_collected ? (
              <X className="mr-2 h-4 w-4" />
            ) : (
              <PackageCheck className="mr-2 h-4 w-4" />
            )}
            {is_collected ? 'Unmark as Collected' : 'Mark as Collected'}
          </>
        )}
      </Button>
    );
  }

  // Don't render anything if the status is not Assigned or Collected
  return null;
}

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PackageCheck, X } from "lucide-react";
import { useState } from "react";
import { ShipmentStatus } from "@shared/types";
import { cn } from "@/lib/utils";

interface CollectedStatusToggleProps {
  shipmentId: string;
  currentStatus: ShipmentStatus;
  onStatusChange: (newStatus: ShipmentStatus) => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function CollectedStatusToggle({
  shipmentId,
  currentStatus,
  onStatusChange,
  className = "",
  variant = 'outline',
  size = 'default',
}: CollectedStatusToggleProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/shipments/${shipmentId}/toggle_collected_status/`, {
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

      onStatusChange(data.shipment.status);
      
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
      setIsLoading(false);
    }
  };

  if (currentStatus === 'Assigned' || currentStatus === 'Collected') {
    const isCollected = currentStatus === 'Collected';
    
    return (
      <Button
        onClick={handleToggle}
        disabled={isLoading}
        variant={variant}
        size={size}
        className={cn(
          'inline-flex items-center',
          isCollected 
            ? 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30'
            : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30',
          className
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating...
          </>
        ) : (
          <>
            {isCollected ? (
              <X className="mr-2 h-4 w-4" />
            ) : (
              <PackageCheck className="mr-2 h-4 w-4" />
            )}
            {isCollected ? 'Unmark as Collected' : 'Mark as Collected'}
          </>
        )}
      </Button>
    );
  }

  // Don't render anything if the status is not Assigned or Collected
  return null;
}

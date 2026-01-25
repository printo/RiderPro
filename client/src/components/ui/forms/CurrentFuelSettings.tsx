import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Fuel, Loader2, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { FuelSetting } from "@shared/types";

interface CurrentFuelSettingsProps {
  className?: string;
}

function CurrentFuelSettings({ className }: CurrentFuelSettingsProps) {
  // Fetch current fuel settings
  const { data: fuelSettings = [], isLoading, error, refetch } = useQuery({
    queryKey: ['/api/fuel-settings'],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/fuel-settings");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      } catch (error) {
        console.error('Failed to fetch fuel settings:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2, // Retry failed requests twice
    retryDelay: 1000, // Wait 1 second between retries
  });

  const activeSettings = fuelSettings.filter((setting: FuelSetting) => setting.is_active);
  const latestSettings = activeSettings.sort((a: FuelSetting, b: FuelSetting) =>
    new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime()
  );

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5 text-blue-600" />
            Current Fuel Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading fuel settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5 text-blue-600" />
            Current Fuel Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-muted-foreground mb-4">
              Failed to load fuel settings
            </div>
            <button
              onClick={() => refetch()}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center justify-center mx-auto"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (latestSettings.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5 text-blue-600" />
            Current Fuel Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No active fuel settings found
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fuel className="h-5 w-5 text-blue-600" />
          Current Fuel Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {latestSettings.map((setting: FuelSetting) => (
            <div
              key={setting.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Fuel className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium capitalize text-sm">
                    {setting.fuel_type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ₹{setting.price_per_liter.toFixed(2)} per liter
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="default" className="text-xs">
                  Active
                </Badge>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {setting.region && (
                    <span>{setting.region}</span>
                  )}
                  <span>•</span>
                  <span>{new Date(setting.effective_date).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Showing latest active fuel prices by type and region
        </div>
      </CardContent>
    </Card>
  );
}

export default CurrentFuelSettings;

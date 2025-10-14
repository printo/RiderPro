import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vehicleTypesApi } from "@/apiClient/vehicleTypes";
import { VehicleType, InsertVehicleType, UpdateVehicleType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useVehicleTypes() {
  return useQuery({
    queryKey: ["/api/vehicle-types"],
    queryFn: () => vehicleTypesApi.getVehicleTypes(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateVehicleType() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (vehicleType: InsertVehicleType) => vehicleTypesApi.createVehicleType(vehicleType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-types"] });
      toast({
        title: "Success",
        description: "Vehicle type created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create vehicle type",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateVehicleType() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateVehicleType }) =>
      vehicleTypesApi.updateVehicleType(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-types"] });
      toast({
        title: "Success",
        description: "Vehicle type updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update vehicle type",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteVehicleType() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => vehicleTypesApi.deleteVehicleType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-types"] });
      toast({
        title: "Success",
        description: "Vehicle type deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete vehicle type",
        variant: "destructive",
      });
    },
  });
}

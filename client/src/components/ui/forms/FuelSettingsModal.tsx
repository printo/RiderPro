import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { InsertFuelSetting } from "@shared/types";
import { Fuel, Save } from "lucide-react";
import { withModalErrorBoundary } from "@/components/ErrorBoundary";

interface FuelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function FuelSettingsModal({ isOpen, onClose }: FuelSettingsModalProps) {
  const [formData, setFormData] = useState<InsertFuelSetting>({
    fuel_type: 'petrol',
    price_per_liter: 0,
    currency: 'USD',
    region: '',
    effective_date: new Date().toISOString().split('T')[0],
    is_active: true,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create fuel setting mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertFuelSetting) => {
      const response = await apiRequest("POST", "/api/v1/fuel-settings/", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/fuel-settings'] });
      toast({
        title: "Fuel Setting Added",
        description: "New fuel setting has been added successfully.",
      });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Fuel Setting",
        description: error.message || "Failed to add fuel setting.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      fuel_type: 'petrol',
      price_per_liter: 0,
      currency: 'USD',
      region: '',
      effective_date: new Date().toISOString().split('T')[0],
      is_active: true,
    });
  };

  const handleSubmit = () => {
    if (!formData.fuel_type || formData.price_per_liter <= 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields with valid values.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(formData);
  };

  const isProcessing = createMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5 text-blue-600" />
            Fuel Settings Management
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add New Fuel Setting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fuel_type">Fuel Type *</Label>
                  <Select
                    value={formData.fuel_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, fuel_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select fuel type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="petrol">Petrol</SelectItem>
                      <SelectItem value="diesel">Diesel</SelectItem>
                      <SelectItem value="electric">Electric</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="price_per_liter">Price per Liter *</Label>
                  <Input
                    id="price_per_liter"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price_per_liter}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price_per_liter: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <input
                    id="currency"
                    type="text"
                    value="INR"
                    readOnly
                    className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <Label htmlFor="region">Region</Label>
                  <Select
                    value={formData.region}
                    onValueChange={(value) =>
                      setFormData({ ...formData, region: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bangalore">Bangalore</SelectItem>
                      <SelectItem value="Chennai">Chennai</SelectItem>
                      <SelectItem value="Gurgaon">Gurgaon</SelectItem>
                      <SelectItem value="Hyderbad">Hyderbad</SelectItem>
                      <SelectItem value="Pune">Pune</SelectItem>
                    </SelectContent>
                  </Select>
                </div>


                <div>
                  <Label htmlFor="effective_date">Effective Date *</Label>
                  <Input
                    id="effective_date"
                    type="date"
                    value={formData.effective_date}
                    onChange={(e) =>
                      setFormData({ ...formData, effective_date: e.target.value })
                    }
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                    className="rounded"
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={isProcessing}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Add Fuel Setting
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default withModalErrorBoundary(FuelSettingsModal, {
  componentName: 'FuelSettingsModal'
});

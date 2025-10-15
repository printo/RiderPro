import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FuelSetting, InsertFuelSetting, UpdateFuelSetting } from "@shared/schema";
import { Plus, Edit, Trash2, Fuel, Save, X } from "lucide-react";
import { withModalErrorBoundary } from "@/components/ErrorBoundary";

interface FuelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function FuelSettingsModal({ isOpen, onClose }: FuelSettingsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  // Fetch fuel settings
  const { data: fuelSettings = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/fuel-settings'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/fuel-settings");
      return response.json();
    },
    enabled: isOpen,
  });

  // Create fuel setting mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertFuelSetting) => {
      const response = await apiRequest("POST", "/api/fuel-settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fuel-settings'] });
      toast({
        title: "Fuel Setting Added",
        description: "New fuel setting has been added successfully.",
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add Fuel Setting",
        description: error.message || "Failed to add fuel setting.",
        variant: "destructive",
      });
    },
  });

  // Update fuel setting mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateFuelSetting }) => {
      const response = await apiRequest("PUT", `/api/fuel-settings/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fuel-settings'] });
      toast({
        title: "Fuel Setting Updated",
        description: "Fuel setting has been updated successfully.",
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update Fuel Setting",
        description: error.message || "Failed to update fuel setting.",
        variant: "destructive",
      });
    },
  });

  // Delete fuel setting mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/fuel-settings/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fuel-settings'] });
      toast({
        title: "Fuel Setting Deleted",
        description: "Fuel setting has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Delete Fuel Setting",
        description: error.message || "Failed to delete fuel setting.",
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
    setIsEditing(false);
    setEditingId(null);
  };

  const handleEdit = (setting: FuelSetting) => {
    setFormData({
      fuel_type: setting.fuel_type,
      price_per_liter: setting.price_per_liter,
      currency: setting.currency,
      region: setting.region || '',
      effective_date: setting.effective_date,
      is_active: setting.is_active,
    });
    setIsEditing(true);
    setEditingId(setting.id);
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

    if (isEditing && editingId) {
      updateMutation.mutate({
        id: editingId,
        data: formData as UpdateFuelSetting,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this fuel setting?")) {
      deleteMutation.mutate(id);
    }
  };

  const isProcessing = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5 text-blue-600" />
            Fuel Settings Management
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add/Edit Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isEditing ? "Edit Fuel Setting" : "Add New Fuel Setting"}
              </CardTitle>
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
                  {isEditing ? "Update" : "Add"} Fuel Setting
                </Button>
                {isEditing && (
                  <Button
                    variant="outline"
                    onClick={resetForm}
                    disabled={isProcessing}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Fuel Settings List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Fuel Settings</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">Loading fuel settings...</div>
              ) : fuelSettings.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No fuel settings found. Add your first fuel setting above.
                </div>
              ) : (
                <div className="space-y-3">
                  {fuelSettings.map((setting: FuelSetting) => (
                    <div
                      key={setting.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Fuel className="h-4 w-4 text-blue-600" />
                          <span className="font-medium capitalize">
                            {setting.fuel_type}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {setting.price_per_liter} {setting.currency}/liter
                        </div>
                        {setting.region && (
                          <Badge variant="secondary">{setting.region}</Badge>
                        )}
                        <Badge
                          variant={setting.is_active ? "default" : "secondary"}
                        >
                          {setting.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          Effective: {new Date(setting.effective_date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(setting)}
                          disabled={isProcessing}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(setting.id)}
                          disabled={isProcessing}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
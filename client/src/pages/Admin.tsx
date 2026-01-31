import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/ApiClient";
import { Fuel, Send, Copy, Trash2, Users, UserCheck, UserX, Key, Edit, Search, RefreshCw, Database, Plus, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { withPageErrorBoundary } from "@/components/ErrorBoundary";
import FuelSettingsModal from "@/components/ui/forms/FuelSettingsModal";
import CurrentFuelSettings from "@/components/ui/forms/CurrentFuelSettings";
import { VehicleType, PendingUser, AllUser } from '@shared/types';

interface EditingUser {
  id: string;
  name: string;
  email: string;
  riderId: string;
  isActive: boolean;
}

interface VehicleTypeFormProps {
  vehicle?: Partial<VehicleType> | null;
  onSave: (vehicleData: Partial<VehicleType>) => void;
  onCancel: () => void;
}

function VehicleTypeForm({ vehicle, onSave, onCancel }: VehicleTypeFormProps) {
  const [formData, setFormData] = useState({
    name: vehicle?.name || '',
    fuel_efficiency: vehicle?.fuel_efficiency || 0,
    description: vehicle?.description || '',
    icon: vehicle?.icon || '🚗',
    fuel_type: vehicle?.fuel_type || 'petrol',
    co2_emissions: vehicle?.co2_emissions || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.fuel_efficiency <= 0) {
      return;
    }

    const vehicleData = {
      ...formData,
      ...(vehicle?.id && { id: vehicle.id }),
    };

    onSave(vehicleData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Vehicle Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Standard Van"
          required
        />
      </div>

      <div>
        <Label htmlFor="fuel_efficiency">Fuel Efficiency (km/l) *</Label>
        <Input
          id="fuel_efficiency"
          type="number"
          step="0.1"
          min="1"
          value={formData.fuel_efficiency}
          onChange={(e) => setFormData({ ...formData, fuel_efficiency: parseFloat(e.target.value) || 0 })}
          placeholder="e.g., 15.0"
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="e.g., Standard delivery van"
        />
      </div>

      <div>
        <Label htmlFor="icon">Icon</Label>
        <select
          id="icon"
          value={formData.icon}
          onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
          className="w-full px-3 py-2 border rounded-md bg-background"
        >
          <option value="🚗">🚗 Car</option>
          <option value="🚐">🚐 Van</option>
          <option value="🏍️">🏍️ Motorcycle</option>
          <option value="🚲">🚲 Bicycle</option>
          <option value="🚛">🚛 Truck</option>
          <option value="🛵">🛵 Scooter</option>
        </select>
      </div>

      <div>
        <Label htmlFor="fuel_type">Fuel Type</Label>
        <select
          id="fuel_type"
          value={formData.fuel_type}
          onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
          className="w-full px-3 py-2 border rounded-md bg-background"
        >
          <option value="petrol">Petrol</option>
          <option value="diesel">Diesel</option>
          <option value="electric">Electric</option>
          <option value="hybrid">Hybrid</option>
        </select>
      </div>

      <div>
        <Label htmlFor="co2_emissions">CO2 Emissions (kg/km)</Label>
        <Input
          id="co2_emissions"
          type="number"
          step="0.01"
          min="0"
          value={formData.co2_emissions}
          onChange={(e) => setFormData({ ...formData, co2_emissions: parseFloat(e.target.value) || 0 })}
          placeholder="e.g., 0.15"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" className="flex-1">
          {vehicle?.id ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}

function AdminPage() {
  const { user } = useAuth();
  const [payloadInput, setPayloadInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Array<{ index: number, success: boolean, trackingNumber?: string, error?: string }>>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);
  const [userFilter, setUserFilter] = useState('');
  const [editingUser, setEditingUser] = useState<EditingUser | null>(null);
  const [resetPasswordModal, setResetPasswordModal] = useState<{ isOpen: boolean; userId: string; userName: string }>({
    isOpen: false,
    userId: '',
    userName: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Partial<VehicleType> | null>(null);
  const [loadingVehicleTypes, setLoadingVehicleTypes] = useState(false);
  const [showFuelSettingsModal, setShowFuelSettingsModal] = useState(false);
  const { toast } = useToast();

  // Allow both super users and managers (ops_team/staff) to access admin
  const canAccessAdmin = !!(user?.isSuperUser || user?.isOpsTeam || user?.isStaff);
  const _canEdit = !!(user?.isSuperUser || user?.isOpsTeam || user?.isStaff);

  // Load pending users and access tokens
  useEffect(() => {
    if (canAccessAdmin) {
      loadPendingUsers();
      loadAllUsers();
      loadVehicleTypes();
    }
  }, [canAccessAdmin]);

  const loadPendingUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch('/api/v1/auth/pending-approvals');
      const data = await response.json();
      if (data.success) {
        setPendingUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to load pending users:', error);
      toast({
        title: "Error",
        description: "Failed to load pending users",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadAllUsers = async () => {
    setLoadingAllUsers(true);
    try {
      const response = await fetch('/api/v1/auth/all-users');
      const data = await response.json();
      if (data.success) {
        setAllUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to load all users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoadingAllUsers(false);
    }
  };


  const loadVehicleTypes = async () => {
    setLoadingVehicleTypes(true);
    try {
      const response = await fetch('/api/v1/vehicle-types/');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Handle both array and paginated response formats
      if (Array.isArray(data)) {
        setVehicleTypes(data);
      } else if (data.results && Array.isArray(data.results)) {
        setVehicleTypes(data.results);
      } else if (data.data && Array.isArray(data.data)) {
        setVehicleTypes(data.data);
      } else {
        setVehicleTypes([]);
      }
    } catch (error) {
      console.error('Failed to load vehicle types:', error);
      toast({
        title: "Error",
        description: "Failed to load vehicle types",
        variant: "destructive",
      });
      setVehicleTypes([]);
    } finally {
      setLoadingVehicleTypes(false);
    }
  };

  const saveVehicleType = async (vehicleData: Partial<VehicleType>) => {
    try {
      const url = editingVehicle?.id ? `/api/v1/vehicle-types/${editingVehicle.id}/` : '/api/v1/vehicle-types/';
      const method = editingVehicle?.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vehicleData),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Vehicle type ${editingVehicle?.id ? 'updated' : 'created'} successfully`,
        });
        loadVehicleTypes();
        setShowVehicleModal(false);
        setEditingVehicle(null);
      } else {
        throw new Error('Failed to save vehicle type');
      }
    } catch (error) {
      console.error('Failed to save vehicle type:', error);
      toast({
        title: "Error",
        description: "Failed to save vehicle type",
        variant: "destructive",
      });
    }
  };

  const deleteVehicleType = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/vehicle-types/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Vehicle type deleted successfully",
        });
        loadVehicleTypes();
      } else {
        throw new Error('Failed to delete vehicle type');
      }
    } catch (error) {
      console.error('Failed to delete vehicle type:', error);
      toast({
        title: "Error",
        description: "Failed to delete vehicle type",
        variant: "destructive",
      });
    }
  };

  const approveUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/v1/auth/approve/${userId}`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "User approved successfully",
        });
        loadPendingUsers();
        loadAllUsers();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Failed to approve user:', error);
      toast({
        title: "Error",
        description: "Failed to approve user",
        variant: "destructive",
      });
    }
  };

  const rejectUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/v1/auth/reject/${userId}`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "User rejected successfully",
        });
        loadPendingUsers();
        loadAllUsers();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Failed to reject user:', error);
      toast({
        title: "Error",
        description: "Failed to reject user",
        variant: "destructive",
      });
    }
  };

  const updateUser = async (userId: string, updates: Partial<AllUser>) => {
    try {
      const response = await fetch(`/api/v1/auth/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "User updated successfully",
        });
        loadAllUsers();
        setEditingUser(null);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    }
  };

  const resetPassword = async (userId: string) => {
    setIsResettingPassword(true);
    try {
      const response = await fetch(`/api/v1/auth/reset-password/${userId}`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Password reset successfully",
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Failed to reset password:', error);
      toast({
        title: "Error",
        description: "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleTestShipments = async () => {
    if (!payloadInput.trim()) {
      setValidationError('Please enter shipment data');
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);
    setTestResults([]);

    try {
      const lines = payloadInput.trim().split('\n').filter(line => line.trim());
      const results = [];

      for (let i = 0; i < lines.length; i++) {
        try {
          await apiClient.post('/shipments/test', {
            trackingNumber: lines[i].trim()
          });

          results.push({
            index: i + 1,
            success: true,
            trackingNumber: lines[i].trim()
          });
        } catch (error) {
          results.push({
            index: i + 1,
            success: false,
            trackingNumber: lines[i].trim(),
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      setTestResults(results);
    } catch (error) {
      console.error('Test failed:', error);
      toast({
        title: "Error",
        description: "Failed to test shipments",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
    setPayloadInput('');
  };

  const generateSampleData = async () => {
    setIsSubmitting(true);
    setValidationError(null);

    try {
      // Generate sample shipment data with all database fields
      const sampleShipments = [
        {
          shipment_id: 'SHP001',
          type: 'delivery',
          customerName: 'John Smith',
          customerMobile: '+1234567890',
          address: '123 Main Street, Downtown',
          latitude: 40.7128,
          longitude: -74.0060,
          cost: 25.00,
          deliveryTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          routeName: 'Route-001',
          employeeId: 'EMP001',
          status: 'Assigned',
          priority: 'medium',
          pickupAddress: 'Warehouse A, Industrial Area',
          weight: 2.5,
          dimensions: '30x20x15 cm',
          specialInstructions: 'Handle with care - fragile items',
          actualDeliveryTime: null,
          start_latitude: null,
          start_longitude: null,
          stop_latitude: null,
          stop_longitude: null,
          km_travelled: 0,
          synced_to_external: false,
          last_sync_attempt: null,
          sync_error: null,
          sync_status: 'pending',
          sync_attempts: 0,
          signature_url: null,
          photo_url: null,
          acknowledgment_captured_at: null,
          acknowledgment_captured_by: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          shipment_id: 'SHP002',
          type: 'pickup',
          customerName: 'Sarah Johnson',
          customerMobile: '+1234567891',
          address: 'Warehouse B, Industrial Area',
          latitude: 40.7589,
          longitude: -73.9851,
          cost: 18.50,
          deliveryTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          routeName: 'Route-002',
          employeeId: 'EMP002',
          status: 'Assigned',
          priority: 'high',
          pickupAddress: '456 Oak Avenue, Midtown',
          weight: 1.8,
          dimensions: '25x18x12 cm',
          specialInstructions: 'Urgent pickup required',
          actualDeliveryTime: null,
          start_latitude: null,
          start_longitude: null,
          stop_latitude: null,
          stop_longitude: null,
          km_travelled: 0,
          synced_to_external: false,
          last_sync_attempt: null,
          sync_error: null,
          sync_status: 'pending',
          sync_attempts: 0,
          signature_url: null,
          photo_url: null,
          acknowledgment_captured_at: null,
          acknowledgment_captured_by: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          shipment_id: 'SHP003',
          type: 'delivery',
          customerName: 'Mike Davis',
          customerMobile: '+1234567892',
          address: '789 Pine Street, Residential',
          latitude: 40.7505,
          longitude: -73.9934,
          cost: 32.00,
          deliveryTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          routeName: 'Route-003',
          employeeId: 'EMP003',
          status: 'Assigned',
          priority: 'low',
          pickupAddress: 'Warehouse C, Suburbs',
          weight: 3.2,
          dimensions: '35x25x20 cm',
          specialInstructions: 'Delivery after 5 PM',
          actualDeliveryTime: null,
          start_latitude: null,
          start_longitude: null,
          stop_latitude: null,
          stop_longitude: null,
          km_travelled: 0,
          synced_to_external: false,
          last_sync_attempt: null,
          sync_error: null,
          sync_status: 'pending',
          sync_attempts: 0,
          signature_url: null,
          photo_url: null,
          acknowledgment_captured_at: null,
          acknowledgment_captured_by: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      setPayloadInput(JSON.stringify(sampleShipments, null, 2));

      toast({
        title: "Sample Data Generated",
        description: "Complete sample shipment data with all database fields has been added",
      });
    } catch (error) {
      console.error('Failed to generate sample data:', error);
      toast({
        title: "Error",
        description: "Failed to generate sample data",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Text copied to clipboard",
    });
  };

  const filteredUsers = allUsers.filter(user =>
    user.full_name.toLowerCase().includes(userFilter.toLowerCase()) ||
    user.rider_id.toLowerCase().includes(userFilter.toLowerCase()) ||
    (user.email && user.email.toLowerCase().includes(userFilter.toLowerCase()))
  );

  if (!canAccessAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Access denied</h2>
          </CardHeader>
          <CardContent>
            <p>You don't have permission to access the admin panel.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage system settings, users, and test shipments
        </p>
      </div>

      {/* Shipment Testing Section */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Send className="h-5 w-5" />
            Shipment Testing
          </h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Enter shipment data (JSON format):
              </label>
              <Textarea
                value={payloadInput}
                onChange={(e) => setPayloadInput(e.target.value)}
                placeholder="Enter shipment data in JSON format or use 'Generate Sample Data' button..."
                className="min-h-[200px] font-mono text-sm"
              />
              {validationError && (
                <p className="text-sm text-red-600">{validationError}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={handleTestShipments}
                disabled={isSubmitting}
                className="flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? 'Testing...' : 'Test Shipments'}
              </Button>
              <Button
                onClick={generateSampleData}
                disabled={isSubmitting}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                Generate Sample Data
              </Button>
              <Button
                onClick={clearResults}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            </div>

            {/* Test Results */}
            {testResults.length > 0 && (
              <div className="mt-6 space-y-2">
                <h4 className="text-sm font-medium">Test Results:</h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2 max-h-60 overflow-y-auto">
                  {testResults.map((result, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded ${result.success ? 'bg-green-50' : 'bg-red-50'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">
                          {result.index}. {result.trackingNumber}
                        </span>
                        {result.success ? (
                          <span className="text-green-600 text-xs">✓ Success</span>
                        ) : (
                          <span className="text-red-600 text-xs">✗ Failed</span>
                        )}
                      </div>
                      {result.error && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(result.error!)}
                          className="h-6 px-2"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fuel Settings Section */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Fuel className="h-5 w-5" />
            Fuel Settings
          </h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Configure fuel pricing and vehicle settings for accurate cost calculations
            </p>

            {/* Default Vehicle Type and Fuel Price - Responsive Layout */}

            {/* Fuel Settings */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fuel Price Settings</Label>
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Fuel Price Management</p>
                    <p className="text-xs text-muted-foreground">
                      Configure fuel prices for different fuel types and regions
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowFuelSettingsModal(true)}
                    className="flex items-center gap-2"
                  >
                    <Fuel className="h-4 w-4" />
                    Manage Fuel Prices
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Set current fuel prices for accurate route cost calculations and analytics
              </p>
            </div>

            {/* Current Fuel Settings Display */}
            <CurrentFuelSettings className="mt-4" />

            {/* Vehicle Types */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Vehicle Types & Mileage</Label>
              <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                {loadingVehicleTypes ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Loading vehicle types...</p>
                  </div>
                ) : vehicleTypes.length > 0 ? (
                  <div className="space-y-2">
                    {vehicleTypes.map((vehicle) => (
                      <div key={vehicle.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-xs font-semibold">{vehicle.icon}</span>
                          </div>
                          <div>
                            <p className="font-medium text-sm">{vehicle.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {vehicle.fuel_efficiency} km/l • {vehicle.fuel_type || 'petrol'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingVehicle(vehicle);
                              setShowVehicleModal(true);
                            }}
                            className="h-7 px-2"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete ${vehicle.name}?`)) {
                                deleteVehicleType(vehicle.id);
                              }
                            }}
                            className="h-7 px-2 text-red-600 hover:text-red-700"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No vehicle types found</p>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setEditingVehicle({});
                    setShowVehicleModal(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vehicle Type
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Manage vehicle types and their fuel efficiency for accurate cost calculations
              </p>
            </div>



          </div>
        </CardContent>
      </Card>

      {/* User Management */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Pending User Approvals Section - Only show if there are pending users */}
            {pendingUsers.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-orange-600 dark:text-orange-400">
                  Pending User Approvals ({pendingUsers.length})
                </h3>
                <p className="text-sm text-muted-foreground">
                  New user registrations awaiting approval
                </p>
                <div className="space-y-3">
                  {pendingUsers.map((user) => (
                    <div key={user.id} className="border rounded-lg p-4 bg-orange-50 dark:bg-orange-900/20">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-800 rounded-full flex items-center justify-center flex-shrink-0">
                              <Users className="h-5 w-5 text-orange-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium truncate">{user.full_name}</h3>
                              <p className="text-sm text-muted-foreground truncate">
                                ID: {user.rider_id} • {user.email}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Registered: {new Date(user.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 sm:flex-shrink-0">
                          <Button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to approve ${user.full_name}?`)) {
                                approveUser(user.id);
                              }
                            }}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to reject ${user.full_name}? This action cannot be undone.`)) {
                                rejectUser(user.id);
                              }
                            }}
                            size="sm"
                            variant="destructive"
                            className="w-full sm:w-auto"
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Users Management Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">All Users Management</h3>
                <Button
                  onClick={() => {
                    loadPendingUsers();
                    loadAllUsers();
                  }}
                  disabled={loadingUsers || loadingAllUsers}
                  variant="outline"
                  size="sm"
                >
                  {(loadingUsers || loadingAllUsers) ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Refresh
                    </>
                  )}
                </Button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search users..."
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="pl-10"
                />
              </div>

              {loadingAllUsers ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Loading users...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No users found - Try refreshing the list or check if you have permission to view users.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="border rounded-lg p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium truncate">{user.full_name}</h3>
                                <Badge variant={user.is_active ? "default" : "secondary"}>
                                  {user.is_active ? "Active" : "Inactive"}
                                </Badge>
                                <Badge variant={user.is_approved ? "default" : "destructive"}>
                                  {user.is_approved ? "Approved" : "Pending"}
                                </Badge>
                                <Badge variant="outline">
                                  {user.role}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                ID: {user.rider_id} • {user.email}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Last Login: {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 sm:flex-shrink-0">
                          <Button
                            onClick={() => setEditingUser({
                              id: user.id,
                              name: user.full_name,
                              email: user.email || '',
                              riderId: user.rider_id,
                              isActive: Boolean(user.is_active)
                            })}
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            onClick={() => resetPassword(user.id)}
                            size="sm"
                            variant="outline"
                            disabled={isResettingPassword}
                            className="w-full sm:w-auto"
                          >
                            <Key className="h-4 w-4 mr-1" />
                            {isResettingPassword ? 'Resetting...' : 'Reset Password'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit User</h3>
            <div className="space-y-4">
              <div>
                <Label className="block text-sm font-medium mb-1">Full Name</Label>
                <Input
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                />
              </div>
              <div>
                <Label className="block text-sm font-medium mb-1">Email</Label>
                <Input
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                />
              </div>
              <div>
                <Label className="block text-sm font-medium mb-1">Rider ID</Label>
                <Input
                  value={editingUser.riderId}
                  onChange={(e) => setEditingUser({ ...editingUser, riderId: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingUser.isActive}
                  onChange={(e) => setEditingUser({ ...editingUser, isActive: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="isActive">Active User</Label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setEditingUser(null)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => updateUser(editingUser.id, {
                  full_name: editingUser.name,
                  email: editingUser.email,
                  rider_id: editingUser.riderId,
                  is_active: editingUser.isActive ? 1 : 0
                })}
                className="flex-1"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Reset Password</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Reset password for {resetPasswordModal.userName}
            </p>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => {
                  setResetPasswordModal({ isOpen: false, userId: '', userName: '' });
                  setNewPassword('');
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // Handle password reset logic here
                  setResetPasswordModal({ isOpen: false, userId: '', userName: '' });
                  setNewPassword('');
                }}
                className="flex-1"
                disabled={!newPassword.trim()}
              >
                Reset Password
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Type Modal */}
      {showVehicleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingVehicle?.id ? 'Edit Vehicle Type' : 'Add Vehicle Type'}
              </h3>
              <Button
                onClick={() => {
                  setShowVehicleModal(false);
                  setEditingVehicle(null);
                }}
                variant="outline"
                size="sm"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <VehicleTypeForm
              vehicle={editingVehicle}
              onSave={saveVehicleType}
              onCancel={() => {
                setShowVehicleModal(false);
                setEditingVehicle(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Fuel Settings Modal */}
      <FuelSettingsModal
        isOpen={showFuelSettingsModal}
        onClose={() => setShowFuelSettingsModal(false)}
      />
    </div>
  );
}

export default withPageErrorBoundary(AdminPage, 'Admin Dashboard');
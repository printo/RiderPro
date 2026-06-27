import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { log } from "@/utils/logger";
import { Fuel, Car, Users, Edit, Search, RefreshCw, Plus, X, Target } from "lucide-react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { withPageErrorBoundary } from "@/components/ErrorBoundary";
import FuelSettingsModal from "@/components/ui/forms/FuelSettingsModal";
import CurrentFuelSettings from "@/components/ui/forms/CurrentFuelSettings";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VehicleType, AllUser } from '@shared/types';
import { DispatchBadge } from '@/components/ui/DispatchBadge';
import { HomebaseBadge } from '@/components/ui/HomebaseBadge';
import AuthService from '@/services/AuthService';
import SmartCompletionSettings from '@/components/SmartCompletionSettings';
import { useSmartRouteCompletion } from '@/hooks/useSmartRouteCompletion';

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
  const { user: currentUser } = useAuth();
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);
  const [userFilter, setUserFilter] = useState('');
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Partial<VehicleType> | null>(null);
  const [loadingVehicleTypes, setLoadingVehicleTypes] = useState(false);
  const [showFuelSettingsModal, setShowFuelSettingsModal] = useState(false);
  const [isSyncingHomebases, setIsSyncingHomebases] = useState(false);
  const [isSyncingRiders, setIsSyncingRiders] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [activeOtp, setActiveOtp] = useState<{ rider_id: string; otp: string; expires_in: number } | null>(null);
  const { toast } = useToast();
  const smartCompletion = useSmartRouteCompletion({
    sessionId: null,
    startPosition: null,
    currentPosition: null,
    sessionStartTime: null,
    totalDistance: 0,
    shipments_completed: 0,
  });

  // Allow both super users and managers (ops_team/staff) to access admin
  const canAccessAdmin = !!(currentUser?.is_super_user || currentUser?.is_ops_team || currentUser?.is_staff);
  // Show the Django-admin (raw DB) link only to users who actually have Django
  // access (Django's is_staff), granted per-user via the Django admin Users page —
  // not to every app admin. Set at login (see AuthService); defaults false.
  const hasDjangoAdmin = localStorage.getItem('django_admin') === 'true';
  
  // Load pending users and access tokens
  useEffect(() => {
    if (canAccessAdmin) {
      loadAllUsers();
      loadVehicleTypes();
    }
  }, [canAccessAdmin]);

  const loadAllUsers = async () => {
    setLoadingAllUsers(true);
    try {
      const response = await apiRequest("GET", '/api/v1/auth/all-users');
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

  const syncHomebases = async () => {
    setIsSyncingHomebases(true);
    try {
      const result = await AuthService.getInstance().syncHomebases();
      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        });
        loadAllUsers();
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to sync homebases",
        variant: "destructive",
      });
    } finally {
      setIsSyncingHomebases(false);
    }
  };

  const syncRiders = async () => {
    setIsSyncingRiders(true);
    try {
      const result = await AuthService.getInstance().syncRiders();
      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        });
        loadAllUsers();
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to sync riders",
        variant: "destructive",
      });
    } finally {
      setIsSyncingRiders(false);
    }
  };

  const archiveUser = async (userId: string) => {
    try {
      const result = await AuthService.getInstance().archiveUser(userId);
      if (result.success) {
        toast({
          title: "Success",
          description: result.message || "User archived successfully",
        });
        loadAllUsers();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      log.error('Failed to archive user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to archive user",
        variant: "destructive",
      });
    }
  };

  const restoreUser = async (userId: string) => {
    try {
      const result = await AuthService.getInstance().restoreUser(userId);
      if (result.success) {
        toast({
          title: "Success",
          description: result.message || "User restored successfully",
        });
        loadAllUsers();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      log.error('Failed to restore user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to restore user",
        variant: "destructive",
      });
    }
  };


  const handleFetchOtp = async (riderId: string) => {
    try {
      const response = await apiRequest('GET', `/api/v1/auth/riders/${riderId}/active-otp`);
      const data = await response.json();
      if (data.success) {
        setActiveOtp({ rider_id: riderId, otp: data.otp, expires_in: data.expires_in_seconds });
      } else {
        toast({ title: 'No active OTP', description: data.message || 'Rider has no pending OTP.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'No active OTP', description: 'Rider has no pending OTP.', variant: 'destructive' });
    }
  };

  const loadVehicleTypes = async () => {
    setLoadingVehicleTypes(true);
    try {
      const response = await apiRequest("GET", '/api/v1/vehicle-types/');
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
      const url = editingVehicle?.id ? `/api/v1/vehicle-types/${editingVehicle.id}/` : '/api/v1/vehicle-types';
      const method = editingVehicle?.id ? 'PUT' : 'POST';

      const response = await apiRequest(method, url, vehicleData);

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
      const response = await apiRequest("DELETE", `/api/v1/vehicle-types/${id}`);

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

  const filteredUsers = allUsers.filter(user => {
    if (!showArchived && user.archived_at) return false;
    return (
      user.full_name.toLowerCase().includes(userFilter.toLowerCase()) ||
      user.rider_id.toLowerCase().includes(userFilter.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(userFilter.toLowerCase()))
    );
  });

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
        <p className="text-muted-foreground mb-2">
          Manage system settings, users, and test shipments
        </p>
        {hasDjangoAdmin && (
          <p className="text-sm text-muted-foreground">
            Need Django admin?{" "}
            <button
              type="button"
              onClick={() => {
                // Use localhost:8004 in development, otherwise use relative path
                const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const adminUrl = isLocalhost ? 'http://localhost:8004/admin/' : '/admin/';
                window.location.href = adminUrl;
              }}
              className="text-blue-600 hover:underline"
            >
              Open Django Admin
            </button>
          </p>
        )}
      </div>

      {/* Fuel Settings Section */}
      <Card className="mb-6">
        <CardHeader>
          <p className="text-xs text-muted-foreground">
            Configure fuel pricing and vehicle settings for accurate cost calculations
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Current Fuel Settings — Manage Fuel Prices action lives in the header */}
            <CurrentFuelSettings
              headerAction={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowFuelSettingsModal(true)}
                      className="flex items-center gap-2"
                    >
                      <Fuel className="h-4 w-4" />
                      Manage Fuel Prices
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Configure fuel prices for different fuel types and regions for route cost calculations and analytics
                  </TooltipContent>
                </Tooltip>
              }
            />

            {/* Vehicle Types & Mileage — same card style as Current Fuel Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-blue-600" />
                    Vehicle Types & Mileage
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingVehicle({});
                      setShowVehicleModal(true);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Vehicle Type
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingVehicleTypes ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="ml-2 text-muted-foreground">Loading vehicle types...</span>
                  </div>
                ) : vehicleTypes.length > 0 ? (
                  <div className="space-y-4">
                    {vehicleTypes.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                      >
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
                  <div className="text-center py-8 text-muted-foreground">
                    <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No vehicle types found</p>
                  </div>
                )}
                <div className="mt-4 text-xs text-muted-foreground">
                  Manage vehicle types and their fuel efficiency for accurate cost calculations
                </div>
              </CardContent>
            </Card>



          </div>
        </CardContent>
      </Card>

      {/* Smart Completion Manager Controls */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5" />
            Smart Completion Controls
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Configure Smart Completion behavior for manager operations.
          </p>
          <SmartCompletionSettings
            config={smartCompletion.config}
            onConfigChange={smartCompletion.updateConfig}
            isActive={false}
          />
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
            {/* All Users Management Section */}
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-medium">All Users Management</h3>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button
                    onClick={() => {
                      loadAllUsers();
                    }}
                    disabled={loadingAllUsers}
                    variant="outline"
                    size="sm"
                  >
                    {(loadingAllUsers) ? (
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
                  <Button
                    onClick={syncHomebases}
                    disabled={isSyncingHomebases}
                    variant="outline"
                    size="sm"
                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    title="Sync homebases from POPS"
                  >
                    {isSyncingHomebases ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Sync POPS Homebases
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={syncRiders}
                    disabled={isSyncingRiders}
                    variant="outline"
                    size="sm"
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    title="Sync riders from POPS"
                  >
                    {isSyncingRiders ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Sync POPS Riders
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Search & Archived Toggle */}
              <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search users..."
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showArchived"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <Label htmlFor="showArchived" className="text-sm font-medium">Show Archived</Label>
                </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className={`h-full flex flex-col border rounded-lg p-4 ${user.archived_at ? 'bg-red-50/50 opacity-75 border-red-200' : 'bg-muted'}`}>
                      <div className="flex flex-col gap-4 flex-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3">
                            {user.dispatch_option && (
                              <DispatchBadge
                                dispatchOption={user.dispatch_option}
                                iconOnly
                                className="w-9 h-9 flex-shrink-0 mt-0.5"
                              />
                            )}
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="font-medium truncate">{user.full_name || user.rider_id}</h3>
                                <Badge variant={user.is_active ? "default" : "secondary"} className="text-xs">
                                  {user.is_active ? "Active" : "Inactive"}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {user.role}
                                </Badge>
                                {user.archived_at && (
                                  <Badge variant="destructive" className="text-xs">
                                    Archived
                                  </Badge>
                                )}
                                {user.primary_homebase_details && (
                                  <HomebaseBadge homebase={user.primary_homebase_details} className="text-xs" />
                                )}
                              </div>
                              <div className="space-y-0.5 text-sm text-muted-foreground">
                                <p className="truncate">
                                  ID: {user.rider_id}
                                </p>
                                {user.email && (
                                  <p className="truncate">
                                    {user.email}
                                  </p>
                                )}
                                {user.phone && (
                                  <p className="truncate">
                                    Phone: {user.phone}
                                  </p>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Last Login: {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-auto pt-1">
                          {currentUser?.is_super_user && user.phone && user.role === 'is_driver' && (
                            <Button
                              onClick={() => handleFetchOtp(user.rider_id)}
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 border-purple-200 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                              title="Show active OTP (emergency bypass)"
                            >
                              OTP
                            </Button>
                          )}
                          {!user.archived_at ? (
                            <Button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to archive user ${user.full_name || user.rider_id}?`)) {
                                  archiveUser(user.id);
                                }
                              }}
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              Archive
                            </Button>
                          ) : (
                            <Button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to restore user ${user.full_name || user.rider_id}?`)) {
                                  restoreUser(user.id);
                                }
                              }}
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            >
                              Restore
                            </Button>
                          )}
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

      {/* Vehicle Type Modal */}
      {
        showVehicleModal && (
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
        )
      }

      {/* Fuel Settings Modal */}
      <FuelSettingsModal
        isOpen={showFuelSettingsModal}
        onClose={() => setShowFuelSettingsModal(false)}
      />

      {activeOtp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-72 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Active OTP</h3>
            <p className="text-sm text-muted-foreground mb-4">{activeOtp.rider_id}</p>
            <div className="text-4xl font-mono font-bold tracking-widest text-purple-700 mb-3">
              {activeOtp.otp}
            </div>
            <p className="text-xs text-muted-foreground mb-5">Expires in ~{activeOtp.expires_in}s</p>
            <Button variant="outline" size="sm" onClick={() => setActiveOtp(null)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default withPageErrorBoundary(AdminPage, 'Admin Dashboard');

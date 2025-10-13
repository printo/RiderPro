import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { withModalErrorBoundary } from '@/components/ErrorBoundary';
import {
  Fuel,
  Settings,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Car,
  Truck,
  AlertTriangle
} from 'lucide-react';

export interface VehicleType {
  id: string;
  name: string;
  fuelEfficiency: number; // km per liter
  description?: string;
  icon?: string;
}

export interface FuelSettings {
  defaultVehicleType: string;
  fuelPrice: number; // price per liter
  currency: string;
  vehicleTypes: VehicleType[];
  dataRetentionDays: number;
}

interface FuelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: FuelSettings) => Promise<void>;
  currentSettings: FuelSettings;
}

const DEFAULT_VEHICLE_TYPES: VehicleType[] = [
  {
    id: 'standard-van',
    name: 'Standard Van',
    fuelEfficiency: 15.0,
    description: 'Standard delivery van',
    icon: 'truck'
  },
  {
    id: 'compact-car',
    name: 'Compact Car',
    fuelEfficiency: 20.0,
    description: 'Small car for light deliveries',
    icon: 'car'
  },
  {
    id: 'large-truck',
    name: 'Large Truck',
    fuelEfficiency: 8.0,
    description: 'Heavy-duty truck for large shipments',
    icon: 'truck'
  },
  {
    id: 'motorcycle',
    name: 'Motorcycle',
    fuelEfficiency: 35.0,
    description: 'Motorcycle for quick deliveries',
    icon: 'car'
  }
];

function FuelSettingsModal({
  isOpen,
  onClose,
  onSave,
  currentSettings
}: FuelSettingsModalProps) {
  const [settings, setSettings] = useState<FuelSettings>(currentSettings);
  const [newVehicleType, setNewVehicleType] = useState<Partial<VehicleType>>({});
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setSettings(currentSettings);
    setErrors({});
  }, [currentSettings, isOpen]);

  const validateSettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (settings.fuelPrice <= 0) {
      newErrors.fuelPrice = 'Fuel price must be greater than 0';
    }

    if (settings.dataRetentionDays < 1) {
      newErrors.dataRetentionDays = 'Data retention must be at least 1 day';
    }

    if (settings.vehicleTypes.length === 0) {
      newErrors.vehicleTypes = 'At least one vehicle type is required';
    }

    if (!settings.vehicleTypes.find(v => v.id === settings.defaultVehicleType)) {
      newErrors.defaultVehicleType = 'Default vehicle type must be selected from available types';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(settings);
      onClose();
    } catch (error) {
      console.error('Failed to save fuel settings:', error);
      setErrors({ general: 'Failed to save settings. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({
      ...currentSettings,
      vehicleTypes: DEFAULT_VEHICLE_TYPES
    });
    setErrors({});
  };

  const addVehicleType = () => {
    if (!newVehicleType.name || !newVehicleType.fuelEfficiency) {
      setErrors({ newVehicle: 'Name and fuel efficiency are required' });
      return;
    }

    if (newVehicleType.fuelEfficiency <= 0) {
      setErrors({ newVehicle: 'Fuel efficiency must be greater than 0' });
      return;
    }

    const vehicleType: VehicleType = {
      id: newVehicleType.name!.toLowerCase().replace(/\s+/g, '-'),
      name: newVehicleType.name!,
      fuelEfficiency: newVehicleType.fuelEfficiency!,
      description: newVehicleType.description || '',
      icon: 'car'
    };

    setSettings(prev => ({
      ...prev,
      vehicleTypes: [...prev.vehicleTypes, vehicleType]
    }));

    setNewVehicleType({});
    setIsAddingVehicle(false);
    setErrors({});
  };

  const removeVehicleType = (id: string) => {
    setSettings(prev => ({
      ...prev,
      vehicleTypes: prev.vehicleTypes.filter(v => v.id !== id),
      defaultVehicleType: prev.defaultVehicleType === id
        ? prev.vehicleTypes.find(v => v.id !== id)?.id || ''
        : prev.defaultVehicleType
    }));
  };

  const getVehicleIcon = (iconType: string) => {
    switch (iconType) {
      case 'truck':
        return <Truck className="h-4 w-4" />;
      case 'car':
      default:
        return <Car className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Fuel Settings Configuration
          </DialogTitle>
          <DialogDescription>
            Configure fuel calculation settings including rates, efficiency metrics, and cost parameters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {errors.general && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{errors.general}</AlertDescription>
            </Alert>
          )}

          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fuel className="h-5 w-5" />
                General Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fuelPrice">
                    Fuel Price ({settings.currency}/L)
                  </Label>
                  <Input
                    id="fuelPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.fuelPrice}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      fuelPrice: parseFloat(e.target.value) || 0
                    }))}
                    className={errors.fuelPrice ? 'border-red-500' : ''}
                  />
                  {errors.fuelPrice && (
                    <p className="text-sm text-red-500">{errors.fuelPrice}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={settings.currency}
                    onValueChange={(value) => setSettings(prev => ({
                      ...prev,
                      currency: value
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataRetention">Data Retention (days)</Label>
                  <Input
                    id="dataRetention"
                    type="number"
                    min="1"
                    value={settings.dataRetentionDays}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      dataRetentionDays: parseInt(e.target.value) || 30
                    }))}
                    className={errors.dataRetentionDays ? 'border-red-500' : ''}
                  />
                  {errors.dataRetentionDays && (
                    <p className="text-sm text-red-500">{errors.dataRetentionDays}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Route data older than this will be automatically cleaned up
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultVehicle">Default Vehicle Type</Label>
                  <Select
                    value={settings.defaultVehicleType}
                    onValueChange={(value) => setSettings(prev => ({
                      ...prev,
                      defaultVehicleType: value
                    }))}
                  >
                    <SelectTrigger className={errors.defaultVehicleType ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select default vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {settings.vehicleTypes.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          <div className="flex items-center gap-2">
                            {getVehicleIcon(vehicle.icon || 'car')}
                            {vehicle.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.defaultVehicleType && (
                    <p className="text-sm text-red-500">{errors.defaultVehicleType}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vehicle Types */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Vehicle Types
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset to Defaults
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddingVehicle(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Vehicle Type
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {errors.vehicleTypes && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{errors.vehicleTypes}</AlertDescription>
                </Alert>
              )}

              {/* Add New Vehicle Type */}
              {isAddingVehicle && (
                <Card className="border-dashed">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Vehicle Name</Label>
                        <Input
                          placeholder="e.g., Electric Van"
                          value={newVehicleType.name || ''}
                          onChange={(e) => setNewVehicleType(prev => ({
                            ...prev,
                            name: e.target.value
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fuel Efficiency (km/L)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="e.g., 18.5"
                          value={newVehicleType.fuelEfficiency || ''}
                          onChange={(e) => setNewVehicleType(prev => ({
                            ...prev,
                            fuelEfficiency: parseFloat(e.target.value) || 0
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description (optional)</Label>
                        <Input
                          placeholder="e.g., Eco-friendly delivery vehicle"
                          value={newVehicleType.description || ''}
                          onChange={(e) => setNewVehicleType(prev => ({
                            ...prev,
                            description: e.target.value
                          }))}
                        />
                      </div>
                    </div>
                    {errors.newVehicle && (
                      <p className="text-sm text-red-500 mt-2">{errors.newVehicle}</p>
                    )}
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" onClick={addVehicleType}>
                        <Save className="h-4 w-4 mr-1" />
                        Add Vehicle
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsAddingVehicle(false);
                          setNewVehicleType({});
                          setErrors({});
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Existing Vehicle Types */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {settings.vehicleTypes.map((vehicle) => (
                  <Card key={vehicle.id} className="relative">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getVehicleIcon(vehicle.icon || 'car')}
                          <div>
                            <h4 className="font-medium">{vehicle.name}</h4>
                            <p className="text-sm text-gray-500">
                              {vehicle.fuelEfficiency} km/L
                            </p>
                            {vehicle.description && (
                              <p className="text-xs text-gray-400 mt-1">
                                {vehicle.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {settings.defaultVehicleType === vehicle.id && (
                            <Badge variant="default">Default</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVehicleType(vehicle.id)}
                            disabled={settings.vehicleTypes.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} export default withModalErrorBoundary(FuelSettingsModal, {
  componentName: 'FuelSettingsModal'
});
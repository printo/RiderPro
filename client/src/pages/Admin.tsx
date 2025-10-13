import authService from "@/services/AuthService";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { BarChart3, Map, Settings, Shield, Fuel, Send, Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import FuelSettingsModal, { FuelSettings } from "@/components/FuelSettingsModal";
import TokenManagement from "@/components/TokenManagement";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { withPageErrorBoundary } from "@/components/ErrorBoundary";

function AdminPage() {
  const user = authService.getUser();
  const [, setLocation] = useLocation();
  const [showFuelSettings, setShowFuelSettings] = useState(false);
  const [payloadInput, setPayloadInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Array<{ index: number, success: boolean, trackingNumber?: string, error?: string }>>([]);
  const { toast } = useToast();

  const canAccessAdmin = !!(user?.isAdmin || user?.isSuperAdmin);
  const canEdit = !!(user?.isAdmin || user?.isSuperAdmin);

  // Fuel settings state
  const [fuelSettings, setFuelSettings] = useState<FuelSettings>({
    defaultVehicleType: 'standard-van',
    fuelPrice: 1.5,
    currency: 'INR',
    vehicleTypes: [
      {
        id: 'standard-van',
        name: 'Standard Van',
        fuelEfficiency: 15.0,
        description: 'Standard delivery van'
      }
    ],
    dataRetentionDays: 90
  });

  const handleFuelSettingsSave = async (newSettings: FuelSettings) => {
    try {
      setFuelSettings(newSettings);
      // Save to localStorage or API
      localStorage.setItem('fuelSettings', JSON.stringify(newSettings));
      console.log('Fuel settings saved:', newSettings);
    } catch (error) {
      console.error('Failed to save fuel settings:', error);
      throw error;
    }
  };

  // JSON validation and payload processing functions
  const validateJSON = (input: string): { valid: boolean; error?: string } => {
    if (!input.trim()) return { valid: false, error: "Input cannot be empty" };
    try {
      JSON.parse(input);
      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  };

  const validateShipmentPayload = (payload: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const required = ['trackingNumber', 'status', 'priority', 'pickupAddress',
      'deliveryAddress', 'recipientName', 'recipientPhone', 'weight', 'dimensions'];

    required.forEach(field => {
      if (!payload[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    if (payload.weight && (typeof payload.weight !== 'number' || payload.weight <= 0)) {
      errors.push('Weight must be a positive number');
    }

    return { valid: errors.length === 0, errors };
  };

  const detectPayloadType = (input: string): 'single' | 'array' | 'invalid' => {
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? 'array' : 'single';
    } catch {
      return 'invalid';
    }
  };

  const extractPayloads = (input: string): any[] => {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed : [parsed];
  };

  // Generate sample payload with unique tracking number
  const generateSamplePayload = () => ({
    trackingNumber: `TRK${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
    status: "Assigned",
    priority: "high",
    type: "delivery",
    pickupAddress: "123 Pickup Street, Mumbai, Maharashtra",
    deliveryAddress: "456 Delivery Avenue, Mumbai, Maharashtra",
    recipientName: "John Doe",
    recipientPhone: "+91-9876543210",
    weight: 2.5,
    dimensions: "30x20x10 cm",
    specialInstructions: "Handle with care",
    estimatedDeliveryTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    customerName: "John Doe",
    customerMobile: "+91-9876543210",
    address: "456 Delivery Avenue, Mumbai, Maharashtra",
    latitude: 19.0760 + (Math.random() - 0.5) * 0.02, // Mumbai area with smaller variation for better testing
    longitude: 72.8777 + (Math.random() - 0.5) * 0.02,
    cost: 500.00,
    deliveryTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    routeName: "Route A",
    employeeId: "EMP123"
  });

  const handlePayloadChange = (value: string) => {
    setPayloadInput(value);
    setTestResults([]);

    // Real-time JSON validation
    if (value.trim()) {
      const validation = validateJSON(value);
      setValidationError(validation.valid ? null : validation.error || 'Invalid JSON');
    } else {
      setValidationError(null);
    }
  };

  const handleUseSample = () => {
    const samplePayload = generateSamplePayload();
    setPayloadInput(JSON.stringify(samplePayload, null, 2));
    setValidationError(null);
    setTestResults([]);
  };

  const handleClearAll = () => {
    setPayloadInput('');
    setValidationError(null);
    setTestResults([]);
  };

  const handleSendShipments = async () => {
    if (!canEdit || !payloadInput.trim() || validationError) return;

    setIsSubmitting(true);
    let successCount = 0;
    let errorCount = 0;
    const results: Array<{ index: number, success: boolean, trackingNumber?: string, error?: string }> = [];

    try {
      // Extract payloads (single object or array)
      const payloads = extractPayloads(payloadInput);
      console.log(`Processing ${payloads.length} payload(s)...`);

      for (let i = 0; i < payloads.length; i++) {
        const payload = payloads[i];

        try {
          // Client-side validation
          const validation = validateShipmentPayload(payload);
          if (!validation.valid) {
            errorCount++;
            const error = `Validation failed: ${validation.errors.join(', ')}`;
            results.push({ index: i + 1, success: false, error });
            console.error(`Payload ${i + 1} validation failed:`, validation.errors);
            continue;
          }

          const response = await authService.fetchWithAuth('/api/shipments', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            const responseData = await response.json();
            successCount++;
            results.push({
              index: i + 1,
              success: true,
              trackingNumber: responseData.trackingNumber || payload.trackingNumber
            });
            console.log(`✅ Payload ${i + 1} success:`, responseData.trackingNumber);
          } else {
            const errorData = await response.json();
            errorCount++;
            const error = errorData.message || 'Unknown server error';
            results.push({ index: i + 1, success: false, error });
            console.error(`❌ Payload ${i + 1} failed:`, error);
          }
        } catch (parseError: any) {
          errorCount++;
          const error = parseError.message || 'Processing error';
          results.push({ index: i + 1, success: false, error });
          console.error(`❌ Payload ${i + 1} error:`, parseError);
        }
      }

      setTestResults(results);

      // Enhanced user feedback
      if (successCount > 0 && errorCount === 0) {
        toast({
          title: "Success!",
          description: `All ${successCount} shipment(s) created successfully`,
        });
      } else if (successCount > 0 && errorCount > 0) {
        toast({
          title: "Partial Success",
          description: `${successCount} succeeded, ${errorCount} failed. Check results below.`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Failed",
          description: `All ${errorCount} shipment(s) failed to create. Check results below.`,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to process shipments: " + (error.message || 'Unknown error'),
        variant: "destructive"
      });
      console.error('Send shipments error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canAccessAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Access denied</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">You do not have permission to access the admin dashboard. Only administrators can access this area.</p>
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
        <p className="text-muted-foreground">Manage system settings, users, and access route analytics</p>
      </div>

      {/* Quick Actions - Route Management */}
      {/* <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Route Management
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Access route analytics and visualization tools</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => setLocation('/route-analytics')}
              className="h-16 flex items-center justify-start gap-3 p-4"
            >
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="font-medium">Route Analytics</div>
                <div className="text-sm opacity-90">Performance metrics and fuel analytics</div>
              </div>
            </Button>

            <Button
              onClick={() => setLocation('/route-visualization')}
              variant="secondary"
              className="h-16 flex items-center justify-start gap-3 p-4"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Map className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-medium">Route Visualization</div>
                <div className="text-sm text-muted-foreground">GPS tracking and route playback</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card> */}

      {/* Shipment Testing Section */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Send className="h-5 w-5" />
            Shipment Testing
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Test shipment creation by pasting JSON payloads. Supports single objects or arrays for bulk testing.
          </p>

          <div className="space-y-4">
            {/* Single Textarea Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  JSON Payload {detectPayloadType(payloadInput) === 'array' && `(${extractPayloads(payloadInput).length} shipments detected)`}
                </label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUseSample}
                    disabled={!canEdit}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Sample
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearAll}
                    disabled={!canEdit || !payloadInput.trim()}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
              <Textarea
                placeholder="Paste your shipment JSON payload here... 
Examples:
Single: { &quot;trackingNumber&quot;: &quot;TRK123&quot;, ... }
Bulk: [{ &quot;trackingNumber&quot;: &quot;TRK123&quot;, ... }, { &quot;trackingNumber&quot;: &quot;TRK124&quot;, ... }]"
                value={payloadInput}
                onChange={(e) => handlePayloadChange(e.target.value)}
                className={`min-h-[200px] font-mono text-sm ${validationError ? 'border-red-500' : payloadInput.trim() && !validationError ? 'border-green-500' : ''}`}
                disabled={!canEdit}
              />
              {validationError && (
                <p className="text-sm text-red-600">❌ {validationError}</p>
              )}
              {payloadInput.trim() && !validationError && (
                <p className="text-sm text-green-600">✅ Valid JSON format</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 items-center">
              <Button
                onClick={handleSendShipments}
                disabled={!canEdit || isSubmitting || !payloadInput.trim() || !!validationError}
                className="bg-primary text-primary-foreground"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Sending...' :
                  payloadInput.trim() && !validationError ?
                    `Send ${detectPayloadType(payloadInput) === 'array' ? extractPayloads(payloadInput).length : 1} Shipment(s)` :
                    'Send Shipments'}
              </Button>

              <Button
                variant="outline"
                onClick={() => setLocation('/shipments')}
                disabled={!canEdit}
              >
                View Shipments
              </Button>
            </div>

            {!canEdit && <span className="text-xs text-muted-foreground">Admin access required for testing</span>}

            {/* Test Results */}
            {testResults.length > 0 && (
              <div className="mt-6 space-y-2">
                <h4 className="text-sm font-medium">Test Results:</h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2 max-h-60 overflow-y-auto">
                  {testResults.map((result) => (
                    <div key={result.index} className={`text-sm p-2 rounded ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {result.success ? (
                        <span>✅ Payload {result.index}: Success - Tracking: {result.trackingNumber}</span>
                      ) : (
                        <span>❌ Payload {result.index}: Failed - {result.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Settings Section */}
        {/* <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Settings
            </h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Configure global system preferences.</p>
            <div className="flex gap-3">
              <Button disabled={!canEdit}>Save Settings</Button>
              {!canEdit && <span className="text-xs text-muted-foreground">Read only access</span>}
            </div>
          </CardContent>
        </Card> */}

        {/* API Token Management Section */}
        <div className="lg:col-span-2">
          <TokenManagement canEdit={canEdit} />
        </div>

        {/* Analytics Settings Section */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Fuel className="h-5 w-5" />
              Analytics Settings
            </h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Configure fuel settings and analytics parameters.</p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowFuelSettings(true)}
                disabled={!canEdit}
              >
                Fuel Settings
              </Button>
              <Button variant="outline" disabled={!canEdit}>Export Settings</Button>
            </div>
            {!canEdit && <span className="text-xs text-muted-foreground">Read only access</span>}
          </CardContent>
        </Card>

        {/* Audit & Monitoring Section */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Audit & Monitoring
            </h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Review system activity and health checks.</p>
            <div className="flex gap-3">
              <Button variant="outline">View Logs</Button>
              <Button variant="outline">System Health</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fuel Settings Modal */}
      <FuelSettingsModal
        isOpen={showFuelSettings}
        onClose={() => setShowFuelSettings(false)}
        onSave={handleFuelSettingsSave}
        currentSettings={fuelSettings}
      />
    </div>
  );
}

export default withPageErrorBoundary(AdminPage, 'Admin Dashboard');


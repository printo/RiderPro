import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/ApiClient";
import { useLocation } from "wouter";
import { BarChart3, Map, Settings, Shield, Fuel, Send, Copy, Trash2, Users, UserCheck, UserX } from "lucide-react";
import { useState, useEffect } from "react";
import FuelSettingsModal, { FuelSettings } from "@/components/ui/forms/FuelSettingsModal";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { withPageErrorBoundary } from "@/components/ErrorBoundary";

interface PendingUser {
  id: string;
  rider_id: string;
  full_name: string;
  email: string;
  created_at: string;
}

function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showFuelSettings, setShowFuelSettings] = useState(false);
  const [payloadInput, setPayloadInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Array<{ index: number, success: boolean, trackingNumber?: string, error?: string }>>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [resetPasswordModal, setResetPasswordModal] = useState<{ isOpen: boolean; userId: string; userName: string }>({
    isOpen: false,
    userId: '',
    userName: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [accessTokens, setAccessTokens] = useState<Array<{
    id: string;
    name: string;
    token: string;
    masked: string;
    description: string;
    status: string;
  }>>([]);
  const { toast } = useToast();

  const canAccessAdmin = !!(user?.isSuperUser || user?.isSuperAdmin);
  const canEdit = !!(user?.isSuperUser || user?.isSuperAdmin);

  // Load pending users and access tokens
  useEffect(() => {
    if (canAccessAdmin) {
      loadPendingUsers();
      loadAccessTokens();
    }
  }, [canAccessAdmin]);

  const loadPendingUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch('/api/auth/pending-approvals');
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


  const loadAccessTokens = async () => {
    try {
      const response = await fetch('/api/admin/access-tokens');
      if (response.ok) {
        const data = await response.json();
        setAccessTokens(data.accessTokens || []);
      }
    } catch (error) {
      console.error('Failed to load access tokens:', error);
      // Fallback to hardcoded tokens for display
      setAccessTokens([
        {
          id: 'access-token-1',
          name: 'Access Token 1',
          token: 'riderpro-access-token-1-abc123def456ghi789',
          masked: 'rider*******ghi789',
          description: 'Primary access token for external system integration',
          status: 'active'
        },
        {
          id: 'access-token-2',
          name: 'Access Token 2',
          token: 'riderpro-access-token-2-xyz789uvw456rst123',
          masked: 'rider*******rst123',
          description: 'Secondary access token for external system integration',
          status: 'active'
        }
      ]);
    }
  };

  const approveUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/auth/approve/${userId}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "User approved successfully",
        });
        loadPendingUsers();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to approve user",
          variant: "destructive",
        });
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
      const response = await fetch(`/api/auth/reject/${userId}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "User rejected successfully",
        });
        loadPendingUsers();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to reject user",
          variant: "destructive",
        });
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

  const resetUserPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    setIsResettingPassword(true);
    try {
      const response = await fetch(`/api/auth/reset-password/${resetPasswordModal.userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast({
          title: "Success",
          description: "Password reset successfully",
        });
        setResetPasswordModal({ isOpen: false, userId: '', userName: '' });
        setNewPassword('');
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to reset password",
          variant: "destructive",
        });
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

          const response = await apiClient.post('/api/shipments/create', payload);

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

        {/* API Token Management Section (removed) */}

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


      {/* Access Tokens Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Access Tokens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Access tokens for external system integration. Use these tokens when sending data to external systems.
            </p>
            <div className="grid gap-4">
              {accessTokens.map((token) => (
                <div key={token.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{token.name}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${token.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {token.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{token.description}</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-background px-2 py-1 rounded border">
                        {token.masked}
                      </code>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(token.token);
                        toast({
                          title: "Copied!",
                          description: `${token.name} copied to clipboard`,
                        });
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Token
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              💡 Use these tokens in the Authorization header: <code>Authorization: Bearer &lt;token&gt;</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Management Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Manage user registrations and approvals
              </p>
              <Button
                onClick={loadPendingUsers}
                disabled={loadingUsers}
                variant="outline"
                size="sm"
              >
                {loadingUsers ? 'Loading...' : 'Refresh'}
              </Button>
            </div>

            {pendingUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending user approvals</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium">{user.full_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            ID: {user.rider_id} • {user.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Registered: {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => approveUser(user.id)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <UserCheck className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => rejectUser(user.id)}
                        size="sm"
                        variant="destructive"
                      >
                        <UserX className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        onClick={() => setResetPasswordModal({
                          isOpen: true,
                          userId: user.id,
                          userName: user.full_name
                        })}
                        size="sm"
                        variant="outline"
                      >
                        <Key className="h-4 w-4 mr-1" />
                        Reset Password
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fuel Settings Modal */}
      <FuelSettingsModal
        isOpen={showFuelSettings}
        onClose={() => setShowFuelSettings(false)}
        onSave={handleFuelSettingsSave}
        currentSettings={fuelSettings}
      />

      {/* Password Reset Modal */}
      {resetPasswordModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Reset password for user: <strong>{resetPasswordModal.userName}</strong>
              </p>
              <div>
                <label className="text-sm font-medium">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setResetPasswordModal({ isOpen: false, userId: '', userName: '' });
                    setNewPassword('');
                  }}
                  disabled={isResettingPassword}
                >
                  Cancel
                </Button>
                <Button
                  onClick={resetUserPassword}
                  disabled={isResettingPassword || !newPassword || newPassword.length < 6}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isResettingPassword ? 'Resetting...' : 'Reset Password'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default withPageErrorBoundary(AdminPage, 'Admin Dashboard');


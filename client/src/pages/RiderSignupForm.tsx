import React, { useState, useEffect } from 'react';
import { HomebaseSelector } from '@/components/ui/HomebaseSelector';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { withPageErrorBoundary } from '@/components/ErrorBoundary';
import { Captcha } from '@/components/ui/Captcha';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';
import { ButtonLoader } from '@/components/ui/Loader';
import { apiRequest } from '@/lib/queryClient';
import { VehicleType } from '@shared/types';

const RiderSignupForm = () => {
  const [formData, setFormData] = useState({
    riderId: '',
    fullName: '',
    password: '',
    confirmPassword: '',
    vehicleTypeId: '',
    homebaseId: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loadingVehicleTypes, setLoadingVehicleTypes] = useState(false);
  const [, setLocation] = useLocation();
  const { registerUser } = useAuth();

  // Load vehicle types on component mount
  useEffect(() => {
    loadVehicleTypes();
  }, []);

  const loadVehicleTypes = async () => {
    setLoadingVehicleTypes(true);
    try {
      console.log('Loading vehicle types from /api/v1/vehicle-types/');
      const response = await apiRequest("GET", '/api/v1/vehicle-types/');
      console.log('Vehicle types response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Vehicle types data:', data);
      
      // Handle both array and paginated response formats
      if (Array.isArray(data)) {
        setVehicleTypes(data);
        console.log('Loaded vehicle types (array):', data.length);
      } else if (data.results && Array.isArray(data.results)) {
        setVehicleTypes(data.results);
        console.log('Loaded vehicle types (paginated):', data.results.length);
      } else if (data.data && Array.isArray(data.data)) {
        setVehicleTypes(data.data);
        console.log('Loaded vehicle types (data):', data.data.length);
      } else {
        console.warn('Unexpected vehicle types response format:', data);
        setVehicleTypes([]);
      }
    } catch (error) {
      console.error('Failed to load vehicle types:', error);
      setError('Failed to load vehicle types. Please refresh the page or contact support.');
      setVehicleTypes([]);
    } finally {
      setLoadingVehicleTypes(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleVehicleTypeChange = (value: string) => {
    setFormData(prev => ({ ...prev, vehicleTypeId: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    console.log('Form submission started with data:', formData);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isCaptchaValid) {
      setError('Please complete the security check');
      return;
    }

    if (!formData.vehicleTypeId) {
      setError('Please select a vehicle type');
      return;
    }

    if (!formData.riderId.trim()) {
      setError('Please enter a Rider ID');
      return;
    }

    if (!formData.fullName.trim()) {
      setError('Please enter your Full Name');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Calling registerUser with:', {
        riderId: formData.riderId,
        password: '***',
        fullName: formData.fullName,
        vehicleTypeId: formData.vehicleTypeId,
        homebaseId: formData.homebaseId
      });

      const result = await registerUser(
        formData.riderId,
        formData.password,
        formData.fullName,
        undefined, // email
        formData.vehicleTypeId,
        '', // dispatch option (blank as requested)
        formData.homebaseId
      );

      console.log('Registration result:', result);

      if (result.success) {
        setLocation('/approval-pending');
      } else {
        setError(result.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-[90%] max-w-[400px] shadow-lg">
        <CardHeader className="flex flex-col items-center gap-3">
          <img src="/favicon.png" alt="RiderPro Logo" className="h-20 w-20 rounded-2xl shadow-md border-2 border-background" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground text-center">Create Rider Account</h1>
          <p className="text-sm text-muted-foreground">
            Sign up to get started
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                id="riderId"
                name="riderId"
                type="text"
                placeholder="Rider ID"
                value={formData.riderId}
                onChange={handleChange}
                disabled={isSubmitting}
                required
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Full Name"
                value={formData.fullName}
                onChange={handleChange}
                disabled={isSubmitting}
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="vehicleTypeId" className="text-sm font-medium text-foreground">
                Vehicle Type
              </label>
              <select
                id="vehicleTypeId"
                name="vehicleTypeId"
                value={formData.vehicleTypeId}
                onChange={(e) => handleVehicleTypeChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                disabled={isSubmitting || loadingVehicleTypes}
                required
              >
                <option value="">Select Vehicle Type</option>
                {vehicleTypes.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.icon} {vehicle.name} ({vehicle.fuel_efficiency} km/l)
                  </option>
                ))}
              </select>
              {loadingVehicleTypes && (
                <p className="text-xs text-muted-foreground">Loading vehicle types...</p>
              )}
              {!loadingVehicleTypes && vehicleTypes.length === 0 && (
                <p className="text-xs text-muted-foreground">No vehicle types available. Please contact admin.</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="homebaseId" className="text-sm font-medium text-foreground">
                Primary Homebase
              </label>
              <HomebaseSelector
                value={formData.homebaseId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, homebaseId: value }))}
                placeholder="Select Primary Homebase"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  className="pr-10"
                  disabled={isSubmitting}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none disabled:opacity-50"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={isSubmitting}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isSubmitting}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <Captcha onVerify={setIsCaptchaValid} />

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !isCaptchaValid}
            >
              {isSubmitting ? (
                <ButtonLoader text="Creating Account..." />
              ) : (
                "Create Account"
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setLocation('/login')}
                className="text-primary font-semibold hover:underline focus:outline-none"
                disabled={isSubmitting}
              >
                Sign in
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default withPageErrorBoundary(RiderSignupForm, 'RiderSignup');
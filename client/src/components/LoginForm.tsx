// client/src/pages/Login.tsx
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Package, Eye, EyeOff, Loader2, User, Truck, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { withPageErrorBoundary } from "@/components/ErrorBoundary";

type LoginMode = 'admin' | 'rider';

function Login() {
  const [loginMode, setLoginMode] = useState<LoginMode>('rider');
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isNewRider, setIsNewRider] = useState(false);
  const [riderValidation, setRiderValidation] = useState<{
    isValid: boolean;
    message: string;
    isChecking: boolean;
  }>({ isValid: false, message: '', isChecking: false });
  const [, setLocation] = useLocation();

  // Use auth service (admin path needs external API login)
  const { loginWithExternalAPI } = useAuth();

  // Validate password strength
  const validatePassword = (password: string): { isValid: boolean; message: string } => {
    if (password.length < 6) {
      return { isValid: false, message: "Password must be at least 6 characters long" };
    }
    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: "Password must contain at least one lowercase letter" };
    }
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: "Password must contain at least one uppercase letter" };
    }
    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: "Password must contain at least one number" };
    }
    return { isValid: true, message: "Password is valid" };
  };

  // Check if rider ID exists in PIA backend
  const validateRiderId = async (riderId: string) => {
    if (!riderId.trim()) {
      setRiderValidation({ isValid: false, message: '', isChecking: false });
      return;
    }

    setRiderValidation({ isValid: false, message: 'Checking rider ID...', isChecking: true });

    try {
      // Check if rider exists in our local database first
      const response = await fetch(`/api/riders/unregistered`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riderId })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          setRiderValidation({ 
            isValid: true, 
            message: 'Rider ID found. You can proceed with login.', 
            isChecking: false 
          });
          setIsNewRider(false);
        } else {
          setRiderValidation({ 
            isValid: true, 
            message: 'New rider detected. Please set a password to register.', 
            isChecking: false 
          });
          setIsNewRider(true);
        }
      } else {
        setRiderValidation({ 
          isValid: false, 
          message: 'Rider ID not found in system.', 
          isChecking: false 
        });
        setIsNewRider(false);
      }
    } catch (error) {
      setRiderValidation({ 
        isValid: false, 
        message: 'Error validating rider ID. Please try again.', 
        isChecking: false 
      });
      setIsNewRider(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset error and show loading
    setError("");
    setIsLoading(true);

    try {
      if (loginMode === 'rider') {
        // Handle rider login/registration
        if (isNewRider) {
          // Validate password for new riders
          const passwordValidation = validatePassword(password);
          if (!passwordValidation.isValid) {
            setError(passwordValidation.message);
            setIsLoading(false);
            return;
          }

          if (password !== confirmPassword) {
            setError("Passwords do not match");
            setIsLoading(false);
            return;
          }

          // Register new rider
          const registerResponse = await fetch('/api/riders/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              riderId: employeeId,
              password: password
            })
          });

          if (!registerResponse.ok) {
            const errorData = await registerResponse.json();
            setError(errorData.message || "Registration failed");
            setIsLoading(false);
            return;
          }
        }

        // Login as rider
        const loginResponse = await fetch('/api/riders/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            riderId: employeeId,
            password: password
          })
        });

        if (!loginResponse.ok) {
          const errorData = await loginResponse.json();
          setError(errorData.message || "Login failed");
          setIsLoading(false);
          return;
        }

        const loginData = await loginResponse.json();
        
        // Check if rider is approved
        if (loginData.isApproved === false) {
          setError('Account pending approval. Please contact administrator.');
          setTimeout(() => setLocation('/approval-pending'), 2000);
          setIsLoading(false);
          return;
        }
        
        // Store rider session
        localStorage.setItem('riderSession', JSON.stringify({
          riderId: employeeId,
          name: loginData.name,
          role: 'rider',
          token: loginData.token,
          isApproved: loginData.isApproved
        }));

        console.log('[Login] Rider login successful! Navigating to dashboard...');
        setLocation('/dashboard');
      } else {
        // Admin login via external API
        console.log('[Login] Attempting admin login for:', employeeId);
        const result = await loginWithExternalAPI(employeeId, password);

        if (result.success) {
          console.log('[Login] Admin login successful! Navigating to dashboard...');
          setLocation('/dashboard');
        } else {
          console.error('[Login] Admin login failed:', result.message);
          setError(result.message || 'Invalid credentials');
        }
      }
    } catch (error) {
      console.error('[Login] Login error:', error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleModeChange = (mode: LoginMode) => {
    setLoginMode(mode);
    setError("");
    setEmployeeId("");
    setPassword("");
    setConfirmPassword("");
    setIsNewRider(false);
    setRiderValidation({ isValid: false, message: '', isChecking: false });
  };

  const handleEmployeeIdChange = (value: string) => {
    setEmployeeId(value);
    if (loginMode === 'rider' && value.trim()) {
      validateRiderId(value);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-[90%] max-w-[450px] shadow-lg">
        <CardHeader className="flex flex-col items-center gap-2">
          <div className="rounded-full bg-primary/10 p-4">
            <Package className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">RiderPro</h1>
          <p className="text-sm text-muted-foreground">
            {loginMode === 'admin' ? 'Sign in as Admin using PIA Access' : 'Sign in as Rider'}
          </p>
        </CardHeader>
        <CardContent>
          {/* Mode Toggle (Rider left, Admin right) */}
          <div className="flex gap-2 mb-6">
            <Button
              type="button"
              variant={loginMode === 'rider' ? 'default' : 'outline'}
              onClick={() => handleModeChange('rider')}
              className="flex-1"
              disabled={isLoading}
            >
              <Truck className="w-4 h-4 mr-2" />
              Rider
            </Button>
            <Button
              type="button"
              variant={loginMode === 'admin' ? 'default' : 'outline'}
              onClick={() => handleModeChange('admin')}
              className="flex-1"
              disabled={isLoading}
            >
              <User className="w-4 h-4 mr-2" />
              Admin
            </Button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Rider/Admin - no secondary toggle */}

            <div className="space-y-2">
              <Input
                id="employeeId"
                type="text"
                placeholder={loginMode === 'admin' ? "Employee ID" : "Rider ID"}
                value={employeeId}
                onChange={(e) => handleEmployeeIdChange(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="username"
              />
              {loginMode === 'rider' && riderValidation.message && (
                <div className={`text-xs flex items-center gap-1 ${
                  riderValidation.isValid ? 'text-green-600' : 'text-red-600'
                }`}>
                  {riderValidation.isChecking ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <AlertCircle className="w-3 h-3" />
                  )}
                  {riderValidation.message}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  disabled={isLoading}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none disabled:opacity-50"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {loginMode === 'rider' && isNewRider && password && (
                <div className={`text-xs ${
                  validatePassword(password).isValid ? 'text-green-600' : 'text-red-600'
                }`}>
                  {validatePassword(password).message}
                </div>
              )}
            </div>

            {loginMode === 'rider' && isNewRider && (
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                    disabled={isLoading}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={toggleConfirmPasswordVisibility}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none disabled:opacity-50"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <div className="text-xs text-red-600">Passwords do not match</div>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={
                isLoading || 
                !employeeId || 
                !password || 
                (loginMode === 'rider' && isNewRider && (!confirmPassword || password !== confirmPassword)) ||
                (loginMode === 'rider' && !riderValidation.isValid && !riderValidation.isChecking)
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {loginMode === 'rider' && isNewRider ? 'Registering...' : 'Signing in...'}
                </>
              ) : (
                loginMode === 'rider' && isNewRider ? 'Register & Sign In' : 'Sign In'
              )}
            </Button>

            {loginMode === 'rider' && (
              <div className="text-center text-sm text-muted-foreground">
                Don't have a Rider ID?{' '}
                <button
                  type="button"
                  onClick={() => setLocation('/signup')}
                  className="text-primary font-semibold hover:underline focus:outline-none"
                  disabled={isLoading}
                >
                  Sign up here
                </button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default withPageErrorBoundary(Login, 'Login');
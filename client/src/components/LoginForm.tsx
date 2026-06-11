import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { ButtonLoader } from "@/components/ui/Loader";
import { useAuth } from "@/hooks/useAuth";
import AuthService from "@/services/AuthService";
import { withPageErrorBoundary } from "@/components/ErrorBoundary";

type AuthMethod = 'pia' | 'rider';

// Google Sign-In ("Continue with Google"). The client ID is public-by-design;
// override with VITE_GOOGLE_CLIENT_ID. NOTE: the serving origin (e.g.
// http://localhost:5004) must be an Authorized JavaScript origin on this OAuth
// client in the Google Cloud Console, or Google blocks the button.
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '875434468582-2a7h0gahc6sq6jm3gfmre9cca1lhh0p7.apps.googleusercontent.com';

interface GoogleCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('pia');
  const [, setLocation] = useLocation();

  // Use the authentication context with both methods
  const { loginWithExternalAPI, loginWithLocalDB } = useAuth();

  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Load Google Identity Services and render the "Continue with Google" button.
  // Only active for the PIA Access method.
  useEffect(() => {
    if (authMethod !== 'pia') return;
    const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
    let cancelled = false;

    const handleCredential = async (response: GoogleCredentialResponse) => {
      setError("");
      setIsLoading(true);
      try {
        const result = await AuthService.getInstance().loginWithGoogle(response.credential);
        if (result.success) {
          setLocation('/dashboard');
        } else {
          setError(result.message || 'Google sign-in failed');
        }
      } catch {
        setError('An unexpected error occurred. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    const renderButton = () => {
      if (cancelled || !window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
      });
      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: 320,
        logo_alignment: 'center',
      });
    };

    if (window.google) {
      renderButton();
      return () => { cancelled = true; };
    }

    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', renderButton);
    return () => {
      cancelled = true;
      script?.removeEventListener('load', renderButton);
    };
  }, [authMethod, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset error and show loading
    setError("");
    setIsLoading(true);

    try {
      console.log(`[Login] Attempting ${authMethod} login for:`, username);

      let result;

      // Call appropriate login method based on auth type
      if (authMethod === 'pia') {
        result = await loginWithExternalAPI(username, password);
      } else {
        result = await loginWithLocalDB(username, password);
      }

      console.log('[Login] Login result received:', result);

      if (result.success) {
        console.log('[Login] Login successful! Navigating to dashboard...');
        setLocation('/dashboard');
      } else if (authMethod === 'rider' && 'isApproved' in result && result.isApproved === false) {
        // Handle pending approval for rider login - redirect to waiting page
        setLocation('/approval-pending');
      } else {
        console.error('[Login] Login failed:', result.message);
        setError(result.message || "Invalid credentials");
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

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-[90%] max-w-[400px] shadow-lg">
        <CardHeader className="flex flex-col items-center gap-3">
          <img src="/favicon.png" alt="RiderPro Logo" className="h-20 w-20 rounded-2xl shadow-md border-2 border-background" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">RiderPro</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your account
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Auth Method Toggle */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setAuthMethod('pia')}
                disabled={isLoading}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all duration-200 ${authMethod === 'pia'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
              >
                PIA Access
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod('rider')}
                disabled={isLoading}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all duration-200 ${authMethod === 'rider'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
              >
                Rider ID
              </button>
            </div>

            <div className="space-y-2">
              <Input
                id="username"
                type="text"
                placeholder={authMethod === 'pia' ? 'Username (Email)' : 'Rider ID'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="username"
              />
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
            </div>

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !username || !password}
            >
              {isLoading ? (
                <ButtonLoader text="Signing in..." />
              ) : (
                "Sign In"
              )}
            </Button>

            {authMethod === 'rider' && (
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

          {authMethod === 'pia' && (
            <div className="mt-4">
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <div ref={googleBtnRef} className="flex justify-center" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default withPageErrorBoundary(Login, 'Login');
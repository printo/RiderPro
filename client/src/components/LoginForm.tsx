import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ButtonLoader } from "@/components/ui/Loader";
import { useAuth } from "@/hooks/useAuth";
import { withPageErrorBoundary } from "@/components/ErrorBoundary";
import { log } from "@/utils/logger";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Phone, ArrowLeft, HelpCircle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type AuthMethod = 'pia' | 'rider';

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
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('pia');
  const [, setLocation] = useLocation();

  const { loginWithGoogle, requestOtp, verifyOtp } = useAuth();
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
        const result = await loginWithGoogle(response.credential);
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
  }, [authMethod, loginWithGoogle, setLocation]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      const result = await requestOtp(phone);
      if (result.success) {
        setOtpSent(true);
        setResendCooldown(45);
      } else {
        setError(result.message || "Failed to send OTP. Please check your number.");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone.trim() || otp.length !== 6) {
      setError("Phone number and a valid 6-digit OTP code are required.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      log.dev(`[Login] Attempting OTP verification`);
      const result = await verifyOtp(phone, otp);

      if (result.success) {
        log.dev('[Login] Login successful, navigating to dashboard');
        setLocation('/dashboard');
      } else {
        log.dev('[Login] Login failed:', result.message);
        setError(result.message || "Invalid verification code");
      }
    } catch (error) {
      log.error('[Login] Login error:', error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4 sm:p-6 md:p-6 overflow-hidden">
      <Card className="w-full max-w-[440px] md:max-w-none md:w-[800px] shadow-xl md:shadow-2xl overflow-hidden border border-slate-200/50 dark:border-zinc-800/50 rounded-2xl flex flex-col md:flex-row bg-white dark:bg-zinc-900 md:h-[500px]">
        {/* Left Side: Branding Panel (Hidden on mobile, visible on desktop) */}
        <div className="hidden md:flex md:w-[42%] bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] p-8 flex-col items-center justify-center text-center gap-6 text-white relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0,transparent_100%)] pointer-events-none" />
          
          <img 
            src="/favicon.png" 
            alt="RiderPro Logo" 
            className="h-28 w-28 rounded-3xl shadow-2xl border-4 border-slate-800/50 transform hover:scale-105 transition-transform duration-300"
          />
          <div className="space-y-2 z-10">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-200 via-indigo-200 to-white bg-clip-text text-transparent">
              RiderPro
            </h1>
            <p className="text-sm text-slate-400 max-w-[200px] mx-auto leading-relaxed">
              Fast, secure, and passwordless authentication.
            </p>
          </div>
        </div>

        {/* Right Side: Form Panel */}
        <div className="flex-1 px-6 py-8 sm:p-10 md:pt-14 md:pb-8 md:px-10 flex flex-col justify-start bg-white dark:bg-zinc-900 overflow-y-auto no-scrollbar">
          {/* Unified Header */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="flex items-center gap-3 justify-center">
              <img 
                src="/favicon.png" 
                alt="RiderPro Logo" 
                className="h-10 w-10 rounded-xl shadow-md border border-slate-200 dark:border-zinc-800 md:hidden"
              />
              <div className="h-6 w-px bg-slate-200 dark:bg-zinc-800 md:hidden" />
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                Sign In
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Select your access method below
            </p>
          </div>

          <CardContent className="p-0">
            {/* Auth Method Toggle */}
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('pia');
                  setError("");
                }}
                disabled={isLoading}
                className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all duration-200 ${authMethod === 'pia'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                PIA Access
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('rider');
                  setError("");
                }}
                disabled={isLoading}
                className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all duration-200 ${authMethod === 'rider'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Rider ID
              </button>
            </div>

            {authMethod === 'pia' ? (
              <div className="space-y-6 flex flex-col items-center">
                <p className="text-sm text-muted-foreground text-center px-4 leading-relaxed">
                  Sign in with your corporate Google Account to access the management dashboard.
                </p>
                
                <div ref={googleBtnRef} className="flex justify-center w-full min-h-[44px] hover:shadow-md transition-shadow rounded-lg overflow-hidden" />
                
                {error && (
                  <div className="w-full p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-md">
                    {error}
                  </div>
                )}
                
                <div className="w-full pt-4 border-t border-slate-200 dark:border-zinc-800 text-center">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('rider')}
                    className="text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
                  >
                    Are you a rider? Log in with OTP
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={otpSent ? handleLogin : handleSendOtp} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      OTP Verification
                    </span>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button 
                          type="button" 
                          className="text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                          aria-label="Info about OTP Verification"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="center" className="max-w-[240px] text-xs leading-relaxed bg-slate-900 text-white dark:bg-zinc-800 dark:text-zinc-100 border-none shadow-lg">
                        Enter your registered phone number to receive a one-time verification code.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {otpSent && (
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtp("");
                        setError("");
                      }}
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                      disabled={isLoading}
                    >
                      <ArrowLeft className="h-3 w-3" /> Change Number
                    </button>
                  )}
                </div>

                {!otpSent ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="e.g. 9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10 h-11"
                        disabled={isLoading}
                        required
                        autoComplete="tel"
                      />
                    </div>
                    
                    {error && (
                      <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-md">
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-11 font-semibold"
                      disabled={isLoading || !phone.trim()}
                    >
                      {isLoading ? (
                        <ButtonLoader text="Sending OTP..." />
                      ) : (
                        "Send OTP"
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6 flex flex-col items-center">
                    <p className="text-sm text-muted-foreground text-center w-full leading-relaxed">
                      Enter the 6-digit code sent to <strong className="text-foreground">{phone}</strong>
                    </p>
                    
                    <div className="flex justify-center my-2">
                      <InputOTP
                        maxLength={6}
                        value={otp}
                        onChange={setOtp}
                        disabled={isLoading}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    {error && (
                      <div className="w-full p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-md">
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-11 font-semibold"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <ButtonLoader text="Verifying..." />
                      ) : (
                        "Verify & Log In"
                      )}
                    </Button>

                    <div className="w-full flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={isLoading || resendCooldown > 0}
                        className="text-sm font-bold text-primary hover:underline disabled:text-muted-foreground disabled:no-underline transition-all"
                      >
                        {resendCooldown > 0 
                          ? `Resend OTP in ${resendCooldown}s` 
                          : "Resend OTP"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="text-center text-xs text-muted-foreground pt-4 border-t border-slate-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('pia')}
                    className="text-primary font-semibold hover:underline focus:outline-none"
                    disabled={isLoading}
                  >
                    Staff? Sign in with Google
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </div>
      </Card>
    </div>
  );
}

export default withPageErrorBoundary(Login, 'Login');
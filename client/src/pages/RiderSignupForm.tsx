import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { withPageErrorBoundary } from '@/components/ErrorBoundary';
import { Captcha } from '@/components/ui/Captcha';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';
import { ButtonLoader } from '@/components/ui/Loader';

const RiderSignupForm = () => {
  const [formData, setFormData] = useState({
    riderId: '',
    fullName: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);
  const [, setLocation] = useLocation();
  const { registerUser } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isCaptchaValid) {
      setError('Please complete the security check');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerUser(
        formData.riderId,
        formData.password,
        formData.fullName
      );

      if (result.success) {
        setLocation('/approval-pending');
      } else {
        setError(result.message);
      }
    } catch (_err) {
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
// client/src/components/LoginForm.tsx
import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ExternalLink, Database } from 'lucide-react';

export const LoginForm: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'external' | 'local'>('external');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { loginWithExternalAPI, loginWithLocalDB, registerUser } = useAuth();
  const [, setLocation] = useLocation();

  // External API form state
  const [externalForm, setExternalForm] = useState({
    employeeId: '',
    password: '',
  });

  // Local DB form state
  const [localForm, setLocalForm] = useState({
    riderId: '',
    password: '',
  });

  // Registration form state
  const [registerForm, setRegisterForm] = useState({
    riderId: '',
    password: '',
    fullName: '',
    email: '',
  });

  const [showRegister, setShowRegister] = useState(false);

  const handleExternalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await loginWithExternalAPI(externalForm.employeeId, externalForm.password);
      if (result.success) {
        setSuccess('Login successful!');
        setTimeout(() => setLocation('/dashboard'), 1000);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await loginWithLocalDB(localForm.riderId, localForm.password);
      if (result.success) {
        setSuccess('Login successful!');
        setTimeout(() => setLocation('/dashboard'), 1000);
      } else if (result.isApproved === false) {
        setError('Account pending approval. Please contact administrator.');
        setTimeout(() => setLocation('/approval-pending'), 2000);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await registerUser(
        registerForm.riderId,
        registerForm.password,
        registerForm.fullName,
        registerForm.email
      );
      if (result.success) {
        setSuccess('Registration successful! Please wait for approval.');
        setTimeout(() => setLocation('/approval-pending'), 2000);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sign in to RiderPro
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Choose your authentication method
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'external' | 'local')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="external" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              External API
            </TabsTrigger>
            <TabsTrigger value="local" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Local Database
            </TabsTrigger>
          </TabsList>

          <TabsContent value="external">
            <Card>
              <CardHeader>
                <CardTitle>External API Login</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleExternalLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="employeeId">Employee ID</Label>
                    <Input
                      id="employeeId"
                      type="text"
                      value={externalForm.employeeId}
                      onChange={(e) => setExternalForm({ ...externalForm, employeeId: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={externalForm.password}
                      onChange={(e) => setExternalForm({ ...externalForm, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="local">
            <Card>
              <CardHeader>
                <CardTitle>Local Database Login</CardTitle>
              </CardHeader>
              <CardContent>
                {!showRegister ? (
                  <form onSubmit={handleLocalLogin} className="space-y-4">
                    <div>
                      <Label htmlFor="riderId">Rider ID</Label>
                      <Input
                        id="riderId"
                        type="text"
                        value={localForm.riderId}
                        onChange={(e) => setLocalForm({ ...localForm, riderId: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="localPassword">Password</Label>
                      <Input
                        id="localPassword"
                        type="password"
                        value={localForm.password}
                        onChange={(e) => setLocalForm({ ...localForm, password: e.target.value })}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign In
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowRegister(true)}
                    >
                      Don't have an account? Register
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <Label htmlFor="regRiderId">Rider ID</Label>
                      <Input
                        id="regRiderId"
                        type="text"
                        value={registerForm.riderId}
                        onChange={(e) => setRegisterForm({ ...registerForm, riderId: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="regPassword">Password</Label>
                      <Input
                        id="regPassword"
                        type="password"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        type="text"
                        value={registerForm.fullName}
                        onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email (Optional)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Register
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowRegister(false)}
                    >
                      Already have an account? Sign In
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};

export default LoginForm;

// client/src/examples/AuthContextUsage.tsx
// Example usage of the new authentication context and hooks

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  useAuth,
  useUser,
  useIsAuthenticated,
  useUserDisplayInfo,
  useCanAccessAdmin,
  useCanViewAnalytics,
  useCanExportData,
  useRouteViewPermissions,
  useLogin,
  useLogout,
  useAuthDebug,
} from '@/hooks/useAuth';
import { Permission, UserRole } from '@/types/Auth';

/**
 * Example: Basic authentication status display
 */
export function AuthStatusDisplay() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { displayName, initials, employeeId, role } = useUserDisplayInfo();

  if (isLoading) {
    return <div>Loading authentication...</div>;
  }

  if (!isAuthenticated) {
    return <div>Not authenticated</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Authentication Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
            {initials}
          </div>
          <div>
            <div className="font-medium">{displayName}</div>
            <div className="text-sm text-muted-foreground">ID: {employeeId}</div>
          </div>
        </div>
        <Badge variant="secondary">{role}</Badge>
        <div className="text-sm text-muted-foreground">
          Last login: {user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Unknown'}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Example: Permission-based UI rendering
 */
export function PermissionBasedUI() {
  const canAccessAdmin = useCanAccessAdmin();
  const canViewAnalytics = useCanViewAnalytics();
  const canExportData = useCanExportData();
  const { canViewAllRoutes, canViewOwnRoutes } = useRouteViewPermissions();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Available Features</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {canAccessAdmin && (
          <Button variant="outline" className="w-full justify-start">
            🔧 Admin Dashboard
          </Button>
        )}

        {canViewAnalytics && (
          <Button variant="outline" className="w-full justify-start">
            📊 Analytics
          </Button>
        )}

        {canExportData && (
          <Button variant="outline" className="w-full justify-start">
            📥 Export Data
          </Button>
        )}

        {canViewAllRoutes && (
          <Button variant="outline" className="w-full justify-start">
            🗺️ All Routes
          </Button>
        )}

        {canViewOwnRoutes && !canViewAllRoutes && (
          <Button variant="outline" className="w-full justify-start">
            🗺️ My Routes
          </Button>
        )}

        {!canViewAllRoutes && !canViewOwnRoutes && (
          <div className="text-sm text-muted-foreground">
            No route viewing permissions
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Example: Role-based component rendering
 */
export function RoleBasedComponent() {
  const { hasRole, hasAnyRole } = useAuth();

  if (hasRole(UserRole.SUPER_ADMIN)) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <div className="text-red-600 font-medium">Super Admin Panel</div>
          <div className="text-sm text-muted-foreground">
            Full system access and control
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasAnyRole([UserRole.ADMIN, UserRole.MANAGER])) {
    return (
      <Card className="border-blue-200">
        <CardContent className="pt-6">
          <div className="text-blue-600 font-medium">Management Panel</div>
          <div className="text-sm text-muted-foreground">
            Administrative and management features
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="font-medium">User Panel</div>
        <div className="text-sm text-muted-foreground">
          Standard user features
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Example: Login/Logout controls with error handling
 */
export function AuthControls() {
  const { isAuthenticated } = useAuth();
  const { login } = useLogin();
  const { logout } = useLogout();
  const [employeeId, setEmployeeId] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const result = await login(
      employeeId,
      password,
      () => {
        console.log('Login successful!');
        setEmployeeId('');
        setPassword('');
      },
      (message) => {
        setError(message);
      }
    );

    setIsLoading(false);
  };

  const handleLogout = async () => {
    await logout(
      false, // Don't skip confirmation
      () => console.log('Logout successful!'),
      (error) => console.error('Logout failed:', error)
    );
  };

  if (isAuthenticated) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Button onClick={handleLogout} variant="outline" className="w-full">
            Logout
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Login</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="text"
            placeholder="Employee ID"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full p-2 border rounded"
            disabled={isLoading}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            disabled={isLoading}
          />
          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Example: Permission checking with specific permissions
 */
export function SpecificPermissionCheck() {
  const { hasPermission, hasAnyPermission } = useAuth();

  const canManageUsers = hasPermission(Permission.MANAGE_USERS);
  const canViewLiveTracking = hasPermission(Permission.VIEW_LIVE_TRACKING);
  const hasAnalyticsAccess = hasAnyPermission([
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permission Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between">
          <span>Manage Users:</span>
          <Badge variant={canManageUsers ? "default" : "secondary"}>
            {canManageUsers ? "Allowed" : "Denied"}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>Live Tracking:</span>
          <Badge variant={canViewLiveTracking ? "default" : "secondary"}>
            {canViewLiveTracking ? "Allowed" : "Denied"}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span>Analytics Access:</span>
          <Badge variant={hasAnalyticsAccess ? "default" : "secondary"}>
            {hasAnalyticsAccess ? "Allowed" : "Denied"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Example: Debug information (development only)
 */
export function AuthDebugPanel() {
  const { debugInfo } = useAuthDebug();
  const [debugData, setDebugData] = React.useState<any>(null);

  const showDebugInfo = () => {
    setDebugData(debugInfo());
  };

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Debug Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={showDebugInfo} variant="outline">
          Get Debug Info
        </Button>
        {debugData && (
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(debugData, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Example: Complete authentication demo page
 */
export function AuthContextDemo() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Authentication Context Demo</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AuthStatusDisplay />
        <PermissionBasedUI />
        <RoleBasedComponent />
        <SpecificPermissionCheck />
        <AuthControls />
        <AuthDebugPanel />
      </div>
    </div>
  );
}

export default AuthContextDemo;
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { withPageErrorBoundary } from '@/components/ErrorBoundary';
import SyncStatusPanel from '@/components/sync/SyncStatusPanel';
import {
  User,
  Settings as SettingsIcon,
  LogOut,
  Shield,
  Smartphone,
  Wifi,
  Battery
} from 'lucide-react';

function Settings() {
  // Auth removed - no user context needed

  const handleLogout = async () => {
    // Auth removed - no logout needed
    console.log('Logout functionality removed');
  };

  // Auth removed - always show settings

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        {/* User Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Profile Info Grid - Mobile First */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                  <p className="text-base font-medium">{user.fullName || user.username}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Employee ID</label>
                  <p className="text-base font-mono">{user.employeeId || user.id}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Role</label>
                  <div className="flex items-center gap-2">
                    <Badge variant={user.role === 'super_admin' ? 'default' : 'secondary'}>
                      {user.role.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Active
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Permissions */}
            {permissions && permissions.length > 0 && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Permissions</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {permissions.slice(0, 6).map((permission) => (
                    <Badge key={permission} variant="outline" className="text-xs">
                      {permission.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                  ))}
                  {permissions.length > 6 && (
                    <Badge variant="outline" className="text-xs">
                      +{permissions.length - 6} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              <p>Logged in as {user.fullName || user.username}</p>
              <p className="text-xs">Session will expire automatically for security</p>
            </div>
          </CardContent>
        </Card>

        {/* System Features Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Battery className="h-5 w-5" />
              Battery & Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-800 dark:text-green-200">Optimization Active</span>
              </div>
              <Badge variant="outline" className="text-green-600 border-green-600 dark:text-green-400 dark:border-green-400">
                Enabled
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• GPS tracking optimized for battery life</p>
              <p>• Background app refresh managed</p>
              <p>• Location accuracy balanced with power usage</p>
              <p>• Automatic sleep mode when inactive</p>
            </div>
          </CardContent>
        </Card>

        {/* Device Info Section - Mobile Optimized */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Device Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <label className="text-muted-foreground">Platform</label>
                <p className="font-medium">{navigator.platform || 'Unknown'}</p>
              </div>
              <div>
                <label className="text-muted-foreground">User Agent</label>
                <p className="font-medium truncate" title={navigator.userAgent}>
                  {navigator.userAgent.split(' ')[0] || 'Unknown'}
                </p>
              </div>
              <div>
                <label className="text-muted-foreground">Language</label>
                <p className="font-medium">{navigator.language || 'Unknown'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Health Check Settings Section */}
        {(user.role === 'admin' || user.role === 'super_admin') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Health Check Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configure connectivity monitoring to optimize performance and reduce server load.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    // Open health check settings in a modal or navigate to dedicated page
                    const event = new CustomEvent('openHealthCheckSettings');
                    window.dispatchEvent(event);
                  }}
                  className="w-full sm:w-auto"
                >
                  <SettingsIcon className="h-4 w-4 mr-2" />
                  Configure Health Checks
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sign Out Section - At Bottom */}
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">Sign Out</h3>
                <p className="text-sm text-muted-foreground">
                  This will end your current session and return you to the login page
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={handleLogout}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default withPageErrorBoundary(Settings, 'Settings');
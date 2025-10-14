import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { withPageErrorBoundary } from '@/components/ErrorBoundary';
import SyncStatusPanel from '@/components/sync/SyncStatusPanel';
import { useAuth } from '@/hooks/useAuth';
import {
  User,
  Settings as SettingsIcon,
  LogOut,
  Shield,
  Smartphone,
  Wifi,
  Battery,
  Key,
  Mail,
  IdCard
} from 'lucide-react';

interface UserProfile {
  fullName: string;
  employeeId: string;
  role: string;
  isStaff: boolean;
  isSuperUser: boolean;
  isOpsTeam: boolean;
  accessToken: string;
  refreshToken: string;
}

function Settings() {
  const { user, logout } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    // Load user profile from localStorage
    const fullName = localStorage.getItem('full_name');
    const employeeId = localStorage.getItem('employee_id');
    const isStaff = localStorage.getItem('is_staff') === 'true';
    const isSuperUser = localStorage.getItem('is_super_user') === 'true';
    const isOpsTeam = localStorage.getItem('is_ops_team') === 'true';
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');

    if (fullName && employeeId) {
      setUserProfile({
        fullName,
        employeeId,
        role: user?.role || 'driver',
        isStaff,
        isSuperUser,
        isOpsTeam,
        accessToken: accessToken || '',
        refreshToken: refreshToken || ''
      });
    }
  }, [user]);

  const handleLogout = async () => {
    logout();
  };

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
                  <p className="text-base font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {userProfile?.fullName || user?.fullName || 'Not available'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Employee ID</label>
                  <p className="text-base font-mono flex items-center gap-2">
                    <IdCard className="h-4 w-4" />
                    {userProfile?.employeeId || user?.employeeId || 'Not available'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Role</label>
                  <Badge variant="secondary" className="capitalize">
                    {userProfile?.role || user?.role || 'driver'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Permissions</label>
                  <div className="flex flex-wrap gap-1">
                    {userProfile?.isSuperUser && (
                      <Badge variant="destructive" className="text-xs">Super User</Badge>
                    )}
                    {userProfile?.isOpsTeam && (
                      <Badge variant="default" className="text-xs">Ops Team</Badge>
                    )}
                    {userProfile?.isStaff && (
                      <Badge variant="secondary" className="text-xs">Staff</Badge>
                    )}
                    {!userProfile?.isSuperUser && !userProfile?.isOpsTeam && !userProfile?.isStaff && (
                      <Badge variant="outline" className="text-xs">Driver</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Authentication</label>
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {userProfile?.accessToken ? 'Token Active' : 'No Token'}
                    </span>
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


            {/* Additional User Info */}
            {user && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Account Details</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {user.role === 'admin' ? 'Administrator' : user.role}
                  </Badge>
                  {user.isSuperUser && (
                    <Badge variant="destructive" className="text-xs">Super User</Badge>
                  )}
                  {user.isOpsTeam && (
                    <Badge variant="default" className="text-xs">Ops Team</Badge>
                  )}
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              <p>Logged in as {user?.fullName || user?.username || 'Unknown User'}</p>
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
        {(user?.role === 'admin' || user?.isSuperUser) && (
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
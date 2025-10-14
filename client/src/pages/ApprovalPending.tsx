// client/src/pages/ApprovalPending.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useLocation } from 'wouter';

export const ApprovalPending: React.FC = () => {
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    // Clear localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('full_name');
    localStorage.removeItem('employee_id');
    localStorage.removeItem('is_staff');
    localStorage.removeItem('is_super_user');
    localStorage.removeItem('is_ops_team');

    // Redirect to login
    setLocation('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Clock className="mx-auto h-12 w-12 text-yellow-500" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Account Pending Approval
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your account is being reviewed by an administrator
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Registration Successful
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your account has been created successfully and is pending approval.
                You will be notified once an administrator approves your account.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <h3 className="font-medium">What happens next?</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• An administrator will review your account</li>
                <li>• You'll receive notification when approved</li>
                <li>• You can then log in and access the application</li>
              </ul>
            </div>

            <div className="pt-4">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full"
              >
                Return to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ApprovalPending;

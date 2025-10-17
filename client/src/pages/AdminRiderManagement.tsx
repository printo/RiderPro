import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import StandardPage from '@/components/layout/StandardPage';
import ResponsiveTable, { ResponsiveTableColumn } from '@/components/ui/ResponsiveTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { withPageErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { Plus, RefreshCw, Key, UserCheck, UserX } from 'lucide-react';

interface Rider {
  id: string;
  rider_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  is_super_user: boolean;
}

const AdminRiderManagement = () => {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'super_user' | null>(null);


  useEffect(() => {
    const fetchUserRole = async () => {
      // Get current user role from auth context
      if (user?.isSuperUser) {
        setCurrentUserRole('super_user');
      } else if (user?.isOpsTeam || user?.isStaff) {
        setCurrentUserRole('admin');
      } else {
        setCurrentUserRole(null);
      }
    };

    fetchUserRole();
  }, [user]);

  useEffect(() => {
    const fetchRiders = async () => {
      try {
        setIsLoading(true);
        const response = await apiRequest('GET', '/api/users');
        const data = await response.json();
        
        if (data.success && data.users) {
          setRiders(data.users);
        } else {
          setError(data.message || 'Failed to fetch riders');
        }
      } catch (err) {
        console.error('Error fetching riders:', err);
        setError('Failed to fetch riders');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRiders();
  }, []);

  const handleResetPassword = async (riderId: string) => {
    if (window.confirm('Are you sure you want to reset this rider\'s password?')) {
      try {
        const response = await apiRequest('POST', `/api/users/${riderId}/reset-password`);
        const data = await response.json();
        
        if (data.success) {
          alert('Password reset successful');
        } else {
          setError(data.message || 'Failed to reset password');
        }
      } catch (err) {
        console.error('Error resetting password:', err);
        setError('Failed to reset password');
      }
    }
  };

  const toggleUserStatus = async (riderId: string, currentStatus: boolean) => {
    try {
      const response = await apiRequest('PUT', `/api/users/${riderId}`, {
        is_active: !currentStatus
      });
      const data = await response.json();
      
      if (data.success) {
        setRiders(prevRiders =>
          prevRiders.map(rider =>
            rider.id === riderId ? { ...rider, is_active: !currentStatus } : rider
          )
        );
      } else {
        setError(data.message || 'Failed to update rider status');
      }
    } catch (err) {
      console.error('Error updating rider status:', err);
      setError('Failed to update rider status');
    }
  };

  const toggleSuperUserStatus = async (riderId: string, currentStatus: boolean) => {
    if (!currentUserRole || currentUserRole !== 'super_user') {
      setError('Only super users can modify admin privileges');
      return;
    }

    try {
      const response = await apiRequest('PUT', `/api/users/${riderId}`, {
        is_super_user: !currentStatus
      });
      const data = await response.json();
      
      if (data.success) {
        setRiders(prevRiders =>
          prevRiders.map(rider =>
            rider.id === riderId ? { ...rider, is_super_user: !currentStatus } : rider
          )
        );
      } else {
        setError(data.message || 'Failed to update admin privileges');
      }
    } catch (err) {
      console.error('Error updating admin privileges:', err);
      setError('Failed to update admin privileges');
    }
  };

  const filteredRiders = riders.filter(rider =>
    Object.values(rider).some(
      value =>
        value &&
        value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const columns: ResponsiveTableColumn<Rider>[] = [
    {
      key: 'rider_id',
      label: 'Rider ID',
      sortable: true,
      className: 'font-medium text-gray-900'
    },
    {
      key: 'full_name',
      label: 'Full Name',
      sortable: true,
      className: 'text-gray-500'
    },
    {
      key: 'email',
      label: 'Email',
      className: 'text-gray-500',
      render: (value) => value || 'N/A'
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (value) => (
        <span
          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
            value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {value ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      key: 'is_super_user',
      label: 'Role',
      render: (value) => (
        <span
          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
            value ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
          }`}
        >
          {value ? 'Super User' : 'Rider'}
        </span>
      )
    },
    {
      key: 'last_login_at',
      label: 'Last Login',
      className: 'text-gray-500',
      render: (value) => value ? new Date(value).toLocaleString() : 'Never'
    },
    {
      key: 'id',
      label: 'Actions',
      render: (_, rider) => (
        <div className="flex space-x-2 justify-end">
          <button
            onClick={() => handleResetPassword(rider.id)}
            className="text-blue-600 hover:text-blue-900 text-xs"
          >
            Reset Password
          </button>
          <button
            onClick={() => toggleUserStatus(rider.id, rider.is_active)}
            className={`ml-4 text-xs ${
              rider.is_active
                ? 'text-yellow-600 hover:text-yellow-900'
                : 'text-green-600 hover:text-green-900'
            }`}
          >
            {rider.is_active ? 'Deactivate' : 'Activate'}
          </button>
          {currentUserRole === 'super_user' && (
            <button
              onClick={() => toggleSuperUserStatus(rider.id, rider.is_super_user)}
              className={`ml-4 text-xs ${
                rider.is_super_user
                  ? 'text-red-600 hover:text-red-900'
                  : 'text-green-600 hover:text-green-900'
              }`}
            >
              {rider.is_super_user ? 'Remove Admin' : 'Make Admin'}
            </button>
          )}
        </div>
      )
    }
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <StandardPage
      title="User Management"
      subtitle="Approve riders and manage access"
      rightAction={(
        <Link
          to="/admin/riders/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Add Rider
        </Link>
      )}
    >
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}

      <ResponsiveTable
        data={filteredRiders}
        columns={columns}
        searchable
        searchPlaceholder="Search riders..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        emptyMessage="No riders found"
        loading={isLoading}
      />
    </StandardPage>
  );
};

export default AdminRiderManagement;

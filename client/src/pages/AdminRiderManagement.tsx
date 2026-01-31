import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Rider } from '@shared/types';

const AdminRiderManagement = () => {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'super_user' | null>(null);

  // Mock data for development
  const mockRiders: Rider[] = [
    {
      id: '1',
      rider_id: 'RID001',
      full_name: 'John Doe',
      email: 'john@example.com',
      is_active: true,
      is_super_user: false,
      created_at: '2023-10-14T10:30:00Z',
      last_login_at: '2023-10-14T15:45:00Z',
    },
    {
      id: '2',
      rider_id: 'RID002',
      full_name: 'Admin User',
      email: 'admin@example.com',
      is_active: true,
      is_super_user: true,
      created_at: '2023-10-14T10:30:00Z',
      last_login_at: '2023-10-14T15:45:00Z',
    },
  ];

  useEffect(() => {
    const fetchUserRole = async () => {
      // TODO: Fetch current user role from your auth context or API
      // This is a mock implementation
      const mockUserRole = 'super_user'; // or 'admin' based on your needs
      setCurrentUserRole(mockUserRole as 'admin' | 'super_user');
    };

    fetchUserRole();
  }, []);

  useEffect(() => {
    const fetchRiders = async () => {
      try {
        // TODO: Replace with actual API call
        // const response = await fetch('/api/v1/admin/riders');
        // const data = await response.json();
        // setRiders(data);

        // Using mock data for now
        setRiders(mockRiders);
        setIsLoading(false);
      } catch (_err) {
        setError('Failed to load riders');
        setIsLoading(false);
      }
    };

    fetchRiders();
  }, []);

  const handleResetPassword = async (riderId: string) => {
    if (window.confirm('Are you sure you want to reset this rider\'s password?')) {
      try {
        // TODO: Implement password reset API call
        console.log('Reset password for rider:', riderId);
        alert('Password reset link has been sent to the rider\'s email');
      } catch (_err) {
        setError('Failed to reset password');
      }
    }
  };

  const toggleUserStatus = async (riderId: string, currentStatus: boolean) => {
    try {
      // TODO: Implement status toggle API call
      console.log(`Toggling status for rider ${riderId} to ${!currentStatus}`);
      setRiders(prevRiders =>
        prevRiders.map(rider =>
          rider.id === riderId ? { ...rider, is_active: !currentStatus } : rider
        )
      );
    } catch (_err) {
      setError('Failed to update rider status');
    }
  };

  const toggleSuperUserStatus = async (riderId: string, currentStatus: boolean) => {
    if (!currentUserRole || currentUserRole !== 'super_user') {
      setError('Only super users can modify admin privileges');
      return;
    }

    try {
      // TODO: Implement super user toggle API call
      console.log(`Toggling super user status for rider ${riderId} to ${!currentStatus}`);
      setRiders(prevRiders =>
        prevRiders.map(rider =>
          rider.id === riderId ? { ...rider, is_super_user: !currentStatus } : rider
        )
      );
    } catch (_err) {
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">Rider Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            View and manage all rider accounts in the system.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Link
            to="/admin/riders/new"
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
          >
            Add Rider
          </Link>
        </div>
      </div>

      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="mb-4">
              <div className="relative mt-1 rounded-md shadow-sm max-w-md">
                <input
                  type="text"
                  className="block w-full rounded-md border-gray-300 pl-3 pr-10 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="Search riders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>

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

            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                      Rider ID
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Full Name
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Email
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Role
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Last Login
                    </th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredRiders.length > 0 ? (
                    filteredRiders.map((rider) => (
                      <tr key={rider.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {rider.rider_id}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {rider.full_name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {rider.email || 'N/A'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${rider.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                              }`}
                          >
                            {rider.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${rider.is_super_user
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                              }`}
                          >
                            {rider.is_super_user ? 'Super User' : 'Rider'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {rider.last_login_at
                            ? new Date(rider.last_login_at).toLocaleString()
                            : 'Never'}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div className="flex space-x-2 justify-end">
                            <button
                              onClick={() => handleResetPassword(rider.id)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Reset Password
                            </button>
                            <button
                              onClick={() =>
                                toggleUserStatus(rider.id, rider.is_active || false)
                              }
                              className={`ml-4 ${rider.is_active
                                ? 'text-yellow-600 hover:text-yellow-900'
                                : 'text-green-600 hover:text-green-900'
                                }`}
                            >
                              {rider.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            {currentUserRole === 'super_user' && (
                              <button
                                onClick={() =>
                                  toggleSuperUserStatus(rider.id, !!rider.is_super_user)
                                }
                                className={`ml-4 ${rider.is_super_user
                                  ? 'text-red-600 hover:text-red-900'
                                  : 'text-green-600 hover:text-green-900'
                                  }`}
                                title={rider.is_super_user ? 'Remove Super User' : 'Make Super User'}
                              >
                                {rider.is_super_user ? 'Remove Admin' : 'Make Admin'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-4 text-center text-sm text-gray-500"
                      >
                        No riders found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminRiderManagement;

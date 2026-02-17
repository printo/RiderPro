import React, { useState, useEffect } from 'react';
import { Rider } from '@shared/types';
import { apiClient } from '@/services/ApiClient';
import { API_ENDPOINTS } from '@/config/api';
import { HomebaseBadge } from '@/components/ui/HomebaseBadge';
import { HomebaseSelector } from '@/components/ui/HomebaseSelector';

interface CreateRiderForm {
  name: string;
  phone: string;
  rider_id: string;
  account_code: string;
  tags: string;
  homebaseId: number | string;
}

const AdminRiderManagement = () => {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateRiderForm>({
    name: '',
    phone: '',
    rider_id: '',
    account_code: '',
    tags: '',
    homebaseId: '',
  });

  useEffect(() => {
    // We'll use the HomebaseSelector which handles its own loading,
    // but we can still fetch them here if needed for initial state or other logic.
  }, []);

  useEffect(() => {
    fetchRiders();
  }, []);

  const handleResetPassword = async (riderId: string) => {
    if (window.confirm('Are you sure you want to reset this rider\'s password?')) {
      try {
        const response = await apiClient.post(API_ENDPOINTS.auth.resetPassword(riderId), {});
        const data = await response.json();

        if (data.success) {
          if (data.password) {
            alert(`Password reset successfully. New password: ${data.password}`);
          } else {
            alert('Password reset link has been sent to the rider\'s email');
          }
        } else {
          setError(data.message || 'Failed to reset password');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to reset password');
      }
    }
  };

  const toggleUserStatus = async (riderId: string, currentStatus: boolean) => {
    try {
      // Find the rider to get the correct endpoint (could be User or RiderAccount)
      const rider = riders.find(r => r.id === riderId);
      if (!rider) {
        setError('Rider not found');
        return;
      }

      // Use approve/reject endpoints or a status update endpoint
      // For now, we'll use the approve endpoint to activate and reject to deactivate
      const endpoint = !currentStatus
        ? API_ENDPOINTS.auth.approve(riderId)
        : API_ENDPOINTS.auth.reject(riderId);

      const response = await apiClient.post(endpoint, {});
      const data = await response.json();

      if (data.success) {
        // Refresh the riders list
        await fetchRiders();
      } else {
        setError(data.message || 'Failed to update rider status');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update rider status');
    }
  };

  // Removed toggleSuperUserStatus - riders should NEVER have superuser permissions

  const handleCreateRider = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsCreating(true);

    try {
      const response = await apiClient.post(API_ENDPOINTS.pops.createRider, createForm);
      const data = await response.json();

      if (data.success) {
        // Refresh riders list
        await fetchRiders();
        // Reset form and close modal
        setCreateForm({
          name: '',
          phone: '',
          rider_id: '',
          account_code: '',
          tags: '',
          homebaseId: '',
        });
        setShowCreateModal(false);
        alert('Rider created successfully in POPS!');
      } else {
        setError(data.message || 'Failed to create rider');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create rider. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const fetchRiders = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiClient.get(API_ENDPOINTS.auth.allUsers);
      const data = await response.json();

      if (data.success && data.users) {
        // Filter to show only riders (users with rider_id or role 'is_rider'/'is_driver')
        const riderUsers = data.users.filter((u: any) =>
          u.rider_id || u.role === 'is_rider' || u.role === 'is_driver' || u.role === 'driver'
        );

        // Map to Rider type format
        const mappedRiders: Rider[] = riderUsers.map((u: any) => ({
          id: u.id,
          rider_id: u.rider_id || u.employee_id || '',
          full_name: u.full_name || '',
          email: u.email || '',
          is_active: u.is_active !== false,
          created_at: u.created_at || '',
          last_login_at: u.last_login_at || '',
          primary_homebase_details: u.primary_homebase_details,
          dispatch_option: u.dispatch_option
        }));

        setRiders(mappedRiders);
      } else {
        setError(data.message || 'Failed to load riders');
        setRiders([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load riders');
      setRiders([]);
    } finally {
      setIsLoading(false);
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
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
          >
            Add Rider to POPS
          </button>
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
                      Homebase
                    </th>
                    {/* Removed Role column - riders are always just riders, never super users */}
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
                          {rider.primary_homebase_details && (
                            <HomebaseBadge homebase={rider.primary_homebase_details} className="text-xs" />
                          )}
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
      </div >

      {/* Create Rider Modal */}
      {
        showCreateModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create Rider in POPS</h3>
                <form onSubmit={handleCreateRider} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name *</label>
                    <input
                      type="text"
                      required
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Rider ID *</label>
                    <input
                      type="text"
                      required
                      value={createForm.rider_id}
                      onChange={(e) => setCreateForm({ ...createForm, rider_id: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input
                      type="text"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Homebase *</label>
                    <HomebaseSelector
                      value={createForm.homebaseId.toString()}
                      onValueChange={(value) => setCreateForm({ ...createForm, homebaseId: value })}
                      placeholder="Select Homebase"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tags (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g., printo-bike,goods-auto"
                      value={createForm.tags}
                      onChange={(e) => setCreateForm({ ...createForm, tags: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Account Code</label>
                    <input
                      type="text"
                      value={createForm.account_code}
                      onChange={(e) => setCreateForm({ ...createForm, account_code: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                  {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                      {error}
                    </div>
                  )}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setError('');
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                      disabled={isCreating}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isCreating ? 'Creating...' : 'Create Rider'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default AdminRiderManagement;

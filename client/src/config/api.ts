/**
 * API Configuration
 * Centralized API base URL management
 * Follows the pattern from printo-nextjs, printose, printose-admin-ui
 */

// API base URL - all API calls should use this
export const API_BASE_URL = '/api/v1';

/**
 * Helper function to build API URLs
 * @param path - API endpoint path (should start with /)
 * @returns Full API URL with base prefix
 */
export function apiUrl(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

/**
 * API Endpoints
 * Centralized endpoint definitions for type safety and consistency
 */
export const API_ENDPOINTS = {
  // Authentication
  auth: {
    login: apiUrl('/auth/login'),
    logout: apiUrl('/auth/logout'),
    register: apiUrl('/auth/register'),
    localLogin: apiUrl('/auth/local-login'),
    googleLogin: apiUrl('/auth/google/login'),
    requestOtp: apiUrl('/auth/request-otp'),
    verifyOtp: apiUrl('/auth/verify-otp'),
    refresh: apiUrl('/auth/refresh'),
    fetchRider: apiUrl('/auth/fetch-rider'),
    approve: (user_id: string) => apiUrl(`/auth/approve/${user_id}`),
    reject: (user_id: string) => apiUrl(`/auth/reject/${user_id}`),
    users: (user_id?: string) => apiUrl(user_id ? `/auth/users/${user_id}` : '/auth/users'),
    resetPassword: (user_id: string) => apiUrl(`/auth/reset-password/${user_id}`),
    pendingApprovals: apiUrl('/auth/pending-approvals'),
    allUsers: apiUrl('/auth/all-users'),
    syncRiders: apiUrl('/auth/riders/sync'),
    riderActiveOtp: (rider_id: string) => apiUrl(`/auth/riders/${rider_id}/active-otp`),
    archive: (user_id: string) => apiUrl(`/auth/users/${user_id}/archive`),
    restore: (user_id: string) => apiUrl(`/auth/users/${user_id}/restore`),
    // Vehicle (mileage) control & approval
    myVehicle: apiUrl('/auth/my-vehicle'),
    vehicleChangeRequest: apiUrl('/auth/vehicle-change-request'),
    pendingVehicleRequests: apiUrl('/auth/vehicle-change-requests/pending'),
    approveVehicleChange: (id: number) => apiUrl(`/auth/vehicle-change-requests/${id}/approve`),
    rejectVehicleChange: (id: number) => apiUrl(`/auth/vehicle-change-requests/${id}/reject`),
  },

  // Shipments
  shipments: {
    base: apiUrl('/shipments'),
    fetch: apiUrl('/shipments/fetch'),
    get: (shipment_id: string) => apiUrl(`/shipments/${shipment_id}`),
    create: apiUrl('/shipments/create'),
    update: (shipment_id: string) => apiUrl(`/shipments/${shipment_id}`),
    batch: apiUrl('/shipments/batch'),
    remarks: (shipment_id: string) => apiUrl(`/shipments/${shipment_id}/remarks`),
    acknowledgement: (shipment_id: string) => apiUrl(`/shipments/${shipment_id}/acknowledgement`),
    toggleCollectedStatus: (shipment_id: string) => apiUrl(`/shipments/${shipment_id}/toggle_collected_status/`),
    tracking: (shipment_id: string) => apiUrl(`/shipments/${shipment_id}/tracking`),
    receive: apiUrl('/shipments/receive'),
    updateExternal: apiUrl('/shipments/update/external'),
    updateExternalBatch: apiUrl('/shipments/update/external/batch'),
    sync: (shipment_id: string) => apiUrl(`/shipments/${shipment_id}/sync`),
    syncStatus: apiUrl('/shipments/sync-status'),
    batchSync: apiUrl('/shipments/batch-sync'),
    googleMapsRoute: apiUrl('/shipments/google-maps-route'),
  },

  // Dashboard
  dashboard: {
    metrics: apiUrl('/dashboard/metrics'),
  },

  // Routes
  routes: {
    start: apiUrl('/routes/start'),
    stop: apiUrl('/routes/stop'),
    coordinates: apiUrl('/routes/coordinates'),
    coordinatesBatch: apiUrl('/routes/coordinates/batch'),
    shipmentEvent: apiUrl('/routes/shipment-event'),
    session: (session_id: string) => apiUrl(`/routes/session/${session_id}`),
    syncSession: apiUrl('/routes/sync-session'),
    syncCoordinates: apiUrl('/routes/sync-coordinates'),
    trackLocation: apiUrl('/routes/track-location'),
    currentLocation: apiUrl('/routes/current-location'),
    activeRiders: apiUrl('/routes/active-riders'),
    active: (employee_id: string) => apiUrl(`/routes/active/${employee_id}`),
    analytics: apiUrl('/routes/analytics'),
    sessionSummary: (session_id: string) => apiUrl(`/routes/session/${session_id}/summary`),
    optimizePath: apiUrl('/routes/optimize_path'),
    roadPath: apiUrl('/routes/road-path'),
    dayPlan: apiUrl('/routes/day-plan'),
    overlapIgnore: apiUrl('/routes/overlap-ignore'),
  },

  // Vehicle Types
  vehicleTypes: {
    list: apiUrl('/vehicle-types'),
    get: (vehicle_id: string) => apiUrl(`/vehicle-types/${vehicle_id}`),
    create: apiUrl('/vehicle-types'),
    update: (vehicle_id: string) => apiUrl(`/vehicle-types/${vehicle_id}`),
    delete: (vehicle_id: string) => apiUrl(`/vehicle-types/${vehicle_id}`),
  },

  // Fuel Settings
  fuelSettings: {
    list: apiUrl('/fuel-settings'),
    get: (fuel_setting_id: string) => apiUrl(`/fuel-settings/${fuel_setting_id}`),
    create: apiUrl('/fuel-settings'),
    update: (fuel_setting_id: string) => apiUrl(`/fuel-settings/${fuel_setting_id}`),
    delete: (fuel_setting_id: string) => apiUrl(`/fuel-settings/${fuel_setting_id}`),
  },

  // Sync
  sync: {
    stats: apiUrl('/sync/stats'),
    trigger: apiUrl('/sync/trigger'),
    syncStatus: apiUrl('/sync/sync-status'),
    syncShipment: (shipment_id: string) => apiUrl(`/sync/shipments/${shipment_id}/sync`),
    batchSync: apiUrl('/sync/batch-sync'),
  },

  // Analytics
  analytics: {
    employees: apiUrl('/analytics/employees'),
    routes: apiUrl('/analytics/routes'),
    time: (groupBy: string) => apiUrl(`/analytics/time/${groupBy}`),
    fuel: apiUrl('/analytics/fuel'),
    topPerformers: (metric: string, limit: number) => apiUrl(`/analytics/top-performers/${metric}?limit=${limit}`),
    activityHourly: apiUrl('/analytics/activity/hourly'),
  },

  // Admin
  admin: {
    accessTokens: apiUrl('/admin/access-tokens'),
  },

  // POPS API Integration (proxied through RiderPro backend)
  pops: {
    homebases: apiUrl('/auth/pops/homebases'),
    createRider: apiUrl('/auth/pops/riders'),
  },
} as const;


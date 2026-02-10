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
    refresh: apiUrl('/auth/refresh'),
    fetchRider: apiUrl('/auth/fetch-rider'),
    approve: (userId: string) => apiUrl(`/auth/approve/${userId}`),
    reject: (userId: string) => apiUrl(`/auth/reject/${userId}`),
    users: (userId?: string) => apiUrl(userId ? `/auth/users/${userId}` : '/auth/users'),
    resetPassword: (userId: string) => apiUrl(`/auth/reset-password/${userId}`),
    pendingApprovals: apiUrl('/auth/pending-approvals'),
    allUsers: apiUrl('/auth/all-users'),
  },

  // Shipments
  shipments: {
    base: apiUrl('/shipments'),
    fetch: apiUrl('/shipments/fetch'),
    get: (id: string) => apiUrl(`/shipments/${id}`),
    create: apiUrl('/shipments/create'),
    update: (id: string) => apiUrl(`/shipments/${id}`),
    batch: apiUrl('/shipments/batch'),
    remarks: (id: string) => apiUrl(`/shipments/${id}/remarks`),
    acknowledgement: (id: string) => apiUrl(`/shipments/${id}/acknowledgement`),
    tracking: (id: string) => apiUrl(`/shipments/${id}/tracking`),
    receive: apiUrl('/shipments/receive'),
    updateExternal: apiUrl('/shipments/update/external'),
    updateExternalBatch: apiUrl('/shipments/update/external/batch'),
    sync: (id: string) => apiUrl(`/shipments/${id}/sync`),
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
    session: (sessionId: string) => apiUrl(`/routes/session/${sessionId}`),
    syncSession: apiUrl('/routes/sync-session'),
    syncCoordinates: apiUrl('/routes/sync-coordinates'),
    trackLocation: apiUrl('/routes/track-location'),
    currentLocation: apiUrl('/routes/current-location'),
    activeRiders: apiUrl('/routes/active-riders'),
    active: (employeeId: string) => apiUrl(`/routes/active/${employeeId}`),
    analytics: apiUrl('/routes/analytics'),
    sessionSummary: (sessionId: string) => apiUrl(`/routes/session/${sessionId}/summary`),
  },

  // Vehicle Types
  vehicleTypes: {
    list: apiUrl('/vehicle-types'),
    get: (id: string) => apiUrl(`/vehicle-types/${id}`),
    create: apiUrl('/vehicle-types'),
    update: (id: string) => apiUrl(`/vehicle-types/${id}`),
    delete: (id: string) => apiUrl(`/vehicle-types/${id}`),
  },

  // Fuel Settings
  fuelSettings: {
    list: apiUrl('/fuel-settings'),
    get: (id: string) => apiUrl(`/fuel-settings/${id}`),
    create: apiUrl('/fuel-settings'),
    update: (id: string) => apiUrl(`/fuel-settings/${id}`),
    delete: (id: string) => apiUrl(`/fuel-settings/${id}`),
  },

  // Sync
  sync: {
    stats: apiUrl('/sync/stats'),
    trigger: apiUrl('/sync/trigger'),
    syncStatus: apiUrl('/sync/sync-status'),
    syncShipment: (shipmentId: string) => apiUrl(`/sync/shipments/${shipmentId}/sync`),
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


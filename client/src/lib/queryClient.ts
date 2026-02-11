import { QueryClient } from '@tanstack/react-query';
import { apiClient, ApiRequestConfig } from '@/services/ApiClient';
import { log } from "../utils/logger.js";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

/**
 * Enhanced API request function using the unified ApiClient
 * Provides automatic token refresh, retry logic, and comprehensive error handling
 */
export const apiRequest = async (
  method: string,
  url: string,
  data?: unknown
): Promise<Response> => {
  log.dev('🌐 apiRequest called:', {
    method: method.toUpperCase(),
    url,
    hasData: !!data,
    skipAuth: url.includes('/auth/'),
    timestamp: new Date().toISOString()
  });

  // Only skip auth for public authentication endpoints (login, register, refresh)
  // Other /auth/ endpoints like pending-approvals, all-users require authentication
  const publicAuthEndpoints = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/local-login'];
  const isPublicEndpoint = publicAuthEndpoints.some(endpoint => url.includes(endpoint));

  const config: ApiRequestConfig = {
    url,
    method: method.toUpperCase() as ApiRequestConfig['method'],
    data,
    skipAuth: isPublicEndpoint,
  };

  try {
    const response = await apiClient.request(config);

    log.dev('✅ apiRequest response:', {
      method: method.toUpperCase(),
      url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    return response;
  } catch (error) {
    console.error('❌ apiRequest error:', {
      method: method.toUpperCase(),
      url,
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }
};

export default queryClient;
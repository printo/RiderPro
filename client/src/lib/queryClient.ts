import { QueryClient } from '@tanstack/react-query';
import { apiClient, ApiRequestConfig } from '@/services/ApiClient';

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
  data?: any
): Promise<Response> => {
  const config: ApiRequestConfig = {
    url,
    method: method.toUpperCase() as ApiRequestConfig['method'],
    data,
    skipAuth: url.includes('/auth/'), // Skip auth for auth endpoints
  };

  return apiClient.request(config);
};

export default queryClient;
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
  console.log('🌐 apiRequest called:', {
    method: method.toUpperCase(),
    url,
    hasData: !!data,
    skipAuth: url.includes('/auth/'),
    timestamp: new Date().toISOString()
  });

  const config: ApiRequestConfig = {
    url,
    method: method.toUpperCase() as ApiRequestConfig['method'],
    data,
    skipAuth: url.includes('/auth/'), // Skip auth for auth endpoints
  };

  try {
    const response = await apiClient.request(config);

    console.log('✅ apiRequest response:', {
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
import { QueryClient } from '@tanstack/react-query';
import authService from '@/services/AuthService';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export const apiRequest = async (
  method: string,
  url: string,
  data?: any
): Promise<Response> => {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authService.getAuthHeaders(),
    },
    credentials: 'include',
  };

  if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  let response = await fetch(url, options);

  if (!response.ok) {
    if (response.status === 401) {
      const refreshed = await authService.refreshAccessToken();
      if (refreshed) {
        const retryOptions: RequestInit = {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...authService.getAuthHeaders(),
          },
        };
        response = await fetch(url, retryOptions);
        if (response.ok) return response;
      }
    }
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response;
};

export default queryClient;
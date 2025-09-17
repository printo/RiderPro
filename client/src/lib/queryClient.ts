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
  try {
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

    console.log(`API Request: ${method} ${url}`, { options });
    let response = await fetch(url, options);
    
    // Clone the response to read it multiple times if needed
    const responseClone = response.clone();
    
    // Log response for debugging
    console.log(`API Response (${response.status}):`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      url: response.url,
    });

    if (!response.ok) {
      // Try to parse error response
      let errorData;
      try {
        errorData = await responseClone.json().catch(() => ({}));
      } catch (e) {
        errorData = await responseClone.text().catch(() => ({}));
      }
      
      console.error('API Error:', {
        url,
        status: response.status,
        statusText: response.statusText,
        errorData,
      });

      if (response.status === 401) {
        console.log('Attempting to refresh access token...');
        const refreshed = await authService.refreshAccessToken();
        if (refreshed) {
          console.log('Token refreshed, retrying request...');
          const retryOptions: RequestInit = {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              ...authService.getAuthHeaders(),
            },
          };
          const retryResponse = await fetch(url, retryOptions);
          if (retryResponse.ok) {
            console.log('Retry successful');
            return retryResponse;
          }
        }
        // If we get here, refresh failed or retry failed
        throw new Error('Session expired. Please log in again.');
      }

      // Handle other error statuses
      const errorMessage = errorData?.message || 
                         errorData?.error || 
                         response.statusText || 
                         'Unknown error occurred';
      
      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).data = errorData;
      throw error;
    }

    return response;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

export default queryClient;
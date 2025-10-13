// client/src/examples/ApiClientUsage.ts
// Example usage of the new unified API client

import { apiClient, ApiError } from '../services/ApiClient';

/**
 * Example: Making a simple GET request
 */
export async function fetchShipments() {
  try {
    const response = await apiClient.get('/api/shipments');
    const data = await response.json();
    return data;
  } catch (error) {
    const apiError = error as ApiError;

    if (apiError.isNetworkError) {
      console.error('Network error:', apiError.message);
      // Show network error UI
    } else if (apiError.isAuthError) {
      console.error('Authentication error:', apiError.message);
      // User will be redirected to login automatically
    } else {
      console.error('API error:', apiError.message);
      // Show generic error UI
    }

    throw error;
  }
}

/**
 * Example: Making a POST request with data
 */
export async function createShipment(shipmentData: any) {
  try {
    const response = await apiClient.post('/api/shipments', shipmentData);
    const data = await response.json();
    return data;
  } catch (error) {
    const apiError = error as ApiError;

    if (apiError.status === 422) {
      // Validation error - show field-specific errors
      console.error('Validation errors:', apiError.data);
      return { success: false, errors: apiError.data };
    }

    throw error;
  }
}

/**
 * Example: Using the legacy apiRequest function (still works)
 */
export async function legacyApiCall() {
  // This still works for backward compatibility
  const { apiRequest } = await import('../lib/queryClient');

  try {
    const response = await apiRequest('GET', '/api/dashboard');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Legacy API call failed:', error);
    throw error;
  }
}

/**
 * Example: Handling different error types with comprehensive error information
 */
export async function handleDifferentErrors() {
  try {
    const response = await apiClient.get('/api/some-endpoint');
    return await response.json();
  } catch (error) {
    const apiError = error as ApiError;

    // Log comprehensive error information for debugging
    console.log('API Error Details:', {
      message: apiError.userFriendlyMessage || apiError.message,
      type: apiError.errorType,
      status: apiError.status,
      isRetryable: apiError.isRetryable,
      timestamp: apiError.timestamp,
      context: apiError.context,
      recoverySuggestions: apiError.recoverySuggestions
    });

    switch (true) {
      case apiError.isNetworkError:
        // Network issues - show retry button with recovery suggestions
        console.log('Network error - user can retry');
        console.log('Recovery suggestions:', apiError.recoverySuggestions);
        break;

      case apiError.isAuthError:
        // Auth issues - user will be redirected automatically
        console.log('Auth error - redirecting to login');
        if (apiError.status === 403) {
          console.log('Permission denied - contact administrator');
        }
        break;

      case apiError.status === 429:
        // Rate limiting - show wait message
        console.log('Rate limited - please wait');
        console.log('Suggestions:', apiError.recoverySuggestions);
        break;

      case apiError.status && apiError.status >= 500:
        // Server errors - show maintenance message
        console.log('Server error - try again later');
        console.log('Error type:', apiError.errorType);
        break;

      default:
        // Other errors - show generic message with recovery suggestions
        console.log('Error:', apiError.userFriendlyMessage || apiError.message);
        if (apiError.recoverySuggestions?.length) {
          console.log('Try these solutions:', apiError.recoverySuggestions);
        }
        break;
    }

    throw error;
  }
}

/**
 * Example: Using with React Query
 */
export function useShipmentsWithNewClient() {
  // This would work with React Query
  return {
    queryKey: ['shipments'],
    queryFn: async () => {
      const response = await apiClient.get('/api/shipments');
      return response.json();
    },
    // React Query will handle retries, but our client also has built-in retry logic
    retry: (failureCount: number, error: any) => {
      const apiError = error as ApiError;

      // Don't retry auth errors (user will be redirected)
      if (apiError.isAuthError) {
        return false;
      }

      // Don't retry validation errors
      if (apiError.status === 422) {
        return false;
      }

      // Let React Query handle other retries
      return failureCount < 3;
    }
  };
}
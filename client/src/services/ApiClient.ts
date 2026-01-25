// client/src/services/ApiClient.ts
import AuthService from './AuthService';
import { log } from "../utils/logger.js";
import { ErrorType } from '@shared/types';
import type { 
  ApiRequestConfig, 
  ApiError, 
  ErrorContext 
} from '@shared/types';

export { ErrorType };
export type {
  ApiRequestConfig, 
  ApiError, 
  ErrorContext 
};

export class ApiClient {
  private static instance: ApiClient;
  private readonly MAX_RETRY_COUNT = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private refreshInProgress = false;
  private refreshAttemptTimestamp = 0;
  private readonly REFRESH_COOLDOWN = 5000; // 5 seconds cooldown between refresh attempts
  private readonly BASE_URL = '';
  private pendingRequests: Array<{
    config: ApiRequestConfig;
    resolve: (response: Response) => void;
    reject: (error: ApiError) => void;
  }> = [];

  // Network resilience properties
  private isOffline = false;
  private offlineDetectionEnabled = true;
  private lastKnownAuthState: unknown = null;
  private networkRetryQueue: Array<{
    config: ApiRequestConfig;
    resolve: (response: Response) => void;
    reject: (error: ApiError) => void;
    timestamp: number;
  }> = [];
  private readonly OFFLINE_RETRY_DELAY = 5000; // 5 seconds
  private readonly MAX_OFFLINE_QUEUE_SIZE = 50;
  private readonly OFFLINE_QUEUE_TTL = 5 * 60 * 1000; // 5 minutes
  private offlineCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeNetworkMonitoring();
    this.loadLastKnownAuthState();
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * Main request method with automatic token refresh and retry logic
   */
  public async request(config: ApiRequestConfig): Promise<Response> {
    const { url, method, data, skipAuth = false, retryCount = 0, headers = {} } = config;

    // Construct full URL
    const fullUrl = url.startsWith('http') ? url : `${this.BASE_URL}${url}`;

    // Skip logging for auth-related requests to prevent log spam
    const isAuthRequest = url.includes('/auth/');

    if (!isAuthRequest) {
      log.dev(`[ApiClient] ${method} ${fullUrl}`, data ? { data } : '');
    }

    try {
      // Build request options
      const requestOptions = this.buildRequestOptions(method, data, skipAuth, headers);

      // Make the request
      const response = await fetch(fullUrl, requestOptions);

      // Handle 401 errors with automatic token refresh
      if (response.status === 401 && !isAuthRequest && !skipAuth) {
        return await this.handleUnauthorized(config);
      }

      // Log response for debugging
      if (!isAuthRequest) {
        log.dev(`[ApiClient] Response (${response.status}):`, {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
        });
      }

      // Handle non-2xx responses
      if (!response.ok) {
        await this.handleErrorResponse(response, url, method, isAuthRequest);
      }

      return response;

    } catch (error) {
      console.error('[ApiClient] Request Error:', error);

      // Create error context for comprehensive logging
      const errorContext = this.createErrorContext(config);

      // Determine if this is a network error
      const isNetworkError = this.isNetworkError(error);

      // Create enhanced error object with context
      const apiError = this.createApiError(error, {
        isNetworkError,
        context: errorContext
      });

      // Handle offline scenarios
      if (isNetworkError && this.isOffline) {
        log.dev('[ApiClient] Request failed while offline, queuing for retry');

        return new Promise((resolve, reject) => {
          this.queueForOfflineRetry(config, resolve, reject);
        });
      }

      // Use enhanced retry logic with exponential backoff
      if (apiError.isRetryable && retryCount < this.MAX_RETRY_COUNT) {
        log.dev(`[ApiClient] Retryable error detected, using enhanced retry logic`);
        return this.retryWithExponentialBackoff(config, apiError, retryCount);
      }

      throw apiError;
    }
  }

  /**
   * Handle 401 unauthorized responses with token refresh
   */
  private async handleUnauthorized(config: ApiRequestConfig): Promise<Response> {
    // If refresh is already in progress, queue this request
    if (this.refreshInProgress) {
      return new Promise((resolve, reject) => {
        this.pendingRequests.push({ config, resolve, reject });
      });
    }

    // Enhanced infinite loop prevention - check cooldown period
    const now = Date.now();
    if (now - this.refreshAttemptTimestamp < this.REFRESH_COOLDOWN) {
      console.warn('[ApiClient] Token refresh attempted too soon, applying cooldown');
      const cooldownError = this.createApiError(
        new Error('Token refresh rate limited. Please wait a moment and try again.'),
        {
          status: 429,
          isAuthError: true,
          context: this.createErrorContext(config)
        }
      );
      throw cooldownError;
    }

    this.refreshInProgress = true;
    this.refreshAttemptTimestamp = now;

    try {
      log.dev('[ApiClient] Access token expired, attempting to refresh...');
      const refreshed = await AuthService.getInstance().refreshAccessToken();

      if (refreshed) {
        // Process pending requests with new token
        await this.processPendingRequests();

        // Retry the original request with new token
        return await this.retryWithNewToken(config);
      } else {
        // Refresh failed, reject all pending requests
        this.rejectPendingRequests(new Error('Session expired. Please log in again.'));

        // Only logout and redirect if we're not already on the login page
        if (!window.location.pathname.includes('/login')) {
          log.dev('[ApiClient] Session expired, redirecting to login...');
          AuthService.getInstance().logout();
          // Add a small delay to prevent immediate redirect
          setTimeout(() => {
            window.location.href = '/login';
          }, 500);
        }

        const logoutError = this.createApiError(
          new Error('Your session has expired. Please log in again to continue.'),
          {
            status: 401,
            isAuthError: true,
            context: this.createErrorContext(config)
          }
        );

        throw logoutError;
      }
    } catch (refreshError) {
      console.error('[ApiClient] Token refresh failed:', refreshError);

      // Reject all pending requests
      this.rejectPendingRequests(refreshError);

      // Clear auth state and redirect only if not on login page
      if (!window.location.pathname.includes('/login')) {
        AuthService.getInstance().logout();
        window.location.href = '/login';
      }

      // Determine if this is a network error or auth error
      const isNetworkError = this.isNetworkError(refreshError);
      const errorMessage = isNetworkError
        ? 'Unable to refresh your session due to network issues. Please check your connection and try again.'
        : 'Your session has expired. Please log in again to continue.';

      const enhancedError = this.createApiError(refreshError, {
        status: 401,
        isAuthError: !isNetworkError,
        isNetworkError,
        context: this.createErrorContext(config)
      });

      // Override message for better user experience
      enhancedError.message = errorMessage;

      // Handle different logout scenarios based on error type
      if (!isNetworkError) {
        await this.performGracefulLogout('Authentication failed - token refresh error');
      } else {
        // For network errors, don't logout but clear refresh state
        this.refreshInProgress = false;
        this.refreshAttemptTimestamp = 0;
        log.dev('[ApiClient] Network error during token refresh - preserving session');
      }

      throw enhancedError;
    } finally {
      this.refreshInProgress = false;
    }
  }

  /**
   * Retry request with new token after successful refresh
   */
  private async retryWithNewToken(config: ApiRequestConfig): Promise<Response> {
    log.dev('[ApiClient] Retrying request with new token...');

    // Prevent infinite retry loops by marking this as a retry
    const retryConfig = {
      ...config,
      skipAuth: false, // Ensure we use the new token
      retryCount: (config.retryCount || 0) + 1
    };

    // Enhanced infinite loop prevention - check for auth retry specifically
    if (retryConfig.retryCount > this.MAX_RETRY_COUNT) {
      const error = this.createApiError(new Error('Maximum authentication retry attempts exceeded'), {
        status: 401,
        isAuthError: true,
        context: this.createErrorContext(config)
      });

      // Log detailed information for debugging infinite loops
      console.error('[ApiClient] Infinite loop prevention triggered:', {
        url: config.url,
        method: config.method,
        retryCount: retryConfig.retryCount,
        maxRetries: this.MAX_RETRY_COUNT,
        refreshInProgress: this.refreshInProgress
      });

      throw error;
    }

    return this.request(retryConfig);
  }

  /**
   * Process all pending requests after successful token refresh
   */
  private async processPendingRequests(): Promise<void> {
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];

    for (const { config, resolve, reject } of requests) {
      try {
        const response = await this.retryWithNewToken(config);
        resolve(response);
      } catch (error) {
        reject(error as ApiError);
      }
    }
  }

  /**
   * Reject all pending requests with the given error
   */
  private rejectPendingRequests(error: unknown): void {
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];

    const apiError = this.createApiError(error, { isAuthError: true });

    for (const { reject } of requests) {
      reject(apiError);
    }
  }

  /**
   * Build request options with proper headers and authentication
   */
  private buildRequestOptions(
    method: string,
    data?: unknown,
    skipAuth = false,
    additionalHeaders: Record<string, string> = {}
  ): RequestInit {
    const headers: Record<string, string> = {
      ...additionalHeaders,
    };

    // Handle different data types
    let body: BodyInit | null | undefined;
    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      if (data instanceof FormData) {
        // For FormData, don't set Content-Type - browser will set it with boundary
        body = data;
      } else {
        // For regular data, use JSON
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(data);
      }
    } else if (!data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      // For requests without data, still set Content-Type
      headers['Content-Type'] = 'application/json';
    }

    // Add authentication headers if not skipped
    if (!skipAuth) {
      const authHeaders = AuthService.getInstance().getAuthHeaders();
      Object.assign(headers, authHeaders);
    }

    const options: RequestInit = {
      method,
      headers,
      credentials: 'include', // Important for cookies
    };

    if (body !== undefined) {
      options.body = body;
    }

    return options;
  }

  /**
   * Handle error responses and create appropriate error objects
   */
  private async handleErrorResponse(
    response: Response,
    url: string,
    method: string,
    isAuthRequest: boolean
  ): Promise<never> {
    // Try to parse error response
    let errorData: unknown;
    try {
      const responseClone = response.clone();
      errorData = await responseClone.json().catch(async () => {
        return await responseClone.text().catch(() => ({}));
      });
    } catch (_e) {
      errorData = {};
    }

    // Log detailed error info for non-auth requests
    if (!isAuthRequest) {
      console.error(`[ApiClient] ${response.status} ${response.statusText}`, {
        url,
        method,
        status: response.status,
        statusText: response.statusText,
        errorData,
      });
    }

    // Create error message
    const typedErrorData = errorData as { message?: string; error?: string } | null;
    const errorMessage = typedErrorData?.message ||
      typedErrorData?.error ||
      response.statusText ||
      'Unknown error occurred';

    // Create error context
    const errorContext: ErrorContext = {
      url,
      method,
      retryCount: 0, // This will be updated by the caller if needed
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
    };

    // Create and throw enhanced error
    const error = this.createApiError(new Error(errorMessage), {
      status: response.status,
      data: errorData,
      isAuthError: response.status === 401 || response.status === 403,
      context: errorContext
    });

    throw error;
  }

  /**
   * Create enhanced API error with additional metadata
   */
  private createApiError(
    originalError: unknown,
    metadata: {
      status?: number;
      data?: unknown;
      isNetworkError?: boolean;
      isAuthError?: boolean;
      context?: Partial<ErrorContext>;
    } = {}
  ): ApiError {
    // Classify the error type
    const errorType = this.classifyError(originalError, metadata.status);

    // Generate user-friendly message
    const message = originalError instanceof Error ? originalError.message : 'API request failed';
    const userFriendlyMessage = this.generateUserFriendlyMessage(
      errorType,
      message,
      metadata.status,
      metadata.context
    );

    // Create enhanced error object
    const error = new Error(userFriendlyMessage) as ApiError;

    // Copy properties from original error
    if (originalError instanceof Error && originalError.stack) {
      error.stack = originalError.stack;
    }

    // Add comprehensive metadata
    error.status = metadata.status;
    error.data = metadata.data;
    error.isNetworkError = metadata.isNetworkError || errorType === ErrorType.NETWORK_ERROR;
    error.isAuthError = metadata.isAuthError || errorType === ErrorType.AUTH_ERROR;
    error.isRetryable = this.isRetryableError(errorType, metadata.status, metadata.context?.retryCount);
    error.originalError = originalError;
    error.errorType = errorType;
    error.context = metadata.context as ErrorContext;
    error.timestamp = Date.now();
    error.userFriendlyMessage = userFriendlyMessage;
    error.recoverySuggestions = this.getRecoverySuggestions(errorType, metadata.status, metadata.context);

    // Log error for debugging
    if (metadata.context) {
      this.logError(error, errorType, metadata.context as ErrorContext);
    }

    return error;
  }

  /**
   * Determine if an error is a network error with comprehensive detection
   */
  private isNetworkError(error: unknown): boolean {
    // Check if browser is offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return true;
    }

    if (error instanceof Error) {
      // Common network error indicators
      const errorWithCode = error as Error & { code?: string };
      if (
        error instanceof TypeError ||
        error.name === 'TypeError' ||
        error.name === 'NetworkError' ||
        errorWithCode.code === 'NETWORK_ERROR' ||
        errorWithCode.code === 'ENOTFOUND' ||
        errorWithCode.code === 'ECONNREFUSED' ||
        errorWithCode.code === 'ETIMEDOUT'
      ) {
        return true;
      }

      // Check error messages for network-related keywords
      const errorMessage = (error.message || '').toLowerCase();
      const networkKeywords = [
        'fetch',
        'network',
        'failed to fetch',
        'connection',
        'timeout',
        'unreachable',
        'dns',
        'offline',
        'no internet',
        'connection refused',
        'connection reset',
        'connection aborted'
      ];

      return networkKeywords.some(keyword => errorMessage.includes(keyword));
    }

    return false;
  }

  /**
   * Perform graceful logout with proper cleanup and user notification
   */
  private async performGracefulLogout(reason: string): Promise<void> {
    try {
      log.dev(`[ApiClient] Performing graceful logout: ${reason}`);

      // Show countdown warning before logout
      this.showCountdownWarning(reason);

      // Countdown for 3 seconds
      for (let i = 3; i > 0; i--) {
        await this.sleep(1000);
        this.updateCountdownMessage(i);
      }

      // Clear authentication state
      AuthService.getInstance().logout();

      // Clear any pending requests
      this.rejectPendingRequests(new Error('Session expired during logout'));

      // Reset refresh state
      this.refreshInProgress = false;
      this.refreshAttemptTimestamp = 0;

      // Hide countdown notification
      this.hideCountdownNotification();

      // Only redirect to login page if we're not already on the login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }

    } catch (error) {
      console.error('[ApiClient] Error during graceful logout:', error);

      // Force cleanup even if logout fails
      this.rejectPendingRequests(new Error('Forced logout due to error'));
      this.refreshInProgress = false;
      this.refreshAttemptTimestamp = 0;

      // Force redirect even if logout fails, but only if not on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
  }

  /**
   * Show user-friendly logout notification
   */
  private showLogoutNotification(reason: string): void {
    try {
      // Try to show a toast notification if available
      interface CustomWindow extends Window {
        showToast?: (options: { type: string; message: string; duration: number }) => void;
      }
      
      const customWindow = typeof window !== 'undefined' ? window as unknown as CustomWindow : null;

      if (customWindow?.showToast) {
        customWindow.showToast({
          type: 'warning',
          message: 'Your session has expired. Please log in again.',
          duration: 5000
        });
      } else {
        // Fallback to console log
        console.warn(`Session expired: ${reason}`);
      }
    } catch (error) {
      console.error('[ApiClient] Failed to show logout notification:', error);
    }
  }

  /**
   * Show countdown warning notification
   */
  private showCountdownWarning(reason: string): void {
    try {
      // Create a countdown notification element
      const notification = document.createElement('div');
      notification.id = 'logout-countdown-notification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc2626;
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
      `;

      // Add CSS animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);

      notification.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">Session Expiring</div>
        <div style="margin-bottom: 8px;">${reason}</div>
        <div style="font-size: 12px; opacity: 0.9;">Logging out in <span id="countdown-timer">3</span> seconds...</div>
      `;

      document.body.appendChild(notification);
    } catch (error) {
      console.error('[ApiClient] Failed to show countdown warning:', error);
    }
  }

  /**
   * Update countdown timer
   */
  private updateCountdownMessage(seconds: number): void {
    try {
      const timerElement = document.getElementById('countdown-timer');
      if (timerElement) {
        timerElement.textContent = seconds.toString();
      }
    } catch (error) {
      console.error('[ApiClient] Failed to update countdown message:', error);
    }
  }

  /**
   * Hide countdown notification
   */
  private hideCountdownNotification(): void {
    try {
      const notification = document.getElementById('logout-countdown-notification');
      if (notification) {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    } catch (error) {
      console.error('[ApiClient] Failed to hide countdown notification:', error);
    }
  }

  /**
   * Classify error type based on status code and error characteristics
   */
  private classifyError(error: unknown, status?: number): ErrorType {
    // Network errors
    if (this.isNetworkError(error)) {
      return ErrorType.NETWORK_ERROR;
    }

    // Status code based classification
    if (status) {
      if (status === 401 || status === 403) {
        return ErrorType.AUTH_ERROR;
      }
      if (status >= 400 && status < 500) {
        return status === 422 ? ErrorType.VALIDATION_ERROR : ErrorType.CLIENT_ERROR;
      }
      if (status >= 500) {
        return ErrorType.SERVER_ERROR;
      }
    }

    // Timeout errors
    if (error instanceof Error && (error.name === 'AbortError' || error.message?.includes('timeout'))) {
      return ErrorType.TIMEOUT_ERROR;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * Generate user-friendly error messages based on error type and context
   */
  private generateUserFriendlyMessage(
    errorType: ErrorType,
    originalMessage: string,
    status?: number,
    context?: Partial<ErrorContext>
  ): string {
    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
        return 'Unable to connect to the server. Please check your internet connection and try again.';

      case ErrorType.AUTH_ERROR:
        if (status === 401) {
          // Distinguish between different 401 scenarios
          if (context?.url?.includes('/auth/refresh')) {
            return 'Your session has expired and could not be renewed. Please log in again.';
          }
          return 'Your session has expired. Please log in again to continue.';
        }
        if (status === 403) {
          return 'You do not have permission to perform this action. Please contact your administrator if you believe this is an error.';
        }
        return 'Authentication failed. Please log in again.';

      case ErrorType.VALIDATION_ERROR:
        return originalMessage || 'The information provided is invalid. Please check your input and try again.';

      case ErrorType.SERVER_ERROR:
        // Provide more specific messages for different server errors
        if (status === 500) {
          return 'The server encountered an internal error. Please try again in a few moments.';
        }
        if (status === 502 || status === 503) {
          return 'The server is temporarily unavailable. Please try again in a few moments.';
        }
        if (status === 504) {
          return 'The server request timed out. Please try again.';
        }
        return 'The server is currently experiencing issues. Please try again in a few moments.';

      case ErrorType.CLIENT_ERROR:
        if (status === 404) {
          return 'The requested resource was not found.';
        }
        if (status === 409) {
          return 'There was a conflict with your request. The resource may have been modified by another user.';
        }
        if (status === 429) {
          return 'Too many requests. Please wait a moment before trying again.';
        }
        return originalMessage || 'There was an issue with your request. Please try again.';

      case ErrorType.TIMEOUT_ERROR:
        return 'The request timed out. Please check your connection and try again.';

      default:
        return originalMessage || 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Determine if an error is retryable based on its type and context
   */
  private isRetryableError(errorType: ErrorType, status?: number, retryCount = 0): boolean {
    // Don't retry if we've already retried too many times
    if (retryCount >= this.MAX_RETRY_COUNT) {
      return false;
    }

    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
      case ErrorType.TIMEOUT_ERROR:
        return true;

      case ErrorType.SERVER_ERROR:
        // Retry 500, 502, 503, 504 errors
        return status ? [500, 502, 503, 504].includes(status) : true;

      case ErrorType.CLIENT_ERROR:
        // Retry 429 (rate limit) errors
        return status === 429;

      case ErrorType.AUTH_ERROR:
      case ErrorType.VALIDATION_ERROR:
      default:
        return false;
    }
  }

  /**
   * Create error context for debugging and logging
   */
  private createErrorContext(config: ApiRequestConfig): ErrorContext {
    return {
      url: config.url,
      method: config.method,
      retryCount: config.retryCount || 0,
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
    };
  }

  /**
   * Log error details for debugging and monitoring
   */
  private logError(
    error: ApiError,
    errorType: ErrorType,
    context: ErrorContext
  ): void {
    const logData = {
      type: errorType,
      message: error.message,
      status: error.status,
      url: context.url,
      method: context.method,
      retryCount: context.retryCount,
      timestamp: new Date(context.timestamp).toISOString(),
      isNetworkError: error.isNetworkError,
      isAuthError: error.isAuthError,
      isRetryable: error.isRetryable,
      stack: error.stack
    };

    // Use appropriate log level based on error type
    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
      case ErrorType.TIMEOUT_ERROR:
        console.warn('[ApiClient] Network/Timeout Error:', logData);
        break;

      case ErrorType.AUTH_ERROR:
        console.warn('[ApiClient] Authentication Error:', logData);
        break;

      case ErrorType.SERVER_ERROR:
        console.error('[ApiClient] Server Error:', logData);
        break;

      default:
        console.error('[ApiClient] API Error:', logData);
        break;
    }
  }

  /**
   * Initialize network monitoring for offline detection
   */
  private initializeNetworkMonitoring(): void {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return; // Skip in non-browser environments
    }

    // Initial offline state
    this.isOffline = !navigator.onLine;

    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // Start periodic connectivity checks
    this.startConnectivityChecks();
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    log.dev('[ApiClient] Network connection restored');
    this.isOffline = false;

    // Process queued requests
    this.processOfflineQueue();

    // Stop offline checking
    if (this.offlineCheckInterval) {
      clearInterval(this.offlineCheckInterval);
      this.offlineCheckInterval = null;
    }
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    log.dev('[ApiClient] Network connection lost');
    this.isOffline = true;

    // Start checking for connectivity restoration
    this.startOfflineChecking();
  }

  /**
   * Start periodic connectivity checks when offline
   */
  private startOfflineChecking(): void {
    if (this.offlineCheckInterval) {
      return; // Already checking
    }

    this.offlineCheckInterval = setInterval(async () => {
      const isOnline = await this.checkConnectivity();
      if (isOnline && this.isOffline) {
        this.handleOnline();
      }
    }, this.OFFLINE_RETRY_DELAY);
  }

  /**
   * Start periodic connectivity checks for better offline detection
   */
  private startConnectivityChecks(): void {
    // Use configurable interval, default to 2 minutes to reduce server load
    const connectivityCheckInterval = parseInt(
      localStorage.getItem('connectivity_check_interval') || '120000'
    );

    // Minimum interval of 30 seconds to prevent excessive polling
    const safeInterval = Math.max(connectivityCheckInterval, 30000);

    log.dev(`[ApiClient] Starting connectivity checks every ${safeInterval / 1000} seconds`);

    setInterval(async () => {
      if (!this.offlineDetectionEnabled) return;

      const isOnline = await this.checkConnectivity();
      if (isOnline !== !this.isOffline) {
        if (isOnline) {
          this.handleOnline();
        } else {
          this.handleOffline();
        }
      }
    }, safeInterval);
  }

  // Connectivity check caching
  private lastConnectivityCheck: { result: boolean; timestamp: number } | null = null;
  private readonly CONNECTIVITY_CACHE_TTL = 15000; // 15 seconds cache

  /**
   * Check actual connectivity by making a lightweight request with caching
   */
  private async checkConnectivity(): Promise<boolean> {
    const now = Date.now();

    // Return cached result if still valid
    if (this.lastConnectivityCheck &&
      (now - this.lastConnectivityCheck.timestamp) < this.CONNECTIVITY_CACHE_TTL) {
      return this.lastConnectivityCheck.result;
    }

    try {
      // Try to fetch a small resource with a short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'force-cache' // Use browser cache when possible
      });

      clearTimeout(timeoutId);
      const isOnline = response.ok;

      // Cache the result
      this.lastConnectivityCheck = {
        result: isOnline,
        timestamp: now
      };

      return isOnline;
    } catch (_error) {
      // Cache negative result as well
      this.lastConnectivityCheck = {
        result: false,
        timestamp: now
      };

      // Silently handle connectivity check failures
      // This is expected when server is offline or endpoint doesn't exist
      return false;
    }
  }

  /**
   * Load last known auth state for offline use
   */
  private loadLastKnownAuthState(): void {
    try {
      const stored = localStorage.getItem('last_known_auth_state');
      if (stored) {
        this.lastKnownAuthState = JSON.parse(stored);
        log.dev('[ApiClient] Loaded last known auth state for offline use');
      }
    } catch (error) {
      console.warn('[ApiClient] Failed to load last known auth state:', error);
    }
  }

  /**
   * Cache current auth state for offline use
   */
  public cacheAuthState(authState: unknown): void {
    try {
      this.lastKnownAuthState = authState;
      localStorage.setItem('last_known_auth_state', JSON.stringify(authState));
    } catch (error) {
      console.warn('[ApiClient] Failed to cache auth state:', error);
    }
  }

  /**
   * Get cached auth state for offline use
   */
  public getCachedAuthState(): unknown {
    return this.lastKnownAuthState;
  }

  /**
   * Process queued requests when coming back online
   */
  private async processOfflineQueue(): Promise<void> {
    if (this.networkRetryQueue.length === 0) {
      return;
    }

    log.dev(`[ApiClient] Processing ${this.networkRetryQueue.length} queued requests`);

    // Remove expired requests
    const now = Date.now();
    this.networkRetryQueue = this.networkRetryQueue.filter(
      item => now - item.timestamp < this.OFFLINE_QUEUE_TTL
    );

    // Process remaining requests
    const queuedRequests = [...this.networkRetryQueue];
    this.networkRetryQueue = [];

    for (const { config, resolve, reject } of queuedRequests) {
      try {
        const response = await this.request(config);
        resolve(response);
      } catch (error) {
        reject(error as ApiError);
      }
    }
  }

  /**
   * Queue request for retry when network is restored
   */
  private queueForOfflineRetry(
    config: ApiRequestConfig,
    resolve: (response: Response) => void,
    reject: (error: ApiError) => void
  ): void {
    // Remove oldest requests if queue is full
    if (this.networkRetryQueue.length >= this.MAX_OFFLINE_QUEUE_SIZE) {
      const removed = this.networkRetryQueue.shift();
      if (removed) {
        removed.reject(this.createApiError(
          new Error('Request expired in offline queue'),
          { isNetworkError: true }
        ));
      }
    }

    this.networkRetryQueue.push({
      config,
      resolve,
      reject,
      timestamp: Date.now()
    });

    log.dev(`[ApiClient] Queued request for offline retry (${this.networkRetryQueue.length} in queue)`);
  }

  /**
   * Enhanced retry logic with exponential backoff and jitter
   */
  private async retryWithExponentialBackoff(
    config: ApiRequestConfig,
    error: unknown,
    attempt: number
  ): Promise<Response> {
    const isNetworkError = this.isNetworkError(error);
    const errorWithStatus = error as { status?: number } | null;
    const isRetryable = this.isRetryableError(
      this.classifyError(error),
      errorWithStatus?.status,
      attempt
    );

    if (!isRetryable || attempt >= this.MAX_RETRY_COUNT) {
      throw error;
    }

    // Calculate delay with exponential backoff and jitter
    const baseDelay = this.RETRY_DELAY * Math.pow(2, attempt);
    const jitter = Math.random() * 0.3 * baseDelay; // Add up to 30% jitter
    const maxDelay = 30000; // Cap at 30 seconds
    const delay = Math.min(baseDelay + jitter, maxDelay);

    log.dev(`[ApiClient] Retrying request in ${Math.round(delay)}ms (attempt ${attempt + 1}/${this.MAX_RETRY_COUNT})`);

    // For network errors, check if we're offline
    if (isNetworkError && this.isOffline) {
      log.dev('[ApiClient] Network error while offline, queuing for retry');

      return new Promise((resolve, reject) => {
        this.queueForOfflineRetry(
          { ...config, retryCount: attempt + 1 },
          resolve,
          reject
        );
      });
    }

    await this.sleep(delay);

    return this.request({
      ...config,
      retryCount: attempt + 1
    });
  }

  /**
   * Utility method for delays in retry logic
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get recovery suggestions based on error type and context
   */
  private getRecoverySuggestions(errorType: ErrorType, status?: number, _context?: Partial<ErrorContext>): string[] {
    const suggestions: string[] = [];

    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
        suggestions.push('Check your internet connection');
        suggestions.push('Try refreshing the page');
        suggestions.push('Contact your network administrator if the problem persists');
        break;

      case ErrorType.AUTH_ERROR:
        if (status === 401) {
          suggestions.push('Log in again to continue');
          suggestions.push('Clear your browser cache and cookies if the problem persists');
        } else if (status === 403) {
          suggestions.push('Contact your administrator for access permissions');
          suggestions.push('Verify you are using the correct account');
        }
        break;

      case ErrorType.SERVER_ERROR:
        suggestions.push('Wait a few moments and try again');
        suggestions.push('Contact support if the problem continues');
        if (status === 503) {
          suggestions.push('The service may be under maintenance');
        }
        break;

      case ErrorType.CLIENT_ERROR:
        if (status === 429) {
          suggestions.push('Wait a moment before making another request');
          suggestions.push('Reduce the frequency of your requests');
        } else {
          suggestions.push('Check your input and try again');
          suggestions.push('Refresh the page to get the latest data');
        }
        break;

      case ErrorType.TIMEOUT_ERROR:
        suggestions.push('Check your internet connection speed');
        suggestions.push('Try again with a more stable connection');
        break;

      default:
        suggestions.push('Try refreshing the page');
        suggestions.push('Contact support if the problem persists');
        break;
    }

    return suggestions;
  }

  /**
   * Convenience methods for common HTTP methods
   */
  public async get(url: string, config: Partial<ApiRequestConfig> = {}): Promise<Response> {
    return this.request({ ...config, url, method: 'GET' });
  }

  public async post(url: string, data?: unknown, config: Partial<ApiRequestConfig> = {}): Promise<Response> {
    return this.request({ ...config, url, method: 'POST', data });
  }

  public async put(url: string, data?: unknown, config: Partial<ApiRequestConfig> = {}): Promise<Response> {
    return this.request({ ...config, url, method: 'PUT', data });
  }

  public async patch(url: string, data?: unknown, config: Partial<ApiRequestConfig> = {}): Promise<Response> {
    return this.request({ ...config, url, method: 'PATCH', data });
  }

  public async delete(url: string, config: Partial<ApiRequestConfig> = {}): Promise<Response> {
    return this.request({ ...config, url, method: 'DELETE' });
  }

  /**
   * Upload FormData (files, etc.) with proper authentication
   */
  public async upload(url: string, formData: FormData, config: Partial<ApiRequestConfig> = {}): Promise<Response> {
    return this.request({ ...config, url, method: 'POST', data: formData });
  }

  /**
   * Get current network status
   */
  public getNetworkStatus(): {
    isOnline: boolean;
    isOffline: boolean;
    queuedRequests: number;
    lastConnectivityCheck: number;
  } {
    return {
      isOnline: !this.isOffline,
      isOffline: this.isOffline,
      queuedRequests: this.networkRetryQueue.length,
      lastConnectivityCheck: Date.now()
    };
  }

  /**
   * Force a connectivity check (bypasses cache)
   */
  public async forceConnectivityCheck(): Promise<boolean> {
    // Clear cache to force fresh check
    this.lastConnectivityCheck = null;

    const isOnline = await this.checkConnectivity();

    if (isOnline !== !this.isOffline) {
      if (isOnline) {
        this.handleOnline();
      } else {
        this.handleOffline();
      }
    }

    return isOnline;
  }

  /**
   * Configure connectivity check interval
   */
  public setConnectivityCheckInterval(intervalMs: number): void {
    const safeInterval = Math.max(intervalMs, 30000); // Minimum 30 seconds
    localStorage.setItem('connectivity_check_interval', safeInterval.toString());
    log.dev(`[ApiClient] Connectivity check interval updated to ${safeInterval / 1000} seconds`);
  }

  /**
   * Disable connectivity checks to reduce server load
   */
  public disableConnectivityChecks(): void {
    this.offlineDetectionEnabled = false;
    log.dev('[ApiClient] Connectivity checks disabled');
  }

  /**
   * Enable connectivity checks
   */
  public enableConnectivityChecks(): void {
    this.offlineDetectionEnabled = true;
    log.dev('[ApiClient] Connectivity checks enabled');
  }

  /**
   * Enable or disable offline detection
   */
  public setOfflineDetection(enabled: boolean): void {
    this.offlineDetectionEnabled = enabled;

    if (!enabled && this.offlineCheckInterval) {
      clearInterval(this.offlineCheckInterval);
      this.offlineCheckInterval = null;
    }
  }

  /**
   * Clear the offline retry queue
   */
  public clearOfflineQueue(): void {
    const queuedCount = this.networkRetryQueue.length;

    // Reject all queued requests
    this.networkRetryQueue.forEach(({ reject }) => {
      reject(this.createApiError(
        new Error('Offline queue cleared'),
        { isNetworkError: true }
      ));
    });

    this.networkRetryQueue = [];
    log.dev(`[ApiClient] Cleared ${queuedCount} requests from offline queue`);
  }

  /**
   * Get offline queue statistics
   */
  public getOfflineQueueStats(): {
    queueSize: number;
    maxQueueSize: number;
    oldestRequestAge: number | null;
    queueTTL: number;
  } {
    const now = Date.now();
    const oldestRequest = this.networkRetryQueue.length > 0
      ? Math.min(...this.networkRetryQueue.map(r => r.timestamp))
      : null;

    return {
      queueSize: this.networkRetryQueue.length,
      maxQueueSize: this.MAX_OFFLINE_QUEUE_SIZE,
      oldestRequestAge: oldestRequest ? now - oldestRequest : null,
      queueTTL: this.OFFLINE_QUEUE_TTL
    };
  }

  /**
   * Cleanup method for when the instance is destroyed
   */
  public cleanup(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline.bind(this));
      window.removeEventListener('offline', this.handleOffline.bind(this));
    }

    if (this.offlineCheckInterval) {
      clearInterval(this.offlineCheckInterval);
      this.offlineCheckInterval = null;
    }

    this.clearOfflineQueue();
  }
}

// Export singleton instance
export const apiClient = ApiClient.getInstance();
export default apiClient;
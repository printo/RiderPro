// client/src/services/ApiClient.ts
import AuthService from './AuthService';

export interface ApiRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: any;
  skipAuth?: boolean;
  retryCount?: number;
  headers?: Record<string, string>;
}

export interface ApiError extends Error {
  status?: number;
  data?: any;
  isNetworkError?: boolean;
  isAuthError?: boolean;
  isRetryable?: boolean;
  originalError?: any;
  errorType?: ErrorType;
  context?: ErrorContext;
  timestamp?: number;
  userFriendlyMessage?: string;
  recoverySuggestions?: string[];
}

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface ErrorContext {
  url: string;
  method: string;
  retryCount: number;
  timestamp: number;
  userAgent: string;
}

export class ApiClient {
  private static instance: ApiClient;
  private readonly MAX_RETRY_COUNT = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private refreshInProgress = false;
  private refreshAttemptTimestamp = 0;
  private readonly REFRESH_COOLDOWN = 5000; // 5 seconds cooldown between refresh attempts
  private readonly BASE_URL = 'http://localhost:5000';
  private pendingRequests: Array<{
    config: ApiRequestConfig;
    resolve: (response: Response) => void;
    reject: (error: ApiError) => void;
  }> = [];

  // Network resilience properties
  private isOffline = false;
  private offlineDetectionEnabled = true;
  private lastKnownAuthState: any = null;
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
      console.log(`[ApiClient] ${method} ${fullUrl}`, data ? { data } : '');
    }

    try {
      // Build request options
      const requestOptions = this.buildRequestOptions(method, data, skipAuth, headers);

      // Make the request
      let response = await fetch(fullUrl, requestOptions);

      // Handle 401 errors with automatic token refresh
      if (response.status === 401 && !isAuthRequest && !skipAuth) {
        return await this.handleUnauthorized(config);
      }

      // Log response for debugging
      if (!isAuthRequest) {
        console.log(`[ApiClient] Response (${response.status}):`, {
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
        console.log('[ApiClient] Request failed while offline, queuing for retry');

        return new Promise((resolve, reject) => {
          this.queueForOfflineRetry(config, resolve, reject);
        });
      }

      // Use enhanced retry logic with exponential backoff
      if (apiError.isRetryable && retryCount < this.MAX_RETRY_COUNT) {
        console.log(`[ApiClient] Retryable error detected, using enhanced retry logic`);
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
      console.log('[ApiClient] Access token expired, attempting to refresh...');
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
          AuthService.getInstance().logout();
          window.location.href = '/login';
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
        console.log('[ApiClient] Network error during token refresh - preserving session');
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
    console.log('[ApiClient] Retrying request with new token...');

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
  private rejectPendingRequests(error: any): void {
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
    data?: any,
    skipAuth = false,
    additionalHeaders: Record<string, string> = {}
  ): RequestInit {
    const headers: Record<string, string> = {
      ...additionalHeaders,
    };

    // Handle different data types
    let body: any;
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
    let errorData: any;
    try {
      const responseClone = response.clone();
      errorData = await responseClone.json().catch(async () => {
        return await responseClone.text().catch(() => ({}));
      });
    } catch (e) {
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
    const errorMessage = errorData?.message ||
      errorData?.error ||
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
    originalError: any,
    metadata: {
      status?: number;
      data?: any;
      isNetworkError?: boolean;
      isAuthError?: boolean;
      context?: Partial<ErrorContext>;
    } = {}
  ): ApiError {
    // Classify the error type
    const errorType = this.classifyError(originalError, metadata.status);

    // Generate user-friendly message
    const userFriendlyMessage = this.generateUserFriendlyMessage(
      errorType,
      originalError.message || 'API request failed',
      metadata.status,
      metadata.context
    );

    // Create enhanced error object
    const error = new Error(userFriendlyMessage) as ApiError;

    // Copy properties from original error
    if (originalError.stack) {
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
  private isNetworkError(error: any): boolean {
    // Check if browser is offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return true;
    }

    // Common network error indicators
    if (
      error instanceof TypeError ||
      error.name === 'TypeError' ||
      error.name === 'NetworkError' ||
      error.code === 'NETWORK_ERROR' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT'
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

  /**
   * Perform graceful logout with proper cleanup and user notification
   */
  private async performGracefulLogout(reason: string): Promise<void> {
    try {
      console.log(`[ApiClient] Performing graceful logout: ${reason}`);

      // Clear authentication state
      AuthService.getInstance().logout();

      // Clear any pending requests
      this.rejectPendingRequests(new Error('Session expired during logout'));

      // Reset refresh state
      this.refreshInProgress = false;
      this.refreshAttemptTimestamp = 0;

      // Show user-friendly notification if possible
      this.showLogoutNotification(reason);

      // Small delay to allow notification to show
      await this.sleep(1000);

      // Redirect to login page
      window.location.href = '/login';

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
      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast({
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
   * Classify error type based on status code and error characteristics
   */
  private classifyError(error: any, status?: number): ErrorType {
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
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
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
    console.log('[ApiClient] Network connection restored');
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
    console.log('[ApiClient] Network connection lost');
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

    console.log(`[ApiClient] Starting connectivity checks every ${safeInterval / 1000} seconds`);

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
    } catch (error) {
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
        console.log('[ApiClient] Loaded last known auth state for offline use');
      }
    } catch (error) {
      console.warn('[ApiClient] Failed to load last known auth state:', error);
    }
  }

  /**
   * Cache current auth state for offline use
   */
  public cacheAuthState(authState: any): void {
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
  public getCachedAuthState(): any {
    return this.lastKnownAuthState;
  }

  /**
   * Process queued requests when coming back online
   */
  private async processOfflineQueue(): Promise<void> {
    if (this.networkRetryQueue.length === 0) {
      return;
    }

    console.log(`[ApiClient] Processing ${this.networkRetryQueue.length} queued requests`);

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

    console.log(`[ApiClient] Queued request for offline retry (${this.networkRetryQueue.length} in queue)`);
  }

  /**
   * Enhanced retry logic with exponential backoff and jitter
   */
  private async retryWithExponentialBackoff(
    config: ApiRequestConfig,
    error: any,
    attempt: number
  ): Promise<Response> {
    const isNetworkError = this.isNetworkError(error);
    const isRetryable = this.isRetryableError(
      this.classifyError(error),
      error.status,
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

    console.log(`[ApiClient] Retrying request in ${Math.round(delay)}ms (attempt ${attempt + 1}/${this.MAX_RETRY_COUNT})`);

    // For network errors, check if we're offline
    if (isNetworkError && this.isOffline) {
      console.log('[ApiClient] Network error while offline, queuing for retry');

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
  private getRecoverySuggestions(errorType: ErrorType, status?: number, context?: Partial<ErrorContext>): string[] {
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

  public async post(url: string, data?: any, config: Partial<ApiRequestConfig> = {}): Promise<Response> {
    return this.request({ ...config, url, method: 'POST', data });
  }

  public async put(url: string, data?: any, config: Partial<ApiRequestConfig> = {}): Promise<Response> {
    return this.request({ ...config, url, method: 'PUT', data });
  }

  public async patch(url: string, data?: any, config: Partial<ApiRequestConfig> = {}): Promise<Response> {
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
    console.log(`[ApiClient] Connectivity check interval updated to ${safeInterval / 1000} seconds`);
  }

  /**
   * Disable connectivity checks to reduce server load
   */
  public disableConnectivityChecks(): void {
    this.offlineDetectionEnabled = false;
    console.log('[ApiClient] Connectivity checks disabled');
  }

  /**
   * Enable connectivity checks
   */
  public enableConnectivityChecks(): void {
    this.offlineDetectionEnabled = true;
    console.log('[ApiClient] Connectivity checks enabled');
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
    console.log(`[ApiClient] Cleared ${queuedCount} requests from offline queue`);
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
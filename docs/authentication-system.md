# Authentication System Documentation

## Overview

RiderPro uses a modern, unified authentication system built with React Context, TypeScript, and centralized API management. The system provides seamless user authentication, automatic token refresh, and consistent error handling across the entire application.

## Architecture

### System Components

```
┌─────────────────────────────────────────┐
│              UI Components              │
│         (useAuth() hook only)           │
├─────────────────────────────────────────┤
│            AuthContext.tsx              │
│        (Bridge to AuthService)          │
├─────────────────────────────────────────┤
│             ApiClient.ts                │
│    (Centralized API + Auth handling)    │
├─────────────────────────────────────────┤
│            AuthService.ts               │
│         (Core Auth Logic)               │
├─────────────────────────────────────────┤
│           TokenStorage.ts               │
│      (Secure Token Management)          │
└─────────────────────────────────────────┘
```

### Key Features

- **Unified Authentication**: Single `useAuth()` hook for all authentication needs
- **Automatic Token Refresh**: Seamless token renewal without user interruption
- **Centralized API Client**: All API calls go through authenticated client
- **Comprehensive Error Handling**: User-friendly error messages and recovery
- **Type Safety**: Full TypeScript support throughout
- **Offline Support**: Graceful degradation and network error handling

## Usage Guide

### For React Components

#### Basic Authentication Hook

```typescript
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm onLogin={login} />;
  }

  return (
    <div>
      <h1>Welcome, {user?.fullName}</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

#### Permission Checking

```typescript
import { useAuth, useHasPermission } from '@/hooks/useAuth';
import { Permission } from '@/types/Auth';

function AdminPanel() {
  const { user } = useAuth();
  const canManageUsers = useHasPermission(Permission.MANAGE_USERS);
  const canViewAnalytics = useHasPermission(Permission.VIEW_ANALYTICS);

  if (!canManageUsers) {
    return <div>Access denied</div>;
  }

  return (
    <div>
      <h1>Admin Panel</h1>
      {canViewAnalytics && <AnalyticsSection />}
    </div>
  );
}
```

#### Role-Based Access

```typescript
import { useAuth, useIsAdmin, useHasAnyRole } from '@/hooks/useAuth';
import { UserRole } from '@/types/Auth';

function Navigation() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const canAccessAdmin = useHasAnyRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]);

  return (
    <nav>
      <Link to="/">Dashboard</Link>
      <Link to="/shipments">Shipments</Link>
      {canAccessAdmin && <Link to="/admin">Admin</Link>}
      {isAdmin && <Link to="/system">System</Link>}
    </nav>
  );
}
```

### For API Calls

#### Using ApiClient

```typescript
import { apiClient } from '@/services/ApiClient';

// GET request
const response = await apiClient.get('/api/shipments');
const shipments = await response.json();

// POST request
const response = await apiClient.post('/api/shipments', {
  customerName: 'John Doe',
  address: '123 Main St'
});

// File upload
const formData = new FormData();
formData.append('signature', signatureFile);
const response = await apiClient.upload('/api/acknowledgments', formData);
```

#### Error Handling

```typescript
import { apiClient } from '@/services/ApiClient';
import { useAuthErrorHandler } from '@/hooks/useAuth';

function ShipmentService() {
  const { handleAuthError } = useAuthErrorHandler();

  const updateShipment = async (id: string, data: any) => {
    try {
      const response = await apiClient.patch(`/api/shipments/${id}`, data);
      return await response.json();
    } catch (error) {
      handleAuthError(error, 'updateShipment');
      throw error;
    }
  };
}
```

## Authentication Flow

### Login Process

1. **User Credentials**: User enters employeeId and password
2. **API Request**: Credentials sent to Django authentication endpoint
3. **Token Response**: Access and refresh tokens received
4. **Token Storage**: Tokens stored securely with expiration tracking
5. **State Update**: Authentication state updated across all components
6. **Redirect**: User redirected to dashboard

```typescript
const handleLogin = async (employeeId: string, password: string) => {
  const result = await login(employeeId, password);
  
  if (result.success) {
    // User is automatically redirected
    console.log('Login successful');
  } else {
    // Handle error
    setError(result.message);
  }
};
```

### Token Refresh Process

1. **API Call**: Request made with expired access token
2. **401 Response**: Server returns unauthorized error
3. **Auto Refresh**: System automatically attempts token refresh
4. **New Tokens**: Fresh tokens received and stored
5. **Retry Request**: Original request retried with new token
6. **Seamless Experience**: User experiences no interruption

### Logout Process

1. **Logout Trigger**: User clicks logout or session expires
2. **Token Cleanup**: All stored tokens cleared from localStorage
3. **State Reset**: Authentication state reset across all components
4. **API Cleanup**: Pending requests cancelled
5. **Redirect**: User redirected to login page

## Configuration

### Environment Variables

```bash
# Authentication endpoints
VITE_AUTH_BASE_URL=https://pia.printo.in/api/v1
VITE_API_BASE_URL=http://localhost:5000/api

# Token configuration
VITE_TOKEN_REFRESH_THRESHOLD=300000  # 5 minutes before expiry
VITE_MAX_RETRY_ATTEMPTS=3
```

### AuthService Configuration

```typescript
// Token refresh settings
private readonly MAX_REFRESH_RETRIES = 3;
private readonly INITIAL_RETRY_DELAY = 1000; // 1 second
private readonly REFRESH_COOLDOWN = 5000; // 5 seconds

// Network settings
private readonly MAX_OFFLINE_QUEUE_SIZE = 50;
private readonly OFFLINE_QUEUE_TTL = 5 * 60 * 1000; // 5 minutes
```

## User Roles and Permissions

### Role Hierarchy

```typescript
enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  OPS_TEAM = 'ops_team',
  MANAGER = 'manager',
  DRIVER = 'driver'
}
```

### Permission System

```typescript
enum Permission {
  VIEW_ALL_ROUTES = 'view_all_routes',
  VIEW_OWN_ROUTES = 'view_own_routes',
  VIEW_ANALYTICS = 'view_analytics',
  EXPORT_DATA = 'export_data',
  MANAGE_USERS = 'manage_users',
  VIEW_LIVE_TRACKING = 'view_live_tracking',
  ACCESS_AUDIT_LOGS = 'access_audit_logs',
  CONFIGURE_SYSTEM = 'configure_system'
}
```

### Role-Permission Mapping

| Role | Permissions |
|------|-------------|
| **SUPER_ADMIN** | All permissions |
| **ADMIN** | VIEW_ALL_ROUTES, VIEW_ANALYTICS, EXPORT_DATA, MANAGE_USERS, VIEW_LIVE_TRACKING, ACCESS_AUDIT_LOGS, CONFIGURE_SYSTEM |
| **OPS_TEAM** | VIEW_ALL_ROUTES, VIEW_ANALYTICS, EXPORT_DATA, VIEW_LIVE_TRACKING |
| **MANAGER** | VIEW_ALL_ROUTES, VIEW_ANALYTICS, EXPORT_DATA, VIEW_LIVE_TRACKING |
| **DRIVER** | VIEW_OWN_ROUTES |

## Error Handling

### Error Types

```typescript
enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
```

### Error Recovery

- **Network Errors**: Automatic retry with exponential backoff
- **Authentication Errors**: Automatic token refresh or logout
- **Server Errors**: User-friendly error messages
- **Storage Errors**: Fallback to memory-only storage

### User-Friendly Messages

```typescript
const errorMessages = {
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  AUTH_ERROR: 'Your session has expired. Please log in again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'Server is temporarily unavailable. Please try again later.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.'
};
```

## Security Features

### Token Security

- **Secure Storage**: Tokens stored in localStorage with validation
- **Automatic Expiry**: Tokens automatically refreshed before expiration
- **Corruption Detection**: Invalid tokens automatically cleared
- **Session Isolation**: Each browser tab maintains independent session

### Request Security

- **Automatic Headers**: Authentication headers added automatically
- **CSRF Protection**: Cross-site request forgery prevention
- **Request Validation**: All requests validated before sending
- **Error Sanitization**: Sensitive information removed from error messages

### Network Security

- **HTTPS Only**: All authentication requests use HTTPS
- **Token Rotation**: Refresh tokens rotated on each use
- **Rate Limiting**: Built-in request rate limiting
- **Offline Protection**: Secure offline mode with cached credentials

## Troubleshooting

### Common Issues

#### "Session expired" errors
- **Cause**: Token refresh failed or refresh token expired
- **Solution**: User needs to log in again
- **Prevention**: Ensure stable network connection

#### Components not updating after login
- **Cause**: Component not using useAuth hook
- **Solution**: Replace direct AuthService calls with useAuth hook
- **Example**: `const { user } = useAuth()` instead of `authService.getUser()`

#### API calls failing with 401 errors
- **Cause**: Manual fetch calls bypassing ApiClient
- **Solution**: Use apiClient for all API requests
- **Example**: `apiClient.get('/api/data')` instead of `fetch('/api/data')`

### Debug Information

```typescript
import { useAuthDebug } from '@/hooks/useAuth';

function DebugPanel() {
  const { debugInfo } = useAuthDebug();
  
  const handleDebug = () => {
    const info = debugInfo();
    console.log('Auth Debug Info:', info);
  };
  
  return <button onClick={handleDebug}>Debug Auth</button>;
}
```

### Monitoring

The authentication system provides comprehensive logging:

- **State Changes**: All authentication state changes logged
- **Token Operations**: Token refresh and storage operations logged
- **Error Events**: All authentication errors logged with context
- **Performance Metrics**: Request timing and retry statistics

## Migration Guide

### From Legacy System

If migrating from direct AuthService usage:

1. **Replace AuthService imports**:
   ```typescript
   // Old
   import authService from '@/services/AuthService';
   
   // New
   import { useAuth } from '@/hooks/useAuth';
   ```

2. **Update component logic**:
   ```typescript
   // Old
   const user = authService.getUser();
   const isAuthenticated = authService.isAuthenticated();
   
   // New
   const { user, isAuthenticated } = useAuth();
   ```

3. **Replace API calls**:
   ```typescript
   // Old
   const response = await authService.fetchWithAuth('/api/data');
   
   // New
   const response = await apiClient.get('/api/data');
   ```

### Testing Migration

1. **Verify Authentication**: Ensure login/logout works correctly
2. **Check API Calls**: Verify all API requests include authentication
3. **Test Token Refresh**: Simulate token expiration scenarios
4. **Validate Permissions**: Test role-based access control
5. **Error Handling**: Test network errors and recovery

## Best Practices

### Component Development

1. **Always use useAuth hook** instead of direct AuthService access
2. **Handle loading states** during authentication operations
3. **Implement error boundaries** for authentication errors
4. **Use permission hooks** for conditional rendering

### API Integration

1. **Use apiClient** for all authenticated requests
2. **Handle errors gracefully** with user-friendly messages
3. **Implement retry logic** for transient failures
4. **Cache responses** appropriately to reduce API calls

### Security

1. **Never store sensitive data** in component state
2. **Validate user permissions** on both client and server
3. **Use HTTPS** for all authentication-related requests
4. **Implement proper logout** to clear all stored data

### Performance

1. **Minimize authentication checks** in render loops
2. **Use React.memo** for components with auth dependencies
3. **Implement proper caching** for user data and permissions
4. **Avoid unnecessary re-renders** from authentication state changes
# Authentication System Usage Guide

## Quick Start

### For React Components

```typescript
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();
  
  // Component logic here
}
```

### For API Calls

```typescript
import { apiClient } from '@/services/ApiClient';

// All API calls automatically include authentication
const response = await apiClient.get('/api/shipments');
const data = await response.json();
```

## Common Patterns

### Login Form

```typescript
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

function LoginForm() {
  const { login } = useAuth();
  const [credentials, setCredentials] = useState({ employeeId: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await login(credentials.employeeId, credentials.password);
    
    if (!result.success) {
      setError(result.message || 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input 
        value={credentials.employeeId}
        onChange={(e) => setCredentials(prev => ({ ...prev, employeeId: e.target.value }))}
        placeholder="Employee ID"
      />
      <input 
        type="password"
        value={credentials.password}
        onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
        placeholder="Password"
      />
      <button type="submit">Login</button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
```

### Protected Route

```typescript
import { useAuth } from '@/hooks/useAuth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <>{children}</>;
}
```

### Permission-Based Rendering

```typescript
import { useAuth, useHasPermission } from '@/hooks/useAuth';
import { Permission } from '@/types/Auth';

function AdminPanel() {
  const { user } = useAuth();
  const canManageUsers = useHasPermission(Permission.MANAGE_USERS);
  const canViewAnalytics = useHasPermission(Permission.VIEW_ANALYTICS);

  return (
    <div>
      <h1>Welcome, {user?.fullName}</h1>
      
      {canViewAnalytics && (
        <section>
          <h2>Analytics</h2>
          {/* Analytics content */}
        </section>
      )}
      
      {canManageUsers && (
        <section>
          <h2>User Management</h2>
          {/* User management content */}
        </section>
      )}
    </div>
  );
}
```

### API Service with Error Handling

```typescript
import { apiClient } from '@/services/ApiClient';
import { useAuthErrorHandler } from '@/hooks/useAuth';

class ShipmentService {
  private handleAuthError = useAuthErrorHandler();

  async getShipments(filters?: any) {
    try {
      const response = await apiClient.get('/api/shipments', { data: filters });
      return await response.json();
    } catch (error) {
      this.handleAuthError(error, 'getShipments');
      throw error;
    }
  }

  async updateShipment(id: string, data: any) {
    try {
      const response = await apiClient.patch(`/api/shipments/${id}`, data);
      return await response.json();
    } catch (error) {
      this.handleAuthError(error, 'updateShipment');
      throw error;
    }
  }

  async uploadFile(formData: FormData) {
    try {
      const response = await apiClient.upload('/api/acknowledgments', formData);
      return await response.json();
    } catch (error) {
      this.handleAuthError(error, 'uploadFile');
      throw error;
    }
  }
}
```

## Available Hooks

### Core Authentication

- `useAuth()` - Main authentication hook
- `useAuthState()` - Authentication state only
- `useUser()` - Current user data
- `useIsAuthenticated()` - Authentication status

### Permission Checking

- `useHasPermission(permission)` - Check single permission
- `useHasRole(role)` - Check user role
- `useHasAnyRole(roles)` - Check multiple roles
- `useHasAnyPermission(permissions)` - Check multiple permissions

### Convenience Hooks

- `useIsAdmin()` - Check if user is admin
- `useIsSuperAdmin()` - Check if user is super admin
- `useIsOpsTeam()` - Check if user is ops team
- `useCanAccessAdmin()` - Check admin access
- `useCanViewAnalytics()` - Check analytics access

### Utility Hooks

- `useLogin()` - Login with error handling
- `useLogout()` - Logout with confirmation
- `useUserDisplayInfo()` - User display information
- `useAuthErrorHandler()` - Error handling utility

## Migration from Legacy System

### Step 1: Replace AuthService Imports

```typescript
// Old
import authService from '@/services/AuthService';

// New
import { useAuth } from '@/hooks/useAuth';
```

### Step 2: Update Component Logic

```typescript
// Old
function MyComponent() {
  const user = authService.getUser();
  const isAuthenticated = authService.isAuthenticated();
  
  const handleLogout = () => {
    authService.logout();
  };
}

// New
function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();
  
  const handleLogout = () => {
    logout();
  };
}
```

### Step 3: Replace API Calls

```typescript
// Old
const response = await authService.fetchWithAuth('/api/data');
const response = await fetch('/api/data', {
  headers: { Authorization: `Bearer ${token}` }
});

// New
const response = await apiClient.get('/api/data');
```

## Best Practices

### Do's

✅ Always use `useAuth()` hook for authentication  
✅ Use `apiClient` for all API requests  
✅ Handle loading states during authentication  
✅ Implement error boundaries for auth errors  
✅ Use permission hooks for conditional rendering  
✅ Handle network errors gracefully  

### Don'ts

❌ Don't access AuthService directly in components  
❌ Don't use manual fetch for authenticated requests  
❌ Don't store sensitive data in component state  
❌ Don't ignore authentication errors  
❌ Don't bypass the permission system  
❌ Don't hardcode user roles in components  

## Troubleshooting

### Common Issues

**"Session expired" errors**
- Ensure stable network connection
- Check if refresh token is valid
- User may need to log in again

**Components not updating after login**
- Make sure component uses `useAuth()` hook
- Check if component is wrapped in AuthProvider

**API calls failing with 401**
- Use `apiClient` instead of manual fetch
- Ensure authentication headers are included

**Permission checks not working**
- Verify user has correct role and permissions
- Check permission constants are correct
- Ensure permission system is properly configured

### Debug Tools

```typescript
import { useAuthDebug } from '@/hooks/useAuth';

function DebugPanel() {
  const { debugInfo } = useAuthDebug();
  
  const showDebugInfo = () => {
    console.log('Auth Debug:', debugInfo());
  };
  
  return <button onClick={showDebugInfo}>Debug Auth</button>;
}
```

## Examples

See `client/src/examples/AuthContextUsage.tsx` for comprehensive usage examples.
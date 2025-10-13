# Debug Guide: Shipments Page Logout Issue

## Comprehensive Logging Added

I've added extensive logging throughout the entire authentication system to track localStorage operations from login to retrieval. Here's what's been added:

### 1. AuthService Logging
- **login method**: Logs login attempts, responses, and storage operations
- **storeAuthenticationData method**: Logs when auth data is stored and verified
- **fetchWithAuth method**: Logs every API request with auth tokens
- **initializeAuth method**: Logs authentication initialization and direct localStorage checks
- **logout method**: Logs when logout is called and from where
- **clearAuthData method**: Logs when auth data is cleared

### 2. TokenStorage Logging
- **store method**: Logs storage attempts, localStorage operations, and verification
- **retrieve method**: Logs retrieval attempts and what's found in storage
- **tryStoreInLocalStorage**: Logs individual localStorage.setItem operations
- **Direct localStorage verification**: Immediately checks if data was actually stored

### 2. AuthContext Logging
- **useAuth hook**: Logs every time components access auth state
- **useIsAuthenticated hook**: Logs authentication checks with caller info

### 3. Router Logging
- **Router component**: Logs authentication state on every render
- Logs when redirecting to login due to failed authentication

### 4. ShipmentsWithTracking Logging
- **Component mount**: Logs auth state when component mounts
- **Auth state changes**: Monitors changes to authentication state
- **Storage events**: Detects when tokens are removed from localStorage
- **Direct localStorage checks**: Verifies tokens exist in storage

### 5. API Request Logging
- **apiRequest function**: Logs all API calls and responses
- **shipmentsApi.getShipments**: Logs shipments API calls specifically

## How to Test

1. **Open browser developer console** (F12)
2. **Navigate to the shipments page**: Go to `/shipments`
3. **Watch the console output** for the following sequence:

### Expected Log Sequence (Login Flow)
```
💾 About to store authentication data: { hasAccessToken: true, ... }
🏪 TokenStorage.store called: { hasAccessToken: true, ... }
💾 Setting localStorage items...
✅ Set access_token in localStorage
✅ Set refresh_token in localStorage  
✅ Set auth_user in localStorage
🔍 Storage verification: { accessToken: 'stored', refreshToken: 'stored', ... }
📦 Post-login localStorage verification: { accessTokenStored: true, ... }
✅ Login successful for user: ...
```

### Expected Log Sequence (App Initialization)
```
🚀 AuthService.initializeAuth called
🔍 Direct localStorage check before TokenStorage.retrieve:
📦 Direct localStorage contents: { hasAccessToken: true, ... }
🔄 Calling TokenStorage.retrieve...
📥 TokenStorage.retrieve called
📦 Raw localStorage check: { accessToken: 'exists', ... }
✅ Successfully retrieved from localStorage: { hasUser: true, ... }
📦 Retrieved auth data from storage: { hasAuthData: true, ... }
✅ Setting authenticated state from storage
```

### Expected Log Sequence (Shipments Page)
```
🛣️ Router render: { isAuthenticated: true, ... }
🚢 ShipmentsWithTracking mounted
📊 Current auth state: { isAuthenticated: true, ... }
💾 Direct localStorage check: { hasAccessToken: true, ... }
📦 shipmentsApi.getShipments called with filters: {...}
🌐 apiRequest called: { method: 'GET', url: '/api/shipments', ... }
🔐 AuthService.fetchWithAuth called: { url: '/api/shipments', ... }
📤 Making authenticated request: { url: '/api/shipments', ... }
📥 Response received: { status: 200, ok: true, ... }
```

### Problem Log Sequence (Logout Issue)
Look for these patterns that indicate the problem:

1. **Authentication Loss**:
```
🚨 LOGOUT DETECTED: access_token removed from localStorage
🚨 AUTHENTICATION LOST while on shipments page
```

2. **Token Issues**:
```
❌ No access token available in fetchWithAuth
🔄 401 response received, attempting token refresh...
❌ Token refresh failed, logging out
```

3. **Router Redirect**:
```
🚨 Router: User not authenticated, redirecting to login
```

## What to Look For

### 1. **Immediate Logout on Page Load**
- Check if logout is called immediately when visiting `/shipments`
- Look for the stack trace in the logout logs to see what triggered it

### 2. **Token Refresh Failures**
- Check if the initial API request gets a 401 response
- See if token refresh attempts fail
- Look for refresh token issues

### 3. **Storage Issues**
- Check if tokens are missing from localStorage when the page loads
- Look for storage health warnings

### 4. **Authentication State Inconsistencies**
- Check if `isAuthenticated` is true but tokens are missing
- Look for state validation warnings

## Next Steps

After running the test:

1. **Share the console logs** - Copy the relevant console output
2. **Note the exact sequence** - What happens first, second, etc.
3. **Check timing** - Does the logout happen immediately or after some delay?
4. **Test other pages** - Does the same issue happen on `/dashboard` or `/admin`?

## Additional Debug Commands

You can also run these in the browser console for more info:

```javascript
// Check current auth state
console.log('Auth State:', window.authService?.getAuthenticationStatus());

// Check localStorage directly
console.log('LocalStorage:', {
  accessToken: localStorage.getItem('access_token'),
  refreshToken: localStorage.getItem('refresh_token'),
  authUser: localStorage.getItem('auth_user')
});

// Check if AuthService instance exists
console.log('AuthService exists:', !!window.authService);
```

## Layout Fixes Applied

I've also fixed the layout issues in RouteAnalytics to match RouteVisualization:

1. **Container Layout**: Changed from `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6` to `container mx-auto p-4`
2. **Tab Styling**: Updated tabs to use card container with proper borders
3. **Content Spacing**: Fixed tab content spacing and removed overlapping issues

The RouteAnalytics page now has the same consistent layout as RouteVisualization.
# System Architecture

## Overview

RiderPro is a modern, offline-first shipment management and GPS tracking system built with React, TypeScript, and Node.js. The system integrates with external Printo API for authentication while providing comprehensive route tracking, analytics, and real-time monitoring capabilities.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        A[React Frontend]
        B[Service Worker]
        C[IndexedDB]
    end
    
    subgraph "API Layer"
        D[Node.js Server]
        E[Express Router]
        F[Middleware]
    end
    
    subgraph "External Services"
        G[Printo API]
        H[GPS Services]
    end
    
    subgraph "Data Layer"
        I[Local Storage]
        J[Memory Cache]
    end
    
    A --> D
    A --> C
    B --> C
    D --> G
    D --> I
    E --> F
    A --> H
```

## Frontend Architecture

### Component Structure

```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Base UI components (shadcn/ui)
│   ├── analytics/       # Analytics-specific components
│   ├── ErrorBoundary.tsx
│   ├── FloatingActionMenu.tsx
│   ├── RouteSessionControls.tsx
│   └── ShipmentCardWithTracking.tsx
├── pages/               # Page components
│   ├── Dashboard.tsx
│   ├── ShipmentsWithTracking.tsx
│   ├── RouteAnalytics.tsx
│   └── RouteVisualizationPage.tsx
├── hooks/               # Custom React hooks
│   ├── useAuth.ts
│   ├── useRouteAPI.ts
│   ├── useGPSTracking.ts
│   └── useMobileOptimization.ts
├── services/            # Business logic services
│   ├── AuthService.ts
│   ├── ApiClient.ts
│   ├── OfflineStorageService.ts
│   └── GPSTrackingService.ts
├── contexts/            # React contexts
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
└── api/                 # API integration
    ├── shipments.ts
    ├── routes.ts
    └── analytics.ts
```

### State Management

#### Authentication State
```typescript
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
}
```

#### GPS Tracking State
```typescript
interface GPSState {
  currentPosition: Position | null;
  isTracking: boolean;
  accuracy: number;
  lastUpdate: Date | null;
  sessionId: string | null;
}
```

### Offline-First Design

#### Service Worker Strategy
```typescript
// Service worker for offline functionality
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
  }
});
```

#### IndexedDB Schema
```typescript
interface OfflineStorage {
  gpsPoints: {
    id: string;
    sessionId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    accuracy: number;
    synced: boolean;
  };
  
  shipmentEvents: {
    id: string;
    shipmentId: string;
    eventType: 'pickup' | 'delivery';
    latitude: number;
    longitude: number;
    timestamp: string;
    synced: boolean;
  };
  
  syncQueue: {
    id: string;
    endpoint: string;
    method: string;
    data: any;
    timestamp: string;
    retryCount: number;
  };
}
```

## Backend Architecture

### Server Structure

```
server/
├── index.ts             # Main server entry point
├── routes.ts            # API route definitions
├── middleware/          # Express middleware
│   ├── auth.ts         # Authentication middleware
│   ├── cors.ts         # CORS configuration
│   └── rateLimit.ts    # Rate limiting
└── services/           # Business logic services
    ├── AuthService.ts
    ├── ShipmentService.ts
    └── GPSService.ts
```

### API Design Patterns

#### RESTful Endpoints
```typescript
// Shipments API
GET    /api/shipments           # List shipments (paginated)
POST   /api/shipments           # Create shipment
GET    /api/shipments/:id       # Get single shipment
PUT    /api/shipments/:id       # Update shipment
DELETE /api/shipments/:id       # Delete shipment
PATCH  /api/shipments/batch     # Batch update

// Route Sessions API
POST   /api/routes/sessions     # Start route session
GET    /api/routes/sessions/:id # Get session details
PUT    /api/routes/sessions/:id/stop # Stop session
POST   /api/routes/sessions/:id/points # Record GPS point
```

#### Middleware Pipeline
```typescript
app.use(cors());
app.use(rateLimit());
app.use(express.json());
app.use('/api', authMiddleware);
app.use('/api', routeHandler);
app.use(errorHandler);
```

## GPS Tracking System

### Real-Time GPS Collection

```typescript
class GPSTrackingService {
  private watchId: number | null = null;
  private sessionId: string | null = null;
  
  startTracking(sessionId: string): void {
    this.sessionId = sessionId;
    this.watchId = navigator.geolocation.watchPosition(
      this.handlePositionUpdate.bind(this),
      this.handlePositionError.bind(this),
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      }
    );
  }
  
  private async handlePositionUpdate(position: GeolocationPosition): Promise<void> {
    const gpsPoint = {
      sessionId: this.sessionId!,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed,
      heading: position.coords.heading,
      timestamp: new Date().toISOString()
    };
    
    // Store locally first
    await this.offlineStorage.storeGPSPoint(gpsPoint);
    
    // Try to sync immediately
    try {
      await this.syncGPSPoint(gpsPoint);
    } catch (error) {
      // Will be synced later by background process
      console.log('GPS point queued for later sync');
    }
  }
}
```

### Smart Route Completion

```typescript
class SmartRouteCompletion {
  private config = {
    completionRadius: 100, // meters
    minDuration: 1800,     // 30 minutes
    autoConfirmDelay: 30   // seconds
  };
  
  detectCompletion(
    startPosition: Position,
    currentPosition: Position,
    sessionDuration: number
  ): boolean {
    const distance = this.calculateDistance(startPosition, currentPosition);
    
    return distance <= this.config.completionRadius &&
           sessionDuration >= this.config.minDuration;
  }
}
```

## Data Synchronization

### Sync Strategy

```typescript
class SyncService {
  private syncQueue: SyncItem[] = [];
  private isOnline = navigator.onLine;
  
  async syncPendingData(): Promise<void> {
    if (!this.isOnline) return;
    
    const pendingItems = await this.offlineStorage.getPendingSyncItems();
    
    for (const item of pendingItems) {
      try {
        await this.syncItem(item);
        await this.offlineStorage.markAsSynced(item.id);
      } catch (error) {
        await this.handleSyncError(item, error);
      }
    }
  }
  
  private async handleSyncError(item: SyncItem, error: Error): Promise<void> {
    item.retryCount++;
    
    if (item.retryCount >= 3) {
      await this.offlineStorage.markAsFailed(item.id);
    } else {
      // Exponential backoff
      const delay = Math.pow(2, item.retryCount) * 1000;
      setTimeout(() => this.syncItem(item), delay);
    }
  }
}
```

### Conflict Resolution

```typescript
interface ConflictResolution {
  strategy: 'client-wins' | 'server-wins' | 'merge' | 'manual';
  
  resolveShipmentConflict(
    clientData: Shipment,
    serverData: Shipment
  ): Shipment {
    // GPS data: client wins (more recent)
    if (clientData.latitude && clientData.longitude) {
      return { ...serverData, ...clientData };
    }
    
    // Status updates: server wins (authoritative)
    return { ...clientData, status: serverData.status };
  }
}
```

## Authentication Integration

### External API Integration

```typescript
class AuthService {
  private readonly PRINTO_API_BASE = 'https://pia.printo.in/api/v1';
  
  async authenticateWithPrinto(
    employeeId: string,
    password: string
  ): Promise<AuthResponse> {
    const response = await fetch(`${this.PRINTO_API_BASE}/auth/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: employeeId,
        password: password
      })
    });
    
    if (!response.ok) {
      throw new AuthError('Invalid credentials');
    }
    
    const data = await response.json();
    return this.createUserFromPrintoResponse(data, employeeId);
  }
  
  private createUserFromPrintoResponse(
    data: PrintoAuthResponse,
    employeeId: string
  ): AuthResponse {
    const user: User = {
      id: employeeId,
      username: employeeId,
      employeeId: employeeId,
      email: employeeId,
      fullName: data.full_name || employeeId,
      role: data.is_ops_team ? UserRole.OPS_TEAM : UserRole.DRIVER,
      isActive: true,
      permissions: [],
      isOpsTeam: data.is_ops_team || false,
      isAdmin: data.is_ops_team || false,
      isSuperAdmin: false
    };
    
    return {
      success: true,
      accessToken: data.access,
      refreshToken: data.refresh,
      user
    };
  }
}
```

## Performance Optimizations

### Mobile Optimizations

```typescript
class MobileOptimization {
  private batteryLevel = 1.0;
  private isLowPowerMode = false;
  
  optimizeForBattery(): OptimizationSettings {
    if (this.batteryLevel < 0.2 || this.isLowPowerMode) {
      return {
        gpsInterval: 60000,      // 1 minute instead of 30 seconds
        syncInterval: 300000,    // 5 minutes instead of 1 minute
        reduceAnimations: true,
        disableBackgroundSync: true
      };
    }
    
    return {
      gpsInterval: 30000,
      syncInterval: 60000,
      reduceAnimations: false,
      disableBackgroundSync: false
    };
  }
}
```

### Caching Strategy

```typescript
class CacheManager {
  private memoryCache = new Map<string, CacheItem>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes
  
  async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.memoryCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data;
    }
    
    const data = await fetcher();
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  }
}
```

## Security Architecture

### Authentication Flow

```typescript
// JWT token validation middleware
const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // Verify with Printo API
    const response = await fetch('https://pia.printo.in/api/v1/auth/me/', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const userData = await response.json();
    req.user = userData;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token validation failed' });
  }
};
```

### Role-Based Access Control

```typescript
const requireRole = (requiredRole: UserRole) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== requiredRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Usage
app.get('/api/analytics', authMiddleware, requireRole(UserRole.OPS_TEAM), analyticsHandler);
```

## Monitoring and Logging

### Error Tracking

```typescript
class ErrorMonitor {
  logError(error: Error, context: ErrorContext): void {
    const errorData = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userId: context.userId,
      route: context.route,
      userAgent: context.userAgent
    };
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error:', errorData);
    }
    
    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoringService(errorData);
    }
  }
}
```

### Performance Monitoring

```typescript
class PerformanceMonitor {
  trackAPICall(endpoint: string, duration: number, success: boolean): void {
    const metric = {
      endpoint,
      duration,
      success,
      timestamp: Date.now()
    };
    
    // Store metrics for analytics
    this.storeMetric(metric);
    
    // Alert on slow requests
    if (duration > 5000) {
      this.alertSlowRequest(metric);
    }
  }
}
```

## Deployment Architecture

### Development Environment
```bash
# Frontend (Vite dev server)
npm run dev              # http://localhost:5000

# Backend (Node.js)
npm run server          # http://localhost:5000/api

# External API
# https://pia.printo.in/api/v1
```

### Production Environment
```bash
# Build process
npm run build           # Build React app
npm run build:server    # Build Node.js server

# Deployment
docker build -t riderpro .
docker run -p 80:5000 riderpro
```

### Environment Configuration

```bash
# Client environment variables
VITE_API_BASE_URL=https://api.riderpro.com
VITE_AUTH_BASE_URL=https://pia.printo.in/api/v1
VITE_GPS_UPDATE_INTERVAL=30000
VITE_SYNC_INTERVAL=60000

# Server environment variables
NODE_ENV=production
PORT=5000
PRINTO_API_BASE_URL=https://pia.printo.in/api/v1
CORS_ORIGINS=https://riderpro.com,https://app.riderpro.com
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

## Scalability Considerations

### Horizontal Scaling
- Stateless server design
- JWT tokens (no server-side sessions)
- Database connection pooling
- Load balancer ready

### Data Growth
- Pagination for all list endpoints
- GPS data archiving strategy
- Efficient indexing for queries
- Background cleanup jobs

### Performance Bottlenecks
- GPS point ingestion rate limiting
- Batch processing for sync operations
- Caching for frequently accessed data
- CDN for static assets

## Future Enhancements

### Planned Features
1. **WebSocket Integration**: Real-time updates
2. **Push Notifications**: Shipment status alerts
3. **Advanced Analytics**: Machine learning insights
4. **Multi-tenant Support**: Multiple organizations
5. **Mobile App**: Native iOS/Android apps

### Technical Debt
1. **Database Migration**: Move from mock data to real database
2. **Microservices**: Split monolith into services
3. **Event Sourcing**: Audit trail and replay capability
4. **GraphQL**: More efficient data fetching
5. **Kubernetes**: Container orchestration
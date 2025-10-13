# System Architecture Documentation

## Overview

RiderPro is a full-stack shipment management system built with modern web technologies, designed for logistics and delivery operations. The architecture emphasizes real-time updates, offline capabilities, and seamless integration with external systems.

## Architecture Principles

### Design Philosophy
- **Mobile-First**: Responsive design optimized for field workers
- **Offline-Capable**: Local data storage with sync capabilities
- **Real-Time**: Live updates for operational awareness
- **Scalable**: Modular architecture ready for growth
- **Secure**: Role-based access with external authentication

### Technology Decisions
- **TypeScript**: End-to-end type safety
- **SQLite**: Simple, reliable local storage
- **React**: Component-based UI with modern hooks
- **Express**: Lightweight, flexible API server

## Frontend Architecture

### React Application Structure

```
client/src/
├── components/          # Reusable UI components
│   ├── ui/             # Base Shadcn/ui components
│   ├── ErrorBoundary.tsx
│   ├── Navigation.tsx
│   ├── ShipmentCardWithTracking.tsx
│   ├── ShipmentDetailModalWithTracking.tsx
│   ├── SignatureCanvas.tsx
│   ├── BatchUpdateModal.tsx
│   └── SyncStatusPanel.tsx
├── pages/              # Route components
│   ├── Dashboard.tsx
│   ├── ShipmentsWithTracking.tsx
│   └── not-found.tsx
├── hooks/              # Custom React hooks
│   ├── useDashboard.ts
│   ├── useShipments.ts
│   └── use-toast.ts
├── lib/                # Utilities and configuration
│   ├── queryClient.ts
│   └── utils.ts
└── App.tsx             # Application root
```

### State Management Strategy

#### Authentication State (React Context)
- **Unified Auth System**: Single `useAuth()` hook for all authentication needs
- **Automatic Token Management**: Seamless token refresh and storage
- **Permission System**: Role-based access control with granular permissions
- **Error Recovery**: Comprehensive error handling and user feedback

```typescript
// Modern authentication usage
const { user, isAuthenticated, hasPermission, login, logout } = useAuth();

// Permission-based rendering
const canManageUsers = hasPermission(Permission.MANAGE_USERS);
```

#### Server State (TanStack Query)
- **Automatic Caching**: Intelligent background refetching
- **Optimistic Updates**: Immediate UI feedback
- **Error Recovery**: Automatic retry with exponential backoff
- **Real-Time Sync**: Polling and WebSocket integration

```typescript
// Example query configuration with authentication
const shipmentQuery = useQuery({
  queryKey: ['shipments', filters],
  queryFn: () => apiClient.get('/api/shipments').then(r => r.json()),
  staleTime: 30000, // 30 seconds
  refetchInterval: 60000, // 1 minute
  retry: 3
});
```

#### Client State (React Hooks)
- **UI State**: Component-local state with useState
- **Form State**: React Hook Form with Zod validation
- **Global State**: Context API for authentication and theme

### Component Architecture

#### Design System
- **Shadcn/ui**: Accessible, customizable base components
- **Tailwind CSS**: Utility-first styling with design tokens
- **CSS Variables**: Dynamic theming support
- **Responsive Design**: Mobile-first breakpoint system

#### Component Patterns
- **Compound Components**: Complex UI with multiple parts
- **Render Props**: Flexible component composition
- **Custom Hooks**: Reusable stateful logic
- **Error Boundaries**: Graceful error handling

## Backend Architecture

### Express.js Server Structure

```
server/
├── api/                # API documentation
├── db/                 # Database layer
│   ├── connection.ts   # Database setup and connection
│   └── queries.ts      # SQL query operations
├── services/           # Business logic
│   ├── externalSync.ts # External API integration
│   └── scheduler.ts    # Automated tasks
├── uploads/            # File storage
│   ├── signatures/     # Digital signatures
│   └── photos/        # Delivery photos
├── routes.ts           # API route definitions
├── storage.ts          # Data access interface
└── index.ts           # Server entry point
```

### API Design Patterns

#### RESTful Endpoints
- **Resource-Based URLs**: `/api/shipments`, `/api/acknowledgments`
- **HTTP Methods**: GET, POST, PATCH, DELETE
- **Status Codes**: Consistent HTTP status code usage
- **Error Handling**: Structured error responses

#### Middleware Stack
```typescript
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('uploads'));
app.use('/api/auth', authRoutes);
app.use('/api', authenticateToken, apiRoutes);
```

### Data Access Layer

#### Database Abstraction
```typescript
interface StorageInterface {
  getShipments(filters?: ShipmentFilters): Promise<Shipment[]>;
  updateShipmentStatus(id: string, status: string): Promise<void>;
  createAcknowledgment(data: AcknowledgmentData): Promise<string>;
  getSyncStatus(): Promise<SyncStatus[]>;
}
```

#### Query Optimization
- **Prepared Statements**: SQL injection prevention
- **Connection Pooling**: Better SQLite3 performance
- **Index Usage**: Optimized query performance
- **Batch Operations**: Efficient bulk updates

## Data Flow Architecture

### Request Lifecycle

1. **Client Request**: User interaction triggers API call
2. **Authentication**: Token validation and user context
3. **Validation**: Request data validation with Zod schemas
4. **Business Logic**: Service layer processing
5. **Data Access**: Database operations via storage interface
6. **Response**: Structured JSON response with error handling

### Real-Time Updates

#### Polling Strategy
```typescript
// Automatic background refetching
useQuery({
  queryKey: ['dashboard'],
  queryFn: fetchDashboardData,
  refetchInterval: 30000, // 30 seconds
  refetchOnWindowFocus: true
});
```

#### WebSocket Integration (Future)
- **Live Tracking**: Real-time GPS coordinates
- **Status Updates**: Instant shipment status changes
- **Notifications**: Push notifications for critical events

### File Upload Flow

1. **Client Upload**: Multipart form data with signature/photo
2. **Multer Processing**: File validation and temporary storage
3. **File Processing**: Image optimization with Sharp
4. **Permanent Storage**: Move to organized directory structure
5. **Database Update**: Store file paths in acknowledgments table
6. **Cleanup**: Remove temporary files

## External Integration Architecture

### Authentication Proxy

```typescript
// Django API integration
const authResponse = await axios.post(
  'https://pia.printo.in/api/v1/auth/',
  credentials,
  { timeout: 10000 }
);
```

#### Token Management
- **Access Tokens**: Short-lived authentication tokens
- **Refresh Tokens**: Long-lived token renewal
- **Cookie Storage**: Secure client-side token storage
- **Auto-Refresh**: Transparent token renewal on expiry

### External Sync Service

#### Sync Strategy
- **Batch Processing**: Efficient bulk data synchronization
- **Retry Logic**: Exponential backoff for failed requests
- **Error Tracking**: Detailed failure logging and monitoring
- **Manual Triggers**: Admin-initiated sync operations

#### Sync Status Tracking
```typescript
interface SyncStatus {
  shipmentId: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  lastAttempt?: string;
  error?: string;
}
```

## Security Architecture

### Modern Authentication System

#### Unified Authentication Layer
- **React Context Integration**: Centralized authentication state management
- **Automatic Token Refresh**: Seamless session continuation without user interruption
- **Type-Safe API Client**: All API calls go through authenticated client
- **Comprehensive Error Handling**: User-friendly error messages and recovery strategies

```typescript
// Authentication architecture
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
}
```

#### Enhanced Security Features
- **Token Storage Security**: Secure localStorage with corruption detection
- **Network Error Resilience**: Offline mode support and retry logic
- **Permission-Based Access**: Granular role and permission system
- **Request Authentication**: Automatic authentication headers for all API calls

#### Role & Permission System
- **super_admin**: Complete system control and configuration
- **admin**: Full operational access and user management  
- **ops_team**: Operations oversight with analytics access
- **manager**: Route management and performance analytics
- **driver**: Personal route and delivery management

```typescript
// Permission checking in components
const { hasPermission, hasAnyRole } = useAuth();
const canViewAnalytics = hasPermission(Permission.VIEW_ANALYTICS);
const isAdminUser = hasAnyRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
```

### Data Security

#### Input Validation
```typescript
const shipmentSchema = z.object({
  status: z.enum(['Assigned', 'In Transit', 'Delivered']),
  remarks: z.string().max(500).optional()
});
```

#### File Security
- **Upload Validation**: File type and size restrictions
- **Path Sanitization**: Prevent directory traversal
- **Access Control**: Authenticated access to uploaded files

## Performance Architecture

### Frontend Optimization

#### Code Splitting
```typescript
// Lazy loading for route components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Shipments = lazy(() => import('./pages/ShipmentsWithTracking'));
```

#### Caching Strategy
- **Query Caching**: TanStack Query automatic caching
- **Asset Caching**: Vite build optimization
- **Service Worker**: Offline capability (future enhancement)

### Backend Optimization

#### Database Performance
- **Connection Reuse**: Single database connection
- **Query Optimization**: Indexed queries and prepared statements
- **Batch Operations**: Reduced database round trips

#### Memory Management
- **File Streaming**: Large file handling
- **Connection Pooling**: Efficient resource usage
- **Garbage Collection**: Proper cleanup of temporary resources

## Deployment Architecture

### Development Environment
- **Vite Dev Server**: Hot module replacement
- **Replica Database**: Safe development data
- **File Watching**: Automatic server restart
- **Error Overlay**: Development debugging tools

### Production Environment
- **Static Assets**: Optimized build output
- **Live Database**: Production data operations
- **Process Management**: PM2 or similar process manager
- **Logging**: Structured application logging

### Scalability Considerations

#### Horizontal Scaling
- **Stateless Design**: No server-side session storage
- **Database Separation**: Read/write splitting capability
- **File Storage**: CDN integration for uploaded files
- **Load Balancing**: Multiple server instance support

#### Migration Path
- **PostgreSQL Ready**: Schema designed for easy migration
- **Microservices**: Modular architecture for service extraction
- **API Versioning**: Backward compatibility support
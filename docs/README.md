# RiderPro - Shipment Management & GPS Tracking System

## Overview

RiderPro is a modern, offline-first shipment management and GPS tracking system designed for delivery and logistics operations. Built with React, TypeScript, and Node.js, it provides real-time route tracking, comprehensive analytics, and seamless integration with external authentication systems.

## 🚀 Key Features

### 📦 Shipment Management
- **Real-time Tracking**: Live shipment status updates with GPS coordinates
- **Batch Operations**: Update multiple shipments simultaneously
- **Smart Filtering**: Advanced search and filter capabilities
- **Mobile-First Design**: Optimized for mobile devices and tablets
- **Offline Support**: Continue working without internet connection

### 🗺️ GPS Tracking & Route Management
- **Live GPS Tracking**: Real-time location recording during route sessions
- **Smart Route Completion**: Automatic detection when routes are completed
- **Offline GPS Storage**: GPS points stored locally and synced when online
- **Route Analytics**: Comprehensive performance metrics and insights
- **Battery Optimization**: Smart power management for mobile devices

### 📊 Analytics & Reporting
- **Performance Dashboard**: Real-time metrics and KPIs
- **Route Analytics**: Detailed analysis of route efficiency and performance
- **Employee Performance**: Individual and team performance tracking
- **Data Export**: Export data in multiple formats for external analysis
- **Visual Reports**: Interactive charts and graphs

### 🔐 Security & Authentication
- **External API Integration**: Secure integration with Printo authentication system
- **Role-Based Access**: Different permissions for drivers and operations team
- **JWT Token Management**: Automatic token refresh and secure storage
- **Data Encryption**: All sensitive data encrypted in transit and at rest

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **shadcn/ui** for component library
- **React Query** for data fetching and caching
- **Wouter** for routing

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **JWT** for authentication
- **CORS** for cross-origin requests
- **Rate limiting** for API protection

### Storage & Sync
- **IndexedDB** for offline data storage
- **LocalStorage** for user preferences
- **Background Sync** for automatic data synchronization
- **Service Worker** for offline functionality

### External Integrations
- **Printo API** for user authentication and authorization
- **Browser GPS API** for location tracking
- **Web Workers** for background processing

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- npm or yarn package manager
- Modern web browser with GPS support
- Access to Printo authentication system

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-org/riderpro.git
cd riderpro
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:5000/api
VITE_AUTH_BASE_URL=https://pia.printo.in/api/v1

# GPS Configuration
VITE_GPS_UPDATE_INTERVAL=30000
VITE_SYNC_INTERVAL=60000

# Feature Flags
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_GPS_TRACKING=true
VITE_ENABLE_ANALYTICS=true
```

4. **Start the development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to `http://localhost:5000`

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Start production server
npm run start
```

## 📱 Usage Guide

### Getting Started

1. **Login**: Use your Printo employee ID and password
2. **Dashboard**: View overview of shipments and metrics
3. **Start Route**: Begin GPS tracking for your delivery route
4. **Manage Shipments**: Update status, record pickups/deliveries
5. **Analytics**: Review performance data and insights

### For Drivers

#### Starting Your Route
1. Navigate to Dashboard
2. Click "Start Route" in Route Tracking section
3. Allow GPS permissions when prompted
4. Your location will be tracked automatically

#### Managing Shipments
1. Go to Shipments page
2. View your assigned shipments
3. Click on shipment cards to view details
4. Use "Record Pickup" or "Record Delivery" buttons to update with GPS location
5. Update status as needed

#### Working Offline
- All actions work without internet connection
- Data is stored locally and synced when online
- GPS tracking continues in background
- Sync status shown in top bar

### For Operations Team

#### Monitoring Operations
1. **Dashboard**: Real-time overview of all operations
2. **Live Tracking**: Monitor driver locations and progress
3. **Analytics**: Access detailed performance reports
4. **Batch Operations**: Update multiple shipments at once

#### Route Analytics
1. Navigate to Route Analytics page
2. Select date range and filters
3. View performance metrics by employee
4. Export data for external analysis

## 🔧 Configuration

### Environment Variables

#### Client Configuration
```bash
# API Endpoints
VITE_API_BASE_URL=http://localhost:5000/api
VITE_AUTH_BASE_URL=https://pia.printo.in/api/v1

# GPS Settings
VITE_GPS_UPDATE_INTERVAL=30000    # GPS update frequency (ms)
VITE_GPS_ACCURACY_THRESHOLD=50    # Minimum GPS accuracy (meters)
VITE_ROUTE_COMPLETION_RADIUS=100  # Route completion detection radius (meters)

# Sync Settings
VITE_SYNC_INTERVAL=60000          # Background sync frequency (ms)
VITE_OFFLINE_STORAGE_LIMIT=1000   # Max offline records to store
VITE_RETRY_ATTEMPTS=3             # Max retry attempts for failed requests

# Feature Flags
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_GPS_TRACKING=true
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_BATTERY_OPTIMIZATION=true
```

#### Server Configuration
```bash
# Server Settings
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# External API
PRINTO_API_BASE_URL=https://pia.printo.in/api/v1
API_TIMEOUT=10000

# Security
CORS_ORIGINS=https://your-domain.com,https://app.your-domain.com
RATE_LIMIT_WINDOW=900000          # 15 minutes
RATE_LIMIT_MAX=100                # Max requests per window
JWT_SECRET=your-jwt-secret

# Logging
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
```

### GPS Configuration

#### Accuracy Settings
```typescript
const gpsOptions = {
  enableHighAccuracy: true,        // Use GPS instead of network location
  timeout: 30000,                  // 30 second timeout
  maximumAge: 0                    // Don't use cached positions
};
```

#### Battery Optimization
```typescript
const batteryOptimization = {
  lowBatteryThreshold: 0.2,        // 20% battery
  reducedUpdateInterval: 60000,    // 1 minute when low battery
  disableBackgroundSync: true      // Stop background sync when low battery
};
```

## 🔐 Authentication & Security

### User Roles

#### Driver Role
- View assigned shipments only
- Update shipment status
- Record GPS tracking data
- Access basic dashboard

#### Operations Team Role
- View all shipments and routes
- Access analytics and reports
- Perform batch operations
- Export data
- Monitor live tracking

### Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Granular permissions system
- **Data Encryption**: All sensitive data encrypted
- **Rate Limiting**: API protection against abuse
- **Input Validation**: All inputs validated and sanitized
- **CORS Protection**: Cross-origin request protection

## 📊 API Documentation

### Authentication Endpoints

```http
POST /api/auth/login
POST /api/auth/refresh
GET  /api/auth/me
POST /api/auth/logout
```

### Shipment Endpoints

```http
GET    /api/shipments              # List shipments (paginated)
POST   /api/shipments              # Create shipment
GET    /api/shipments/:id          # Get shipment details
PUT    /api/shipments/:id          # Update shipment
PATCH  /api/shipments/batch        # Batch update shipments
POST   /api/shipments/:id/events   # Record shipment event with GPS
```

### GPS Tracking Endpoints

```http
POST /api/routes/sessions          # Start route session
GET  /api/routes/sessions/:id      # Get session details
POST /api/routes/sessions/:id/points # Record GPS point
PUT  /api/routes/sessions/:id/stop # Stop route session
```

### Analytics Endpoints

```http
GET /api/analytics/routes          # Route performance data
GET /api/analytics/performance     # Employee performance metrics
GET /api/dashboard/metrics         # Dashboard summary data
```

For complete API documentation, see [API Documentation](./api-documentation.md).

## 🧪 Testing

### Running Tests

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Test coverage
npm run test:coverage
```

### Manual Testing

1. **GPS Functionality**: Test on actual mobile devices
2. **Offline Mode**: Disconnect internet and verify functionality
3. **Performance**: Test with large datasets
4. **Cross-browser**: Test on different browsers and devices

For detailed testing procedures, see [Testing Guide](./shipment-testing.md).

## 📱 Mobile Optimization

### Responsive Design
- Mobile-first CSS approach
- Touch-friendly interface elements
- Optimized layouts for small screens
- Gesture support for navigation

### Performance Optimizations
- Lazy loading of components
- Virtual scrolling for large lists
- Image optimization and compression
- Efficient GPS data handling

### Battery Management
- Reduced GPS frequency on low battery
- Background sync optimization
- Smart caching strategies
- Minimal network usage

## 🔄 Offline Functionality

### Data Storage
- **IndexedDB**: GPS points, shipment events, sync queue
- **LocalStorage**: User preferences, authentication tokens
- **Memory Cache**: Frequently accessed data

### Sync Strategy
- **Background Sync**: Automatic when connection restored
- **Conflict Resolution**: Smart merging of offline changes
- **Retry Logic**: Exponential backoff for failed requests
- **Data Integrity**: Validation and deduplication

### Offline Capabilities
- View and update shipments
- Record GPS tracking data
- Update shipment status
- Continue route sessions
- Access cached analytics data

## 📈 Analytics & Reporting

### Dashboard Metrics
- Total shipments and completion rates
- Real-time status distribution
- Route performance summaries
- Employee productivity metrics

### Route Analytics
- Distance and time analysis
- Fuel consumption estimates
- Route efficiency metrics
- Performance comparisons

### Export Options
- CSV format for spreadsheet analysis
- JSON format for system integration
- PDF reports for presentations
- Real-time data feeds

## 🚀 Deployment

### Development Deployment

```bash
# Start development server
npm run dev

# Build and preview
npm run build
npm run preview
```

### Production Deployment

#### Docker Deployment
```bash
# Build Docker image
docker build -t riderpro .

# Run container
docker run -p 80:5000 -e NODE_ENV=production riderpro
```

#### Manual Deployment
```bash
# Build application
npm run build

# Start production server
npm run start
```

### Environment Setup

#### Production Environment Variables
```bash
NODE_ENV=production
PORT=5000
PRINTO_API_BASE_URL=https://pia.printo.in/api/v1
CORS_ORIGINS=https://your-domain.com
RATE_LIMIT_MAX=1000
LOG_LEVEL=warn
```

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Standards

- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **Conventional Commits**: Commit message format

### Pull Request Process

1. Update documentation for any new features
2. Add tests for bug fixes and new features
3. Ensure CI/CD pipeline passes
4. Request review from maintainers

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🆘 Support

### Documentation
- [API Documentation](./api-documentation.md)
- [Authentication System](./authentication-system.md)
- [System Architecture](./system-architecture.md)
- [Testing Guide](./shipment-testing.md)

### Getting Help
- Check existing documentation
- Search through issues on GitHub
- Create a new issue with detailed information
- Contact the development team

### Reporting Issues
When reporting issues, please include:
- Environment details (browser, OS, device)
- Steps to reproduce the issue
- Expected vs actual behavior
- Screenshots or error messages
- Console logs if applicable

## 🔮 Roadmap

### Upcoming Features
- **WebSocket Integration**: Real-time updates across all clients
- **Push Notifications**: Instant alerts for important events
- **Advanced Analytics**: Machine learning insights and predictions
- **Multi-tenant Support**: Support for multiple organizations
- **Native Mobile Apps**: iOS and Android applications

### Performance Improvements
- **Database Integration**: Replace mock data with real database
- **Microservices Architecture**: Split into smaller, focused services
- **CDN Integration**: Faster asset delivery
- **Caching Layer**: Redis for improved performance

### Security Enhancements
- **Two-Factor Authentication**: Additional security layer
- **Audit Logging**: Comprehensive activity tracking
- **Data Encryption**: Enhanced encryption for sensitive data
- **Compliance**: GDPR and other regulatory compliance

---

**RiderPro** - Empowering efficient delivery operations with modern technology.
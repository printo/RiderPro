# RiderPro Documentation Hub

Welcome to the comprehensive documentation for RiderPro, a modern delivery management system with real-time GPS tracking and offline capabilities.

## 📚 Documentation Index

### 🏗️ System Architecture
- **[System Architecture](./system-architecture.md)** - High-level system design, component structure, and technical decisions
- **[Database Schema](./database-schema.md)** - Database design, tables, relationships, and data lifecycle
- **[API Documentation](./api-documentation.md)** - Complete REST API reference with examples
- **[API Inventory](./api-inventory.md)** - Comprehensive endpoint documentation with security details

### 🔐 Authentication & Security
- **[Authentication System](./authentication-system.md)** - Dual authentication system, role-based access, and security measures
- **Password Security** - bcrypt hashing, salt rounds, and secure storage
- **User Management** - Admin panel, user approval workflow, and role assignment

### 🚀 Development & Deployment
- **[Smart Route Completion](./smart-route-completion.md)** - AI-powered route optimization and completion detection
- **Development Setup** - Local development environment and testing procedures
- **Production Deployment** - Deployment strategies and configuration

## 🎯 Quick Start Guide

### For New Developers
1. **Read the [System Architecture](./system-architecture.md)** to understand the overall design
2. **Set up your development environment** following the main README
3. **Review the [API Documentation](./api-documentation.md)** to understand available endpoints
4. **Check the [Authentication System](./authentication-system.md)** for login flows and user management

### For System Administrators
1. **Review [Database Schema](./database-schema.md)** for data management
2. **Check [API Inventory](./api-inventory.md)** for security and rate limiting details
3. **Understand [Authentication System](./authentication-system.md)** for user management

### For API Integrators
1. **Start with [API Inventory](./api-inventory.md)** for endpoint overview
2. **Use [API Documentation](./api-documentation.md)** for detailed implementation
3. **Review [Authentication System](./authentication-system.md)** for security requirements

## 🏗️ System Overview

RiderPro is a modern, offline-first delivery management system built with:

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express.js + TypeScript
- **Database**: SQLite with Drizzle ORM
- **Authentication**: Dual system (External API + Local Database)
- **Security**: bcrypt password hashing, JWT tokens, role-based access
- **Features**: GPS tracking, offline sync, real-time analytics, mobile optimization

## 🔧 Key Features

### 📦 Shipment Management
- Real-time shipment tracking with GPS coordinates
- Batch operations for efficient bulk updates
- Digital acknowledgments with photo and signature capture
- Advanced filtering and search capabilities
- Offline support for field operations

### 🗺️ GPS Tracking & Routes
- Live GPS tracking during route sessions
- Offline GPS storage with automatic sync
- Smart route completion detection
- Route analytics and performance metrics
- Battery optimization for mobile devices

### 📊 Analytics & Reporting
- Real-time dashboard with KPIs
- Route performance analytics
- Employee performance tracking
- Data export capabilities
- Interactive charts and visualizations

### 🔐 Security & User Management
- **Dual Authentication System**:
  - External API integration (Printo)
  - Local database with approval workflow
- **Role-Based Access Control**:
  - Admin: Full system access
  - Manager: Operations team access
  - Driver: Field operations
  - Viewer: Read-only access
- **Password Security**: bcrypt hashing with 12 salt rounds
- **User Management**: Admin panel for approvals and password reset

## 📋 API Reference

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/local-login` - Local database login
- `GET /api/auth/pending-approvals` - Get pending user approvals
- `POST /api/auth/approve/:userId` - Approve user account
- `POST /api/auth/reject/:userId` - Reject user account
- `POST /api/auth/reset-password/:userId` - Reset user password

### Shipment Management
- `GET /api/shipments` - Get shipments with filtering
- `POST /api/shipments` - Create new shipment
- `PATCH /api/shipments/:id` - Update shipment
- `PATCH /api/shipments/batch` - Batch update shipments
- `DELETE /api/shipments/:id` - Delete shipment
- `POST /api/shipments/:id/acknowledgement` - Upload acknowledgment

### Route Tracking
- `POST /api/routes/start` - Start route session
- `POST /api/routes/stop` - Stop route session
- `POST /api/routes/coordinates` - Submit GPS coordinates
- `GET /api/routes/session/:sessionId` - Get session data
- `POST /api/routes/sync-session` - Sync offline session
- `POST /api/routes/sync-coordinates` - Sync offline coordinates

### System & Analytics
- `GET /api/health` - System health check
- `GET /api/dashboard` - Dashboard metrics
- `GET /api/sync/stats` - Sync statistics
- `POST /api/sync/trigger` - Trigger manual sync
- `POST /api/errors` - Log frontend errors

## 🔒 Security Features

### Authentication Security
- **External API Integration**: Secure integration with Printo authentication
- **Local Database Security**: bcrypt password hashing with 12 salt rounds
- **Token Management**: JWT access and refresh tokens
- **Session Management**: Secure localStorage-based session handling

### Data Security
- **Input Validation**: Comprehensive validation for all inputs
- **SQL Injection Prevention**: Parameterized queries with Drizzle ORM
- **XSS Protection**: Content Security Policy and input sanitization
- **File Upload Security**: Type validation and size limits

### Access Control
- **Role-Based Permissions**: Granular permissions based on user roles
- **API Rate Limiting**: Prevents abuse and ensures system stability
- **CORS Configuration**: Secure cross-origin resource sharing
- **Audit Logging**: Comprehensive logging of all operations

## 🚀 Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Initialize database
npm run db:migrate

# Start development server
npm run dev
```

### Code Organization
- **Frontend**: React components organized by domain
- **Backend**: Express.js with modular route handlers
- **Database**: SQLite with Drizzle ORM for type safety
- **Shared**: Common types and schemas
- **Documentation**: Comprehensive docs in `/docs` folder

### Testing
- **Unit Tests**: Component and service testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Full user workflow testing
- **Mobile Testing**: Responsive design validation

## 📱 Mobile Optimization

### Progressive Web App
- **Offline Support**: Service worker for offline functionality
- **App-like Experience**: Full-screen mode and native feel
- **Push Notifications**: Real-time updates and alerts
- **Installation**: Add to home screen capability

### Touch Optimization
- **Touch-Friendly UI**: Large buttons and touch targets
- **Gesture Support**: Swipe and pinch gestures
- **Responsive Design**: Adapts to all screen sizes
- **Performance**: Optimized for mobile devices

## 🔧 Configuration

### Environment Variables
```bash
# Server Configuration
NODE_ENV=development
PORT=5000

# Database
DATABASE_URL=./data/riderpro.db

# External API
PRINTO_API_BASE_URL=https://pia.printo.in/api/v1

# Security
BCRYPT_SALT_ROUNDS=12
CORS_ORIGINS=http://localhost:5000

# Features
ENABLE_GPS_TRACKING=true
ENABLE_OFFLINE_SYNC=true
ENABLE_ANALYTICS=true
```

### Feature Flags
- **GPS Tracking**: Enable/disable GPS functionality
- **Offline Sync**: Enable/disable offline capabilities
- **Analytics**: Enable/disable analytics collection
- **External API**: Enable/disable external API integration

## 📊 Monitoring & Analytics

### System Monitoring
- **Health Checks**: Automated system health monitoring
- **Performance Metrics**: Response times and throughput
- **Error Tracking**: Comprehensive error logging and reporting
- **Resource Usage**: Memory and CPU monitoring

### User Analytics
- **Usage Patterns**: User behavior and feature usage
- **Performance Metrics**: Route efficiency and completion rates
- **Error Analysis**: Common issues and resolution patterns
- **Business Intelligence**: KPI tracking and reporting

## 🤝 Contributing

### Development Guidelines
1. **Follow TypeScript best practices**
2. **Write comprehensive tests**
3. **Update documentation for new features**
4. **Follow the existing code style**
5. **Test on both desktop and mobile devices**

### Code Review Process
1. **Create feature branch**
2. **Implement changes with tests**
3. **Update documentation**
4. **Submit pull request**
5. **Address review feedback**

## 📞 Support

### Getting Help
- **Documentation**: Check this documentation hub first
- **GitHub Issues**: Report bugs and request features
- **Discussions**: Ask questions and share ideas
- **Code Review**: Get help with implementation

### Common Issues
- **Authentication Problems**: Check the authentication system documentation
- **API Errors**: Review the API documentation and error codes
- **Database Issues**: Check the database schema and migration status
- **Mobile Issues**: Verify responsive design and touch optimization

---

**Last Updated**: December 2024  
**Version**: 2.0.0  
**Maintainer**: RiderPro Development Team
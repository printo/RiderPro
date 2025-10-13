# RiderPro Documentation

Welcome to the RiderPro documentation hub. This directory contains comprehensive documentation for the RiderPro shipment management system.

## 📚 Documentation Index

### Core Documentation
- **[System Architecture](./system-architecture.md)** - Complete system design, technology stack, and architectural decisions
- **[Authentication System](./authentication-system.md)** - Comprehensive authentication guide with React hooks and API integration
- **[API Documentation](./api-documentation.md)** - Complete REST API reference with examples and error codes
- **[Database Schema](./database-schema.md)** - Database design, tables, relationships, and data lifecycle

### Feature Documentation
- **[📍 Location-Based Features](./location-features.md)** - GPS coordinates and proximity search (NEW)
- **[Smart Route Completion](./smart-route-completion.md)** - AI-powered route optimization and completion features
- **[Shipment Testing Guide](./shipment-testing.md)** - Testing procedures and validation workflows

### Technical Documentation
- **[Replit Integration](./replit.md)** - Development environment setup and Replit-specific configurations

## 🚀 Quick Start

### For Developers
1. Start with [System Architecture](./system-architecture.md) to understand the overall design
2. Review [Database Schema](./database-schema.md) for data structure
3. Use [API Documentation](./api-documentation.md) for integration

### For Operations Teams
1. Check [Shipment Testing Guide](./shipment-testing.md) for operational procedures
2. Review [Smart Route Completion](./smart-route-completion.md) for route optimization features

### For System Administrators
1. Review [System Architecture](./system-architecture.md) for deployment considerations
2. Check [Database Schema](./database-schema.md) for backup and maintenance procedures

## 📋 System Overview

RiderPro is a comprehensive shipment management system designed for logistics and delivery operations. The application provides:

- **Real-time Dashboard** for tracking shipments and performance metrics
- **GPS Tracking** with route optimization and completion
- **Digital Acknowledgments** with signature and photo capture
- **Batch Operations** for efficient bulk updates
- **External API Integration** with Django-based authentication
- **Offline Capabilities** with automatic synchronization

## 🔧 Technology Stack

### Frontend
- React 18 with TypeScript
- Vite for development and building
- Tailwind CSS with Shadcn/ui components
- TanStack Query for state management
- Leaflet for interactive maps

### Backend
- Node.js with Express.js
- SQLite with dual database setup
- Drizzle ORM for database operations
- Multer for file uploads
- JWT authentication integration

## 🏗️ Architecture Highlights

### Design Principles
- **Mobile-First**: Optimized for field workers
- **Offline-Capable**: Local storage with sync
- **Real-Time**: Live updates and notifications
- **Scalable**: Modular, microservice-ready architecture
- **Secure**: Role-based access control

### Key Features
- **Dual Database System**: Live and replica databases for development/production
- **External Authentication**: Django API integration
- **File Management**: Organized storage for signatures and photos
- **Automated Sync**: Background synchronization with retry logic
- **Performance Optimization**: Caching, lazy loading, and code splitting

## 🔐 Authentication & Security

The system features a modern, unified authentication system with:

- **React Context Integration**: Seamless authentication state management
- **Automatic Token Refresh**: Uninterrupted user sessions
- **Role-Based Access Control**: Granular permission system
- **Comprehensive Error Handling**: User-friendly error recovery
- **Type-Safe API Client**: Centralized, authenticated API requests

### User Roles
- **super_admin**: Complete system control and configuration
- **admin**: Full operational access and user management
- **ops_team**: Operations oversight with analytics access
- **manager**: Route management and performance analytics
- **driver**: Personal route and delivery management

See [Authentication System Documentation](./authentication-system.md) for complete implementation details.

## 🔗 Related Resources

- **Main README**: [../README.md](../README.md) - Project overview and setup instructions
- **Source Code**: Explore the `client/` and `server/` directories
- **Configuration**: Check `package.json`, `vite.config.ts`, and other config files

## 📝 Contributing to Documentation

When updating documentation:

1. Keep technical accuracy and clarity as priorities
2. Include code examples and practical use cases
3. Update the index above when adding new documents
4. Cross-reference related documentation sections
5. Maintain consistent formatting and structure

## 🆘 Support

For questions about the documentation or system:

1. Check the relevant documentation section first
2. Review the API documentation for integration issues
3. Consult the system architecture for design questions
4. Contact the development team for additional support

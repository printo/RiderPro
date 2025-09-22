# RiderPro Shipment Management System

## Overview

RiderPro is a comprehensive shipment management system designed for logistics and delivery operations. The application provides a real-time dashboard for tracking shipments, managing deliveries, and monitoring rider performance with GPS route tracking capabilities. The system integrates with external APIs for authentication and data synchronization while maintaining local SQLite storage for offline functionality.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React 18 with TypeScript**: Modern component-based UI using functional components and hooks
- **Vite Build System**: Fast development server with optimized production builds and hot module replacement
- **Shadcn/ui Component Library**: Accessible UI components built on Radix primitives with Tailwind CSS styling
- **TanStack Query**: Server state management with automatic caching, background refetching, and optimistic updates
- **Wouter Routing**: Lightweight client-side routing without React Router dependencies
- **Form Management**: React Hook Form with Zod validation for type-safe form handling
- **Theme System**: CSS variables-based theming with dark/light mode support

### Backend Architecture
- **Express.js with TypeScript**: RESTful API server using ES modules and modern Node.js features
- **Dual Database Pattern**: SQLite with live/replica setup - live database for active operations, replica for persistence and development
- **Drizzle ORM**: Type-safe database queries with PostgreSQL dialect configuration for future migration
- **File Upload System**: Multer-based file handling with organized storage for signatures and delivery photos
- **Scheduled Tasks**: Node-cron for automated database maintenance and cleanup operations
- **Error Handling**: Structured error responses with request logging and audit trails

### Data Storage Solutions
- **Primary Storage**: SQLite databases with Better-sqlite3 for high performance
- **Database Strategy**: Development mode uses replica DB, production uses live DB with daily resets
- **File Storage**: Local filesystem with organized directory structure for uploaded media
- **Schema Design**: Normalized tables for shipments, acknowledgments, route tracking, and sync status
- **Data Lifecycle**: Automated retention policies with configurable cleanup schedules

### Authentication and Authorization
- **External API Integration**: Django token-based authentication via Printo API proxy
- **Token Management**: Access/refresh token handling with automatic renewal
- **Role-Based Access Control**: Admin, operations, delivery, and user roles with permission-based UI
- **Session Management**: Cookie-based session storage with secure token handling

## External Dependencies

### Core APIs
- **Printo API**: External authentication service at `https://pia.printo.in/api/v1` for user login and token management
- **External Sync API**: Configurable endpoint for shipment status synchronization with retry logic

### Third-Party Libraries
- **Leaflet Maps**: Interactive mapping with custom markers and real-time GPS tracking
- **Sharp**: Image processing for uploaded photos and signatures
- **Axios**: HTTP client with retry logic and exponential backoff for external API calls

### Infrastructure Services
- **WebSocket Server**: Real-time live tracking updates for GPS coordinates and rider status
- **File Upload Service**: Multer with image optimization and storage management
- **Database Migration System**: Drizzle-kit for schema management and PostgreSQL migration readiness

### Development Tools
- **Replit Integration**: Vite plugin for runtime error overlay and development environment integration
- **TypeScript Configuration**: Shared types between client and server with path aliases
- **Linting and Validation**: cSpell for project-specific terminology and code quality tools
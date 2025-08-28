# RiderPro Shipment Management System

## Overview

RiderPro is a comprehensive shipment management system designed for logistics and delivery operations. The application provides a dashboard for tracking shipments, managing deliveries and pickups, and handling acknowledgments with digital signatures and photos. Built as a full-stack application with real-time updates and mobile-responsive design, it serves both operational staff and field workers managing shipment lifecycles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system and CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management with automatic caching and real-time updates
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation for type-safe form management

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: SQLite with Better SQLite3 for local storage, dual database setup (live + replica)
- **ORM**: Drizzle ORM with PostgreSQL dialect configuration (ready for migration)
- **File Handling**: Multer for multipart file uploads (signatures and photos)
- **Scheduling**: Node-cron for automated database maintenance tasks
- **API Design**: RESTful API with structured error handling and request logging

### Data Storage Solutions
- **Primary Database**: SQLite with two instances - live database for active operations and replica database for data persistence
- **File Storage**: Local file system with organized directory structure for uploaded signatures and photos
- **Database Schema**: Normalized schema with shipments and acknowledgments tables, including proper foreign key relationships
- **Data Lifecycle**: Automated daily reset of live database while maintaining historical data in replica

### Authentication and Authorization
- **Current State**: Basic session-based approach with placeholder user context
- **Architecture**: Prepared for expansion with role-based access control
- **Session Management**: Express sessions with configurable storage backend

### External Service Integrations
- **Sync Service**: Built-in external API synchronization with retry logic and error handling
- **Configuration**: Environment-based API endpoint configuration for different deployment environments
- **Resilience**: Automatic retry mechanism with exponential backoff for failed sync operations

### Key Architectural Decisions

**Database Strategy**: Dual SQLite setup chosen for simplicity and reliability while maintaining data persistence. The live database resets daily for operational clarity while the replica preserves historical data. This approach balances performance with data retention needs.

**File Upload Handling**: Local file system storage chosen for signatures and photos with organized directory structure. Files are served through Express static middleware with proper CORS headers for cross-origin access.

**Real-time Updates**: TanStack Query provides automatic background refetching for dashboard metrics and shipment lists, ensuring users see current data without manual refresh actions.

**Component Architecture**: Modular component design with clear separation between UI components, business logic hooks, and API integration layers. This promotes reusability and maintainability.

**Validation Strategy**: Shared Zod schemas between frontend and backend ensure type safety and consistent validation rules across the entire application stack.

## External Dependencies

### Core Runtime Dependencies
- **@neondatabase/serverless**: PostgreSQL adapter ready for cloud database migration
- **better-sqlite3**: High-performance SQLite database driver for local data storage
- **drizzle-kit**: Database migration and schema management toolkit
- **express**: Web application framework for REST API implementation
- **multer**: Middleware for handling multipart/form-data file uploads

### Frontend UI Dependencies
- **@radix-ui/react-***: Comprehensive set of accessible UI primitives for building the component library
- **@tanstack/react-query**: Server state management with caching, background updates, and optimistic updates
- **tailwindcss**: Utility-first CSS framework with custom design system configuration
- **wouter**: Lightweight routing library for single-page application navigation

### Development and Build Tools
- **vite**: Fast build tool and development server with hot module replacement
- **typescript**: Type checking and enhanced developer experience
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay for better debugging
- **esbuild**: Fast JavaScript bundler for production builds

### Utility Libraries
- **axios**: HTTP client for external API communication with interceptors and retry logic
- **zod**: Schema validation library ensuring type safety across frontend and backend
- **node-cron**: Task scheduling for automated database maintenance operations
- **clsx** and **class-variance-authority**: Utility libraries for conditional CSS class management
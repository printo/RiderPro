# RiderPro - Delivery Management System

A comprehensive cloud-first delivery management system built with React, TypeScript, and Supabase, designed for efficient shipment tracking, route optimization, and real-time GPS monitoring with built-in authentication and real-time capabilities.

## 🆕 Latest Updates

### ✅ Enhanced User Interface & Experience (Latest)
- **Pie Chart Analytics**: Beautiful status distribution charts with hover effects and percentages
- **Responsive Design**: Mobile-optimized tabs and layouts for all screen sizes
- **Smart Status Management**: Footer-style action buttons with GPS tracking integration
- **Visual Feedback**: Blinking GPS icons, smooth animations, and intuitive interactions
- **Access Control**: Super user-only revert functionality for status management

### ✅ Advanced Shipment Management
- **Real-time Status Updates**: Live shipment status tracking with GPS coordinates
- **Smart Action Buttons**: Context-aware buttons based on shipment type and status
- **Revert Functionality**: Super users can revert accidental status changes
- **GPS Integration**: Automatic location recording for pickup/delivery events
- **Acknowledgment System**: Photo and signature capture for delivery confirmations

### ✅ Supabase Integration & Cloud Architecture
- **PostgreSQL Database**: Scalable cloud database with automatic backups
- **Real-time Subscriptions**: Live data updates via WebSocket connections
- **Row Level Security**: Built-in data access control and security
- **Authentication**: Integrated user management with JWT tokens
- **File Storage**: Cloud storage for signatures, photos, and documents
- **Edge Functions**: Serverless compute for complex operations

### ✅ Authentication System Overhaul
- **Supabase Auth**: Primary authentication with JWT tokens and session management
- **Local Database Fallback**: Offline authentication for field operations
- **Role-Based Access**: Super User, Ops Team, Staff, Driver roles with granular permissions
- **Password Security**: Built-in bcrypt hashing with automatic salt generation
- **User Management**: Admin panel for user approval and password reset
- **Social Authentication**: Optional Google, GitHub integration

### ✅ API Consolidation & Documentation
- **Complete API Inventory**: 25+ documented endpoints with full specifications
- **Security Enhancements**: Webhook authentication, rate limiting, bcrypt password hashing
- **Code Organization**: Clean folder structure with domain-specific components
- **TypeScript Safety**: Comprehensive type definitions and error handling

## 🚀 Quick Start

### Development Setup
```bash
# Clone and install
git clone <repository-url>
cd riderpro
npm install

# Supabase setup
npm install -g supabase
supabase login
supabase start

# Environment setup
cp .env.example .env
# Edit .env with your Supabase configuration

# Deploy database schema
supabase db push

# Start development server
npm run dev
```

### Access Points
- **Dashboard**: http://localhost:5000/ - Real-time metrics and overview
- **Shipments**: http://localhost:5000/shipments - Enhanced shipment management with GPS tracking
- **Admin Panel**: http://localhost:5000/admin - Complete admin dashboard with user management
- **Settings**: http://localhost:5000/settings - User profile and system settings
- **Supabase Dashboard**: https://supabase.com/dashboard - Database and authentication management

### Supabase Configuration
```bash
# Environment variables for Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

## 📚 Documentation

> **All detailed documentation has been moved to the [`docs/`](./docs/) folder for better organization.**

### 📖 Core Documentation
- **[📋 Documentation Hub](./docs/README.md)** - Complete documentation index and navigation
- **[🏗️ System Architecture](./docs/system-architecture.md)** - Technical architecture and design decisions
- **[📊 API Documentation](./docs/api-documentation.md)** - Comprehensive endpoint documentation
- **[🗄️ Database Schema](./docs/database-schema.md)** - Database design and data lifecycle
- **[🔐 Authentication System](./docs/authentication-system.md)** - Authentication flows and security

### 🔧 Feature Documentation  
- **[🛣️ Smart Route Completion](./docs/smart-route-completion.md)** - AI-powered route optimization
- **[🚀 Production Migration](./docs/production-migration-strategy.md)** - Production deployment and maintenance
- **[🔒 Security Audit](./docs/security-audit-report.md)** - Security assessment and guidelines

## ✨ Key Features

### 🚛 Core Functionality
- **Real-time Shipment Tracking** with live GPS coordinates
- **Location-Based Services** with proximity search and mapping
- **Smart Route Optimization** with AI-powered suggestions  
- **Digital Acknowledgments** with signature and photo capture
- **Batch Operations** for efficient bulk updates
- **Advanced Analytics** with comprehensive metrics
- **Offline Sync** for seamless field operations

### 🔐 Security & Management
- **Dual Authentication System**:
  - **External API**: Integration with Printo API for enterprise users
  - **Local Database**: Self-hosted user management with approval workflow
- **Role-Based Access Control** (Admin, Manager, Driver, Viewer)
- **Password Security**: bcrypt hashing with salt rounds
- **User Management**: Admin panel for user approval and password reset
- **Audit Logging** for all operations and changes
- **File Management** for signatures and delivery photos

### 📱 Mobile Optimization
- **Progressive Web App** capabilities
- **Touch-Optimized** interface for mobile devices
- **Offline-First** architecture for field operations
- **Responsive Design** for all screen sizes

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript for modern component-based UI
- **Vite** for fast development and optimized builds
- **Tailwind CSS** with Shadcn/ui components for styling
- **TanStack Query** for server state management and caching
- **Leaflet** for interactive maps and GPS tracking
- **React Hook Form** with Zod validation
- **Wouter** for lightweight client-side routing

### Backend & Database
- **Supabase** as primary backend service
- **PostgreSQL** database with automatic scaling
- **Supabase Auth** for authentication and user management
- **Supabase Storage** for file uploads and management
- **Supabase Realtime** for live data synchronization
- **Supabase Edge Functions** for serverless compute
- **Node.js** with Express.js for API routes
- **TypeScript** with ES modules for type safety

### Infrastructure
- **Supabase Cloud** for hosting and database management
- **Vercel** for application deployment
- **Sharp** for image processing and optimization
- **Axios** with retry logic for external API calls
- **Node-cron** for automated maintenance tasks

## 🏗️ Project Structure

```
riderpro/
├── 📁 client/          # React frontend application
│   ├── src/
│   │   ├── components/ # UI components organized by domain
│   │   │   ├── ui/     # Base UI components (shadcn/ui)
│   │   │   ├── analytics/ # Analytics components
│   │   │   ├── routes/ # Route tracking components
│   │   │   ├── shipments/ # Shipment management components
│   │   │   ├── sync/   # Offline sync components
│   │   │   └── tracking/ # GPS tracking components
│   │   ├── pages/      # Page components
│   │   ├── hooks/      # Custom React hooks
│   │   ├── services/   # Business logic services
│   │   ├── types/      # TypeScript type definitions
│   │   └── apiClient/  # API integration layer
├── 📁 server/          # Express.js backend API
│   ├── routes.ts       # Main API route definitions
│   ├── db/            # Database connection and queries
│   ├── middleware/    # Authentication and security middleware
│   ├── services/      # Business logic services
│   └── utils/         # Utility functions
├── 📁 shared/         # Shared types and schemas
├── 📁 data/           # Database files
├── 📁 docs/           # Comprehensive documentation
└── 📁 uploads/        # File uploads (photos, signatures)
```

## 🔐 Authentication System

### External API Authentication
- **Endpoint**: `https://pia.printo.in/api/v1/auth/`
- **Method**: POST with `employee_id` and `password`
- **Response**: `access_token`, `refresh_token`, `full_name`, `is_staff`, `is_super_user`, `is_ops_team`
- **Role Assignment**: Based on response flags (Super User → Admin, Ops Team → Manager, Staff → Viewer, Default → Driver)

### Local Database Authentication
- **Registration**: Users register with `rider_id`, `password`, `full_name`, `email`
- **Approval Workflow**: Admin approval required before login
- **Password Security**: bcrypt hashing with 12 salt rounds
- **Token Generation**: Simple token-based authentication for local users
- **Role Assignment**: Local users default to Driver role

### User Management
- **Admin Panel**: Complete user management interface
- **Pending Approvals**: View and manage user registration requests
- **Password Reset**: Admin can reset user passwords
- **Role Management**: Assign and modify user roles

## 🚀 Getting Started for New Developers

### 1. Prerequisites
- Node.js 18+ installed
- Git for version control
- Modern browser with GPS support
- Code editor (VS Code recommended)

### 2. Installation
```bash
# Clone the repository
git clone <repository-url>
cd riderpro

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Initialize database
npm run db:migrate

# Start development server
npm run dev
```

### 3. Development Workflow
```bash
# Start development server
npm run dev

# Run database migrations
npm run db:migrate

# Build for production
npm run build

# Start production server
npm start
```

### 4. Key Development Files
- **Frontend Entry**: `client/src/main.tsx`
- **Backend Entry**: `server/index.ts`
- **API Routes**: `server/routes.ts`
- **Database Schema**: `shared/schema.ts`
- **Type Definitions**: `client/src/types/`

### 5. Testing the Application
1. **Start the application**: `npm run dev`
2. **Access the dashboard**: http://localhost:5000
3. **Test authentication**: Try both external API and local database login
4. **Test features**: Shipment tracking, GPS recording, admin functions

## 📊 API Documentation

The application provides a comprehensive REST API with 25+ endpoints:

- **Authentication**: User login, registration, approval, password reset
- **Shipments**: CRUD operations, batch updates, acknowledgments
- **Routes**: GPS tracking, session management, offline sync
- **Analytics**: Dashboard metrics, performance tracking
- **Admin**: User management, system configuration

See [API Documentation](./docs/api-documentation.md) for complete endpoint documentation.

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

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/new-feature`
3. **Make your changes** and test thoroughly
4. **Commit your changes**: `git commit -m 'Add new feature'`
5. **Push to the branch**: `git push origin feature/new-feature`
6. **Create a Pull Request**

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation for new features
- Follow the existing code style
- Test on both desktop and mobile devices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- **Documentation**: Check the [docs/](./docs/) folder
- **Issues**: Create a GitHub issue
- **Discussions**: Use GitHub Discussions for questions

---

**Built with ❤️ for efficient delivery management**
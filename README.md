# RiderPro - Delivery Management System

A comprehensive delivery management system built with React, TypeScript, and Express.js, designed for efficient shipment tracking, route optimization, and real-time GPS monitoring.

## 🆕 Latest Updates

### ✅ Database Schema & Migration System (Latest)
- **Consolidated Migrations**: Single comprehensive migration file with complete schema
- **Shipment Tracking**: Added start/stop coordinates, km travelled, sync tracking
- **External Integration**: Separate `shipment_id` column for external system tracking
- **Performance Optimization**: Database indexing only during build, not runtime
- **Role-Based Access**: Super User, Ops Team, Staff, Driver roles with specific permissions

### ✅ Authentication System Overhaul
- **Dual Authentication**: External API integration + Local database authentication
- **Role-Based Access**: Super User, Ops Team, Staff, Driver roles with granular permissions
- **Password Security**: bcrypt hashing for all passwords
- **User Management**: Admin panel for user approval and password reset
- **Simplified Storage**: localStorage-only authentication state management

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

# Environment setup
cp .env.example .env
# Edit .env with your configuration

# Initialize database and start
npm run db:migrate
npm run dev
```

### Access Points
- **Dashboard**: http://localhost:5000/ - Real-time metrics and overview
- **Shipments**: http://localhost:5000/shipments - Enhanced shipment management with GPS tracking
- **Admin Panel**: http://localhost:5000/admin - Complete admin dashboard with user management
- **Settings**: http://localhost:5000/settings - User profile and system settings

## 📚 Documentation

> **All detailed documentation has been moved to the [`docs/`](./docs/) folder for better organization.**

### 📖 Core Documentation
- **[📋 Documentation Hub](./docs/README.md)** - Complete documentation index and navigation
- **[🏗️ System Architecture](./docs/system-architecture.md)** - Technical architecture and design decisions
- **[📊 API Inventory](./docs/api-inventory.md)** - Comprehensive endpoint documentation
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

### Backend
- **Node.js** with Express.js framework
- **TypeScript** with ES modules for type safety
- **SQLite** with dual database setup (live + replica)
- **Drizzle ORM** for type-safe database operations
- **Multer** for file uploads (signatures and photos)
- **bcrypt** for secure password hashing
- **JWT** authentication with external API integration

### Infrastructure
- **Better SQLite3** for high-performance database operations
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

See [API Inventory](./docs/api-inventory.md) for complete endpoint documentation.

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
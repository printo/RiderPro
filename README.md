# RiderPro - Delivery Management System

A comprehensive delivery management system built with React, TypeScript, and Express.js, designed for efficient shipment tracking, route optimization, and real-time GPS monitoring.

## 🆕 Latest Updates

### ✅ Location-Based Features (Latest)
- **GPS Coordinates Support**: Latitude and longitude fields added to shipments
- **Proximity Search**: Find shipments within a specified radius
- **Location Analytics**: Track shipments with and without location data
- **Database Migration**: Automatic schema updates for existing installations

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
- **Admin Panel**: http://localhost:5000/admin - Complete admin dashboard

## 📚 Documentation

> **All detailed documentation has been moved to the [`docs/`](./docs/) folder for better organization.**

### 📖 Core Documentation
- **[📋 Documentation Hub](./docs/README.md)** - Complete documentation index and navigation
- **[🏗️ System Architecture](./docs/system-architecture.md)** - Technical architecture and design decisions
- **[🔌 API Documentation](./docs/api-documentation.md)** - Complete REST API reference
- **[🗄️ Database Schema](./docs/database-schema.md)** - Database design and data lifecycle

### 🔧 Feature Documentation  
- **[🛣️ Smart Route Completion](./docs/smart-route-completion.md)** - AI-powered route optimization
- **[🧪 Shipment Testing](./docs/shipment-testing.md)** - Testing procedures and workflows
- **[⚙️ Replit Integration](./docs/replit.md)** - Development environment setup

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
- **Role-Based Access Control** (admin, operations, delivery, user)
- **External Authentication** via Django API integration
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

### Backend
- **Node.js** with Express.js framework
- **TypeScript** with ES modules for type safety
- **SQLite** with dual database setup (live + replica)
- **Drizzle ORM** for type-safe database operations
- **Multer** for file uploads (signatures and photos)
- **JWT** authentication with Django API integration

### Infrastructure
- **Better SQLite3** for high-performance database operations
- **Sharp** for image processing and optimization
- **Axios** with retry logic for external API calls
- **Node-cron** for automated maintenance tasks

## 🏗️ Project Structure

```
riderpro/
├── 📁 client/          # React frontend application
├── 📁 server/          # Express.js backend API
├── 📁 shared/          # Shared TypeScript schemas
├── 📁 docs/            # 📚 Complete documentation
├── 📁 uploads/         # File storage (signatures, photos)
└── 📄 README.md        # This navigation file
```

## 🔧 Development Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run preview         # Preview production build

# Database
npm run db:migrate      # Initialize database schema
npm run db:reset        # Reset database (development)

# Testing & Quality
npm test                # Run test suite
npm run lint            # Code linting
npx tsc --noEmit        # TypeScript check
```

## 🌐 Environment Configuration

### Required Environment Variables
```bash
# Database
DATABASE_URL=./server/db/sqlite.db
REPLICA_DATABASE_URL=./server/db/replica_sqlite.db

# External API
EXTERNAL_API_URL=https://pia.printo.in/api/v1
API_TIMEOUT=10000

# File Upload
UPLOAD_DIR=./server/uploads
MAX_FILE_SIZE=10485760

# Development
NODE_ENV=development
PORT=5000
```

## 🔐 Authentication & Roles

The system integrates with Django-based authentication:

- **admin**: Full system access and configuration
- **isops**: Operations team with view-only access  
- **isdelivery**: Field workers with shipment update capabilities
- **user**: Basic access with limited permissions

## 📊 Key Metrics & Analytics

- **Real-time Dashboard** with shipment status overview
- **Route Performance** metrics and optimization suggestions
- **Delivery Analytics** with completion rates and timing
- **Employee Performance** tracking and reporting
- **System Health** monitoring and sync status

## 🚀 Deployment

### Production Deployment
1. Build the application: `npm run build`
2. Configure production environment variables
3. Initialize production database: `npm run db:migrate`
4. Start the server: `npm start`

### Docker Deployment (Optional)
```bash
# Build and run with Docker
docker build -t riderpro .
docker run -p 5000:5000 riderpro
```

## 🆘 Support & Contributing

### Getting Help
1. **Check Documentation**: Start with [`docs/README.md`](./docs/README.md)
2. **API Issues**: Review [`docs/api-documentation.md`](./docs/api-documentation.md)
3. **Architecture Questions**: See [`docs/system-architecture.md`](./docs/system-architecture.md)
4. **Database Issues**: Check [`docs/database-schema.md`](./docs/database-schema.md)

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Update relevant documentation in `docs/`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**📚 For detailed technical documentation, API references, and feature guides, visit the [`docs/`](./docs/) directory.**
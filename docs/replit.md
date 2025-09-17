# RiderPro Setup Guide

## Prerequisites
- Node.js 18+ 
- npm or yarn
- Your external authentication API endpoint

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set:
   ```env
   # Printo API Configuration
   PRINTO_API_BASE_URL=https://pia.printo.in/api/v1
   ```

3. **Initialize SQLite database:**
   ```bash
   npm run migrate
   ```

4. **Start the application:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm run build
   npm start
   ```

5. **Login with your Printo credentials:**
   - Email: `12180`
   - Password: `Shadow@12180`
   - The system will authenticate via Printo API and store your Bearer token

## Printo API Authentication

The system integrates with Printo API for unified authentication.

The login endpoint accepts POST requests with this format:

**Login Request:**
```json
{
  "email": "12180",
  "password": "Shadow@12180"
}
```

**Login Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ0eXAiO...",
    "refreshToken": "eyJ0eX0...",
    "user": {
      "id": "12180",
      "username": "12180",
      "email": "12180@printo.in",
      "role": "admin",
      "employeeId": "12180",
      "fullName": "User Name",
      "permissions": ["view_all_routes", "manage_users", ...]
    }
  }
}
```

**Using Bearer Token:**
All subsequent API calls use the Bearer token:
```bash
curl -H "Authorization: Bearer eyJ0eXAiO..." \
     https://your-app.com/api/shipments
```

## Database

The system uses SQLite stored in `./data/riderpro.db`. The database will be created automatically when you run migrations.

## Features

- ✅ GPS route tracking
- ✅ Real-time analytics
- ✅ Fuel consumption monitoring
- ✅ Employee performance metrics
- ✅ Mobile-optimized interface
- ✅ Offline capability with sync
- ✅ Privacy compliance (GDPR)
- ✅ Audit logging
- ✅ External authentication integration

## File Structure

```
├── client/          # React frontend
├── server/          # Node.js backend
├── shared/          # Shared types and schemas
├── data/            # SQLite database (auto-created)
└── docs/            # Documentation
```

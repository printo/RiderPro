# API Inventory and Use Cases

This document provides a comprehensive list of all APIs used in the system and their specific use cases.

## Internal APIs (Our Server Endpoints)

### Authentication & Authorization

| Endpoint | Method | Use Case |
|----------|--------|----------|
| `/api/auth/login` | POST | User login with email/password via Printo API |
| `/api/auth/refresh` | POST | Refresh expired access tokens |
| `/api/health` | GET | System health check with rate limiting |

### Shipment Management

| Endpoint | Method | Use Case |
|----------|--------|----------|
| `/api/shipments` | GET | Get shipments with filters, pagination, and sorting |
| `/api/shipments/:id` | GET | Get single shipment details with acknowledgment |
| `/api/shipments` | POST | Create new shipment |
| `/api/shipments/:id` | PATCH | Update single shipment status |
| `/api/shipments/batch` | PATCH | Batch update multiple shipments |
| `/api/shipments/:id/acknowledgement` | POST | Upload delivery acknowledgment with photo/signature |
| `/api/shipments/:id/remarks` | POST | Add remarks for cancelled/returned shipments |
| `/api/shipments/:id` | DELETE | Delete shipment (admin only) |
| `/api/shipments/receive` | POST | Receive external shipment data (webhook) |
| `/api/shipments/update/external` | POST | Send single shipment update to external system |
| `/api/shipments/update/external/batch` | POST | Send batch shipment updates to external system |

### Route Tracking & GPS

| Endpoint | Method | Use Case |
|----------|--------|----------|
| `/api/routes/start` | POST | Start a new route session for driver |
| `/api/routes/stop` | POST | Stop active route session |
| `/api/routes/coordinates` | POST | Submit GPS coordinates during route |
| `/api/routes/session/:sessionId` | GET | Get session data and coordinates |
| `/api/routes/coordinates/batch` | POST | Batch submit GPS coordinates (offline sync) |

### Dashboard & Analytics

| Endpoint | Method | Use Case |
|----------|--------|----------|
| `/api/dashboard` | GET | Get dashboard metrics and statistics |

### Data Synchronization

| Endpoint | Method | Use Case |
|----------|--------|----------|
| `/api/sync/stats` | GET | Get synchronization statistics |
| `/api/sync/trigger` | POST | Trigger manual data sync with external systems |

### API Token Management (Admin)

| Endpoint | Method | Use Case |
|----------|--------|----------|
| `/api/admin/tokens` | POST | Create new API token |
| `/api/admin/tokens` | GET | List all API tokens |
| `/api/admin/tokens/:id/status` | PATCH | Enable/disable/revoke API token |
| `/api/admin/tokens/:id/usage` | GET | Get token usage statistics |
| `/api/admin/tokens/analytics` | GET | Get comprehensive usage analytics |
| `/api/admin/tokens/patterns` | GET | Get usage patterns |
| `/api/admin/tokens/export` | GET | Export usage data (JSON/CSV) |
| `/api/admin/tokens/expiring` | GET | Get tokens expiring soon |
| `/api/admin/tokens/cleanup` | POST | Clean up expired tokens and old data |
| `/api/admin/tokens/expiration-status` | GET | Get expiration monitoring status |
| `/api/admin/tokens/health` | GET | Check API token database health |
| `/api/admin/tokens/errors` | GET | Get API token error statistics |
| `/api/admin/tokens/maintenance` | POST | Perform database maintenance |

### Error Logging

| Endpoint | Method | Use Case |
|----------|--------|----------|
| `/api/errors` | POST | Log client-side errors for monitoring |

### File Management

| Endpoint | Method | Use Case |
|----------|--------|----------|
| `/uploads/*` | GET | Serve uploaded files (photos, signatures) |

## External APIs (Third-party Services)

### Printo API Integration

| Endpoint | Method | Use Case |
|----------|--------|----------|
| `https://pia.printo.in/api/v1/auth/` | POST | Primary user authentication |
| `https://pia.printo.in/api/v1/auth/refresh/` | POST | Refresh access tokens |
| `https://pia.printo.in/api/v1/auth/me/` | GET | Verify user token and get user info |

**Authentication Flow:**
1. User enters credentials in our login form
2. We send credentials to Printo API for verification
3. Printo API returns access/refresh tokens and user data
4. We map Printo user roles to our internal roles
5. We store tokens for subsequent API calls

**Role Mapping:**
- `is_admin` → `admin`
- `is_super_admin` → `super_admin`
- `is_ops_team` → `ops_team`
- `is_delivery` → `driver`
- Default → `driver`

## Client-Side API Usage Patterns

### API Service Files

| File | Purpose | APIs Used |
|------|---------|-----------|
| `client/src/services/ApiClient.ts` | Core HTTP client with auth, retry, offline support | All internal APIs |
| `client/src/services/AuthService.ts` | Authentication management | Printo API, `/api/auth/*` |
| `client/src/api/shipments.ts` | Shipment operations | `/api/shipments/*`, `/api/dashboard` |
| `client/src/api/routes.ts` | Route tracking operations | `/api/routes/*` |
| `client/src/api/analytics.ts` | Analytics and reporting | `/api/analytics/*` (if implemented) |

### Common Usage Patterns

**Authentication Pattern:**
```typescript
// Login flow
authService.login(email, password) 
→ POST /api/auth/login 
→ Printo API authentication
→ Store tokens locally
```

**Shipment Management Pattern:**
```typescript
// Get shipments with filters
shipmentsApi.getShipments(filters)
→ GET /api/shipments?status=pending&page=1
```

**Route Tracking Pattern:**
```typescript
// Start route session
routeAPI.startSession(data)
→ POST /api/routes/start

// Submit GPS coordinates
routeAPI.submitCoordinates(gpsData)
→ POST /api/routes/coordinates
```

**File Upload Pattern:**
```typescript
// Upload acknowledgment with files
FormData with photo/signature
→ POST /api/shipments/:id/acknowledgement
```

## Webhook Endpoints

### Incoming Webhooks (External → Our System)

| Endpoint | Purpose | Source |
|----------|---------|--------|
| `/api/shipments/receive` | Receive shipment data from external systems | External logistics systems |

**Webhook Security:**
- Bearer token authentication
- Rate limiting
- Payload size limits
- HTTPS enforcement in production

### Outgoing Webhooks (Our System → External)

| Target | Purpose | Trigger |
|--------|---------|---------|
| External logistics API | Send shipment updates | Status changes, acknowledgments |
| External logistics API | Batch shipment updates | Scheduled sync, manual trigger |

## API Authentication Methods

| Method | Used For | Description |
|--------|----------|-------------|
| JWT Tokens | User authentication | Standard user sessions |
| API Tokens | System integration | Machine-to-machine communication |
| Webhook Auth | External integrations | Bearer token for webhook security |
| Either Auth | Flexible endpoints | Accepts both JWT and API tokens |

## Error Handling Patterns

**Client-Side Error Handling:**
- Network errors: Retry with exponential backoff
- 401 errors: Automatic token refresh
- 403 errors: Permission denied notification
- 5xx errors: Retry with user notification
- Offline mode: Queue requests for later sync

**Server-Side Error Responses:**
- Consistent JSON error format
- Appropriate HTTP status codes
- Detailed error messages for debugging
- Rate limiting with retry headers

## Performance Optimizations

**Caching:**
- Health check endpoint: 10-second cache
- Static file serving with appropriate headers
- Client-side request caching where appropriate

**Rate Limiting:**
- Health check: 10 requests/minute per IP
- Webhook endpoints: Configurable rate limits
- API token creation: Rate limited per user

**Batch Operations:**
- GPS coordinates: Batch submission for offline sync
- Shipment updates: Batch processing for efficiency
- External sync: Batch webhook delivery

## Monitoring & Analytics

**API Usage Tracking:**
- Request counts per endpoint
- Response times and error rates
- Token usage statistics
- Webhook delivery success rates

**Health Monitoring:**
- Database connectivity checks
- External API availability
- Token expiration monitoring
- Error rate thresholds

## Security Considerations

**Authentication Security:**
- Token rotation and expiration
- Secure token storage
- Rate limiting on auth endpoints
- HTTPS enforcement

**API Security:**
- Input validation and sanitization
- SQL injection prevention
- CORS configuration
- Request size limits

**Webhook Security:**
- Signature verification
- IP whitelisting (if needed)
- Payload validation
- Replay attack prevention
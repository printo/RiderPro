# RiderPro Django Backend - API Endpoints

Complete list of API endpoints matching Node.js backend structure.

## Authentication

- `POST /api/auth/login` - Login (returns JWT tokens)
- `POST /api/auth/refresh` - Refresh token

## Shipments

- `GET /api/shipments/fetch` - List shipments (with filters, pagination)
- `GET /api/shipments/{id}/` - Get single shipment
- `POST /api/shipments/create` - Create shipment
- `PATCH /api/shipments/{id}/` - Update shipment
- `PATCH /api/shipments/batch` - Batch update shipments
- `POST /api/shipments/{id}/remarks` - Add remarks to shipment
- `POST /api/shipments/{id}/acknowledgement` - Upload acknowledgment (signature/photo)
- `GET /api/dashboard/metrics` - Dashboard metrics

## Routes (Route Tracking)

- `POST /api/routes/start` - Start route session
- `POST /api/routes/stop` - Stop route session
- `POST /api/routes/coordinates` - Submit GPS coordinates
- `POST /api/routes/coordinates/batch` - Batch submit GPS coordinates
- `POST /api/routes/shipment-event` - Record shipment event (pickup/delivery)
- `GET /api/routes/session/{sessionId}` - Get session data
- `POST /api/routes/sync-session` - Sync offline session
- `POST /api/routes/sync-coordinates` - Sync offline coordinates
- `POST /api/routes/track-location` - Track user location in real-time
- `GET /api/routes/current-location` - Get current location of authenticated user
- `GET /api/routes/active-riders` - Get locations of all active riders (admin/manager only)

## Vehicles

- `GET /api/vehicle-types/` - List vehicle types
- `GET /api/vehicle-types/{id}/` - Get vehicle type
- `POST /api/vehicle-types/` - Create vehicle type
- `PUT /api/vehicle-types/{id}/` - Update vehicle type
- `DELETE /api/vehicle-types/{id}/` - Delete vehicle type

## Fuel Settings

- `GET /api/fuel-settings/` - List fuel settings
- `GET /api/fuel-settings/{id}/` - Get fuel setting
- `POST /api/fuel-settings/` - Create fuel setting
- `PUT /api/fuel-settings/{id}/` - Update fuel setting
- `DELETE /api/fuel-settings/{id}/` - Delete fuel setting

## Sync

- `GET /api/sync/stats` - Get sync statistics
- `POST /api/sync/trigger` - Trigger manual sync
- `GET /api/sync/sync-status` - Get sync status for shipments
- `POST /api/sync/shipments/{shipment_id}/sync` - Sync single shipment
- `POST /api/sync/batch-sync` - Batch sync shipments

## Health

- `GET /health` - Health check
- `GET /api/health` - API health check
- `GET /api-status` - API status

## Webhooks (POPS Integration)

- `POST /api/shipments/webhooks/receive-order` - Receive order from POPS
- `POST /api/shipments/webhooks/order-status` - Receive order status update from POPS

## Notes

- All endpoints require authentication except health checks and webhooks
- Pagination headers: `X-Total-Count`, `X-Total-Pages`, `X-Current-Page`, `X-Per-Page`, `X-Has-Next-Page`, `X-Has-Previous-Page`
- Role-based access: Admins/managers see all, riders see only their assigned shipments







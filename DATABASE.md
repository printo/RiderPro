# Database Documentation

## PostgreSQL 15 Schema

### Core Tables

#### 1. **shipments** (Primary table)
External shipment data from API with sync tracking.

**Key Columns**:
```sql
id                      VARCHAR(255) PRIMARY KEY  -- External shipment ID (UNIQUE)
type                    VARCHAR(50)               -- 'delivery' | 'pickup'
customerName            TEXT
customerMobile          TEXT
address                 TEXT
latitude, longitude     REAL                      -- GPS coordinates
employeeId              TEXT                      -- Rider/driver ID
status                  VARCHAR(50)               -- Shipment status
createdAt, updatedAt    TIMESTAMP WITH TIME ZONE
priority                VARCHAR(20)               -- 'high' | 'medium' | 'low'

-- Tracking fields
start_latitude, start_longitude  REAL
stop_latitude, stop_longitude    REAL
km_travelled            REAL

-- Sync tracking
synced_to_external      BOOLEAN
sync_status             VARCHAR(20)
sync_attempts           INTEGER
last_sync_attempt       TIMESTAMP

-- Acknowledgment
signature_url           TEXT
photo_url               TEXT
```

**Unique Constraint**: `id` (shipment ID) prevents duplicates automatically.

**Indexes**:
```sql
idx_shipments_employee_id        -- Role-based filtering
idx_shipments_created_at         -- Date queries
idx_shipments_sync_status        -- Sync tracking
```

---

#### 2. **route_sessions**
Route tracking sessions per employee.

**Key Columns**:
```sql
id                VARCHAR(255) PRIMARY KEY
employee_id       VARCHAR(255)
start_time        TIMESTAMP WITH TIME ZONE
end_time          TIMESTAMP WITH TIME ZONE
status            VARCHAR(50)              -- 'active' | 'completed'
total_distance    REAL
total_time        INTEGER                  -- seconds
fuel_consumed     REAL
shipments_completed INTEGER
```

**Indexes**:
```sql
idx_route_sessions_employee      -- Employee queries
```

---

#### 3. **route_tracking**
GPS coordinates for route visualization.

**Key Columns**:
```sql
id            SERIAL PRIMARY KEY
session_id    VARCHAR(255)
employee_id   VARCHAR(255)
latitude      REAL
longitude     REAL
timestamp     TIMESTAMP WITH TIME ZONE
date          DATE
speed         REAL
```

**Indexes**:
```sql
idx_route_tracking_employee_date -- Analytics queries
idx_route_tracking_timestamp     -- Time-series queries
```

---

#### 4. **users**
Authentication and authorization.

**Key Columns**:
```sql
id              VARCHAR(255) PRIMARY KEY
username        VARCHAR(255) UNIQUE
email           VARCHAR(255) UNIQUE
role            VARCHAR(50)            -- 'viewer' | 'driver' | 'manager' | 'admin'
employee_id     VARCHAR(255)
is_active       BOOLEAN
is_super_user   BOOLEAN
is_ops_team     BOOLEAN
```

**Indexes**:
```sql
idx_users_employee_id            -- Role-based access
idx_users_role                   -- Permission checks
```

---

## Role-Based Query Patterns

### Rider (Driver) - Limited Access
```sql
-- Only their shipments
SELECT * FROM shipments 
WHERE "employeeId" = $1           -- Current user's employee_id
ORDER BY "createdAt" DESC;

-- Uses index: idx_shipments_employee_id
```

### Admin/Ops - Full Access
```sql
-- All shipments
SELECT * FROM shipments 
WHERE "createdAt" >= $1           -- Optional date filter
ORDER BY "createdAt" DESC;

-- Uses index: idx_shipments_created_at
```

---

## Data Integrity (Duplicate Prevention)

### Shipment CRUD Operations

**Insert (from external API)**:
```sql
INSERT INTO shipments (id, type, customerName, ...)
VALUES ($1, $2, $3, ...)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  updatedAt = CURRENT_TIMESTAMP,
  synced_to_external = EXCLUDED.synced_to_external;
```
✅ **Result**: No duplicates, updates existing if ID matches.

**Update (by user)**:
```sql
UPDATE shipments 
SET status = $1, updatedAt = CURRENT_TIMESTAMP
WHERE id = $2;                    -- id is unique constraint
```
✅ **Result**: Single shipment updated, no duplicates possible.

**Delete**:
```sql
DELETE FROM shipments WHERE id = $1;
```
✅ **Result**: Single shipment deleted.

---

## Backup Strategy

### Dev/Alpha: Automatic 3-Day Backup
- **Frequency**: Every hour
- **Retention**: Last 3 days (rolling window)
- **Purpose**: Testing with realistic recent data

```sql
-- Cleanup old data
DELETE FROM shipments WHERE "createdAt" < (CURRENT_DATE - INTERVAL '3 days');

-- Sync recent data
INSERT INTO shipments (...) 
SELECT * FROM main_db.shipments 
WHERE "createdAt" >= (CURRENT_DATE - INTERVAL '3 days')
ON CONFLICT (id) DO UPDATE ...;
```

### Production: Manual Backups
Use PostgreSQL native tools:
- `pg_dump` for full backups
- WAL archiving for point-in-time recovery
- Managed backup services (recommended)

---

## Performance Optimization

### Index Strategy
- **Employee-based queries**: Use `idx_shipments_employee_id`
- **Date-based queries**: Use `idx_shipments_created_at`
- **No status-based indexes**: Status has many values, filtering happens in application layer

### Connection Pooling
```typescript
max: 20 connections (production)
max: 10 connections (development)
idleTimeoutMillis: 30000
connectionTimeoutMillis: 2000
```

---

## Health Monitoring

### Endpoint: `/health`
```json
{
  "status": "ok",
  "database": {
    "main": true,
    "backup": true
  }
}
```

### Check Active Connections
```sql
SELECT count(*) FROM pg_stat_activity;
```

### Check Slow Queries
```sql
SELECT pid, now() - query_start as duration, query 
FROM pg_stat_activity 
WHERE state = 'active' 
ORDER BY duration DESC;
```

---

## Migration Management

```bash
# Apply migrations
npm run db:migrate

# Rollback
npm run db:migrate:down

# Verify setup
npm run db:verify
```

**Migration Table**:
```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name VARCHAR(255),
  applied_at TIMESTAMP WITH TIME ZONE
);
```

---

## Common Queries

### Get pending sync shipments
```sql
SELECT * FROM shipments 
WHERE synced_to_external = false
ORDER BY "updatedAt" DESC;
```

### Get rider's active routes
```sql
SELECT * FROM route_sessions 
WHERE employee_id = $1 
  AND status = 'active';
```

### Analytics: Daily shipments by employee
```sql
SELECT 
  "employeeId", 
  DATE("createdAt") as date,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as delivered
FROM shipments
WHERE DATE("createdAt") >= $1
GROUP BY "employeeId", DATE("createdAt");
```

---

## Troubleshooting

**Connection issues**: Check `DATABASE_URL` environment variable  
**Slow queries**: Run `EXPLAIN ANALYZE` on the query  
**Duplicate data**: Verify `id` column is used as unique identifier  
**Backup not syncing**: Only works in dev/alpha (`DEPLOYMENT_ENV=localhost`)

---

**Schema Version**: 1  
**Last Updated**: January 2026

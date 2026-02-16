# RiderPro Database Schema (PostgreSQL 15)

## Overview
RiderPro uses **PostgreSQL 15** for core logistics data. The application uses a **Django** backend with a schema that follows Django conventions (snake_case column names).

**Database Name**: `riderpro_django`

---

## Core Tables

### 1. `shipments` Table
Stores all delivery and pickup orders.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `VARCHAR(255)` | Primary Key (External shipment ID) |
| `pops_order_id` | `INTEGER` | Original Order ID from POPS (Indexed) |
| `type` | `VARCHAR(50)` | `delivery` or `pickup` |
| `customer_name` | `TEXT` | Recipient name |
| `customer_mobile` | `TEXT` | Recipient contact |
| `address` | `TEXT` | Full address (stored as string) |
| `latitude` | `DOUBLE PRECISION` | Target GPS latitude |
| `longitude` | `DOUBLE PRECISION` | Target GPS longitude |
| `employee_id` | `VARCHAR(255)` | Assigned rider/driver ID (Indexed) |
| `status` | `VARCHAR(50)` | `Initiated`, `Assigned`, `In Transit`, `Delivered`, etc. |
| `delivery_time` | `TIMESTAMPTZ` | Expected delivery/pickup time |
| `created_at` | `TIMESTAMPTZ` | Record creation time (Indexed) |
| `updated_at` | `TIMESTAMPTZ` | Last modification time |
| `synced_to_external` | `BOOLEAN` | If successfully synced back to POPS |
| `sync_status` | `VARCHAR(20)` | `pending`, `synced`, `failed` |

**Key Indexes**:
- `shipments_pops_or_060b79_idx`: Optimized for POPS ID lookups.
- `shipments_employe_1f5ee4_idx`: Optimized for role-based filtering (employee view).
- `shipments_created_b63910_idx`: Optimized for date-range queries and cleanup.
- `shipments_status_cde5ad_idx`: Composite index for status/type/route/date filtering.

### 2. `route_sessions` Table
Tracks active delivery sessions for riders.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `VARCHAR(255)` | Primary Key (Session ID) |
| `employee_id` | `VARCHAR(255)` | Rider ID (Indexed) |
| `status` | `VARCHAR(50)` | `active`, `completed`, `paused` |
| `start_time` | `TIMESTAMPTZ` | Session start time |
| `end_time` | `TIMESTAMPTZ` | Session end time |
| `total_distance` | `DOUBLE PRECISION` | Total KM travelled |

**Key Indexes**:
- `route_sessi_employe_3f278e_idx`: Optimized for employee session lookups.
- `route_sessi_start_t_ad9d26_idx`: Optimized for time-based analytics.

### 3. `route_tracking` Table
High-frequency GPS breadcrumbs.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER` | Primary Key (Identity) |
| `session_id` | `VARCHAR(255)` | Foreign Key to `route_sessions` |
| `employee_id` | `VARCHAR(255)` | Rider ID (Indexed) |
| `latitude` | `DOUBLE PRECISION` | GPS Latitude |
| `longitude` | `DOUBLE PRECISION` | GPS Longitude |
| `timestamp` | `TIMESTAMPTZ` | Time of GPS point |
| `date` | `DATE` | Optimization for daily analytics |

**Key Indexes**:
- `route_track_employe_f17c96_idx`: Composite index (employee_id, date) for daily paths.
- `route_track_timesta_accf9f_idx`: Optimized for time-series playback.
- `route_track_session_059453_idx`: Optimized for session-based path retrieval.

---

## Role-Based Query Patterns

### 1. Rider View (Fetch assigned shipments)
```sql
SELECT * FROM shipments 
WHERE employee_id = 'EMP123' 
AND status NOT IN ('Delivered', 'Cancelled', 'Returned')
ORDER BY created_at DESC;
```

### 2. Admin View (Dashboard Metrics)
```sql
SELECT status, count(*) 
FROM shipments 
WHERE created_at >= CURRENT_DATE 
GROUP BY status;
```

### 3. Data Cleanup (Retention Policy)
To maintain performance, shipments older than 3 days are purged or archived daily.
```sql
DELETE FROM shipments 
WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL '3 days');
```

---

## Data Integrity Measures

1. **Unique Order IDs**: `pops_order_id` is indexed and used as a source of truth for uniqueness during sync.
2. **Transaction Safety**: Django handles database atomicity during status updates and GPS recording.
3. **Role Enforcement**: `employee_id` is used for data segmentation in the Django view layer (`get_queryset`).

---

## Performance Optimization

1. **Indexes**: Django migrations automatically create indices for foreign keys and fields marked with `db_index=True`.
2. **JSON Content**: Fields like `pickup_address` and `package_boxes` use Django's `JSONField` (stored as `TEXT` in current schema but handled by Django).
3. **VACUUM Tuning**: Automated vacuuming is managed by PostgreSQL to handle high-frequency updates.

---

## Migration Management

```bash
# Run migrations from within the django container
python manage.py migrate
```

**Metadata**:
- **Schema Owner**: Django `apps.shipments.models.Shipment`
- **Last Updated**: February 2026 (Verified against live DB)

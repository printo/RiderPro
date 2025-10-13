# Database Schema Documentation

## Overview

RiderPro uses SQLite as the primary database with a dual-database setup:
- **Live Database** (`sqlite.db`): Active operations in production
- **Replica Database** (`replica_sqlite.db`): Development and data persistence

## Database Strategy

### Development Mode
- Uses replica database for all operations
- Maintains data persistence across development sessions
- Safe for testing and development without affecting production data

### Production Mode
- Uses live database for active operations
- Daily automated reset to maintain performance
- Historical data preserved in replica database

## Schema Design

### Shipments Table

The core table storing all shipment information.

```sql
CREATE TABLE shipments (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('delivery', 'pickup')),
  customerName TEXT NOT NULL,
  customerMobile TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  cost REAL NOT NULL,
  deliveryTime TEXT NOT NULL,
  routeName TEXT NOT NULL,
  employeeId TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Assigned' 
    CHECK(status IN ('Assigned', 'In Transit', 'Delivered', 'Picked Up', 'Returned', 'Cancelled')),
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);
```

#### Field Descriptions
- `id`: Unique shipment identifier (UUID format)
- `type`: Shipment operation type (delivery or pickup)
- `customerName`: Customer's full name
- `customerMobile`: Customer's contact number
- `address`: Complete delivery/pickup address
- `latitude`: GPS latitude coordinate (optional, -90 to 90)
- `longitude`: GPS longitude coordinate (optional, -180 to 180)
- `cost`: Shipment cost in decimal format
- `deliveryTime`: Scheduled delivery/pickup time (ISO 8601)
- `routeName`: Assigned route identifier
- `employeeId`: Assigned employee/rider identifier
- `status`: Current shipment status with workflow constraints
- `createdAt`: Record creation timestamp
- `updatedAt`: Last modification timestamp

#### Status Workflow
```
Assigned → In Transit → Delivered/Picked Up
    ↓           ↓
Cancelled ← Returned
```

### Acknowledgments Table

Stores digital signatures and photos for completed deliveries.

```sql
CREATE TABLE acknowledgments (
  id TEXT PRIMARY KEY,
  shipmentId TEXT NOT NULL,
  signatureUrl TEXT,
  photoUrl TEXT,
  capturedAt TEXT NOT NULL,
  FOREIGN KEY (shipmentId) REFERENCES shipments (id) ON DELETE CASCADE
);
```

#### Field Descriptions
- `id`: Unique acknowledgment identifier
- `shipmentId`: Reference to parent shipment
- `signatureUrl`: Path to stored signature image file
- `photoUrl`: Path to stored delivery photo file
- `capturedAt`: Timestamp when acknowledgment was captured

#### File Storage Structure
```
uploads/
├── signatures/
│   └── {shipmentId}_{timestamp}.png
└── photos/
    └── {shipmentId}_{timestamp}.jpg
```

### Sync Status Table

Tracks synchronization status with external systems.

```sql
CREATE TABLE sync_status (
  id TEXT PRIMARY KEY,
  shipmentId TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'success', 'failed')),
  attempts INTEGER DEFAULT 0,
  lastAttempt TEXT,
  error TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (shipmentId) REFERENCES shipments (id) ON DELETE CASCADE
);
```

#### Field Descriptions
- `id`: Unique sync record identifier
- `shipmentId`: Reference to shipment being synchronized
- `status`: Current synchronization status
- `attempts`: Number of sync attempts made
- `lastAttempt`: Timestamp of most recent sync attempt
- `error`: Error message from failed sync attempts
- `createdAt`: Record creation timestamp

#### Sync Status Workflow
```
pending → success
    ↓
  failed (with retry logic)
```

## Indexes and Performance

### Primary Indexes
```sql
-- Automatic primary key indexes
CREATE UNIQUE INDEX idx_shipments_id ON shipments(id);
CREATE UNIQUE INDEX idx_acknowledgments_id ON acknowledgments(id);
CREATE UNIQUE INDEX idx_sync_status_id ON sync_status(id);
```

### Performance Indexes
```sql
-- Shipment queries
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_employee ON shipments(employeeId);
CREATE INDEX idx_shipments_route ON shipments(routeName);
CREATE INDEX idx_shipments_type ON shipments(type);
CREATE INDEX idx_shipments_created ON shipments(createdAt);
CREATE INDEX idx_shipments_location ON shipments(latitude, longitude);

-- Foreign key relationships
CREATE INDEX idx_acknowledgments_shipment ON acknowledgments(shipmentId);
CREATE INDEX idx_sync_status_shipment ON sync_status(shipmentId);

-- Sync operations
CREATE INDEX idx_sync_status_status ON sync_status(status);
CREATE INDEX idx_sync_status_attempts ON sync_status(attempts);
```

## Data Lifecycle Management

### Automated Cleanup
- **Daily Reset**: Live database reset at midnight (production)
- **File Cleanup**: Orphaned files removed during database reset
- **Sync Cleanup**: Failed sync records older than 30 days removed

### Data Retention
- **Active Data**: Current day operations in live database
- **Historical Data**: All data preserved in replica database
- **File Storage**: Acknowledgment files retained for 90 days

### Migration Readiness

The schema is designed for easy migration to PostgreSQL:

```sql
-- PostgreSQL equivalent types
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
cost DECIMAL(10,2),
deliveryTime TIMESTAMP WITH TIME ZONE
```

## Backup and Recovery

### Backup Strategy
- **Automated Backups**: Daily backup of replica database
- **File Backups**: Weekly backup of uploads directory
- **Point-in-Time Recovery**: Transaction log preservation

### Recovery Procedures
1. **Database Recovery**: Restore from most recent backup
2. **File Recovery**: Restore uploads from backup archive
3. **Sync Recovery**: Re-trigger failed synchronizations

## Security Considerations

### Data Protection
- **No Sensitive Data**: No credit card or payment information stored
- **Customer Privacy**: Mobile numbers and addresses encrypted in transit
- **Access Control**: Database access restricted to application layer

### Audit Trail
- **Change Tracking**: All status updates logged with timestamps
- **User Attribution**: Employee ID tracked for all modifications
- **Sync Monitoring**: External API interactions logged and monitored
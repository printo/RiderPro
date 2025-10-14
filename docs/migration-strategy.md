# Migration Strategy: Why Drop Tables First?

## Why We Drop Tables Before Creating Them

### 1. **Schema Evolution Requirements**
When we consolidate multiple tables into one (like merging `acknowledgments` and `sync_status` into `shipments`), we need to:
- Remove the old table structure completely
- Create a new unified table with all fields
- Ensure no data conflicts or orphaned records

### 2. **SQLite Limitations**
SQLite has limited ALTER TABLE capabilities:
- Cannot easily rename columns
- Cannot drop columns directly
- Cannot change column types easily
- Cannot add complex constraints to existing tables

### 3. **Data Integrity**
By dropping and recreating:
- We ensure a clean slate
- No orphaned foreign key references
- No conflicting indexes
- No data type mismatches

### 4. **Development vs Production**
- **Development**: Safe to drop/recreate for schema changes
- **Production**: Would need data migration scripts (not implemented here)

### 5. **Alternative Approaches (Not Used Here)**
```sql
-- Complex migration (what we avoid):
ALTER TABLE shipments ADD COLUMN signatureUrl TEXT;
ALTER TABLE shipments ADD COLUMN photoUrl TEXT;
-- ... many more ALTER statements
-- Then drop old tables
-- Then recreate indexes
```

### 6. **Our Approach Benefits**
```sql
-- Simple and clean:
DROP TABLE IF EXISTS acknowledgments;
DROP TABLE IF EXISTS sync_status;
DROP TABLE IF EXISTS shipments;
CREATE TABLE shipments (
  -- All fields in one place
  shipment_id TEXT PRIMARY KEY,
  signatureUrl TEXT,
  photoUrl TEXT,
  -- ... all other fields
);
```

### 7. **When This Strategy Works**
- ✅ Development environment
- ✅ Fresh deployments
- ✅ Schema consolidation
- ✅ When data loss is acceptable

### 8. **When This Strategy Doesn't Work**
- ❌ Production with critical data
- ❌ When you need to preserve existing data
- ❌ When you have complex data relationships

## Recommendation for Production

For production environments, you would need:
1. **Data Backup**: Full database backup before migration
2. **Data Migration Scripts**: Move data from old tables to new structure
3. **Rollback Plan**: Ability to restore if migration fails
4. **Gradual Migration**: Migrate data in batches

## Current Implementation

Our current approach is suitable for:
- Development and testing
- Fresh deployments
- Schema consolidation projects
- When you can afford to lose existing data

The `DROP TABLE IF EXISTS` ensures the migration won't fail if tables don't exist, making it safe to run multiple times.

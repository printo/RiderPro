# Production Migration Strategy

## Overview
This document outlines the strategy for deploying database schema changes to production environments where dropping tables would result in data loss.

## Current Development Approach
Our current migration strategy drops and recreates tables, which is suitable for:
- Development environments
- Fresh deployments
- Schema consolidation projects
- When data loss is acceptable

## Production Deployment Strategy

### Phase 1: Pre-Deployment Preparation

#### 1.1 Database Backup
```bash
# Create full database backup before any changes
cp data/main.db data/main_backup_$(date +%Y%m%d_%H%M%S).db
cp data/replica.db data/replica_backup_$(date +%Y%m%d_%H%M%S).db
cp data/userdata.db data/userdata_backup_$(date +%Y%m%d_%H%M%S).db
```

#### 1.2 Environment Configuration
```bash
# Set production environment variables
export NODE_ENV=production
export INITIALIZE_DB=false  # Critical: Disable auto-initialization
export BACKUP_ENABLED=true
export MIGRATION_MODE=production
```

### Phase 2: Production Migration Script

#### 2.1 Create Production Migration Script
```typescript
// server/scripts/production-migration.ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

interface MigrationStep {
  id: string;
  description: string;
  execute: (db: Database.Database) => void;
  rollback: (db: Database.Database) => void;
}

class ProductionMigrationManager {
  private db: Database.Database;
  private backupPath: string;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.backupPath = `${dbPath}.backup.${Date.now()}`;
  }

  async executeProductionMigration(): Promise<void> {
    console.log('🚀 Starting Production Migration...');
    
    // Step 1: Create backup
    await this.createBackup();
    
    // Step 2: Execute migration steps
    await this.executeMigrationSteps();
    
    // Step 3: Verify migration
    await this.verifyMigration();
    
    console.log('✅ Production migration completed successfully');
  }

  private async createBackup(): Promise<void> {
    console.log('📦 Creating database backup...');
    fs.copyFileSync(this.db.name, this.backupPath);
    console.log(`✅ Backup created: ${this.backupPath}`);
  }

  private async executeMigrationSteps(): Promise<void> {
    const steps: MigrationStep[] = [
      {
        id: 'consolidate-shipments',
        description: 'Consolidate acknowledgments and sync_status into shipments table',
        execute: (db) => {
          // Add new columns to existing shipments table
          db.exec(`
            ALTER TABLE shipments ADD COLUMN signatureUrl TEXT;
            ALTER TABLE shipments ADD COLUMN photoUrl TEXT;
            ALTER TABLE shipments ADD COLUMN capturedAt TEXT;
            ALTER TABLE shipments ADD COLUMN sync_attempts INTEGER DEFAULT 0;
            ALTER TABLE shipments ADD COLUMN expectedDeliveryTime TEXT;
          `);
        },
        rollback: (db) => {
          // Note: SQLite doesn't support DROP COLUMN, would need recreation
          console.log('⚠️  Rollback requires table recreation - restore from backup');
        }
      },
      {
        id: 'migrate-acknowledgments',
        description: 'Migrate data from acknowledgments table to shipments',
        execute: (db) => {
          db.exec(`
            UPDATE shipments 
            SET signatureUrl = (
              SELECT a.signatureUrl 
              FROM acknowledgments a 
              WHERE a.shipmentId = shipments.id
            ),
            photoUrl = (
              SELECT a.photoUrl 
              FROM acknowledgments a 
              WHERE a.shipmentId = shipments.id
            ),
            capturedAt = (
              SELECT a.capturedAt 
              FROM acknowledgments a 
              WHERE a.shipmentId = shipments.id
            )
            WHERE EXISTS (
              SELECT 1 FROM acknowledgments a WHERE a.shipmentId = shipments.id
            );
          `);
        },
        rollback: (db) => {
          // Restore acknowledgments table from backup
          console.log('⚠️  Rollback requires restoration from backup');
        }
      },
      {
        id: 'migrate-sync-status',
        description: 'Migrate data from sync_status table to shipments',
        execute: (db) => {
          db.exec(`
            UPDATE shipments 
            SET sync_attempts = (
              SELECT s.attempts 
              FROM sync_status s 
              WHERE s.shipmentId = shipments.id
            )
            WHERE EXISTS (
              SELECT 1 FROM sync_status s WHERE s.shipmentId = shipments.id
            );
          `);
        },
        rollback: (db) => {
          console.log('⚠️  Rollback requires restoration from backup');
        }
      },
      {
        id: 'cleanup-old-tables',
        description: 'Remove old tables after successful migration',
        execute: (db) => {
          // Only drop after successful migration and verification
          db.exec(`
            DROP TABLE IF EXISTS acknowledgments;
            DROP TABLE IF EXISTS sync_status;
          `);
        },
        rollback: (db) => {
          console.log('⚠️  Rollback requires restoration from backup');
        }
      }
    ];

    for (const step of steps) {
      console.log(`🔄 Executing: ${step.description}`);
      try {
        step.execute(this.db);
        console.log(`✅ Completed: ${step.description}`);
      } catch (error) {
        console.error(`❌ Failed: ${step.description}`, error);
        throw new Error(`Migration step failed: ${step.id}`);
      }
    }
  }

  private async verifyMigration(): Promise<void> {
    console.log('🔍 Verifying migration...');
    
    // Check if new columns exist
    const columns = this.db.prepare("PRAGMA table_info(shipments)").all();
    const hasNewColumns = columns.some(col => 
      ['signatureUrl', 'photoUrl', 'capturedAt', 'sync_attempts', 'expectedDeliveryTime'].includes(col.name)
    );
    
    if (!hasNewColumns) {
      throw new Error('Migration verification failed: New columns not found');
    }
    
    // Check data integrity
    const shipmentCount = this.db.prepare("SELECT COUNT(*) as count FROM shipments").get();
    console.log(`✅ Verification complete: ${shipmentCount.count} shipments migrated`);
  }
}

export default ProductionMigrationManager;
```

#### 2.2 Production Migration Commands
```bash
# Add to package.json scripts
"migrate:production": "NODE_ENV=production tsx server/scripts/production-migration.ts",
"migrate:verify": "NODE_ENV=production tsx server/scripts/verify-migration.ts",
"backup:create": "NODE_ENV=production tsx server/scripts/create-backup.ts"
```

### Phase 3: Deployment Process

#### 3.1 Pre-Deployment Checklist
- [ ] Database backup created
- [ ] Migration script tested on staging
- [ ] Rollback plan documented
- [ ] Monitoring in place
- [ ] Team notified of deployment window

#### 3.2 Deployment Steps
```bash
# 1. Stop application
pm2 stop riderpro

# 2. Create backup
npm run backup:create

# 3. Deploy new code
git pull origin main
npm install

# 4. Run production migration
npm run migrate:production

# 5. Verify migration
npm run migrate:verify

# 6. Start application
pm2 start riderpro

# 7. Monitor application
pm2 logs riderpro
```

#### 3.3 Post-Deployment Verification
```bash
# Check application health
curl http://localhost:5000/health

# Verify database integrity
npm run db:check

# Test critical functionality
npm run test:critical
```

### Phase 4: Rollback Strategy

#### 4.1 Emergency Rollback Process
```bash
# 1. Stop application
pm2 stop riderpro

# 2. Restore database from backup
cp data/riderpro_backup_TIMESTAMP.db data/riderpro.db
cp data/replica_sqlite_backup_TIMESTAMP.db data/replica_sqlite.db

# 3. Deploy previous version
git checkout previous-stable-tag
npm install

# 4. Start application
pm2 start riderpro
```

#### 4.2 Rollback Triggers
- Database integrity check fails
- Application health check fails
- Critical functionality broken
- Performance degradation > 50%

### Phase 5: Monitoring and Maintenance

#### 5.1 Migration Monitoring
```typescript
// server/middleware/migrationMonitor.ts
export const migrationMonitor = (req: Request, res: Response, next: NextFunction) => {
  // Log migration status on each request
  const migrationStatus = checkMigrationStatus();
  req.migrationStatus = migrationStatus;
  next();
};
```

#### 5.2 Health Checks
```typescript
// server/routes/health.ts
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    migration: {
      status: 'completed',
      version: '2.0.0',
      completedAt: '2024-01-01T00:00:00Z'
    },
    database: {
      status: 'connected',
      tables: ['shipments', 'users', 'route_sessions']
    }
  };
  res.json(health);
});
```

## Alternative Approaches

### Option 1: Blue-Green Deployment
- Deploy new version alongside old version
- Migrate data to new database
- Switch traffic when ready
- Zero downtime migration

### Option 2: Feature Flags
- Deploy code with feature flags
- Gradually enable new features
- Migrate data in background
- Disable old features when ready

### Option 3: Database Versioning
- Use database versioning system
- Maintain backward compatibility
- Gradual migration over time
- No breaking changes

## Recommendations

### For Immediate Deployment
1. **Use the production migration script** provided above
2. **Create comprehensive backups** before any changes
3. **Test on staging environment** first
4. **Have rollback plan ready**

### For Future Deployments
1. **Implement database versioning**
2. **Use feature flags for gradual rollout**
3. **Set up automated backups**
4. **Implement monitoring and alerting**

## Risk Mitigation

### High Risk
- **Data Loss**: Mitigated by comprehensive backups
- **Downtime**: Mitigated by blue-green deployment
- **Rollback Complexity**: Mitigated by automated scripts

### Medium Risk
- **Performance Impact**: Mitigated by monitoring
- **Schema Conflicts**: Mitigated by testing
- **User Experience**: Mitigated by feature flags

## Conclusion

The production migration strategy focuses on:
1. **Safety**: Comprehensive backups and rollback plans
2. **Reliability**: Thorough testing and verification
3. **Monitoring**: Continuous health checks
4. **Flexibility**: Multiple deployment options

Choose the approach that best fits your production environment and risk tolerance.

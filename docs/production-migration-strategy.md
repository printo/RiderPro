# Production Migration Strategy

## Overview
This document outlines the strategy for deploying RiderPro to production environments with Supabase as the primary backend service. The migration strategy covers database setup, schema deployment, authentication configuration, and application deployment.

## Supabase Production Deployment Strategy

### Phase 1: Supabase Project Setup

#### 1.1 Create Supabase Project
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Create new project
supabase projects create riderpro-prod --region us-east-1

# Link local project to remote
supabase link --project-ref your-project-ref
```

#### 1.2 Environment Configuration
```bash
# Production environment variables
export NODE_ENV=production
export VITE_SUPABASE_URL=https://your-project.supabase.co
export VITE_SUPABASE_ANON_KEY=your-anon-key
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
export DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

### Phase 2: Database Schema Deployment

#### 2.1 Deploy Database Schema
```bash
# Deploy schema to Supabase
supabase db push

# Run migrations
supabase migration up

# Verify schema deployment
supabase db diff
```

#### 2.2 Configure Row Level Security
```sql
-- Enable RLS on all tables
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own shipments" ON shipments
  FOR SELECT USING (auth.uid()::text = "employeeId");

CREATE POLICY "Managers can view all shipments" ON shipments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('super_user', 'ops_team', 'staff')
    )
  );
```

### Phase 3: Supabase Configuration

#### 3.1 Configure Authentication
```bash
# Set up authentication providers
supabase auth providers update --enable-email true
supabase auth providers update --enable-google true

# Configure email templates
supabase auth templates update --template confirm_signup --subject "Confirm your email"
supabase auth templates update --template reset_password --subject "Reset your password"
```

#### 3.2 Configure Storage
```bash
# Create storage buckets
supabase storage create shipment-files --public false
supabase storage create signatures --public false
supabase storage create photos --public false

# Set up storage policies
supabase storage policies create --bucket shipment-files --policy "Users can upload own files"
```

#### 3.3 Configure Edge Functions
```bash
# Deploy edge functions
supabase functions deploy process-shipments
supabase functions deploy sync-external-api
supabase functions deploy analytics-processor
```

### Phase 4: Application Deployment

#### 4.1 Build Application
```bash
# Install dependencies
npm ci

# Build for production
npm run build

# Build server
npm run build:server
```

#### 4.2 Deploy to Production
```bash
# Deploy to Vercel (recommended)
vercel --prod

# Or deploy to other platforms
# - Netlify
# - Railway
# - DigitalOcean App Platform
# - AWS Amplify
```

#### 4.3 Configure Environment Variables
```bash
# Set production environment variables
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NODE_ENV production
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

#### 5.1 Supabase Monitoring
```typescript
// Monitor Supabase connection and performance
const monitorSupabase = async () => {
  try {
    const { data, error } = await supabase
      .from('system_health_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    
    return {
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      metrics: data[0]
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      lastCheck: new Date().toISOString()
    };
  }
};
```

#### 5.2 Health Checks
```typescript
// server/routes/health.ts
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    supabase: {
      status: 'connected',
      region: 'us-east-1',
      version: 'latest'
    },
    database: {
      status: 'connected',
      tables: ['shipments', 'route_sessions', 'route_tracking', 'user_profiles']
    },
    auth: {
      status: 'active',
      providers: ['email', 'google']
    },
    storage: {
      status: 'active',
      buckets: ['shipment-files', 'signatures', 'photos']
    }
  };
  res.json(health);
});
```

#### 5.3 Supabase Dashboard Monitoring
- **Database Performance**: Monitor query performance and connection usage
- **Authentication Metrics**: Track user signups, logins, and session activity
- **Storage Usage**: Monitor file uploads and storage consumption
- **API Usage**: Track API calls and rate limiting
- **Real-time Connections**: Monitor WebSocket connections for live updates

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
1. **Use Supabase CLI** for database schema deployment
2. **Set up staging environment** with Supabase project
3. **Configure RLS policies** before going live
4. **Test authentication flows** thoroughly
5. **Set up monitoring** with Supabase dashboard

### For Future Deployments
1. **Use Supabase migrations** for schema changes
2. **Implement feature flags** for gradual rollout
3. **Set up automated backups** via Supabase
4. **Use Supabase Edge Functions** for serverless compute
5. **Implement real-time monitoring** with Supabase Realtime

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

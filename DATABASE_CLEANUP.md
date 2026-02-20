# Database Cleanup System - Complete Guide

## Overview

Hybrid solution combining **date filtering** (frontend) with **automated cleanup** (backend) to maintain optimal database performance while providing user flexibility.

## Architecture

### Frontend (Date Filtering)
- **Default View**: Shows only today's orders automatically
- **User Access**: Can view up to 3 days of historical data
- **Validation**: Prevents selecting dates older than 3 days
- **Performance**: Fast UI with limited data loading

### Backend (Automated Cleanup)
- **Schedule**: Daily at 2:00 AM (off-peak hours)
- **Retention**: Keeps last 3 days of data
- **Safety**: Dry-run mode and logging
- **Coverage**: Cleans all related tables

## Files Required (4 Essential Files)

### 1. Backend Settings
**File**: `backend/riderpro/settings.py`
```python
# Database Cleanup Settings
CLEANUP_SETTINGS = {
    'enabled': True,
    'default_retention_days': 3,
    'backup_before_delete': False,  # Set to True for production
    'cleanup_time': '02:00',  # Daily at 2 AM
    'log_file': 'cleanup.log',
}
```

### 2. Management Command
**File**: `backend/apps/shipments/management/commands/cleanup_old_shipments.py`
- Complete cleanup logic with dry-run support
- Transaction-safe deletions
- Comprehensive logging
- All table cleanup (Shipment, RouteTracking, OrderEvent, etc.)

### 3. Frontend Date Filtering
**File**: `client/src/pages/ShipmentsWithTracking.tsx`
```typescript
// Default filter for today's orders
const [filters, setFilters] = useState<ExtendedShipmentFilters>({
  created_at__gte: today.toISOString(),
  created_at__lt: tomorrow.toISOString()
});
```

### 4. Date Picker UI
**File**: `client/src/components/Filters.tsx`
- Date range selection with 3-day validation
- User-friendly error messages
- Integration with API filters

## Setup Instructions

### Step 1: Test Cleanup Command
```bash
cd backend
python manage.py cleanup_old_shipments --dry-run

# Test with specific days
python manage.py cleanup_old_shipments --days=3 --dry-run
```

### Step 2: Setup Automated Cleanup
```bash
# Add to crontab (daily at 2 AM)
crontab -e

# Add this line:
0 2 * * * cd /path/to/backend && python manage.py cleanup_old_shipments --days=3 >> cleanup.log 2>&1
```

### Step 3: Verify Frontend
- Open shipments page
- Should show only today's orders by default
- Date filters should allow 3-day range selection

## Command Options

```bash
python manage.py cleanup_old_shipments [OPTIONS]

Options:
  --days INTEGER         Number of days to keep (default: 3)
  --dry-run            Show what would be deleted without actually deleting
  --backup              Create backup before deletion
```

## What Gets Cleaned

Cleanup removes records older than retention period from:

1. **RouteTracking** (GPS points - largest table)
2. **OrderEvent** (Status change events)
3. **Acknowledgment** (Signature/photo records)
4. **RouteSession** (Route tracking sessions)
5. **Shipment** (Main shipment records)

## Safety Features

### Dry Run Mode
- Test before actual deletion
- Shows exact counts
- No data changes

### Transaction Safety
- All deletions in single transaction
- Rollback on any failure
- Data consistency guaranteed

### Logging
- Detailed operation logs
- Error tracking
- Performance metrics

### Configurable Retention
- Easy to change retention period
- Environment-specific settings
- Test vs production modes

## User Experience

### Default Behavior
- Users see today's orders automatically
- Fast loading with minimal data
- Clean, focused interface

### Historical Access
- Can access last 3 days when needed
- Date picker with validation
- Clear indication of limits

### Error Handling
- Friendly messages for invalid dates
- Graceful fallbacks
- No broken states

## Monitoring

### Check Cleanup Logs
```bash
# View recent cleanup activity
tail -f cleanup.log

# Check for errors
grep -i error cleanup.log
```

### Database Size Monitoring
```sql
-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Troubleshooting

### Common Issues

1. **Cron job not running**
   ```bash
   # Check cron service status
   sudo systemctl status cron
   
   # Check cron logs
   grep CRON /var/log/syslog
   ```

2. **Permission errors**
   ```bash
   # Ensure Python can access Django
   cd /path/to/backend
   python manage.py check
   ```

3. **Database connection issues**
   ```bash
   # Test database connection
   python manage.py dbshell --help
   ```

### Emergency Stop
```bash
# Disable cleanup temporarily
crontab -l | grep -v 'cleanup_old_shipments' | crontab -

# Or edit settings
# CLEANUP_SETTINGS['enabled'] = False
```

## Production Considerations

### Before Production
1. **Enable Backups**: Set `backup_before_delete: True`
2. **Test Thoroughly**: Run dry-run in production environment
3. **Monitor Performance**: Watch for slow queries
4. **Schedule Maintenance**: Plan for potential downtime

### Performance Impact
- **Before**: Unlimited data growth, slower queries
- **After**: Stable size, consistent performance
- **Storage**: Predictable disk usage
- **Backup**: Smaller, faster backups

### Maintenance
- Review logs weekly
- Monitor database size
- Adjust retention if needed
- Update cron schedule for business hours

## FAQ

**Q: Will users lose access to their data?**
A: No - users can still access the last 3 days through date filters.

**Q: Can I recover deleted data?**
A: Only if backup is enabled. Otherwise, deletion is permanent.

**Q: How do I change the retention period?**
A: Update `CLEANUP_SETTINGS['default_retention_days']` in settings.py.

**Q: Can cleanup be paused?**
A: Yes - disable with `CLEANUP_SETTINGS['enabled'] = False` or remove cron job.

**Q: What happens during cleanup failure?**
A: Transaction rolls back - no data is deleted. Check logs for errors.

## File Structure Summary

```
RiderPro/
├── backend/
│   ├── riderpro/settings.py (CLEANUP_SETTINGS added)
│   └── apps/shipments/management/commands/cleanup_old_shipments.py
├── client/src/
│   ├── pages/ShipmentsWithTracking.tsx (date filtering)
│   └── components/Filters.tsx (date picker UI)
└── DATABASE_CLEANUP.md (this documentation)
```

**Total: 4 essential files + 1 documentation file**

## Migration from Old System

If you had a previous main/replica database system:

1. **This solution replaces** the complex database routing
2. **Single database** with automated cleanup
3. **Same user experience** with date filtering
4. **Simpler maintenance** and troubleshooting

## Support

For issues:
1. Check cleanup logs: `cleanup.log`
2. Run dry-run: `--dry-run` flag
3. Verify settings: `CLEANUP_SETTINGS`
4. Test manually: Run command outside cron

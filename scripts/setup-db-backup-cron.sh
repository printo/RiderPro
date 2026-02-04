#!/bin/bash
# Setup cron job for automatic database backups
# This script adds a cron job to backup the database daily

set -e

PROJECT_DIR="/home/ubuntu/riderpro"
CRON_LOG="$PROJECT_DIR/db-backup-cron.log"

echo "🔧 Setting up database backup cron job..."
echo ""

# Check if backup script exists
if [ ! -f "$PROJECT_DIR/scripts/backup-db.sh" ]; then
    echo "❌ Backup script not found: $PROJECT_DIR/scripts/backup-db.sh"
    exit 1
fi

# Make backup script executable
chmod +x "$PROJECT_DIR/scripts/backup-db.sh"

# Create cron job entry
# Runs daily at 2:00 AM
CRON_SCHEDULE="0 2 * * *"
CRON_COMMAND="cd $PROJECT_DIR && $PROJECT_DIR/scripts/backup-db.sh >> $CRON_LOG 2>&1"
CRON_ENTRY="$CRON_SCHEDULE $CRON_COMMAND"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "backup-db.sh"; then
    echo "⚠️  Database backup cron job already exists"
    echo ""
    echo "Current cron jobs:"
    crontab -l | grep "backup-db.sh" || true
    echo ""
    read -p "Do you want to replace it? (yes/no): " replace
    
    if [ "$replace" == "yes" ] || [ "$replace" == "y" ]; then
        # Remove existing backup cron job
        crontab -l 2>/dev/null | grep -v "backup-db.sh" | crontab -
        echo "✅ Removed existing cron job"
    else
        echo "❌ Setup cancelled"
        exit 0
    fi
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "✅ Database backup cron job added!"
echo ""
echo "Schedule: Daily at 2:00 AM"
echo "Command: $CRON_COMMAND"
echo "Log file: $CRON_LOG"
echo ""
echo "To view cron jobs: crontab -l"
echo "To remove cron job: crontab -e (then delete the line)"
echo ""
echo "💡 Tip: You can change the schedule by editing crontab:"
echo "   crontab -e"
echo ""
echo "Common schedules:"
echo "  Daily at 2 AM:    0 2 * * *"
echo "  Every 6 hours:    0 */6 * * *"
echo "  Every 12 hours:   0 */12 * * *"
echo "  Weekly (Sunday):  0 2 * * 0"



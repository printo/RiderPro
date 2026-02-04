#!/bin/bash
# Rollback script for RiderPro frontend deployment
# Restores frontend from a previous backup

set -e

PROJECT_DIR="/home/ubuntu/riderpro"
BACKUP_DIR="$PROJECT_DIR/frontend-backups"

echo "🔄 RiderPro Frontend Rollback Script"
echo "======================================"
echo ""

# Navigate to project directory
cd "$PROJECT_DIR" || exit 1

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup directory not found: $BACKUP_DIR"
    exit 1
fi

# List available backups
echo "📦 Available backups:"
echo ""
BACKUPS=($(ls -t "$BACKUP_DIR"/frontend_backup_*.tar.gz 2>/dev/null | grep -v "latest"))

if [ ${#BACKUPS[@]} -eq 0 ]; then
    echo "❌ No backups found in $BACKUP_DIR"
    exit 1
fi

# Display backups with numbers
for i in "${!BACKUPS[@]}"; do
    BACKUP_FILE="${BACKUPS[$i]}"
    BACKUP_NAME=$(basename "$BACKUP_FILE")
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    BACKUP_DATE=$(echo "$BACKUP_NAME" | sed -n 's/frontend_backup_\([0-9]\{8\}_[0-9]\{6\}\)\.tar\.gz/\1/p' | sed 's/_/ /' | awk '{print $1, $2}')
    
    if [ "$BACKUP_NAME" == "frontend_backup_latest.tar.gz" ] || [ -L "$BACKUP_FILE" ]; then
        echo "  [$((i+1))] $BACKUP_NAME (latest) - $BACKUP_SIZE"
    else
        echo "  [$((i+1))] $BACKUP_NAME - $BACKUP_SIZE"
    fi
done

echo ""
echo "Select backup to restore:"
echo "  [0] Use latest backup"
echo "  [1-${#BACKUPS[@]}] Select by number"
echo "  [q] Quit"
echo ""
read -p "Enter choice: " choice

# Determine which backup to use
if [ "$choice" == "q" ] || [ "$choice" == "Q" ]; then
    echo "❌ Rollback cancelled"
    exit 0
elif [ "$choice" == "0" ] || [ -z "$choice" ]; then
    # Use latest backup
    LATEST_BACKUP="$BACKUP_DIR/frontend_backup_latest.tar.gz"
    if [ ! -f "$LATEST_BACKUP" ] && [ ! -L "$LATEST_BACKUP" ]; then
        echo "❌ Latest backup not found"
        exit 1
    fi
    RESTORE_FILE="$LATEST_BACKUP"
    echo "✅ Using latest backup: $(basename "$RESTORE_FILE")"
elif [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le ${#BACKUPS[@]} ]; then
    # Use selected backup
    RESTORE_FILE="${BACKUPS[$((choice-1))]}"
    echo "✅ Using backup: $(basename "$RESTORE_FILE")"
else
    echo "❌ Invalid choice"
    exit 1
fi

# Confirm rollback
echo ""
echo "⚠️  WARNING: This will restore the frontend from backup and restart containers."
echo "   Current frontend files will be replaced."
echo ""
read -p "Continue with rollback? (yes/no): " confirm

if [ "$confirm" != "yes" ] && [ "$confirm" != "y" ]; then
    echo "❌ Rollback cancelled"
    exit 0
fi

# Stop containers
echo ""
echo "🛑 Stopping containers..."
docker compose down || true

# Extract backup
echo "📦 Extracting backup..."
TEMP_DIR=$(mktemp -d)
tar -xzf "$RESTORE_FILE" -C "$TEMP_DIR" || {
    echo "❌ Failed to extract backup"
    rm -rf "$TEMP_DIR"
    exit 1
}

# Restore files
echo "🔄 Restoring files..."
if [ -d "$TEMP_DIR/client" ]; then
    # Backup current client directory (just in case)
    if [ -d "$PROJECT_DIR/client" ]; then
        mv "$PROJECT_DIR/client" "$PROJECT_DIR/client.backup.$(date +%Y%m%d_%H%M%S)" || true
    fi
    mv "$TEMP_DIR/client" "$PROJECT_DIR/client"
    echo "✅ Restored client/ directory"
fi

# Restore docker-compose.yml if present
if [ -f "$TEMP_DIR/docker-compose.yml" ]; then
    cp "$TEMP_DIR/docker-compose.yml" "$PROJECT_DIR/docker-compose.yml"
    echo "✅ Restored docker-compose.yml"
fi

# Restore Dockerfile if present
if [ -f "$TEMP_DIR/Dockerfile" ]; then
    cp "$TEMP_DIR/Dockerfile" "$PROJECT_DIR/Dockerfile"
    echo "✅ Restored Dockerfile"
fi

# Restore package files if present
if [ -f "$TEMP_DIR/package.json" ]; then
    cp "$TEMP_DIR/package.json" "$PROJECT_DIR/package.json"
    echo "✅ Restored package.json"
fi

if [ -f "$TEMP_DIR/package-lock.json" ]; then
    cp "$TEMP_DIR/package-lock.json" "$PROJECT_DIR/package-lock.json"
    echo "✅ Restored package-lock.json"
fi

if [ -f "$TEMP_DIR/vite.config.ts" ]; then
    cp "$TEMP_DIR/vite.config.ts" "$PROJECT_DIR/vite.config.ts"
    echo "✅ Restored vite.config.ts"
fi

# Cleanup temp directory
rm -rf "$TEMP_DIR"

# Rebuild and restart containers
echo ""
echo "🔨 Rebuilding containers..."
export NODE_ENV=production
docker compose build --no-cache frontend || {
    echo "⚠️  Frontend build failed, trying without --no-cache..."
    docker compose build frontend
}

echo "🚀 Starting containers..."
docker compose up -d django frontend

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 10

# Verify services
echo "🔍 Verifying services..."
sleep 5
if docker compose ps | grep -q "Up"; then
    echo "✅ Rollback successful! Services are running."
else
    echo "⚠️  Warning: Some services may not be running. Please verify manually."
fi

# Reload Nginx if it's running
if systemctl is-active --quiet nginx; then
    echo "🔄 Reloading Nginx..."
    sudo nginx -t && sudo systemctl reload nginx || echo "⚠️  Nginx reload skipped"
fi

echo ""
echo "✅ Frontend rollback completed!"
echo ""
echo "💡 If you need to rollback again, the previous version is saved in:"
echo "   $PROJECT_DIR/client.backup.*"



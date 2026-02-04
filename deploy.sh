#!/bin/bash
set -e

# RiderPro Frontend Deployment Script for E2E Instance
# This script handles deployment of RiderPro frontend application
# Note: Database backups are handled separately by cron job

PROJECT_DIR="/home/ubuntu/riderpro"
BACKUP_DIR="$PROJECT_DIR/frontend-backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "🚀 Starting RiderPro frontend deployment..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Navigate to project directory
cd "$PROJECT_DIR" || exit 1

# Backup current frontend deployment
echo "📦 Creating frontend backup..."
if [ -d "$PROJECT_DIR/client" ]; then
    BACKUP_FILE="$BACKUP_DIR/frontend_backup_$DATE.tar.gz"
    tar -czf "$BACKUP_FILE" \
        --exclude='client/node_modules' \
        --exclude='client/dist' \
        --exclude='client/.vite' \
        --exclude='client/dev-dist' \
        --exclude='.git' \
        client/ \
        docker-compose.yml \
        Dockerfile \
        package.json \
        package-lock.json \
        vite.config.ts 2>/dev/null || true
    
    if [ -f "$BACKUP_FILE" ]; then
        # Create symlink to latest backup for easy rollback
        ln -sf "frontend_backup_$DATE.tar.gz" "$BACKUP_DIR/frontend_backup_latest.tar.gz"
        echo "✅ Frontend backup created: $BACKUP_FILE"
        echo "   Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"
    else
        echo "⚠️  Frontend backup failed, but continuing deployment..."
    fi
else
    echo "⚠️  Frontend directory not found, skipping backup..."
fi

# Note: Database backups are handled by cron job (see scripts/backup-db.sh)

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Stop existing containers (both dev and prod)
echo "🛑 Stopping containers..."
docker compose -f docker-compose.prod.yml down || true
docker compose down || true

# Build and start containers
# Production: Start only django and frontend (Postgres runs on host)
export NODE_ENV=production
echo "🔨 Building and starting containers (production mode)..."
echo "   Using docker-compose.prod.yml (standalone production config)"
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Run migrations
echo "🗄️  Running database migrations..."
docker compose -f docker-compose.prod.yml exec -T django python manage.py migrate --noinput || true

# Collect static files
echo "📁 Collecting static files..."
docker compose -f docker-compose.prod.yml exec -T django python manage.py collectstatic --noinput || true

# Restart services
echo "🔄 Restarting services..."
docker compose -f docker-compose.prod.yml restart

# Verify services are running
echo "🔍 Verifying services..."
sleep 5
if docker compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    echo "✅ Deployment successful! Services are running."
else
    echo "⚠️  Warning: Some services may not be running. Please verify manually."
fi

# Reload Nginx if it's running (for multi-project setup)
if systemctl is-active --quiet nginx; then
    echo "🔄 Reloading Nginx..."
    sudo nginx -t && sudo systemctl reload nginx || echo "⚠️  Nginx reload skipped (not configured)"
fi

# Cleanup old backups (keep last 5)
echo "🧹 Cleaning up old backups..."
ls -t "$BACKUP_DIR"/frontend_backup_*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true

# Cleanup Docker
echo "🧹 Cleaning up Docker..."
docker system prune -f --volumes || true

echo "✅ Frontend deployment completed!"
echo ""
echo "💡 To rollback, use: ./scripts/rollback-frontend.sh"

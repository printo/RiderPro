#!/bin/bash
set -e

# RiderPro Deployment Script for E2E Instance
# This script handles deployment of RiderPro application
# Supports three modes:
#   ./deploy.sh frontend  - deploy only frontend
#   ./deploy.sh backend   - deploy only backend (Django)
#   ./deploy.sh           - deploy both (default)
# Note: Database backups are handled separately by cron job

PROJECT_DIR="/home/ubuntu/RiderPro"
BACKUP_DIR="$PROJECT_DIR/frontend-backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Deployment mode: frontend | backend | both
MODE="${1:-both}"

if [[ "$MODE" != "frontend" && "$MODE" != "backend" && "$MODE" != "both" ]]; then
  echo "❌ Invalid mode: $MODE"
  echo "Usage: $0 [frontend|backend|both]"
  exit 1
fi

echo "🚀 Starting RiderPro deployment (mode: $MODE)..."

# Pre-deployment cleanup: only remove the container(s) being redeployed
echo "🧹 Pre-deployment cleanup..."
if [[ "$MODE" == "backend" ]]; then
  docker rm -f riderpro-django 2>/dev/null || true
elif [[ "$MODE" == "frontend" ]]; then
  docker rm -f riderpro-frontend 2>/dev/null || true
else
  docker rm -f riderpro-frontend riderpro-django riderpro-db 2>/dev/null || true
  docker network rm riderpro_default 2>/dev/null || true
  docker system prune -f --volumes 2>/dev/null || true
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Navigate to project directory
cd "$PROJECT_DIR" || exit 1

# Backup current frontend deployment (only when deploying frontend)
if [[ "$MODE" == "frontend" || "$MODE" == "both" ]]; then
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
else
  echo "ℹ️  Backend-only deploy: skipping frontend backup..."
fi

# Note: Database backups are handled by cron job (see scripts/backup-db.sh)

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Only stop the target service(s) – never bring down all containers for single-service deploy
if [[ "$MODE" == "both" ]]; then
  echo "🛑 Stopping all containers..."
  docker compose -f docker-compose.prod.yml down --remove-orphans || true
  docker compose down --remove-orphans || true
  # Force remove any remaining containers with our names
  docker rm -f riderpro-frontend riderpro-django riderpro-db 2>/dev/null || true
  docker network rm riderpro_default 2>/dev/null || true
elif [[ "$MODE" == "backend" ]]; then
  echo "🛑 Stopping django only..."
  docker stop riderpro-django 2>/dev/null || true
  docker rm -f riderpro-django 2>/dev/null || true
elif [[ "$MODE" == "frontend" ]]; then
  echo "🛑 Stopping frontend only..."
  docker stop riderpro-frontend 2>/dev/null || true
  docker rm -f riderpro-frontend 2>/dev/null || true
fi

# Build and start containers (according to mode)
export NODE_ENV=production
echo "🔨 Building and starting containers (production mode)..."
echo "   Using docker-compose.prod.yml (standalone production config)"

if [[ "$MODE" == "backend" ]]; then
  echo "🔨 Building django service..."
  docker compose -f docker-compose.prod.yml build django
  echo "🚀 Starting django service..."
  docker compose -f docker-compose.prod.yml up -d --no-deps django
elif [[ "$MODE" == "frontend" ]]; then
  echo "🔨 Building frontend service..."
  docker compose -f docker-compose.prod.yml build frontend
  echo "🚀 Starting frontend service..."
  docker compose -f docker-compose.prod.yml up -d --no-deps frontend
else
  echo "🔨 Building all services (no cache)..."
  docker compose -f docker-compose.prod.yml build --no-cache
  echo "🚀 Starting all services..."
  docker compose -f docker-compose.prod.yml up -d
fi

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Run migrations & collectstatic only when backend is involved
if [[ "$MODE" == "backend" || "$MODE" == "both" ]]; then
  echo "🗄️  Running database migrations..."
  docker compose -f docker-compose.prod.yml exec -T django python manage.py migrate --noinput || true

  echo "📁 Collecting static files..."
  docker compose -f docker-compose.prod.yml exec -T django python manage.py collectstatic --noinput || true
else
  echo "ℹ️  Frontend-only deploy: skipping migrations and collectstatic..."
fi

# Restart services
echo "🔄 Restarting services..."
if [[ "$MODE" == "backend" ]]; then
  docker restart riderpro-django || true
elif [[ "$MODE" == "frontend" ]]; then
  docker restart riderpro-frontend || true
else
  docker compose -f docker-compose.prod.yml restart || true
fi

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
if [[ "$MODE" == "frontend" || "$MODE" == "both" ]]; then
  echo "🧹 Cleaning up old frontend backups..."
  ls -t "$BACKUP_DIR"/frontend_backup_*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
fi

# Cleanup Docker (full prune only when deploying both, to avoid affecting other services)
if [[ "$MODE" == "both" ]]; then
  echo "🧹 Cleaning up Docker..."
  docker system prune -f --volumes || true
else
  echo "🧹 Skipping full Docker prune (single-service deploy)..."
fi

echo "✅ Deployment completed! (mode: $MODE)"
echo ""
echo "💡 To rollback frontend, use: ./scripts/rollback-frontend.sh"

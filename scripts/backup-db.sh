#!/bin/bash
# Backup database script for RiderPro
# Backs up the Django database (riderpro_django)
# Supports both Docker Postgres (local dev) and direct Postgres (production)

set -e

DUMP_DIR="./db-dumps"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create dump directory if it doesn't exist
mkdir -p "$DUMP_DIR"

echo "📦 Backing up Django database..."

# Detect if using Docker Postgres or direct Postgres
if docker compose ps postgres 2>/dev/null | grep -q "Up"; then
    # Docker Postgres (local development)
    echo "📦 Using Docker Postgres..."
    if docker compose exec -T postgres pg_dump -U postgres -F c riderpro_django > "$DUMP_DIR/riderpro_django_${TIMESTAMP}.dump" 2>/dev/null; then
        ln -sf "riderpro_django_${TIMESTAMP}.dump" "$DUMP_DIR/riderpro_django.dump"
        echo "✅ Backup complete! Dump saved to $DUMP_DIR/riderpro_django_${TIMESTAMP}.dump"
    else
        echo "❌ Failed to backup database"
        exit 1
    fi
elif command -v pg_dump &> /dev/null; then
    # Direct Postgres (production)
    echo "📦 Using direct Postgres..."
    DB_USER="${DB_USER:-postgres}"
    DB_NAME="${DB_NAME:-riderpro_django}"
    
    if pg_dump -U "$DB_USER" -F c "$DB_NAME" > "$DUMP_DIR/riderpro_django_${TIMESTAMP}.dump" 2>/dev/null; then
        ln -sf "riderpro_django_${TIMESTAMP}.dump" "$DUMP_DIR/riderpro_django.dump"
        echo "✅ Backup complete! Dump saved to $DUMP_DIR/riderpro_django_${TIMESTAMP}.dump"
    else
        echo "❌ Failed to backup database. Check DB_USER and DB_NAME environment variables."
        exit 1
    fi
else
    echo "❌ PostgreSQL not found. Install PostgreSQL or start Docker container."
    exit 1
fi


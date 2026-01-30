#!/bin/bash
# Restore database script for RiderPro
# This script runs inside a container with access to postgres

set -e

DUMP_DIR="/dumps"
PGHOST="${PGHOST:-postgres}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-password}"
export PGPASSWORD

echo "🔄 Restoring databases from dumps..."

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until pg_isready -h "$PGHOST" -U "$PGUSER" > /dev/null 2>&1; do
    echo "   Waiting for PostgreSQL..."
    sleep 1
done
echo "✅ PostgreSQL is ready"

# Restore Django database
if [ -f "$DUMP_DIR/riderpro_django.dump" ]; then
    echo "🔄 Restoring riderpro_django database..."
    
    # Drop and recreate database
    psql -h "$PGHOST" -U "$PGUSER" <<-EOSQL
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = 'riderpro_django' AND pid <> pg_backend_pid();
        
        DROP DATABASE IF EXISTS riderpro_django;
        CREATE DATABASE riderpro_django;
EOSQL
    
    # Restore from dump
    pg_restore -h "$PGHOST" -U "$PGUSER" -d riderpro_django -c "$DUMP_DIR/riderpro_django.dump" || {
        echo "⚠️  Warning: Restore had some errors (might be normal if objects already exist)"
    }
    
    echo "✅ Restored riderpro_django database"
else
    echo "⚠️  No dump file found at $DUMP_DIR/riderpro_django.dump"
    echo "   Creating empty database instead..."
    psql -h "$PGHOST" -U "$PGUSER" <<-EOSQL
        SELECT 'CREATE DATABASE riderpro_django'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'riderpro_django')\gexec
EOSQL
fi

# Restore Node.js database (legacy, optional)
if [ -f "$DUMP_DIR/riderpro.dump" ]; then
    echo "🔄 Restoring riderpro database..."
    psql -h "$PGHOST" -U "$PGUSER" <<-EOSQL
        DROP DATABASE IF EXISTS riderpro;
        CREATE DATABASE riderpro;
EOSQL
    pg_restore -h "$PGHOST" -U "$PGUSER" -d riderpro -c "$DUMP_DIR/riderpro.dump" || {
        echo "⚠️  Warning: Restore had some errors"
    }
    echo "✅ Restored riderpro database"
fi

echo "✅ Database restore complete!"
echo "💡 Migrations will run automatically when Django starts"

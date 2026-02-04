#!/bin/bash
set -e

# Detect database host from Django settings or environment
# In Docker (local dev): HOST=postgres
# In production: HOST=localhost (directly installed Postgres)
DB_HOST="${DB_HOST:-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-password}"

# Check if database exists, create if it doesn't
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -tc "SELECT 1 FROM pg_database WHERE datname = 'riderpro_django'" | grep -q 1 || \
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -c "CREATE DATABASE riderpro_django;"

echo "Database riderpro_django ready (host: $DB_HOST)"


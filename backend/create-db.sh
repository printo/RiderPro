#!/bin/bash
set -e

# Check if database exists, create if it doesn't
PGPASSWORD=password psql -h postgres -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'riderpro_django'" | grep -q 1 || \
PGPASSWORD=password psql -h postgres -U postgres -c "CREATE DATABASE riderpro_django;"

echo "Database riderpro_django ready"


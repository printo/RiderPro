#!/bin/bash
set -e

# Create Django database if it doesn't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE riderpro_django;
EOSQL

echo "Database riderpro_django created"


#!/bin/bash

# Database Management Script for RiderPro
# Supports both local (Docker) and production environments
# Usage:
#   ./scripts/db_manager.sh dump [local|prod] [output_file]
#   ./scripts/db_manager.sh restore [local|prod] [input_file]
#   ./scripts/db_manager.sh reset [local|prod]              - Drop schema, recreate, setup permissions, run migrations
#   ./scripts/db_manager.sh setup-permissions [local|prod]
#   ./scripts/db_manager.sh migrate [local|prod]           - Run Django migrations
#   ./scripts/db_manager.sh list                            - List available dumps

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="${2:-local}"
DUMP_DIR="${DB_DUMP_DIR:-./db-dumps}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Function to get database connection parameters
get_db_params() {
    local env=$1
    
    if [ "$env" = "prod" ]; then
        # Production: Use environment variables or defaults
        DB_HOST="${DB_HOST:-localhost}"
        DB_PORT="${DB_PORT:-5432}"
        DB_NAME="${DB_NAME:-riderpro_django}"
        DB_USER="${DB_USER:-riderpro_app}"
        DB_PASSWORD="${DB_PASSWORD}"
        CONTAINER_NAME="${DB_CONTAINER_NAME:-}"
        
        # For production, we might need sudo access to postgres user
        USE_SUDO="${USE_SUDO:-false}"
        
        if [ -z "$DB_PASSWORD" ] && [ "$USE_SUDO" != "true" ]; then
            print_warn "DB_PASSWORD not set. Will try using sudo -u postgres for production operations."
            USE_SUDO="true"
        fi
        
        print_info "Using production database: $DB_NAME@$DB_HOST:$DB_PORT (User: $DB_USER)"
    else
        # Local: Use Docker Compose
        DB_HOST="${DB_HOST:-postgres}"
        DB_PORT="${DB_PORT:-5432}"
        DB_NAME="${DB_NAME:-riderpro_django}"  # Matches localsettings.py
        DB_USER="${DB_USER:-postgres}"
        DB_PASSWORD="${DB_PASSWORD:-password}"
        CONTAINER_NAME="${DB_CONTAINER_NAME:-riderpro-db}"
        
        print_info "Using local database: $DB_NAME@$DB_HOST:$DB_PORT (Docker: $CONTAINER_NAME)"
    fi
    
    export PGPASSWORD="$DB_PASSWORD"
}

# Function to check if database is accessible
check_db_connection() {
    local env=$1
    get_db_params "$env"
    
    print_info "Checking database connection..."
    
    if [ "$env" = "prod" ]; then
        if [ "$USE_SUDO" = "true" ]; then
            if ! sudo -u postgres psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
                print_error "Cannot connect to production database"
                exit 1
            fi
        else
            if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
                print_error "Cannot connect to production database"
                exit 1
            fi
        fi
    else
        if ! docker compose ps postgres 2>/dev/null | grep -q "Up"; then
            print_error "Docker Compose postgres service is not running"
            print_info "Start it with: docker compose up -d postgres"
            exit 1
        fi
        if ! docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
            print_error "Cannot connect to local database. Is Docker Compose running?"
            exit 1
        fi
    fi
    
    print_info "Database connection successful"
}

# Function to dump database
dump_database() {
    local env=$1
    local output_file=$2
    
    get_db_params "$env"
    check_db_connection "$env"
    
    # Generate output filename if not provided
    if [ -z "$output_file" ]; then
        output_file="${DUMP_DIR}/riderpro_${env}_${TIMESTAMP}.sql"
    fi
    
    # Create dump directory if it doesn't exist
    mkdir -p "$DUMP_DIR"
    
    print_info "Dumping database to: $output_file"
    
    if [ "$env" = "prod" ]; then
        # Production: Direct pg_dump
        if [ "$USE_SUDO" = "true" ]; then
            sudo -u postgres pg_dump \
                -h "$DB_HOST" \
                -p "$DB_PORT" \
                -d "$DB_NAME" \
                --no-owner \
                --no-privileges \
                --clean \
                --if-exists \
                -F p \
                -f "$output_file"
        else
            PGPASSWORD="$DB_PASSWORD" pg_dump \
                -h "$DB_HOST" \
                -p "$DB_PORT" \
                -U "$DB_USER" \
                -d "$DB_NAME" \
                --no-owner \
                --no-privileges \
                --clean \
                --if-exists \
                -F p \
                -f "$output_file"
        fi
    else
        # Local: Use Docker
        docker compose exec -T postgres pg_dump \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --no-owner \
            --no-privileges \
            --clean \
            --if-exists \
            -F p \
            > "$output_file"
    fi
    
    # Compress the dump
    print_info "Compressing dump file..."
    gzip -f "$output_file"
    output_file="${output_file}.gz"
    
    print_info "Database dump completed: $output_file"
    print_info "File size: $(du -h "$output_file" | cut -f1)"
}

# Function to reset database (drop schema, recreate, setup permissions, run migrations)
reset_database() {
    local env=$1
    
    get_db_params "$env"
    
    print_warn "⚠️  This will DROP the entire database schema and recreate it!"
    print_warn "All data will be lost. This action cannot be undone."
    print_warn ""
    print_warn "Database: $DB_NAME"
    print_warn "Environment: $env"
    print_warn ""
    print_warn "Are you absolutely sure? Type 'yes' to continue:"
    read -r confirmation
    if [ "$confirmation" != "yes" ]; then
        print_info "Reset cancelled"
        exit 0
    fi
    
    print_step "Step 1/4: Dropping public schema..."
    if [ "$env" = "prod" ]; then
        if [ "$USE_SUDO" = "true" ]; then
            sudo -u postgres psql -d "$DB_NAME" -c "DROP SCHEMA IF EXISTS public CASCADE;" || true
        else
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA IF EXISTS public CASCADE;" || true
        fi
    else
        docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA IF EXISTS public CASCADE;" || true
    fi
    
    print_step "Step 2/4: Creating public schema..."
    if [ "$env" = "prod" ]; then
        if [ "$USE_SUDO" = "true" ]; then
            sudo -u postgres psql -d "$DB_NAME" -c "CREATE SCHEMA public;"
        else
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "CREATE SCHEMA public;"
        fi
    else
        docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "CREATE SCHEMA public;"
    fi
    
    print_step "Step 3/4: Setting up permissions..."
    setup_permissions "$env"
    
    print_step "Step 4/4: Running Django migrations..."
    run_migrations "$env"
    
    print_info "✅ Database reset completed successfully!"
    print_info "Database is now empty and ready for migrations."
}

# Function to setup database permissions
setup_permissions() {
    local env=$1
    
    get_db_params "$env"
    
    print_info "Setting up database permissions..."
    
    # Grant database privileges
    local db_sql="GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    
    # Schema and table privileges (run inside the database)
    local schema_sql="
-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO $DB_USER;
GRANT ALL ON SCHEMA public TO $DB_USER;

-- Grant all privileges on all tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;

-- Grant all privileges on all sequences
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;

-- Grant all privileges on all functions
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $DB_USER;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO $DB_USER;
"
    
    # For production, also grant to postgres user
    if [ "$env" = "prod" ]; then
        schema_sql="$schema_sql
-- Grant to postgres user as well
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres;
"
    fi
    
    if [ "$env" = "prod" ]; then
        # Production: Direct psql
        if [ "$USE_SUDO" = "true" ]; then
            echo "$db_sql" | sudo -u postgres psql -d postgres > /dev/null 2>&1 || true
            
            echo "$schema_sql" | sudo -u postgres psql -d "$DB_NAME" > /dev/null 2>&1 || true
        else
            echo "$db_sql" | PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres > /dev/null 2>&1 || true
            
            echo "$schema_sql" | PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1 || true
        fi
    else
        # Local: Use Docker
        echo "$db_sql" | docker compose exec -T postgres psql -U "$DB_USER" -d postgres > /dev/null 2>&1 || true
        
        echo "$schema_sql" | docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1 || true
    fi
    
    print_info "Database permissions configured"
}

# Function to run Django migrations
run_migrations() {
    local env=$1
    
    print_info "Running Django migrations..."
    
    if [ "$env" = "prod" ]; then
        # Production: Run migrations in Django container
        if docker compose -f docker-compose.prod.yml ps django 2>/dev/null | grep -q "Up"; then
            print_info "Running migrations in production Django container..."
            docker compose -f docker-compose.prod.yml exec -T django python manage.py migrate --noinput
        else
            print_warn "Django container is not running. Migrations will run on next container start."
            print_info "You can run migrations manually with:"
            print_info "  docker compose -f docker-compose.prod.yml exec django python manage.py migrate --noinput"
        fi
    else
        # Local: Run migrations in Django container
        if docker compose ps django 2>/dev/null | grep -q "Up"; then
            print_info "Running migrations in local Django container..."
            docker compose exec -T django python manage.py migrate --noinput
        else
            print_warn "Django container is not running. Start it with:"
            print_info "  docker compose up -d django"
            print_info "Migrations will run automatically on container start."
        fi
    fi
    
    print_info "Migrations completed"
}

# Function to restore database
restore_database() {
    local env=$1
    local input_file=$2
    
    if [ -z "$input_file" ]; then
        print_error "Input file is required for restore"
        exit 1
    fi
    
    if [ ! -f "$input_file" ] && [ ! -f "${input_file}.gz" ]; then
        print_error "Dump file not found: $input_file"
        exit 1
    fi
    
    # Handle compressed files
    local actual_file="$input_file"
    if [ ! -f "$input_file" ] && [ -f "${input_file}.gz" ]; then
        actual_file="${input_file}.gz"
    fi
    
    get_db_params "$env"
    
    print_warn "This will DROP and recreate the database. Are you sure? (yes/no)"
    read -r confirmation
    if [ "$confirmation" != "yes" ]; then
        print_info "Restore cancelled"
        exit 0
    fi
    
    # Decompress if needed
    local temp_file="$actual_file"
    if [[ "$actual_file" == *.gz ]]; then
        print_info "Decompressing dump file..."
        temp_file="/tmp/riderpro_restore_${TIMESTAMP}.sql"
        gunzip -c "$actual_file" > "$temp_file"
    fi
    
    print_info "Restoring database from: $actual_file"
    
    if [ "$env" = "prod" ]; then
        # Production: Direct psql
        if [ "$USE_SUDO" = "true" ]; then
            sudo -u postgres psql -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" || true
            
            sudo -u postgres psql -d postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" || true
            
            sudo -u postgres psql -d "$DB_NAME" -f "$temp_file"
        else
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" || true
            
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" || true
            
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$temp_file"
        fi
    else
        # Local: Use Docker
        docker compose exec -T postgres psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" || true
        
        docker compose exec -T postgres psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" || true
        
        docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -f - < "$temp_file"
    fi
    
    # Clean up temp file if we created one
    if [ "$temp_file" != "$actual_file" ]; then
        rm -f "$temp_file"
    fi
    
    print_info "Database restore completed"
    
    # Setup permissions after restore
    setup_permissions "$env"
}

# Function to list available dumps
list_dumps() {
    print_info "Available database dumps in $DUMP_DIR:"
    if [ -d "$DUMP_DIR" ] && [ "$(ls -A $DUMP_DIR 2>/dev/null)" ]; then
        ls -lh "$DUMP_DIR" | tail -n +2 | awk '{print $9, "(" $5 ")"}'
    else
        print_warn "No dumps found in $DUMP_DIR"
    fi
}

# Function to show usage
show_usage() {
    echo "Database Management Script for RiderPro"
    echo ""
    echo "Usage:"
    echo "  $0 dump [local|prod] [output_file]     - Dump database"
    echo "  $0 restore [local|prod] [input_file]   - Restore database"
    echo "  $0 reset [local|prod]                  - Drop schema, recreate, setup permissions, run migrations"
    echo "  $0 permissions [local|prod]            - Setup database permissions"
    echo "  $0 migrate [local|prod]                 - Run Django migrations"
    echo "  $0 list                                - List available dumps"
    echo ""
    echo "Environment Variables (for production):"
    echo "  DB_HOST          - Database host (default: localhost)"
    echo "  DB_PORT          - Database port (default: 5432)"
    echo "  DB_NAME          - Database name (default: riderpro_django for both local and prod)"
    echo "  DB_USER          - Database user (default: riderpro_app for prod, postgres for local)"
    echo "  DB_PASSWORD      - Database password (optional for prod if using sudo)"
    echo "  USE_SUDO         - Use sudo -u postgres (default: auto-detect)"
    echo "  DB_DUMP_DIR      - Dump directory (default: ./db-dumps)"
    echo ""
    echo "Examples:"
    echo "  # Local (Docker):"
    echo "  $0 dump local                                    # Dump local database"
    echo "  $0 reset local                                   # Reset local database (drop schema, recreate, migrate)"
    echo "  $0 restore local ./db-dumps/backup.sql.gz        # Restore local database"
    echo ""
    echo "  # Production:"
    echo "  $0 dump prod                                    # Dump production database (uses sudo)"
    echo "  $0 reset prod                                   # Reset production database (uses sudo)"
    echo "  DB_PASSWORD=secret $0 restore prod ./backup.sql  # Restore production database"
    echo "  $0 migrate prod                                 # Run migrations in production"
    echo ""
    echo "Note: For production, the script will automatically use 'sudo -u postgres' if"
    echo "      DB_PASSWORD is not set. This matches your manual production setup."
}

# Main script logic
case "${1:-}" in
    dump)
        dump_database "$ENVIRONMENT" "$3"
        ;;
    restore)
        restore_database "$ENVIRONMENT" "$3"
        ;;
    reset)
        reset_database "$ENVIRONMENT"
        ;;
    permissions|setup-permissions)
        setup_permissions "$ENVIRONMENT"
        ;;
    migrate)
        run_migrations "$ENVIRONMENT"
        ;;
    list)
        list_dumps
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        print_error "Invalid command: ${1:-}"
        echo ""
        show_usage
        exit 1
        ;;
esac

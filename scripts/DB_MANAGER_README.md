# Database Manager Script

Comprehensive database management script for RiderPro that supports both local (Docker) and production environments.

## Quick Start

### Local (Docker) Usage

```bash
# Reset database (drop schema, recreate, setup permissions, run migrations)
./scripts/db_manager.sh reset local

# Dump database
./scripts/db_manager.sh dump local

# Restore database
./scripts/db_manager.sh restore local ./db-dumps/backup.sql.gz

# Run migrations only
./scripts/db_manager.sh migrate local

# Setup permissions only
./scripts/db_manager.sh permissions local
```

### Production Usage

```bash
# Reset database (uses sudo -u postgres automatically)
./scripts/db_manager.sh reset prod

# Dump database
./scripts/db_manager.sh dump prod

# Restore database (with password)
DB_PASSWORD=your_password ./scripts/db_manager.sh restore prod ./backup.sql.gz

# Run migrations
./scripts/db_manager.sh migrate prod

# Setup permissions
./scripts/db_manager.sh permissions prod
```

## Commands

### `reset [local|prod]`
**Most commonly used command** - Does everything in one go:
1. Drops the `public` schema (CASCADE)
2. Creates a fresh `public` schema
3. Sets up all database permissions
4. Runs Django migrations

**Example:**
```bash
# Local
./scripts/db_manager.sh reset local

# Production (matches your manual process)
./scripts/db_manager.sh reset prod
```

### `dump [local|prod] [output_file]`
Creates a compressed SQL dump of the database.

**Example:**
```bash
# Auto-generate filename with timestamp
./scripts/db_manager.sh dump local

# Specify custom filename
./scripts/db_manager.sh dump prod /backups/riderpro_$(date +%Y%m%d).sql
```

### `restore [local|prod] [input_file]`
Restores a database from a dump file (supports .sql and .sql.gz).

**Example:**
```bash
./scripts/db_manager.sh restore local ./db-dumps/riderpro_local_20240209_120000.sql.gz
```

### `migrate [local|prod]`
Runs Django migrations only (useful after schema changes).

**Example:**
```bash
./scripts/db_manager.sh migrate prod
```

### `permissions [local|prod]`
Sets up database permissions (grants, default privileges, etc.).

**Example:**
```bash
./scripts/db_manager.sh permissions prod
```

### `list`
Lists all available database dumps in the dump directory.

## Environment Variables

### Production Environment Variables

```bash
# Database connection
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=riderpro_django
export DB_USER=riderpro_app
export DB_PASSWORD=your_password  # Optional if using sudo

# Force sudo usage (auto-detected if DB_PASSWORD not set)
export USE_SUDO=true

# Custom dump directory
export DB_DUMP_DIR=/backups/db-dumps
```

### Local Environment Variables

Local environment uses Docker Compose defaults:
- `DB_HOST=postgres` (Docker service name)
- `DB_PORT=5432`
- `DB_NAME=riderpro_django` (from localsettings.py)
- `DB_USER=postgres`
- `DB_PASSWORD=password`

## Production Setup (Matches Your Manual Process)

The script automatically detects when to use `sudo -u postgres` for production operations, matching your manual setup:

```bash
# Your manual process:
sudo -u postgres psql
postgres=# DROP SCHEMA public CASCADE;
postgres=# CREATE SCHEMA public;
postgres=# GRANT ALL ON SCHEMA public TO postgres;
postgres=# GRANT ALL ON SCHEMA public TO public;
postgres=# GRANT ALL ON SCHEMA public TO riderpro_app;

# Script equivalent:
./scripts/db_manager.sh reset prod
```

## Common Workflows

### Fresh Start (After Schema Changes)

```bash
# Local
./scripts/db_manager.sh reset local

# Production
./scripts/db_manager.sh reset prod
```

### Backup Before Changes

```bash
# Local
./scripts/db_manager.sh dump local

# Production
./scripts/db_manager.sh dump prod
```

### Restore from Backup

```bash
# Local
./scripts/db_manager.sh restore local ./db-dumps/riderpro_local_20240209_120000.sql.gz

# Production
./scripts/db_manager.sh restore prod ./db-dumps/riderpro_prod_20240209_120000.sql.gz
```

## File Locations

- **Dump Directory:** `./db-dumps/` (default)
- **Script Location:** `./scripts/db_manager.sh`
- **Dump Format:** Compressed SQL (`.sql.gz`)

## Safety Features

1. **Confirmation Prompts:** Destructive operations (reset, restore) require confirmation
2. **Backup Recommendations:** Script warns before destructive operations
3. **Connection Checks:** Verifies database connectivity before operations
4. **Error Handling:** Exits on errors with clear messages

## Troubleshooting

### "Cannot connect to database"
- **Local:** Ensure Docker Compose is running (`docker compose ps`)
- **Production:** Check database is running and credentials are correct

### "Permission denied"
- **Production:** Script will automatically use `sudo -u postgres` if `DB_PASSWORD` is not set
- Ensure your user has sudo access or set `DB_PASSWORD`

### "Django container not running"
- **Local:** Start with `docker compose up -d django`
- **Production:** Start with `docker compose -f docker-compose.prod.yml up -d django`

## Notes

- The script automatically detects Docker vs direct PostgreSQL
- Dumps are automatically compressed with gzip
- All operations are logged with colored output
- The script respects environment variables for flexibility

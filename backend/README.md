# RiderPro

Delivery management system with Django backend and React frontend, integrated with POPS (Printo Order Processing System).

## Quick Start

### Prerequisites
- Docker and Docker Compose
- `.env` file configured (see Configuration section)

### Start Development Environment

```bash
# Fresh start (empty database)
docker compose up --build

# Or restore from dump (with seed data)
docker compose --profile db-restore up --build
```

### Access Services
- **Frontend**: http://localhost:5004
- **Django API**: http://localhost:8004
- **Node.js API (legacy)**: http://localhost:5000
- **PostgreSQL**: localhost:5433

---

## Project Structure

```
RiderPro/
├── backend/          # Django REST Framework backend
├── client/           # React frontend (Vite)
├── server/           # Node.js backend (legacy)
├── shared/            # Shared TypeScript types
├── db-dumps/          # Database dumps for setup
├── scripts/           # Utility scripts
└── docker-compose.yml # Docker services configuration
```

---

## Setup

### 1. Environment Variables

Create `.env` file in project root:

```env
# Database
DB_NAME=riderpro_django
DB_USER=postgres
DB_PASSWORD=password
DB_HOST=postgres
DB_PORT=5432

# Django
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

# POPS API
POPS_API_BASE_URL=http://host.docker.internal:8002/api/v1

# Node.js (legacy)
NODE_ENV=development
PORT=5000
```

### 2. Start Services

```bash
# Start all services
docker compose up --build

# Start with database restore
docker compose --profile db-restore up --build
```

### 3. Create Admin User (Optional)

```bash
docker compose exec django python manage.py createsuperuser
```

---

## Database

### Database Setup

- **Django Database**: `riderpro_django` (PostgreSQL 15)
- **Node.js Database**: `riderpro` (PostgreSQL 15, legacy)
- **Port**: 5433 (to avoid conflicts with other PostgreSQL instances)

### Migrations

Django migrations run automatically on startup. Django tracks applied migrations in the `django_migrations` table:

- **Fresh database**: All migrations run
- **Restored dump**: Only new migrations run (Django skips already applied ones)

### Database Dumps

#### Creating a Dump

```bash
# Use the backup script
./scripts/backup-db.sh

# Or manually
docker compose exec postgres pg_dump -U postgres -F c riderpro_django > db-dumps/riderpro_django.dump
```

#### Restoring from Dump

```bash
# Use Docker profile (recommended)
docker compose --profile db-restore up --build

# Or manually
docker compose exec postgres pg_restore -U postgres -d riderpro_django -c db-dumps/riderpro_django.dump
```

#### How Migrations Work with Dumps

1. Dump includes `django_migrations` table showing migrations 0001-0010 were applied
2. Django checks this table and sees 0001-0010 are already done
3. Django only runs migrations 0011+ from current code
4. Result: Schema matches current code ✅

**Note:** If migrations fail, the dump's schema might not match its migration history. In that case, start fresh.

---

## Development

### Backend (Django)

```bash
# Run migrations manually
docker compose exec django python manage.py migrate

# Create migrations
docker compose exec django python manage.py makemigrations

# Create superuser
docker compose exec django python manage.py createsuperuser

# Django shell
docker compose exec django python manage.py shell
```

### Frontend (React/Vite)

Frontend runs on port 5004 with hot-reload enabled. API requests are proxied to Django backend.

### Node.js Backend (Legacy)

Legacy Node.js backend runs on port 5000. It's being migrated to Django.

---

## Architecture

### Backend Services

1. **Django** (`riderpro-django`): Main API backend
   - REST API endpoints
   - Authentication (multi-source: local, POPS, rider accounts)
   - POPS integration
   - Port: 8004

2. **Node.js** (`riderpro-app`): Legacy backend
   - Being migrated to Django
   - Port: 5000

3. **Frontend** (`riderpro-frontend`): React application
   - Vite dev server
   - Port: 5004

4. **PostgreSQL** (`riderpro-db`): Database
   - Port: 5433 (host)

### Authentication

Multi-source authentication flow:
1. **Local Database** → Check `User` model
2. **RiderAccount** → Check local rider accounts
3. **POPS API** → Fallback to POPS authentication

### POPS Integration

- **Read-only** currently (reads orders, routes, consignments from POPS)
- **Future**: Read/write capability
- Uses POPS API client for all interactions
- JWT token management (Simple JWT, same as POPS)

---

## Scripts

### Database Scripts

- `scripts/backup-db.sh` - Backup databases to `db-dumps/`
- `scripts/restore-db.sh` - Restore databases from dumps

### Usage

```bash
# Backup
./scripts/backup-db.sh

# Restore (via Docker profile)
docker compose --profile db-restore up --build
```

---

## Important Notes

### Virtual Environments

**Everything runs inside Docker containers - no local venv needed!**

If you have a `backend/venv/` folder, remove it:
```bash
rm -rf backend/venv
```

All Python dependencies are installed inside the Docker container.

### Git Ignore

The `.gitignore` is configured to ignore:
- Python virtual environments (`venv/`, `env/`, `.venv`)
- Python cache (`__pycache__/`, `*.pyc`)
- Django artifacts (`staticfiles/`, `media/`, `*.log`)
- Node.js artifacts (`node_modules/`, `dist/`)
- Database dumps (except latest ones)

### Database Dumps

- Keep dumps small (seed data only, not production data)
- Commit latest dumps to git (if <10MB)
- Use timestamps for backup dumps
- Document what's in each dump

---

## Troubleshooting

### Migrations Fail

If migrations fail after restoring a dump:
1. Check if dump's schema matches its migration history
2. Start fresh: Delete database and let migrations create it
3. Or manually fix data issues

### Port Conflicts

- PostgreSQL: Changed to 5433 to avoid conflicts
- Frontend: 5004 (5000 is taken by Node.js backend)
- Django: 8004

### Docker Issues

```bash
# Rebuild everything
docker compose down -v
docker compose up --build

# Check logs
docker compose logs django
docker compose logs frontend
docker compose logs postgres
```

---

## Migration Status

See `backend/MIGRATION.md` for detailed Django migration status and progress.

---

## License

[Add your license here]


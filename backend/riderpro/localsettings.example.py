"""
Local settings TEMPLATE — optional machine-specific overrides.

    cp backend/riderpro/localsettings.example.py backend/riderpro/localsettings.py

`localsettings.py` is GITIGNORED. You usually do NOT need it: settings.py now
ships boot defaults (DB → the docker `postgres` service, DEBUG from env), so
`docker compose up` works on a fresh checkout with no localsettings.py at all.

Create one ONLY to override those defaults — e.g. point at a different DB, run
the backend outside Docker, or add integration secrets. Anything defined here is
imported LAST in settings.py, so it wins over everything else.

Do NOT commit your real localsettings.py. Keep this template in sync when you
add a new overridable setting so the next person knows it exists.
"""

# --- Database -------------------------------------------------------------
# Default (in settings.py) targets the docker `postgres` service. Override only
# if you run Django outside Docker (talk to the host-mapped port 5433), or use a
# different database.
# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.postgresql',
#         'NAME': 'riderpro',
#         'USER': 'postgres',
#         'PASSWORD': 'password',
#         'HOST': 'localhost',
#         'PORT': '5433',
#     }
# }

# --- Debug ----------------------------------------------------------------
# settings.py reads DEBUG from the env var (docker-compose sets DEBUG=True for
# dev). Force it here if you run outside Docker. NOTE: DEBUG is the SINGLE switch
# that also controls TEST_MODE (proof-of-delivery bypass) and the production
# SECURE_* cookie/proxy hardening in settings.py — keep it False in production.
# DEBUG = False

# --- Production essentials (set these on the server) ----------------------
# SECRET_KEY signs ALL JWTs — generate a fresh secret and keep it private.
# Rotating it logs every user out. Generate one with:
#   python -c "import secrets; print(secrets.token_urlsafe(50))"
# SECRET_KEY = "replace-with-a-real-50+-char-secret"
#
# ALLOWED_HOSTS — lock to your domain in prod (settings.py defaults to '*').
# ALLOWED_HOSTS = ["riderpro.printo.in"]
#
# CSRF_TRUSTED_ORIGINS — needed for admin/login POSTs over HTTPS in prod.
# CSRF_TRUSTED_ORIGINS = ["https://riderpro.printo.in"]
#
# JWT lifetimes are env-tunable too: JWT_ACCESS_HOURS (default 24), JWT_REFRESH_DAYS (default 14).

# --- Inbound POPS / external integration API keys -------------------------
# Used by the inbound webhook auth (see CLAUDE.md → API surface). A DICT keyed by
# SOURCE NAME (the source also becomes Shipment.api_source and routes the outbound
# callback). Each value:
#   key          required — the x-api-key value callers must send
#   callback_url required — where outbound status callbacks are POSTed
#   active       required — toggle without deleting
#   auth_header  optional — extra Authorization header sent on callbacks
# Generate a key with: python -c "import secrets; print(secrets.token_urlsafe(32))"
# RIDER_PRO_API_KEYS = {
#     "pops": {
#         "key": "replace-with-a-real-key",
#         "callback_url": "https://example.com/pops/callback",
#         "active": True,
#         # "auth_header": "Bearer <token>",
#     },
# }
# (A list of entries is also tolerated for backwards-compat, but the dict form is
# canonical — a list entry has no source name unless it carries a "source" key.)

# --- CORS -----------------------------------------------------------------
# The Vite dev server proxies /api → django, so requests are same-origin and
# CORS is usually unnecessary in dev. Add origins here if you call the API
# cross-origin (e.g. a separately hosted frontend).
# CORS_ALLOWED_ORIGINS = ["http://localhost:5004"]

# --- OTP / Botspace WhatsApp delivery ------------------------------------
# Set OTP_PROVIDER='botspace' in prod. All values must be quoted Python strings.
# (Using an unquoted value causes a NameError on import and falls back to defaults.)
# OTP_PROVIDER = 'botspace'
# BOTSPACE_API_BASE = 'https://public-api.bot.space/v1'
# BOTSPACE_API_KEY = 'botspace_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
# BOTSPACE_CHANNEL_ID = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx'
# BOTSPACE_OTP_TEMPLATE = 'riderpro_otp'   # <-- must be a quoted string

# --- Object storage (S3) --------------------------------------------------
# Opt-in. When USE_S3 is true, acknowledgement media (photos, signatures,
# signed PDFs) is stored in S3 and served via a CloudFront custom domain; the
# short, permanent URL is what gets synced to POPS (its field is a
# CharField(max_length=400) — never a presigned URL). Off → local MEDIA_ROOT.
# Set these via the environment (docker-compose reads them from .env) or here.
# Keep the AWS secret OUT of version control — set it on the server only.
# import os
# os.environ.setdefault("USE_S3", "true")
# os.environ.setdefault("S3_BUCKET", "pia-oms-uploads")
# os.environ.setdefault("S3_REGION", "ap-southeast-1")
# os.environ.setdefault("S3_LOCATION", "riderpro/media")
# os.environ.setdefault("S3_CDN_DOMAIN", "cdn.riderpro.printo.in")
# os.environ.setdefault("AWS_ACCESS_KEY_ID", "AKIA...")
# os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "<secret — server only>")

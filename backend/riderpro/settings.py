"""
Django settings for riderpro project.
"""
import os
from pathlib import Path
from datetime import timedelta

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent

# Security
# DEBUG drives both Django's debug mode AND TEST_MODE (POD-acknowledgment bypass,
# defined at the end of this file) — one switch. Defaults False (prod-safe);
# docker-compose sets DEBUG=True for dev.
DEBUG = os.environ.get('DEBUG', 'False').strip().lower() in ('1', 'true', 'yes', 'on')

# SECRET_KEY signs every JWT (see SIMPLE_JWT.SIGNING_KEY) — it MUST be a real secret
# in production, set via the SECRET_KEY env var or localsettings.py. The insecure
# default only exists so local/dev can boot; never rely on it in prod.
SECRET_KEY = os.environ.get(
    'SECRET_KEY',
    'django-insecure-qr3&bu=w2n2!2w2-h(uej-!u9j46^&bd4^_+kd+b(x7($p8k2l',
)

# Comma-separated env; default '*' for dev. Set ALLOWED_HOSTS=riderpro.printo.in in prod.
ALLOWED_HOSTS = [h.strip() for h in os.environ.get('ALLOWED_HOSTS', '*').split(',') if h.strip()]

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'import_export',
    'django_json_widget',
    'apps.authentication',
    'apps.shipments',
    'apps.vehicles',
    'drf_spectacular',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'apps.core.middleware.APIAppendSlashMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'riderpro.urls'
WSGI_APPLICATION = 'riderpro.wsgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'riderpro' / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Object storage (S3) — opt-in. When USE_S3 is set, acknowledgement media (photos,
# signatures, signed PDFs) is written to S3 and served via a CloudFront custom
# domain; otherwise files fall back to local MEDIA_ROOT (Django's built-in default
# storage). querystring_auth=False so URLs are short + permanent (POPS stores them
# in a CharField(max_length=400) and must NOT receive expiring presigned URLs).
# Credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in the env.
USE_S3 = os.environ.get('USE_S3', 'False').strip().lower() in ('1', 'true', 'yes', 'on')
if USE_S3:
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                "bucket_name": os.environ.get('S3_BUCKET', ''),
                "region_name": os.environ.get('S3_REGION', 'ap-southeast-1'),
                "location": os.environ.get('S3_LOCATION', 'riderpro/media'),
                "custom_domain": os.environ.get('S3_CDN_DOMAIN', ''),
                "querystring_auth": False,
                "file_overwrite": False,
                "default_acl": None,
            },
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }

# Default primary key
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model
AUTH_USER_MODEL = 'authentication.User'

# Authentication backends
AUTHENTICATION_BACKENDS = [
    'apps.authentication.backends.RiderProAuthBackend',
    'django.contrib.auth.backends.ModelBackend',
]

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.authentication.jwt_auth.CookieJWTAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PARSER_CLASSES': (
        'rest_framework.parsers.MultiPartParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.JSONParser',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# Spectacular Settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'RiderPro API',
    'DESCRIPTION': 'Modern logistics and shipment management API',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_PATCH': True,
    'COMPONENT_SPLIT_REQUEST': True,
    'PREPROCESSING_HOOKS': [],
    'POSTPROCESSING_HOOKS': [],
    'SERVER_CLASSES': [],
    'SCHEMA_PATH_PREFIX': '/api',
}

# JWT Settings
SIMPLE_JWT = {
    # Lifetimes are env-tunable; defaults are a big cut from the old 45d/10000d.
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=int(os.environ.get('JWT_ACCESS_HOURS', '24'))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.environ.get('JWT_REFRESH_DAYS', '14'))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": False,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "VERIFYING_KEY": None,
    "AUDIENCE": None,
    "ISSUER": None,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "TOKEN_TYPE_CLAIM": "token_type",
    "JTI_CLAIM": "jti",
    "SLIDING_TOKEN_REFRESH_EXP_CLAIM": "refresh_exp",
    "SLIDING_TOKEN_LIFETIME": timedelta(minutes=5),
    "SLIDING_TOKEN_REFRESH_LIFETIME": timedelta(days=1),
}

# CORS
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = []

# POPS API
POPS_API_BASE_URL = os.environ.get('POPS_API_BASE_URL', 'http://localhost:8002/api/v1')
RIDER_PRO_SERVICE_TOKEN = os.environ.get('RIDER_PRO_SERVICE_TOKEN', '')
POPS_SERVICE_EMAIL = os.environ.get('POPS_SERVICE_EMAIL', '')
POPS_SERVICE_PASSWORD = os.environ.get('POPS_SERVICE_PASSWORD', '')

# OTP Settings
OTP_PROVIDER = os.environ.get('OTP_PROVIDER', 'console')
OTP_TTL_SECONDS = int(os.environ.get('OTP_TTL_SECONDS', 300))
OTP_MAX_ATTEMPTS = int(os.environ.get('OTP_MAX_ATTEMPTS', 5))
OTP_RESEND_COOLDOWN = int(os.environ.get('OTP_RESEND_COOLDOWN', 45))
# Lenient abuse caps (anti SMS/WhatsApp pumping) — generous on purpose.
OTP_MAX_PER_PHONE_PER_DAY = int(os.environ.get('OTP_MAX_PER_PHONE_PER_DAY', 10))
OTP_MAX_PER_IP_PER_HOUR = int(os.environ.get('OTP_MAX_PER_IP_PER_HOUR', 30))

# Botspace WhatsApp API credentials
BOTSPACE_API_BASE = os.environ.get('BOTSPACE_API_BASE', 'https://public-api.bot.space/v1')
BOTSPACE_API_KEY = os.environ.get('BOTSPACE_API_KEY', '')
BOTSPACE_CHANNEL_ID = os.environ.get('BOTSPACE_CHANNEL_ID', '')
BOTSPACE_OTP_TEMPLATE = os.environ.get('BOTSPACE_OTP_TEMPLATE', '')
BOTSPACE_SENDER = os.environ.get('BOTSPACE_SENDER', '')

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# TEST_MODE (POD-acknowledgment bypass) is defined at the END of this file, tied
# to DEBUG so prod always enforces it — one switch. Do not set it here.

# Database Cleanup Settings
CLEANUP_SETTINGS = {
    'enabled': True,
    'default_retention_days': 3,
    'backup_before_delete': False,  # Set to True for production
    'cleanup_time': '02:00',  # Daily at 2 AM
    'log_file': 'cleanup.log',
}

# ---------------------------------------------------------------------------
# Routing provider — change ROUTING_PROVIDER in the environment only,
# no code changes needed.
#
#   ROUTING_PROVIDER=ors       OpenRouteService API (DEFAULT).
#                              Free: 2,000 requests/day — enough for most ops.
#                              Register free at https://openrouteservice.org
#                              and set ORS_API_KEY. No local data required.
#
#   ROUTING_PROVIDER=google    Google Distance Matrix API.
#                              Set GOOGLE_MAPS_API_KEY. Pay-per-use after
#                              $200/month free credit. No local data required.
#
#   ROUTING_PROVIDER=osrm      Self-hosted OSRM. Set OSRM_BASE_URL.
#                              Requires one-time data setup via
#                              scripts/setup-osrm.sh. No per-call cost.
#
#   ROUTING_PROVIDER=haversine Straight-line fallback. No external service.
#                              Inaccurate on real roads — dev/offline only.
#
# Every backend falls back to Haversine automatically if its external service
# is unreachable, so the app always works even without a provider configured.
# ---------------------------------------------------------------------------
ROUTING_PROVIDER = os.environ.get('ROUTING_PROVIDER', 'ors')

# OpenRouteService: free API key from https://openrouteservice.org (no local data needed)
ORS_API_KEY = os.environ.get('ORS_API_KEY', '')
ORS_BASE_URL = os.environ.get('ORS_BASE_URL', 'https://api.openrouteservice.org')

# Google Maps: API key (required only when ROUTING_PROVIDER=google)
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', '')

# OSRM: only needed if ROUTING_PROVIDER=osrm (self-hosted, requires local map data)
# See routing.py OSRMBackend for details. Not used in the default stack.
OSRM_BASE_URL = os.environ.get('OSRM_BASE_URL', 'http://osrm:5000')

# Assumed average driving speed (km/h) used by the Haversine fallback
# to estimate travel times when no routing provider returns real durations.
ROUTING_AVERAGE_SPEED_KMH = float(os.environ.get('ROUTING_AVERAGE_SPEED_KMH', '30'))

# Service (dwell) time per stop in seconds — time a rider spends at each stop
# handing over, collecting the POD signature, etc. Added to ETAs so they reflect
# reality, not just driving time. Default 3 minutes; tune to your operation.
ROUTING_STOP_SERVICE_SECONDS = int(os.environ.get('ROUTING_STOP_SERVICE_SECONDS', '180'))

# ---------------------------------------------------------------------------
# Boot defaults — let the app run out-of-the-box (e.g. `docker compose up`)
# WITHOUT a localsettings.py. These read from env vars (the docker-compose
# values) and fall back to the local dev postgres container. localsettings.py
# is imported LAST (below), so any server/prod config there overrides these
# and existing deployments are unaffected.
# (DEBUG/SECRET_KEY/ALLOWED_HOSTS are defined at the top of this file, also env-driven.)
# ---------------------------------------------------------------------------
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('POSTGRES_DB', 'riderpro'),
        'USER': os.environ.get('POSTGRES_USER', 'postgres'),
        'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'password'),
        'HOST': os.environ.get('POSTGRES_HOST', 'postgres'),
        'PORT': os.environ.get('POSTGRES_PORT', '5432'),
    }
}

# ---------------------------------------------------------------------------
# Google Sign-In ("Continue with Google" on the PIA Access login).
# The OAuth client ID is public-by-design (it ships in the frontend); the
# backend uses it to verify the `aud` of incoming id_tokens. GOOGLE_ADMIN_EMAILS
# is the bootstrap allowlist — those verified emails are granted admin
# (super_user) on first Google login. Override either in localsettings.py / env.
# ---------------------------------------------------------------------------
GOOGLE_OAUTH_CLIENT_ID = os.environ.get(
    'GOOGLE_OAUTH_CLIENT_ID',
    '875434468582-2a7h0gahc6sq6jm3gfmre9cca1lhh0p7.apps.googleusercontent.com',
)
GOOGLE_ADMIN_EMAILS = [
    e.strip().lower()
    for e in os.environ.get('GOOGLE_ADMIN_EMAILS', '').split(',')
    if e.strip()
]

# Local-only overrides (machine-specific secrets, DB, DEBUG, integration API
# keys). GITIGNORED and OPTIONAL: copy localsettings.example.py to
# localsettings.py only if you need to override the defaults above. Imported
# last so it wins over everything in this file.
if os.path.exists(os.path.join(os.path.dirname(__file__), 'localsettings.py')):
    # Import only when the file actually exists, so a real error *inside*
    # localsettings.py surfaces (instead of being silently swallowed, which would
    # drop every override). Missing file = clean skip (boot on the defaults above).
    from .localsettings import *  # noqa: F401,F403

# ---------------------------------------------------------------------------
# Derived / last-word settings — computed AFTER localsettings so they track the
# FINAL value of DEBUG (whether DEBUG came from env or a localsettings override).
# ---------------------------------------------------------------------------
# TEST_MODE bypasses delivery-acknowledgment (proof-of-delivery) validation. Tying
# it to DEBUG means production (DEBUG=False) ALWAYS enforces POD — one switch.
TEST_MODE = DEBUG

if not DEBUG:
    # Production hardening (active whenever DEBUG is off). nginx terminates TLS,
    # already redirects HTTP->HTTPS and sends HSTS; here we make Django trust the
    # proxy and mark its own cookies Secure/HttpOnly.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

# Re-derive the JWT signing key from the FINAL SECRET_KEY. SIMPLE_JWT above was
# built before localsettings.py was imported, so it captured the boot-time
# SECRET_KEY; without this, a SECRET_KEY set in localsettings.py would rotate
# Django's key but NOT the JWT signing key. Keep them in lockstep.
SIMPLE_JWT["SIGNING_KEY"] = SECRET_KEY

# Fail LOUD if production ever boots on the insecure development SECRET_KEY (e.g.
# localsettings.py missing on the server, or the SECRET_KEY env var unset). A
# predictable key lets anyone forge JWTs and impersonate any user — refusing to
# start is far safer than silently running prod with a known signing key.
if not DEBUG and SECRET_KEY.startswith('django-insecure'):
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured(
        "DEBUG=False but SECRET_KEY is the insecure development default. "
        "Set a real SECRET_KEY in localsettings.py or the SECRET_KEY env var."
    )

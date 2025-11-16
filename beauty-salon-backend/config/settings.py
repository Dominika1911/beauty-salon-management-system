from pathlib import Path
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR.parent / ".env")


def env_list(name: str, default: str = "") -> list[str]:
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]

debug_env = os.getenv("DEBUG", "1")
DEBUG = debug_env.lower() in ("1", "true", "yes", "y")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")

if not SECRET_KEY:
    if not DEBUG:
        raise EnvironmentError("DJANGO_SECRET_KEY jest wymagany w trybie produkcyjnym.")
    SECRET_KEY = "insecure-key-for-development-only"

ALLOWED_HOSTS = env_list(
    "ALLOWED_HOSTS",
    "localhost,127.0.0.1,[::1],backend",
)

CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:5173,"
    "http://127.0.0.1:5173,"
    "http://[::1]:5173,"
    "http://localhost:8000,"
    "http://127.0.0.1:8000",
)

# --- Aplikacje ---

INSTALLED_APPS = [
    # Główna aplikacja (z custom adminem / modelem usera)
    "beauty_salon.apps.BeautySalonConfig",

    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Postgres-specific features
    "django.contrib.postgres",

    # Third-party
    "rest_framework",
    "corsheaders",
]

AUTH_USER_MODEL = "beauty_salon.User"

# --- Middleware ---

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",  # musi być wysoko
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        # katalog templates w backendzie
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# --- Baza danych: PostgreSQL z .env ---

if not DEBUG:
    required_db_env = ["DB_NAME", "DB_USER", "DB_PASSWORD", "DB_HOST", "DB_PORT"]
    missing_db = [var for var in required_db_env if not os.getenv(var)]
    if missing_db:
        raise EnvironmentError(
            "Brak wymaganych zmiennych środowiskowych dla bazy danych: "
            + ", ".join(missing_db)
        )

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
        "HOST": os.getenv("DB_HOST", "db"),  # w Dockerze typowo "db"
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}

# --- Walidacja haseł ---

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- Lokale / czas ---

LANGUAGE_CODE = "pl"
TIME_ZONE = os.getenv("TZ", "Europe/Warsaw")
USE_I18N = True
USE_TZ = True

# --- Statyczne / media ---

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [
    BASE_DIR / "static",
]

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- CORS / DRF ---

CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOW_CREDENTIALS = True

_cors_env = os.getenv("CORS_ALLOWED_ORIGINS")
if _cors_env:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")

REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
}

# --- Dodatkowe zabezpieczenia na produkcji ---

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    CSRF_COOKIE_HTTPONLY = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = 31536000  # 1 rok
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

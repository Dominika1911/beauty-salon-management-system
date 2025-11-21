"""
Django settings for config project.

Projekt: Beauty Salon Management System
"""

from pathlib import Path
import os
from dotenv import load_dotenv

# =====================================================================
# ŚCIEŻKI I ENV
# =====================================================================

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent  # katalog wyżej (tam gdzie .env)

# Wczytanie zmiennych z pliku .env w katalogu głównym projektu
load_dotenv(PROJECT_ROOT / ".env")

# =====================================================================
# PODSTAWOWE USTAWIENIA
# =====================================================================

# Klucz – trzymaj TYLKO w .env
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "DEV-ONLY-CHANGE-ME")

# Na produkcji ustaw DEBUG = False i ogarnij ALLOWED_HOSTS
DEBUG = True

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "[::1]",
]

# Skąd wolno wysyłać formularze (CSRF) – np. frontend Vite
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://[::1]:5173",
]

# CORS (dla zapytań JS z frontendu)
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://[::1]:5173",
]
CORS_ALLOW_CREDENTIALS = True

# =====================================================================
# APLIKACJE
# =====================================================================

INSTALLED_APPS = [
    # Django core
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "rest_framework",
    "corsheaders",
    "django_filters",

    # Twoja appka z salonem
    "beauty_salon.apps.BeautySalonConfig",
]

# =====================================================================
# MIDDLEWARE
# =====================================================================

MIDDLEWARE = [
    # CORS NA POCZĄTKU
    "corsheaders.middleware.CorsMiddleware",

    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

# =====================================================================
# TEMPLATES
# =====================================================================

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# =====================================================================
# BAZA DANYCH (PostgreSQL z .env)
# =====================================================================

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "beauty_salon"),
        "USER": os.getenv("DB_USER", "postgres"),
        "PASSWORD": os.getenv("DB_PASSWORD", "Haslo!123"),
        # lokalnie (DEBUG=True) zawsze łączymy się z localhost,
        # w produkcji / Dockerze bierzemy hosta z ENV (np. "db")
        "HOST": "localhost" if DEBUG else os.getenv("DB_HOST", "db"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}

# =====================================================================
# UŻYTKOWNICY / AUTH
# =====================================================================

AUTH_USER_MODEL = "beauty_salon.User"  # <- Twój custom User

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# =====================================================================
# I18N / CZAS
# =====================================================================

LANGUAGE_CODE = "pl"

TIME_ZONE = "Europe/Warsaw"
USE_I18N = True
USE_TZ = True  # w bazie UTC, w aplikacji PL

# =====================================================================
# STATIC / MEDIA
# =====================================================================

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "static"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# =====================================================================
# DRF – DJANGO AUTH (SESSION + BASIC)
# =====================================================================

REST_FRAMEWORK = {
    # Django auth:
    # - SessionAuthentication -> działa w przeglądarce (cookies, np. po zalogowaniu w /admin/ albo /api-auth/login/)
    # - BasicAuthentication   -> wygodne do Postmana
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],

    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],

    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
}

# =====================================================================
# DEFAULT AUTO FIELD
# =====================================================================

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

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

# =====================================================================
# CORS I CSRF
# =====================================================================

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
# SESSION & CSRF COOKIES (dla Session Authentication)
# =====================================================================

# Cookies mogą iść po HTTP (bo nie ma HTTPS w dev)
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

# Lax chroni przed większością CSRF w zwykłej nawigacji
# dla SPA na tym samym host (localhost) i tak działa dobrze
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

# Sesja tylko dla backendu (JS nie zobaczy cookie sesji)
SESSION_COOKIE_HTTPONLY = True

# CSRF musi być widoczny w JS, żeby móc go wrzucać w X-CSRFToken
CSRF_COOKIE_HTTPONLY = False

# Dobrze jest jawnie nazwać cookie, standardowa nazwa
CSRF_COOKIE_NAME = "csrftoken"

# Nazwa cookie sesji
SESSION_COOKIE_NAME = "sessionid"

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
   "django.middleware.csrf.CsrfViewMiddleware",  # CSRF włączony
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
        # KLUCZOWA ZMIANA
        "HOST": os.getenv("DB_HOST", "localhost"),  # np. lokalnie DB_HOST=localhost, w Dockerze DB_HOST=db
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

# Tu trzymasz swoje pliki statyczne w trakcie developmentu
STATICFILES_DIRS = [
    BASE_DIR / "static",
]

# Tu Django będzie zrzucało zebrane pliki (collectstatic) – na prod
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# =====================================================================
# DRF – DJANGO SESSION AUTH
# =====================================================================

REST_FRAMEWORK = {
    # Renderery - WAŻNE: tylko JSON, bez HTML templates
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],

    # Django Session Authentication (cookies)
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        # BasicAuthentication - zalenić na to (+ wyłączyć CSRF):
        # "rest_framework.authentication.BasicAuthentication",
    ],

    # Domyślnie wymagane logowanie
    # "DEFAULT_PERMISSION_CLASSES": [
    #   "rest_framework.permissions.IsAuthenticated",
    # ],

    # Do testów w Postmanie zalenić na to:
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],

    # Filtry
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],

    # Paginacja
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

# =====================================================================
# DEFAULT AUTO FIELD
# =====================================================================

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
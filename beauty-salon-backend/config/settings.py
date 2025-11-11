# beauty-salon-backend/beauty_salon/settings.py
from pathlib import Path
import os
from dotenv import load_dotenv

# Definicja katalogu bazowego (BASE_DIR)
BASE_DIR = Path(__file__).resolve().parent.parent

# Ładowanie zmiennych z pliku .env.
# Wczyta plik .env znajdujący się w folderze beauty-salon-backend
load_dotenv(BASE_DIR / ".env") 

# --- Podstawy ---
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret-dont-use-in-prod")
DEBUG = os.getenv("DEBUG", "1") == "1"
# Dodano "backend" dla ruchu wewnątrz Dockera
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]", "backend"] 

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://[::1]:5173",
]

# --- Aplikacje ---
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Pakiety firm trzecich
    "rest_framework",
    "corsheaders",

    # Twoja aplikacja
    "beauty_salon.apps.BeautySalonConfig", 
]

# Używamy własnego modelu użytkownika (upewnij się, że masz zdefiniowany ten model)
AUTH_USER_MODEL = "beauty_salon.User" 

# --- Middleware ---
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware", # Zawsze wysoko
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls" # Zmieniono na 'config.urls' zgodnie z Twoją strukturą katalogów

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
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

WSGI_APPLICATION = "config.wsgi.application" # Zmieniono na 'config.wsgi.application'

# --- Baza danych: PostgreSQL z .env (DB_*) ---
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME"),       # Używa DB_NAME z Twojego .env
        "USER": os.getenv("DB_USER"),       # Używa DB_USER z Twojego .env
        "PASSWORD": os.getenv("DB_PASSWORD"), # Używa DB_PASSWORD z Twojego .env
        "HOST": "db",                       # KLUCZOWE: Nazwa serwisu DB w Docker Compose
        "PORT": "5432",                     # Port jest standardowy
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
TIME_ZONE = os.getenv("TZ", "Europe/Warsaw") # Odczyta TZ, jeśli jest w .env, inaczej ustawi domyślnie
USE_I18N = True
USE_TZ = True # Używanie stref czasowych

# --- Statyczne / media ---
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- CORS/DRF ---
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://[::1]:5173",
]
CORS_ALLOW_CREDENTIALS = True

REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}
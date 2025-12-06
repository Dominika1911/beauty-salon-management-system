## Zarządzanie Backendem (Docker Compose)

# Uruchamia kontener Django w tle
function dj-up {
    docker-compose -f docker-compose.full.yml up -d backend
}

# Zatrzymuje kontener backend
function dj-down {
    docker-compose -f docker-compose.full.yml stop backend
}

# Wyświetla logi serwisu backend w czasie rzeczywistym
function dj-logs {
    docker-compose -f docker-compose.full.yml logs -f backend
}

# Wykonuje komendę python manage.py wewnątrz kontenera (np. dj createsuperuser)
function dj {
    docker-compose -f docker-compose.full.yml exec backend python manage.py @args
}

# Wykonuje makemigrations i migrate
function dj-migracje {
    dj makemigrations ; dj migrate
}

# Wypełnia bazę danych danymi testowymi
function dj-seed {
    dj seed_database --clear --clients 25
}

# Restartuje kontener backend
function dj-restart {
    docker-compose -f docker-compose.full.yml restart backend
}

# Uruchamia Mypy wewnątrz kontenera z plikiem konfiguracyjnym
function dj-mypy {
    docker-compose -f docker-compose.full.yml exec backend python -m mypy --config-file beauty-salon-backend/mypy.ini beauty_salon
}

# Uruchamia Pyright wewnątrz kontenera (Pyright automatycznie szuka pyrightconfig.json)
function dj-pyright {
    # Używamy sh -c, aby upewnić się, że Pyright znajduje konfigurację w katalogu roboczym
    docker-compose -f docker-compose.full.yml exec backend sh -c "pyright"
}

# Uruchamia Pyright wewnątrz kontenera (Pyright automatycznie szuka pyrightconfig.json)
function dj-build {
    docker-compose -f docker-compose.full.ymf-l build backend
}

## Uruchamianie Frontendu (Vite/React)

# Uruchamia frontend po instalacji zależności
function f {
    pnpm dev
}

# Uruchamia pełną kontrolę typów (TSC) i lintowanie (ESLint)
function f-lint {
    pnpm build ; pnpm lint
}


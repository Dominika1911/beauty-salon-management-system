# -------------------------
# beauty-salon-management-system
# -------------------------

# Backend (Docker Compose)

function dj-up {
  docker-compose -f docker-compose.full.yml up -d backend
}

function dj-down {
  docker-compose -f docker-compose.full.yml stop backend
}

function dj-logs {
  docker-compose -f docker-compose.full.yml logs -f backend
}

function dj {
  docker-compose -f docker-compose.full.yml exec backend python manage.py $args
}

function dj-migracje {
  dj makemigrations
  dj migrate
}

function dj-seed {
  dj seed_database --clear --clients 25
}

function dj-restart {
  docker-compose -f docker-compose.full.yml restart backend
}

function dj-mypy {
  docker-compose -f docker-compose.full.yml exec backend python -m mypy `
    --config-file beauty-salon-backend/mypy.ini beauty_salon
}

function dj-pyright {
  docker-compose -f docker-compose.full.yml exec backend sh -c "pyright"
}

function dj-build {
  docker-compose -f docker-compose.full.yml build backend
}

# Frontend (Vite/React)

function f {
  pnpm dev
}

function f-lint {
  pnpm build
  pnpm lint
}

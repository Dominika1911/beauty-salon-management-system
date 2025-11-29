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
    docker-compose -f docker-compose.full.yml exec backend python manage.py @args
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

function r {
    pnpm dev
}

function r-lint {
    pnpm build ; pnpm lint
}

# Backend - Django
dj-migrate() {
    python manage.py makemigrations &&
    python manage.py migrate
}

dj() {
    python manage.py runserver
}

dj-lint() {
    mypy . ; pyright
}

# Frontend - React (zmienione z r na f)
f-lint() {
    tsc -b ; pnpm lint
}

f() {
    # pnpm install
    pnpm dev
}
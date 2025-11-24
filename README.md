## PowerShell functions (dev helper)

```powershell
function dj {
    docker-compose -f docker-compose.full.yml exec backend python manage.py @Args
}

function dj-migracje {
    dj makemigrations
    dj migrate
}

function dj-seed {
    dj seed_database --clear --clients 25
}

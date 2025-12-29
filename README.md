function dj-migrate {
  py manage.py makemigrations
  if ($LASTEXITCODE -ne 0) { return }
  py manage.py migrate
}

function dj-seed {
  py manage.py seed_database --clear --demo
}

function dj {
  py manage.py runserver
}

function f {
  pnpm run dev
}

function f-build {
  pnpm run build
}

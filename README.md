function dj { py manage.py @args }
function dj-m { dj makemigrations; if($LASTEXITCODE -ne 0){return}; dj migrate }
function dj-run { dj runserver }

function f { pnpm dev }
function f-lint { pnpm build; if($LASTEXITCODE -ne 0){return}; pnpm lint }

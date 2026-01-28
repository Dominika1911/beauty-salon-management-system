# System Zarządzania Salonem Kosmetycznym

Projekt aplikacji webowej typu full-stack stworzony jako praca inżynierska (Django + Django REST Framework, React, PostgreSQL).

---

## Wymagania

- Python 3.11+
- Node.js 18+
- pnpm
- PostgreSQL 15+

---

## Instalacja i uruchomienie backendu
```bash
cd beauty-salon-backend

# utworzenie i aktywacja środowiska wirtualnego
python -m venv venv
source venv/bin/activate  # Linux / macOS
venv\Scripts\Activate.ps1 # Windows

# instalacja zależności
pip install -r requirements.txt

# skopiowanie pliku konfiguracyjnego
cp .env.example .env       # Linux / macOS
copy .env.example .env     # Windows
# Edytuj .env i ustaw dane dostępowe do bazy danych

# migracje bazy danych i dane początkowe
python manage.py migrate
python manage.py seed_database

# utworzenie konta administratora (opcjonalne - seed_database tworzy konto)
python manage.py createsuperuser

# uruchomienie serwera
python manage.py runserver
```

Serwer backendowy będzie dostępny pod adresem: `http://localhost:8000`

---

## Instalacja i uruchomienie frontendu
```bash
cd beauty-salon-frontend

# instalacja zależności
pnpm install


# uruchomienie serwera deweloperskiego
pnpm dev
```

Aplikacja frontendowa będzie dostępna pod adresem: `http://localhost:5173`

---

## Konfiguracja środowiska

Pliki ze zmiennymi środowiskowymi nie są zawarte w repozytorium.  
Przykładowy plik konfiguracyjny znajdują się jako `.env.example`.  
Pliki należy skopiować do `.env` i skonfigurować.

**Backend** (`beauty-salon-backend/.env.example`):
- Dane dostępowe do bazy danych
- Klucz tajny Django

---

## Testowanie

### Backend
```bash
cd beauty-salon-backend

# instalacja zależności testowych
pip install -r requirements-test.txt

# uruchomienie testów
pytest

# testy z pokryciem kodu
pytest --cov=beauty_salon
```

### Frontend
```bash
cd beauty-salon-frontend

pnpm test:run
```

### E2E
```bash
# 1. Uruchom backend z danymi testowymi
cd beauty-salon-backend
python manage.py seed_e2e
python manage.py runserver

# 2. W nowym terminalu uruchom frontend
cd beauty-salon-frontend
pnpm dev

# 3. W kolejnym terminalu uruchom testy E2E
cd beauty-salon-frontend
pnpm e2e
```

---

## Autor

Dominika Jedynak   


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
# utworzenie i aktywacja środowiska wirtualnego
python -m venv venv
source venv/bin/activate  # Linux / macOS
venv\Scripts\Activate.ps1 # Windows

# instalacja zależności
pip install -r requirements.txt

# skopiowanie pliku ze zmiennymi środowiskowymi
cp .env.example .env
# Edytuj .env i ustaw dane dostępowe do bazy danych

# migracje bazy danych i dane początkowe
python manage.py migrate
python manage.py seed_database

# utworzenie konta administratora (opcjonalne - seed_database już stworzy)
python manage.py createsuperuser

# uruchomienie serwera
python manage.py runserver
```

Serwer backendowy będzie dostępny pod adresem:  
`http://localhost:8000`

---

## Instalacja i uruchomienie frontendu
```bash
# instalacja zależności
pnpm install

# skopiowanie pliku ze zmiennymi środowiskowymi
cp .env.example .env

# uruchomienie serwera deweloperskiego
pnpm dev
```

Aplikacja frontendowa będzie dostępna pod adresem:  
`http://localhost:5173`

---

## Konfiguracja środowiska

Pliki ze zmiennymi środowiskowymi nie są zawarte w repozytorium.  
Przykładowe pliki konfiguracyjne znajdują się jako `.env.example`.  
Pliki należy skopiować do `.env` i skonfigurować.

**Backend** (`beauty-salon-backend/.env.example`):
- Dane dostępowe do bazy danych
- Klucz tajny Django
---

## Testowanie

### Backend
```bash
pytest                     # Uruchomienie testów
pytest --cov=beauty_salon  # Testy z pokryciem kodu
```

### Frontend
```bash
pnpm test:run             # Uruchomienie testów
```

### E2E
Przed uruchomieniem testów E2E:
1. Uruchom backend: `python manage.py runserver`
2. Załaduj dane testowe: `python manage.py seed_e2e`
3. Uruchom frontend w nowym terminalu: `pnpm dev`
4. Uruchom testy w kolejnym terminalu: `pnpm e2e`

---

## Autor

Dominika Jedynak (092721)  
Politechnika Świętokrzyska  
Promotor: dr inż. Józef Ciosmak
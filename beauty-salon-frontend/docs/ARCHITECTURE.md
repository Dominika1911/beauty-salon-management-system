# Struktura frontendu (propozycja do pracy inżynierskiej)

Ten projekt został uporządkowany według podejścia **app / shared / features / pages**.

Główne cele:
- krótsze i czytelniejsze importy (alias `@` → `src/`),
- rozdzielenie kodu infrastrukturalnego (router, layout, providery) od logiki biznesowej,
- łatwiejsze utrzymanie i rozbudowa projektu.

## Drzewo katalogów

```
src/
  app/
    App.tsx                 # Root aplikacji + globalne providery
    layout/                 # Layout aplikacji (Sidebar, siatka)
    providers/              # Contexty / providery globalne (np. Auth)
    router/                 # Routing i guardy (ProtectedRoute)

  features/
    manager/components/      # Komponenty używane w widokach managera (modale, formularze)
    schedule/components/     # Komponenty grafiku (edytor, urlopy, widok tygodniowy)
    appointments/components/ # (miejsce na komponenty wizyt)

  pages/                     # Komponenty stron routowanych (widoki)
    Employee/
    Manager/

  shared/
    api/                     # Warstwa komunikacji z backendem (axios + endpointy)
    hooks/                   # Współdzielone hooki (useAuth, usePagination…)
    types/                   # Typy TS używane w wielu miejscach
    utils/                   # Funkcje pomocnicze
    ui/                      # Współdzielone komponenty UI (Modal, Notification, Table…)

  assets/                    # Statyczne assety (svg, obrazy)
  index.css                  # style globalne
  main.tsx                   # entrypoint Vite (renderuje <App/>)
```

## Alias importów `@`

W projekcie dodano alias:
- `@/*` → `src/*`

Dzięki temu importy wyglądają np. tak:

```ts
import { appointmentsAPI } from '@/shared/api/appointments';
import { ScheduleEditor } from '@/features/schedule/components/ScheduleEditor';
```

Konfiguracja znajduje się w:
- `tsconfig.json` (`baseUrl`, `paths`)
- `vite.config.ts` (`resolve.alias`)

## Zasady porządku (warto opisać w pracy)

1. **`pages/` nie powinno zawierać logiki współdzielonej** – jeśli coś powtarza się w wielu miejscach, przenieś do `shared/` lub `features/`.
2. **API w jednym miejscu (`shared/api`)** – łatwa podmiana backendu, mockowanie, testowanie.
3. **UI generyczne w `shared/ui`** – nie zawiera zależności domenowych.
4. **Komponenty domenowe w `features/*`** – np. modale managera, komponenty grafiku.
5. **Barrel files (opcjonalnie)** – możesz dodać `index.ts` w feature/shared, żeby jeszcze skrócić importy.


## Style

Wszystkie pliki `.css` są trzymane w jednym miejscu: `src/styles/`.

- `src/styles/global/` – style globalne (reset, font, zmienne)
- `src/styles/layout/` – style dla layoutu (np. sidebar, wrapper)
- `src/styles/components/` – style wspólne dla komponentów (Modal, Table, formularze)
- `src/styles/pages/` – style stron (widoki routowane)

Zasada: komponenty importują tylko style z `@/styles/...`.

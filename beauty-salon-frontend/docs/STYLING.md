# Konwencja stylowania

W projekcie wszystkie pliki CSS są zcentralizowane w `src/styles/`.

## Importy

- style globalne ładowane są w `src/main.tsx`:

```ts
import '@/styles/global/global.css';
```

- pozostałe style są importowane lokalnie w komponentach/stronach (ale zawsze z `@/styles/...`).

## Struktura

- `styles/global/` – reset, font, zmienne CSS
- `styles/layout/` – layout aplikacji (np. `Layout.css`)
- `styles/components/` – komponenty współdzielone (np. `Modal.css`, `Table.css`, formularze w modalu)
- `styles/pages/` – style stron routowanych
- `styles/pages/manager/` – style stron z panelu managera

## Zasady porządkowe

1. Nie trzymamy plików `.css` obok komponentów (żeby nie rozpraszać struktury domenowej).
2. Jeżeli styl jest specyficzny dla strony – ląduje w `styles/pages/...`.
3. Jeżeli styl dotyczy komponentu wielokrotnego użytku – ląduje w `styles/components/...`.
4. W importach unikamy ścieżek względnych typu `../../...` – używamy aliasu `@`.

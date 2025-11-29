// plik: eslint.config.js

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
          // POPRAWIONA LINIA: uwzględnia oba pliki konfiguracyjne TypeScript
          project: ['./tsconfig.app.json', './tsconfig.node.json'],
      },
    },

    // ==========================================================
    // SEKCJA Z RYGORYSTYCZNYMI REGULAMI TYPUJACYMI
    // Te reguły pozostawiamy, bo są to Twoje zamierzone ustawienia.
    // Pamiętaj, że nadal będziesz musiał poprawić błędy typowania w plikach .tsx!
    // ==========================================================
    rules: {
        // 1. ZABRONIENIE JAWNEGO UZYCIA 'ANY'
        '@typescript-eslint/no-explicit-any': 'error',

        // 2. WYMUSZANIE JAWNEGO TYPU ZWRACANEGO (dla funkcji)
        '@typescript-eslint/explicit-function-return-type': 'error',

        // 3. WYMUSZANIE JAWNEGO TYPU DLA POL, ZMIENNYCH I ARGUMENTOW
        '@typescript-eslint/typedef': [
            'error',
            {
                arrowParameter: true,
                variableDeclaration: true,
                propertyDeclaration: true,
                parameter: true,
            },
        ],
        // Dodatkowo, aby uniknąć błędu z React Fast Refresh (jeśli go nie masz)
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
    // ==========================================================
  },
])
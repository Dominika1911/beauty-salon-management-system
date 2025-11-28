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
          project: ['./tsconfig.app.json'],
      },
    },

    // ==========================================================
    // SEKCJA Z RYGORYSTYCZNYMI REGUŁAMI Z TYPUJĄCYMI (JAK U KOLEGI)
    // ==========================================================
    rules: {
        // 1. ZABRONIENIE JAWNEGO UŻYCIA 'ANY'
        '@typescript-eslint/no-explicit-any': 'error',

        // 2. WYMUSZANIE JAWNEGO TYPU ZWRACANEGO (dla funkcji)
        '@typescript-eslint/explicit-function-return-type': 'error',

        // 3. WYMUSZANIE JAWNEGO TYPU DLA PÓL, ZMIENNYCH I ARGUMENTÓW
        '@typescript-eslint/typedef': [
            'error',
            {
                arrowParameter: true,
                variableDeclaration: true,
                propertyDeclaration: true,
                parameter: true,
            },
        ],
    },
    // ==========================================================
  },
])
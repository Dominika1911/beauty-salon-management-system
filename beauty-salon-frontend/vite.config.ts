import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      url: 'http://localhost/',
    },

    setupFiles: ['./src/test/setupTests.ts'],
    globals: true,
    css: true,
    clearMocks: true,

    include: ['src/**/*.{test,spec}.{ts,tsx}'],

    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.{idea,git,cache,output,temp}/**',
      'tests/e2e/**',
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],

      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',

        'tests/e2e/**',
        'playwright.config.*',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.test.ts',
        '**/*.test.tsx',
        'src/test/**',
      ],
    },
  },
});
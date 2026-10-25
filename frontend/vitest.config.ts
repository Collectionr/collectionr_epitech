import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'styles', environment: 'node', include: ['styles/**/*.test.ts'] },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
            '@shared': fileURLToPath(new URL('./packages/shared/src', import.meta.url)),
          },
        },
        test: {
          name: 'web',
          root: './apps/web',
          environment: 'node',
          include: ['src/**/*.test.tsx'],
        },
      },
      {
        test: {
          name: 'shared',
          root: './packages/shared',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}'],
      // apps/mobile est testé par Jest (jest-expo), pas par Vitest : l'inclure le listerait à 0 %.
      exclude: ['**/*.test.{ts,tsx}', '**/index.ts', '**/*.d.ts', 'apps/mobile/**'],
    },
  },
});

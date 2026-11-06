import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'styles', environment: 'node', include: ['styles/**/*.test.ts'] },
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

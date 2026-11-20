import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Testing Library : sans globals, Vitest ne démonte pas les rendus entre deux tests.
    // Hérité par tous les projets (comportement par défaut de Vitest 5) ; sans effet sans rendu.
    setupFiles: [fileURLToPath(new URL('./vitest.setup.ts', import.meta.url))],
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
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
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
      reporter: ['text', 'html'],
      // Dossier propre à Vitest, vidé à chaque passage : le rapport du mobile est écrit à côté.
      reportsDirectory: './coverage/web-shared',
      // Liste explicite : un fichier source sans test compte à 0 %. Les fichiers de configuration
      // (vite, tailwind, postcss, .storybook, preset de styles/) sont hors de src/, donc hors calcul.
      include: ['packages/*/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}'],
      exclude: [
        // apps/mobile est testé par Jest (jest-expo), pas par Vitest : l'inclure le listerait à 0 %.
        'apps/mobile/**',
        // Tests et stories : code de vérification ou de démonstration, pas de l'application.
        '**/*.test.{ts,tsx}',
        '**/*.stories.{ts,tsx}',
        // Types : déclarations sans code exécuté (types/ est réservé aux interfaces, architecture.md).
        '**/*.d.ts',
        '**/types/**',
        // Barrels : réexports uniquement. Un index.ts qui porte de la logique doit sortir du motif.
        '**/index.ts',
        // Doublures de test : mocks manuels et futurs handlers MSW.
        '**/mocks/**',
        '**/__mocks__/**',
        // Point d'entrée Vite : branchement pur, comme main.ts côté back.
        'apps/web/src/main.tsx',
      ],
      // Seuil D03 §4, bloquant : la commande échoue en dessous.
      thresholds: {
        lines: 40,
        branches: 40,
      },
    },
  },
});

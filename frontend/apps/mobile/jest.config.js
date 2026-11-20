/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
  // Liste explicite : un fichier source sans test compte à 0 %, comme dans backend/jest.config.js.
  // Hors liste : le point d'entrée index.ts (branchement pur, comme main.ts côté back) et les
  // fichiers de configuration (babel, metro, tailwind, jest). packages/shared est compté par Vitest.
  collectCoverageFrom: [
    'App.tsx',
    'src/**/*.{ts,tsx}',
    // Tests : code de vérification, pas de l'application.
    '!**/*.test.{ts,tsx}',
    // Types : déclarations sans code exécuté.
    '!**/*.d.ts',
    '!**/types/**',
    // Barrels : réexports uniquement (même règle que vitest.config.ts).
    '!src/**/index.ts',
    // Doublures de test : mocks manuels et futurs handlers MSW.
    '!**/__mocks__/**',
    '!**/mocks/**',
    // Démonstration des tokens réservée au développement, équivalent natif des stories web :
    // App.tsx ne la charge que si __DEV__ et EXPO_PUBLIC_TOKENS_PREVIEW=true, et Metro la retire
    // du bundle de production.
    '!src/screens/TokensPreviewScreen.tsx',
  ],
  coverageReporters: ['text', 'html'],
  // À côté du rapport Vitest (coverage/web-shared) : un seul dossier frontend/coverage/ à publier.
  coverageDirectory: '../../coverage/mobile',
  // Seuil D03 §4, bloquant : la commande échoue en dessous.
  coverageThreshold: {
    global: {
      lines: 40,
      branches: 40,
    },
  },
};

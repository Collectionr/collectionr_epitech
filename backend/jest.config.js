/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  // Le câblage pur (bootstrap, modules NestJS, main) est exercé par les tests
  // e2e ; la couverture unitaire cible le code métier et les adaptateurs.
  coveragePathIgnorePatterns: [
    '/node_modules/',
    'src/main.ts',
    'src/app.module.ts',
    'src/shared/bootstrap/',
    'Module.ts$',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

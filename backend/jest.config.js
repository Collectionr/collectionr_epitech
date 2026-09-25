/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // The generated Prisma client imports its internal modules using NodeNext
  // (explicit .js extension on .ts files): without this mapping, Jest can't resolve them.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  // Pure wiring (bootstrap, NestJS modules, main) is exercised by the e2e
  // tests; unit coverage targets business code and adapters.
  // The generated Prisma client (src/generated/) is not application code.
  coveragePathIgnorePatterns: [
    '/node_modules/',
    'src/main.ts',
    'src/app.module.ts',
    'src/shared/bootstrap/',
    'src/generated/',
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

/**
 * Integration tests against a REAL PostgreSQL (and Redis where needed): the unit specs mock Prisma,
 * Redis and bcrypt, so they cannot catch query-level bugs (wildcard where, lost updates, races).
 * Opt-in (`npm run test:integration`), never part of `npm test` / the pre-push hook, which must
 * stay runnable without infrastructure.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.integration-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata'],
  globalSetup: '<rootDir>/../jest.integration.global-setup.js',
  // One database shared by every spec: files must not run in parallel.
  maxWorkers: 1,
  testTimeout: 60000,
};

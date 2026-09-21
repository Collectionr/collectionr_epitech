// Guarantees a valid environment for e2e tests, including in CI without a .env file.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://collectionr:collectionr@localhost:5432/collectionr';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_SECRET ??= 'e2e-test-secret-0123456789abcdefghijklmnop';
process.env.CORS_ORIGINS ??= 'http://localhost:5173';
process.env.LOG_LEVEL ??= 'warn';
process.env.SWAGGER_ENABLED ??= 'true';

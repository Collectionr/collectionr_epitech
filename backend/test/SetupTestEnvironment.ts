// Garantit un environnement valide pour les tests e2e, y compris en CI sans fichier .env.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://collectionr:collectionr@localhost:5432/collectionr';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_SECRET ??= 'secret-de-test-e2e-0123456789abcdefghijklmnop';
process.env.CORS_ORIGINS ??= 'http://localhost:5173';

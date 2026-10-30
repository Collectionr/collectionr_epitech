import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { JwtTokenCodec } from '../modules/auth/infrastructure/services/JwtTokenCodec';

const DEFAULT_URL = 'postgresql://collectionr:collectionr@localhost:5432/collectionr_test';

export const INTEGRATION_JWT_SECRET = 'integration-test-secret-0123456789-abcdefghijkl';

/** PrismaClient on the dedicated integration database (migrated by jest.integration.global-setup.js). */
export function createIntegrationPrisma(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.INTEGRATION_DATABASE_URL ?? DEFAULT_URL,
      max: 10,
    }),
  });
}

/** The real codec, signing with a fixed test secret. */
export function createTestCodec(secret = INTEGRATION_JWT_SECRET): JwtTokenCodec {
  return new JwtTokenCodec({ get: () => secret } as unknown as ConfigService);
}

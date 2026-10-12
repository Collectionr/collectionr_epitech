import type { Type } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import { AppModule } from '../../src/app.module';
import {
  InMemoryAuthStore,
  InMemoryAuthTokenService,
  InMemoryUserRepository,
} from '../../src/contracts/InMemoryAuthAdapters';
import { createTestCodec } from '../../src/contracts/IntegrationDatabase';
import { AUDIT_LOG_REPOSITORY } from '../../src/modules/audit/application/ports/IAuditLogRepository';
import type { AuditEntry } from '../../src/modules/audit/domain/entities/AuditEntry';
import { ACCESS_TOKEN_VERIFIER } from '../../src/modules/auth/application/ports/IAccessTokenVerifier';
import { AUTH_TOKEN_SERVICE } from '../../src/modules/auth/application/ports/IAuthTokenService';
import { SESSION_PURGER } from '../../src/modules/auth/application/ports/ISessionPurger';
import { USER_REPOSITORY } from '../../src/modules/auth/application/ports/IUserRepository';
import { configureApp } from '../../src/shared/bootstrap/ConfigureApp';
import { PRISMA_CLIENT } from '../../src/shared/infrastructure/database/PrismaModule';
import { REDIS_CLIENT } from '../../src/shared/infrastructure/redis/RedisModule';

/**
 * In-memory stand-in for the Redis client, executing what RATE_LIMIT_SCRIPT does (atomic count, TTL
 * armed with the first hit, block once the limit is exceeded) so the e2e specs exercise the real
 * guard against the real semantics. `resetCounters()` clears it between tests that share one app —
 * otherwise earlier /auth/login calls would trip the limit for later, unrelated tests. (Not named
 * `reset`: ioredis' own Redis class already types a RESET command, which confuses the lint rules.)
 */
export function buildFakeRedisClient(): Redis & { resetCounters(): void } {
  const entries = new Map<string, { value: number; expiresAt: number | null }>();

  const live = (key: string): { value: number; expiresAt: number | null } | undefined => {
    const entry = entries.get(key);
    if (entry !== undefined && entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  };
  const ttl = (key: string): number => {
    const entry = live(key);
    if (entry === undefined) {
      return -2;
    }
    return entry.expiresAt === null ? -1 : entry.expiresAt - Date.now();
  };

  return {
    eval: (
      _script: string,
      _numKeys: number,
      counterKey: string,
      blockKey: string,
      limit: number,
      windowMs: number,
      blockMs: number,
    ): Promise<[number, number]> => {
      const blockedFor = ttl(blockKey);
      if (blockedFor > 0) {
        return Promise.resolve([1, blockedFor]);
      }

      const entry = live(counterKey) ?? { value: 0, expiresAt: null };
      entry.value += 1;
      entries.set(counterKey, entry);
      if (entry.value === 1 || entry.expiresAt === null) {
        entry.expiresAt = Date.now() + windowMs;
      }

      if (entry.value > limit) {
        entries.set(blockKey, { value: 1, expiresAt: Date.now() + blockMs });
        entries.delete(counterKey);
        return Promise.resolve([1, blockMs]);
      }
      return Promise.resolve([0, 0]);
    },
    disconnect: (): void => undefined,
    resetCounters: (): void => entries.clear(),
  } as unknown as Redis & { resetCounters(): void };
}

export interface AuthTestContext {
  readonly app: NestFastifyApplication;
  readonly store: InMemoryAuthStore;
  readonly repository: InMemoryUserRepository;
  readonly tokens: InMemoryAuthTokenService;
  readonly redis: Redis & { resetCounters(): void };
  /** Every audit entry written, in order (the audit repository is replaced by this spy). */
  readonly audit: jest.Mock<Promise<void>, [AuditEntry]>;
}

/**
 * The real application (AppModule + configureApp), with only the infrastructure replaced: the user
 * and session stores by in-memory doubles that pass the same contract as the Prisma ones, Redis by a
 * double running the same counting rules. Real: bcrypt, JWT signing, guards, pipes, filters, audit.
 */
export async function createAuthTestApp(
  options: { extraModules?: Type[] } = {},
): Promise<AuthTestContext> {
  const store = new InMemoryAuthStore();
  const repository = new InMemoryUserRepository(store);
  const tokens = new InMemoryAuthTokenService(store, createTestCodec());
  const redis = buildFakeRedisClient();
  const audit = jest.fn<Promise<void>, [AuditEntry]>().mockResolvedValue(undefined);

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule, ...(options.extraModules ?? [])],
  })
    .overrideProvider(PRISMA_CLIENT)
    .useValue({ $disconnect: (): Promise<void> => Promise.resolve() })
    .overrideProvider(REDIS_CLIENT)
    .useValue(redis)
    .overrideProvider(USER_REPOSITORY)
    .useValue(repository)
    .overrideProvider(AUTH_TOKEN_SERVICE)
    .useValue(tokens)
    .overrideProvider(ACCESS_TOKEN_VERIFIER)
    .useValue(tokens)
    .overrideProvider(SESSION_PURGER)
    .useValue(tokens)
    .overrideProvider(AUDIT_LOG_REPOSITORY)
    .useValue({ record: audit })
    .compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return { app, store, repository, tokens, redis, audit };
}

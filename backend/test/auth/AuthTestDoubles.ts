import { Prisma } from '../../src/generated/prisma/client.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { Redis } from 'ioredis';

interface FakeUserRow {
  id: string;
  email: string;
  passwordHash: string;
  username: string;
  role: string;
  consentGivenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeSessionRow {
  id: string;
  userId: string;
  refreshTokenHash: string;
  isRevoked: boolean;
  expiresAt: Date;
}

/**
 * In-memory stand-in for PrismaClient's `user`/`session` models, so the e2e specs exercise the
 * real PrismaUserRepository/JwtAuthTokenService wiring (upsert, unique email conflict, session
 * rotation/revocation) without a real PostgreSQL instance — same "no real infra in tests"
 * principle as test/health, applied to a Prisma-shaped double instead of a fully stubbed port.
 */
export function buildFakePrismaClient(): PrismaClient {
  const users = new Map<string, FakeUserRow>();
  const sessions = new Map<string, FakeSessionRow>();

  const user = {
    upsert: ({
      where,
      create,
      update,
    }: {
      where: { id: string };
      create: FakeUserRow;
      update: Partial<FakeUserRow>;
    }): Promise<FakeUserRow> => {
      const existing = users.get(where.id);
      if (existing) {
        const merged = { ...existing, ...update };
        users.set(where.id, merged);
        return Promise.resolve(merged);
      }

      for (const row of users.values()) {
        if (row.email === create.email) {
          throw new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed on the fields: (`email`)',
            { code: 'P2002', clientVersion: '7.10.0' },
          );
        }
      }

      users.set(create.id, create);
      return Promise.resolve(create);
    },
    findUnique: ({
      where,
    }: {
      where: { id?: string; email?: string };
    }): Promise<FakeUserRow | null> => {
      if (where.id !== undefined) {
        return Promise.resolve(users.get(where.id) ?? null);
      }
      const byEmail = [...users.values()].find((row) => row.email === where.email);
      return Promise.resolve(byEmail ?? null);
    },
  };

  const session = {
    create: ({ data }: { data: FakeSessionRow }): Promise<FakeSessionRow> => {
      sessions.set(data.id, data);
      return Promise.resolve(data);
    },
    findUnique: ({ where }: { where: { id: string } }): Promise<FakeSessionRow | null> =>
      Promise.resolve(sessions.get(where.id) ?? null),
    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<FakeSessionRow>;
    }): Promise<FakeSessionRow> => {
      const existing = sessions.get(where.id);
      if (existing === undefined) {
        throw new Error(`Fake session ${where.id} not found`);
      }
      const merged = { ...existing, ...data };
      sessions.set(where.id, merged);
      return Promise.resolve(merged);
    },
    updateMany: ({
      where,
      data,
    }: {
      where: { id: string; isRevoked: boolean };
      data: Partial<FakeSessionRow>;
    }): Promise<{ count: number }> => {
      const existing = sessions.get(where.id);
      if (existing === undefined || existing.isRevoked !== where.isRevoked) {
        return Promise.resolve({ count: 0 });
      }
      sessions.set(where.id, { ...existing, ...data });
      return Promise.resolve({ count: 1 });
    },
  };

  return {
    user,
    session,
    $disconnect: (): Promise<void> => Promise.resolve(),
  } as unknown as PrismaClient;
}

/**
 * In-memory stand-in for the Redis client, backing RedisRateLimitGuard's INCR/EXPIRE counters.
 * Exposes `resetCounters()` (not `reset` — ioredis' own Redis class already types a `reset()`
 * command method, RESET, and colliding with it confuses `no-floating-promises`) so specs sharing
 * one app instance (and so one counters map) across many test cases can clear it between tests —
 * otherwise earlier /auth/login calls would trip the limit for later, unrelated tests.
 */
export function buildFakeRedisClient(): Redis & { resetCounters(): void } {
  const counters = new Map<string, number>();

  return {
    incr: (key: string): Promise<number> => {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return Promise.resolve(next);
    },
    expire: (): Promise<number> => Promise.resolve(1),
    disconnect: (): void => undefined,
    resetCounters: (): void => counters.clear(),
  } as unknown as Redis & { resetCounters(): void };
}

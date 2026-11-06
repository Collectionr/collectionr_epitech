/**
 * The rate limit script and guard against a REAL Redis. The unit spec fakes `eval`, so it cannot tell
 * whether the Lua actually keeps its promises (atomic TTL, a block that expires, a limit that holds
 * under concurrency).
 */
import { randomUUID } from 'node:crypto';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import { Redis } from 'ioredis';
import { RATE_LIMIT_METADATA_KEY } from '../modules/auth/interface/decorators/RateLimit';
import type { RateLimitOptions } from '../modules/auth/interface/decorators/RateLimit';
import { RedisRateLimitGuard } from '../modules/auth/interface/guards/RedisRateLimitGuard';

// Logical database 15: nothing else uses it, and it is flushed by prefix only.
const REDIS_URL = process.env.INTEGRATION_REDIS_URL ?? 'redis://localhost:6379/15';

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
afterAll(async () => {
  await redis.quit();
});

function contextFor(ip: string, body?: unknown): ExecutionContext {
  const response = { header: (): void => undefined };
  return {
    getHandler: () => (): void => undefined,
    switchToHttp: () => ({ getRequest: () => ({ ip, body }), getResponse: () => response }),
  } as unknown as ExecutionContext;
}

function guardFor(options: RateLimitOptions, client: Redis = redis): RedisRateLimitGuard {
  const reflector = {
    get: (key: string) => (key === RATE_LIMIT_METADATA_KEY ? options : undefined),
  } as unknown as Reflector;
  const configService = { get: (): undefined => undefined } as unknown as ConfigService;
  return new RedisRateLimitGuard(reflector, configService, client);
}

/** A name unique to the test, so counters from other tests and earlier runs never interfere. */
const uniqueName = (): string => `it-${randomUUID().slice(0, 8)}`;

async function attempts(
  guard: RedisRateLimitGuard,
  count: number,
  ip = '203.0.113.9',
): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < count; i += 1) {
    try {
      await guard.canActivate(contextFor(ip, { email: 'ash@example.com' }));
      statuses.push(200);
    } catch (error) {
      statuses.push((error as { status?: number }).status ?? 500);
    }
  }
  return statuses;
}

describe('RedisRateLimitGuard against a real Redis', () => {
  it('allows exactly the configured number of attempts, then refuses with 429', async () => {
    const name = uniqueName();
    const guard = guardFor({
      name,
      onRedisFailure: 'deny',
      rules: [{ scope: 'ip', limit: 3, windowSeconds: 30 }],
    });

    await expect(attempts(guard, 6)).resolves.toEqual([200, 200, 200, 429, 429, 429]);
  });

  it('never leaves a counter without an expiry (the permanent ban of INCR followed by EXPIRE)', async () => {
    const name = uniqueName();
    const guard = guardFor({
      name,
      onRedisFailure: 'deny',
      rules: [{ scope: 'ip', limit: 5, windowSeconds: 30 }],
    });

    await attempts(guard, 1);

    const key = `auth-rl:${name}:ip:203.0.113.9`;
    expect(await redis.pttl(key)).toBeGreaterThan(0);
  });

  it('repairs a counter that somehow lost its expiry instead of trusting it forever', async () => {
    const name = uniqueName();
    const guard = guardFor({
      name,
      onRedisFailure: 'deny',
      rules: [{ scope: 'ip', limit: 5, windowSeconds: 30 }],
    });
    const key = `auth-rl:${name}:ip:203.0.113.9`;
    await redis.set(key, '2'); // no TTL: what a crash between INCR and EXPIRE used to leave

    await attempts(guard, 1);

    expect(await redis.pttl(key)).toBeGreaterThan(0);
  });

  it('keeps refusing during the block even after the window would have expired, then lets the client back in', async () => {
    const name = uniqueName();
    const guard = guardFor({
      name,
      onRedisFailure: 'deny',
      rules: [{ scope: 'ip', limit: 2, windowSeconds: 1, blockSeconds: 2 }],
    });

    await expect(attempts(guard, 3)).resolves.toEqual([200, 200, 429]);
    await new Promise((resolve) => setTimeout(resolve, 1200)); // window over, block (2 s) still on
    await expect(attempts(guard, 1)).resolves.toEqual([429]);
    await new Promise((resolve) => setTimeout(resolve, 1200)); // block over
    await expect(attempts(guard, 1)).resolves.toEqual([200]);
  });

  it('holds under concurrency: 50 simultaneous attempts, limit 10, exactly 10 pass', async () => {
    const name = uniqueName();
    const guard = guardFor({
      name,
      onRedisFailure: 'deny',
      rules: [{ scope: 'ip', limit: 10, windowSeconds: 30 }],
    });

    const statuses = await Promise.all(
      Array.from({ length: 50 }, () => attempts(guard, 1).then(([status]) => status)),
    );

    expect(statuses.filter((status) => status === 200)).toHaveLength(10);
  });

  it('counts the same account from different addresses together, and different accounts apart', async () => {
    const name = uniqueName();
    const guard = guardFor({
      name,
      onRedisFailure: 'deny',
      rules: [{ scope: 'account', limit: 2, windowSeconds: 30 }],
    });
    const attempt = async (ip: string, email: string): Promise<number> => {
      try {
        await guard.canActivate(contextFor(ip, { email }));
        return 200;
      } catch (error) {
        return (error as { status?: number }).status ?? 500;
      }
    };

    const results = [
      await attempt('198.51.100.1', 'Ash@Example.com'),
      await attempt('198.51.100.2', ' ash@example.COM'),
      await attempt('198.51.100.3', 'ash@example.com'), // third, any address: refused
      await attempt('198.51.100.1', 'misty@example.com'), // another account: untouched
    ];

    expect(results).toEqual([200, 200, 429, 200]);
  });

  it('fails closed with 503 when Redis cannot be reached, on a route configured to deny', async () => {
    const unreachable = new Redis('redis://localhost:1', {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    unreachable.on('error', () => undefined);
    const guard = guardFor(
      {
        name: uniqueName(),
        onRedisFailure: 'deny',
        rules: [{ scope: 'ip', limit: 5, windowSeconds: 30 }],
      },
      unreachable,
    );

    await expect(attempts(guard, 1)).resolves.toEqual([503]);
    unreachable.disconnect();
  });
});

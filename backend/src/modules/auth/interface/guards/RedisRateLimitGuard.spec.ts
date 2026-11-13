import { createHash } from 'node:crypto';
import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import type { Redis } from 'ioredis';
import { RATE_LIMIT_METADATA_KEY } from '../decorators/RateLimit';
import type { RateLimitOptions } from '../decorators/RateLimit';
import { RedisRateLimitGuard } from './RedisRateLimitGuard';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

interface FakeRequest {
  ip: string;
  body?: unknown;
  user?: { id: string };
}

function buildContext(request: FakeRequest): { context: ExecutionContext; header: jest.Mock } {
  const header = jest.fn();
  const context = {
    getHandler: () => (): void => undefined,
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ header }) }),
  } as unknown as ExecutionContext;
  return { context, header };
}

function buildGuard(
  options: RateLimitOptions | undefined,
  evalResult: unknown = [0, 0],
  config: Record<string, number> = {},
): { guard: RedisRateLimitGuard; evalScript: jest.Mock } {
  const reflector = {
    get: (key: string) => (key === RATE_LIMIT_METADATA_KEY ? options : undefined),
  } as unknown as Reflector;
  const configService = { get: (key: string) => config[key] } as unknown as ConfigService;
  const evalScript = jest.fn();
  if (evalResult instanceof Error) {
    evalScript.mockRejectedValue(evalResult);
  } else {
    evalScript.mockResolvedValue(evalResult);
  }
  return {
    guard: new RedisRateLimitGuard(reflector, configService, {
      eval: evalScript,
    } as unknown as Redis),
    evalScript,
  };
}

const login: RateLimitOptions = {
  name: 'login',
  onRedisFailure: 'deny',
  rules: [
    {
      scope: 'ip-account',
      limit: { env: 'AUTH_LOGIN_RATE_LIMIT' },
      windowSeconds: { env: 'AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS' },
      blockSeconds: { env: 'AUTH_LOGIN_BLOCK_SECONDS' },
    },
    { scope: 'account', limit: 20, windowSeconds: 900 },
    { scope: 'ip', limit: 30, windowSeconds: 60, blockSeconds: 300 },
  ],
};

const config = {
  AUTH_LOGIN_RATE_LIMIT: 5,
  AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60,
  AUTH_LOGIN_BLOCK_SECONDS: 900,
};

/** [script, numKeys, counterKey, blockKey, limit, windowMs, blockMs] of the nth eval call. */
function callArgs(evalScript: jest.Mock, call = 0): unknown[] {
  return evalScript.mock.calls[call] as unknown[];
}

describe('RedisRateLimitGuard', () => {
  it('lets the request through when the handler carries no @RateLimit metadata', async () => {
    const { guard, evalScript } = buildGuard(undefined);

    await expect(guard.canActivate(buildContext({ ip: '203.0.113.1' }).context)).resolves.toBe(
      true,
    );
    expect(evalScript).not.toHaveBeenCalled();
  });

  it('allows a request that no rule refuses', async () => {
    const { guard } = buildGuard(login, [0, 0], config);
    const { context } = buildContext({ ip: '203.0.113.1', body: { email: 'ash@example.com' } });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  describe('rules', () => {
    it('resolves environment-driven values when the request arrives, in milliseconds', async () => {
      const { guard, evalScript } = buildGuard(login, [0, 0], config);
      const { context } = buildContext({ ip: '203.0.113.1', body: { email: 'ash@example.com' } });

      await guard.canActivate(context);

      const [, , , , limit, windowMs, blockMs] = callArgs(evalScript);
      expect([limit, windowMs, blockMs]).toEqual([5, 60_000, 900_000]);
    });

    it('defaults the block duration to the window', async () => {
      const { guard, evalScript } = buildGuard(
        {
          name: 'x',
          onRedisFailure: 'deny',
          rules: [{ scope: 'ip', limit: 3, windowSeconds: 10 }],
        },
        [0, 0],
      );

      await guard.canActivate(buildContext({ ip: '203.0.113.1' }).context);

      const [, , , , , windowMs, blockMs] = callArgs(evalScript);
      expect(blockMs).toBe(windowMs);
    });

    it('enforces every rule of the route: ip+account, account and ip', async () => {
      const { guard, evalScript } = buildGuard(login, [0, 0], config);
      const { context } = buildContext({ ip: '203.0.113.1', body: { email: 'ash@example.com' } });

      await guard.canActivate(context);

      expect(evalScript).toHaveBeenCalledTimes(3);
      const account = sha256('ash@example.com');
      expect(callArgs(evalScript, 0)[2]).toBe(`auth-rl:login:ip-account:203.0.113.1:${account}`);
      expect(callArgs(evalScript, 1)[2]).toBe(`auth-rl:login:account:${account}`);
      expect(callArgs(evalScript, 2)[2]).toBe('auth-rl:login:ip:203.0.113.1');
    });

    it('keys the counter and its block on the same prefix, so both live and die together', async () => {
      const { guard, evalScript } = buildGuard(login, [0, 0], config);

      await guard.canActivate(
        buildContext({ ip: '203.0.113.1', body: { email: 'ash@example.com' } }).context,
      );

      const [, numKeys, counterKey, blockKey] = callArgs(evalScript);
      expect(numKeys).toBe(2);
      expect(blockKey).toBe(`${counterKey as string}:blocked`);
    });

    it('counts every spelling of one mailbox against one account bucket', async () => {
      const first = buildGuard(login, [0, 0], config);
      const second = buildGuard(login, [0, 0], config);

      await first.guard.canActivate(
        buildContext({ ip: '203.0.113.1', body: { email: 'Ash@Example.com' } }).context,
      );
      await second.guard.canActivate(
        buildContext({ ip: '203.0.113.2', body: { email: '  ash@EXAMPLE.COM ' } }).context,
      );

      expect(callArgs(first.evalScript, 1)[2]).toBe(callArgs(second.evalScript, 1)[2]);
    });

    it('never puts an email in Redis, only its digest', async () => {
      const { guard, evalScript } = buildGuard(login, [0, 0], config);

      await guard.canActivate(
        buildContext({ ip: '203.0.113.1', body: { email: 'ash@example.com' } }).context,
      );

      for (const call of evalScript.mock.calls as unknown[][]) {
        expect(JSON.stringify(call)).not.toContain('ash@example.com');
      }
    });

    it('skips the account rules when the body names no account, but still enforces the ip rule', async () => {
      const { guard, evalScript } = buildGuard(login, [0, 0], config);

      await guard.canActivate(buildContext({ ip: '203.0.113.1', body: {} }).context);

      expect(evalScript).toHaveBeenCalledTimes(1);
      expect(callArgs(evalScript)[2]).toBe('auth-rl:login:ip:203.0.113.1');
    });

    it('keys a user-scoped rule on the authenticated user', async () => {
      const { guard, evalScript } = buildGuard(
        {
          name: 'password-change',
          onRedisFailure: 'deny',
          rules: [{ scope: 'user', limit: 5, windowSeconds: 900 }],
        },
        [0, 0],
      );

      await guard.canActivate(buildContext({ ip: '203.0.113.1', user: { id: 'user-1' } }).context);

      expect(callArgs(evalScript)[2]).toBe('auth-rl:password-change:user:user-1');
    });
  });

  describe('when a rule refuses', () => {
    it('answers 429 with Retry-After (in whole seconds, rounded up)', async () => {
      const { guard } = buildGuard(login, [1, 899_500], config);
      const { context, header } = buildContext({
        ip: '203.0.113.1',
        body: { email: 'ash@example.com' },
      });

      await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 429 });
      expect(header).toHaveBeenCalledWith('Retry-After', '900');
    });

    it('stops at the first refusing rule', async () => {
      const { guard, evalScript } = buildGuard(login, [1, 1000], config);

      await expect(
        guard.canActivate(
          buildContext({ ip: '203.0.113.1', body: { email: 'ash@example.com' } }).context,
        ),
      ).rejects.toBeInstanceOf(HttpException);
      expect(evalScript).toHaveBeenCalledTimes(1);
    });
  });

  describe('when Redis fails', () => {
    it('refuses with 503 on a route configured to deny (login must not become unlimited)', async () => {
      const { guard } = buildGuard(login, new Error('ECONNREFUSED'), config);

      await expect(
        guard.canActivate(buildContext({ ip: '203.0.113.1', body: { email: 'a@b.com' } }).context),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('lets the request through on a route configured to allow', async () => {
      const { guard } = buildGuard(
        {
          name: 'refresh',
          onRedisFailure: 'allow',
          rules: [{ scope: 'ip', limit: 30, windowSeconds: 60 }],
        },
        new Error('ECONNREFUSED'),
      );

      await expect(guard.canActivate(buildContext({ ip: '203.0.113.1' }).context)).resolves.toBe(
        true,
      );
    });

    it('treats an unreadable script answer as a failure rather than as "allowed"', async () => {
      const { guard } = buildGuard(login, 'not-an-array', config);

      await expect(
        guard.canActivate(buildContext({ ip: '203.0.113.1', body: { email: 'a@b.com' } }).context),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});

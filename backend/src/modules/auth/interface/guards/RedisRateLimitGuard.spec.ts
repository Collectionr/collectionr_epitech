import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import type { Redis } from 'ioredis';
import { RedisRateLimitGuard } from './RedisRateLimitGuard';
import { RATE_LIMIT_METADATA_KEY } from '../decorators/RateLimit';
import type { RateLimitOptions } from '../decorators/RateLimit';

function buildContext(): ExecutionContext {
  return {
    getHandler: () => (): void => undefined,
    switchToHttp: () => ({ getRequest: () => ({ ip: '203.0.113.1' }) }),
  } as unknown as ExecutionContext;
}

function buildReflector(options: RateLimitOptions | undefined): Reflector {
  return {
    get: (key: string) => (key === RATE_LIMIT_METADATA_KEY ? options : undefined),
  } as unknown as Reflector;
}

const configValues: Record<string, number> = {
  AUTH_LOGIN_RATE_LIMIT: 5,
  AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60,
};

function buildConfigService(): ConfigService {
  return {
    get: (key: string, fallback: number) => configValues[key] ?? fallback,
  } as unknown as ConfigService;
}

describe('RedisRateLimitGuard', () => {
  it('lets the request through when the handler carries no @RateLimit metadata', async () => {
    const incr = jest.fn();
    const expire = jest.fn();
    const guard = new RedisRateLimitGuard(buildReflector(undefined), buildConfigService(), {
      incr,
      expire,
    } as unknown as Redis);

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(incr).not.toHaveBeenCalled();
  });

  it('sets the window TTL on the first hit and allows the request', async () => {
    const incr = jest.fn().mockResolvedValue(1);
    const expire = jest.fn().mockResolvedValue(1);
    const guard = new RedisRateLimitGuard(buildReflector({ name: 'login' }), buildConfigService(), {
      incr,
      expire,
    } as unknown as Redis);

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(expire).toHaveBeenCalledWith('auth-rate-limit:login:203.0.113.1', 60);
  });

  it('does not re-set the TTL on subsequent hits within the window', async () => {
    const incr = jest.fn().mockResolvedValue(2);
    const expire = jest.fn();
    const guard = new RedisRateLimitGuard(buildReflector({ name: 'login' }), buildConfigService(), {
      incr,
      expire,
    } as unknown as Redis);

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(expire).not.toHaveBeenCalled();
  });

  it('rejects once the configured limit is exceeded', async () => {
    const incr = jest.fn().mockResolvedValue(6);
    const expire = jest.fn();
    const guard = new RedisRateLimitGuard(buildReflector({ name: 'login' }), buildConfigService(), {
      incr,
      expire,
    } as unknown as Redis);

    await expect(guard.canActivate(buildContext())).rejects.toThrow(HttpException);
  });

  it('fails open when Redis is unavailable', async () => {
    const incr = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const expire = jest.fn();
    const guard = new RedisRateLimitGuard(buildReflector({ name: 'login' }), buildConfigService(), {
      incr,
      expire,
    } as unknown as Redis);

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
  });
});

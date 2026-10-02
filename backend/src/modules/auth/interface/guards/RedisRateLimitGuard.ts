import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../../../shared/infrastructure/redis/RedisModule';
import { RATE_LIMIT_METADATA_KEY } from '../decorators/RateLimit';
import type { RateLimitOptions } from '../decorators/RateLimit';

const RATE_LIMIT_KEY_PREFIX = 'auth-rate-limit';
const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_SECONDS = 60;

/**
 * Reinforced rate limiting for sensitive auth endpoints (ADR-008, docs/security/S03-api-security.md
 * §7): Redis-backed (shared across replicas, survives restarts) — layered on top of, not instead
 * of, the global in-memory ThrottlerGuard already applied to every route.
 *
 * Fail-open: if Redis is unavailable, the request is allowed through (logged as a warning) rather
 * than taking down login/register — the global ThrottlerGuard still provides a baseline.
 */
@Injectable()
export class RedisRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RedisRateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_METADATA_KEY,
      context.getHandler(),
    );
    if (options === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const key = `${RATE_LIMIT_KEY_PREFIX}:${options.name}:${request.ip}`;
    const { limit, windowSeconds } = this.readLimits(options.name);

    let count: number;
    try {
      count = await this.redisClient.incr(key);
      if (count === 1) {
        await this.redisClient.expire(key, windowSeconds);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Redis unavailable, allowing request through: ${reason}`);
      return true;
    }

    if (count > limit) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }

  // Resolved at request time (not at decoration time) so the limits stay driven by
  // EnvironmentVariables.ts / ConfigService rather than being frozen into decorator metadata.
  private readLimits(name: string): { limit: number; windowSeconds: number } {
    const envPrefix = `AUTH_${name.toUpperCase()}_RATE_LIMIT`;
    return {
      limit: this.configService.get<number>(envPrefix, DEFAULT_LIMIT),
      windowSeconds: this.configService.get<number>(
        `${envPrefix}_WINDOW_SECONDS`,
        DEFAULT_WINDOW_SECONDS,
      ),
    };
  }
}

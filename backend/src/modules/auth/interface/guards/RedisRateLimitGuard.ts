import { createHash } from 'node:crypto';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../../../shared/infrastructure/redis/RedisModule';
import { RATE_LIMIT_METADATA_KEY } from '../decorators/RateLimit';
import type { EnvNumber, RateLimitOptions, RateLimitRule } from '../decorators/RateLimit';
import { readAccountIdentifier } from '../RequestAccount';

const KEY_PREFIX = 'auth-rl';
const MILLISECONDS_PER_SECOND = 1000;

/**
 * One atomic step: refuse while a block is active, otherwise count the attempt, (re)arm the window
 * TTL, and once the limit is exceeded start the block and reset the counter.
 *
 * Atomic on purpose. The previous INCR followed by a separate EXPIRE left a key with no TTL if the
 * process died in between — a permanent ban. Here the TTL is set in the same step as the first
 * increment, and a key found without one (-1) is given one instead of being trusted.
 *
 * KEYS[1] counter, KEYS[2] block · ARGV[1] limit, ARGV[2] window ms, ARGV[3] block ms
 * Returns { blocked (0|1), retryAfterMs }.
 */
const RATE_LIMIT_SCRIPT = `
local blockedFor = redis.call('PTTL', KEYS[2])
if blockedFor > 0 then
  return { 1, blockedFor }
end

local count = redis.call('INCR', KEYS[1])
if count == 1 or redis.call('PTTL', KEYS[1]) < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
end

if count > tonumber(ARGV[1]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  redis.call('DEL', KEYS[1])
  return { 1, tonumber(ARGV[3]) }
end

return { 0, 0 }
`;

interface Verdict {
  readonly blocked: boolean;
  readonly retryAfterMs: number;
}

interface RequestWithIdentity extends FastifyRequest {
  user?: { id?: unknown };
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Reinforced rate limiting for sensitive auth endpoints (ADR-008, docs/security/S03-api-security.md
 * §7): Redis-backed (shared across replicas, survives restarts), layered on top of — not instead
 * of — the global in-memory ThrottlerGuard already applied to every route.
 *
 * Behind a proxy, `request.ip` is only the real client if Fastify was told which proxies to trust
 * (TRUSTED_PROXIES, shared/bootstrap/CreateFastifyAdapter.ts); otherwise everyone shares the
 * proxy's address and one noisy client locks out the others.
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

    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithIdentity>();

    for (const rule of options.rules) {
      const subject = this.subjectOf(rule, request);
      if (subject === null) {
        continue;
      }

      const verdict = await this.evaluate(options, rule, subject);
      if (verdict === 'unavailable') {
        if (options.onRedisFailure === 'deny') {
          throw new ServiceUnavailableException('Rate limiting is unavailable');
        }
        return true;
      }
      if (verdict.blocked) {
        const retryAfterSeconds = Math.ceil(verdict.retryAfterMs / MILLISECONDS_PER_SECOND);
        http.getResponse<FastifyReply>().header('Retry-After', String(retryAfterSeconds));
        throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    return true;
  }

  private async evaluate(
    options: RateLimitOptions,
    rule: RateLimitRule,
    subject: string,
  ): Promise<Verdict | 'unavailable'> {
    const counterKey = `${KEY_PREFIX}:${options.name}:${rule.scope}:${subject}`;
    const limit = this.resolve(rule.limit);
    const windowSeconds = this.resolve(rule.windowSeconds);
    const blockSeconds =
      rule.blockSeconds === undefined ? windowSeconds : this.resolve(rule.blockSeconds);

    try {
      const answer: unknown = await this.redisClient.eval(
        RATE_LIMIT_SCRIPT,
        2,
        counterKey,
        `${counterKey}:blocked`,
        limit,
        windowSeconds * MILLISECONDS_PER_SECOND,
        blockSeconds * MILLISECONDS_PER_SECOND,
      );
      return this.parse(answer);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Rate limiting unavailable (${options.name}): ${reason}`);
      return 'unavailable';
    }
  }

  private parse(answer: unknown): Verdict {
    if (!Array.isArray(answer) || answer.length !== 2) {
      throw new Error('Unexpected rate limit script answer');
    }
    const [blocked, retryAfterMs] = answer as [unknown, unknown];
    return { blocked: Number(blocked) === 1, retryAfterMs: Number(retryAfterMs) };
  }

  /** The value the rule counts attempts of, or null when the request does not carry it. */
  private subjectOf(rule: RateLimitRule, request: RequestWithIdentity): string | null {
    const account = readAccountIdentifier(request.body);
    const accountDigest = account === null ? null : digest(account);

    switch (rule.scope) {
      case 'ip':
        return request.ip;
      case 'account':
        return accountDigest;
      case 'ip-account':
        return accountDigest === null ? null : `${request.ip}:${accountDigest}`;
      case 'user':
        return typeof request.user?.id === 'string' ? request.user.id : request.ip;
    }
  }

  // Resolved at request time, not at decoration time, so the figures stay driven by
  // EnvironmentVariables.ts / ConfigService instead of being frozen into decorator metadata.
  private resolve(value: number | EnvNumber): number {
    if (typeof value === 'number') {
      return value;
    }
    const fromEnvironment = this.configService.get<number>(value.env);
    if (fromEnvironment === undefined) {
      // Every key used by a policy is declared (with a default) in EnvironmentVariables.ts.
      throw new Error(`Rate limit setting ${value.env} is not defined`);
    }
    return fromEnvironment;
  }
}

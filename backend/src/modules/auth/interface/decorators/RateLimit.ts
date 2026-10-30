import { SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';

export const RATE_LIMIT_METADATA_KEY = 'auth:rate-limit';

/** What the counter is keyed by. Several rules on one route are all enforced. */
export type RateLimitScope =
  /** The client address. Stops one machine hammering the route. */
  | 'ip'
  /** One account from one address: the strict "5 attempts a minute" rule of S03 §7. */
  | 'ip-account'
  /** One account from anywhere: stops a distributed attack the per-address rules cannot see. */
  | 'account'
  /** The authenticated user (the route must run behind JwtAuthGuard). */
  | 'user';

/** A value read from the validated environment (EnvironmentVariables.ts) when the request arrives. */
export interface EnvNumber {
  readonly env: string;
}

export interface RateLimitRule {
  readonly scope: RateLimitScope;
  /** Attempts allowed per window; the next one is refused and starts the block. */
  readonly limit: number | EnvNumber;
  readonly windowSeconds: number | EnvNumber;
  /** How long the key stays refused once the limit is exceeded. Defaults to the window. */
  readonly blockSeconds?: number | EnvNumber;
}

export interface RateLimitOptions {
  /** Prefix of the Redis keys. */
  readonly name: string;
  readonly rules: readonly RateLimitRule[];
  /**
   * What to do when Redis cannot be reached. `deny` (503) for routes where letting everything through
   * would defeat the point (credential guessing, account creation); `allow` where availability matters
   * more and the global limiter still applies.
   */
  readonly onRedisFailure: 'deny' | 'allow';
}

/** Marks a handler for RedisRateLimitGuard (ADR-008) — has no effect without that guard applied. */
export function RateLimit(options: RateLimitOptions): CustomDecorator<string> {
  return SetMetadata(RATE_LIMIT_METADATA_KEY, options);
}

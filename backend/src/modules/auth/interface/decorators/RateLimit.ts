import { SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';

export const RATE_LIMIT_METADATA_KEY = 'auth:rate-limit';

export interface RateLimitOptions {
  /**
   * Identifies the route: the Redis counter key, and — uppercased — the env var prefix
   * RedisRateLimitGuard reads the limit from (e.g. "login" -> AUTH_LOGIN_RATE_LIMIT[_WINDOW_SECONDS]
   * in EnvironmentVariables.ts).
   */
  readonly name: string;
}

/** Marks a handler for RedisRateLimitGuard (ADR-008) — has no effect without that guard applied. */
export function RateLimit(options: RateLimitOptions): CustomDecorator<string> {
  return SetMetadata(RATE_LIMIT_METADATA_KEY, options);
}

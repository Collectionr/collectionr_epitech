import type { RateLimitOptions } from './decorators/RateLimit';

// What varies per environment (the S03 §7 figures, "indicative, may evolve") is read from the
// validated environment; what is fixed policy lives here, named, so no number is buried in a decorator.

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_QUARTER_HOUR = 15 * SECONDS_PER_MINUTE;

/** One account, from anywhere: ~4 attempts a minute sustained, over the 15-minute lock window. */
const LOGIN_ACCOUNT_LIMIT = 20;
/** One address, any accounts: credential stuffing across many emails. */
const LOGIN_IP_LIMIT = 30;
const LOGIN_IP_BLOCK_SECONDS = 5 * SECONDS_PER_MINUTE;

const TOKEN_ROUTE_LIMIT = 30;

const PASSWORD_CHANGE_LIMIT = 5;

export const LOGIN_RATE_LIMIT: RateLimitOptions = {
  name: 'login',
  onRedisFailure: 'deny',
  rules: [
    {
      scope: 'ip-account',
      limit: { env: 'AUTH_LOGIN_RATE_LIMIT' },
      windowSeconds: { env: 'AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS' },
      blockSeconds: { env: 'AUTH_LOGIN_BLOCK_SECONDS' },
    },
    {
      scope: 'account',
      limit: LOGIN_ACCOUNT_LIMIT,
      windowSeconds: SECONDS_PER_QUARTER_HOUR,
      blockSeconds: { env: 'AUTH_LOGIN_BLOCK_SECONDS' },
    },
    {
      scope: 'ip',
      limit: LOGIN_IP_LIMIT,
      windowSeconds: SECONDS_PER_MINUTE,
      blockSeconds: LOGIN_IP_BLOCK_SECONDS,
    },
  ],
};

export const REGISTER_RATE_LIMIT: RateLimitOptions = {
  name: 'register',
  onRedisFailure: 'deny',
  rules: [
    {
      scope: 'ip',
      limit: { env: 'AUTH_REGISTER_RATE_LIMIT' },
      windowSeconds: { env: 'AUTH_REGISTER_RATE_LIMIT_WINDOW_SECONDS' },
    },
  ],
};

/** Refresh and logout are cheap and carry a signed token: availability wins over strictness. */
export const REFRESH_RATE_LIMIT: RateLimitOptions = {
  name: 'refresh',
  onRedisFailure: 'allow',
  rules: [{ scope: 'ip', limit: TOKEN_ROUTE_LIMIT, windowSeconds: SECONDS_PER_MINUTE }],
};

export const LOGOUT_RATE_LIMIT: RateLimitOptions = {
  name: 'logout',
  onRedisFailure: 'allow',
  rules: [{ scope: 'ip', limit: TOKEN_ROUTE_LIMIT, windowSeconds: SECONDS_PER_MINUTE }],
};

/** A bcrypt verify AND a bcrypt hash per call, behind a valid token: it must not be a free CPU lever. */
export const PASSWORD_CHANGE_RATE_LIMIT: RateLimitOptions = {
  name: 'password-change',
  onRedisFailure: 'deny',
  rules: [
    {
      scope: 'user',
      limit: PASSWORD_CHANGE_LIMIT,
      windowSeconds: SECONDS_PER_QUARTER_HOUR,
    },
  ],
};

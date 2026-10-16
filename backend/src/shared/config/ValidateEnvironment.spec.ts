import { validateEnvironment } from './ValidateEnvironment';
import { LogLevel, NodeEnvironment } from './EnvironmentVariables';

const validConfig = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/collectionr',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a-test-secret-key-that-is-long-enough',
};

describe('validateEnvironment', () => {
  it('accepts a valid configuration and applies the defaults', () => {
    const environment = validateEnvironment(validConfig);

    expect(environment.NODE_ENV).toBe(NodeEnvironment.Development);
    expect(environment.PORT).toBe(3000);
    expect(environment.LOG_LEVEL).toBe(LogLevel.Info);
    expect(environment.THROTTLE_TTL).toBe(60);
    expect(environment.THROTTLE_LIMIT).toBe(100);
    expect(environment.SWAGGER_ENABLED).toBe(false);
    expect(environment.CORS_ORIGINS).toBe('http://localhost:5173');
    expect(environment.AUDIT_LOG_RETENTION_DAYS).toBe(90);
    expect(environment.PASSWORD_MIN_LENGTH).toBe(8);
    expect(environment.TERMS_VERSION).toBe('1');
  });

  it('rejects an AUDIT_LOG_RETENTION_DAYS lower than 1', () => {
    expect(() => validateEnvironment({ ...validConfig, AUDIT_LOG_RETENTION_DAYS: '0' })).toThrow(
      /AUDIT_LOG_RETENTION_DAYS/,
    );
  });

  it.each(['', ' ', 'v 2', 'a'.repeat(33), 'terms/2026'])(
    'rejects the invalid TERMS_VERSION "%s"',
    (value) => {
      expect(() => validateEnvironment({ ...validConfig, TERMS_VERSION: value })).toThrow(
        /TERMS_VERSION/,
      );
    },
  );

  it('accepts a dated terms version', () => {
    expect(validateEnvironment({ ...validConfig, TERMS_VERSION: '2026-01' }).TERMS_VERSION).toBe(
      '2026-01',
    );
  });

  it.each(['7', '65'])('rejects a PASSWORD_MIN_LENGTH of %s outside the 8-64 range', (value) => {
    expect(() => validateEnvironment({ ...validConfig, PASSWORD_MIN_LENGTH: value })).toThrow(
      /PASSWORD_MIN_LENGTH/,
    );
  });

  it('converts numeric and boolean values provided as strings', () => {
    const environment = validateEnvironment({
      ...validConfig,
      PORT: '8080',
      THROTTLE_TTL: '30',
      THROTTLE_LIMIT: '50',
      SWAGGER_ENABLED: 'true',
    });

    expect(environment.PORT).toBe(8080);
    expect(environment.THROTTLE_TTL).toBe(30);
    expect(environment.THROTTLE_LIMIT).toBe(50);
    expect(environment.SWAGGER_ENABLED).toBe(true);
  });

  it('rejects a configuration without DATABASE_URL', () => {
    const config: Record<string, unknown> = { ...validConfig };
    delete config.DATABASE_URL;

    expect(() => validateEnvironment(config)).toThrow(/DATABASE_URL/);
  });

  it('rejects a configuration without REDIS_URL', () => {
    const config: Record<string, unknown> = { ...validConfig };
    delete config.REDIS_URL;

    expect(() => validateEnvironment(config)).toThrow(/REDIS_URL/);
  });

  it('rejects a JWT_SECRET that is too short', () => {
    expect(() => validateEnvironment({ ...validConfig, JWT_SECRET: 'too-short' })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('rejects an invalid PORT', () => {
    expect(() => validateEnvironment({ ...validConfig, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejects a malformed DATABASE_URL', () => {
    expect(() => validateEnvironment({ ...validConfig, DATABASE_URL: 'mysql://nope' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('lists every invalid variable in the error message', () => {
    expect(() => validateEnvironment({})).toThrow(
      /DATABASE_URL[\s\S]*REDIS_URL[\s\S]*JWT_SECRET|JWT_SECRET[\s\S]*DATABASE_URL/,
    );
  });

  describe('JWT_SECRET strength', () => {
    it('rejects the placeholder shipped in .env.example', () => {
      expect(() =>
        validateEnvironment({
          ...validConfig,
          JWT_SECRET: 'replace-me-with-a-secret-of-at-least-32-characters',
        }),
      ).toThrow(/JWT_SECRET.*placeholder/i);
    });

    it.each(['change-me-change-me-change-me-change-me', 'YOUR-SECRET-HERE-YOUR-SECRET-HERE-1'])(
      'rejects the placeholder-looking secret "%s"',
      (secret) => {
        expect(() => validateEnvironment({ ...validConfig, JWT_SECRET: secret })).toThrow(
          /JWT_SECRET/,
        );
      },
    );

    it('rejects 32 identical characters', () => {
      expect(() => validateEnvironment({ ...validConfig, JWT_SECRET: 'a'.repeat(32) })).toThrow(
        /JWT_SECRET.*distinct/i,
      );
    });

    it('rejects a short block repeated over and over', () => {
      expect(() =>
        validateEnvironment({ ...validConfig, JWT_SECRET: 'Ab3$xYz9Qw7!'.repeat(3) }),
      ).toThrow(/JWT_SECRET.*repeat/i);
    });

    it('accepts a generated secret (openssl rand -hex 32)', () => {
      const secret = '9f2c6b1d8e47a03b5c9d1e7f4a6823b0d5e9c1f7a4b8362e0d1c5f9a7b3e8d24';

      expect(validateEnvironment({ ...validConfig, JWT_SECRET: secret }).JWT_SECRET).toBe(secret);
    });
  });

  describe('token and session lifetimes', () => {
    it('defaults to 15 minutes, 7 days, and a 30-day hard end for a login chain', () => {
      const environment = validateEnvironment(validConfig);

      expect(environment.JWT_ACCESS_TOKEN_TTL_SECONDS).toBe(900);
      expect(environment.JWT_REFRESH_TOKEN_TTL_SECONDS).toBe(604800);
      expect(environment.JWT_SESSION_MAX_LIFETIME_SECONDS).toBe(2592000);
    });

    it.each([
      ['JWT_ACCESS_TOKEN_TTL_SECONDS', '3601'],
      ['JWT_REFRESH_TOKEN_TTL_SECONDS', '2592001'],
      ['JWT_SESSION_MAX_LIFETIME_SECONDS', '7776001'],
    ])('caps %s (a typo of 10^6 must not mint year-long tokens): %s is refused', (name, value) => {
      expect(() => validateEnvironment({ ...validConfig, [name]: value })).toThrow(
        new RegExp(name),
      );
    });

    it('requires the access token to expire before the refresh token', () => {
      expect(() =>
        validateEnvironment({
          ...validConfig,
          JWT_ACCESS_TOKEN_TTL_SECONDS: '3600',
          JWT_REFRESH_TOKEN_TTL_SECONDS: '3600',
        }),
      ).toThrow(/JWT_ACCESS_TOKEN_TTL_SECONDS.*JWT_REFRESH_TOKEN_TTL_SECONDS/);
    });

    it('requires the hard end of a login chain to be at least one refresh token lifetime', () => {
      expect(() =>
        validateEnvironment({
          ...validConfig,
          JWT_REFRESH_TOKEN_TTL_SECONDS: '604800',
          JWT_SESSION_MAX_LIFETIME_SECONDS: '3600',
        }),
      ).toThrow(/JWT_SESSION_MAX_LIFETIME_SECONDS.*JWT_REFRESH_TOKEN_TTL_SECONDS/);
    });
  });

  describe('auth rate limiting', () => {
    it('defaults to the S03 §7 figures: 5 a minute, 15 minute lock, 10 registrations an hour', () => {
      const environment = validateEnvironment(validConfig);

      expect(environment.AUTH_LOGIN_RATE_LIMIT).toBe(5);
      expect(environment.AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS).toBe(60);
      expect(environment.AUTH_LOGIN_BLOCK_SECONDS).toBe(900);
      expect(environment.AUTH_REGISTER_RATE_LIMIT).toBe(10);
      expect(environment.AUTH_REGISTER_RATE_LIMIT_WINDOW_SECONDS).toBe(3600);
    });

    it.each([
      ['AUTH_LOGIN_RATE_LIMIT', '1001'],
      ['AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS', '86401'],
      ['AUTH_LOGIN_BLOCK_SECONDS', '86401'],
      ['AUTH_REGISTER_RATE_LIMIT', '1001'],
      ['AUTH_REGISTER_RATE_LIMIT_WINDOW_SECONDS', '86401'],
    ])('bounds %s from above: %s is refused', (name, value) => {
      expect(() => validateEnvironment({ ...validConfig, [name]: value })).toThrow(
        new RegExp(name),
      );
    });
  });

  describe('TRUSTED_PROXIES', () => {
    it('trusts nobody by default', () => {
      expect(validateEnvironment(validConfig).TRUSTED_PROXIES).toBe('');
    });

    it('accepts a list of addresses and CIDR ranges', () => {
      const proxies = '10.0.0.0/8, 192.168.1.10,::1,fd00::/8';

      expect(
        validateEnvironment({ ...validConfig, TRUSTED_PROXIES: proxies }).TRUSTED_PROXIES,
      ).toBe(proxies);
    });

    it.each(['*', 'true', 'not-an-ip', '10.0.0.0/33', '10.0.0.1, nope'])(
      'refuses %p: blind trust of X-Forwarded-For would let any client pick its own address',
      (value) => {
        expect(() => validateEnvironment({ ...validConfig, TRUSTED_PROXIES: value })).toThrow(
          /TRUSTED_PROXIES/,
        );
      },
    );
  });
});

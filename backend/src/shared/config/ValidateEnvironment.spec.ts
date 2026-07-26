import { validateEnvironment } from './ValidateEnvironment';
import { LogLevel, NodeEnvironment } from './EnvironmentVariables';

const validConfig = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/collectionr',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'une-clef-secrete-de-test-suffisamment-longue',
};

describe('validateEnvironment', () => {
  it('accepts a valid configuration and applies the defaults', () => {
    const environment = validateEnvironment(validConfig);

    expect(environment.NODE_ENV).toBe(NodeEnvironment.Development);
    expect(environment.PORT).toBe(3000);
    expect(environment.LOG_LEVEL).toBe(LogLevel.Info);
    expect(environment.THROTTLE_TTL).toBe(60);
    expect(environment.THROTTLE_LIMIT).toBe(100);
    expect(environment.SWAGGER_ENABLED).toBe(true);
    expect(environment.CORS_ORIGINS).toBe('http://localhost:5173');
  });

  it('converts numeric and boolean values provided as strings', () => {
    const environment = validateEnvironment({
      ...validConfig,
      PORT: '8080',
      THROTTLE_TTL: '30',
      THROTTLE_LIMIT: '50',
      SWAGGER_ENABLED: 'false',
    });

    expect(environment.PORT).toBe(8080);
    expect(environment.THROTTLE_TTL).toBe(30);
    expect(environment.THROTTLE_LIMIT).toBe(50);
    expect(environment.SWAGGER_ENABLED).toBe(false);
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
    expect(() => validateEnvironment({ ...validConfig, JWT_SECRET: 'trop-court' })).toThrow(
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
});

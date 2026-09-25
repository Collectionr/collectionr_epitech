import type { ConfigService } from '@nestjs/config';
import { createLoggerOptions } from './CreateLoggerOptions';

function buildConfigService(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string, defaultValue?: unknown) => values[key] ?? defaultValue,
  } as ConfigService;
}

describe('createLoggerOptions', () => {
  it('uses the configured log level', () => {
    const options = createLoggerOptions(
      buildConfigService({ NODE_ENV: 'production', LOG_LEVEL: 'warn' }),
    );

    expect(options.pinoHttp).toMatchObject({ level: 'warn' });
  });

  it('emits raw JSON (no pretty transport) outside development', () => {
    const options = createLoggerOptions(buildConfigService({ NODE_ENV: 'production' }));

    expect(options.pinoHttp).toMatchObject({ transport: undefined });
  });

  it('enables pino-pretty in development', () => {
    const options = createLoggerOptions(buildConfigService({ NODE_ENV: 'development' }));

    expect(options.pinoHttp).toMatchObject({
      transport: expect.objectContaining({ target: 'pino-pretty' }) as unknown,
    });
  });

  it('redacts sensitive headers', () => {
    const options = createLoggerOptions(buildConfigService({ NODE_ENV: 'production' }));

    expect(options.pinoHttp).toMatchObject({
      redact: expect.objectContaining({
        paths: expect.arrayContaining([
          'req.headers.authorization',
          'req.headers.cookie',
        ]) as unknown,
      }) as unknown,
    });
  });
});

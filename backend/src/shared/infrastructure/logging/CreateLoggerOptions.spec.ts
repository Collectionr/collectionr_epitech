import type { ConfigService } from '@nestjs/config';
import pino, { type LoggerOptions } from 'pino';
import { LOG_SERVICE_NAME } from '../../config/AppConstants';
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

  it('writes text levels, an ISO time and the service name outside development', () => {
    const options = createLoggerOptions(buildConfigService({ NODE_ENV: 'production' }));
    const lines: string[] = [];

    const logger = pino(options.pinoHttp as LoggerOptions, {
      write: (line: string) => lines.push(line),
    });
    logger.warn('something odd');

    const entry = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(entry).toMatchObject({ level: 'warn', service: LOG_SERVICE_NAME, msg: 'something odd' });
    expect(entry['time']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('keeps pino numeric levels in development (pino-pretty input)', () => {
    const options = createLoggerOptions(buildConfigService({ NODE_ENV: 'development' }));

    expect(options.pinoHttp).not.toHaveProperty('formatters');
    expect(options.pinoHttp).not.toHaveProperty('base');
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

  it('redacts the client address and port (personal data, S04 §11)', () => {
    const options = createLoggerOptions(buildConfigService({ NODE_ENV: 'production' }));

    expect(options.pinoHttp).toMatchObject({
      redact: expect.objectContaining({
        paths: expect.arrayContaining(['req.remoteAddress', 'req.remotePort']) as unknown,
      }) as unknown,
    });
  });
});

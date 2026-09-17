import type { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
import { NodeEnvironment } from '../../config/EnvironmentVariables';

/**
 * Structured logger options (pino via nestjs-pino).
 * - One JSON line per event outside development (consumable by Grafana/Loki)
 * - pino-pretty in development for readability
 * - Redacts sensitive headers so a token or cookie is never logged
 */
export function createLoggerOptions(configService: ConfigService): Params {
  const nodeEnvironment = configService.get<NodeEnvironment>(
    'NODE_ENV',
    NodeEnvironment.Development,
  );
  const isDevelopment = nodeEnvironment === NodeEnvironment.Development;

  return {
    pinoHttp: {
      level: configService.get<string>('LOG_LEVEL', 'info'),
      redact: {
        // req.body.* : safety net for future authentication endpoints.
        // The default pino-http serializer doesn't log the body, so these paths
        // are no-ops until some code explicitly logs a request with its payload.
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',
          'req.body.token',
          'req.body.accessToken',
          'req.body.refreshToken',
        ],
        censor: '[REDACTED]',
      },
      transport: isDevelopment
        ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:standard' } }
        : undefined,
    },
  };
}

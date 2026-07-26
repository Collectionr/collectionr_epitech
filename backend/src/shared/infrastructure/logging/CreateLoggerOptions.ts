import type { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
import { NodeEnvironment } from '../../config/EnvironmentVariables';

/**
 * Options du logger structuré (pino via nestjs-pino).
 * - JSON une ligne par événement en production/test (exploitable par Grafana/Loki)
 * - pino-pretty en développement pour la lisibilité
 * - redaction des en-têtes sensibles pour ne jamais loguer un token ou un cookie
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
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        censor: '[REDACTED]',
      },
      transport: isDevelopment
        ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:standard' } }
        : undefined,
    },
  };
}

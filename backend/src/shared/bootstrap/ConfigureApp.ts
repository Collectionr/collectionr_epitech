import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import { Logger } from 'nestjs-pino';
import { createValidationPipe } from '../interface/pipes/CreateValidationPipe';
import { setupSwagger } from './SetupSwagger';

/**
 * Applies the application's cross-cutting configuration (prefix, versioning,
 * global pipes, HTTP security, CORS). Shared between main.ts and the e2e tests
 * so tests exercise exactly the production configuration.
 */
export async function configureApp(app: NestFastifyApplication): Promise<void> {
  const configService = app.get(ConfigService);
  const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED', false);

  // HTTP security headers (Helmet). The CSP is relaxed only when
  // Swagger UI is exposed, since its interface relies on inline scripts.
  await app.register(helmet, {
    contentSecurityPolicy: swaggerEnabled
      ? {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
            scriptSrc: ["'self'", "https: 'unsafe-inline'"],
          },
        }
      : undefined,
  });

  app.useLogger(app.get(Logger));

  // /health stays outside the prefix: it's the target of K3s probes (Cloud & Cyber).
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(createValidationPipe());

  // Explicit origins only (no wildcard), driven by CORS_ORIGINS.
  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600,
  });

  if (swaggerEnabled) {
    setupSwagger(app);
  }
}

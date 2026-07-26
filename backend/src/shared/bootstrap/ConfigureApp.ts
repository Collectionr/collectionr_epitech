import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import { Logger } from 'nestjs-pino';
import { createValidationPipe } from '../interface/pipes/CreateValidationPipe';
import { setupSwagger } from './SetupSwagger';

/**
 * Applique la configuration transverse de l'application (préfixe, versioning,
 * pipes globaux, sécurité HTTP, CORS). Partagée entre main.ts et les tests e2e
 * pour que les tests exercent exactement la configuration de production.
 */
export async function configureApp(app: NestFastifyApplication): Promise<void> {
  const configService = app.get(ConfigService);
  const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED', true);

  // En-têtes de sécurité HTTP (Helmet). La CSP est assouplie uniquement quand
  // Swagger UI est exposé, car son interface repose sur des scripts inline.
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

  // /health reste hors préfixe : il sert de cible aux probes K3s (Cloud & Cyber).
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(createValidationPipe());

  // Origines explicites uniquement (pas de wildcard), pilotées par CORS_ORIGINS.
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

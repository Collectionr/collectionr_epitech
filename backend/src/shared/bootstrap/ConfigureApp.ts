import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { createValidationPipe } from '../interface/pipes/CreateValidationPipe';

/**
 * Applique la configuration transverse de l'application (préfixe, versioning,
 * pipes globaux, CORS). Partagée entre main.ts et les tests e2e pour que les
 * tests exercent exactement la configuration de production.
 */
export function configureApp(app: NestFastifyApplication): void {
  const configService = app.get(ConfigService);

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
}

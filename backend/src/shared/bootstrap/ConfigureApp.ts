import { VersioningType } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createValidationPipe } from '../interface/pipes/CreateValidationPipe';

/**
 * Applique la configuration transverse de l'application (préfixe, versioning,
 * pipes globaux). Partagée entre main.ts et les tests e2e pour que les tests
 * exercent exactement la configuration de production.
 */
export function configureApp(app: NestFastifyApplication): void {
  // /health reste hors préfixe : il sert de cible aux probes K3s (Cloud & Cyber).
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(createValidationPipe());
}

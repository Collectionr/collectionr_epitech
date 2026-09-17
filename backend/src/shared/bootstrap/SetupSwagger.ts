import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_BEARER_AUTH_NAME = 'access-token';

/**
 * OpenAPI documentation for the Collectionr API, exposed on /api/docs
 * (JSON spec on /api/docs-json). Tags reflect the product's functional
 * domains; each controller attaches to one via @ApiTags.
 */
export function setupSwagger(app: NestFastifyApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Collectionr API')
    .setDescription(
      'API principale de Collectionr — boîte à outils du collectionneur de cartes TCG : ' +
        'authentification, collections personnelles, catalogue de cartes et scan IA.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: "Jeton d'accès JWT obtenu via les endpoints d'authentification",
      },
      SWAGGER_BEARER_AUTH_NAME,
    )
    .addTag('Auth', 'Authentification et gestion de session')
    .addTag('Collections', 'Gestion des collections personnelles')
    .addTag('Cartes', 'Catalogue et recherche de cartes TCG')
    .addTag('Scan', 'Scan IA de cartes (unitaire et par lot)')
    .addTag('Health', 'Supervision et état des dépendances')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}

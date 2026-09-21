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
      'Main Collectionr API — the TCG card collector toolbox: ' +
        'authentication, personal collections, card catalog and AI scanning.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token obtained from the authentication endpoints',
      },
      SWAGGER_BEARER_AUTH_NAME,
    )
    .addTag('Auth', 'Authentication and session management')
    .addTag('Collections', 'Personal collection management')
    .addTag('Cards', 'TCG card catalog and search')
    .addTag('Scan', 'AI card scanning (single and batch)')
    .addTag('Health', 'Monitoring and dependency status')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}

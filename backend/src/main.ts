import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { configureApp } from './shared/bootstrap/ConfigureApp';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });

  await configureApp(app);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port, '0.0.0.0');

  Logger.log(`Application démarrée sur http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(`Healthcheck disponible sur http://localhost:${port}/health`, 'Bootstrap');
  if (configService.get<boolean>('SWAGGER_ENABLED', true)) {
    Logger.log(`Documentation Swagger sur http://localhost:${port}/api/docs`, 'Bootstrap');
  }
}

void bootstrap();

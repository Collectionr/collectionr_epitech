import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { configureApp } from './shared/bootstrap/ConfigureApp';
import { createFastifyAdapter } from './shared/bootstrap/CreateFastifyAdapter';

async function bootstrap(): Promise<void> {
  // Read from the environment directly: Fastify wants it at construction, before ConfigModule exists.
  // Validated twice (here, and by validateEnvironment at boot).
  const adapter = createFastifyAdapter(process.env.TRUSTED_PROXIES ?? '');
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  });

  await configureApp(app);
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port, '0.0.0.0');

  Logger.log(`Application started at http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(`Healthcheck available at http://localhost:${port}/health`, 'Bootstrap');
  if (configService.get<boolean>('SWAGGER_ENABLED', false)) {
    Logger.log(`Swagger documentation at http://localhost:${port}/api/docs`, 'Bootstrap');
  }
}

void bootstrap();

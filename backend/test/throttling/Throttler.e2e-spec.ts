// Limite basse injectée avant le chargement de l'AppModule pour rendre le test déterministe.
process.env.THROTTLE_LIMIT = '3';
process.env.THROTTLE_TTL = '60';

import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/shared/bootstrap/ConfigureApp';
import type { StandardErrorResponse } from '../../src/shared/interface/filters/AllExceptionsFilter';

describe('Global rate limiting (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 in the standard error format once the limit is exceeded', async () => {
    for (let i = 0; i < 3; i += 1) {
      const response = await request(app.getHttpServer()).get('/health');
      expect(response.status).toBe(200);
    }

    const throttled = await request(app.getHttpServer()).get('/health');
    const body = throttled.body as StandardErrorResponse;

    expect(throttled.status).toBe(429);
    expect(body.statusCode).toBe(429);
    expect(body.path).toBe('/health');
    expect(typeof body.timestamp).toBe('string');
  });
});

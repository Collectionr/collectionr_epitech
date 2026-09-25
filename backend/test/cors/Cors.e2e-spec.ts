import { Controller, Get, Module } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/shared/bootstrap/ConfigureApp';

const allowedOrigin = 'http://localhost:5173';

@Controller('ping')
class PingTestController {
  @Get()
  ping(): { pong: boolean } {
    return { pong: true };
  }
}

@Module({ controllers: [PingTestController] })
class PingTestModule {}

describe('CORS (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, PingTestModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows a configured origin with credentials', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/ping')
      .set('Origin', allowedOrigin);

    expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not expose CORS headers for an unknown origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/ping')
      .set('Origin', 'https://site-malveillant.example');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers preflight requests with the allowed methods', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/ping')
      .set('Origin', allowedOrigin)
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBeLessThan(300);
    expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });
});

import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/shared/bootstrap/ConfigureApp';

describe('HealthController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health returns 200 with an ok status', async () => {
    const response = await request(app.getHttpServer()).get('/health');
    const body = response.body as { status: string; checkedAt: string };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: 'ok' });
    expect(typeof body.checkedAt).toBe('string');
  });

  it('GET /health is not exposed under the /api/v1 prefix', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.status).toBe(404);
  });
});

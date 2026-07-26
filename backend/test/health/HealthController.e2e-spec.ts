import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/shared/bootstrap/ConfigureApp';
import { HEALTH_INDICATORS } from '../../src/modules/health/application/ports/IHealthIndicator';
import type { IHealthIndicator } from '../../src/modules/health/application/ports/IHealthIndicator';
import { DependencyHealth } from '../../src/modules/health/domain/entities/HealthStatus';
import { POSTGRES_POOL } from '../../src/shared/infrastructure/database/PostgresModule';
import { REDIS_CLIENT } from '../../src/shared/infrastructure/redis/RedisModule';
import type { HealthResponseDto } from '../../src/modules/health/application/dtos/HealthResponseDto';

// Doublures d'infrastructure : les indicateurs sont substitués, aucun client réel n'est créé.
const postgresPoolStub = { end: (): Promise<void> => Promise.resolve() };
const redisClientStub = { disconnect: (): void => undefined };

function buildIndicator(dependency: DependencyHealth): IHealthIndicator {
  return { check: () => Promise.resolve(dependency) };
}

async function buildApp(indicators: IHealthIndicator[]): Promise<NestFastifyApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(HEALTH_INDICATORS)
    .useValue(indicators)
    .overrideProvider(POSTGRES_POOL)
    .useValue(postgresPoolStub)
    .overrideProvider(REDIS_CLIENT)
    .useValue(redisClientStub)
    .compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

describe('HealthController (e2e)', () => {
  describe('when every dependency is up', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      app = await buildApp([
        buildIndicator(new DependencyHealth('database', 'up', 12)),
        buildIndicator(new DependencyHealth('cache', 'up', 3)),
      ]);
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /health returns 200 with the dependency details', async () => {
      const response = await request(app.getHttpServer()).get('/health');
      const body = response.body as HealthResponseDto;

      expect(response.status).toBe(200);
      expect(body.status).toBe('ok');
      expect(typeof body.checkedAt).toBe('string');
      expect(body.dependencies).toEqual([
        { name: 'database', status: 'up', latencyMs: 12 },
        { name: 'cache', status: 'up', latencyMs: 3 },
      ]);
    });

    it('GET /health is not exposed under the /api/v1 prefix', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health');

      expect(response.status).toBe(404);
    });
  });

  describe('when a dependency is down', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      app = await buildApp([
        buildIndicator(new DependencyHealth('database', 'up', 12)),
        buildIndicator(new DependencyHealth('cache', 'down', null)),
      ]);
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /health returns 503 with a degraded status', async () => {
      const response = await request(app.getHttpServer()).get('/health');
      const body = response.body as HealthResponseDto;

      expect(response.status).toBe(503);
      expect(body.status).toBe('degraded');
      expect(body.dependencies).toContainEqual({ name: 'cache', status: 'down', latencyMs: null });
    });
  });
});

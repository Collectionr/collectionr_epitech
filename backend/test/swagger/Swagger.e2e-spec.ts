import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/shared/bootstrap/ConfigureApp';

interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string };
  tags: { name: string }[];
  components: { securitySchemes: Record<string, { type: string; scheme?: string }> };
  paths: Record<string, unknown>;
}

describe('Swagger (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the Swagger UI on /api/docs', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs');

    expect([200, 301, 302]).toContain(response.status);
  });

  it('exposes an OpenAPI document with the Bearer JWT scheme and the domain tags', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json');
    const document = response.body as OpenApiDocument;

    expect(response.status).toBe(200);
    expect(document.openapi).toMatch(/^3\./);
    expect(document.info.title).toBe('Collectionr API');

    expect(document.components.securitySchemes['access-token']).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });

    const tagNames = document.tags.map((tag) => tag.name);
    expect(tagNames).toEqual(
      expect.arrayContaining(['Auth', 'Collections', 'Cartes', 'Scan', 'Health']),
    );

    expect(Object.keys(document.paths)).toContain('/health');
  });
});

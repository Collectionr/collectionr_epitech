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
  components: {
    securitySchemes: Record<string, { type: string; scheme?: string }>;
    schemas: Record<string, unknown>;
  };
  paths: Record<string, unknown>;
}

type OpenApiOperations = Record<string, Record<string, { responses: Record<string, unknown> }>>;

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
      expect.arrayContaining(['Auth', 'Collections', 'Cards', 'Scan', 'Health']),
    );

    expect(Object.keys(document.paths)).toContain('/health');
  });

  it('documents the success response and the errors of every Auth route (COLLR-415)', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json');
    const document = response.body as OpenApiDocument;
    const operations = document.paths as OpenApiOperations;

    const expected: [path: string, method: string, statusCodes: string[]][] = [
      ['/api/v1/auth/register', 'post', ['201', '400', '409', '429', '503']],
      ['/api/v1/auth/login', 'post', ['200', '400', '401', '429', '503']],
      ['/api/v1/auth/refresh', 'post', ['200', '400', '401', '429']],
      ['/api/v1/auth/logout', 'post', ['204', '400', '429']],
      ['/api/v1/users/me', 'get', ['200', '401', '404']],
      ['/api/v1/users/me', 'patch', ['200', '400', '401', '404', '409']],
      ['/api/v1/users/me/password', 'patch', ['200', '400', '401', '404', '409', '429', '503']],
    ];

    for (const [path, method, statusCodes] of expected) {
      const documented = Object.keys(operations[path]?.[method]?.responses ?? {});
      expect({ path, method, documented }).toEqual({
        path,
        method,
        documented: expect.arrayContaining(statusCodes) as unknown,
      });
    }

    expect(Object.keys(document.components.schemas)).toEqual(
      expect.arrayContaining(['UserResponseDto', 'AuthSessionResponseDto', 'AuthTokenResponseDto']),
    );
  });
});

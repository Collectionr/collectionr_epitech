import { Controller, Get, Module, NotFoundException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/shared/bootstrap/ConfigureApp';
import type { StandardErrorResponse } from '../../src/shared/interface/filters/AllExceptionsFilter';

@Controller('boom')
class BoomTestController {
  @Get('http')
  throwHttp(): never {
    throw new NotFoundException('Ressource introuvable');
  }

  @Get('internal')
  throwInternal(): never {
    throw new Error('detail interne sensible');
  }
}

@Module({ controllers: [BoomTestController] })
class BoomTestModule {}

describe('AllExceptionsFilter (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, BoomTestModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns HttpExceptions using the standard error format', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/boom/http');
    const body = response.body as StandardErrorResponse;

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Ressource introuvable',
      path: '/api/v1/boom/http',
    });
    expect(typeof body.timestamp).toBe('string');
  });

  it('returns validation errors using the standard error format', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/inconnu');
    const body = response.body as StandardErrorResponse;

    expect(response.status).toBe(404);
    expect(body.statusCode).toBe(404);
    expect(body.path).toBe('/api/v1/inconnu');
  });

  it('masks internal errors behind a generic 500 message', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/boom/internal');
    const body = response.body as StandardErrorResponse;

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Une erreur interne est survenue',
    });
    expect(JSON.stringify(body)).not.toContain('sensible');
  });
});

import {
  Controller,
  Get,
  Module,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
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
    throw new NotFoundException('Resource not found');
  }

  @Get('internal')
  throwInternal(): never {
    throw new Error('internal secret detail');
  }

  @Get('unavailable')
  throwUnavailable(): never {
    throw new ServiceUnavailableException('internal secret detail (503)');
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
      message: 'Resource not found',
      path: '/api/v1/boom/http',
    });
    expect(typeof body.timestamp).toBe('string');
  });

  it('returns validation errors using the standard error format', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/unknown');
    const body = response.body as StandardErrorResponse;

    expect(response.status).toBe(404);
    expect(body.statusCode).toBe(404);
    expect(body.path).toBe('/api/v1/unknown');
  });

  it('masks internal errors behind a generic 500 message', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/boom/internal');
    const body = response.body as StandardErrorResponse;

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An internal error occurred',
    });
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('masks the message of an HttpException with a 5xx status', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/boom/unavailable');
    const body = response.body as StandardErrorResponse;

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'An internal error occurred',
      path: '/api/v1/boom/unavailable',
    });
    expect(JSON.stringify(body)).not.toContain('secret');
  });
});

import { Body, Controller, Module, Post } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/shared/bootstrap/ConfigureApp';

class EchoDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Type(() => Number)
  @IsInt()
  quantity!: number;
}

@Controller('echo')
class EchoTestController {
  @Post()
  echo(@Body() dto: EchoDto): EchoDto {
    return dto;
  }
}

@Module({ controllers: [EchoTestController] })
class EchoTestModule {}

describe('Global ValidationPipe (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, EchoTestModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a valid payload and applies the declared transformations', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/echo')
      .send({ name: 'Pikachu', quantity: '2' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ name: 'Pikachu', quantity: 2 });
  });

  it('rejects a payload with a missing required property', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/echo').send({ quantity: 1 });

    expect(response.status).toBe(400);
  });

  it('rejects a payload containing undeclared properties', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/echo')
      .send({ name: 'Pikachu', quantity: 1, isAdmin: true });

    expect(response.status).toBe(400);
  });
});

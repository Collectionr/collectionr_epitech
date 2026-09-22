import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/shared/bootstrap/ConfigureApp';
import { AUDIT_LOG_REPOSITORY } from '../../src/modules/audit/application/ports/IAuditLogRepository';
import type { AuditEntry } from '../../src/modules/audit/domain/entities/AuditEntry';
import { Audit } from '../../src/modules/audit/interface/decorators/Audit';
import { PRISMA_CLIENT } from '../../src/shared/infrastructure/database/PrismaModule';
import { REDIS_CLIENT } from '../../src/shared/infrastructure/redis/RedisModule';

const USER_ID = '0b1f6c1e-6c1e-4b1e-8b1e-1b1e6c1e4b1e';
const TARGET_ID = '7d444840-9dc0-41d5-bf4a-0e4c0b5c1e11';

// Stands in for the authentication layer (COLLR-442) that will populate request.user.
@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const httpRequest = context.switchToHttp().getRequest<{ user?: { id: string } }>();
    httpRequest.user = { id: USER_ID };
    return true;
  }
}

// Stands in for a future RBAC guard (or ThrottlerGuard) that rejects *after*
// FakeAuthGuard already resolved the actor — proves AuditContextGuard +
// AllExceptionsFilter capture the actor even though the handler and
// AuditInterceptor never run.
@Injectable()
class RejectingGuard implements CanActivate {
  canActivate(): boolean {
    throw new ForbiddenException('insufficient role');
  }
}

@Controller('audit-probe')
class AuditProbeController {
  @Post(':id')
  @UseGuards(FakeAuthGuard)
  @Audit({
    action: 'probe.update',
    targetType: 'probe',
    targetIdParam: 'id',
    bodyFields: ['name'],
  })
  update(@Body() body: Record<string, unknown>): { name: unknown } {
    return { name: body.name };
  }

  @Post(':id/forbidden')
  @Audit({ action: 'probe.delete', targetType: 'probe', targetIdParam: 'id' })
  forbidden(): never {
    throw new ForbiddenException('nope');
  }

  @Get('not-audited')
  notAudited(): { ok: boolean } {
    return { ok: true };
  }

  @Post(':id/guard-rejected')
  @UseGuards(FakeAuthGuard, RejectingGuard)
  @Audit({ action: 'probe.restricted', targetType: 'probe', targetIdParam: 'id' })
  guardRejected(): never {
    throw new Error('unreachable: a rejected guard must never let the handler run');
  }
}

@Module({ controllers: [AuditProbeController], providers: [FakeAuthGuard, RejectingGuard] })
class AuditProbeModule {}

describe('Audit interceptor (e2e)', () => {
  let app: NestFastifyApplication;
  const record = jest.fn<Promise<void>, [AuditEntry]>();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AuditProbeModule],
    })
      .overrideProvider(AUDIT_LOG_REPOSITORY)
      .useValue({ record })
      .overrideProvider(PRISMA_CLIENT)
      .useValue({ $disconnect: (): Promise<void> => Promise.resolve() })
      .overrideProvider(REDIS_CLIENT)
      .useValue({ disconnect: (): void => undefined })
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    record.mockReset().mockResolvedValue(undefined);
  });

  it('records an audited success with the actor, the target and only the allowed body fields', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/audit-probe/${TARGET_ID}`)
      .send({ name: 'Base Set', password: 'hunter2' });

    expect(response.status).toBe(201);
    expect(record).toHaveBeenCalledTimes(1);

    const [entry] = record.mock.calls[0];
    expect(entry.action).toBe('probe.update');
    expect(entry.userId).toBe(USER_ID);
    expect(entry.targetType).toBe('probe');
    expect(entry.targetId).toBe(TARGET_ID);
    expect(entry.metadata).toMatchObject({ name: 'Base Set' });
    expect(JSON.stringify(entry)).not.toContain('hunter2');
    expect(entry.expiresAt.getTime()).toBeGreaterThan(entry.timestamp.getTime());
  });

  it('records a .failed entry and keeps the standard error response', async () => {
    const response = await request(app.getHttpServer()).post(
      `/api/v1/audit-probe/${TARGET_ID}/forbidden`,
    );

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ statusCode: 403, message: 'nope' });

    const [entry] = record.mock.calls[0];
    expect(entry.action).toBe('probe.delete.failed');
    expect(entry.metadata).toMatchObject({ statusCode: 403 });
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('records a .failed entry for a request rejected by a guard, even though the interceptor never runs', async () => {
    const response = await request(app.getHttpServer()).post(
      `/api/v1/audit-probe/${TARGET_ID}/guard-rejected`,
    );

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ statusCode: 403, message: 'insufficient role' });
    expect(record).toHaveBeenCalledTimes(1);

    const [entry] = record.mock.calls[0];
    expect(entry.action).toBe('probe.restricted.failed');
    expect(entry.userId).toBe(USER_ID); // captured from FakeAuthGuard, which ran before the rejection
    expect(entry.targetType).toBe('probe');
    expect(entry.targetId).toBe(TARGET_ID);
    expect(entry.metadata).toMatchObject({ statusCode: 403 });
  });

  it('does not record anything on a route without @Audit', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/audit-probe/not-audited');

    expect(response.status).toBe(200);
    expect(record).not.toHaveBeenCalled();
  });

  it('does not break the request when the audit write fails', async () => {
    record.mockRejectedValue(new Error('db down'));

    const response = await request(app.getHttpServer())
      .post(`/api/v1/audit-probe/${TARGET_ID}`)
      .send({ name: 'Base Set' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ name: 'Base Set' });
  });
});

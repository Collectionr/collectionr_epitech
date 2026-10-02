import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/shared/bootstrap/ConfigureApp';
import { PRISMA_CLIENT } from '../../src/shared/infrastructure/database/PrismaModule';
import { REDIS_CLIENT } from '../../src/shared/infrastructure/redis/RedisModule';
import { AUDIT_LOG_REPOSITORY } from '../../src/modules/audit/application/ports/IAuditLogRepository';
import type { AuditEntry } from '../../src/modules/audit/domain/entities/AuditEntry';
import type { StandardErrorResponse } from '../../src/shared/interface/filters/AllExceptionsFilter';
import { buildFakePrismaClient, buildFakeRedisClient } from './AuthTestDoubles';

interface AuthSessionBody {
  user: { id: string; email: string; username: string; createdAt: string };
  accessToken: string;
  refreshToken: string;
}

interface AuthTokenBody {
  accessToken: string;
  refreshToken: string;
}

describe('AuthController (e2e)', () => {
  let app: NestFastifyApplication;
  const record = jest.fn<Promise<void>, [AuditEntry]>();
  const fakeRedisClient = buildFakeRedisClient();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PRISMA_CLIENT)
      .useValue(buildFakePrismaClient())
      .overrideProvider(REDIS_CLIENT)
      .useValue(fakeRedisClient)
      .overrideProvider(AUDIT_LOG_REPOSITORY)
      .useValue({ record })
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
    // Isolates each test's /auth/login and /auth/register attempt counters (ADR-008 rate limiting)
    // from one another — they all share this one app instance, so one fake Redis client.
    fakeRedisClient.resetCounters();
  });

  function registerPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      email: 'ash@example.com',
      password: 'Str0ngPassw0rd!',
      username: 'ash_ketchum',
      hasAcceptedTerms: true,
      ...overrides,
    };
  }

  describe('POST /auth/register', () => {
    it('creates the account and never returns the password hash', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerPayload());

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ email: 'ash@example.com', username: 'ash_ketchum' });
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('password');
    });

    it('records an auth.register audit entry with only the email as metadata', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerPayload({ email: 'audited@example.com' }));

      expect(record).toHaveBeenCalledTimes(1);
      const [entry] = record.mock.calls[0];
      expect(entry.action).toBe('auth.register');
      expect(entry.metadata).toMatchObject({ email: 'audited@example.com' });
      expect(JSON.stringify(entry)).not.toContain('Str0ngPassw0rd!');
    });

    it('rejects a duplicate email with 409 Conflict', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerPayload({ email: 'dup@example.com' }));

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerPayload({ email: 'dup@example.com', username: 'someone_else' }));

      expect(response.status).toBe(409);
      expect((response.body as StandardErrorResponse).statusCode).toBe(409);
    });

    it('rejects a missing consent with 400 Bad Request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerPayload({ email: 'noconsent@example.com', hasAcceptedTerms: false }));

      expect(response.status).toBe(400);
    });

    it('rejects a password shorter than the policy floor with 400 Bad Request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerPayload({ email: 'shortpw@example.com', password: 'short' }));

      expect(response.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerPayload({ email: 'login@example.com' }));
    });

    it('authenticates and returns an access/refresh token pair', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'login@example.com', password: 'Str0ngPassw0rd!' });

      const body = response.body as AuthSessionBody;
      expect(response.status).toBe(200);
      expect(body.user).toMatchObject({ email: 'login@example.com' });
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
    });

    it('rejects a wrong password with 401 Unauthorized', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'login@example.com', password: 'WrongPassword!' });

      expect(response.status).toBe(401);
    });

    it('rejects an unknown email with 401 Unauthorized (no enumeration signal)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'unknown@example.com', password: 'Str0ngPassw0rd!' });

      expect(response.status).toBe(401);
    });

    it('rejects a malformed email the same way as a wrong password (401, not 400)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'Str0ngPassw0rd!' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/refresh and /auth/logout', () => {
    async function loginAndGetTokens(
      email: string,
    ): Promise<{ accessToken: string; refreshToken: string }> {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registerPayload({ email }));
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Str0ngPassw0rd!' });
      const body = login.body as AuthSessionBody;
      return { accessToken: body.accessToken, refreshToken: body.refreshToken };
    }

    it('rotates the refresh token and invalidates the previous one', async () => {
      const { refreshToken } = await loginAndGetTokens('refresh@example.com');

      const rotated = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(rotated.status).toBe(200);
      expect((rotated.body as AuthTokenBody).refreshToken).not.toBe(refreshToken);

      const reused = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(reused.status).toBe(401);
    });

    it('rejects an invalid refresh token with 401 Unauthorized', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'not-a-real-token' });

      expect(response.status).toBe(401);
    });

    it('logout revokes the refresh token: a later refresh attempt fails', async () => {
      const { refreshToken } = await loginAndGetTokens('logout@example.com');

      const logout = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken });
      expect(logout.status).toBe(204);

      const afterLogout = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });
      expect(afterLogout.status).toBe(401);
    });

    it('logout is idempotent: calling it twice never errors', async () => {
      const { refreshToken } = await loginAndGetTokens('logout-twice@example.com');

      await request(app.getHttpServer()).post('/api/v1/auth/logout').send({ refreshToken });
      const secondLogout = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken });

      expect(secondLogout.status).toBe(204);
    });
  });

  describe('reinforced rate limiting (ADR-008)', () => {
    it('blocks /auth/login with 429 after the configured attempt limit', async () => {
      const agent = request(app.getHttpServer());
      let lastStatus = 0;

      // Default AUTH_LOGIN_RATE_LIMIT is 5 (EnvironmentVariables.ts) — the 6th attempt must trip it.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await agent
          .post('/api/v1/auth/login')
          .send({ email: 'rate-limited@example.com', password: 'WrongPassword!' });
        lastStatus = response.status;
      }

      expect(lastStatus).toBe(429);
    });
  });
});

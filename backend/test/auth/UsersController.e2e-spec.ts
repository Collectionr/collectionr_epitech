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
import { buildFakePrismaClient, buildFakeRedisClient } from './AuthTestDoubles';

interface AuthSessionBody {
  user: { id: string; email: string; username: string; createdAt: string };
  accessToken: string;
  refreshToken: string;
}

describe('UsersController (e2e)', () => {
  let app: NestFastifyApplication;
  const record = jest.fn<Promise<void>, [AuditEntry]>();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PRISMA_CLIENT)
      .useValue(buildFakePrismaClient())
      .overrideProvider(REDIS_CLIENT)
      .useValue(buildFakeRedisClient())
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
  });

  async function registerAndLogin(
    email: string,
    password = 'Str0ngPassw0rd!',
  ): Promise<{ accessToken: string; userId: string }> {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, username: 'ash_ketchum', hasAcceptedTerms: true });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
    const body = login.body as AuthSessionBody;
    return { accessToken: body.accessToken, userId: body.user.id };
  }

  describe('GET /users/me', () => {
    it('rejects a request without a bearer token', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/users/me');

      expect(response.status).toBe(401);
    });

    it('rejects an invalid bearer token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer not-a-real-token');

      expect(response.status).toBe(401);
    });

    it('returns the current user profile', async () => {
      const { accessToken } = await registerAndLogin('me@example.com');

      const response = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ email: 'me@example.com', username: 'ash_ketchum' });
      expect(response.body).not.toHaveProperty('passwordHash');
    });
  });

  describe('PATCH /users/me/password', () => {
    it('rejects a request without a bearer token', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/users/me/password')
        .send({ currentPassword: 'Str0ngPassw0rd!', newPassword: 'NewPassw0rd!' });

      expect(response.status).toBe(401);
    });

    it('rejects an incorrect current password', async () => {
      const { accessToken } = await registerAndLogin('wrongcurrent@example.com');

      const response = await request(app.getHttpServer())
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'NotTheRealPassword!', newPassword: 'NewPassw0rd!' });

      expect(response.status).toBe(401);
    });

    it('changes the password and records an audited entry, without the password in metadata', async () => {
      const { accessToken, userId } = await registerAndLogin('change@example.com');
      // registerAndLogin() itself triggers auth.register/auth.login audit entries — isolate
      // the assertion below to the password-change call only.
      record.mockClear();

      const response = await request(app.getHttpServer())
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'Str0ngPassw0rd!', newPassword: 'NewPassw0rd!' });

      expect(response.status).toBe(200);

      expect(record).toHaveBeenCalledTimes(1);
      const [entry] = record.mock.calls[0];
      expect(entry.action).toBe('auth.password_change');
      expect(entry.userId).toBe(userId);
      expect(JSON.stringify(entry)).not.toContain('NewPassw0rd!');

      const oldPasswordLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'change@example.com', password: 'Str0ngPassw0rd!' });
      expect(oldPasswordLogin.status).toBe(401);

      const newPasswordLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'change@example.com', password: 'NewPassw0rd!' });
      expect(newPasswordLogin.status).toBe(200);
    });
  });
});

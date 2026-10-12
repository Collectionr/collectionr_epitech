// Injected before AppModule loads (see AuthController.e2e-spec.ts): the global limiter is not under test.
process.env.THROTTLE_LIMIT = '100000';

import request from 'supertest';
import { createAuthTestApp } from './AuthTestDoubles';
import type { AuthTestContext } from './AuthTestDoubles';

interface AuthSessionBody {
  user: { id: string; email: string; username: string; createdAt: string };
  accessToken: string;
  refreshToken: string;
}

const PASSWORD = 'Str0ngPassw0rd!';

// Real bcrypt (cost 12) on every register/login/password change: slow when the suites run in parallel.
jest.setTimeout(60_000);
const NEW_PASSWORD = 'NewPassw0rd!2';

describe('UsersController (e2e)', () => {
  let context: AuthTestContext;
  const http = (): ReturnType<typeof request> => request(context.app.getHttpServer());

  beforeAll(async () => {
    context = await createAuthTestApp();
  });

  afterAll(async () => {
    await context.app.close();
  });

  beforeEach(() => {
    context.audit.mockClear();
    context.redis.resetCounters();
  });

  async function registerAndLogin(email: string): Promise<AuthSessionBody> {
    await http()
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD, username: 'ash_ketchum', hasAcceptedTerms: true });
    context.redis.resetCounters();
    const response = await http().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    context.redis.resetCounters();
    return response.body as AuthSessionBody;
  }

  const bearer = (token: string): [string, string] => ['Authorization', `Bearer ${token}`];

  describe('GET /users/me', () => {
    it('rejects a request without a bearer token', async () => {
      const response = await http().get('/api/v1/users/me');

      expect(response.status).toBe(401);
    });

    it('rejects an invalid bearer token', async () => {
      const response = await http()
        .get('/api/v1/users/me')
        .set(...bearer('not-a-real-token'));

      expect(response.status).toBe(401);
    });

    it('returns the current user profile, which must not be cached', async () => {
      const { accessToken } = await registerAndLogin('me@example.com');

      const response = await http()
        .get('/api/v1/users/me')
        .set(...bearer(accessToken));

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toMatchObject({ email: 'me@example.com', username: 'ash_ketchum' });
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('accepts the "bearer" scheme in lower case (RFC 7235)', async () => {
      const { accessToken } = await registerAndLogin('lowercase@example.com');

      const response = await http()
        .get('/api/v1/users/me')
        .set('Authorization', `bearer ${accessToken}`);

      expect(response.status).toBe(200);
    });

    it('rejects the REFRESH token used as a bearer — it lives 7 days and used to open every route', async () => {
      const { refreshToken } = await registerAndLogin('refresh-as-bearer@example.com');

      const response = await http()
        .get('/api/v1/users/me')
        .set(...bearer(refreshToken));

      expect(response.status).toBe(401);
    });

    it('rejects a token signed with another secret, another algorithm, or none at all', async () => {
      const { accessToken } = await registerAndLogin('forged@example.com');
      const [header, payload] = accessToken.split('.') as [string, string];
      const unsigned = [
        Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
        payload,
        '',
      ].join('.');
      const tampered = `${header}.${payload}.${'A'.repeat(43)}`;

      for (const token of [unsigned, tampered]) {
        const response = await http()
          .get('/api/v1/users/me')
          .set(...bearer(token));
        expect(response.status).toBe(401);
      }
    });

    it('rejects an access token as soon as the user logs out', async () => {
      const { accessToken, refreshToken } = await registerAndLogin('out@example.com');
      await http().post('/api/v1/auth/logout').send({ refreshToken });

      const response = await http()
        .get('/api/v1/users/me')
        .set(...bearer(accessToken));

      expect(response.status).toBe(401);
    });

    it('rejects the access token of a deactivated account at once, not 15 minutes later', async () => {
      const { accessToken, user } = await registerAndLogin('gone@example.com');
      const stored = await context.repository.findById(user.id);
      await context.repository.save((stored as NonNullable<typeof stored>).deactivate());

      const response = await http()
        .get('/api/v1/users/me')
        .set(...bearer(accessToken));

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /users/me', () => {
    it('updates the username', async () => {
      const { accessToken } = await registerAndLogin('rename@example.com');

      const response = await http()
        .patch('/api/v1/users/me')
        .set(...bearer(accessToken))
        .send({ username: 'brand_new_name' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ username: 'brand_new_name' });
    });

    it('rejects an invalid username with 400', async () => {
      const { accessToken } = await registerAndLogin('badname@example.com');

      const response = await http()
        .patch('/api/v1/users/me')
        .set(...bearer(accessToken))
        .send({ username: 'ab' });

      expect(response.status).toBe(400);
    });

    it('requires authentication', async () => {
      const response = await http().patch('/api/v1/users/me').send({ username: 'whoever' });

      expect(response.status).toBe(401);
    });

    it('does not undo a password change made in between (no lost update)', async () => {
      const { accessToken, user } = await registerAndLogin('lost-update@example.com');
      const staleCopy = await context.repository.findById(user.id);
      await http()
        .patch('/api/v1/users/me/password')
        .set(...bearer(accessToken))
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

      await expect(
        context.repository.save(
          (staleCopy as NonNullable<typeof staleCopy>).withUsername('stale_write'),
        ),
      ).rejects.toThrow('modified concurrently');
      context.redis.resetCounters();
      const login = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'lost-update@example.com', password: NEW_PASSWORD });

      expect(login.status).toBe(200);
    });
  });

  describe('PATCH /users/me/password', () => {
    it('rejects a request without a bearer token', async () => {
      const response = await http()
        .patch('/api/v1/users/me/password')
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

      expect(response.status).toBe(401);
    });

    it('rejects an incorrect current password with 401', async () => {
      const { accessToken } = await registerAndLogin('wrongcurrent@example.com');

      const response = await http()
        .patch('/api/v1/users/me/password')
        .set(...bearer(accessToken))
        .send({ currentPassword: 'NotTheRealPassword!', newPassword: NEW_PASSWORD });

      expect(response.status).toBe(401);
    });

    it('refuses a new password identical to the current one, with 400', async () => {
      const { accessToken } = await registerAndLogin('same@example.com');

      const response = await http()
        .patch('/api/v1/users/me/password')
        .set(...bearer(accessToken))
        .send({ currentPassword: PASSWORD, newPassword: PASSWORD });

      expect(response.status).toBe(400);
    });

    it('changes the password and ends every session — the old refresh AND access tokens stop working at once', async () => {
      const { accessToken, refreshToken, user } = await registerAndLogin('change@example.com');
      const otherDevice = await registerAndLoginAgain('change@example.com');

      const response = await http()
        .patch('/api/v1/users/me/password')
        .set(...bearer(accessToken))
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
      const oldRefresh = await http().post('/api/v1/auth/refresh').send({ refreshToken });
      const otherDeviceRefresh = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: otherDevice.refreshToken });
      const oldAccess = await http()
        .get('/api/v1/users/me')
        .set(...bearer(accessToken));

      expect(response.status).toBe(200);
      expect(oldRefresh.status).toBe(401);
      expect(otherDeviceRefresh.status).toBe(401);
      expect(oldAccess.status).toBe(401);
      expect(context.store.liveSessionsOf(user.id)).toBe(0);
    });

    it('lets the user back in with the new password only', async () => {
      const { accessToken } = await registerAndLogin('newpw@example.com');
      await http()
        .patch('/api/v1/users/me/password')
        .set(...bearer(accessToken))
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
      context.redis.resetCounters();

      const oldPassword = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'newpw@example.com', password: PASSWORD });
      const newPassword = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'newpw@example.com', password: NEW_PASSWORD });

      expect(oldPassword.status).toBe(401);
      expect(newPassword.status).toBe(200);
    });

    it('audits the change with the user as actor and target, and no password in metadata', async () => {
      const { accessToken, user } = await registerAndLogin('audit-pw@example.com');
      context.audit.mockClear();

      await http()
        .patch('/api/v1/users/me/password')
        .set(...bearer(accessToken))
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

      expect(context.audit).toHaveBeenCalledTimes(1);
      const [entry] = context.audit.mock.calls[0];
      expect(entry.action).toBe('auth.password_change');
      expect(entry.userId).toBe(user.id);
      expect(entry.targetId).toBe(user.id);
      expect(JSON.stringify(entry)).not.toContain(NEW_PASSWORD);
      expect(JSON.stringify(entry)).not.toContain(PASSWORD);
    });

    it('is rate-limited per user: a valid token is not a free bcrypt lever', async () => {
      const { accessToken } = await registerAndLogin('hammer@example.com');
      const statuses: number[] = [];

      for (let i = 0; i < 6; i += 1) {
        const response = await http()
          .patch('/api/v1/users/me/password')
          .set(...bearer(accessToken))
          .send({ currentPassword: 'WrongCurrent1!', newPassword: NEW_PASSWORD });
        statuses.push(response.status);
      }

      expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    });
  });

  async function registerAndLoginAgain(email: string): Promise<AuthSessionBody> {
    context.redis.resetCounters();
    const response = await http().post('/api/v1/auth/login').send({ email, password: PASSWORD });
    context.redis.resetCounters();
    return response.body as AuthSessionBody;
  }
});

// Injected before AppModule loads (ConfigModule reads the environment when the module is imported).
// The global in-memory limiter (100 requests a minute per address) would answer 429 in the middle of
// this file, and it is not what is under test; and 3 registrations are enough to reach the auth
// limiter quickly (each one is a real bcrypt hash) while proving the figure is configurable.
process.env.THROTTLE_LIMIT = '100000';
process.env.AUTH_REGISTER_RATE_LIMIT = '3';

import request from 'supertest';
import { Prisma } from '../../src/generated/prisma/client.js';
import type { StandardErrorResponse } from '../../src/shared/interface/filters/AllExceptionsFilter';
import { createAuthTestApp } from './AuthTestDoubles';
import type { AuthTestContext } from './AuthTestDoubles';

interface AuthSessionBody {
  user: { id: string; email: string; username: string; createdAt: string };
  accessToken: string;
  refreshToken: string;
}

interface AuthTokenBody {
  accessToken: string;
  refreshToken: string;
}

const PASSWORD = 'Str0ngPassw0rd!';

// Real bcrypt (cost 12) on every register/login: slow when the e2e suites run in parallel.
jest.setTimeout(60_000);

describe('AuthController (e2e)', () => {
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
    // All tests share one app, so one fake Redis: isolate each test's attempt counters.
    context.redis.resetCounters();
  });

  // Usernames are unique in the store: each registration gets its own by default.
  let registrations = 0;
  const registration = (overrides: Record<string, unknown> = {}): Record<string, unknown> => {
    registrations += 1;
    return {
      email: 'ash@example.com',
      password: PASSWORD,
      username: `ash_${String(registrations).padStart(4, '0')}`,
      acceptedTermsVersion: '1',
      ...overrides,
    };
  };

  async function register(email: string): Promise<void> {
    await http().post('/api/v1/auth/register').send(registration({ email }));
  }

  async function login(email: string, password = PASSWORD): Promise<AuthSessionBody> {
    const response = await http().post('/api/v1/auth/login').send({ email, password });
    return response.body as AuthSessionBody;
  }

  async function registerAndLogin(email: string): Promise<AuthSessionBody> {
    await register(email);
    context.redis.resetCounters();
    return login(email);
  }

  const auditedActions = (): string[] => context.audit.mock.calls.map(([entry]) => entry.action);

  describe('POST /auth/register', () => {
    it('creates the account and never returns the password hash', async () => {
      const response = await http().post('/api/v1/auth/register').send(registration());

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ email: 'ash@example.com' });
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('password');
    });

    it('audits auth.register with the new user as actor and target, and only the canonical email as metadata', async () => {
      const response = await http()
        .post('/api/v1/auth/register')
        .send(registration({ email: 'Audited@EXAMPLE.com' }));
      const created = response.body as { id: string };

      expect(context.audit).toHaveBeenCalledTimes(1);
      const [entry] = context.audit.mock.calls[0];
      expect(entry.action).toBe('auth.register');
      expect(entry.userId).toBe(created.id);
      expect(entry.targetId).toBe(created.id);
      expect(entry.metadata).toMatchObject({ email: 'audited@example.com' });
      expect(JSON.stringify(entry)).not.toContain(PASSWORD);
    });

    it('rejects a duplicate email with 409, without echoing it back', async () => {
      await register('dup@example.com');

      const response = await http()
        .post('/api/v1/auth/register')
        .send(registration({ email: 'dup@example.com', username: 'someone_else' }));

      expect(response.status).toBe(409);
      expect(JSON.stringify(response.body)).not.toContain('dup@example.com');
    });

    it('treats two spellings of one mailbox as the same account', async () => {
      await register('case@example.com');

      const response = await http()
        .post('/api/v1/auth/register')
        .send(registration({ email: 'CASE@Example.COM', username: 'another_one' }));

      expect(response.status).toBe(409);
    });

    it('rejects a missing consent with 400', async () => {
      const response = await http()
        .post('/api/v1/auth/register')
        .send(registration({ email: 'noconsent@example.com', acceptedTermsVersion: undefined }));

      expect(response.status).toBe(400);
    });

    it('rejects a password that the domain refuses (no digit) with 400, not a 500', async () => {
      const response = await http()
        .post('/api/v1/auth/register')
        .send(registration({ email: 'weak@example.com', password: 'onlyletters' }));

      expect(response.status).toBe(400);
    });

    it('rejects a password shorter than the policy floor with 400', async () => {
      const response = await http()
        .post('/api/v1/auth/register')
        .send(registration({ email: 'shortpw@example.com', password: 'short' }));

      expect(response.status).toBe(400);
    });

    it('rejects an oversized email with 400 and stores nothing of it in the audit trail', async () => {
      const response = await http()
        .post('/api/v1/auth/register')
        .send(registration({ email: `${'a'.repeat(900_000)}@example.com` }));

      expect(response.status).toBe(400);
      for (const [entry] of context.audit.mock.calls) {
        expect(JSON.stringify(entry).length).toBeLessThan(2000);
      }
    });

    it('answers an infrastructure failure with a generic 500 that leaks nothing', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Invalid `prisma.user.upsert()` invocation: connect ECONNREFUSED db.internal:5432',
        { code: 'P1001', clientVersion: '7.10.0' },
      );
      jest.spyOn(context.repository, 'save').mockRejectedValueOnce(prismaError);

      const response = await http()
        .post('/api/v1/auth/register')
        .send(registration({ email: 'infra@example.com' }));
      const body = response.body as StandardErrorResponse;

      expect(response.status).toBe(500);
      expect(JSON.stringify(body)).not.toContain('db.internal');
      expect(JSON.stringify(body)).not.toContain('prisma');
    });
  });

  describe('terms of service and username uniqueness', () => {
    it('refuses a registration that accepted a terms version which is no longer current, with 409', async () => {
      const response = await http()
        .post('/api/v1/auth/register')
        .send(registration({ email: 'old-terms@example.com', acceptedTermsVersion: '0' }));

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ statusCode: 409 });
    });

    it('refuses a missing acceptance with 400, not a registration without proof', async () => {
      const response = await http()
        .post('/api/v1/auth/register')
        .send(registration({ email: 'none-terms@example.com', acceptedTermsVersion: undefined }));

      expect(response.status).toBe(400);
    });

    it('refuses a malformed terms version at validation (400)', async () => {
      const response = await http()
        .post('/api/v1/auth/register')
        .send(registration({ email: 'bad-terms@example.com', acceptedTermsVersion: 'v 1; drop' }));

      expect(response.status).toBe(400);
    });

    it('refuses a username that differs only by case or spacing, with 409 and without echoing it', async () => {
      await http()
        .post('/api/v1/auth/register')
        .send(registration({ email: 'taken-name@example.com', username: 'Pokemon Master' }));

      const response = await http()
        .post('/api/v1/auth/register')
        .send(registration({ email: 'other-name@example.com', username: '  pokemon   MASTER ' }));

      expect(response.status).toBe(409);
      expect(JSON.stringify(response.body)).not.toMatch(/pokemon/i);
    });

    it('reports a taken email and a taken username as different errors', async () => {
      await http()
        .post('/api/v1/auth/register')
        .send(registration({ email: 'first-user@example.com', username: 'first_name' }));

      const emailClash = await http()
        .post('/api/v1/auth/register')
        .send(registration({ email: 'first-user@example.com', username: 'fresh_name' }));
      const usernameClash = await http()
        .post('/api/v1/auth/register')
        .send(registration({ email: 'fresh-user@example.com', username: 'first_name' }));

      expect((emailClash.body as StandardErrorResponse).message).toBe(
        'Email is already registered',
      );
      expect((usernameClash.body as StandardErrorResponse).message).toBe(
        'Username is already taken',
      );
    });
  });

  describe('POST /auth/login', () => {
    beforeAll(async () => {
      // The earlier tests used up the registration allowance: start this fixture from a clean slate.
      context.redis.resetCounters();
      await register('login@example.com');
      context.redis.resetCounters();
    });

    it('authenticates and returns an access/refresh token pair that must not be cached', async () => {
      const response = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'login@example.com', password: PASSWORD });
      const body = response.body as AuthSessionBody;

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(body.user).toMatchObject({ email: 'login@example.com' });
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
    });

    it('audits auth.login with the user as actor and target (not NULL), and the canonical email', async () => {
      const session = await login('Login@Example.com');

      const [entry] = context.audit.mock.calls[0];
      expect(entry.action).toBe('auth.login');
      expect(entry.userId).toBe(session.user.id);
      expect(entry.targetId).toBe(session.user.id);
      expect(entry.metadata).toMatchObject({ email: 'login@example.com' });
    });

    it('audits a failed login with the attempted account and no actor', async () => {
      await http()
        .post('/api/v1/auth/login')
        .send({ email: 'login@example.com', password: 'nope' });

      const [entry] = context.audit.mock.calls[0];
      expect(entry.action).toBe('auth.login.failed');
      expect(entry.userId).toBeNull();
      expect(entry.metadata).toMatchObject({ email: 'login@example.com', statusCode: 401 });
    });

    it('rejects a wrong password with 401', async () => {
      const response = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'login@example.com', password: 'WrongPassword!' });

      expect(response.status).toBe(401);
    });

    it('rejects an unknown email with the very same answer (no enumeration signal)', async () => {
      const wrongPassword = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'login@example.com', password: 'WrongPassword!' });
      const unknownEmail = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'unknown@example.com', password: PASSWORD });

      expect(unknownEmail.status).toBe(401);
      expect((unknownEmail.body as StandardErrorResponse).message).toBe(
        (wrongPassword.body as StandardErrorResponse).message,
      );
    });

    it('rejects a malformed email the same way as a wrong password (401, not 400)', async () => {
      const response = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: PASSWORD });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token and burns the previous one', async () => {
      const { refreshToken } = await registerAndLogin('refresh@example.com');

      const rotated = await http().post('/api/v1/auth/refresh').send({ refreshToken });
      const reused = await http().post('/api/v1/auth/refresh').send({ refreshToken });

      expect(rotated.status).toBe(200);
      expect(rotated.headers['cache-control']).toBe('no-store');
      expect((rotated.body as AuthTokenBody).refreshToken).not.toBe(refreshToken);
      expect(reused.status).toBe(401);
    });

    it('treats a replayed token as theft: the whole login is revoked, including the new token', async () => {
      const { refreshToken } = await registerAndLogin('replay@example.com');
      const rotated = (await http().post('/api/v1/auth/refresh').send({ refreshToken }))
        .body as AuthTokenBody;

      await http().post('/api/v1/auth/refresh').send({ refreshToken }); // the replay
      const afterReplay = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotated.refreshToken });

      expect(afterReplay.status).toBe(401);
    });

    it('answers 401 — not 500 — when an ACCESS token is presented as the refresh token', async () => {
      const { accessToken } = await registerAndLogin('swap@example.com');

      const response = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: accessToken });

      expect(response.status).toBe(401);
    });

    it('rejects garbage with 401', async () => {
      const response = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'not-a-token' });

      expect(response.status).toBe(401);
    });

    it('is audited', async () => {
      const { refreshToken } = await registerAndLogin('audit-refresh@example.com');
      context.audit.mockClear();

      await http().post('/api/v1/auth/refresh').send({ refreshToken });

      expect(auditedActions()).toEqual(['auth.refresh']);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the refresh token: a later refresh fails', async () => {
      const { refreshToken } = await registerAndLogin('logout@example.com');

      const logout = await http().post('/api/v1/auth/logout').send({ refreshToken });
      const afterLogout = await http().post('/api/v1/auth/refresh').send({ refreshToken });

      expect(logout.status).toBe(204);
      expect(afterLogout.status).toBe(401);
    });

    it('is idempotent: calling it twice never errors', async () => {
      const { refreshToken } = await registerAndLogin('logout-twice@example.com');

      await http().post('/api/v1/auth/logout').send({ refreshToken });
      const second = await http().post('/api/v1/auth/logout').send({ refreshToken });

      expect(second.status).toBe(204);
    });

    it("revokes nothing when an access token is sent as the refresh token — not even other users' sessions (was a wildcard)", async () => {
      const attacker = await registerAndLogin('attacker@example.com');
      const victim = await registerAndLogin('victim@example.com');

      const response = await http()
        .post('/api/v1/auth/logout')
        .send({ refreshToken: attacker.accessToken });
      const victimStillLoggedIn = await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: victim.refreshToken });

      expect(response.status).toBe(204);
      expect(victimStillLoggedIn.status).toBe(200);
      expect(context.store.liveSessionsOf(attacker.user.id)).toBe(1);
    });

    it('is audited', async () => {
      const { refreshToken } = await registerAndLogin('audit-logout@example.com');
      context.audit.mockClear();

      await http().post('/api/v1/auth/logout').send({ refreshToken });

      expect(auditedActions()).toEqual(['auth.logout']);
    });
  });

  describe('deactivated accounts', () => {
    it('can neither log in nor refresh, and a refresh token held before the deactivation stops working', async () => {
      const { refreshToken, user } = await registerAndLogin('deactivated@example.com');
      const stored = await context.repository.findById(user.id);
      await context.repository.save((stored as NonNullable<typeof stored>).deactivate());
      context.redis.resetCounters();

      const refresh = await http().post('/api/v1/auth/refresh').send({ refreshToken });
      const loginAttempt = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'deactivated@example.com', password: PASSWORD });

      expect(refresh.status).toBe(401);
      expect(loginAttempt.status).toBe(401);
    });
  });

  describe('rate limiting (ADR-008, S03 §7)', () => {
    async function statusesOfFailedLogins(count: number, email: string): Promise<number[]> {
      const statuses: number[] = [];
      for (let i = 0; i < count; i += 1) {
        const response = await http()
          .post('/api/v1/auth/login')
          .send({ email, password: 'WrongPassword!' });
        statuses.push(response.status);
      }
      return statuses;
    }

    it('refuses the 6th login attempt on one account with 429 and a Retry-After for the lock', async () => {
      const statuses = await statusesOfFailedLogins(5, 'rate-limited@example.com');
      const blocked = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'rate-limited@example.com', password: 'WrongPassword!' });

      expect(statuses).toEqual([401, 401, 401, 401, 401]);
      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(60);
    });

    it('keeps refusing during the 15-minute lock, even for the right password', async () => {
      await register('locked@example.com');
      context.redis.resetCounters();
      await statusesOfFailedLogins(6, 'locked@example.com');

      const withRightPassword = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'locked@example.com', password: PASSWORD });

      expect(withRightPassword.status).toBe(429);
    });

    it('does not lock another account out because of the first one', async () => {
      await statusesOfFailedLogins(6, 'noisy@example.com');

      const other = await http()
        .post('/api/v1/auth/login')
        .send({ email: 'quiet@example.com', password: 'WrongPassword!' });

      expect(other.status).toBe(401);
    });

    it('counts every spelling of one mailbox against the same account', async () => {
      const statuses: number[] = [];
      for (const spelling of ['spell@example.com', 'SPELL@example.com', ' Spell@Example.com ']) {
        statuses.push(...(await statusesOfFailedLogins(2, spelling)));
      }

      expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    });

    it('audits the refusal', async () => {
      await statusesOfFailedLogins(6, 'audited-block@example.com');

      const last = context.audit.mock.calls.at(-1)?.[0];
      expect(last?.action).toBe('auth.login.failed');
      expect(last?.metadata).toMatchObject({ statusCode: 429 });
    });

    it('limits registrations per address', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 4; i += 1) {
        const response = await http()
          .post('/api/v1/auth/register')
          .send(registration({ email: `bulk${i}@example.com` }));
        statuses.push(response.status);
      }

      expect(statuses).toEqual([201, 201, 201, 429]);
    });
  });
});

/**
 * Attack scenarios against the REAL database. The unit specs mock Prisma, so none of them can see
 * what a `where` actually matches, whether two transactions really serialise, or what a trigger does.
 */
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { User } from '../modules/auth/domain/entities/User';
import { Email } from '../modules/auth/domain/value-objects/Email';
import { InvalidRefreshTokenError } from '../modules/auth/application/errors/AuthErrors';
import { PrismaUserRepository } from '../modules/auth/infrastructure/repositories/PrismaUserRepository';
import { AccessTokenVerifier } from '../modules/auth/infrastructure/services/AccessTokenVerifier';
import { JwtAuthTokenService } from '../modules/auth/infrastructure/services/JwtAuthTokenService';
import {
  INTEGRATION_JWT_SECRET,
  createIntegrationPrisma,
  createTestCodec,
} from './IntegrationDatabase';

const prisma = createIntegrationPrisma();
const codec = createTestCodec();
const repository = new PrismaUserRepository(prisma);
const service = new JwtAuthTokenService(codec, prisma, 900, 604800, 2592000);
const verifier = new AccessTokenVerifier(codec, prisma);

afterAll(async () => {
  await prisma.$disconnect();
});

async function createAccount(): Promise<User> {
  return repository.save(
    User.register({
      email: Email.create(`sec${randomUUID().slice(0, 12)}@example.com`),
      passwordHash: '$2b$12$' + 'x'.repeat(53),
      username: 'security',
      consentGivenAt: new Date(),
    }),
  );
}

const liveSessions = (userId: string): Promise<number> =>
  prisma.session.count({ where: { userId, isRevoked: false } });

const forge = (payload: object, options: jwt.SignOptions = {}): string =>
  jwt.sign(payload, INTEGRATION_JWT_SECRET, { algorithm: 'HS256', expiresIn: 600, ...options });

describe('logout cannot be turned into a wildcard (point 1)', () => {
  it("an access token sent as refreshToken revokes nothing — not another user's session, not even the caller's other devices", async () => {
    const attacker = await createAccount();
    const victims = await Promise.all([createAccount(), createAccount(), createAccount()]);
    const attackerLogin = await service.issueTokenPair(attacker.id);
    await service.issueTokenPair(attacker.id); // a second device of the attacker
    for (const victim of victims) {
      await service.issueTokenPair(victim.id);
    }

    await service.revokeRefreshToken(attackerLogin.accessToken);

    expect(await liveSessions(attacker.id)).toBe(2);
    for (const victim of victims) {
      expect(await liveSessions(victim.id)).toBe(1);
    }
  });

  it('a token that names no session (no jti) is a no-op, never a query without a filter', async () => {
    const bystander = await createAccount();
    await service.issueTokenPair(bystander.id);
    const noJti = forge(
      { typ: 'refresh', fam: randomUUID() },
      { subject: bystander.id, issuer: 'collectionr-api', audience: 'collectionr:refresh' },
    );

    await expect(service.revokeRefreshToken(noJti)).resolves.toBeUndefined();

    expect(await liveSessions(bystander.id)).toBe(1);
  });

  it('a jti that is not a UUID is refused before it reaches PostgreSQL (no database error, no 500)', async () => {
    const user = await createAccount();
    await service.issueTokenPair(user.id);
    const badJti = forge(
      { typ: 'refresh', fam: randomUUID() },
      {
        subject: user.id,
        jwtid: "'; DROP TABLE sessions; --",
        issuer: 'collectionr-api',
        audience: 'collectionr:refresh',
      },
    );

    await expect(service.revokeRefreshToken(badJti)).resolves.toBeUndefined();
    await expect(service.rotateRefreshToken(badJti)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(await liveSessions(user.id)).toBe(1);
  });

  it('rotating an access token is an invalid refresh token, not a crash', async () => {
    const user = await createAccount();
    const pair = await service.issueTokenPair(user.id);

    await expect(service.rotateRefreshToken(pair.accessToken)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });
});

describe('refresh token rotation (point 4)', () => {
  it('under 20 concurrent rotations of one token exactly one succeeds, and the replays kill the chain', async () => {
    const user = await createAccount();
    const pair = await service.issueTokenPair(user.id);

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => service.rotateRefreshToken(pair.refreshToken)),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(
      results.filter(
        (result) =>
          result.status === 'rejected' && !(result.reason instanceof InvalidRefreshTokenError),
      ),
    ).toHaveLength(0);
    // The losers presented a token that had just been rotated: that is exactly the "stolen" signal.
    expect(await liveSessions(user.id)).toBe(0);
  });

  it("replaying a rotated token revokes that login chain only, not the user's other devices", async () => {
    const user = await createAccount();
    const laptop = await service.issueTokenPair(user.id);
    const phone = await service.issueTokenPair(user.id);
    await service.rotateRefreshToken(laptop.refreshToken);

    await expect(service.rotateRefreshToken(laptop.refreshToken)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );

    expect(await liveSessions(user.id)).toBe(1);
    await expect(service.rotateRefreshToken(phone.refreshToken)).resolves.toBeDefined();
  });

  it('a logged-out token that is replayed is just dead: it does not take the other devices down', async () => {
    const user = await createAccount();
    const laptop = await service.issueTokenPair(user.id);
    const phone = await service.issueTokenPair(user.id);
    await service.revokeRefreshToken(laptop.refreshToken);

    await expect(service.rotateRefreshToken(laptop.refreshToken)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );

    await expect(service.rotateRefreshToken(phone.refreshToken)).resolves.toBeDefined();
  });

  it('refreshing never extends a login past its absolute end', async () => {
    const shortLived = new JwtAuthTokenService(codec, prisma, 900, 3600, 120);
    const user = await createAccount();
    const first = await shortLived.issueTokenPair(user.id);
    const second = await shortLived.rotateRefreshToken(first.refreshToken);

    const sessions = await prisma.session.findMany({ where: { userId: user.id } });

    const hardEnds = new Set(sessions.map((session) => session.absoluteExpiresAt.getTime()));
    expect(hardEnds.size).toBe(1);
    for (const session of sessions) {
      expect(session.expiresAt.getTime()).toBeLessThanOrEqual(session.absoluteExpiresAt.getTime());
    }

    // Time travel: the chain's hard end has passed, however fresh the refresh token still looks.
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { absoluteExpiresAt: new Date(Date.now() - 1000) },
    });
    await expect(shortLived.rotateRefreshToken(second.refreshToken)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });
});

describe('credential changes are atomic with the session revocation (points 3 and 9)', () => {
  it('saving a new password revokes every session of the user in the same transaction', async () => {
    const user = await createAccount();
    await service.issueTokenPair(user.id);
    await service.issueTokenPair(user.id);

    await repository.save(user.withPasswordHash('$2b$12$' + 'y'.repeat(53)));

    expect(await liveSessions(user.id)).toBe(0);
  });

  it('deactivating an account revokes every session of the user', async () => {
    const user = await createAccount();
    await service.issueTokenPair(user.id);

    await repository.save(user.deactivate());

    expect(await liveSessions(user.id)).toBe(0);
  });

  it('a change that is not about credentials leaves the sessions alone', async () => {
    const user = await createAccount();
    await service.issueTokenPair(user.id);

    await repository.save(user.withUsername('renamed_user'));

    expect(await liveSessions(user.id)).toBe(1);
  });

  it('a rotation racing a password change cannot leave a live session behind', async () => {
    for (let round = 0; round < 12; round += 1) {
      const user = await createAccount();
      const pair = await service.issueTokenPair(user.id);

      await Promise.allSettled([
        service.rotateRefreshToken(pair.refreshToken),
        repository.save(user.withPasswordHash('$2b$12$' + 'z'.repeat(53))),
      ]);

      expect(await liveSessions(user.id)).toBe(0);
    }
  });

  it('a rotation racing a bulk revocation cannot leave a live session behind', async () => {
    for (let round = 0; round < 12; round += 1) {
      const user = await createAccount();
      const pair = await service.issueTokenPair(user.id);

      await Promise.allSettled([
        service.rotateRefreshToken(pair.refreshToken),
        service.revokeAllRefreshTokens(user.id),
      ]);

      expect(await liveSessions(user.id)).toBe(0);
    }
  });

  it('a rotation racing a deactivation cannot leave a live session behind', async () => {
    for (let round = 0; round < 12; round += 1) {
      const user = await createAccount();
      const pair = await service.issueTokenPair(user.id);

      await Promise.allSettled([
        service.rotateRefreshToken(pair.refreshToken),
        repository.save(user.deactivate()),
      ]);

      expect(await liveSessions(user.id)).toBe(0);
    }
  });
});

describe('loading accounts stored under older rules (point "à faire en premier")', () => {
  it("findById returns an account whose stored email would not pass today's validation, instead of failing", async () => {
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        email: `Legacy..Address${id.slice(0, 6)}@Example.COM`,
        passwordHash: 'legacy',
        username: 'legacy',
        consentGivenAt: new Date(),
      },
    });

    const found = await repository.findById(id);

    expect(found?.id).toBe(id);
    expect(found?.email.value).toContain('Legacy..Address');
  });
});

describe('access token verification (point 2)', () => {
  it('authenticates a fresh access token', async () => {
    const user = await createAccount();
    const pair = await service.issueTokenPair(user.id);

    await expect(verifier.verify(pair.accessToken)).resolves.toMatchObject({ userId: user.id });
  });

  it('refuses the refresh token used as a bearer — it is valid for 7 days and used to open every door', async () => {
    const user = await createAccount();
    const pair = await service.issueTokenPair(user.id);

    await expect(verifier.verify(pair.refreshToken)).resolves.toBeNull();
  });

  it('keeps an access token valid across a rotation (a request in flight is not cut off)', async () => {
    const user = await createAccount();
    const pair = await service.issueTokenPair(user.id);
    const rotated = await service.rotateRefreshToken(pair.refreshToken);

    await expect(verifier.verify(pair.accessToken)).resolves.not.toBeNull();
    await expect(verifier.verify(rotated.accessToken)).resolves.not.toBeNull();
  });

  it('refuses the access token the moment its login is logged out', async () => {
    const user = await createAccount();
    const pair = await service.issueTokenPair(user.id);

    await service.revokeRefreshToken(pair.refreshToken);

    await expect(verifier.verify(pair.accessToken)).resolves.toBeNull();
  });

  it('refuses the access token the moment the password changes', async () => {
    const user = await createAccount();
    const pair = await service.issueTokenPair(user.id);

    await repository.save(user.withPasswordHash('$2b$12$' + 'k'.repeat(53)));

    await expect(verifier.verify(pair.accessToken)).resolves.toBeNull();
  });

  it('refuses the access token of a deactivated account', async () => {
    const user = await createAccount();
    const pair = await service.issueTokenPair(user.id);

    await repository.save(user.deactivate());

    await expect(verifier.verify(pair.accessToken)).resolves.toBeNull();
  });

  it('refuses the access token once a replayed refresh token has revealed the chain as stolen', async () => {
    const user = await createAccount();
    const pair = await service.issueTokenPair(user.id);
    const rotated = await service.rotateRefreshToken(pair.refreshToken);
    await service.rotateRefreshToken(pair.refreshToken).catch(() => undefined);

    await expect(verifier.verify(rotated.accessToken)).resolves.toBeNull();
  });

  it('refuses an access token whose chain has passed its hard end', async () => {
    const user = await createAccount();
    const pair = await service.issueTokenPair(user.id);

    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { absoluteExpiresAt: new Date(Date.now() - 1000) },
    });

    await expect(verifier.verify(pair.accessToken)).resolves.toBeNull();
  });

  it('refuses a token for a user that does not exist', async () => {
    const ghost = codec.signAccessToken({ sub: randomUUID(), fam: randomUUID() }, 600);

    await expect(verifier.verify(ghost)).resolves.toBeNull();
  });
});

describe('housekeeping', () => {
  it('purges the expired sessions and keeps the live ones and the revoked-but-unexpired ones', async () => {
    const user = await createAccount();
    const live = await service.issueTokenPair(user.id);
    const revoked = await service.issueTokenPair(user.id);
    await service.revokeRefreshToken(revoked.refreshToken);
    const expired = await service.issueTokenPair(user.id);
    const expiredId = codec.verifyRefreshToken(expired.refreshToken).jti;
    await prisma.session.update({
      where: { id: expiredId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const purged = await service.purgeExpiredSessions(new Date());

    expect(purged).toBeGreaterThanOrEqual(1);
    expect(await prisma.session.findUnique({ where: { id: expiredId } })).toBeNull();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);
    await expect(service.rotateRefreshToken(live.refreshToken)).resolves.toBeDefined();
  });
});

describe('GDPR: deleting an account removes its email from the audit trail (point 11)', () => {
  it('keeps the entries, drops the email from their metadata, leaves everything else and other users alone', async () => {
    const leaving = await createAccount();
    const staying = await createAccount();
    const expiresAt = new Date(Date.now() + 86_400_000);
    const entry = await prisma.auditLog.create({
      data: {
        userId: leaving.id,
        action: 'auth.login',
        metadata: { email: leaving.email.value, requestId: 'req-1' },
        expiresAt,
      },
    });
    const otherEntry = await prisma.auditLog.create({
      data: {
        userId: staying.id,
        action: 'auth.login',
        metadata: { email: staying.email.value, requestId: 'req-2' },
        expiresAt,
      },
    });

    await prisma.user.delete({ where: { id: leaving.id } });

    const kept = await prisma.auditLog.findUnique({ where: { id: entry.id } });
    expect(kept?.userId).toBeNull();
    expect(kept?.metadata).toEqual({ requestId: 'req-1' });
    const untouched = await prisma.auditLog.findUnique({ where: { id: otherEntry.id } });
    expect(untouched?.metadata).toEqual({ email: staying.email.value, requestId: 'req-2' });
  });
});

import { createHash, randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '../../../../generated/prisma/client.js';
import {
  InvalidCredentialsError,
  InvalidRefreshTokenError,
} from '../../application/errors/AuthErrors';
import { JwtAuthTokenService } from './JwtAuthTokenService';
import { JwtTokenCodec } from './JwtTokenCodec';

const ACCESS_TTL = 900;
const REFRESH_TTL = 604800;
const SESSION_MAX = 2592000;
const USER_ID = randomUUID();

const codec = new JwtTokenCodec({
  get: () => 'a-test-secret-of-at-least-32-characters-long',
} as unknown as ConfigService);

const sha256 = (token: string): string => createHash('sha256').update(token).digest('hex');

interface Harness {
  service: JwtAuthTokenService;
  lock: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  updateMany: jest.Mock;
  deleteMany: jest.Mock;
  transaction: jest.Mock;
}

function build(sessionMax = SESSION_MAX): Harness {
  const lock = jest.fn().mockResolvedValue([{ isActive: true }]);
  const findUnique = jest.fn();
  const create = jest.fn().mockResolvedValue(undefined);
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const tx = { $queryRaw: lock, session: { findUnique, create, updateMany } };
  const transaction = jest.fn((callback: (client: unknown) => Promise<unknown>) => callback(tx));
  const prismaClient = {
    $transaction: transaction,
    session: { deleteMany, updateMany },
  } as unknown as PrismaClient;

  return {
    service: new JwtAuthTokenService(codec, prismaClient, ACCESS_TTL, REFRESH_TTL, sessionMax),
    lock,
    findUnique,
    create,
    updateMany,
    deleteMany,
    transaction,
  };
}

/** What `create` was asked to persist. */
function createdSession(h: Harness, call = 0): Record<string, unknown> {
  const [arg] = h.create.mock.calls[call] as [{ data: Record<string, unknown> }];
  return arg.data;
}

/** The stored session that goes with a refresh token we really signed. */
function storedSessionFor(
  refreshToken: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const claims = codec.verifyRefreshToken(refreshToken);
  return {
    id: claims.jti,
    userId: claims.sub,
    familyId: claims.fam,
    refreshTokenHash: sha256(refreshToken),
    isRevoked: false,
    rotatedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    absoluteExpiresAt: new Date(Date.now() + 120_000),
    ...overrides,
  };
}

async function issuedRefreshToken(): Promise<string> {
  const h = build();
  return (await h.service.issueTokenPair(USER_ID)).refreshToken;
}

describe('JwtAuthTokenService', () => {
  describe('issueTokenPair', () => {
    it('opens a new family, persists the session and signs a matching access/refresh pair', async () => {
      const h = build();

      const pair = await h.service.issueTokenPair(USER_ID);

      const session = createdSession(h);
      const refresh = codec.verifyRefreshToken(pair.refreshToken);
      const access = codec.verifyAccessToken(pair.accessToken);
      expect(refresh).toEqual({ sub: USER_ID, jti: session.id, fam: session.familyId });
      expect(access).toEqual({ sub: USER_ID, fam: session.familyId });
      expect(session).toMatchObject({
        userId: USER_ID,
        refreshTokenHash: sha256(pair.refreshToken),
        isRevoked: false,
      });
    });

    it('stores the hash, never the token itself', async () => {
      const h = build();

      const pair = await h.service.issueTokenPair(USER_ID);

      expect(JSON.stringify(createdSession(h))).not.toContain(pair.refreshToken);
    });

    it('caps the whole login chain at the absolute lifetime', async () => {
      const h = build(3600);

      await h.service.issueTokenPair(USER_ID);

      const session = createdSession(h);
      const absolute = (session.absoluteExpiresAt as Date).getTime();
      expect(absolute - Date.now()).toBeLessThanOrEqual(3600_000);
      // The refresh token (7 days by default) is cut short by the chain's hard end.
      expect((session.expiresAt as Date).getTime()).toBeLessThanOrEqual(absolute);
    });

    it('locks the user row first, so it serialises with rotations and bulk revocations', async () => {
      const h = build();

      await h.service.issueTokenPair(USER_ID);

      expect(h.transaction).toHaveBeenCalledTimes(1);
      expect(h.lock).toHaveBeenCalledTimes(1);
    });

    it('refuses to open a session for a deactivated or unknown user', async () => {
      const inactive = build();
      inactive.lock.mockResolvedValue([{ isActive: false }]);
      const unknown = build();
      unknown.lock.mockResolvedValue([]);

      await expect(inactive.service.issueTokenPair(USER_ID)).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      );
      await expect(unknown.service.issueTokenPair(USER_ID)).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      );
      expect(inactive.create).not.toHaveBeenCalled();
      expect(unknown.create).not.toHaveBeenCalled();
    });

    it('refuses a user id that is not a UUID without touching the database', async () => {
      const h = build();

      await expect(h.service.issueTokenPair('not-a-uuid')).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      );
      expect(h.transaction).not.toHaveBeenCalled();
    });
  });

  describe('rotateRefreshToken', () => {
    it('burns the presented session and opens the next one in the same family, same hard end', async () => {
      const refreshToken = await issuedRefreshToken();
      const stored = storedSessionFor(refreshToken);
      const h = build();
      h.findUnique.mockResolvedValue(stored);

      const pair = await h.service.rotateRefreshToken(refreshToken);

      expect(h.updateMany).toHaveBeenCalledWith({
        where: { id: stored.id, isRevoked: false, rotatedAt: null },
        data: { isRevoked: true, rotatedAt: expect.any(Date) as unknown },
      });
      const next = createdSession(h);
      expect(next.familyId).toBe(stored.familyId);
      expect(next.id).not.toBe(stored.id);
      expect(next.absoluteExpiresAt).toBe(stored.absoluteExpiresAt);
      expect((next.expiresAt as Date).getTime()).toBeLessThanOrEqual(
        (stored.absoluteExpiresAt as Date).getTime(),
      );
      expect(codec.verifyRefreshToken(pair.refreshToken).jti).toBe(next.id);
    });

    it('rejects a token that is not a refresh token without a single query', async () => {
      const h = build();
      const access = (await h.service.issueTokenPair(USER_ID)).accessToken;
      h.transaction.mockClear();

      await expect(h.service.rotateRefreshToken(access)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
      await expect(h.service.rotateRefreshToken('garbage')).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
      expect(h.transaction).not.toHaveBeenCalled();
    });

    describe.each([
      ['an unknown session', () => null],
      ['a revoked session', (t: string) => storedSessionFor(t, { isRevoked: true })],
      ['a session of another user', (t: string) => storedSessionFor(t, { userId: randomUUID() })],
      [
        'a session of another family',
        (t: string) => storedSessionFor(t, { familyId: randomUUID() }),
      ],
      [
        'an expired session',
        (t: string) => storedSessionFor(t, { expiresAt: new Date(Date.now() - 1) }),
      ],
      [
        'a family past its absolute lifetime',
        (t: string) => storedSessionFor(t, { absoluteExpiresAt: new Date(Date.now() - 1) }),
      ],
      [
        'a token that does not match the stored hash',
        (t: string) => storedSessionFor(t, { refreshTokenHash: sha256('another') }),
      ],
    ])('rejects %s', (_label, makeStored) => {
      it('and writes nothing', async () => {
        const refreshToken = await issuedRefreshToken();
        const h = build();
        h.findUnique.mockResolvedValue(makeStored(refreshToken));

        await expect(h.service.rotateRefreshToken(refreshToken)).rejects.toBeInstanceOf(
          InvalidRefreshTokenError,
        );
        expect(h.create).not.toHaveBeenCalled();
        expect(h.updateMany).not.toHaveBeenCalled();
      });
    });

    it.each([
      ['a deactivated account', [{ isActive: false }]],
      ['an account that no longer exists', []],
    ])('rejects the rotation for %s', async (_label, lockRows) => {
      const refreshToken = await issuedRefreshToken();
      const h = build();
      h.lock.mockResolvedValue(lockRows);
      h.findUnique.mockResolvedValue(storedSessionFor(refreshToken));

      await expect(h.service.rotateRefreshToken(refreshToken)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
      expect(h.create).not.toHaveBeenCalled();
    });

    it('rejects when another caller burned the session first (the conditional update matched nothing)', async () => {
      const refreshToken = await issuedRefreshToken();
      const h = build();
      h.findUnique.mockResolvedValue(storedSessionFor(refreshToken));
      h.updateMany.mockResolvedValue({ count: 0 });

      await expect(h.service.rotateRefreshToken(refreshToken)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
      expect(h.create).not.toHaveBeenCalled();
    });

    it('treats an already-rotated token as stolen: revokes the whole family and rejects', async () => {
      const refreshToken = await issuedRefreshToken();
      const stored = storedSessionFor(refreshToken, { isRevoked: true, rotatedAt: new Date() });
      const h = build();
      h.findUnique.mockResolvedValue(stored);

      await expect(h.service.rotateRefreshToken(refreshToken)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
      expect(h.updateMany).toHaveBeenCalledWith({
        where: { familyId: stored.familyId, isRevoked: false },
        data: { isRevoked: true },
      });
      expect(h.create).not.toHaveBeenCalled();
    });

    it('does not revoke a family just because a merely logged-out token was replayed', async () => {
      const refreshToken = await issuedRefreshToken();
      const h = build();
      h.findUnique.mockResolvedValue(storedSessionFor(refreshToken, { isRevoked: true }));

      await expect(h.service.rotateRefreshToken(refreshToken)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
      expect(h.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('revokeRefreshToken', () => {
    it('revokes the one session the token names, scoped to its user', async () => {
      const refreshToken = await issuedRefreshToken();
      const claims = codec.verifyRefreshToken(refreshToken);
      const h = build();

      await h.service.revokeRefreshToken(refreshToken);

      expect(h.updateMany).toHaveBeenCalledWith({
        where: { id: claims.jti, userId: claims.sub, isRevoked: false },
        data: { isRevoked: true },
      });
    });

    it('is a no-op that issues no query for garbage, an empty string or an access token', async () => {
      const h = build();
      const access = (await h.service.issueTokenPair(USER_ID)).accessToken;
      h.transaction.mockClear();
      h.updateMany.mockClear();

      for (const token of ['', 'garbage', access]) {
        await expect(h.service.revokeRefreshToken(token)).resolves.toBeUndefined();
      }
      expect(h.updateMany).not.toHaveBeenCalled();
      expect(h.transaction).not.toHaveBeenCalled();
    });
  });

  describe('revokeAllRefreshTokens', () => {
    it('locks the user then revokes every live session of that user and no other', async () => {
      const h = build();

      await h.service.revokeAllRefreshTokens(USER_ID);

      expect(h.lock).toHaveBeenCalledTimes(1);
      expect(h.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, isRevoked: false },
        data: { isRevoked: true },
      });
    });

    it('does nothing, and queries nothing, for an id that is not a UUID', async () => {
      const h = build();

      await expect(h.service.revokeAllRefreshTokens('not-a-uuid')).resolves.toBeUndefined();
      expect(h.transaction).not.toHaveBeenCalled();
    });
  });

  describe('purgeExpiredSessions', () => {
    it('deletes only sessions that expired before the cutoff and returns how many', async () => {
      const h = build();
      h.deleteMany.mockResolvedValue({ count: 12 });
      const cutoff = new Date();

      await expect(h.service.purgeExpiredSessions(cutoff)).resolves.toBe(12);
      expect(h.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: cutoff } } });
    });
  });
});

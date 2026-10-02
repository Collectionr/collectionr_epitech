import { createHash } from 'node:crypto';
import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { InvalidRefreshTokenError } from '../../application/errors/AuthErrors';
import { JwtAuthTokenService } from './JwtAuthTokenService';
import type { JwtTokenCodec } from './JwtTokenCodec';

const ACCESS_TTL = 900;
const REFRESH_TTL = 604800;
const USER_ID = 'a3f1c9d0-1111-4a2b-8c3d-000000000001';
const SESSION_ID = 'a3f1c9d0-2222-4a2b-8c3d-000000000002';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function validSession(): Record<string, unknown> {
  return {
    id: SESSION_ID,
    userId: USER_ID,
    isRevoked: false,
    expiresAt: new Date(Date.now() + 1000 * 60),
    refreshTokenHash: hashToken('presented-refresh-token'),
  };
}

describe('JwtAuthTokenService', () => {
  let signCallCount: number;
  let sign: jest.Mock;
  let verify: jest.Mock;
  let sessionCreate: jest.Mock;
  let sessionFindUnique: jest.Mock;
  let sessionUpdate: jest.Mock;
  let sessionUpdateMany: jest.Mock;
  let service: JwtAuthTokenService;

  beforeEach(() => {
    signCallCount = 0;
    sign = jest.fn(() => {
      signCallCount += 1;
      return signCallCount === 1 ? 'access-token' : 'refresh-token';
    });
    verify = jest.fn();
    sessionCreate = jest.fn().mockResolvedValue(undefined);
    sessionFindUnique = jest.fn();
    sessionUpdate = jest.fn().mockResolvedValue(undefined);
    sessionUpdateMany = jest.fn().mockResolvedValue({ count: 1 });

    const codec = { sign, verify } as unknown as JwtTokenCodec;
    const prismaClient = {
      session: {
        create: sessionCreate,
        findUnique: sessionFindUnique,
        update: sessionUpdate,
        updateMany: sessionUpdateMany,
      },
    } as unknown as PrismaClient;

    service = new JwtAuthTokenService(codec, prismaClient, ACCESS_TTL, REFRESH_TTL);
  });

  describe('issueTokenPair', () => {
    it('signs an access and a refresh token and persists the session', async () => {
      const tokens = await service.issueTokenPair(USER_ID);

      expect(tokens).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
      expect(sessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            refreshTokenHash: hashToken('refresh-token'),
            isRevoked: false,
          }) as unknown,
        }),
      );
    });
  });

  describe('rotateRefreshToken', () => {
    it('rotates: revokes the old session and issues a fresh pair', async () => {
      verify.mockReturnValue({ sub: USER_ID, jti: SESSION_ID });
      sessionFindUnique.mockResolvedValue(validSession());

      const tokens = await service.rotateRefreshToken('presented-refresh-token');

      expect(verify).toHaveBeenCalledWith('presented-refresh-token');
      expect(sessionUpdate).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: { isRevoked: true },
      });
      expect(tokens).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    });

    it('rejects a token that fails signature/expiry verification', async () => {
      verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.rotateRefreshToken('bad-token')).rejects.toThrow(
        InvalidRefreshTokenError,
      );
    });

    it('rejects when the session is unknown', async () => {
      verify.mockReturnValue({ sub: USER_ID, jti: SESSION_ID });
      sessionFindUnique.mockResolvedValue(null);

      await expect(service.rotateRefreshToken('presented-refresh-token')).rejects.toThrow(
        InvalidRefreshTokenError,
      );
    });

    it('rejects an already-revoked session', async () => {
      verify.mockReturnValue({ sub: USER_ID, jti: SESSION_ID });
      sessionFindUnique.mockResolvedValue({ ...validSession(), isRevoked: true });

      await expect(service.rotateRefreshToken('presented-refresh-token')).rejects.toThrow(
        InvalidRefreshTokenError,
      );
    });

    it('rejects when the session belongs to a different user', async () => {
      verify.mockReturnValue({ sub: USER_ID, jti: SESSION_ID });
      sessionFindUnique.mockResolvedValue({ ...validSession(), userId: 'someone-else' });

      await expect(service.rotateRefreshToken('presented-refresh-token')).rejects.toThrow(
        InvalidRefreshTokenError,
      );
    });

    it('rejects an expired session', async () => {
      verify.mockReturnValue({ sub: USER_ID, jti: SESSION_ID });
      sessionFindUnique.mockResolvedValue({
        ...validSession(),
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.rotateRefreshToken('presented-refresh-token')).rejects.toThrow(
        InvalidRefreshTokenError,
      );
    });

    it('rejects when the presented token does not match the stored hash', async () => {
      verify.mockReturnValue({ sub: USER_ID, jti: SESSION_ID });
      sessionFindUnique.mockResolvedValue({
        ...validSession(),
        refreshTokenHash: hashToken('another-token'),
      });

      await expect(service.rotateRefreshToken('presented-refresh-token')).rejects.toThrow(
        InvalidRefreshTokenError,
      );
    });
  });

  describe('revokeRefreshToken', () => {
    it('marks the matching, not-yet-revoked session as revoked', async () => {
      verify.mockReturnValue({ sub: USER_ID, jti: SESSION_ID });

      await service.revokeRefreshToken('some-refresh-token');

      expect(sessionUpdateMany).toHaveBeenCalledWith({
        where: { id: SESSION_ID, isRevoked: false },
        data: { isRevoked: true },
      });
    });

    it('does not throw for an unknown/malformed token (idempotent)', async () => {
      verify.mockImplementation(() => {
        throw new Error('malformed');
      });

      await expect(service.revokeRefreshToken('garbage')).resolves.toBeUndefined();
      expect(sessionUpdateMany).not.toHaveBeenCalled();
    });
  });
});
